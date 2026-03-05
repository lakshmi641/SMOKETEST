/**
 * Workflow Validation Service
 *
 * Validates approval lines and escalation paths against company org structure.
 * Checks if required positions exist and are filled.
 *
 * Key Principle: Cross-project/cross-department collaboration is INTENDED.
 * Validation only checks if positions EXIST and are FILLED - NOT whether
 * they belong to the same project.
 */

import { generateId } from '@/lib/utils'

// Types
import type {
  ApprovalLine,
  ApprovalStageDefinition,
  CustomApprover,
  EscalationPath,
  EscalationRule,
  EscalationTarget,
} from '@/types/approval-line-schema'

import type {
  ValidationResult,
  ValidationIssue,
  ValidationStatus,
  ValidationIssueType,
  ValidationIssueSeverity,
  ApprovalLineWithValidation,
  EscalationPathWithValidation,
  StageValidationResult,
  RuleValidationResult,
  BatchValidationResult,
  PositionValidationInfo,
  UserValidationInfo,
  HierarchyValidationInfo,
  ProjectWorkflowValidation,
} from '@/types/workflow-validation-schema'

// Org services
import {
  getPosition,
  getCurrentAssignment,
  getOrgUnits,
  getOrgUnit,
} from './org/org-services'

// User services
import { UserService } from './users/user-services'

// Existing services
import { getApprovalLines, getApprovalLine } from './approval-line-service'
import { getEscalationPaths, getEscalationPath } from './escalation-path-service'

// ============================================================================
// VALIDATION CACHE (scoped to a single batch validation run)
// ============================================================================

interface ValidationCache {
  positions: Map<string, Promise<PositionValidationInfo>>
  users: Map<string, Promise<UserValidationInfo>>
  hierarchyInfo: Promise<HierarchyValidationInfo> | null
}

function createValidationCache(): ValidationCache {
  return {
    positions: new Map(),
    users: new Map(),
    hierarchyInfo: null,
  }
}

// ============================================================================
// POSITION & USER VALIDATION HELPERS
// ============================================================================

/**
 * Validate if a position exists and has an assignee.
 * Uses cache to deduplicate lookups within a batch.
 */
async function validatePosition(
  companyId: string,
  positionId: string,
  groupId?: string,
  cache?: ValidationCache
): Promise<PositionValidationInfo> {
  const cacheKey = `${companyId}:${positionId}:${groupId ?? ''}`

  if (cache?.positions.has(cacheKey)) {
    return cache.positions.get(cacheKey)!
  }

  const promise = validatePositionUncached(companyId, positionId, groupId)

  if (cache) {
    cache.positions.set(cacheKey, promise)
  }

  return promise
}

async function validatePositionUncached(
  companyId: string,
  positionId: string,
  groupId?: string
): Promise<PositionValidationInfo> {
  try {
    const position = await getPosition(companyId, positionId, groupId)

    if (!position) {
      return {
        positionId,
        exists: false,
        hasAssignee: false,
      }
    }

    const effectiveGroupId = groupId ?? companyId
    const [assignment, orgUnit] = await Promise.all([
      getCurrentAssignment(companyId, positionId, effectiveGroupId),
      position.orgUnitId ? getOrgUnit(companyId, position.orgUnitId, groupId) : Promise.resolve(null),
    ])

    let assigneeName: string | undefined
    if (assignment?.userId) {
      const user = await UserService.getUser(companyId, assignment.userId, groupId ?? undefined)
      assigneeName = user?.name
    }

    return {
      positionId,
      exists: true,
      title: position.title,
      departmentId: position.orgUnitId,
      departmentName: orgUnit?.name,
      hasAssignee: !!assignment,
      assigneeId: assignment?.userId,
      assigneeName,
      assigneeActive: assignment?.status === 'active',
    }
  } catch (error) {
    console.error(`[WorkflowValidation] Error validating position ${positionId}:`, error)
    return {
      positionId,
      exists: false,
      hasAssignee: false,
    }
  }
}

/**
 * Validate if a user exists and is active.
 * Uses cache to deduplicate lookups within a batch.
 */
