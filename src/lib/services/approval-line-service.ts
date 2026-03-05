/**
 * Approval Line Service
 *
 * Handles CRUD operations for approval lines and resolution of
 * approval lines to actual approvers based on org hierarchy and custom rules.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import {
  ApprovalLine,
  ApprovalLineStatus,
  ApprovalContext,
  ApprovalLineResolution,
  ResolvedApprover,
  ResolvedApprovalStage,
  ResolutionWarning,
  CreateApprovalLineData,
  UpdateApprovalLineData,
  HierarchyConfig,
  ApprovalStageDefinition,
  CustomApprover,
  BudgetThreshold,
  DEFAULT_APPROVAL_LINE_SETTINGS,
  DEFAULT_HIERARCHY_CONFIG,
} from '@/types/approval-line-schema'
import { Position, ApprovalAuthority } from '@/types/org-schema'
import {
  getPosition,
  getCurrentAssignment,
  resolveEffectiveAssignment,
} from './org/org-services'
import { generateId } from '@/lib/utils'
import {
  getSystemApprovalLines,
  getSystemApprovalLineById,
  SYSTEM_REPORTER_APPROVAL_ID,
} from '@/lib/constants/system-approval-lines'

// ============================================================================
// COLLECTION HELPERS
// ============================================================================

function getApprovalLinesCollection(companyId: string, groupId?: string) {
  const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'approvalLines')
  return collection(db, pathSegments[0], ...pathSegments.slice(1))
}

function getApprovalLineDoc(companyId: string, approvalLineId: string, groupId?: string) {
  const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'approvalLines')
  return doc(db, pathSegments[0], ...pathSegments.slice(1), approvalLineId)
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all approval lines for a company
 */
export async function getApprovalLines(
  companyId: string,
  filters?: {
    status?: ApprovalLineStatus | ApprovalLineStatus[]
    category?: string
  },
  groupId?: string
): Promise<ApprovalLine[]> {
  // Fetch all and filter client-side to avoid index/permission issues
  const q = query(getApprovalLinesCollection(companyId, groupId))

  const snapshot = await getDocs(q)

  let approvalLines = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ApprovalLine[]

  // Client-side filtering
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    approvalLines = approvalLines.filter(line => statuses.includes(line.status))
  }

  if (filters?.category) {
    approvalLines = approvalLines.filter(line => line.category === filters.category)
  }

  // Sort by name client-side
  return approvalLines.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

/**
 * Get active approval lines for use in workflow configuration
 */
export async function getActiveApprovalLines(companyId: string, groupId?: string): Promise<ApprovalLine[]> {
  return getApprovalLines(companyId, { status: 'active' }, groupId)
}

/**
 * Get all approval lines INCLUDING system lines (for dropdown/selection)
 *
 * This function returns:
 * 1. System approval lines (from code constant - NOT Firestore)
 * 2. User-created approval lines (from Firestore)
 *
 * System lines appear first with isSystemLine=true flag for UI badge display.
 */
export async function getApprovalLinesWithSystem(
  companyId: string,
  filters?: {
    status?: ApprovalLineStatus | ApprovalLineStatus[]
    category?: string
  },
  groupId?: string
): Promise<ApprovalLine[]> {
  // Get system approval lines from code constant (zero Firestore reads)
  const systemLines = getSystemApprovalLines() as ApprovalLine[]

  // Get user-created approval lines from Firestore
  const userLines = await getApprovalLines(companyId, filters, groupId)

  // Combine: system lines first, then user lines
  // System lines are always "active" so no filtering needed
  return [...systemLines, ...userLines]
}

/**
 * Get active approval lines INCLUDING system lines
 */
export async function getActiveApprovalLinesWithSystem(
  companyId: string,
  groupId?: string
): Promise<ApprovalLine[]> {
  return getApprovalLinesWithSystem(companyId, { status: 'active' }, groupId)
}

/**
 * Get a single approval line by ID
 *
 * Handles both system lines (from code constant) and user-created lines (from Firestore).
 * System lines are identified by their special ID prefix '__SYSTEM_'.
 */
export async function getApprovalLine(
  companyId: string,
  approvalLineId: string,
  groupId?: string
): Promise<ApprovalLine | null> {
  // Check if this is a system approval line (from code constant)
  const systemLine = getSystemApprovalLineById(approvalLineId)
  if (systemLine) {
    return systemLine as ApprovalLine
  }

  // Otherwise, fetch from Firestore
  const docRef = getApprovalLineDoc(companyId, approvalLineId, groupId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ApprovalLine
}

/**
 * Create a new approval line
 */
export async function createApprovalLine(
  companyId: string,
  data: CreateApprovalLineData,
  userId: string,
  groupId?: string
): Promise<ApprovalLine> {
  const now = new Date().toISOString()

  // Generate IDs for stages and custom approvers
  const stages = data.stages.map((stage, index) => ({
    ...stage,
    id: generateId(),
    order: index + 1,
  }))

  const customApprovers = data.customApprovers?.map((approver, index) => ({
    ...approver,
    id: generateId(),
    order: index + 1,
  }))

  const approvalLine: any = {
    companyId,
    name: data.name,
    description: data.description,
    category: data.category,
    resolutionType: data.resolutionType,
    stages,
    settings: { ...DEFAULT_APPROVAL_LINE_SETTINGS, ...data.settings },
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    // Escalation configuration
    escalationPathId: data.escalationPathId || null,
  }

  if (data.hierarchyConfig) {
    approvalLine.hierarchyConfig = { ...DEFAULT_HIERARCHY_CONFIG, ...data.hierarchyConfig }
  }

  if (customApprovers) {
    approvalLine.customApprovers = customApprovers
  }

  const docRef = await addDoc(getApprovalLinesCollection(companyId, groupId), approvalLine)

  return {
    id: docRef.id,
    ...approvalLine,
  }
}

/**
 * Update an existing approval line
 */
export async function updateApprovalLine(
  companyId: string,
  approvalLineId: string,
  data: UpdateApprovalLineData,
  userId: string,
  groupId?: string
): Promise<void> {
  const docRef = getApprovalLineDoc(companyId, approvalLineId, groupId)
  const existing = await getApprovalLine(companyId, approvalLineId, groupId)

  if (!existing) {
    throw new Error('Approval line not found')
  }

  // If stages are being updated, ensure they have IDs
  let stages = data.stages
  if (stages) {
    stages = stages.map((stage, index) => ({
      ...stage,
      id: (stage as { id?: string }).id || generateId(),
      order: index + 1,
    }))
  }

  // If custom approvers are being updated, ensure they have IDs
  let customApprovers = data.customApprovers
  if (customApprovers) {
    customApprovers = customApprovers.map((approver, index) => ({
      ...approver,
      id: (approver as { id?: string }).id || generateId(),
      order: index + 1,
    }))
  }

  // Build update data, handling partial types
  const updateData: any = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.resolutionType !== undefined && { resolutionType: data.resolutionType }),
    ...(data.hierarchyConfig !== undefined && { hierarchyConfig: data.hierarchyConfig }),
    ...(data.settings !== undefined && { settings: data.settings }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.escalationPathId !== undefined && { escalationPathId: data.escalationPathId || null }),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    version: existing.version + 1,
  }

  if (stages) {
    updateData.stages = stages as ApprovalStageDefinition[]
  }

  if (customApprovers) {
    updateData.customApprovers = customApprovers as CustomApprover[]
  }

  await updateDoc(docRef, updateData)
}

