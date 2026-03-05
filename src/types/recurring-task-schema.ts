/**
 * Recurring Task Schema - Master Plan v6.2
 * Database schema for workspace-centric recurring task automation
 * 
 * GOLDEN RULES:
 * 1. Zero Disruption: Extends existing schemas without breaking changes
 * 2. Strict Isolation: Workspace-specific access control
 * 3. Absolute Idempotency: No duplicate task generation
 */

// ============================================
// RECURRING TASK CONFIGURATION
// ============================================

export interface RecurrenceSchedule {
    // Base frequency
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

    // Interval multiplier (e.g., every 2 weeks)
    interval: number // Default: 1

    // Custom: specific unit
    customUnit?: 'days' | 'weeks' | 'months' | 'years'

    // Weekly: Specific days (0=Sunday, 6=Saturday)
    weekDays?: number[] // e.g., [1, 3, 5] for Mon/Wed/Fri

    // Monthly options
    monthDay?: number // 1-31 (clamped to last day if month has fewer days)
    isLastDayOfMonth?: boolean // If true, triggers on the actual last day of whatever month (28/29/30/31)

    monthPosition?: {
        week: 'first' | 'second' | 'third' | 'fourth' | 'last'
        weekday: number // 0-6 (0=Sunday)
    }

    // Quarterly options (v6.2)
    quarterMonth?: 1 | 2 | 3 // First/Second/Third month of quarter

    // Yearly options
    yearlyMonth?: number // 0-11 (0=Jan, 11=Dec)

    // Time of day (ISO time string, e.g., "09:00")
    timeOfDay: string

    // Timezone for schedule calculation
    timezone: string // IANA timezone (e.g., "Asia/Kolkata")

    // Start date (ISO date string, e.g., "2024-01-01")
    startDate: string

    // Number of days from trigger date to task due date
    dueDays?: number

    // End condition
    endCondition: {
        type: 'never' | 'on_date' | 'after_count'
        endDate?: string // ISO date string
        occurrenceCount?: number // Number of task instances to generate
    }
}

export interface TaskAssignment {
    // Assignment type (v6.2: only 2 types)
    type: 'specific_user' | 'position'

    // Target value
    value: string // userId or positionId

    // Enhanced for position-based assignment
    positionName?: string // Human-readable position name
    positionId?: string // For audit trail (when type is specific_user from position)

    // Auto-assignment flag
    autoAssigned?: boolean // True if auto-selected from 1-candidate position

    // Selection audit
    selectedFrom?: string[] // List of candidate userIds when multiple existed

    // Rotation state (for future enhancement)
    rotationEnabled?: boolean
    rotationState?: {
        lastAssignedUserId: string
        lastAssignedAt: string
        rotationIndex: number
    }

    // Candidate cache (for UI display)
    candidates?: string[] // Current userIds in position
    candidatesCount?: number
}

export interface TaskDefinition {
    // Basic info
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    estimatedHours?: number

    // Extended fields (v6.2 - Matching "Create New Task" form)

    // Extended fields (v6.2 - Matching "Create New Task" form)

    taskType?: string
    requirementType?: string
    reporter?: string // Optional override for reporter (defaults to creator)
    reporterName?: string // Name/title of the reporter for display
}


// Main recurring task configuration
export interface WorkspaceRecurringConfig {
    id: string

    // Organizational context
    companyId: string
    workspaceId: string
    projectId: string // Target project (can be shifted)

    // Task definition
    taskDefinition: TaskDefinition

    // Schedule
    schedule: RecurrenceSchedule

    // Assignment
    assignment: TaskAssignment

    // Execution tracking
    nextRunAt: string // ISO timestamp (UTC)
    lastRunAt?: string // ISO timestamp (UTC)
    runCount: number // Total tasks generated

    // Status
    status: 'active' | 'paused' | 'archived' | 'ghosted'
    isActive: boolean // Toggle for UI (active/inactive)

    // Ghost task handling
    ghostReason?: 'position_vacant' | 'user_inactive' | 'permission_denied'

    // Versioning
    currentVersion: number

    // Audit
    createdAt: string
    updatedAt: string
    createdBy: string
    lastModifiedBy?: string
}

// ============================================
// VERSION HISTORY (Subcollection)
// ============================================

export interface RecurringConfigVersion {
    id: string
    configId: string
    version: number

    // Full snapshot of config at this version
    snapshot: Partial<WorkspaceRecurringConfig>

    // Change tracking
    changedFields: string[] // e.g., ['assignment.value', 'schedule.weekDays']
    changeReason?: string // Optional admin comment

    // Audit
    createdAt: string
    createdBy: string
}

// ============================================
// EXECUTION LOGS
// ============================================

export interface RecurringTaskExecutionLog {
    id: string

    // Reference
    configId: string
    companyId: string
    workspaceId: string

    // Execution details
    scheduledDate: string // YYYY-MM-DD format (for idempotency)
    executedAt: string // ISO timestamp
    executionTimeMs: number

    // Result
    status: 'success' | 'failed' | 'skipped'
    failureReason?: 'position_vacant' | 'user_inactive' | 'permission_denied' | 'invalid_config' | 'duplicate'

