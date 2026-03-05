/**
 * Recurring Task Service - Master Plan v6.2 - Stage 3
 * 
 * Central service for all recurring task operations
 * Enforces permissions, versioning, and ghost detection
 */

import { db } from '../../firebase'
import { TaskNotificationService } from '../tasks/task-notification-service'
import { WorkspaceService } from '../workspaces/workspace-service'
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    onSnapshot,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import {
    WorkspaceRecurringConfig,
    RecurringConfigVersion,
    RecurringTaskExecutionLog,
    TaskAssignment,
} from '@/types/recurring-task-schema'
import { calculateNextRun, validateSchedule } from '@/lib/utils/recurrence-utils'
import {
    canManageRecurringTasks,
    canViewRecurringTasks,
    getPositionUsers,
    isUserActive,
    isCompanyAdminOrOwner,
} from './permission-checker'

export {
    canManageRecurringTasks,
    canViewRecurringTasks,
    getPositionUsers,
    isUserActive,
    isCompanyAdminOrOwner,
}

// ============================================
// TYPES
// ============================================

export interface CreateConfigInput {
    companyId: string
    workspaceId: string
    projectId: string
    taskDefinition: WorkspaceRecurringConfig['taskDefinition']
    schedule: WorkspaceRecurringConfig['schedule']
    assignment: TaskAssignment
    userId: string // Creator
    groupId?: string
}

export interface UpdateConfigInput {
    configId: string
    companyId: string
    updates: Partial<WorkspaceRecurringConfig>
    userId: string // Editor
    changeReason?: string
    skipNotification?: boolean
    groupId?: string
}

export interface ConfigFilters {
    workspaceId?: string
    projectId?: string
    status?: WorkspaceRecurringConfig['status']
    isActive?: boolean
}

// ============================================
// HELPERS
// ============================================

/**
 * Recursively removes undefined values from an object or array.
 * Firestore does not support undefined values.
 */
function sanitizeData<T>(data: T): T {
    if (data === undefined) return null as any
    if (data === null || typeof data !== 'object') return data

    if (Array.isArray(data)) {
        return data.map(sanitizeData) as any
    }

    const sanitized: any = {}
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = (data as any)[key]
            if (value !== undefined) {
                sanitized[key] = sanitizeData(value)
            }
        }
    }
    return sanitized
}

/**
 * Normalize value for comparison
 */
function normalizeVal(val: any): any {
    if (val === undefined || val === null || val === '') return null
    if (typeof val === 'object' && !Array.isArray(val)) return JSON.stringify(val)
    return val
}

/**
 * Detect exact fields that changed, including nested properties
 */
function getChangedFields(updates: any, current: any, prefix = ''): string[] {
    const changes: string[] = []

    for (const key of Object.keys(updates)) {
        if (['updatedAt', 'lastModifiedBy', 'currentVersion', 'id', 'companyId', 'projectId', 'workspaceId'].includes(key)) {
            // Only add projectId/workspaceId if explicitly changed (top level)
            if (prefix === '' && updates[key] !== current[key]) {
                changes.push(key)
            }
            continue
        }

        const val = updates[key]
        const currVal = current[key]
        const path = prefix ? `${prefix}.${key}` : key

        // Handle nested objects
        if (val && typeof val === 'object' && !Array.isArray(val) && currVal && typeof currVal === 'object') {
            changes.push(...getChangedFields(val, currVal, path))
        } else {
            // Basic value comparison with normalization
            if (normalizeVal(val) !== normalizeVal(currVal)) {
                changes.push(path)
            }
        }
    }

    return Array.from(new Set(changes))
}

// ============================================
// CREATE
// ============================================

/**
 * Create a new recurring task configuration
 */