async function validateUser(
  companyId: string,
  userId: string,
  groupId?: string,
  cache?: ValidationCache
): Promise<UserValidationInfo> {
  const cacheKey = `${companyId}:${userId}:${groupId ?? ''}`

  if (cache?.users.has(cacheKey)) {
    return cache.users.get(cacheKey)!
  }

  const promise = validateUserUncached(companyId, userId, groupId)

  if (cache) {
    cache.users.set(cacheKey, promise)
  }

  return promise
}

async function validateUserUncached(
  companyId: string,
  userId: string,
  groupId?: string
): Promise<UserValidationInfo> {
  try {
    const user = await UserService.getUser(companyId, userId, groupId ?? undefined)
    if (!user) {
      return {
        userId,
        exists: false,
        isActive: false,
      }
    }
    return {
      userId,
      exists: true,
      name: user.name,
      email: user.email ?? undefined,
      isActive: (user as { status?: string; isActive?: boolean }).status === 'active' || (user as { isActive?: boolean }).isActive !== false,
      positionId: undefined,
      positionTitle: user.position ?? undefined,
    }
  } catch (error) {
    console.error(`[WorkflowValidation] Error validating user ${userId}:`, error)
    return {
      userId,
      exists: false,
      isActive: false,
    }
  }
}

/**
 * Get hierarchy depth info for a company.
 * Uses cache to avoid re-fetching within a batch.
 */
async function getHierarchyInfo(
  companyId: string,
  groupId?: string,
  cache?: ValidationCache
): Promise<HierarchyValidationInfo> {
  if (cache?.hierarchyInfo) {
    return cache.hierarchyInfo
  }

  const promise = getHierarchyInfoUncached(companyId, groupId)

  if (cache) {
    cache.hierarchyInfo = promise
  }

  return promise
}

async function getHierarchyInfoUncached(companyId: string, groupId?: string): Promise<HierarchyValidationInfo> {
  try {
    const orgUnits = await getOrgUnits(companyId, groupId)

    let maxLevel = 0
    const levelNames: Record<number, string> = {}

    for (const unit of orgUnits) {
      const level = 1
      if (level > maxLevel) {
        maxLevel = level
      }
      levelNames[level] = unit.name
    }

    return {
      companyId,
      maxLevel: maxLevel || 5,
      levelNames,
    }
  } catch (error) {
    console.error(`[WorkflowValidation] Error getting hierarchy info:`, error)
    return {
      companyId,
      maxLevel: 5,
      levelNames: {},
    }
  }
}

// ============================================================================
// APPROVAL LINE VALIDATION
// ============================================================================

/**
 * Validate a single approval line.
 * Accepts optional pre-fetched data and cache to avoid redundant Firestore reads.
 */