    // Generated task reference
    taskId?: string // ID of the created GeneratedTask

    // Position assignment details (for ghost handling)
    positionAssignment?: {
        positionId: string
        positionName: string
        candidatesCount: number
        assignedUserId?: string
        autoAssigned: boolean
    }

    // Error details
    error?: string

    // Audit
    createdAt: string
}

// ============================================
// ENHANCED EXISTING SCHEMAS
// ============================================

// Extension to existing GeneratedTask schema
export interface RecurringTaskMetadata {
    isRecurring: boolean
    recurringConfigId?: string
    scheduledDate?: string // YYYY-MM-DD
    generatedAt?: string // ISO timestamp
    generationSource?: 'scheduler' | 'manual_run'
}

// Extension to Workspace schema (v6.2 - Admin Promotion)
// Note: ownerId is now part of the base Workspace schema
export interface WorkspaceEnhanced {
    // Existing workspace fields...
    // ownerId is now in the base Workspace interface
}

// Extension to Project schema (v6.2 - Admin Promotion)
export interface ProjectEnhanced {
    // Existing project fields...

    // NEW: Admin promotion (v6.2)
    adminIds?: string[] // Promoted project admins
}

// ============================================
// COLLECTION PATHS (Firestore)
// ============================================

export const COLLECTION_PATHS = {
    // Main collections
    WORKSPACE_RECURRING_CONFIGS: 'companies/{companyId}/workspaceRecurringConfigs',
    RECURRING_EXECUTION_LOGS: 'companies/{companyId}/recurringTaskExecutionLogs',

    // Subcollections
    CONFIG_VERSIONS: 'companies/{companyId}/workspaceRecurringConfigs/{configId}/versions',

    // Existing (enhanced)
    GENERATED_TASKS: 'companies/{companyId}/tasks',
    WORKSPACES: 'companies/{companyId}/workspaces',
    PROJECTS: 'companies/{companyId}/projects',
} as const

// ============================================
// QUERY FILTERS
// ============================================

export interface RecurringConfigFilters {
    workspaceId?: string
    projectId?: string
    status?: WorkspaceRecurringConfig['status']
    isActive?: boolean
    createdBy?: string
}

// ============================================
// TYPE GUARDS
// ============================================

export function isRecurringTask(metadata: any): metadata is RecurringTaskMetadata {
    return metadata?.isRecurring === true && !!metadata?.recurringConfigId
}

export function isGhostedConfig(config: WorkspaceRecurringConfig): boolean {
    return config.status === 'ghosted'
}

export function isPausedConfig(config: WorkspaceRecurringConfig): boolean {
    return config.status === 'paused' || !config.isActive
}

// ============================================
// VALIDATION HELPERS
// ============================================

export const SCHEDULE_CONSTRAINTS = {
    MIN_INTERVAL: 1,
    MAX_INTERVAL: 100,
    MAX_OCCURRENCE_COUNT: 1000,
    MIN_MONTH_DAY: 1,
    MAX_MONTH_DAY: 31,
    VALID_WEEKDAYS: [0, 1, 2, 3, 4, 5, 6],
    VALID_QUARTER_MONTHS: [1, 2, 3],
} as const

export function validateSchedule(schedule: RecurrenceSchedule): string[] {
    const errors: string[] = []

    if (schedule.interval < SCHEDULE_CONSTRAINTS.MIN_INTERVAL) {
        errors.push('Interval must be at least 1')
    }

    if (schedule.interval > SCHEDULE_CONSTRAINTS.MAX_INTERVAL) {
        errors.push(`Interval cannot exceed ${SCHEDULE_CONSTRAINTS.MAX_INTERVAL}`)
    }

    if (schedule.frequency === 'weekly' && (!schedule.weekDays || schedule.weekDays.length === 0)) {
        errors.push('Weekly frequency requires at least one weekday')
    }

    if (schedule.frequency === 'monthly' && schedule.monthDay) {
        if (schedule.monthDay < SCHEDULE_CONSTRAINTS.MIN_MONTH_DAY || schedule.monthDay > SCHEDULE_CONSTRAINTS.MAX_MONTH_DAY) {
            errors.push('Month day must be between 1 and 31')
        }
    }

    if (schedule.dueDays !== undefined && (schedule.dueDays < 0 || schedule.dueDays > 365)) {
        errors.push('Due days must be between 0 and 365')
    }

    if (schedule.frequency === 'quarterly' && schedule.quarterMonth) {
        if (!SCHEDULE_CONSTRAINTS.VALID_QUARTER_MONTHS.includes(schedule.quarterMonth)) {
            errors.push('Quarter month must be 1, 2, or 3')
        }
    }

    if (schedule.endCondition.type === 'after_count' && schedule.endCondition.occurrenceCount) {
        if (schedule.endCondition.occurrenceCount > SCHEDULE_CONSTRAINTS.MAX_OCCURRENCE_COUNT) {
            errors.push(`Occurrence count cannot exceed ${SCHEDULE_CONSTRAINTS.MAX_OCCURRENCE_COUNT}`)
        }
    }

    return errors
}