export async function createRecurringConfig(
    input: CreateConfigInput
): Promise<string> {
    const { companyId, workspaceId, projectId, taskDefinition, schedule, assignment, userId } = input

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, workspaceId, input.groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot create recurring tasks in this workspace')
    }

    // Validate schedule
    const scheduleErrors = validateSchedule(schedule)
    if (scheduleErrors.length > 0) {
        throw new Error(`Invalid schedule: ${scheduleErrors.join(', ')}`)
    }

    // Check assignment and detect ghost status
    const { isGhosted, ghostReason } = await checkAssignmentStatus(assignment, companyId, input.groupId)

    // Calculate first run
    const nextRunAt = calculateNextRun(schedule)
    const isExpired = !nextRunAt

    // Create config
    const configData: any = {
        companyId,
        workspaceId,
        projectId,
        taskDefinition,
        schedule,
        assignment,
        nextRunAt: nextRunAt || new Date().toISOString(), // Use now as fallback if expired
        runCount: 0,
        status: isExpired ? 'archived' : (isGhosted ? 'ghosted' : 'active'),
        isActive: !isExpired,
        currentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
    }

    // Only add ghostReason if it exists to avoid Firebase undefined error
    if (isGhosted && ghostReason && !isExpired) {
        configData.ghostReason = ghostReason
    }

    const segments = companySubcollectionPathSegments(input.groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))
    const sanitizedData = sanitizeData({
        ...configData,
        ghostReason: (isGhosted && ghostReason && !isExpired) ? ghostReason : null
    })
    const docRef = await addDoc(configsRef, sanitizedData)
    const configId = docRef.id

    console.log(`Created recurring config: ${docRef.id}, status: ${configData.status}`)

    // Handle initial notifications
    try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')

        if (isExpired) {
            // Case: User created a task that is already ended
            // We notify them that the schedule has ended immediately
            const endType = schedule.endCondition.type === 'on_date' ? 'date_reached' : 'occurrence_count_reached'
            const detail = schedule.endCondition.type === 'on_date'
                ? `End date (${schedule.endCondition.endDate}) was in the past.`
                : 'Occurrence count limit reached.'

            const adminIds = await WorkspaceService.resolveWorkspaceStakeholders(input.groupId || companyId, companyId, workspaceId)
            await ExternalNotificationService.notifyRecurringScheduleEnded(
                companyId,
                adminIds as string[],
                taskDefinition.title,
                endType,
                0, // totalTasksGenerated
                configId,
                input.groupId
            );
        } else if (isGhosted) {
            // Notify if ghosted
            if (typeof TaskNotificationService.notifyGhostTask === 'function') {
                await TaskNotificationService.notifyGhostTask(companyId, workspaceId, {
                    id: configId,
                    title: taskDefinition.title,
                    reason: ghostReason
                }, input.groupId)
            }
        }
    } catch (notifyErr) {
        console.error('Failed to send initial notifications:', notifyErr)
    }

    return configId
}

// ============================================
// READ
// ============================================

/**
 * Get a recurring config by ID
 */
export async function getRecurringConfig(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<WorkspaceRecurringConfig | null> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        return null
    }

    const config = { id: configSnap.id, ...configSnap.data() } as WorkspaceRecurringConfig

    // Permission check
    const canView = await canViewRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canView) {
        throw new Error('Permission denied: Cannot view this recurring task')
    }

    return config
}

/**
 * Get all configs for a workspace
 */
export async function getWorkspaceConfigs(
    companyId: string,
    workspaceId: string,
    userId: string,
    groupId?: string,
    filters?: ConfigFilters
): Promise<WorkspaceRecurringConfig[]> {
    // Permission check
    const canView = await canViewRecurringTasks(userId, companyId, workspaceId, groupId)
    if (!canView) {
        throw new Error('Permission denied: Cannot view recurring tasks in this workspace')
    }

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))
    let q = query(configsRef, where('workspaceId', '==', workspaceId))

    // Apply filters
    if (filters?.status) {
        q = query(q, where('status', '==', filters.status))
    }

    if (filters?.isActive !== undefined) {
        q = query(q, where('isActive', '==', filters.isActive))
    }

    if (filters?.projectId) {
        q = query(q, where('projectId', '==', filters.projectId))
    }

    const snapshot = await getDocs(q)
    const configs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as WorkspaceRecurringConfig[]

    return configs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Subscribe to configs for a workspace (Real-time)
 * @param userId - Optional user ID for better error handling
 */