/**
 * Update approval line status
 */
export async function updateApprovalLineStatus(
  companyId: string,
  approvalLineId: string,
  status: ApprovalLineStatus,
  userId: string,
  groupId?: string
): Promise<void> {
  const docRef = getApprovalLineDoc(companyId, approvalLineId, groupId)

  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  })
}

/**
 * Delete an approval line (soft delete by archiving)
 */
export async function deleteApprovalLine(
  companyId: string,
  approvalLineId: string,
  userId: string,
  groupId?: string
): Promise<void> {
  await updateApprovalLineStatus(companyId, approvalLineId, 'archived', userId, groupId)
}

/**
 * Permanently delete an approval line
 */
export async function permanentlyDeleteApprovalLine(
  companyId: string,
  approvalLineId: string,
  groupId?: string
): Promise<void> {
  const docRef = getApprovalLineDoc(companyId, approvalLineId, groupId)
  await deleteDoc(docRef)
}

// ============================================================================
// RESOLUTION LOGIC
// ============================================================================

/**
 * Resolve an approval line to actual approvers for a given context
 */
export async function resolveApprovalLine(
  companyId: string,
  approvalLineId: string,
  context: ApprovalContext,
  groupId?: string
): Promise<ApprovalLineResolution> {
  const approvalLine = await getApprovalLine(companyId, approvalLineId, groupId)

  if (!approvalLine) {
    throw new Error(`Approval line not found: ${approvalLineId}`)
  }

  return resolveApprovalLineFromConfig(companyId, approvalLine, context, groupId)
}

/**
 * Resolve an approval line from a configuration object (without fetching from DB)
 * Useful for testing and previewing unsaved changes
 *
 * IMPORTANT: For multi-stage hierarchy approval, this function pre-resolves the
 * hierarchy chain ONCE and then distributes managers to stages:
 * - Stage 1 (order=1) → Level 1 manager (immediate manager)
 * - Stage 2 (order=2) → Level 2 manager (skip-level manager)
 * - Stage N (order=N) → Level N manager
 *
 * This ensures each stage gets a UNIQUE approver from the hierarchy chain.
 */
