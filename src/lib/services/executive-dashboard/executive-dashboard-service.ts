import { db } from '@/lib/firebase'
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import {
    isWithinInterval,
    subDays,
    startOfDay,
    endOfDay,
    isBefore,
    differenceInDays,
    format
} from 'date-fns'
import type {
    ExecutiveDashboardData,
    ExecutiveFilters,
    StrategicHealthScore,
    PortfolioStatusData,
    DeliveryVelocityData,
    RiskIndexData,
    ApprovalQueueData,
    BudgetHealthData,
    OrgHierarchyNode,
    ExecutiveAction,
    CriticalItem,
    CriticalItemsMatrix
} from '@/types/executive-dashboard'
import type { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask as Task } from '@/types/task-template-schema'
import { HierarchyAggregationService } from './hierarchy-aggregation-service'
import { ScopeFilterService } from './scope-filter-service'
import { companyCollectionPathSegments } from '@/lib/firestore-paths'

export interface ExecutiveDashboardDataOptions {
    /** Pre-fetched workspaces (e.g. from useWorkspacesQuery) to avoid duplicate fetch */
    workspaces?: any[]
    /** Pre-fetched projects (e.g. from useProjectsQuery) to avoid duplicate fetch */
    projects?: EnhancedProject[]
}

export class ExecutiveDashboardService {
    /**
     * Fetch and aggregate all CEO Dashboard data.
     * Uses enterprise group path: enterpriseGroups/{groupId}/companies/{companyId}/...
     * Pass workspaces/projects from useWorkspacesQuery and useProjectsQuery when available to avoid duplicate Firebase reads.
     */
    static async getDashboardData(
        groupId: string,
        companyId: string,
        userId: string,
        filters: ExecutiveFilters,
        options?: ExecutiveDashboardDataOptions
    ): Promise<ExecutiveDashboardData> {
        const { dateRange, viewScope } = filters
        const effectiveGroupId = groupId || companyId

        const [workspaces, projects, tasks, workflowInstances, users, positions, orgUnits, assignments, pendingApprovals, escalationNotifications] = await Promise.all([
            options?.workspaces != null
                ? Promise.resolve(options.workspaces)
                : this.getWorkspaces(companyId, effectiveGroupId),
            options?.projects != null
                ? Promise.resolve(options.projects)
                : this.getProjects(companyId, effectiveGroupId),
            this.getTasks(companyId, effectiveGroupId),
            this.getWorkflowInstances(companyId, effectiveGroupId),
            this.getUsers(companyId, effectiveGroupId),
            this.getPositions(companyId, effectiveGroupId),
            this.getOrgUnits(companyId, effectiveGroupId),
            this.getAssignments(companyId, effectiveGroupId),
            this.getPendingApprovalInstances(companyId, userId, effectiveGroupId),
            this.getEscalationNotifications(companyId, userId, effectiveGroupId)
        ])

        let filtered = { workspaces, projects, tasks, workflowInstances, users }

        if (viewScope === 'my_scope') {
            filtered = await ScopeFilterService.applyFilter(
                filtered,
                userId,
                positions,
                assignments
            )
        }

        const pendingActions = this.calculatePendingActions(
            pendingApprovals,
            escalationNotifications,
            filtered.tasks,
            userId,
            filtered.workspaces,
            filtered.projects
        )
        const criticalItems = this.calculateCriticalItems(filtered.workspaces, filtered.projects, filtered.tasks, filtered.workflowInstances)

        const strategicHealth = this.calculateStrategicHealth(filtered.workspaces, filtered.projects, filtered.tasks, filtered.users, dateRange, positions, orgUnits, assignments)
        const portfolioStatus = this.calculatePortfolioStatus(filtered.projects, filtered.tasks, dateRange)
        const deliveryVelocity = this.calculateDeliveryVelocity(filtered.tasks, dateRange)
        const riskIndex = this.calculateRiskIndex(filtered.projects)

        const budgetHealth: BudgetHealthData = {
            percentage: 100,
            status: 'on_budget',
            varianceAmount: 0,
            variancePercentage: 0
        }

        const orgHierarchy = HierarchyAggregationService.buildOrgHierarchy(
            filtered.workspaces,
            filtered.projects,
            filtered.tasks,
            dateRange,
            filtered.users
        )

        return {
            strategicHealth,
            portfolioStatus,
            deliveryVelocity,
            riskIndex,
            approvalQueue: this.calculateApprovalQueue(pendingActions),
            budgetHealth,
            criticalItems,
            pendingActions,
            orgHierarchy,
            velocityTrend: this.calculateVelocityTrend(filtered.tasks),
            milestoneForecasts: this.calculateMilestoneForecasts(filtered.projects, filtered.tasks),
            scheduledWork: this.calculateScheduledWork(filtered.projects, filtered.tasks),
            workspacePerformance: [],
            lastUpdated: new Date()
        }
    }

