/**
 * System Approval Lines - Hardcoded Constants
 *
 * These are SYSTEM DEFAULT approval lines that are automatically
 * available in ALL projects. They are NOT stored in Firebase.
 *
 * Key characteristics:
 * - Hardcoded in code (same for ALL tenants)
 * - Auto-available in all projects
 * - Shows in dropdown with "System" badge
 * - Read-only (cannot be edited/deleted by users)
 * - Zero Firestore reads for template
 */

import type {
  ApprovalLine,
  ApprovalStageDefinition,
  ApprovalLineSettings,
} from '@julley/shared-types'

// ============================================================================
// SYSTEM REPORTER APPROVAL LINE
// ============================================================================

/**
 * Unique identifier for the System Reporter Approval Line
 * Uses double underscore prefix to avoid collision with user-created IDs
 */
export const SYSTEM_REPORTER_APPROVAL_ID = '__SYSTEM_REPORTER_APPROVAL__'

/**
 * System Reporter Approval Line Template
 *
 * When selected from the approval line dropdown:
 * - task.workflowDefinitionId = '__SYSTEM_REPORTER_APPROVAL__'
 * - task.requiresReporterApproval = true (auto-set)
 * - Status flow: in_progress → approval_required → completed
 */
export const SYSTEM_REPORTER_APPROVAL_LINE: Partial<ApprovalLine> = {
  id: SYSTEM_REPORTER_APPROVAL_ID,
  name: 'Reporter Approval',
  description:
    'Task reporter reviews and approves completion before task is closed. The person who created/reported the task will approve it.',

  // System flags
  isSystemLine: true,
  systemType: 'reporter_approval',

  // Always active
  status: 'active',
  version: 1,

  // Resolution type
  resolutionType: 'custom',

  // Single stage: Reporter Review
  stages: [
    {
      id: 'reporter-review-stage',
      name: 'Reporter Review',
      description: 'Task reporter reviews the completed work',
      order: 1,
      type: 'sequential',
      approverSource: 'reporter', // Special source - resolves to task.reporter
      requiredApprovals: 1,
      allowPartialCompletion: false,
      timeoutHours: 72, // 3 days default
      onApprove: 'complete',
      onReject: 'reject_all',
      onTimeout: 'conditional', // Handle timeout via escalation rules
    },
  ] as ApprovalStageDefinition[],

  // Settings
  settings: {
    allowDelegation: false, // Reporter must approve personally
    skipIfSameUser: false, // Even if reporter = assignee, still require approval
    requireComments: false, // Comments optional on approve
    allowPartialApproval: false,
    notifyOnAssignment: true, // Notify reporter when task submitted for approval
    notifyOnCompletion: true, // Notify assignee when approved/rejected
    defaultTimeoutHours: 72,
    sendReminders: true,
    reminderIntervalHours: 24,
  } as ApprovalLineSettings,

  // Metadata
  createdBy: 'system',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an approval line ID is the system reporter approval
 * @param approvalLineId - The approval line ID to check
 * @returns true if this is the system reporter approval line
 */
export function isSystemReporterApprovalLine(
  approvalLineId: string | undefined | null
): boolean {
  return approvalLineId === SYSTEM_REPORTER_APPROVAL_ID
}

/**
 * Check if an approval instance is a system reporter approval
 * @param instance - The approval instance to check
 * @returns true if this is a system reporter approval instance
 */
export function isReporterApprovalInstance(instance: {
  isSystemApproval?: boolean
  systemApprovalType?: string
}): boolean {
  return (
    instance.isSystemApproval === true &&
    instance.systemApprovalType === 'reporter_approval'
  )
}

/**
 * Check if any approval line is a system line
 * @param approvalLine - The approval line to check
 * @returns true if this is a system approval line
 */
export function isSystemApprovalLine(
  approvalLine: Partial<ApprovalLine> | undefined | null
): boolean {
  return approvalLine?.isSystemLine === true
}

/**
 * Get all system approval lines
 * Returns array so more system lines can be added in future
 * @returns Array of system approval line templates
 */
export function getSystemApprovalLines(): Partial<ApprovalLine>[] {
  return [SYSTEM_REPORTER_APPROVAL_LINE]
}

/**
 * Get a system approval line by ID
 * @param id - The system approval line ID
 * @returns The system approval line or undefined
 */
export function getSystemApprovalLineById(
  id: string
): Partial<ApprovalLine> | undefined {
  if (id === SYSTEM_REPORTER_APPROVAL_ID) {
    return SYSTEM_REPORTER_APPROVAL_LINE
  }
  return undefined
}