export function subscribeWorkspaceConfigs(
    companyId: string,
    workspaceId: string,
    onUpdate: (configs: WorkspaceRecurringConfig[]) => void,
    onError?: (error: Error) => void,
    userId?: string,
    groupId?: string
) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))
    const q = query(configsRef, where('workspaceId', '==', workspaceId))

    return onSnapshot(q, (snapshot) => {
        const configs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as WorkspaceRecurringConfig[]
        onUpdate(configs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }, (error: any) => {
        // Handle permission errors gracefully - don't log as error
        if (error?.code === 'permission-denied' || error?.code === 'permissions-error') {
            // Permission denied is expected for users without access
            // Return empty array silently
            onUpdate([])
            if (onError) {
                onError(new Error('Permission denied: Cannot view recurring tasks in this workspace'))
            }
            return
        }
        // Only log non-permission errors
        console.error('Error subscribing to workspace configs:', error)
        onError?.(error)
    })
}

/**
 * Get all configs for a company (Admin view)
 */
export async function getCompanyConfigs(
    companyId: string,
    userId: string,
    groupId?: string
): Promise<WorkspaceRecurringConfig[]> {
    // Permission check: Only company owners/admins can view all across company
    const isAdmin = await isCompanyAdminOrOwner(userId, companyId, groupId)
    if (!isAdmin) {
        throw new Error('Permission denied: Only company admins can view global recurring tasks')
    }

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))
    const snapshot = await getDocs(configsRef)

    const configs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as WorkspaceRecurringConfig[]

    return configs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Subscribe to configs for a company (Real-time, Admin view)
 */
export function subscribeCompanyConfigs(
    companyId: string,
    onUpdate: (configs: WorkspaceRecurringConfig[]) => void,
    onError?: (error: Error) => void,
    groupId?: string
) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))

    return onSnapshot(configsRef, (snapshot) => {
        const configs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as WorkspaceRecurringConfig[]
        onUpdate(configs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }, (error) => {
        console.error('Error subscribing to company configs:', error)
        onError?.(error)
    })
}

/**
 * Get configs due for execution
 */
export async function getDueConfigs(
    companyId: string,
    beforeTimestamp?: string,
    groupId?: string
): Promise<WorkspaceRecurringConfig[]> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configsRef = collection(db, segments[0], ...segments.slice(1))

    const cutoffTime = beforeTimestamp || new Date().toISOString()

    const q = query(
        configsRef,
        where('isActive', '==', true),
        where('status', '==', 'active'),
        where('nextRunAt', '<=', cutoffTime),
        orderBy('nextRunAt', 'asc'),
        limit(100) // Process in batches
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as WorkspaceRecurringConfig[]
}

// ============================================
// UPDATE
// ============================================

/**
 * Update a recurring config with versioning
 */