export async function resolveApprovalLineFromConfig(
  companyId: string,
  approvalLine: ApprovalLine,
  context: ApprovalContext,
  groupId?: string
): Promise<ApprovalLineResolution> {
  if (approvalLine.status !== 'active' && approvalLine.id) { // Only check active if it's an existing one
    // Allow testing draft/new lines in preview mode
  }

  const warnings: ResolutionWarning[] = []
  const resolvedStages: ResolvedApprovalStage[] = []
  let totalApprovers = 0

  // CRITICAL: For multi-stage hierarchy approval, pre-resolve the hierarchy chain
  // This ensures each stage gets a different approver from the chain
  let preResolvedHierarchyChain: ResolvedApprover[] | null = null
  const hierarchyStages = approvalLine.stages.filter(s => s.approverSource === 'hierarchy')

  if (hierarchyStages.length > 1 && approvalLine.hierarchyConfig) {
    console.log(`[ApprovalLineService] Multi-stage hierarchy detected (${hierarchyStages.length} stages). Pre-resolving hierarchy chain...`)
    preResolvedHierarchyChain = await resolveFullHierarchyChain(
      companyId,
      approvalLine.hierarchyConfig,
      context,
      warnings,
      groupId
    )
    console.log(`[ApprovalLineService] Pre-resolved ${preResolvedHierarchyChain.length} managers in hierarchy chain`)
    preResolvedHierarchyChain.forEach((approver, idx) => {
      console.log(`[ApprovalLineService]   Level ${idx + 1}: ${approver.userName} (${approver.positionTitle})`)
    })
  }

  // Process each stage - ensuring correct order with explicit index
  const sortedStages = [...approvalLine.stages].sort((a, b) => (a.order || 0) - (b.order || 0))

  for (let stageIndex = 0; stageIndex < sortedStages.length; stageIndex++) {
    const stage = sortedStages[stageIndex]
    if (!stage) continue // Skip if stage is undefined
    // Ensure stage has correct order (fallback to index + 1)
    const effectiveOrder = stage.order || (stageIndex + 1)

    console.log(`[ApprovalLineService] Processing Stage ${effectiveOrder}: "${stage.name}" (approverSource: ${stage.approverSource})`)

    // Check if stage should be skipped based on condition
    if (stage.condition) {
      const conditionMet = evaluateCondition(stage.condition, context)
      if (!conditionMet) {
        resolvedStages.push({
          stageId: stage.id,
          stageName: stage.name,
          stageOrder: effectiveOrder,
          stageType: stage.type,
          requiredApprovals: stage.requiredApprovals,
          approvers: [],
          timeoutHours: stage.timeoutHours || approvalLine.defaultTimeoutHours || 24,
          // Use stage-level escalation path, falling back to workflow-level
          escalationPathId: stage.escalationPathId || approvalLine.escalationPathId,
          wasSkipped: true,
          skipReason: stage.skipReason || 'Condition not met',
        })
        continue
      }
    }

    // Resolve approvers for this stage
    let stageApprovers: ResolvedApprover[]

    // For hierarchy stages in multi-stage approval, use the pre-resolved chain
    if (stage.approverSource === 'hierarchy' && preResolvedHierarchyChain) {
      // Find this stage's position in the hierarchy stages (1-based)
      const hierarchyStageIndex = hierarchyStages.findIndex(s => s.id === stage.id)
      const targetLevel = hierarchyStageIndex + 1 // 1-based level

      console.log(`[ApprovalLineService] Stage "${stage.name}" is hierarchy stage #${targetLevel}`)

      // Get the approver at this level from the pre-resolved chain
      const approverAtLevel = preResolvedHierarchyChain[hierarchyStageIndex]
      if (approverAtLevel) {
        // Update the approver's stage info
        stageApprovers = [{
          ...approverAtLevel,
          stageId: stage.id,
          stageOrder: effectiveOrder,
          level: targetLevel,
        }]
        console.log(`[ApprovalLineService] ✓ Assigned ${approverAtLevel.userName} (level ${targetLevel}) to stage "${stage.name}"`)
      } else {
        console.warn(`[ApprovalLineService] ⚠ No approver found at level ${targetLevel} for stage "${stage.name}"`)
        stageApprovers = []
        warnings.push({
          type: 'no_approvers',
          message: `No approver found at hierarchy level ${targetLevel} for stage "${stage.name}"`,
          stageId: stage.id,
        })
      }
    } else {
      // Non-hierarchy stages or single-stage approval - use normal resolution
      stageApprovers = await resolveStageApprovers(
        companyId,
        approvalLine,
        { ...stage, order: effectiveOrder },
        context,
        warnings,
        groupId
      )
    }

    resolvedStages.push({
      stageId: stage.id,
      stageName: stage.name,
      stageOrder: effectiveOrder,
      stageType: stage.type,
      requiredApprovals: stage.requiredApprovals || stageApprovers.length || 1,
      approvers: stageApprovers,
      timeoutHours: stage.timeoutHours || approvalLine.defaultTimeoutHours || 24,
      // Use stage-level escalation path, falling back to workflow-level
      escalationPathId: stage.escalationPathId || approvalLine.escalationPathId,
      wasSkipped: false,
    })

    totalApprovers += stageApprovers.length
  }

  return {
    approvalLineId: approvalLine.id,
    approvalLineName: approvalLine.name,
    resolvedAt: new Date().toISOString(),
    stages: resolvedStages,
    totalApprovers,
    totalStages: resolvedStages.filter((s) => !s.wasSkipped).length,
    warnings,
    hasVacantPositions: warnings.some((w) => w.type === 'vacant_position'),
    hasDelegations: warnings.some((w) => w.type === 'delegation_active'),
  }
}

/**
 * Pre-resolve the full hierarchy chain for multi-stage approval
 * Returns an array of approvers, one per level:
 * - Index 0 = Level 1 (immediate manager)
 * - Index 1 = Level 2 (skip-level manager)
 * - etc.
 */