export async function validateApprovalLine(
  companyId: string,
  approvalLineId: string,
  groupId?: string,
  prefetched?: { approvalLine?: ApprovalLine; hierarchyInfo?: HierarchyValidationInfo },
  cache?: ValidationCache
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  try {
    const approvalLine = prefetched?.approvalLine ?? await getApprovalLine(companyId, approvalLineId, groupId)

    if (!approvalLine) {
      return {
        status: 'error',
        isSelectable: false,
        issues: [{
          id: generateId(),
          type: 'approval_line_deleted',
          severity: 'error',
          message: 'Approval line no longer exists',
        }],
        validatedAt: new Date().toISOString(),
        errorCount: 1,
        warningCount: 0,
      }
    }

    const hierarchyInfo = prefetched?.hierarchyInfo ?? await getHierarchyInfo(companyId, groupId, cache)

    // Validate stages and custom approvers in parallel
    const [stageResults, approverResults] = await Promise.all([
      Promise.all(
        (approvalLine.stages || []).map(stage =>
          validateApprovalStage(companyId, stage, hierarchyInfo, approvalLine.customApprovers || [], groupId, cache)
        )
      ),
      Promise.all(
        (approvalLine.customApprovers || []).map(approver =>
          validateCustomApprover(companyId, approver, groupId, cache)
        )
      ),
    ])

    for (const stageIssues of stageResults) issues.push(...stageIssues)
    for (const approverIssues of approverResults) issues.push(...approverIssues)

    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let status: ValidationStatus = 'valid'
    if (errorCount > 0) status = 'error'
    else if (warningCount > 0) status = 'warning'

    return {
      status,
      isSelectable: errorCount === 0,
      issues,
      validatedAt: new Date().toISOString(),
      errorCount,
      warningCount,
      validStages: (approvalLine.stages?.length || 0) - issues.filter(i => i.stageId).length,
      totalStages: approvalLine.stages?.length || 0,
    }
  } catch (error) {
    console.error(`[WorkflowValidation] Error validating approval line ${approvalLineId}:`, error)
    return {
      status: 'error',
      isSelectable: false,
      issues: [{
        id: generateId(),
        type: 'approval_line_deleted',
        severity: 'error',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      validatedAt: new Date().toISOString(),
      errorCount: 1,
      warningCount: 0,
    }
  }
}

/**
 * Validate an approval stage
 */
async function validateApprovalStage(
  companyId: string,
  stage: ApprovalStageDefinition,
  hierarchyInfo: HierarchyValidationInfo,
  customApprovers: CustomApprover[],
  groupId?: string,
  cache?: ValidationCache
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  if (stage.approverSource === 'hierarchy' && stage.hierarchyLevel) {
    if (stage.hierarchyLevel > hierarchyInfo.maxLevel) {
      issues.push({
        id: generateId(),
        type: 'hierarchy_broken',
        severity: 'error',
        message: `Stage "${stage.name}" requires hierarchy level ${stage.hierarchyLevel}, but company only has ${hierarchyInfo.maxLevel} levels`,
        stageId: stage.id,
        stageName: stage.name,
        hierarchyLevel: stage.hierarchyLevel,
      })
    }
  }

  // Validate all positions in parallel
  if (stage.positionIds && stage.positionIds.length > 0) {
    const positionResults = await Promise.all(
      stage.positionIds.map(positionId => validatePosition(companyId, positionId, groupId, cache))
    )

    for (let i = 0; i < stage.positionIds.length; i++) {
      const positionId = stage.positionIds[i]!
      const positionInfo = positionResults[i]!

      if (!positionInfo.exists) {
        issues.push({
          id: generateId(),
          type: 'position_missing',
          severity: 'error',
          message: `Position in stage "${stage.name}" no longer exists`,
          positionId,
          stageId: stage.id,
          stageName: stage.name,
        })
      } else if (!positionInfo.hasAssignee) {
        issues.push({
          id: generateId(),
          type: 'position_vacant',
          severity: 'error',
          message: `Position "${positionInfo.title}" in stage "${stage.name}" has no assignee - cannot be used`,
          positionId,
          positionTitle: positionInfo.title,
          stageId: stage.id,
          stageName: stage.name,
        })
      } else if (!positionInfo.assigneeActive) {
        issues.push({
          id: generateId(),
          type: 'user_inactive',
          severity: 'warning',
          message: `Assignee for "${positionInfo.title}" in stage "${stage.name}" is inactive`,
          positionId,
          positionTitle: positionInfo.title,
          userId: positionInfo.assigneeId,
          userName: positionInfo.assigneeName,
          stageId: stage.id,
          stageName: stage.name,
        })
      }
    }
  }

  if (stage.customApproverIds && stage.customApproverIds.length > 0) {
    for (const approverId of stage.customApproverIds) {
      const approver = customApprovers.find(a => a.id === approverId)
      if (!approver) {
        issues.push({
          id: generateId(),
          type: 'user_missing',
          severity: 'error',
          message: `Custom approver referenced in stage "${stage.name}" no longer exists`,
          stageId: stage.id,
          stageName: stage.name,
        })
      }
    }
  }

  return issues
}

/**
 * Validate a custom approver
 */
async function validateCustomApprover(
  companyId: string,
  approver: CustomApprover,
  groupId?: string,
  cache?: ValidationCache
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  if (approver.type === 'position') {
    const positionInfo = await validatePosition(companyId, approver.value, groupId, cache)

    if (!positionInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'position_missing',
        severity: 'error',
        message: `Custom approver position "${approver.name}" no longer exists`,
        positionId: approver.value,
        positionTitle: approver.name,
      })
    } else if (!positionInfo.hasAssignee) {
      issues.push({
        id: generateId(),
        type: 'position_vacant',
        severity: 'error',
        message: `Custom approver position "${approver.name}" has no assignee - cannot be used`,
        positionId: approver.value,
        positionTitle: positionInfo.title,
      })
    }
  }

  if (approver.type === 'user') {
    const userInfo = await validateUser(companyId, approver.value, groupId, cache)

    if (!userInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'user_missing',
        severity: 'error',
        message: `Custom approver user "${approver.name}" no longer exists`,
        userId: approver.value,
        userName: approver.name,
      })
    } else if (!userInfo.isActive) {
      issues.push({
        id: generateId(),
        type: 'user_inactive',
        severity: 'warning',
        message: `Custom approver user "${approver.name}" is inactive`,
        userId: approver.value,
        userName: userInfo.name,
      })
    }
  }

  return issues
}