export async function updateRecurringConfig(
    input: UpdateConfigInput
): Promise<void> {
    const { configId, companyId, updates, userId, changeReason } = input

    // Get current config
    const segments = companySubcollectionPathSegments(input.groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Recurring config not found')
    }

    const currentConfig = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, currentConfig.workspaceId, input.groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot update this recurring task')
    }

    // Track changed fields with deep detection
    const changedFields = getChangedFields(updates, currentConfig)

    if (changedFields.length === 0) {
        console.log('No changes detected, skipping update')
        return
    }

    // Validate schedule if changed
    if (updates.schedule) {
        const scheduleErrors = validateSchedule(updates.schedule)
        if (scheduleErrors.length > 0) {
            throw new Error(`Invalid schedule: ${scheduleErrors.join(', ')}`)
        }
    }

    // Handle ghost status if assignment changed
    if (updates.assignment) {
        const { isGhosted, ghostReason } = await checkAssignmentStatus(updates.assignment, companyId, input.groupId)
        updates.status = isGhosted ? 'ghosted' : (currentConfig.status === 'ghosted' ? 'active' : currentConfig.status)
        // If it was not ghosted but now is, notify
        if (isGhosted && currentConfig.status !== 'ghosted') {
            try {
                if (typeof TaskNotificationService.notifyGhostTask === 'function') {
                    await TaskNotificationService.notifyGhostTask(companyId, currentConfig.workspaceId, {
                        id: configId,
                        title: currentConfig.taskDefinition.title,
                        reason: ghostReason
                    }, input.groupId)
                }
            } catch (notifyErr) {
                console.error('Failed to send ghost task notification update:', notifyErr)
            }
        }
        // Use null to clear the field in Firestore instead of undefined
        updates.ghostReason = (isGhosted && ghostReason) ? ghostReason : null as any
    }

    // Recalculate nextRunAt if schedule changed
    let nextRunUpdate: Partial<WorkspaceRecurringConfig> = {}
    if (updates.schedule) {
        const nextRun = calculateNextRun(updates.schedule)
        if (nextRun) {
            nextRunUpdate = { nextRunAt: nextRun }
        }
    }

    // Create version snapshot
    const versionData: Omit<RecurringConfigVersion, 'id'> = {
        configId,
        version: currentConfig.currentVersion,
        snapshot: currentConfig,
        changedFields,
        changeReason: changeReason || '',
        createdAt: new Date().toISOString(),
        createdBy: userId,
    }

    const segmentsV = companySubcollectionPathSegments(input.groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const versionsRef = collection(db, segmentsV[0], ...segmentsV.slice(1), configId, 'versions')
    await addDoc(versionsRef, versionData)

    // Update config
    const updateData = {
        ...updates,
        ...nextRunUpdate,
        currentVersion: currentConfig.currentVersion + 1,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: userId,
    }

    await updateDoc(configRef, sanitizeData(updateData))

    console.log(`Updated config ${configId}, changed fields: ${changedFields.join(', ')}`)

    // ------------------------------------------------------------------------
    // External Notifications (Email/WhatsApp) - Non-Blocking
    // ------------------------------------------------------------------------
    if (input.skipNotification) {
        return
    }

    try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')

        // 1. Resolve affected users (Assignees)
        const effectiveAssignment = updates.assignment || currentConfig.assignment
        let assigneeUserIds: string[] = []
        if (effectiveAssignment.type === 'specific_user') {
            assigneeUserIds = [effectiveAssignment.value]
        } else if (effectiveAssignment.type === 'position') {
            const userIds = await getPositionUsers(companyId, effectiveAssignment.value, effectiveAssignment.positionName, input.groupId)
            assigneeUserIds = userIds
        }

        // 2. Ghost Resolution Notification (For Admins)
        const wasGhosted = currentConfig.status === 'ghosted'
        const isResolved = wasGhosted && updates.status === 'active'

        if (isResolved) {
            const adminRecipients = await WorkspaceService.resolveWorkspaceStakeholders(input.groupId || companyId, companyId, currentConfig.workspaceId)

            const assignmentText = effectiveAssignment.type === 'specific_user'
                ? `User: ${effectiveAssignment.value}`
                : `Position: ${effectiveAssignment.value}`

            adminRecipients.forEach(adminId => {
                ExternalNotificationService.notifyGhostTaskResolved(
                    companyId,
                    adminId,
                    currentConfig.taskDefinition.title,
                    userId, // Resolved By
                    assignmentText,
                    configId,
                    input.groupId
                ).catch(e => console.error(`Failed to notify ${adminId} of ghost resolution`, e))
            })

            console.log(`Ghost resolution notification sent to ${adminRecipients.length} admins`)

            // 3. Generic Update Notification (For Assignees)
            // Skip users who already received the 'Resolved' notification
            const filteredAssignees = assigneeUserIds.filter(id => !adminRecipients.includes(id))

            if (filteredAssignees.length > 0) {
                ExternalNotificationService.notifyRecurringConfigUpdated(
                    companyId,
                    filteredAssignees,
                    currentConfig.taskDefinition.title,
                    changedFields,
                    userId, // Updated by
                    configId,
                    input.groupId
                ).catch(e => console.error('⚠️ External config update notification failed:', e))
            }
        } else {
            // Standard update - just notify assignees
            if (assigneeUserIds.length > 0) {
                ExternalNotificationService.notifyRecurringConfigUpdated(
                    companyId,
                    assigneeUserIds,
                    currentConfig.taskDefinition.title,
                    changedFields,
                    userId, // Updated by
                    configId,
                    input.groupId
                ).catch(e => console.error('⚠️ External config update notification failed:', e))
            }
        }

    } catch (externalError) {
        console.error('⚠️ Failed to trigger external configuration notifications:', externalError)
    }
}

// ============================================
// DELETE / DEACTIVATE
// ============================================

/**
 * Soft delete (archive) a recurring config
 */
