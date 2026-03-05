import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    runTransaction
} from 'firebase/firestore'
import { db } from '../../firebase'
import type {
    ApprovalInstance,
    StageApproverInstance,
    ApprovalInstanceStatus,
    ApprovalStageInstance,
    ApprovalContext
} from '@/types/approval-line-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import { resolveApprovalLine, getApprovalLine } from '../approval-line-service'
import {
    SYSTEM_REPORTER_APPROVAL_ID,
    SYSTEM_REPORTER_APPROVAL_LINE,
    isSystemReporterApprovalLine,
    isReporterApprovalInstance
} from '@/lib/constants/system-approval-lines'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import { TaskNotificationService } from './task-notification-service'
// Activity logging for approval workflow tracking
import {
    logApprovalWorkflowStarted,
    logApprovalStageEntered,
    logApprovalDecision,
    logApprovalWorkflowCompleted,
    logApprovalWorkflowRejected,
    logReporterApprovalDecision
} from '../task-activity-service'

// Type for activity log info captured during approval decision
interface ApprovalActivityLogInfo {
    taskId: string
    projectId: string
    workflowId: string
    workflowName: string
    totalStages: number
    currentStageNumber: number
    stageId: string
    stageName: string
    userName: string
    userPosition?: string
    requesterId?: string
    resourceTitle?: string
    stageEnteredAt?: string
    workflowCompleted: boolean
    workflowRejected: boolean
    isSystemApproval?: boolean
    nextStage?: {
        stageId: string
        stageName: string
        stageOrder: number
        pendingApproverId: string
        pendingApproverName: string
        pendingApproverPosition?: string
    }
}

/**
 * TaskApprovalService
 * 
 * Handles the direct execution of task-level approval lines.
 * This service is entirely independent of the BPMN/Flowable engine.
 */