async function resolveFullHierarchyChain(
  companyId: string,
  hierarchyConfig: HierarchyConfig,
  context: ApprovalContext,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover[]> {
  const approvers: ResolvedApprover[] = []

  // Get starting position
  let currentPosition = await getStartingPosition(companyId, hierarchyConfig, context, groupId)

  if (!currentPosition) {
    console.warn(`[ApprovalLineService] ⚠ Could not determine starting position for hierarchy chain`)
    warnings.push({
      type: 'no_approvers',
      message: `Could not determine starting position for hierarchy traversal`,
    })
    return approvers
  }

  console.log(`[ApprovalLineService] Starting hierarchy chain from: ${currentPosition.title} (${currentPosition.id})`)

  const maxLevels = hierarchyConfig.levelsUp
  let level = 0

  while (currentPosition && level < maxLevels) {
    if (!currentPosition.reportsToPositionId) {
      console.log(`[ApprovalLineService] Top of hierarchy reached at level ${level}`)
      break
    }

    const managerPosition = await getPosition(companyId, currentPosition.reportsToPositionId, groupId)
    if (!managerPosition) {
      console.warn(`[ApprovalLineService] Manager position not found: ${currentPosition.reportsToPositionId}`)
      break
    }

    level++
    console.log(`[ApprovalLineService] Level ${level}: Found ${managerPosition.title} (${managerPosition.id})`)

    // Resolve position to user
    const effective = await resolveEffectiveAssignment(companyId, managerPosition.id, groupId)

    if (effective?.userId) {
      // Fetch user name
      let userName = 'Unknown'
      try {
        const userPath = groupId
          ? ['enterpriseGroups', groupId, 'users', effective.userId]
          : ['companies', companyId, 'users', effective.userId]
        const userDoc = await getDoc(doc(db, ...userPath))
        if (userDoc.exists()) {
          const userData = userDoc.data() as any
          userName = userData.name || userData.displayName || userData.email || 'Unknown'
        }
      } catch (e) {
        console.warn(`[ApprovalLineService] Could not fetch user name for ${effective.userId}`)
      }

      approvers.push({
        userId: effective.userId,
        userName,
        positionId: managerPosition.id,
        positionTitle: managerPosition.title,
        departmentId: managerPosition.orgUnitId || undefined,
        level,
        stageId: '', // Will be set when assigned to a stage
        stageOrder: 0, // Will be set when assigned to a stage
        source: 'hierarchy',
        orderInStage: 0,
        isDelegated: effective.isDelegated || false,
        delegatedFrom: effective.originalUserId || undefined,
        delegationId: effective.delegationId || undefined,
        isRequired: true,
        canDelegate: true,
        timeoutHours: hierarchyConfig.levelsUp * 24, // Default
      })

      console.log(`[ApprovalLineService] ✓ Level ${level} approver: ${userName} (${effective.userId})`)
    } else if (hierarchyConfig.skipVacantPositions) {
      console.log(`[ApprovalLineService] Position ${managerPosition.title} is vacant, skipping...`)
      warnings.push({
        type: 'vacant_position',
        message: `Position ${managerPosition.title} at level ${level} is vacant`,
        positionId: managerPosition.id,
      })
      // Continue to find more managers, but don't increment effective level
    } else {
      console.log(`[ApprovalLineService] Position ${managerPosition.title} is vacant and skipVacantPositions=false`)
      break
    }

    currentPosition = managerPosition
  }

  return approvers
}

/**
 * Resolve approvers for a specific stage
 */
async function resolveStageApprovers(
  companyId: string,
  approvalLine: ApprovalLine,
  stage: ApprovalStageDefinition,
  context: ApprovalContext,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover[]> {
  const approvers: ResolvedApprover[] = []
  let orderInStage = 0

  switch (stage.approverSource) {
    case 'hierarchy':
      const hierarchyApprovers = await resolveHierarchyApprovers(
        companyId,
        approvalLine.hierarchyConfig!,
        stage,
        context,
        warnings,
        groupId
      )
      approvers.push(...hierarchyApprovers)
      break

    case 'custom':
      const customApprovers = await resolveCustomApprovers(
        companyId,
        approvalLine.customApprovers || [],
        stage,
        context,
        warnings,
        groupId
      )
      approvers.push(...customApprovers)
      break

    case 'mixed':
      // First hierarchy approvers, then custom
      const mixedHierarchy = await resolveHierarchyApprovers(
        companyId,
        approvalLine.hierarchyConfig!,
        stage,
        context,
        warnings,
        groupId
      )
      approvers.push(...mixedHierarchy)

      const mixedCustom = await resolveCustomApprovers(
        companyId,
        approvalLine.customApprovers || [],
        stage,
        context,
        warnings,
        groupId
      )
      approvers.push(...mixedCustom)
      break

    case 'dynamic':
      // Dynamic resolution based on stage configuration
      if (stage.positionIds?.length) {
        for (const positionId of stage.positionIds) {
          const resolved = await resolvePositionToApprover(
            companyId,
            positionId,
            stage,
            orderInStage++,
            warnings,
            groupId
          )
          if (resolved) {
            approvers.push(resolved)
          }
        }
      }
      break
  }

  // Apply skipIfSameUser setting
  if (approvalLine.settings.skipIfSameUser) {
    return approvers.filter((a) => a.userId !== context.requesterId)
  }

  return approvers
}

/**
 * Resolve approvers based on organization hierarchy
 *
 * IMPORTANT: For multi-stage hierarchy approval, each stage should get ONLY
 * the approver at its specific level, not all levels. The stage's `order`
 * property determines which hierarchy level it maps to:
 * - Stage 1 (order=1) → Level 1 manager (immediate manager)
 * - Stage 2 (order=2) → Level 2 manager (skip-level manager)
 *
 * If hierarchyLevel is explicitly set on the stage, that takes precedence.
 */
async function resolveHierarchyApprovers(
  companyId: string,
  hierarchyConfig: HierarchyConfig,
  stage: ApprovalStageDefinition,
  context: ApprovalContext,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover[]> {
  const approvers: ResolvedApprover[] = []

  // Get starting position
  console.log(`[ApprovalLineService] Getting starting position for hierarchy. Config: ${hierarchyConfig.startFrom}, RequesterPositionId: ${context.requesterPositionId}, RequesterId: ${context.requesterId}`)
  let currentPosition = await getStartingPosition(companyId, hierarchyConfig, context, groupId)

  if (!currentPosition) {
    console.warn(`[ApprovalLineService] ⚠ FAILED to get starting position. Check if user has an active position assignment.`)
    warnings.push({
      type: 'no_approvers',
      message: `Could not determine starting position for hierarchy traversal. RequesterPositionId: ${context.requesterPositionId || 'UNDEFINED'}`,
      stageId: stage.id,
    })
    return approvers
  }

  console.log(`[ApprovalLineService] ✓ Starting position resolved: ${currentPosition.title} (${currentPosition.id}), ReportsTo: ${currentPosition.reportsToPositionId || 'NONE'}`)

  // Determine the target hierarchy level for this stage
  // For multi-stage approvals, each stage maps to a specific level:
  // - Stage 1 → Level 1 (immediate manager)
  // - Stage 2 → Level 2 (skip-level manager)
  // - etc.
  // If hierarchyLevel is explicitly set, use that instead
  const targetLevel = stage.hierarchyLevel || stage.order

  // Total levels to traverse (we may need to go beyond targetLevel if positions are vacant)
  const maxLevels = hierarchyConfig.levelsUp

  console.log(`[ApprovalLineService] Stage "${stage.name}" (order=${stage.order}) targets hierarchy level ${targetLevel}. Max levels: ${maxLevels}`)

  // If budget thresholds are configured, adjust based on amount
  let budgetAdjustedLevel = targetLevel
  if (hierarchyConfig.budgetThresholds && context.amount !== undefined) {
    const threshold = findApplicableThreshold(hierarchyConfig.budgetThresholds, context.amount)
    if (threshold) {
      budgetAdjustedLevel = Math.max(targetLevel, threshold.levelsUp)
    }
  }

  // Traverse up the hierarchy to find the approver at the target level
  let level = 0
  let orderInStage = 0

  console.log(`[ApprovalLineService] Starting hierarchy traversal to reach level ${targetLevel}`)

  while (currentPosition && level < maxLevels) {
    // Get manager position
    if (!currentPosition.reportsToPositionId) {
      console.log(`[ApprovalLineService] Position ${currentPosition.title} has no reportsToPositionId. Top of hierarchy reached.`)
      break // No manager, top of hierarchy
    }

    const managerPosition = await getPosition(companyId, currentPosition.reportsToPositionId, groupId)
    if (!managerPosition) {
      console.warn(`[ApprovalLineService] ⚠ Manager position ${currentPosition.reportsToPositionId} not found in database.`)
      break
    }

    level++ // Increment level BEFORE checking (level 1 = first manager)
    console.log(`[ApprovalLineService] Level ${level}: Checking manager ${managerPosition.title} (${managerPosition.id})`)

    // Check stop conditions
    if (shouldStopTraversal(hierarchyConfig, managerPosition, level - 1)) {
      console.log(`[ApprovalLineService] Stop condition met for ${managerPosition.title}. Stopping traversal.`)
      break
    }

    // Check approval authority if required
    if (hierarchyConfig.requireApprovalAuthority) {
      const hasAuthority = managerPosition.approvalAuthority?.[hierarchyConfig.requireApprovalAuthority]
      if (!hasAuthority) {
        // Skip this level, continue traversing
        console.log(`[ApprovalLineService] Manager ${managerPosition.title} lacks required authority. Skipping.`)
        currentPosition = managerPosition
        continue
      }
    }

    // Check budget authority if required
    if (hierarchyConfig.minBudgetAuthority && context.amount) {
      const budgetLimit = managerPosition.approvalAuthority?.budgetLimit || 0
      if (budgetLimit < hierarchyConfig.minBudgetAuthority) {
        // Skip this level
        currentPosition = managerPosition
        continue
      }
    }

    // Only add approver if we've reached the target level for this stage
    if (level === targetLevel) {
      // Resolve position to actual user
      const resolved = await resolvePositionToApprover(
        companyId,
        managerPosition.id,
        stage,
        orderInStage++,
        warnings,
        groupId
      )

      if (resolved) {
        console.log(`[ApprovalLineService] ✓ Found target level ${level} approver: ${resolved.userName} (${resolved.userId}) for position ${managerPosition.title}`)
        resolved.level = level
        approvers.push(resolved)
        break // Found the approver for this stage, stop traversing
      } else if (hierarchyConfig.skipVacantPositions) {
        // Position is vacant, continue to next level to find a substitute
        warnings.push({
          type: 'vacant_position',
          message: `Position ${managerPosition.title} is vacant at target level ${level}, skipping to next level`,
          stageId: stage.id,
          positionId: managerPosition.id,
        })
        // Don't break, continue to find next available manager
      } else {
        // Vacant and not skipping - handle based on fallback
        handleVacantPosition(hierarchyConfig, managerPosition, stage, warnings)
        break
      }
    } else {
      console.log(`[ApprovalLineService] Level ${level} < target ${targetLevel}, continuing traversal...`)
    }

    currentPosition = managerPosition
  }

  // Add additional approvers from budget threshold if applicable
  if (hierarchyConfig.budgetThresholds && context.amount !== undefined) {
    const threshold = findApplicableThreshold(hierarchyConfig.budgetThresholds, context.amount)
    if (threshold?.additionalApprovers?.length) {
      for (const positionId of threshold.additionalApprovers) {
        const resolved = await resolvePositionToApprover(
          companyId,
          positionId,
          stage,
          orderInStage++,
          warnings,
          groupId
        )
        if (resolved) {
          resolved.level = targetLevel + 1 // After hierarchy approvers
          approvers.push(resolved)
        }
      }
    }
  }

  console.log(`[ApprovalLineService] Hierarchy resolution for stage "${stage.name}" complete. Found ${approvers.length} approver(s)`)
  return approvers
}

/**
 * Resolve custom approvers (outside hierarchy)
 *
 * IMPORTANT: For multi-stage custom approval lines, each stage should get
 * only ONE approver. The matching logic is:
 * 1. If stage.customApproverIds is set explicitly, use those approvers
 * 2. Otherwise, match by ORDER: stage order N → custom approver with order N
 *
 * This prevents the bug where all approvers are assigned to every stage.
 */
async function resolveCustomApprovers(
  companyId: string,
  customApprovers: CustomApprover[],
  stage: ApprovalStageDefinition,
  context: ApprovalContext,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover[]> {
  const approvers: ResolvedApprover[] = []

  // Filter to approvers for this stage
  let stageApprovers: CustomApprover[] = []

  if (stage.customApproverIds?.length) {
    // Explicit mapping: use the specified approver IDs
    stageApprovers = customApprovers.filter((a) => stage.customApproverIds!.includes(a.id))
    console.log(`[ApprovalLineService] Stage "${stage.name}" has explicit customApproverIds: ${stage.customApproverIds.join(', ')}`)
  } else {
    // Fallback: Match by ORDER (stage order N → approver with order N)
    // This is the SAFE DEFAULT that ensures each stage gets its own approver
    const stageOrder = stage.order || 1
    const matchingApprover = customApprovers.find(a => a.order === stageOrder)

    if (matchingApprover) {
      stageApprovers = [matchingApprover]
      console.log(`[ApprovalLineService] Stage "${stage.name}" (order ${stageOrder}) matched to approver "${matchingApprover.name}" (order ${matchingApprover.order})`)
    } else {
      // If no matching approver found by order, log warning
      console.warn(`[ApprovalLineService] ⚠ Stage "${stage.name}" (order ${stageOrder}) has no matching custom approver. Found approvers: ${customApprovers.map(a => `${a.name}(order=${a.order})`).join(', ')}`)
      warnings.push({
        type: 'no_approvers',
        message: `Stage "${stage.name}" has no matching custom approver for order ${stageOrder}`,
        stageId: stage.id,
      })
    }
  }

  for (const customApprover of stageApprovers) {
    // Check condition if specified
    if (customApprover.condition) {
      const conditionMet = evaluateCondition(customApprover.condition, context)
      if (!conditionMet) {
        continue
      }
    }

    const resolved = await resolveCustomApproverToUser(
      companyId,
      customApprover,
      stage,
      warnings,
      groupId
    )

    if (resolved) {
      approvers.push(resolved)
    }
  }

  return approvers
}

/**
 * Resolve a custom approver to an actual user
 *
 * INDUSTRY BEST PRACTICE:
 * - type='position' is RECOMMENDED: Resolves to whoever is currently assigned to that position
 *   When personnel change, the approval automatically uses the new person
 * - type='user' is for specific individuals who should always approve regardless of position
 *   We validate at resolution time that the user still exists and is active
 */
async function resolveCustomApproverToUser(
  companyId: string,
  customApprover: CustomApprover,
  stage: ApprovalStageDefinition,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover | null> {
  switch (customApprover.type) {
    case 'user': {
      // Direct user reference - MUST validate user still exists
      const userId = customApprover.value
      console.log(`[ApprovalLineService] Resolving custom user approver: ${customApprover.name} (${userId})`)

      try {
        const userPath = groupId
          ? ['enterpriseGroups', groupId, 'users', userId]
          : ['companies', companyId, 'users', userId]
        const userDoc = await getDoc(doc(db, ...userPath))

        if (!userDoc.exists()) {
          // User was deleted - warn and skip
          console.warn(`[ApprovalLineService] ⚠ User "${customApprover.name}" (${userId}) no longer exists. Skipping.`)
          warnings.push({
            type: 'user_inactive',
            message: `User "${customApprover.name}" no longer exists. Consider updating the approval line to use a position-based approver instead.`,
            stageId: stage.id,
            userId,
          })
          return null
        }

        const userData = userDoc.data() as any

        // Check if user is active
        if (userData.status === 'inactive' || userData.status === 'deleted') {
          console.warn(`[ApprovalLineService] ⚠ User "${customApprover.name}" (${userId}) is inactive. Skipping.`)
          warnings.push({
            type: 'user_inactive',
            message: `User "${customApprover.name}" is inactive. Consider updating the approval line.`,
            stageId: stage.id,
            userId,
          })
          return null
        }

        // User exists and is active - get current info
        const userName = userData.name || userData.displayName || userData.email || customApprover.name || 'Unknown'

        // Try to get user's current position for better context
        let positionId: string | undefined = undefined
        let positionTitle: string | undefined = undefined
        let departmentId: string | undefined = undefined

        try {
          const { getCurrentAssignmentForUser } = await import('./org/org-services')
          const assignment = await getCurrentAssignmentForUser(companyId, userId, groupId)
          if (assignment) {
            positionId = assignment.positionId
            const position = await getPosition(companyId, assignment.positionId, groupId)
            if (position) {
              positionTitle = position.title
              departmentId = position.orgUnitId || undefined
            }
          }
        } catch (e) {
          // Position lookup is optional, continue without it
          console.log(`[ApprovalLineService] Could not get position for user ${userId}`)
        }

        console.log(`[ApprovalLineService] ✓ Resolved user approver: ${userName} (${userId}), position: ${positionTitle || 'N/A'}`)

        return {
          userId,
          userName,
          positionId,
          positionTitle,
          departmentId,
          level: 0,
          stageId: stage.id,
          stageOrder: stage.order,
          source: 'custom',
          orderInStage: customApprover.order,
          isDelegated: false,
          delegatedFrom: undefined,
          delegationId: undefined,
          isRequired: customApprover.isRequired ?? true,
          canDelegate: customApprover.canDelegate ?? true,
          timeoutHours: stage.timeoutHours,
        }
      } catch (error) {
        console.error(`[ApprovalLineService] Error resolving user ${userId}:`, error)
        warnings.push({
          type: 'no_approvers',
          message: `Failed to resolve user "${customApprover.name}": ${error}`,
          stageId: stage.id,
          userId,
        })
        return null
      }
    }

    case 'position':
      // Position-based approver - RECOMMENDED approach
      // Automatically resolves to whoever is currently assigned to this position
      console.log(`[ApprovalLineService] Resolving position-based approver: ${customApprover.name} (position: ${customApprover.value})`)
      return resolvePositionToApprover(
        companyId,
        customApprover.value,
        stage,
        customApprover.order,
        warnings,
        groupId
      )

    case 'role':
      // TODO: Implement role-based resolution
      warnings.push({
        type: 'no_approvers',
        message: `Role-based approver resolution not yet implemented: ${customApprover.name}`,
        stageId: stage.id,
      })
      return null

    case 'department':
      // TODO: Implement department head resolution
      warnings.push({
        type: 'no_approvers',
        message: `Department head resolution not yet implemented: ${customApprover.name}`,
        stageId: stage.id,
      })
      return null

    case 'external':
      // External email approver
      return {
        userId: `external:${customApprover.value}`,
        userName: customApprover.name || customApprover.value,
        userEmail: customApprover.value,
        positionId: undefined,
        positionTitle: undefined,
        departmentId: undefined,
        level: 0,
        stageId: stage.id,
        stageOrder: stage.order,
        source: 'custom',
        orderInStage: customApprover.order,
        isDelegated: false,
        delegatedFrom: undefined,
        delegationId: undefined,
        isRequired: customApprover.isRequired ?? true,
        canDelegate: false, // External approvers can't delegate
        timeoutHours: stage.timeoutHours,
      }

    case 'dynamic':
      // TODO: Implement dynamic expression evaluation
      warnings.push({
        type: 'no_approvers',
        message: `Dynamic approver expression not yet implemented: ${customApprover.value}`,
        stageId: stage.id,
      })
      return null

    default:
      return null
  }
}

/**
 * Resolve a position to an approver (user)
 */
async function resolvePositionToApprover(
  companyId: string,
  positionId: string,
  stage: ApprovalStageDefinition,
  orderInStage: number,
  warnings: ResolutionWarning[],
  groupId?: string
): Promise<ResolvedApprover | null> {
  // Get position details
  const position = await getPosition(companyId, positionId, groupId)
  if (!position) {
    warnings.push({
      type: 'no_approvers',
      message: `Position not found: ${positionId}`,
      stageId: stage.id,
      positionId,
    })
    return null
  }

  // Resolve to effective user (considering delegations)
  const effective = await resolveEffectiveAssignment(companyId, positionId, groupId)

  if (!effective || !effective.userId) {
    warnings.push({
      type: 'vacant_position',
      message: `Position ${position.title} has no active assignment`,
      stageId: stage.id,
      positionId,
    })
    return null
  }

  // Track delegation warning
  if (effective.isDelegated) {
    warnings.push({
      type: 'delegation_active',
      message: `Position ${position.title} has active delegation`,
      stageId: stage.id,
      positionId,
      userId: effective.originalUserId || undefined,
    })
  }

  // Fetch user name for the approver
  let userName = 'Unknown'
  try {
    const userPath = groupId
      ? ['enterpriseGroups', groupId, 'users', effective.userId]
      : ['companies', companyId, 'users', effective.userId]
    const userDoc = await getDoc(doc(db, ...userPath))
    if (userDoc.exists()) {
      const userData = userDoc.data() as any
      userName = userData.name || userData.displayName || userData.email || 'Unknown'
    }
  } catch (e) {
    console.warn(`[ApprovalLineService] Could not fetch user name for ${effective.userId}:`, e)
  }

  return {
    userId: effective.userId,
    userName,
    positionId: position.id,
    positionTitle: position.title,
    departmentId: position.orgUnitId || undefined,
    level: 0, // Will be set by caller
    stageId: stage.id,
    stageOrder: stage.order,
    source: 'hierarchy',
    orderInStage,
    isDelegated: effective.isDelegated,
    delegatedFrom: effective.originalUserId || undefined,
    delegationId: effective.delegationId || undefined,
    isRequired: true,
    canDelegate: true,
    timeoutHours: stage.timeoutHours,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the starting position for hierarchy traversal
 */
async function getStartingPosition(
  companyId: string,
  hierarchyConfig: HierarchyConfig,
  context: ApprovalContext,
  groupId?: string
): Promise<Position | null> {
  switch (hierarchyConfig.startFrom) {
    case 'requester':
      if (context.requesterPositionId) {
        return getPosition(companyId, context.requesterPositionId, groupId)
      }
      // Try to get position from user's current assignment
      if (context.requesterId) {
        const { getCurrentAssignmentForUser } = await import('./org/org-services')
        const assignment = await getCurrentAssignmentForUser(companyId, context.requesterId, groupId)
        if (assignment) {
          return getPosition(companyId, assignment.positionId, groupId)
        }
      }
      return null

    case 'position':
      if (hierarchyConfig.startPositionId) {
        return getPosition(companyId, hierarchyConfig.startPositionId, groupId)
      }
      return null

    case 'department_head':
      // Get requester's position first to find their department
      const reqPos = context.requesterPositionId
        ? await getPosition(companyId, context.requesterPositionId, groupId)
        : (context.requesterId ? await (async () => {
          const { getCurrentAssignmentForUser } = await import('./org/org-services')
          const a = await getCurrentAssignmentForUser(companyId, context.requesterId!, groupId)
          return a ? getPosition(companyId, a.positionId, groupId) : null
        })() : null)

      if (reqPos?.orgUnitId) {
        // Look for manager/head of this org unit
        // For now, traverse up until we find a position marked'reportsToPositionId' as null or a high-level position
        // Ideally OrgUnit should have a headPositionId.
        // Fallback: use requester's manager if available
        if (reqPos.reportsToPositionId) {
          return getPosition(companyId, reqPos.reportsToPositionId, groupId)
        }
      }
      return null

    case 'workspace_owner':
      if (context.projectId) {
        const { ProjectService } = await import('./projects/project-services')
        const project = await ProjectService.getProject(companyId, context.projectId)
        if (project?.workspaceId) {
          const { WorkspaceService } = await import('./workspaces/workspace-service')
          const workspace = await WorkspaceService.getWorkspace(companyId, companyId, project.workspaceId)
          if (workspace?.ownerId) {
            const { getCurrentAssignmentForUser } = await import('./org/org-services')
            const ass = await getCurrentAssignmentForUser(companyId, workspace.ownerId, groupId)
            if (ass) return getPosition(companyId, ass.positionId, groupId)
          }
        }
      }
      return null

    case 'project_manager':
      if (context.projectId) {
        const { ProjectService } = await import('./projects/project-services')
        const project = await ProjectService.getProject(companyId, context.projectId)
        if (project?.manager) {
          const pmId = project.manager
          const { getCurrentAssignmentForUser } = await import('./org/org-services')
          const ass = await getCurrentAssignmentForUser(companyId, pmId, groupId)
          if (ass) return getPosition(companyId, ass.positionId, groupId)
        }
      }
      return null

    default:
      return null
  }
}

/**
 * Check if hierarchy traversal should stop
 */
function shouldStopTraversal(
  config: HierarchyConfig,
  position: Position,
  currentLevel: number
): boolean {
  // Stop at specific level
  if (config.stopAtLevel !== undefined && position.level <= config.stopAtLevel) {
    return true
  }

  // Stop at specific position
  if (config.stopAtPosition === position.id) {
    return true
  }

  // Stop at department boundary
  if (config.stopAtDepartment && position.orgUnitId !== config.stopAtDepartment) {
    return true
  }

  return false
}

/**
 * Find the applicable budget threshold for a given amount
 */
function findApplicableThreshold(
  thresholds: BudgetThreshold[],
  amount: number
): BudgetThreshold | null {
  // Sort by minAmount descending to find the highest applicable threshold
  const sorted = [...thresholds].sort((a, b) => b.minAmount - a.minAmount)

  for (const threshold of sorted) {
    if (amount >= threshold.minAmount) {
      if (threshold.maxAmount === null || amount <= threshold.maxAmount) {
        return threshold
      }
    }
  }

  return null
}

/**
 * Handle vacant position based on fallback configuration
 */
function handleVacantPosition(
  config: HierarchyConfig,
  position: Position,
  stage: ApprovalStageDefinition,
  warnings: ResolutionWarning[]
): void {
  switch (config.vacantPositionFallback) {
    case 'skip':
      warnings.push({
        type: 'vacant_position',
        message: `Position ${position.title} is vacant and was skipped`,
        stageId: stage.id,
        positionId: position.id,
      })
      break

    case 'escalate_next':
      warnings.push({
        type: 'vacant_position',
        message: `Position ${position.title} is vacant, will escalate to next level`,
        stageId: stage.id,
        positionId: position.id,
      })
      break

    case 'notify_admin':
      warnings.push({
        type: 'vacant_position',
        message: `Position ${position.title} is vacant, admin will be notified`,
        stageId: stage.id,
        positionId: position.id,
      })
      break

    case 'fail':
      throw new Error(`Cannot resolve approval: Position ${position.title} is vacant`)
  }
}

/**
 * Evaluate a condition against the approval context
 */
function evaluateCondition(
  condition: { type: string; field?: string; operator?: string; value?: unknown; logic?: string; conditions?: unknown[] },
  context: ApprovalContext
): boolean {
  if (condition.type === 'compound' && condition.logic && condition.conditions) {
    const results = condition.conditions.map((c) =>
      evaluateCondition(c as typeof condition, context)
    )

    if (condition.logic === 'and') {
      return results.every((r) => r)
    } else {
      return results.some((r) => r)
    }
  }

  if (!condition.field || !condition.operator) {
    return true // No condition = always true
  }

  // Get field value from context
  const fieldValue = getFieldValue(context, condition.field)

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value
    case 'neq':
      return fieldValue !== condition.value
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number)
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (condition.value as number)
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number)
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (condition.value as number)
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)
    case 'nin':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue)
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value as string)
    case 'starts_with':
      return typeof fieldValue === 'string' && fieldValue.startsWith(condition.value as string)
    case 'ends_with':
      return typeof fieldValue === 'string' && fieldValue.endsWith(condition.value as string)
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return true
  }
}

/**
 * Get a field value from the approval context
 */
function getFieldValue(context: ApprovalContext, field: string): unknown {
  // Handle nested fields with dot notation
  const parts = field.split('.')

  let value: unknown = context
  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined
    }
    value = (value as Record<string, unknown>)[part]
  }

  return value
}