export async function archiveRecurringConfig(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Recurring config not found')
    }

    const config = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot archive this recurring task')
    }

    await updateDoc(configRef, {
        status: 'archived',
        isActive: false,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: userId,
    })

    console.log(`Archived config ${configId}`)
}

/**
 * Hard delete a recurring config
 */
export async function deleteRecurringConfig(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Recurring config not found')
    }

    const config = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot delete this recurring task')
    }

    // Use a batch to delete the config and its versions
    const batch = writeBatch(db)

    // 1. Delete versions
    const segmentsV = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const versionsRef = collection(db, segmentsV[0], ...segmentsV.slice(1), configId, 'versions')
    const versionsSnap = await getDocs(versionsRef)
    versionsSnap.docs.forEach((vDoc) => {
        batch.delete(vDoc.ref)
    })

    // 2. Delete execution logs
    const segmentsL = companySubcollectionPathSegments(groupId || companyId, companyId, 'recurringTaskExecutionLogs')
    const logsRef = collection(db, segmentsL[0], ...segmentsL.slice(1))
    const qLogs = query(logsRef, where('configId', '==', configId))
    const logsSnap = await getDocs(qLogs)
    logsSnap.docs.forEach((lDoc) => {
        batch.delete(lDoc.ref)
    })

    // 3. Delete the config itself
    batch.delete(configRef)

    await batch.commit()

    console.log(`Hard deleted config ${configId} and its associated metadata`)
}

/**
 * Restore an archived recurring config
 */
export async function unarchiveRecurringConfig(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Recurring config not found')
    }

    const config = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot unarchive this recurring task')
    }

    // Determine status (check if assignment is still valid)
    const { isGhosted, ghostReason } = await checkAssignmentStatus(config.assignment, companyId, groupId)

    await updateDoc(configRef, {
        status: isGhosted ? 'ghosted' : 'active',
        ghostReason: isGhosted ? (ghostReason || 'assignment_mismatch') : null,
        isActive: true, // Reactivate upon unarchive
        updatedAt: new Date().toISOString(),
        lastModifiedBy: userId,
    })

    console.log(`Unarchived config ${configId}`)
}

/**
 * Toggle active/inactive status
 */
export async function toggleConfigActive(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<boolean> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Recurring config not found')
    }

    const config = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canManage) {
        throw new Error('Permission denied: Cannot toggle this recurring task')
    }

    const newStatus = !config.isActive

    await updateDoc(configRef, {
        isActive: newStatus,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: userId,
    })

    console.log(`Toggled config ${configId} active status: ${newStatus}`)

    // ------------------------------------------------------------------------
    // External Notifications (Email/WhatsApp) - Non-Blocking
    // ------------------------------------------------------------------------
    try {
        const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service')

        // Resolve affected users
        let affectedUserIds: string[] = []
        if (config.assignment.type === 'specific_user') {
            affectedUserIds = [config.assignment.value]
        } else if (config.assignment.type === 'position') {
            const userIds = await getPositionUsers(companyId, config.assignment.value, config.assignment.positionName, groupId)
            affectedUserIds = userIds
        }

        if (affectedUserIds.length > 0) {
            if (newStatus) {
                // Reactivated
                ExternalNotificationService.notifyRecurringTaskReactivated(
                    companyId,
                    affectedUserIds,
                    config.taskDefinition.title,
                    userId, // Reactivated by (ID for now)
                    config.nextRunAt,
                    configId,
                    groupId
                ).catch(e => console.error('⚠️ External reactivate notification failed:', e))
            } else {
                // Paused
                ExternalNotificationService.notifyRecurringTaskPaused(
                    companyId,
                    affectedUserIds,
                    config.taskDefinition.title,
                    userId, // Paused by (ID for now)
                    configId,
                    undefined,
                    groupId
                ).catch(e => console.error('⚠️ External pause notification failed:', e))
            }
        }
    } catch (externalError) {
        console.error('⚠️ Failed to trigger external toggle notification:', externalError)
    }

    return newStatus
}

// ============================================
// GHOST TASK HANDLING
// ============================================

/**
 * Check if assignment will result in ghost task
 */
