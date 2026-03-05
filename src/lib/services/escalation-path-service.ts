/**
 * Escalation Path Service
 *
 * Handles CRUD operations for escalation paths and resolution of
 * escalation targets based on org hierarchy and custom rules.
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
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import {
  EscalationPath,
  EscalationPathStatus,
  EscalationRule,
  EscalationTarget,
  EscalationHierarchyConfig,
  CreateEscalationPathData,
  UpdateEscalationPathData,
  NotificationChannel,
  DEFAULT_ESCALATION_PATH_SETTINGS,
  DEFAULT_ESCALATION_HIERARCHY_CONFIG,
  ApprovalStageInstance,
  EscalationTriggerType,
  EscalationAction,
} from '@/types/approval-line-schema'
import { Position } from '@/types/org-schema'
import {
  getPosition,
  resolveEffectiveAssignment,
} from './org/org-services'
import { generateId } from '@/lib/utils'

// ============================================================================
// COLLECTION HELPERS
// ============================================================================

function getEscalationPathsCollection(companyId: string, groupId?: string) {
  const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'escalationPaths') as any
  return collection(db, pathSegments[0], ...pathSegments.slice(1))
}

function getEscalationPathDoc(companyId: string, escalationPathId: string, groupId?: string) {
  const pathSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'escalationPaths') as any
  return doc(db, pathSegments[0], ...pathSegments.slice(1), escalationPathId)
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all escalation paths for a company
 */
export async function getEscalationPaths(
  companyId: string,
  filters?: {
    status?: EscalationPathStatus | EscalationPathStatus[]
    category?: string
  },
  groupId?: string
): Promise<EscalationPath[]> {
  // Fetch all and filter client-side to avoid index/permission issues
  const q = query(getEscalationPathsCollection(companyId, groupId))
  const snapshot = await getDocs(q)

  let paths = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EscalationPath[]

  // Client-side filtering
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    paths = paths.filter(path => statuses.includes(path.status))
  }

  if (filters?.category) {
    paths = paths.filter(path => path.category === filters.category)
  }

  // Sort by name client-side
  return paths.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

/**
 * Get active escalation paths for use in approval line configuration
 */
export async function getActiveEscalationPaths(companyId: string, groupId?: string): Promise<EscalationPath[]> {
  return getEscalationPaths(companyId, { status: 'active' }, groupId)
}

/**
 * Get a single escalation path by ID
 */
