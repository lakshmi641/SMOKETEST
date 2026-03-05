import { Position, PositionAssignment } from '@/types/org-schema'
import type { EnhancedProject } from '@/types/project-schema'
import { GeneratedTask as Task } from '@/types/task-template-schema'

export class ScopeFilterService {
    /**
     * Main entry point to filter raw dashboard data
     */
    static async applyFilter(
        data: {
            workspaces: any[],
            projects: EnhancedProject[],
            tasks: Task[],
            workflowInstances: any[],
            users: any[]
        },
        userId: string,
        positions: Position[],
        assignments: PositionAssignment[]
    ) {
        // 1. Find user's current active position
        const myAssignment = assignments.find(a => a.userId === userId && a.status === 'active')
        if (!myAssignment) return data

        // 2. Get user's own position + all subordinate positions (recursive)
        const positionsToInclude = [
            myAssignment.positionId,
            ...this.getSubordinatePositions(myAssignment.positionId, positions)
        ]

        // 3. Get User IDs of everyone in those positions
        const userIdsInScope = assignments
            .filter(a => positionsToInclude.includes(a.positionId) && a.status === 'active')
            .map(a => a.userId)

        // 4. Perform Multi-Level Filtering
        // Filter Workspaces: Show if any scope user is an owner, member, or creator
        const filteredWorkspaces = data.workspaces.filter(ws => {
            const admins = ws.adminIds || []
            const ownerId = ws.ownerId || (Array.isArray(admins) && admins.length > 0 ? admins[0] : null)
            const members = ws.members || ws.memberIds || ws.spocIds || []

            return (
                userIdsInScope.includes(ownerId) ||
                userIdsInScope.includes(ws.createdBy) ||
                (Array.isArray(members) && members.some((id: string) => userIdsInScope.includes(id))) ||
                (Array.isArray(admins) && admins.some((id: string) => userIdsInScope.includes(id)))
            )
        })

        const workspaceIds = filteredWorkspaces.map(ws => ws.id)

        // Filter Projects: Based on filtered workspaces
        const filteredProjects = data.projects.filter(p => workspaceIds.includes(p.workspaceId))
        const projectIds = filteredProjects.map(p => p.id)

        // Filter Tasks: Based on filtered projects
        const filteredTasks = data.tasks.filter(t => projectIds.includes(t.projectId))

        // Filter Workflow Instances: Based on filtered projects/tasks
        const filteredWorkflowInstances = data.workflowInstances.filter(wi =>
            (wi.resourceType === 'project' && projectIds.includes(wi.resourceId)) ||
            (wi.resourceType === 'task' && filteredTasks.some(t => t.id === wi.resourceId))
        )

        // Filter Users: Show subordinates for resource charts
        const filteredUsers = data.users.filter(u => userIdsInScope.includes(u.id))

        return {
            workspaces: filteredWorkspaces,
            projects: filteredProjects,
            tasks: filteredTasks,
            workflowInstances: filteredWorkflowInstances,
            users: filteredUsers
        }
    }

    private static getSubordinatePositions(positionId: string, positions: Position[]): string[] {
        const subordinates: string[] = []
        function collect(parentId: string) {
            const reports = positions.filter(p => p.reportsToPositionId === parentId)
            for (const r of reports) {
                subordinates.push(r.id)
                collect(r.id)
            }
        }
        collect(positionId)
        return subordinates
    }
}