// ============================================================================
// ESCALATION PATH VALIDATION
// ============================================================================

/**
 * Validate a single escalation path.
 * Accepts optional pre-fetched data and cache to avoid redundant Firestore reads.
 */
export async function validateEscalationPath(
  companyId: string,
  escalationPathId: string,
  groupId?: string,
  prefetched?: { escalationPath?: EscalationPath; hierarchyInfo?: HierarchyValidationInfo },
  cache?: ValidationCache
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  try {
    const escalationPath = prefetched?.escalationPath ?? await getEscalationPath(companyId, escalationPathId, groupId)

    if (!escalationPath) {
      return {
        status: 'error',
        isSelectable: false,
        issues: [{
          id: generateId(),
          type: 'escalation_path_deleted',
          severity: 'error',
          message: 'Escalation path no longer exists',
        }],
        validatedAt: new Date().toISOString(),
        errorCount: 1,
        warningCount: 0,
      }
    }

    const hierarchyInfo = prefetched?.hierarchyInfo ?? await getHierarchyInfo(companyId, groupId, cache)

    // Validate rules and custom targets in parallel
    const [ruleResults, targetResults] = await Promise.all([
      Promise.all(
        (escalationPath.rules || []).map(rule =>
          validateEscalationRule(companyId, rule, hierarchyInfo, groupId, cache)
        )
      ),
      Promise.all(
        (escalationPath.customTargets || []).map(target =>
          validateEscalationTarget(companyId, target, groupId, cache)
        )
      ),
    ])

    for (const ruleIssues of ruleResults) issues.push(...ruleIssues)
    for (const targetIssues of targetResults) issues.push(...targetIssues)

    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let status: ValidationStatus = 'valid'
    if (errorCount > 0) status = 'error'
    else if (warningCount > 0) status = 'warning'

    return {
      status,
      isSelectable: errorCount === 0,
      issues,
      validatedAt: new Date().toISOString(),
      errorCount,
      warningCount,
      validRules: (escalationPath.rules?.length || 0) - issues.filter(i => i.ruleId).length,
      totalRules: escalationPath.rules?.length || 0,
    }
  } catch (error) {
    console.error(`[WorkflowValidation] Error validating escalation path ${escalationPathId}:`, error)
    return {
      status: 'error',
      isSelectable: false,
      issues: [{
        id: generateId(),
        type: 'escalation_path_deleted',
        severity: 'error',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      validatedAt: new Date().toISOString(),
      errorCount: 1,
      warningCount: 0,
    }
  }
}

/**
 * Validate an escalation rule
 */
async function validateEscalationRule(
  companyId: string,
  rule: EscalationRule,
  hierarchyInfo: HierarchyValidationInfo,
  groupId?: string,
  cache?: ValidationCache
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  if (rule.targetLevel && rule.targetLevel > hierarchyInfo.maxLevel) {
    issues.push({
      id: generateId(),
      type: 'hierarchy_broken',
      severity: 'error',
      message: `Escalation to level ${rule.targetLevel} not possible - hierarchy only has ${hierarchyInfo.maxLevel} levels`,
      ruleId: rule.id,
      ruleName: rule.name,
      hierarchyLevel: rule.targetLevel,
    })
  }

  // Validate position and user targets in parallel
  const [positionInfo, userInfo] = await Promise.all([
    rule.targetPositionId ? validatePosition(companyId, rule.targetPositionId, groupId, cache) : Promise.resolve(null),
    rule.targetUserId ? validateUser(companyId, rule.targetUserId, groupId, cache) : Promise.resolve(null),
  ])

  if (rule.targetPositionId && positionInfo) {
    if (!positionInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'position_missing',
        severity: 'error',
        message: `Escalation target position in rule "${rule.name || rule.id}" no longer exists`,
        positionId: rule.targetPositionId,
        ruleId: rule.id,
        ruleName: rule.name,
      })
    } else if (!positionInfo.hasAssignee) {
      issues.push({
        id: generateId(),
        type: 'position_vacant',
        severity: 'error',
        message: `Escalation target "${positionInfo.title}" has no assignee - cannot be used`,
        positionId: rule.targetPositionId,
        positionTitle: positionInfo.title,
        ruleId: rule.id,
        ruleName: rule.name,
      })
    }
  }

  if (rule.targetUserId && userInfo) {
    if (!userInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'user_missing',
        severity: 'error',
        message: `Escalation target user in rule "${rule.name || rule.id}" no longer exists`,
        userId: rule.targetUserId,
        ruleId: rule.id,
        ruleName: rule.name,
      })
    } else if (!userInfo.isActive) {
      issues.push({
        id: generateId(),
        type: 'user_inactive',
        severity: 'warning',
        message: `Escalation target user in rule "${rule.name || rule.id}" is inactive`,
        userId: rule.targetUserId,
        userName: userInfo.name,
        ruleId: rule.id,
        ruleName: rule.name,
      })
    }
  }

  return issues
}