export async function getEscalationPath(
  companyId: string,
  escalationPathId: string,
  groupId?: string
): Promise<EscalationPath | null> {
  const docRef = getEscalationPathDoc(companyId, escalationPathId, groupId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as EscalationPath
}

/**
 * Create a new escalation path
 */
export async function createEscalationPath(
  companyId: string,
  data: CreateEscalationPathData,
  userId: string,
  groupId?: string
): Promise<EscalationPath> {
  const now = new Date().toISOString()

  // Generate IDs for rules and custom targets
  const rules = data.rules.map((rule, index) => ({
    ...rule,
    id: generateId(),
    order: index + 1,
  }))

  const customTargets = data.customTargets?.map((target, index) => ({
    ...target,
    id: generateId(),
    level: index + 1,
  }))

  const escalationPath: any = {
    companyId,
    name: data.name,
    description: data.description,
    category: data.category,
    resolutionType: data.resolutionType,
    rules,
    settings: { ...DEFAULT_ESCALATION_PATH_SETTINGS, ...data.settings },
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  }

  if (data.hierarchyConfig) {
    escalationPath.hierarchyConfig = { ...DEFAULT_ESCALATION_HIERARCHY_CONFIG, ...data.hierarchyConfig }
  }

  if (customTargets) {
    escalationPath.customTargets = customTargets
  }

  const docRef = await addDoc(getEscalationPathsCollection(companyId, groupId), escalationPath)

  return {
    id: docRef.id,
    ...escalationPath,
  }
}

/**
 * Update an existing escalation path
 */
export async function updateEscalationPath(
  companyId: string,
  escalationPathId: string,
  data: UpdateEscalationPathData,
  userId: string,
  groupId?: string
): Promise<void> {
  const docRef = getEscalationPathDoc(companyId, escalationPathId, groupId)
  const existing = await getEscalationPath(companyId, escalationPathId, groupId)

  if (!existing) {
    throw new Error('Escalation path not found')
  }

  // If rules are being updated, ensure they have IDs
  let rules = data.rules
  if (rules) {
    rules = rules.map((rule, index) => ({
      ...rule,
      id: (rule as { id?: string }).id || generateId(),
      order: index + 1,
    }))
  }

  // If custom targets are being updated, ensure they have IDs
  let customTargets = data.customTargets
  if (customTargets) {
    customTargets = customTargets.map((target, index) => ({
      ...target,
      id: (target as { id?: string }).id || generateId(),
      level: index + 1,
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
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    version: existing.version + 1,
  }

  if (rules) {
    updateData.rules = rules as EscalationRule[]
  }

  if (customTargets) {
    updateData.customTargets = customTargets as EscalationTarget[]
  }

  await updateDoc(docRef, updateData)
}

/**
 * Update escalation path status
 */
export async function updateEscalationPathStatus(
  companyId: string,
  escalationPathId: string,
  status: EscalationPathStatus,
  userId: string,
  groupId?: string
): Promise<void> {
  const docRef = getEscalationPathDoc(companyId, escalationPathId, groupId)

  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  })
}

/**
 * Delete an escalation path (soft delete by archiving)
 */
export async function deleteEscalationPath(
  companyId: string,
  escalationPathId: string,
  userId: string,
  groupId?: string
): Promise<void> {
  await updateEscalationPathStatus(companyId, escalationPathId, 'archived', userId, groupId)
}

/**
 * Permanently delete an escalation path
 */
export async function permanentlyDeleteEscalationPath(
  companyId: string,
  escalationPathId: string,
  groupId?: string
): Promise<void> {
  const docRef = getEscalationPathDoc(companyId, escalationPathId, groupId)
  await deleteDoc(docRef)
}

// ============================================================================
// ESCALATION RESOLUTION
// ============================================================================

/**
 * Context for evaluating escalation rules
 */
export interface EscalationContext {
  stageInstance: ApprovalStageInstance
  currentApproverPositionId?: string
  hoursSinceStart: number
  hoursSinceLastAction: number
  remindersSent: number
  hasRejections: boolean
  hasPartialApprovals: boolean
}

/**
 * Result of escalation evaluation
 */
export interface EscalationResult {
  shouldEscalate: boolean
  rule?: EscalationRule
  action?: EscalationAction
  targetUserId?: string
  targetPositionId?: string
  targetLevel?: number
  notificationChannels: NotificationChannel[]
  messageTemplate?: string
}

/**
 * Evaluate escalation rules for a given context
 */
export async function evaluateEscalation(
  companyId: string,
  escalationPathId: string,
  context: EscalationContext,
  groupId?: string
): Promise<EscalationResult> {
  const escalationPath = await getEscalationPath(companyId, escalationPathId, groupId)

  if (!escalationPath) {
    throw new Error(`Escalation path not found: ${escalationPathId}`)
  }

  if (escalationPath.status !== 'active') {
    return {
      shouldEscalate: false,
      notificationChannels: [],
    }
  }

  // Check if max escalations reached
  if (context.stageInstance.escalationLevel >= escalationPath.settings.maxEscalations) {
    // Apply final action
    return {
      shouldEscalate: true,
      action: escalationPath.settings.finalAction === 'none'
        ? undefined
        : (escalationPath.settings.finalAction as EscalationAction),
      notificationChannels: ['in_app', 'email'],
      messageTemplate: `Maximum escalations (${escalationPath.settings.maxEscalations}) reached`,
    }
  }

  // Evaluate rules in order - only consider rules that haven't been executed yet
  // Rule order corresponds to escalation level: rule.order 1 = level 1, etc.
  const currentLevel = context.stageInstance.escalationLevel || 0
  const sortedRules = escalationPath.rules.sort((a, b) => a.order - b.order)

  for (const rule of sortedRules) {
    const ruleLevel = rule.order || 1

    // Skip rules that have already been executed
    if (ruleLevel <= currentLevel) {
      continue
    }

    const triggered = isRuleTriggered(rule, context)

    if (triggered) {
      // Resolve escalation target
      const target = await resolveEscalationTarget(
        companyId,
        escalationPath,
        rule,
        context,
        groupId
      )

      return {
        shouldEscalate: true,
        rule,
        action: rule.action,
        targetUserId: target?.userId,
        targetPositionId: target?.positionId,
        targetLevel: ruleLevel,
        notificationChannels: rule.notificationChannels,
        messageTemplate: rule.messageTemplate,
      }
    } else {
      // This rule isn't ready yet - since rules are ordered, stop checking
      break
    }
  }

  return {
    shouldEscalate: false,
    notificationChannels: [],
  }
}

/**
 * Check if an escalation rule is triggered
 */
function isRuleTriggered(rule: EscalationRule, context: EscalationContext): boolean {
  switch (rule.triggerType) {
    case 'time':
      return context.hoursSinceStart >= (rule.triggerAfterHours || 0)

    case 'reminder_count':
      return context.remindersSent >= (rule.triggerAfterReminders || 0)

    case 'rejection':
      return context.hasRejections

    case 'no_response':
      return context.hoursSinceLastAction >= (rule.triggerAfterHours || 0)

    case 'partial_approval':
      return context.hasPartialApprovals

    case 'condition':
      // TODO: Implement custom condition evaluation
      return false

    default:
      return false
  }
}

/**
 * Resolve the target for an escalation action
 */
export async function resolveEscalationTarget(
  companyId: string,
  escalationPath: EscalationPath,
  rule: EscalationRule,
  context: EscalationContext,
  groupId?: string
): Promise<{ userId?: string; positionId?: string } | null> {
  // If rule has specific targets
  if (rule.targetUserId) {
    return { userId: rule.targetUserId }
  }

  if (rule.targetPositionId) {
    const effective = await resolveEffectiveAssignment(companyId, rule.targetPositionId, groupId)
    if (effective?.userId) {
      return { userId: effective.userId, positionId: rule.targetPositionId }
    }
  }

  // Get target level
  const targetLevel = rule.targetLevel || context.stageInstance.escalationLevel + 1

  // Check custom targets
  if (escalationPath.customTargets?.length) {
    const customTarget = escalationPath.customTargets.find((t) => t.level === targetLevel)
    if (customTarget) {
      return resolveCustomTarget(companyId, customTarget, context, groupId)
    }
  }

  // Use hierarchy-based escalation
  if (escalationPath.hierarchyConfig?.escalateToManager && context.currentApproverPositionId) {
    return resolveHierarchyTarget(companyId, escalationPath.hierarchyConfig, context, groupId)
  }

  return null
}

/**
 * Resolve a custom escalation target
 */
async function resolveCustomTarget(
  companyId: string,
  target: EscalationTarget,
  context: EscalationContext,
  groupId?: string
): Promise<{ userId?: string; positionId?: string } | null> {
  switch (target.type) {
    case 'user':
      return { userId: target.value }

    case 'position':
      if (target.value) {
        const effective = await resolveEffectiveAssignment(companyId, target.value, groupId)
        if (effective?.userId) {
          return { userId: effective.userId, positionId: target.value }
        }
      }
      return null

    case 'role':
      // TODO: Implement role-based resolution
      return null

    case 'hierarchy_next':
      // Resolve next level in hierarchy from current approver
      if (context.currentApproverPositionId) {
        const currentPosition = await getPosition(companyId, context.currentApproverPositionId, groupId)
        if (currentPosition?.reportsToPositionId) {
          const effective = await resolveEffectiveAssignment(
            companyId,
            currentPosition.reportsToPositionId,
            groupId
          )
          if (effective?.userId) {
            return {
              userId: effective.userId,
              positionId: currentPosition.reportsToPositionId,
            }
          }
        }
      }
      return null

    case 'department_head':
      // TODO: Implement department head resolution
      return null

    case 'admin':
      // TODO: Return system admin user
      return null

    default:
      return null
  }
}

/**
 * Resolve escalation target based on hierarchy
 */
async function resolveHierarchyTarget(
  companyId: string,
  config: EscalationHierarchyConfig,
  context: EscalationContext,
  groupId?: string
): Promise<{ userId?: string; positionId?: string } | null> {
  if (!context.currentApproverPositionId) {
    return null
  }

  let currentPosition = await getPosition(companyId, context.currentApproverPositionId, groupId)
  let levelsTraversed = 0

  while (currentPosition && levelsTraversed < config.maxLevels) {
    if (!currentPosition.reportsToPositionId) {
      break // Top of hierarchy
    }

    const managerPosition = await getPosition(companyId, currentPosition.reportsToPositionId, groupId)
    if (!managerPosition) {
      break
    }

    // Check if position has required authority
    if (config.requireApprovalAuthority) {
      const hasAuthority = managerPosition.approvalAuthority?.[config.requireApprovalAuthority]
      if (!hasAuthority) {
        currentPosition = managerPosition
        continue // Skip to next level
      }
    }

    // Try to resolve position to user
    const effective = await resolveEffectiveAssignment(companyId, managerPosition.id, groupId)

    if (effective?.userId) {
      return {
        userId: effective.userId,
        positionId: managerPosition.id,
      }
    }

    if (config.skipVacantPositions) {
      currentPosition = managerPosition
      levelsTraversed++
      continue
    }

    break // Vacant and not skipping
  }

  return null
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate an escalation path configuration
 */
export async function validateEscalationPath(
  companyId: string,
  escalationPath: EscalationPath
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Check basic fields
  if (!escalationPath.name?.trim()) {
    errors.push('Name is required')
  }

  if (!escalationPath.rules?.length) {
    errors.push('At least one escalation rule is required')
  }

  // Check hierarchy config if resolution type requires it
  if (
    (escalationPath.resolutionType === 'hierarchy' || escalationPath.resolutionType === 'mixed') &&
    !escalationPath.hierarchyConfig
  ) {
    errors.push('Hierarchy configuration is required for hierarchy-based resolution')
  }

  // Check custom targets if resolution type requires it
  if (
    (escalationPath.resolutionType === 'custom' || escalationPath.resolutionType === 'mixed') &&
    (!escalationPath.customTargets || escalationPath.customTargets.length === 0)
  ) {
    errors.push('Custom targets are required for custom-based resolution')
  }

  // Validate rules
  for (const rule of escalationPath.rules || []) {
    if (rule.triggerType === 'time' && (!rule.triggerAfterHours || rule.triggerAfterHours <= 0)) {
      errors.push(`Rule ${rule.order}: Trigger hours must be greater than 0 for time-based triggers`)
    }

    if (!rule.notificationChannels?.length && rule.action === 'notify') {
      errors.push(`Rule ${rule.order}: At least one notification channel is required for notify action`)
    }
  }

  // Validate settings
  if (escalationPath.settings.maxEscalations < 1) {
    errors.push('Maximum escalations must be at least 1')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// TEMPLATE ESCALATION PATHS
// ============================================================================

/**
 * Get pre-defined escalation path templates
 */
export function getEscalationPathTemplates(): Omit<EscalationPath, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>[] {
  return [
    {
      name: 'Standard Escalation',
      description: 'Standard escalation with reminders and manager escalation',
      category: 'general',
      resolutionType: 'hierarchy',
      hierarchyConfig: {
        escalateToManager: true,
        maxLevels: 3,
        skipVacantPositions: true,
      },
      rules: [
        {
          id: 'rule-1',
          name: 'First Reminder',
          order: 1,
          triggerType: 'time',
          triggerAfterHours: 24,
          action: 'remind',
          notificationChannels: ['in_app', 'email'],
          messageTemplate: 'Reminder: Approval pending for {{resourceTitle}}',
          includeApprovalHistory: false,
          repeatIfNotActioned: false,
        },
        {
          id: 'rule-2',
          name: 'Second Reminder',
          order: 2,
          triggerType: 'time',
          triggerAfterHours: 48,
          action: 'remind',
          notificationChannels: ['in_app', 'email', 'push'],
          messageTemplate: 'Urgent: Approval still pending for {{resourceTitle}}',
          includeApprovalHistory: true,
          repeatIfNotActioned: false,
        },
        {
          id: 'rule-3',
          name: 'Escalate to Manager',
          order: 3,
          triggerType: 'time',
          triggerAfterHours: 72,
          action: 'escalate',
          targetLevel: 1,
          notificationChannels: ['in_app', 'email'],
          messageTemplate: 'Escalation: Approval for {{resourceTitle}} has been escalated to you',
          includeApprovalHistory: true,
          repeatIfNotActioned: false,
        },
      ],
      settings: {
        maxEscalations: 3,
        finalAction: 'notify_admin',
        notifyOriginalApprover: true,
        notifyRequester: true,
        trackEscalationHistory: true,
        notifyOnFinalAction: true,
      },
      status: 'active',
      version: 1,
    },
    {
      name: 'Urgent Escalation',
      description: 'Fast escalation for time-sensitive approvals',
      category: 'urgent',
      resolutionType: 'hierarchy',
      hierarchyConfig: {
        escalateToManager: true,
        maxLevels: 2,
        skipVacantPositions: true,
      },
      rules: [
        {
          id: 'rule-1',
          name: 'Immediate Reminder',
          order: 1,
          triggerType: 'time',
          triggerAfterHours: 4,
          action: 'remind',
          notificationChannels: ['in_app', 'email', 'push'],
          messageTemplate: 'URGENT: Immediate approval required for {{resourceTitle}}',
          includeApprovalHistory: false,
          repeatIfNotActioned: true,
          repeatIntervalHours: 2,
          maxRepeats: 3,
        },
        {
          id: 'rule-2',
          name: 'Quick Escalation',
          order: 2,
          triggerType: 'time',
          triggerAfterHours: 8,
          action: 'escalate',
          targetLevel: 1,
          notificationChannels: ['in_app', 'email', 'push'],
          messageTemplate: 'URGENT ESCALATION: {{resourceTitle}} requires immediate attention',
          includeApprovalHistory: true,
          repeatIfNotActioned: false,
        },
      ],
      settings: {
        maxEscalations: 2,
        finalAction: 'auto_approve',
        notifyOriginalApprover: true,
        notifyRequester: true,
        trackEscalationHistory: true,
        notifyOnFinalAction: true,
      },
      status: 'active',
      version: 1,
    },
    {
      name: 'Rejection Handler',
      description: 'Handle rejections with re-routing options',
      category: 'rejection',
      resolutionType: 'custom',
      customTargets: [
        {
          id: 'target-1',
          level: 1,
          type: 'hierarchy_next',
          name: 'Skip-level Manager',
          notificationChannels: ['in_app', 'email'],
        },
      ],
      rules: [
        {
          id: 'rule-1',
          name: 'On Rejection',
          order: 1,
          triggerType: 'rejection',
          action: 'escalate',
          targetLevel: 1,
          notificationChannels: ['in_app', 'email'],
          messageTemplate: 'Approval for {{resourceTitle}} was rejected and has been escalated for review',
          includeApprovalHistory: true,
          repeatIfNotActioned: false,
        },
      ],
      settings: {
        maxEscalations: 2,
        finalAction: 'none',
        notifyOriginalApprover: false,
        notifyRequester: true,
        trackEscalationHistory: true,
        notifyOnFinalAction: false,
      },
      status: 'active',
      version: 1,
    },
  ]
}

/**
 * Create an escalation path from a template
 */
export async function createFromTemplate(
  companyId: string,
  templateIndex: number,
  userId: string,
  overrides?: Partial<CreateEscalationPathData>,
  groupId?: string
): Promise<EscalationPath> {
  const templates = getEscalationPathTemplates()

  if (templateIndex < 0 || templateIndex >= templates.length) {
    throw new Error('Invalid template index')
  }

  const template = templates[templateIndex]

  if (!template) {
    throw new Error('Template not found')
  }

  const data: CreateEscalationPathData = {
    name: overrides?.name || template.name,
    description: overrides?.description || template.description,
    category: overrides?.category || template.category,
    resolutionType: overrides?.resolutionType || template.resolutionType,
    hierarchyConfig: overrides?.hierarchyConfig || template.hierarchyConfig,
    customTargets: overrides?.customTargets || template.customTargets,
    rules: (overrides?.rules || template.rules) as Omit<EscalationRule, 'id'>[],
    settings: { ...template.settings, ...overrides?.settings },
  }

  return createEscalationPath(companyId, data, userId, groupId)
}