export class TaskApprovalService {
    private static getCollection(companyId: string, groupId?: string) {
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'approvalInstances')
        return collection(db, segments[0], ...segments.slice(1))
    }

    private static getTaskDoc(companyId: string, taskId: string, groupId?: string) {
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        const fullPath = [...segments, taskId]
        return doc(db, fullPath[0], ...fullPath.slice(1))
    }

    /**
     * Trigger a direct approval process for a completed task
     */
    static async triggerDirectApproval(
        companyId: string,
        taskId: string,
        actorId: string,
        groupId?: string
    ): Promise<string | null> {
        try {
            // 1. Get task details
            const taskRef = this.getTaskDoc(companyId, taskId, groupId)
            const taskSnap = await getDoc(taskRef)

            if (!taskSnap.exists()) {
                throw new Error(`Task not found: ${taskId}`)
            }

            const task = taskSnap.data() as GeneratedTask

            // IDEMPOTENCY & RETRY CHECK: 
            // If an approval process is already active, don't start a new one.
            // If the previous one was REJECTED or CANCELLED, allow a new one for resubmission.
            if (task.approvalInstanceId) {
                const approvalRef = doc(this.getCollection(companyId, groupId), task.approvalInstanceId)
                const existingSnap = await getDoc(approvalRef)
                if (existingSnap.exists()) {
                    const existingInstance = existingSnap.data() as ApprovalInstance
                    if (existingInstance.status === 'in_progress') {
                        console.log(`Task ${taskId} already has an active approval instance ${task.approvalInstanceId}. Skipping duplicate trigger.`)
                        return task.approvalInstanceId
                    }
                    console.log(`Previous approval for task ${taskId} was ${existingInstance.status}. Starting new process for resubmission.`)
                }
            }

            // 2. Check if task has an approval line
            if (!task.workflowDefinitionId || task.workflowDefinitionId === 'none') {
                console.log(`Task ${taskId} has no approval line assigned. Skipping approval process.`)
                return null
            }

            // 3. Resolve the requester's position - CRITICAL FIX
            // For manually created tasks, positionId may be empty. We MUST resolve it from the user's assignment.
            const requesterId = task.assignedUserId || actorId
            let requesterPositionId = task.positionId

            if (!requesterPositionId) {
                console.log(`[TaskApprovalService] Task ${taskId} has no positionId. Resolving from user assignment for ${requesterId}...`)
                try {
                    const { getCurrentAssignmentForUser } = await import('../org/org-services')
                    const assignment = await getCurrentAssignmentForUser(companyId, requesterId, groupId)
                    if (assignment) {
                        requesterPositionId = assignment.positionId
                        console.log(`[TaskApprovalService] ✓ Resolved positionId ${requesterPositionId} for user ${requesterId}`)
                    } else {
                        console.warn(`[TaskApprovalService] ⚠ No active position assignment found for user ${requesterId}. Hierarchy resolution WILL FAIL.`)
                    }
                } catch (err) {
                    console.error(`[TaskApprovalService] Error resolving position for user ${requesterId}:`, err)
                }
            }

            // 4. Build approval context
            const context: ApprovalContext = {
                requesterId,
                requesterPositionId,
                resourceType: 'task',
                resourceId: taskId,
                resourceTitle: task.title,
                projectId: task.projectId,
                amount: task.estimatedHours
            }

            console.log(`[TaskApprovalService] Context for task ${taskId}:`, JSON.stringify({ requesterId, requesterPositionId, projectId: task.projectId }))
            console.log(`[TaskApprovalService] Resolving approval line ${task.workflowDefinitionId} for task ${taskId}...`)
            const resolution = await resolveApprovalLine(companyId, task.workflowDefinitionId, context, groupId)
            console.log(`[TaskApprovalService] Resolution for task ${taskId}: ${resolution.totalApprovers} approvers found across ${resolution.totalStages} stages.`)

            if (resolution.totalApprovers === 0) {
                console.warn(`[TaskApprovalService] Approval Line ${task.workflowDefinitionId} resolved to 0 approvers for task ${taskId}. Auto-approving.`)
                await updateDoc(taskRef, {
                    approvalStatus: 'approved',
                    approvedAt: new Date().toISOString(),
                    approvalNotes: 'System auto-approved: No approvers found in approval line.',
                    updatedAt: new Date().toISOString()
                })
                return null
            }

            console.log(`[TaskApprovalService] Starting approval process for task ${taskId} with instance ID pending...`)

            // 4. Create ApprovalInstance (aligning with approval-line-schema.ts)
            const now = new Date().toISOString()
            const approvalLine = await getApprovalLine(companyId, task.workflowDefinitionId, groupId)

            if (!approvalLine) throw new Error('Approval Line definition not found')

            // DEBUG: Log resolved approvers
            console.log(`[TaskApprovalService] Creating approval instance with ${resolution.stages.length} stages:`)
            resolution.stages.forEach(stage => {
                console.log(`[TaskApprovalService]   Stage ${stage.stageOrder} "${stage.stageName}":`)
                stage.approvers.forEach(a => {
                    console.log(`[TaskApprovalService]     - Approver userId="${a.userId}", userName="${a.userName}", positionId="${a.positionId}", positionTitle="${a.positionTitle}"`)
                })
            })

            // Helper to convert undefined to null (Firestore doesn't accept undefined)
            const sanitize = <T>(value: T | undefined | null): T | undefined =>
                value === null ? undefined : value

            /**
             * Deep sanitize an object to convert all undefined values to null recursively.
             * Firestore doesn't accept undefined values at any nesting level.
             */
            const deepSanitize = (obj: any): any => {
                if (obj === undefined) return null
                if (obj === null) return null
                if (Array.isArray(obj)) {
                    return obj.map(item => deepSanitize(item))
                }
                if (typeof obj === 'object' && obj !== null) {
                    const result: Record<string, any> = {}
                    for (const [key, value] of Object.entries(obj)) {
                        result[key] = deepSanitize(value)
                    }
                    return result
                }
                return obj
            }

            const stageInstances: ApprovalStageInstance[] = resolution.stages.map(stage => ({
                id: stage.stageId,
                stageDefinitionId: stage.stageId,
                stageName: stage.stageName || 'Approval Stage',
                stageOrder: stage.stageOrder,
                stageType: stage.stageType || 'sequential',
                status: stage.stageOrder === 1 ? 'active' : 'pending',
                requiredApprovals: stage.requiredApprovals || 1,
                currentApprovals: 0,
                currentRejections: 0,
                assignedApprovers: stage.approvers.map(a => ({
                    userId: a.userId,
                    userName: a.userName && a.userName !== 'undefined' ? a.userName : 'Unknown',
                    positionId: sanitize(a.positionId),
                    positionTitle: a.positionTitle || 'Unknown Position',
                    status: 'pending' as const,
                    assignedAt: now,
                    isDelegated: a.isDelegated || false,
                    originalUserId: sanitize(a.delegatedFrom),
                    wasEscalatedTo: false
                })),
                // SLA & Escalation fields - CRITICAL for auto-approve/auto-reject
                timeoutHours: stage.timeoutHours || 24,
                startedAt: stage.stageOrder === 1 ? now : undefined, // Set startedAt for first stage
                escalationPathId: stage.escalationPathId || undefined,
                escalationLevel: 0,
                escalationHistory: []
            }))

            // Sanitize context to remove undefined values
            const sanitizedContext = {
                requesterId: context.requesterId,
                requesterPositionId: sanitize(context.requesterPositionId),
                resourceType: context.resourceType,
                resourceId: context.resourceId,
                resourceTitle: context.resourceTitle || task.title,
                projectId: sanitize(context.projectId),
                amount: sanitize(context.amount)
            }

            // Find an escalation path ID for instance-level fallback (priority order)
            // 1. Stage-level escalation path (from any resolved stage)
            // 2. Approval line level escalation path (workflow default)
            // 3. Task-level escalation policy
            const instanceEscalationPathId = resolution.stages.find(s => s.escalationPathId)?.escalationPathId
                || (approvalLine as any).escalationPathId  // Workflow-level default
                || task.escalationPolicyId  // Task-level escalation policy
                || undefined

            console.log(`[TaskApprovalService] Resolved escalationPathId for instance: ${instanceEscalationPathId || 'NONE'}`)
            console.log(`[TaskApprovalService]   - Stage-level: ${resolution.stages.find(s => s.escalationPathId)?.escalationPathId || 'none'}`)
            console.log(`[TaskApprovalService]   - ApprovalLine-level: ${(approvalLine as any).escalationPathId || 'none'}`)
            console.log(`[TaskApprovalService]   - Task-level: ${task.escalationPolicyId || 'none'}`)

            const instanceData: Omit<ApprovalInstance, 'id'> = {
                companyId,
                approvalLineId: task.workflowDefinitionId,
                approvalLineName: resolution.approvalLineName || 'Approval',
                approvalLineVersion: approvalLine.version || 1,
                resourceType: 'task',
                resourceId: taskId,
                resourceTitle: task.title || 'Task',
                resourceNumber: task.projectCode && task.taskNumber ? `${task.projectCode}-${task.taskNumber}` : (task.taskNumber || undefined),
                projectId: task.projectId,
                context: sanitizedContext as any,
                resolution,
                status: 'in_progress',
                currentStageId: stageInstances[0]?.id || undefined,
                currentStageOrder: 1,
                stageInstances,
                startedAt: now,
                createdAt: now,
                updatedAt: now,
                createdBy: actorId,
                // Add escalation path at instance level for fallback
                escalationPathId: instanceEscalationPathId
            } as any

            // Deep sanitize the entire instanceData to ensure no undefined values exist
            const sanitizedInstanceData = deepSanitize(instanceData)

            // Debug: Log the sanitized data to verify no undefined values
            console.log(`[TaskApprovalService] Creating approval instance (sanitized)...`)

            // Create instance and update task in a single flow
            const instanceRef = await addDoc(this.getCollection(companyId, groupId), sanitizedInstanceData)

            // 5. Update task with instance ID and set status to pending
            const taskRefWithGroupId = this.getTaskDoc(companyId, taskId, groupId)
            await updateDoc(taskRefWithGroupId, {
                approvalInstanceId: instanceRef.id,
                approvalStatus: 'pending',
                updatedAt: now
            })

            // 6. Notify first set of approvers
            await this.notifyApproversForStage(companyId, instanceRef.id, 1, task.title, groupId)

            // 7. Log activity: Approval workflow started
            try {
                await logApprovalWorkflowStarted(companyId, taskId, task.projectId || '', {
                    instanceId: instanceRef.id,
                    workflowId: task.workflowDefinitionId,
                    workflowName: resolution.approvalLineName || 'Approval',
                    totalStages: resolution.totalStages
                }, groupId)

                // Log activity: Entered Stage 1
                const firstStage = stageInstances[0]
                if (firstStage && firstStage.assignedApprovers[0]) {
                    await logApprovalStageEntered(companyId, taskId, task.projectId || '', {
                        instanceId: instanceRef.id,
                        workflowId: task.workflowDefinitionId,
                        workflowName: resolution.approvalLineName || 'Approval',
                        totalStages: resolution.totalStages,
                        currentStageNumber: 1,
                        stageId: firstStage.id,
                        stageName: firstStage.stageName,
                        pendingApproverId: firstStage.assignedApprovers[0].userId,
                        pendingApproverName: firstStage.assignedApprovers[0].userName,
                        // Sanitize undefined to null for Firestore
                        pendingApproverPosition: firstStage.assignedApprovers[0].positionTitle || undefined
                    }, groupId)
                }
            } catch (activityError) {
                console.error('[TaskApprovalService] Error logging approval activities:', activityError)
                // Don't fail the approval process if activity logging fails
            }

            console.log(`Started approval instance ${instanceRef.id} for task ${taskId}`)
            return instanceRef.id
        } catch (error) {
            console.error('Error triggering direct approval:', error)
            throw error
        }
    }

    /**
     * Trigger reporter approval for a task (System Default Approval Line)
     *
     * This is used when a task with Reporter Approval line is submitted for review.
     * Uses the SYSTEM_REPORTER_APPROVAL_LINE constant (hardcoded, NOT from Firestore).
     *
     * @param companyId - Company ID
     * @param taskId - Task ID
     * @param actorId - User submitting for approval (usually the assignee)
     * @param groupId - Enterprise group ID (optional)
     * @returns Approval instance ID
     */
    static async triggerReporterApproval(
        companyId: string,
        taskId: string,
        actorId: string,
        groupId?: string
    ): Promise<string> {
        try {
            // 1. Get task details
            const taskRef = this.getTaskDoc(companyId, taskId, groupId)
            const taskSnap = await getDoc(taskRef)

            if (!taskSnap.exists()) {
                throw new Error(`Task not found: ${taskId}`)
            }

            const task = taskSnap.data() as GeneratedTask

            // 2. Validate task has reporter approval
            if (!isSystemReporterApprovalLine(task.workflowDefinitionId) && !task.requiresReporterApproval) {
                throw new Error('Task does not have Reporter Approval configured')
            }

            // 3. Validate reporter exists
            if (!task.reporter) {
                throw new Error('Task has no reporter assigned. Cannot trigger reporter approval.')
            }

            // 4. Check for existing active approval (idempotency)
            if (task.approvalInstanceId) {
                const existingRef = doc(this.getCollection(companyId, groupId), task.approvalInstanceId)
                const existingSnap = await getDoc(existingRef)
                if (existingSnap.exists()) {
                    const existingInstance = existingSnap.data() as ApprovalInstance
                    if (existingInstance.status === 'in_progress') {
                        console.log(`[TaskApprovalService] Task ${taskId} already has an active reporter approval instance ${task.approvalInstanceId}. Skipping.`)
                        return task.approvalInstanceId
                    }
                }
            }

            // 5. Get reporter user info for the approval instance
            let reporterName = task.reporterName || 'Reporter'
            const reporterPositionId = task.reporterPositionId
            let reporterPositionTitle = 'Reporter'

            try {
                const userPath = groupId && groupId !== companyId
                    ? ['enterpriseGroups', groupId, 'users', task.reporter]
                    : ['companies', companyId, 'users', task.reporter]
                const userSnap = await getDoc(doc(db, ...userPath as [string, ...string[]]))
                if (userSnap.exists()) {
                    const userData = userSnap.data() as any
                    reporterName = userData.name || userData.displayName || reporterName
                    reporterPositionTitle = userData.positionTitle || userData.position || 'Reporter'
                }
            } catch (err) {
                console.warn(`[TaskApprovalService] Could not fetch reporter info for ${task.reporter}:`, err)
            }

            // 6. Use SYSTEM_REPORTER_APPROVAL_LINE from code constant (NOT Firestore read)
            const template = SYSTEM_REPORTER_APPROVAL_LINE
            const now = new Date().toISOString()

            // 7. Create stage instance with reporter as approver
            // Note: Filter out undefined values as Firestore doesn't accept them
            const approverData: Record<string, any> = {
                userId: task.reporter || actorId,
                userName: reporterName || 'Reporter',
                status: 'pending',
                assignedAt: now,
                isDelegated: false,
                wasEscalatedTo: false
            }
            // Only add optional fields if they have values
            if (reporterPositionId) approverData.positionId = reporterPositionId
            if (reporterPositionTitle) approverData.positionTitle = reporterPositionTitle

            const stageInstance: ApprovalStageInstance = {
                id: 'reporter-review-stage',
                stageDefinitionId: 'reporter-review-stage',
                stageName: 'Reporter Review',
                stageOrder: 1,
                stageType: 'sequential',
                status: 'active',
                requiredApprovals: 1,
                currentApprovals: 0,
                currentRejections: 0,
                assignedApprovers: [approverData as any],
                timeoutHours: 72, // 3 days default
                startedAt: now,
                escalationLevel: 0,
                escalationHistory: []
            }

            // 8. Create approval instance (this goes to FIRESTORE - runtime data)
            // Build context object without undefined values
            const contextData: Record<string, any> = {
                requesterId: task.assignedUserId || actorId,
                resourceType: 'task',
                resourceId: taskId,
                resourceTitle: task.title || 'Task'
            }
            if (task.positionId) contextData.requesterPositionId = task.positionId
            if (task.projectId) contextData.projectId = task.projectId

            // Build resolution approver object without undefined values
            const resolutionApprover: Record<string, any> = {
                userId: task.reporter || actorId,
                userName: reporterName || 'Reporter',
                isRequired: true,
                canDelegate: false
            }
            if (reporterPositionId) resolutionApprover.positionId = reporterPositionId
            if (reporterPositionTitle) resolutionApprover.positionTitle = reporterPositionTitle

            // Build instance data - only include defined values
            const instanceData: Record<string, any> = {
                companyId,
                approvalLineId: SYSTEM_REPORTER_APPROVAL_ID,
                approvalLineName: template.name || 'Reporter Approval',
                approvalLineVersion: 1,

                // System approval markers - CRITICAL for identifying reporter approvals
                isSystemApproval: true,
                systemApprovalType: 'reporter_approval',

                // Resource info
                resourceType: 'task',
                resourceId: taskId,
                resourceTitle: task.title || 'Task',

                // Context
                context: contextData,

                // Pre-resolved approval (single stage, single approver)
                resolution: {
                    approvalLineId: SYSTEM_REPORTER_APPROVAL_ID,
                    approvalLineName: template.name || 'Reporter Approval',
                    stages: [{
                        stageId: 'reporter-review-stage',
                        stageName: 'Reporter Review',
                        stageOrder: 1,
                        stageType: 'sequential',
                        approvers: [resolutionApprover],
                        requiredApprovals: 1,
                        timeoutHours: 72
                    }],
                    totalApprovers: 1,
                    totalStages: 1,
                    warnings: []
                },

                // State
                status: 'in_progress',
                currentStageId: 'reporter-review-stage',
                currentStageOrder: 1,
                stageInstances: [stageInstance],

                // Timing
                startedAt: now,
                createdAt: now,
                updatedAt: now,
                createdBy: actorId
            }

            // Add optional fields only if they have values
            if (task.projectCode && task.taskNumber) {
                instanceData.resourceNumber = `${task.projectCode}-${task.taskNumber}`
            }
            if (task.projectId) {
                instanceData.projectId = task.projectId
            }

            // 9. Save to Firestore
            const instanceRef = await addDoc(this.getCollection(companyId, groupId), instanceData)

            // 10. Update task with instance reference
            const attemptNumber = (task.reporterApprovalAttempts || 0) + 1
            await updateDoc(taskRef, {
                approvalInstanceId: instanceRef.id,
                approvalStatus: 'pending',
                reporterApprovalAttempts: attemptNumber,
                updatedAt: now
            })

            // 11. Notify reporter
            try {
                await TaskNotificationService.notifyApprovalRequired(
                    companyId,
                    task.assignedUserId || actorId, // requester
                    { ...task, id: taskId } as GeneratedTask,
                    task.reporter, // approver (reporter)
                    groupId,
                    `/projects/${task.projectId}/tasks/${taskId}`
                )
                console.log(`[TaskApprovalService] Notified reporter ${task.reporter} for task ${taskId}`)
            } catch (notifyError) {
                console.error('[TaskApprovalService] Error notifying reporter:', notifyError)
                // Don't fail the approval process if notification fails
            }

            // 12. Skip activity log for system approval start
            // Reporter approval uses simplified activity logging in submitDecision
            // No need to log "workflow started" - the decision log will be sufficient

            console.log(`[TaskApprovalService] Reporter approval triggered for task ${taskId}, instance ${instanceRef.id}`)
            return instanceRef.id
        } catch (error) {
            console.error('[TaskApprovalService] Error triggering reporter approval:', error)
            throw error
        }
    }

    /**
     * Submit an approval/rejection decision
     */
    static async submitDecision(
        companyId: string,
        instanceId: string,
        userId: string,
        decision: 'approved' | 'rejected',
        comments?: string,
        groupId?: string
    ): Promise<void> {
        // Track if we need to notify next stage approvers (after transaction)
        let shouldNotifyNextStage = false
        let nextStageOrderToNotify = 0
        let taskTitleForNotification = ''

        // Track info for activity logging (captured during transaction, logged after)
        let activityLogInfo: ApprovalActivityLogInfo | null = null

        try {
            const instanceRef = doc(this.getCollection(companyId, groupId), instanceId)

            await runTransaction(db, async (transaction) => {
                // === ALL READS FIRST (Firestore requirement) ===
                const instanceSnap = await transaction.get(instanceRef)
                if (!instanceSnap.exists()) throw new Error('Approval instance not found')

                const instance = instanceSnap.data() as ApprovalInstance
                if (instance.status !== 'in_progress') throw new Error(`Instance is already ${instance.status}`)

                // Pre-fetch the task document for potential update later
                const taskRef = this.getTaskDoc(companyId, instance.resourceId, groupId)
                const taskSnap = await transaction.get(taskRef)

                // Store task title for potential notification
                taskTitleForNotification = instance.resourceTitle || 'Task'

                // Get user info for activity logging (outside transaction - not a transactional read)
                let userName = 'Unknown'
                let userPosition: string | undefined
                try {
                    const userPath = groupId
                        ? ['enterpriseGroups', groupId, 'users', userId]
                        : ['companies', companyId, 'users', userId]
                    const userDoc = await getDoc(doc(db, ...userPath))
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as any
                        userName = userData?.name || userData?.displayName || 'Unknown'
                        userPosition = userData?.position
                    }
                } catch (e) {
                    console.warn('[TaskApprovalService] Could not fetch user info for activity log:', e)
                }

                const now = new Date().toISOString()
                const updatedStageInstances = [...instance.stageInstances]
                const currentStageIndex = updatedStageInstances.findIndex(s => s.status === 'active')

                if (currentStageIndex === -1) throw new Error('No active stage found')

                const currentStage = updatedStageInstances[currentStageIndex]
                if (!currentStage) throw new Error('Active stage is undefined')

                const approverIndex = currentStage.assignedApprovers.findIndex(a => a.userId === userId && a.status === 'pending')
                if (approverIndex === -1) throw new Error('User is not a pending approver for the active stage')

                // Update approver decision with strict type preservation
                const updatedApprovers = [...currentStage.assignedApprovers]
                const oldApprover = updatedApprovers[approverIndex]
                if (!oldApprover) throw new Error('Approver not found in stage')

                updatedApprovers[approverIndex] = {
                    ...oldApprover,
                    status: decision as any,
                    respondedAt: now,
                    decision,
                    comments: comments || ''
                }

                currentStage.assignedApprovers = updatedApprovers
                if (decision === 'approved') currentStage.currentApprovals++
                else currentStage.currentRejections++

                // Check stage result
                let stageDecision: 'approved' | 'rejected' | undefined
                if (decision === 'rejected') {
                    stageDecision = 'rejected' // Any rejection fails the stage (default simple logic)
                } else if (currentStage.currentApprovals >= (currentStage.requiredApprovals || currentStage.assignedApprovers.length)) {
                    stageDecision = 'approved'
                }

                let nextStatus: ApprovalInstanceStatus = instance.status
                let nextStageId = instance.currentStageId
                let nextStageOrder = instance.currentStageOrder

                if (stageDecision === 'rejected') {
                    currentStage.status = 'rejected'
                    currentStage.decision = 'rejected'
                    currentStage.completedAt = now
                    nextStatus = 'rejected'
                } else if (stageDecision === 'approved') {
                    currentStage.status = 'approved'
                    currentStage.decision = 'approved'
                    currentStage.completedAt = now

                    // Move to next stage if available
                    if (currentStageIndex < updatedStageInstances.length - 1) {
                        const nextStage = updatedStageInstances[currentStageIndex + 1]
                        if (nextStage) {
                            nextStage.status = 'active'
                            nextStage.startedAt = now
                            nextStageId = nextStage.id
                            nextStageOrder = nextStage.stageOrder

                            // Flag that we need to notify next stage approvers
                            shouldNotifyNextStage = true
                            nextStageOrderToNotify = nextStage.stageOrder
                            console.log(`[TaskApprovalService] Advanced to stage ${nextStageOrder}: ${nextStage.stageName}`)
                        }
                    } else {
                        // This was the last stage - workflow is approved
                        nextStatus = 'approved'
                    }
                }

                // Capture activity log info before transaction completes
                const nextStageForLog = shouldNotifyNextStage ? updatedStageInstances[currentStageIndex + 1] : undefined
                activityLogInfo = {
                    taskId: instance.resourceId,
                    projectId: instance.projectId || '',
                    workflowId: instance.approvalLineId,
                    workflowName: instance.approvalLineName || 'Approval',
                    totalStages: instance.stageInstances.length,
                    currentStageNumber: currentStage.stageOrder,
                    stageId: currentStage.id,
                    stageName: currentStage.stageName,
                    userName,
                    userPosition: userPosition || undefined,
                    requesterId: instance.context?.requesterId || undefined,
                    resourceTitle: instance.resourceTitle || undefined,
                    stageEnteredAt: currentStage.startedAt || undefined,
                    workflowCompleted: nextStatus === 'approved',
                    workflowRejected: nextStatus === 'rejected',
                    isSystemApproval: instance.isSystemApproval === true,
                    // Sanitize undefined to null for Firestore compatibility
                    nextStage: nextStageForLog ? {
                        stageId: nextStageForLog.id,
                        stageName: nextStageForLog.stageName,
                        stageOrder: nextStageForLog.stageOrder,
                        pendingApproverId: nextStageForLog.assignedApprovers[0]?.userId || '',
                        pendingApproverName: nextStageForLog.assignedApprovers[0]?.userName || 'Unknown',
                        pendingApproverPosition: nextStageForLog.assignedApprovers[0]?.positionTitle || undefined
                    } : undefined
                }

                transaction.update(instanceRef, {
                    stageInstances: updatedStageInstances,
                    status: nextStatus,
                    currentStageId: nextStageId,
                    currentStageOrder: nextStageOrder,
                    updatedAt: now,
                    ...(nextStatus !== 'in_progress' && {
                        completedAt: now,
                        finalDecision: nextStatus as any,
                        finalDecisionAt: now,
                        finalDecisionBy: userId,
                        finalComments: comments || ''
                    })
                })

                // If status completed, update task (if it still exists - checked via pre-fetched taskSnap)
                if (nextStatus !== 'in_progress') {
                    if (taskSnap.exists()) {
                        // Build update object conditionally to avoid undefined values (Firestore rejects undefined)
                        const taskUpdate: Record<string, any> = {
                            approvalStatus: nextStatus as any,
                            approvalNotes: comments || '',
                            updatedAt: now
                        }

                        // ═══════════════════════════════════════════════════════════════
                        // REPORTER APPROVAL: Special handling for system reporter approval
                        // ═══════════════════════════════════════════════════════════════
                        if (isReporterApprovalInstance(instance)) {
                            const currentTaskData = taskSnap.data() as GeneratedTask
                            const attemptNumber = currentTaskData.reporterApprovalAttempts || 1

                            if (nextStatus === 'approved') {
                                // Reporter APPROVED: Complete the task
                                taskUpdate.status = 'completed'
                                taskUpdate.reporterApprovalStatus = 'approved'
                                taskUpdate.completedAt = now
                                taskUpdate.actualEndDate = now
                                taskUpdate.approvedBy = userId
                                taskUpdate.approvedAt = now
                                // Add to history
                                taskUpdate.reporterApprovalHistory = [
                                    ...(currentTaskData.reporterApprovalHistory || []),
                                    {
                                        decision: 'approved',
                                        comments: comments || '',
                                        decidedBy: userId,
                                        decidedAt: now,
                                        attemptNumber
                                    }
                                ]
                                console.log(`[TaskApprovalService] Reporter APPROVED task ${instance.resourceId}. Status → completed.`)
                            } else if (nextStatus === 'rejected') {
                                // Reporter REJECTED: Move task back to in_progress
                                taskUpdate.status = 'in_progress'
                                taskUpdate.reporterApprovalStatus = 'rejected'
                                taskUpdate.reporterRejectionComments = comments || ''
                                // Add to history
                                taskUpdate.reporterApprovalHistory = [
                                    ...(currentTaskData.reporterApprovalHistory || []),
                                    {
                                        decision: 'rejected',
                                        comments: comments || '',
                                        decidedBy: userId,
                                        decidedAt: now,
                                        attemptNumber
                                    }
                                ]
                                console.log(`[TaskApprovalService] Reporter REJECTED task ${instance.resourceId}. Status → in_progress.`)
                            }
                        } else {
                            // Standard approval flow (non-reporter)
                            if (nextStatus === 'approved') {
                                taskUpdate.approvedBy = userId
                                taskUpdate.approvedAt = now
                            }
                        }

                        transaction.update(taskRef, taskUpdate)
                    } else {
                        console.warn(`[TaskApprovalService] Task ${instance.resourceId} no longer exists. Skipping task update.`)
                    }
                }
            })

            // After transaction succeeds, notify next stage approvers if needed
            if (shouldNotifyNextStage && nextStageOrderToNotify > 0) {
                console.log(`[TaskApprovalService] Stage approved, notifying approvers for stage ${nextStageOrderToNotify}`)
                await this.notifyApproversForStage(companyId, instanceId, nextStageOrderToNotify, taskTitleForNotification, groupId)
            }

            // Log activities after transaction succeeds
            // TypeScript doesn't track assignments in async callbacks, so we use type assertion
            if (activityLogInfo !== null) {
                const logInfo = activityLogInfo as ApprovalActivityLogInfo
                try {
                    // For system approvals (Reporter Approval), use simplified logging
                    if (logInfo.isSystemApproval) {
                        // Single simplified log entry for reporter approval
                        await logReporterApprovalDecision(companyId, logInfo.taskId, logInfo.projectId, {
                            instanceId,
                            decision,
                            comments,
                            reporterId: userId,
                            reporterName: logInfo.userName
                        }, groupId)

                        // Send workflow completed notification for system approvals
                        if (logInfo.workflowCompleted) {
                            await TaskNotificationService.notifyWorkflowCompleted(
                                companyId,
                                logInfo.requesterId || userId,
                                logInfo.workflowName,
                                'task',
                                logInfo.resourceTitle || 'Task',
                                `/projects/${logInfo.projectId}/tasks/${logInfo.taskId}`,
                                groupId
                            )
                        }

                        // Send rejection notification for system approvals
                        if (logInfo.workflowRejected) {
                            await TaskNotificationService.notifyApprovalRejected(
                                companyId,
                                logInfo.requesterId || userId,
                                logInfo.workflowName,
                                'task',
                                logInfo.resourceTitle || 'Task',
                                logInfo.userName, // rejectedBy
                                comments, // rejection reason
                                `/projects/${logInfo.projectId}/tasks/${logInfo.taskId}`,
                                groupId,
                                logInfo.taskId,
                                logInfo.projectId
                            )
                        }
                    } else {
                        // Standard multi-stage approval logging
                        // 1. Log the decision (approved/rejected for this stage)
                        await logApprovalDecision(companyId, logInfo.taskId, logInfo.projectId, {
                            instanceId,
                            workflowId: logInfo.workflowId,
                            workflowName: logInfo.workflowName,
                            totalStages: logInfo.totalStages,
                            currentStageNumber: logInfo.currentStageNumber,
                            stageId: logInfo.stageId,
                            stageName: logInfo.stageName,
                            decision,
                            comments,
                            userId,
                            userName: logInfo.userName,
                            userPosition: logInfo.userPosition,
                            stageEnteredAt: logInfo.stageEnteredAt
                        }, groupId)

                        // 2. If moving to next stage, log entering the new stage
                        if (logInfo.nextStage) {
                            await logApprovalStageEntered(companyId, logInfo.taskId, logInfo.projectId, {
                                instanceId,
                                workflowId: logInfo.workflowId,
                                workflowName: logInfo.workflowName,
                                totalStages: logInfo.totalStages,
                                currentStageNumber: logInfo.nextStage.stageOrder,
                                stageId: logInfo.nextStage.stageId,
                                stageName: logInfo.nextStage.stageName,
                                pendingApproverId: logInfo.nextStage.pendingApproverId,
                                pendingApproverName: logInfo.nextStage.pendingApproverName,
                                pendingApproverPosition: logInfo.nextStage.pendingApproverPosition
                            }, groupId)
                        }

                        // 3. If workflow completed (all stages approved), log completion
                        if (logInfo.workflowCompleted) {
                            await logApprovalWorkflowCompleted(companyId, logInfo.taskId, logInfo.projectId, {
                                instanceId,
                                workflowId: logInfo.workflowId,
                                workflowName: logInfo.workflowName,
                                totalStages: logInfo.totalStages
                            }, groupId)

                            // 3.1 Trigger Workflow Completed Notification
                            await TaskNotificationService.notifyWorkflowCompleted(
                                companyId,
                                logInfo.requesterId || userId,
                                logInfo.workflowName,
                                'task',
                                logInfo.resourceTitle || 'Task',
                                `/projects/${logInfo.projectId}/tasks/${logInfo.taskId}`,
                                groupId
                            )
                        }

                        // 4. If workflow rejected, log rejection
                        if (logInfo.workflowRejected) {
                            await logApprovalWorkflowRejected(companyId, logInfo.taskId, logInfo.projectId, {
                                instanceId,
                                workflowId: logInfo.workflowId,
                                workflowName: logInfo.workflowName,
                                totalStages: logInfo.totalStages,
                                rejectedAtStage: logInfo.currentStageNumber,
                                stageName: logInfo.stageName,
                                rejectedBy: userId,
                                rejectedByName: logInfo.userName,
                                reason: comments
                            }, groupId)
                        }
                    }

                    console.log(`[TaskApprovalService] ✅ Activities logged for decision on task ${logInfo.taskId}`)
                } catch (activityError) {
                    console.error('[TaskApprovalService] Error logging approval activities:', activityError)
                    // Don't fail the approval process if activity logging fails
                }
            }
        } catch (error) {
            console.error('Error submitting approval decision:', error)
            throw error
        }
    }

    /**
     * Notify approvers for a specific stage
     */
    private static async notifyApproversForStage(
        companyId: string,
        instanceId: string,
        stageOrder: number,
        taskTitle: string,
        groupId?: string
    ): Promise<void> {
        const instanceSnap = await getDoc(doc(this.getCollection(companyId, groupId), instanceId))
        if (!instanceSnap.exists()) return

        const instance = instanceSnap.data() as ApprovalInstance
        const stage = instance.stageInstances.find(s => s.stageOrder === stageOrder)
        if (!stage) return

        // Fetch the task to get its full context for notification
        const taskRef = this.getTaskDoc(companyId, instance.resourceId, groupId)
        const taskSnap = await getDoc(taskRef)
        const taskData = taskSnap.data()
        if (!taskSnap.exists() || !taskData) return
        const task = { id: taskSnap.id, ...taskData } as GeneratedTask

        for (const approver of stage.assignedApprovers) {
            await TaskNotificationService.notifyApprovalRequired(
                companyId,
                instance.context?.requesterId || '',
                task,
                approver.userId,
                groupId,
                `/approvals/${instanceId}`
            )
        }
    }

    /**
     * Get approval instance for a task
     * Returns null if no approval instance exists
     */
    static async getApprovalInstance(
        companyId: string,
        taskId: string,
        groupId?: string
    ): Promise<ApprovalInstance | null> {
        try {
            const q = query(
                this.getCollection(companyId, groupId),
                where('resourceId', '==', taskId)
            )
            const snapshot = await getDocs(q)

            if (snapshot.empty || !snapshot.docs[0]) return null

            return {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
            } as ApprovalInstance
        } catch (error) {
            console.error('Error getting approval instance:', error)
            return null
        }
    }

    /**
     * Get ALL approval instances for a task (for history/versioning)
     * Returns array sorted by createdAt (oldest first)
     */
    static async getAllApprovalInstances(
        companyId: string,
        taskId: string,
        groupId?: string
    ): Promise<ApprovalInstance[]> {
        try {
            const q = query(
                this.getCollection(companyId, groupId),
                where('resourceId', '==', taskId)
            )
            const snapshot = await getDocs(q)

            if (snapshot.empty) return []

            const instances = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ApprovalInstance))

            // Sort by createdAt (oldest first for version numbering)
            return instances.sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
        } catch (error) {
            console.error('Error getting all approval instances:', error)
            return []
        }
    }

    /**
     * Check if a user is an approver (past or current) for a task
     * Used to grant read access to tasks for approvers who aren't in the project
     */
    static async isUserApproverForTask(
        companyId: string,
        taskId: string,
        userId: string,
        groupId?: string
    ): Promise<boolean> {
        try {
            const instance = await this.getApprovalInstance(companyId, taskId, groupId)
            if (!instance) return false

            // Check all stages to see if user is/was an approver
            for (const stage of instance.stageInstances || []) {
                for (const approver of stage.assignedApprovers || []) {
                    if (approver.userId === userId) {
                        return true
                    }
                }
            }

            return false
        } catch (error) {
            console.error('Error checking approver status:', error)
            return false
        }
    }

    /**
     * Cancel an approval process (admin action)
     * Updates the approval instance status and clears the task's approval fields
     */
    static async cancelApproval(
        companyId: string,
        approvalInstanceId: string,
        groupId?: string
    ): Promise<void> {
        try {
            await runTransaction(db, async (transaction) => {
                // === ALL READS FIRST (Firestore requirement) ===
                const instanceRef = doc(this.getCollection(companyId, groupId), approvalInstanceId)
                const instanceSnap = await transaction.get(instanceRef)

                if (!instanceSnap.exists()) {
                    throw new Error('Approval instance not found')
                }

                const instance = instanceSnap.data() as ApprovalInstance

                // Pre-fetch the task document for potential update later
                const taskRef = this.getTaskDoc(companyId, instance.resourceId, groupId)
                const taskSnap = await transaction.get(taskRef)

                // === ALL WRITES AFTER READS ===
                const now = new Date().toISOString()

                // Update the approval instance
                transaction.update(instanceRef, {
                    status: 'cancelled',
                    completedAt: now,
                    finalDecision: 'cancelled',
                    finalDecisionAt: now,
                    finalComments: 'Cancelled by administrator',
                    updatedAt: now
                })

                // Update the task to clear approval status (if it still exists)
                if (taskSnap.exists()) {
                    transaction.update(taskRef, {
                        approvalStatus: 'cancelled',
                        approvalNotes: 'Approval cancelled by administrator',
                        updatedAt: now
                    })
                } else {
                    console.warn(`[TaskApprovalService] Task ${instance.resourceId} no longer exists. Skipping task update.`)
                }
            })
        } catch (error) {
            console.error('Error cancelling approval:', error)
            throw error
        }
    }
}