// ============================================================================
// PREVIEW / TESTING
// ============================================================================

/**
 * Preview approval line resolution without creating an instance
 * Useful for testing and configuration validation
 */
export async function previewApprovalLineResolution(
  companyId: string,
  approvalLineId: string,
  sampleContext: Partial<ApprovalContext>
): Promise<ApprovalLineResolution> {
  // Create a complete context with defaults
  const context: ApprovalContext = {
    requesterId: sampleContext.requesterId || 'preview-user',
    resourceType: sampleContext.resourceType || 'custom',
    resourceId: sampleContext.resourceId || 'preview-resource',
    ...sampleContext,
  }

  return resolveApprovalLine(companyId, approvalLineId, context)
}

/**
 * Preview resolution for a specific configuration object
 */
export async function previewApprovalLineConfig(
  companyId: string,
  config: ApprovalLine,
  sampleContext: Partial<ApprovalContext>
): Promise<ApprovalLineResolution> {
  // Create a complete context with defaults
  const context: ApprovalContext = {
    requesterId: sampleContext.requesterId || 'preview-user',
    resourceType: sampleContext.resourceType || 'custom',
    resourceId: sampleContext.resourceId || 'preview-resource',
    ...sampleContext,
  }

  return resolveApprovalLineFromConfig(companyId, config, context)
}