async function checkAssignmentStatus(
    assignment: TaskAssignment,
    companyId: string,
    groupId?: string
): Promise<{ isGhosted: boolean; ghostReason?: WorkspaceRecurringConfig['ghostReason'] }> {
    if (assignment.type === 'specific_user') {
        // Check if user is active
        const userActive = await isUserActive(assignment.value, companyId, groupId)
        if (!userActive) {
            return {
                isGhosted: true,
                ghostReason: 'user_inactive',
            }
        }
    }

    if (assignment.type === 'position') {
        // Check if position has active users
        const users = await getPositionUsers(companyId, assignment.value, assignment.positionName, groupId)
        if (users.length === 0) {
            return {
                isGhosted: true,
                ghostReason: 'position_vacant',
            }
        }
    }

    return { isGhosted: false }
}

/**
 * Resolve a ghost task by assigning a new user
 */
export async function resolveGhostTask(
    configId: string,
    companyId: string,
    newAssignment: TaskAssignment,
    userId: string,
    groupId?: string
): Promise<void> {
    await updateRecurringConfig({
        configId,
        companyId,
        updates: {
            assignment: newAssignment,
            status: 'active',
            ghostReason: undefined,
        },
        userId,
        changeReason: 'Resolved ghost task',
        groupId
    })

    console.log(`Resolved ghost task ${configId} via centralized logic`)


}

// ============================================
// VERSION HISTORY
// ============================================

/**
 * Get version history for a config
 */
export async function getConfigVersions(
    configId: string,
    companyId: string,
    userId: string,
    groupId?: string
): Promise<RecurringConfigVersion[]> {
    // Get config to check permissions
    const config = await getRecurringConfig(configId, companyId, userId, groupId)
    if (!config) {
        throw new Error('Config not found')
    }

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const versionsRef = collection(db, segments[0], ...segments.slice(1), configId, 'versions')
    const q = query(versionsRef, orderBy('createdAt', 'desc'))

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as RecurringConfigVersion[]
}

/**
 * Subscribe to version history for a config (Real-time)
 */
export function subscribeConfigVersions(
    configId: string,
    companyId: string,
    onUpdate: (versions: RecurringConfigVersion[]) => void,
    onError?: (error: Error) => void,
    groupId?: string
) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const versionsRef = collection(db, segments[0], ...segments.slice(1), configId, 'versions')
    const q = query(versionsRef, orderBy('createdAt', 'desc'))

    return onSnapshot(q, (snapshot) => {
        const versions = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as RecurringConfigVersion[]
        onUpdate(versions)
    }, (error) => {
        console.error('Error subscribing to config versions:', error)
        onError?.(error)
    })
}

// ============================================
// PROJECT SHIFTING
// ============================================

/**
 * Shift recurring task to different project (within same workspace)
 */
export async function shiftConfigProject(
    configId: string,
    companyId: string,
    newProjectId: string,
    userId: string,
    groupId?: string
): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'workspaceRecurringConfigs')
    const configRef = doc(db, segments[0], ...segments.slice(1), configId)
    const configSnap = await getDoc(configRef)

    if (!configSnap.exists()) {
        throw new Error('Config not found')
    }

    const config = configSnap.data() as WorkspaceRecurringConfig

    // Permission check
    const canManage = await canManageRecurringTasks(userId, companyId, config.workspaceId, groupId)
    if (!canManage) {
        throw new Error('Permission denied')
    }

    // Verify new project is in same workspace
    const { companyCollectionPathSegments } = await import('@/lib/firestore-paths')
    const projectPath = groupId
        ? companyCollectionPathSegments(groupId, companyId, 'projects')
        : ['companies', companyId, 'projects']
    const projectRef = doc(db, ...projectPath as [string, string, string, string, string], newProjectId)
    const projectSnap = await getDoc(projectRef)

    if (!projectSnap.exists()) {
        throw new Error('Target project not found')
    }

    const project = projectSnap.data()
    if (project.workspaceId !== config.workspaceId) {
        throw new Error('Cannot shift to project in different workspace')
    }

    await updateRecurringConfig({
        configId,
        companyId,
        updates: { projectId: newProjectId },
        userId,
        changeReason: `Shifted to project ${newProjectId}`,
        groupId
    })

    console.log(`Shifted config ${configId} to project ${newProjectId}`)
}