/**
 * Validate an escalation target
 */
async function validateEscalationTarget(
  companyId: string,
  target: EscalationTarget,
  groupId?: string,
  cache?: ValidationCache
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  if (target.type === 'position' && target.value) {
    const positionInfo = await validatePosition(companyId, target.value, groupId, cache)

    if (!positionInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'position_missing',
        severity: 'error',
        message: `Escalation target position "${target.name}" no longer exists`,
        positionId: target.value,
        positionTitle: target.name,
      })
    } else if (!positionInfo.hasAssignee) {
      issues.push({
        id: generateId(),
        type: 'position_vacant',
        severity: 'error',
        message: `Escalation target position "${target.name}" has no assignee - cannot be used`,
        positionId: target.value,
        positionTitle: positionInfo.title,
      })
    }
  }

  if (target.type === 'user' && target.value) {
    const userInfo = await validateUser(companyId, target.value, groupId, cache)

    if (!userInfo.exists) {
      issues.push({
        id: generateId(),
        type: 'user_missing',
        severity: 'error',
        message: `Escalation target user "${target.name}" no longer exists`,
        userId: target.value,
        userName: target.name,
      })
    } else if (!userInfo.isActive) {
      issues.push({
        id: generateId(),
        type: 'user_inactive',
        severity: 'warning',
        message: `Escalation target user "${target.name}" is inactive`,
        userId: target.value,
        userName: userInfo.name,
      })
    }
  }

  return issues
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Get all approval lines with validation status.
 * Uses shared cache and parallel validation for performance.
 */
export async function getApprovalLinesWithValidation(
  companyId: string,
  options?: {
    status?: 'active' | 'draft' | 'inactive' | 'archived'
  },
  groupId?: string
): Promise<ApprovalLineWithValidation[]> {
  try {
    const approvalLines = await getApprovalLines(companyId, {
      status: options?.status || ['active', 'draft'],
    }, groupId)

    const cache = createValidationCache()
    const hierarchyInfo = await getHierarchyInfo(companyId, groupId, cache)

    const results = await Promise.all(
      approvalLines.map(async (line) => {
        const validation = await validateApprovalLine(
          companyId,
          line.id,
          groupId,
          { approvalLine: line, hierarchyInfo },
          cache
        )
        return {
          id: line.id,
          name: line.name,
          description: line.description,
          category: line.category,
          stageCount: line.stages?.length || 0,
          status: line.status,
          resolutionType: line.resolutionType,
          version: line.version,
          validation,
        } as ApprovalLineWithValidation
      })
    )

    const statusOrder: Record<string, number> = { valid: 0, warning: 1, error: 2 }
    return results.sort((a, b) => statusOrder[a.validation.status]! - statusOrder[b.validation.status]!)
  } catch (error) {
    console.error('[WorkflowValidation] Error getting approval lines with validation:', error)
    return []
  }
}