/**
 * Validate an approval line configuration
 */
export async function validateApprovalLine(
  companyId: string,
  approvalLine: ApprovalLine
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Check basic fields
  if (!approvalLine.name?.trim()) {
    errors.push('Name is required')
  }

  if (!approvalLine.stages?.length) {
    errors.push('At least one approval stage is required')
  }

  // Check hierarchy config if resolution type requires it
  if (
    (approvalLine.resolutionType === 'hierarchy' || approvalLine.resolutionType === 'mixed') &&
    !approvalLine.hierarchyConfig
  ) {
    errors.push('Hierarchy configuration is required for hierarchy-based resolution')
  }

  // Check custom approvers if resolution type requires it
  if (
    (approvalLine.resolutionType === 'custom' || approvalLine.resolutionType === 'mixed') &&
    (!approvalLine.customApprovers || approvalLine.customApprovers.length === 0)
  ) {
    errors.push('Custom approvers are required for custom-based resolution')
  }

  // Validate stages
  for (const stage of approvalLine.stages || []) {
    if (!stage.name?.trim()) {
      errors.push(`Stage ${stage.order}: Name is required`)
    }

    if (stage.timeoutHours <= 0) {
      errors.push(`Stage ${stage.order}: Timeout must be greater than 0`)
    }

    if (stage.type === 'parallel' && stage.requiredApprovals < 1) {
      errors.push(`Stage ${stage.order}: Required approvals must be at least 1 for parallel stages`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