    // --- Data Fetching Methods (enterprise path) ---

    private static async getWorkspaces(companyId: string, groupId: string) {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'workspaces')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getProjects(companyId: string, groupId: string): Promise<EnhancedProject[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'projects')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnhancedProject))
    }

    private static async getTasks(companyId: string, groupId: string): Promise<Task[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'tasks')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Task))
    }

    private static async getWorkflowInstances(companyId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'workflowInstances')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getUsers(companyId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'users')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getPositions(companyId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'positions')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getOrgUnits(companyId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'orgUnits')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getAssignments(companyId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'positionAssignments')
        const snapshot = await getDocs(collection(db, segs[0], ...segs.slice(1)))
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    private static async getPendingApprovalInstances(companyId: string, userId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'approvalInstances')
        const instancesRef = collection(db, segs[0], ...segs.slice(1))
        const q = query(instancesRef, where('status', '==', 'in_progress'))
        const snapshot = await getDocs(q)

        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(instance => {
                const activeStage = instance.stageInstances?.find((s: any) => s.status === 'active');
                return activeStage?.assignedApprovers?.some((approver: any) =>
                    approver.userId === userId && approver.status === 'pending'
                );
            });
    }

    private static async getEscalationNotifications(companyId: string, userId: string, groupId: string): Promise<any[]> {
        const segs = companySubcollectionPathSegments(groupId, companyId, 'notifications')
        const notificationsRef = collection(db, segs[0], ...segs.slice(1))
        const q = query(
            notificationsRef,
            where('userId', '==', userId),
            where('isRead', '==', false)
        )
        const snapshot = await getDocs(q)

        const allNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        // Filter for escalation notifications
        // These can be:
        // 1. Explicitly typed as escalation notifications
        // 2. task_assigned notifications that contain escalation keywords
        const escalationNotifications = allNotifications.filter(n => {
            // Direct escalation types
            const isEscalationType = [
                'task_escalation_reminder',
                'task_escalation_escalation',
                'task_escalation_reassignment',
                'task_escalation'
            ].includes(n.type);

            // task_assigned notifications with escalation keywords
            const isEscalationByContent = n.type === 'task_assigned' && (
                n.title?.toLowerCase().includes('escalation') ||
                n.title?.toLowerCase().includes('escalat') ||
                n.message?.toLowerCase().includes('escalation') ||
                n.message?.toLowerCase().includes('escalat') ||
                n.message?.toLowerCase().includes('reassigned to you') ||
                n.message?.toLowerCase().includes('reassigned via')
            );

            return isEscalationType || isEscalationByContent;
        });

        return escalationNotifications;
    }

    // --- Calculation Methods ---

    private static calculateStrategicHealth(
        workspaces: any[],
        projects: EnhancedProject[],
        tasks: Task[],
        users: any[],
        dateRange: ExecutiveFilters['dateRange'],
        positions: any[] = [],
        orgUnits: any[] = [],
        assignments: any[] = []
    ): StrategicHealthScore {
        // 1. Project Health (35% weight)
        const activeProjects = projects.filter(p => p.status === 'active')
        const avgProjectHealth = activeProjects.length > 0
            ? activeProjects.reduce((sum, p) => sum + this.getProjectHealthScore(p, tasks), 0) / activeProjects.length
            : 100

        // 2. Task Completion (35% weight)
        const relevantTasks = tasks.filter(t => {
            const created = this.parseDate(t.createdAt)
            return created && created <= dateRange.end && t.status !== 'cancelled'
        })

        const completedInPeriodCount = relevantTasks.filter(t => {
            const completedAt = this.parseDate(t.updatedAt)
            return t.status === 'completed' && completedAt && completedAt >= dateRange.start && completedAt <= dateRange.end
        }).length

        const overdueCount = relevantTasks.filter(t => this.isOverdue(t, dateRange.end)).length

        const taskCompletionScore = Math.max(0,
            completedInPeriodCount + overdueCount > 0
                ? (completedInPeriodCount / (completedInPeriodCount + overdueCount)) * 100
                : 100
        )

        // 3. Resource Utilization (30% weight) - Formula: (Users with assigned tasks / Total active users) * 100
        // Filter out system users or bots if any, assuming all in 'users' collection are valid active users for now
        // We consider a user "active" in resource utilization if they have at least one task assigned (not cancelled)
        const validUserIds = new Set(users.map(u => u.id))
        const activeUsersWithTasks = new Set<string>()
        let totalAssignedTasksCount = 0

        tasks.forEach(t => {
            // Use robust ID lookup to match other parts of the service
            const assigneeId = t.assignedUserId || (t as any).assignedTo || (t as any).assignee

            // Only count if user exists in the system (filters out phantom/deleted users)
            if (assigneeId && validUserIds.has(assigneeId) && t.status !== 'cancelled') {
                activeUsersWithTasks.add(assigneeId)
                totalAssignedTasksCount++
            }
        })

        const totalUsersCount = users.length > 0 ? users.length : 1 // Avoid division by zero
        const usersWithTasksCount = activeUsersWithTasks.size

        // Calculate Utilization Rate
        const resourceScore = Math.min(100, Math.round((usersWithTasksCount / totalUsersCount) * 100))

        const avgTasksPerUser = usersWithTasksCount > 0
            ? parseFloat((totalAssignedTasksCount / usersWithTasksCount).toFixed(1))
            : 0

        const score = Math.round(
            (avgProjectHealth * 0.35) +
            (taskCompletionScore * 0.35) +
            (resourceScore * 0.30)
        )

        let status: StrategicHealthScore['status'] = 'critical'
        if (score >= 90) status = 'excellent'
        else if (score >= 75) status = 'good'
        else if (score >= 60) status = 'fair'
        else if (score >= 40) status = 'poor'

        return {
            score,
            status,
            trend: 'stable',
            trendPercentage: 0,
            components: {
                projectHealth: Math.round(avgProjectHealth),
                taskCompletion: Math.round(taskCompletionScore),
                resourceUtilization: resourceScore
            },
            componentMetadata: {
                projectHealth: {
                    activeProjects: activeProjects.length,
                    avgHealthScore: Math.round(avgProjectHealth)
                },
                taskCompletion: {
                    completedTasks: completedInPeriodCount,
                    overdueTasks: overdueCount,
                    completionRate: Math.round(taskCompletionScore)
                },
                resourceUtilization: {
                    activeUsers: usersWithTasksCount,
                    totalUsers: totalUsersCount,
                    avgTasksPerUser: avgTasksPerUser,
                    utilizationRate: resourceScore
                }
            },
            details: {
                atRiskProjects: activeProjects
                    .filter(p => this.getProjectHealthScore(p, tasks) < 70)
                    .map(p => {
                        const managerId = (p as any).createdBy || (p as any).manager
                        const manager = users.find(u => u.id === managerId)
                        const workspace = workspaces.find(w => w.id === p.workspaceId)
                        return {
                            id: p.id,
                            name: p.name,
                            healthScore: this.getProjectHealthScore(p, tasks),
                            manager: manager?.displayName || manager?.email || managerId || 'Unassigned',
                            workspaceName: workspace?.name || 'Unknown Workspace'
                        }
                    }),
                overdueTasks: relevantTasks
                    .filter(t => this.isOverdue(t, dateRange.end))
                    .map(t => {
                        const project = projects.find(p => p.id === t.projectId)
                        const workspace = workspaces.find(w => w.id === t.workspaceId || project?.workspaceId === w.id)
                        const assigneeId = (t as any).assignedUserId || (t as any).assignedTo || (t as any).assignee
                        const assigneeUser = users.find(u => u.id === assigneeId)

                        // Robust Position Resolution for Assignee
                        const userAssignment = assignments.find(a => a.userId === assigneeUser?.id && a.status === 'active')
                        let position = positions.find(p => p.id === userAssignment?.positionId)
                        if (!position && assigneeUser?.position) {
                            position = positions.find(p => p.title.toLowerCase() === assigneeUser.position.toLowerCase())
                        }

                        // Robust Manager Resolution
                        let managerId = assigneeUser?.reportsTo || null
                        if (!managerId && position?.reportsToPositionId) {
                            managerId = assignments.find(a => a.positionId === position.reportsToPositionId && a.status === 'active')?.userId || null
                        }
                        const managerUser = users.find(u => u.id === managerId)

                        // Robust Manager Position Resolution
                        const managerAssignment = assignments.find(a => a.userId === managerUser?.id && a.status === 'active')
                        let managerPosition = positions.find(p => p.id === managerAssignment?.positionId)
                        if (!managerPosition && managerUser?.position) {
                            managerPosition = positions.find(p => p.title.toLowerCase() === managerUser.position.toLowerCase())
                        }

                        return {
                            id: t.id,
                            title: t.title,
                            projectName: project?.name || 'Unknown',
                            workspaceName: workspace?.name || 'Unknown',
                            assignee: assigneeUser?.name || assigneeUser?.displayName || assigneeUser?.email || t.assignedToName || 'Unassigned',
                            assigneePosition: position?.title || assigneeUser?.position || 'Employee',
                            reportsTo: managerUser?.name || managerUser?.displayName || managerUser?.email || 'N/A',
                            reportsToPosition: managerPosition?.title || managerUser?.position || 'N/A',
                            dueDate: this.parseDate(t.dueDate),
                            type: t.taskType || 'Unspecified'
                        }
                    }),
                underutilizedResources: users
                    .filter(u => !activeUsersWithTasks.has(u.id))
                    .slice(0, 20)
                    .map(u => {
                        // 1. Better Position Resolution with Fallback
                        const userAssignment = assignments.find(a => a.userId === u.id && a.status === 'active')
                        let position = positions.find(p => p.id === userAssignment?.positionId)

                        // Fallback: If no assignment found, try to match by title string
                        if (!position && u.position) {
                            position = positions.find(p => p.title.toLowerCase() === u.position.toLowerCase())
                        }

                        const orgUnit = orgUnits.find(o => o.id === position?.orgUnitId)

                        // 2. Fixed Manager Resolution Logic
                        // Priority 1: Direct reportsTo ID on user document
                        // Priority 2: Position-based hierarchy lookup
                        let managerId = u.reportsTo || null
                        if (!managerId && position?.reportsToPositionId) {
                            managerId = assignments.find(a => a.positionId === position.reportsToPositionId && a.status === 'active')?.userId || null
                        }

                        const managerUser = users.find(user => user.id === managerId)

                        // 3. Manager Position Resolution with Fallback
                        const managerAssignment = assignments.find(a => a.userId === managerUser?.id && a.status === 'active')
                        let managerPosition = positions.find(p => p.id === managerAssignment?.positionId)

                        if (!managerPosition && managerUser?.position) {
                            managerPosition = positions.find(p => p.title.toLowerCase() === managerUser.position.toLowerCase())
                        }

                        return {
                            userId: u.id,
                            name: u.displayName || u.email,
                            assignedTasks: 0,
                            positionCode: position?.code || 'N/A',
                            positionTitle: position?.title || 'Unassigned',
                            orgUnit: orgUnit?.name || u.orgUnit || u.department || 'Unassigned',
                            reportsToName: managerUser?.displayName || managerUser?.name || managerUser?.email || 'None',
                            reportsToPositionTitle: managerPosition?.title || 'N/A',
                            role: u.role || 'Member'
                        }
                    })
            },


        }
    }

    private static calculatePortfolioStatus(projects: EnhancedProject[], tasks: Task[], dateRange: ExecutiveFilters['dateRange']): PortfolioStatusData {
        const byStatus = {
            green: 0,
            yellow: 0,
            red: 0
        }

        projects.forEach(p => {
            const health = this.getProjectHealthScore(p, tasks)
            if (health >= 80) byStatus.green++
            else if (health >= 60) byStatus.yellow++
            else byStatus.red++
        })

        return {
            total: projects.length,
            byStatus,
            trend: 'stable',
            trendCount: 0
        }
    }

    private static calculateDeliveryVelocity(tasks: Task[], dateRange: ExecutiveFilters['dateRange']): DeliveryVelocityData {
        const currentPeriodStart = dateRange.start
        const currentCompletions = tasks.filter(t =>
            t.status === 'completed' &&
            this.parseDate(t.updatedAt) && this.parseDate(t.updatedAt)! >= currentPeriodStart
        ).length

        return {
            current: currentCompletions,
            periodLabel: `last ${differenceInDays(dateRange.end, dateRange.start) || 7} days`,
            trend: 'stable',
            trendPercentage: 0,
            sparklineData: []
        }
    }

    private static calculateRiskIndex(projects: EnhancedProject[]): RiskIndexData {
        const activeProjects = projects.filter(p => p.status === 'active')
        const criticalCount = activeProjects.filter(p => p.priority === 'urgent').length
        const highCount = activeProjects.filter(p => p.priority === 'high').length

        // Simple score 0-100 where higher is more risk
        const score = activeProjects.length > 0
            ? Math.min(100, ((criticalCount * 3) + (highCount * 1)) / activeProjects.length * 20)
            : 0

        return {
            score: Math.round(score),
            level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
            trend: 'stable',
            trendPercentage: 0,
            breakdown: {
                critical: criticalCount,
                high: highCount,
                medium: activeProjects.filter(p => p.priority === 'medium').length,
                low: activeProjects.filter(p => p.priority === 'low').length
            },
            riskyProjects: activeProjects
                .filter(p => p.priority === 'urgent' || p.priority === 'high')
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    priority: p.priority,
                    status: p.status,
                    healthScore: 0 // Ideally this would be calculated properly, but using 0 for now as we don't have tasks here
                }))
        }
    }

    private static calculateCriticalItems(workspaces: any[], projects: EnhancedProject[], tasks: Task[], workflows: any[]): CriticalItemsMatrix {
        const items: CriticalItem[] = []

        // 1. Process Tasks
        tasks.forEach(task => {
            if (task.status === 'completed' || task.status === 'cancelled') return

            const urgency = this.isUrgent(task) ? 'urgent' : 'not_urgent'
            const importance = this.isImportant(task) ? 'important' : 'not_important'
            const project = projects.find(p => p.id === task.projectId)
            const workspace = project ? workspaces.find(w => w.id === project.workspaceId) : null

            items.push({
                id: task.id,
                type: 'task',
                title: task.title,
                urgency,
                importance,
                quadrant: this.assignQuadrant(urgency, importance),
                metadata: {
                    dueDate: task.dueDate,
                    projectName: project?.name,
                    projectId: task.projectId,
                    workspaceName: workspace?.name,
                    workspaceId: workspace?.id,
                    assignee: task.assignedToName,
                    status: task.status
                }
            })
        })

        // 2. Process Projects (as milestones/blockers)
        projects.forEach(project => {
            if (project.status !== 'active') return
            if (project.priority !== 'urgent') return

            const urgency = 'urgent'
            const importance = 'important'

            items.push({
                id: project.id,
                type: 'milestone',
                title: `Risk: ${project.name}`,
                urgency,
                importance,
                quadrant: this.assignQuadrant(urgency, importance),
                metadata: {
                    status: project.status,
                    projectName: project.name,
                    workspaceName: workspaces.find(w => w.id === project.workspaceId)?.name,
                    workspaceId: project.workspaceId
                }
            })
        })

        return {
            urgentImportant: items.filter(i => i.quadrant === 'q1'),
            urgentNotImportant: items.filter(i => i.quadrant === 'q2'),
            notUrgentImportant: items.filter(i => i.quadrant === 'q3'),
            notUrgentNotImportant: items.filter(i => i.quadrant === 'q4')
        }
    }

    private static calculatePendingActions(
        approvalInstances: any[],
        notifications: any[],
        tasks: Task[],
        userId: string,
        workspaces: any[],
        projects: any[]
    ): ExecutiveAction[] {
        const actions: ExecutiveAction[] = []

        // 1. Map Approvals
        approvalInstances.forEach(instance => {
            const activeStage = instance.stageInstances?.find((s: any) => s.status === 'active');
            const project = instance.projectId ? projects.find(p => p.id === instance.projectId) : null;
            const workspace = project?.workspaceId ? workspaces.find(w => w.id === project.workspaceId) :
                (instance.workspaceId ? workspaces.find(w => w.id === instance.workspaceId) : null);

            actions.push({
                id: instance.id,
                type: 'approval',
                urgency: 'high',
                title: instance.resourceTitle || 'Approval Required',
                description: `${instance.approvalLineName} - Stage: ${activeStage?.stageName || 'N/A'}`,
                status: 'pending',
                resourceType: 'workflow',
                resourceId: instance.resourceId || '',
                requestedBy: instance.context?.requesterName || 'System',
                requestedAt: instance.createdAt,
                metadata: {
                    instanceId: instance.id,
                    taskId: instance.resourceId,
                    projectId: instance.projectId,
                    projectName: project?.name,
                    workspaceId: workspace?.id,
                    workspaceName: workspace?.name,
                    isDirectApproval: true
                }
            });
        });

        // 2. Map Escalations from Notifications
        notifications.forEach(n => {
            // Try to find the task to get its projectId if missing in notification
            // Check both top-level taskId and metadata.taskId
            const actualTaskId = n.taskId || n.metadata?.taskId;
            const task = actualTaskId ? tasks.find(t => t.id === actualTaskId) : null;
            const projectId = n.projectId || n.metadata?.projectId || task?.projectId;

            const project = projectId ? projects.find(p => p.id === projectId) : null;
            const workspace = project?.workspaceId ? workspaces.find(w => w.id === project.workspaceId) :
                (n.workspaceId ? workspaces.find(w => w.id === n.workspaceId) : null);

            actions.push({
                id: n.id,
                type: 'escalation',
                urgency: 'critical',
                title: n.title,
                description: n.message,
                status: 'pending',
                resourceType: 'task',
                resourceId: actualTaskId || '',
                requestedBy: 'System',
                requestedAt: n.createdAt,
                metadata: {
                    notificationId: n.id,
                    taskId: actualTaskId,
                    projectId: projectId,
                    projectName: project?.name,
                    workspaceId: workspace?.id,
                    workspaceName: workspace?.name,
                    isEscalation: true
                }
            });
        });

        return actions.sort((a, b) => {
            const dateA = new Date(a.requestedAt?.seconds ? a.requestedAt.seconds * 1000 : a.requestedAt).getTime();
            const dateB = new Date(b.requestedAt?.seconds ? b.requestedAt.seconds * 1000 : b.requestedAt).getTime();
            return dateB - dateA;
        });
    }

    private static calculateApprovalQueue(actions: ExecutiveAction[]): ApprovalQueueData {
        const approvals = actions.filter(a => a.type === 'approval')
        const escalations = actions.filter(a => a.type === 'escalation')

        return {
            total: actions.length,
            urgent: actions.filter(a => a.urgency === 'critical').length,
            byType: {
                approval: approvals.length,
                escalation: escalations.length,
                budgetApproval: 0,
                blockerResolution: 0
            },
            oldestItemDays: actions.length > 0
                ? (() => {
                    const lastAction = actions[actions.length - 1]!;
                    return differenceInDays(new Date(), this.parseDate(lastAction.requestedAt) || new Date());
                })()
                : 0
        }
    }

    // --- Helpers ---

    private static getProjectHealthScore(project: EnhancedProject, tasks: Task[]): number {
        const projectTasks = tasks.filter(t => t.projectId === project.id && t.status !== 'cancelled')

        if (projectTasks.length === 0) {
            return 0
        }

        const completedTasks = projectTasks.filter(t => t.status === 'completed').length
        return Math.round((completedTasks / projectTasks.length) * 100)
    }

    private static isUrgent(task: Task): boolean {
        if (!task.dueDate) return false
        const dueDate = this.parseDate(task.dueDate)
        if (!dueDate) return false
        return isBefore(dueDate, subDays(new Date(), -3)) || isBefore(dueDate, new Date())
    }

    private static isImportant(task: Task): boolean {
        return task.priority === 'high' || task.priority === 'urgent'
    }

    private static assignQuadrant(urgency: 'urgent' | 'not_urgent', importance: 'important' | 'not_important'): 'q1' | 'q2' | 'q3' | 'q4' {
        if (urgency === 'urgent' && importance === 'important') return 'q1'
        if (urgency === 'urgent' && importance === 'not_important') return 'q2'
        if (urgency === 'not_urgent' && importance === 'important') return 'q3'
        return 'q4'
    }

    private static parseDate(date: any): Date | null {
        if (!date) return null
        if (date instanceof Date) return date
        if (typeof date === 'string') return new Date(date)
        if (date && typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000)
        }
        return null
    }

    private static isOverdue(task: Task, referenceDate: Date = new Date()): boolean {
        if (task.status === 'completed' || task.status === 'cancelled' || !task.dueDate) return false
        const dueDate = this.parseDate(task.dueDate)
        return dueDate ? isBefore(dueDate, referenceDate) : false
    }

    private static calculateVelocityTrend(tasks: Task[]): { historical: { date: string; value: number }[]; forecast: { date: string; value: number }[]; averageVelocity: number } {
        const historical: { date: string; value: number }[] = []
        const now = new Date()

        // 1. Calculate historical (last 6 weeks)
        for (let i = 5; i >= 0; i--) {
            const weekEnd = subDays(now, i * 7)
            const weekStart = subDays(weekEnd, 6)

            const completedCount = tasks.filter(t => {
                const completedAt = this.parseDate(t.updatedAt)
                return t.status === 'completed' && completedAt && completedAt >= weekStart && completedAt <= weekEnd
            }).length

            historical.push({
                date: format(weekEnd, 'MMM d'),
                value: completedCount
            })
        }

        const averageVelocity = historical.reduce((sum, h) => sum + h.value, 0) / historical.length

        // 2. Simple forecast (next 2 weeks)
        const forecast: { date: string; value: number }[] = []
        for (let i = 1; i <= 2; i++) {
            const nextWeek = subDays(now, -i * 7)
            forecast.push({
                date: format(nextWeek, 'MMM d'),
                value: Math.round(averageVelocity)
            })
        }

        return { historical, forecast, averageVelocity }
    }

    private static calculateMilestoneForecasts(projects: EnhancedProject[], tasks: Task[]): any[] {
        const forecasts: any[] = []
        const activeProjects = projects.filter(p => p.status === 'active')

        activeProjects.forEach(project => {
            if (!project.endDate) return

            const targetDate = this.parseDate(project.endDate)
            if (!targetDate) return

            const health = this.getProjectHealthScore(project, tasks)

            // Artificial variance based on health score
            const varianceDays = health >= 90 ? 0 : health >= 75 ? 2 : health >= 60 ? 7 : 14
            const predictedDate = subDays(targetDate, -varianceDays)

            forecasts.push({
                milestoneId: project.id,
                milestoneName: project.name,
                targetDate,
                predictedDate,
                confidenceLevel: health,
                scenarios: {
                    optimistic: subDays(predictedDate, 2),
                    mostLikely: predictedDate,
                    pessimistic: subDays(predictedDate, -5)
                },
                riskFactors: health < 80 ? ['Low completion rate', 'Historical delays'] : []
            })
        })

        return forecasts.slice(0, 5) // Top 5 critical milestones
    }

    private static calculateScheduledWork(projects: EnhancedProject[], tasks: Task[]): any[] {
        const scheduled: any[] = []
        const now = new Date()
        const thirtyDaysFromNow = subDays(now, -30)

        // 1. Project Starts
        projects.forEach(p => {
            const start = this.parseDate(p.startDate)
            if (start && start >= now && start <= thirtyDaysFromNow) {
                scheduled.push({
                    id: p.id,
                    title: `Project Kickoff: ${p.name}`,
                    type: 'project_start',
                    date: start,
                    status: 'on_track',
                    projectName: p.name,
                    projectId: p.id
                })
            }
        })

        // 2. High Priority Task Deadlines
        tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').forEach(t => {
            const due = this.parseDate(t.dueDate)
            if (due && due >= now && due <= thirtyDaysFromNow) {
                const project = projects.find(p => p.id === t.projectId)
                scheduled.push({
                    id: t.id,
                    title: t.title,
                    type: 'major_task',
                    date: due,
                    status: this.isOverdue(t) ? 'delayed' : 'on_track',
                    projectName: project?.name || 'Unassigned',
                    projectId: t.projectId
                })
            }
        })

        return scheduled.sort((a, b) => a.date.getTime() - b.date.getTime())
    }
}