/**
 * Get all escalation paths with validation status.
 * Uses shared cache and parallel validation for performance.
 */
export async function getEscalationPathsWithValidation(
  companyId: string,
  options?: {
    status?: 'active' | 'draft' | 'inactive' | 'archived'
  },
  groupId?: string
): Promise<EscalationPathWithValidation[]> {
  try {
    const escalationPaths = await getEscalationPaths(companyId, {
      status: options?.status || ['active', 'draft'],
    }, groupId)

    const cache = createValidationCache()
    const hierarchyInfo = await getHierarchyInfo(companyId, groupId, cache)

    const results = await Promise.all(
      escalationPaths.map(async (path) => {
        const validation = await validateEscalationPath(
          companyId,
          path.id,
          groupId,
          { escalationPath: path, hierarchyInfo },
          cache
        )
        return {
          id: path.id,
          name: path.name,
          description: path.description,
          category: path.category,
          ruleCount: path.rules?.length || 0,
          status: path.status,
          resolutionType: path.resolutionType,
          finalAction: path.settings?.finalAction,
          validation,
        } as EscalationPathWithValidation
      })
    )

    const statusOrder: Record<string, number> = { valid: 0, warning: 1, error: 2 }
    return results.sort((a, b) => statusOrder[a.validation.status]! - statusOrder[b.validation.status]!)
  } catch (error) {
    console.error('[WorkflowValidation] Error getting escalation paths with validation:', error)
    return []
  }
}

/**
 * Perform batch validation of all workflows
 */
export async function batchValidateWorkflows(
  companyId: string,
  groupId?: string
): Promise<BatchValidationResult> {
  const approvalLines = await getApprovalLinesWithValidation(companyId, undefined, groupId)
  const escalationPaths = await getEscalationPathsWithValidation(companyId, undefined, groupId)

  return {
    companyId,
    validatedAt: new Date().toISOString(),
    approvalLines,
    escalationPaths,
    summary: {
      totalApprovalLines: approvalLines.length,
      validApprovalLines: approvalLines.filter(l => l.validation.status === 'valid').length,
      warningApprovalLines: approvalLines.filter(l => l.validation.status === 'warning').length,
      errorApprovalLines: approvalLines.filter(l => l.validation.status === 'error').length,
      totalEscalationPaths: escalationPaths.length,
      validEscalationPaths: escalationPaths.filter(p => p.validation.status === 'valid').length,
      warningEscalationPaths: escalationPaths.filter(p => p.validation.status === 'warning').length,
      errorEscalationPaths: escalationPaths.filter(p => p.validation.status === 'error').length,
    },
  }
}

// ============================================================================
// PROJECT WORKFLOW VALIDATION
// ============================================================================

/**
 * Validate workflows assigned to a specific project
 */
export async function validateProjectWorkflows(
  companyId: string,
  projectId: string,
  projectName: string,
  workflowDefinitionId?: string,
  escalationPolicyId?: string,
  groupId?: string
): Promise<ProjectWorkflowValidation> {
  const result: ProjectWorkflowValidation = {
    projectId,
    projectName,
    validatedAt: new Date().toISOString(),
    hasIssues: false,
    issueCount: 0,
  }

  // Validate approval line if assigned
  if (workflowDefinitionId) {
    const validation = await validateApprovalLine(companyId, workflowDefinitionId, groupId)
    const line = await getApprovalLine(companyId, workflowDefinitionId, groupId)

    result.approvalLine = {
      id: workflowDefinitionId,
      name: line?.name || 'Unknown',
      validation,
    }

    if (validation.status !== 'valid') {
      result.hasIssues = true
      result.issueCount += validation.issues.length
    }
  }

  // Validate escalation path if assigned
  if (escalationPolicyId) {
    const validation = await validateEscalationPath(companyId, escalationPolicyId, groupId)
    const path = await getEscalationPath(companyId, escalationPolicyId, groupId)

    result.escalationPath = {
      id: escalationPolicyId,
      name: path?.name || 'Unknown',
      validation,
    }

    if (validation.status !== 'valid') {
      result.hasIssues = true
      result.issueCount += validation.issues.length
    }
  }

  return result
}
