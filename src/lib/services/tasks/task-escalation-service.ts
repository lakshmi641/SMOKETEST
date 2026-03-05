import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import type { TaskEscalationRegistration } from '@/types/workflow-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import { TaskNotificationService } from './task-notification-service'
import { assignTaskWithDelegation } from './task-assignment-service'
import { evaluateEscalation, resolveEscalationTarget, getEscalationPath } from '../escalation-path-service'
import {
    logEscalationStarted,
    logEscalationLevelEntered,
    logEscalationNotification,
    logEscalationReassign
} from '../task-activity-service'

/**
 * TaskEscalationService
 *
 * Handles the runtime monitoring and execution of task-level escalation paths.
 * Works independently of the BPMN engine.
 */
export class TaskEscalationService {
    private static getCollection(companyId: string, groupId?: string) {
        const segs = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'taskEscalationRegistrations')
        return collection(db, segs[0], ...segs.slice(1))
    }

    private static getTaskRef(companyId: string, taskId: string, groupId?: string) {
        const segs = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'tasks')
        return doc(db, segs[0], ...segs.slice(1), taskId)
    }

    private static getUserRef(companyId: string, userId: string, groupId?: string) {
        const segs = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'users')
        return doc(db, segs[0], ...segs.slice(1), userId)
    }

    /**
     * Register a task for escalation monitoring
     * Called when task moves to 'in_progress'
     */
    static async registerForEscalation(
        companyId: string,
        taskId: string,
        groupId?: string
    ): Promise<string | null> {
        try {
            const taskRef = this.getTaskRef(companyId, taskId, groupId)
            const taskSnap = await getDoc(taskRef)

            if (!taskSnap.exists()) return null
            const task = taskSnap.data() as GeneratedTask
            if (!task || !task.escalationPolicyId) return null

            const policyId: string = task.escalationPolicyId;
            const now = new Date().toISOString()
            const nextCheck = new Date()
            nextCheck.setMinutes(nextCheck.getMinutes() + 5)

            // IDEMPOTENCY CHECK: Check for existing active registration
            const existingQuery = query(
                this.getCollection(companyId, groupId),
                where('taskId', '==', taskId),
                where('status', '==', 'active')
            )
            const existingSnapshot = await getDocs(existingQuery)
            if (!existingSnapshot.empty && existingSnapshot.docs[0]) {
                console.log(`Task ${taskId} already has an active escalation registration. Skipping.`)
                return existingSnapshot.docs[0].id
            }

            const registrationData: Omit<TaskEscalationRegistration, 'id'> = {
                companyId,
                groupId: groupId || undefined, // NEW: Persist group context
                taskId,
                escalationPolicyId: policyId,
                status: 'active',
                currentEscalationLevel: 0,
                registeredAt: now,
                nextCheckAt: nextCheck.toISOString(),
                metadata: {
                    taskTitle: task.title,
                    dueDate: task.dueDate
                }
            }

            const regRef = await addDoc(this.getCollection(companyId, groupId), registrationData)

            // Update task with registration timestamp
            await updateDoc(taskRef, {
                escalationRegisteredAt: now,
                updatedAt: now
            })

            console.log(`Registered task ${taskId} for escalation under policy ${task.escalationPolicyId}`)

            // Log escalation started to Activity timeline
            try {
                const escalationPath = await getEscalationPath(companyId, policyId, groupId)
                if (escalationPath) {
                    await logEscalationStarted(companyId, taskId, task.projectId || '', {
                        pathId: policyId,
                        pathName: escalationPath.name,
                        totalLevels: escalationPath.rules?.length || 0,
                        registeredAt: now
                    }, groupId)
                }
            } catch (e) {
                console.error('Failed to log escalation started activity:', e)
            }

            // IMMEDIATE CHECK: Evaluate escalation rules right away if task is overdue
            // This ensures notifications go out immediately instead of waiting for 15-min scheduler
            try {
                const registration = { id: regRef.id, ...registrationData } as TaskEscalationRegistration
                await this.checkAndExecuteEscalation(companyId, registration, groupId)
            } catch (err) {
                console.error('Immediate escalation check failed (non-blocking):', err)
            }

            return regRef.id
        } catch (error) {
            console.error('Error registering task for escalation:', error)
            throw error
        }
    }

    /**
     * Cancel escalation monitoring
     * Called when task is completed or cancelled
     */
    static async cancelEscalation(companyId: string, taskId: string, groupId?: string): Promise<void> {
        try {
            const q = query(
                this.getCollection(companyId, groupId),
                where('taskId', '==', taskId),
                where('status', '==', 'active')
            )

            const snapshot = await getDocs(q)
            const now = new Date().toISOString()

            const updates = snapshot.docs.map(d =>
                updateDoc(d.ref, {
                    status: 'cancelled',
                    updatedAt: now
                })
            )

            await Promise.all(updates)
        } catch (error) {
            console.error('Error cancelling escalation:', error)
        }
    }

    /**
     * Complete escalation successfully
     * Called when task is completed on time (no SLA breach)
     */
    static async completeEscalation(companyId: string, taskId: string, groupId?: string): Promise<void> {
        try {
            const q = query(
                this.getCollection(companyId, groupId),
                where('taskId', '==', taskId),
                where('status', '==', 'active')
            )

            const snapshot = await getDocs(q)
            const now = new Date().toISOString()

            const updates = snapshot.docs.map(d =>
                updateDoc(d.ref, {
                    status: 'completed',
                    completedAt: now,
                    updatedAt: now
                })
            )

            await Promise.all(updates)
        } catch (error) {
            console.error('Error completing escalation:', error)
        }
    }

    /**
     * Process all active escalation registrations that are due for a check
     * This would be called by a cron job / cloud function every 15 mins
     */
    static async processPendingEscalations(companyId: string, groupId?: string): Promise<void> {
        try {
            const now = new Date()
            const q = query(
                this.getCollection(companyId, groupId),
                where('status', '==', 'active'),
                where('nextCheckAt', '<=', now.toISOString())
            )

            const snapshot = await getDocs(q)
            console.log(`Processing ${snapshot.size} pending escalations for company ${companyId}`)

            for (const regDoc of snapshot.docs) {
                const reg = { id: regDoc.id, ...regDoc.data() } as TaskEscalationRegistration
                await this.checkAndExecuteEscalation(companyId, reg, groupId)
            }
        } catch (error) {
            console.error('Error processing pending escalations:', error)
        }
    }

    /**
     * Individual check for a single registration
     * NOTE: This runs on frontend for immediate checks only.
     * The Cloud Function handles scheduled checks - we skip here to avoid double-execution.
     */
    private static async checkAndExecuteEscalation(
        companyId: string,
        reg: TaskEscalationRegistration,
        groupId?: string
    ): Promise<void> {
        try {
            // COOLDOWN CHECK: Skip if action was taken recently (within 2 minutes)
            // This prevents double-execution between frontend immediate check and backend scheduler
            if (reg.lastActionAt) {
                const lastAction = new Date(reg.lastActionAt)
                const minutesSinceLastAction = (Date.now() - lastAction.getTime()) / (1000 * 60)
                if (minutesSinceLastAction < 2) {
                    console.log(`Skipping escalation check - action taken ${minutesSinceLastAction.toFixed(1)} minutes ago`)
                    return
                }
            }

            // 1. Get current task state
            const taskSnap = await getDoc(this.getTaskRef(companyId, reg.taskId, groupId))
            if (!taskSnap.exists()) {
                await updateDoc(doc(this.getCollection(companyId, groupId), reg.id), { status: 'cancelled' })
                return
            }

            const task = taskSnap.data() as GeneratedTask

            // If task is no longer in progress, cancel monitoring
            if (!['assigned', 'in_progress'].includes(task.status)) {
                await this.cancelEscalation(companyId, reg.taskId, groupId)
                return
            }

            // 2. Prepare context for evaluation
            const dueDate = task.dueDate ? new Date(task.dueDate) : new Date()
            const now = new Date()
            // Use fractional hours for short timeouts (e.g., 2 min = 0.033 hours)
            const hoursSinceStart = task.startedAt
                ? (now.getTime() - new Date(task.startedAt).getTime()) / (1000 * 60 * 60)
                : 0

            const hoursOverdue = now > dueDate
                ? (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60)
                : 0

            // 3. Evaluate rules using EscalationPathService
            // For direct task escalation:
            // - 'time' trigger uses hoursSinceStart (time since task started)
            // - This ensures escalation fires X minutes after task starts, regardless of due date
            const result = await evaluateEscalation(companyId, reg.escalationPolicyId, {
                hoursSinceStart: hoursSinceStart, // Use actual time since task started
                hoursSinceLastAction: Math.max(hoursSinceStart, hoursOverdue), // Use whichever is greater
                remindersSent: reg.currentEscalationLevel,
                hasRejections: task.approvalStatus === 'rejected',
                hasPartialApprovals: false,
                stageInstance: { escalationLevel: reg.currentEscalationLevel } as any
            }, groupId)

            if (result.shouldEscalate && result.rule) {
                // 4. Execute Action
                await this.executeEscalationAction(companyId, task, reg, result, groupId)
            }

            // 5. Schedule next check
            const nextCheck = new Date()
            nextCheck.setMinutes(nextCheck.getMinutes() + 5)

            await updateDoc(doc(this.getCollection(companyId, groupId), reg.id), {
                lastCheckedAt: now.toISOString(),
                nextCheckAt: nextCheck.toISOString(),
                updatedAt: now.toISOString()
            })

        } catch (error) {
            console.error(`Error checking escalation for reg ${reg.id}:`, error)
        }
    }

    /**
     * Execute the specific escalation action
     */
    private static async executeEscalationAction(
        companyId: string,
        task: GeneratedTask,
        reg: TaskEscalationRegistration,
        result: any,
        groupId?: string
    ): Promise<void> {
        const now = new Date().toISOString()
        const rule = result.rule

        console.log(`Executing escalation action '${rule.action}' for task ${task.id}`)

        // Get the actual task title from multiple sources (fallback chain)
        const actualTaskTitle = task.title || reg.metadata?.taskTitle || 'Untitled Task'

        // Get escalation path to find the next rule
        const escalationPath = await getEscalationPath(companyId, reg.escalationPolicyId, groupId)

        // Find the next escalation rule to inform the user what will happen if they don't act
        let nextActionMessage = ''
        if (escalationPath) {
            const sortedRules = [...escalationPath.rules]
                .filter((r: any) => r.triggerType === 'time')
                .sort((a: any, b: any) => (a.triggerAfterHours || 0) - (b.triggerAfterHours || 0))

            const currentRuleIndex = sortedRules.findIndex((r: any) => r.id === rule.id)
            const nextRule = currentRuleIndex >= 0 && currentRuleIndex < sortedRules.length - 1
                ? sortedRules[currentRuleIndex + 1]
                : null

            if (nextRule) {
                const nextActionLabels: Record<string, string> = {
                    'notify': 'another notification will be sent',
                    'reassign': 'the task will be reassigned',
                    'escalate': 'it will be escalated to your manager',
                    'auto_approve': 'it will be auto-approved',
                    'auto_reject': 'it will be auto-rejected'
                }
                nextActionMessage = nextActionLabels[(nextRule as any).action] || 'further escalation will occur'
            }
        }

        // Helper to build notification message with template support and next action info
        const buildNotificationMessage = (template: string | undefined, taskTitle: string): string => {
            let message: string
            if (!template) {
                message = `Task "${taskTitle}" has triggered an escalation alert. Please take action immediately.`
            } else {
                // Support both {{placeholder}} and [placeholder] formats
                message = template
                    .replace(/\{\{taskTitle\}\}/g, taskTitle)
                    .replace(/\{\{stageName\}\}/g, taskTitle)
                    .replace(/\[taskTitle\]/g, taskTitle)
                    .replace(/\[stageName\]/g, taskTitle)
            }
            // Add next action info
            if (nextActionMessage) {
                message += ` If not resolved, ${nextActionMessage}.`
            }
            return message
        }

        switch (rule.action) {
            case 'notify':
                // Resolve target and notify
                if (!escalationPath) return

                const target = await resolveEscalationTarget(companyId, escalationPath, rule, {
                    stageInstance: { assignedApprovers: [task.assignedUserId] } as any,
                    hoursSinceStart: 0,
                    hoursSinceLastAction: 0,
                    remindersSent: reg.currentEscalationLevel,
                    hasRejections: false,
                    hasPartialApprovals: false
                }, groupId)

                if (target?.userId) {
                    await TaskNotificationService.notifyTaskEscalated(companyId, target.userId, {
                        title: '⚠️ Task Escalation - Action Required',
                        message: buildNotificationMessage(rule.messageTemplate, actualTaskTitle),
                        taskId: task.id,
                        projectId: task.projectId,
                        priority: 'urgent',
                        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
                    }, groupId)

                    // Log to Activity timeline
                    try {
                        const targetUserDoc = await getDoc(this.getUserRef(companyId, target.userId, groupId))
                        const targetUserName = targetUserDoc.exists() ? (targetUserDoc.data().name || 'User') : 'User'

                        await logEscalationNotification(companyId, task.id, task.projectId, {
                            pathName: escalationPath.name,
                            currentLevelNumber: reg.currentEscalationLevel + 1,
                            totalLevels: escalationPath.rules.length,
                            levelName: rule.name || `Level ${reg.currentEscalationLevel + 1}`,
                            action: 'notify',
                            targetUserId: target.userId,
                            targetUserName,
                            targetPosition: target.positionId || null
                        }, groupId)
                    } catch (e) {
                        console.error('Failed to log escalation notification activity:', e)
                    }
                }
                break

            case 'reassign':
            case 'escalate':
                if (!escalationPath) return

                const newTarget = await resolveEscalationTarget(companyId, escalationPath, rule, {
                    stageInstance: { assignedApprovers: [task.assignedUserId] } as any,
                    hoursSinceStart: 0,
                    hoursSinceLastAction: 0,
                    remindersSent: reg.currentEscalationLevel,
                    hasRejections: false,
                    hasPartialApprovals: false
                }, groupId)

                if (newTarget?.userId) {
                    // Get previous assignee name before reassignment
                    let previousAssigneeName = 'Previous Assignee'
                    if (task.assignedUserId) {
                        try {
                            const prevUserDoc = await getDoc(this.getUserRef(companyId, task.assignedUserId, groupId))
                            previousAssigneeName = prevUserDoc.exists() ? (prevUserDoc.data().name || 'Previous Assignee') : 'Previous Assignee'
                        } catch (e) { /* ignore */ }
                    }

                    await assignTaskWithDelegation(
                        companyId,
                        task.id,
                        newTarget.positionId || null,
                        newTarget.userId,
                        groupId
                    )

                    // Send notification to new assignee
                    await TaskNotificationService.notifyTaskEscalated(companyId, newTarget.userId, {
                        title: rule.action === 'escalate' ? '🔺 Task Escalated to You' : '📋 Task Reassigned via Escalation',
                        message: `Task "${actualTaskTitle}" has been ${rule.action === 'escalate' ? 'escalated' : 'reassigned'} to you. The previous assignee did not complete it in time. Please review and take action.`,
                        taskId: task.id,
                        projectId: task.projectId,
                        priority: 'urgent',
                        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
                    }, groupId)

                    // Log to Activity timeline
                    try {
                        const newUserDoc = await getDoc(this.getUserRef(companyId, newTarget.userId, groupId))
                        const newUserName = newUserDoc.exists() ? (newUserDoc.data().name || 'User') : 'User'

                        await logEscalationReassign(companyId, task.id, task.projectId, {
                            pathName: escalationPath.name,
                            currentLevelNumber: reg.currentEscalationLevel + 1,
                            totalLevels: escalationPath.rules.length,
                            levelName: rule.name || `Level ${reg.currentEscalationLevel + 1}`,
                            fromUserId: task.assignedUserId || null,
                            fromUserName: previousAssigneeName,
                            toUserId: newTarget.userId,
                            toUserName: newUserName,
                            toPosition: newTarget.positionId || null,
                            reason: `Task overdue - ${rule.action === 'escalate' ? 'escalated' : 'reassigned'} via escalation policy`
                        }, groupId)
                    } catch (e) {
                        console.error('Failed to log escalation reassign activity:', e)
                    }
                }
                break

            case 'auto_approve':
                // If task is pending approval, auto-approve it
                if (task.approvalInstanceId) {
                    const { TaskApprovalService } = await import('./task-approval-service')
                    // System auto-approval logic could go here
                    console.log(`Auto-approving task ${task.id} via escalation`)
                }
                break
        }

        // Update registration with action taken
        await updateDoc(doc(this.getCollection(companyId, groupId), reg.id), {
            currentEscalationLevel: reg.currentEscalationLevel + 1,
            lastActionAt: now,
            lastActionTaken: rule.action
        })
    }
}
