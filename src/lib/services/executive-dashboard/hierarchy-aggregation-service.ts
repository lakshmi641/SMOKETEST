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
import { isBefore } from 'date-fns'
import type {
    OrgHierarchyNode,
    ExecutiveFilters
} from '@/types/executive-dashboard'
import type { EnhancedProject } from '@/types/project-schema'
import type { GeneratedTask as Task } from '@/types/task-template-schema'

export class HierarchyAggregationService {
    /**
     * Builds a hierarchical tree from flat lists of workspaces, projects, and tasks.
     * Structure: Organization -> Workspaces -> Projects -> Tasks (Count)
     */
    static buildOrgHierarchy(
        workspaces: any[],
        projects: EnhancedProject[],
        tasks: Task[],
        dateRange: ExecutiveFilters['dateRange'],
        users: any[] = []
    ): OrgHierarchyNode {

        // 1. Build Workspace nodes
        const workspaceNodes: OrgHierarchyNode[] = workspaces.map(ws => {
            const wsProjects = projects.filter(p => p.workspaceId === ws.id)
            const wsTasks = tasks.filter(t => wsProjects.some(p => p.id === t.projectId))

            // Calculate Workspace health (average of project health)
            const projectScores = wsProjects.map(p => this.getProjectHealthScore(p, tasks, dateRange))
            const avgHealth = projectScores.length > 0
                ? projectScores.reduce((a, b) => a + b, 0) / projectScores.length
                : 100

            // 2. Build Project nodes for this workspace
            const projectNodes: OrgHierarchyNode[] = wsProjects.map(p => {
                const projectTasks = tasks.filter(t => t.projectId === p.id)
                const health = this.getProjectHealthScore(p, tasks, dateRange)

                // Resolve Manager Name (Creator-based resolution)
                // We use createdBy primarily, falling back to manager
                const targetManagerId = (p as any).createdBy || p.manager
                const manager = users.find(u => u.id === targetManagerId)
                const managerName = manager ? manager.name : 'Project Manager'

                return {
                    id: p.id,
                    type: 'project',
                    name: p.name,
                    value: projectTasks.length || 1, // Size based on task count
                    health: this.scoreToRAG(health),
                    healthScore: health,
                    metadata: {
                        totalTasks: projectTasks.length,
                        completedTasks: projectTasks.filter(t => t.status === 'completed').length,
                        overdueCount: projectTasks.filter(t => this.isOverdue(t, dateRange.end)).length,
                        progress: p.progress,
                        managerId: targetManagerId || '',
                        managerName: managerName
                    }
                }
            })

            return {
                id: ws.id,
                type: 'workspace',
                name: ws.name || 'Unnamed Workspace',
                value: wsTasks.length || 1,
                health: this.scoreToRAG(avgHealth),
                healthScore: avgHealth,
                children: projectNodes,
                metadata: {
                    totalTasks: wsTasks.length,
                    completedTasks: wsTasks.filter(t => t.status === 'completed').length,
                    overdueCount: wsTasks.filter(t => this.isOverdue(t, dateRange.end)).length,
                    activeProjects: wsProjects.filter(p => p.status === 'active').length
                }
            }
        })

        // 3. Roll up to Organization
        const totalTasks = tasks.length
        const orgHealth = workspaceNodes.length > 0
            ? workspaceNodes.reduce((sum, node) => sum + node.healthScore, 0) / workspaceNodes.length
            : 100

        return {
            id: 'org-root',
            type: 'organization',
            name: 'Total Organization',
            value: totalTasks,
            health: this.scoreToRAG(orgHealth),
            healthScore: orgHealth,
            children: workspaceNodes,
            metadata: {
                totalTasks,
                completedTasks: tasks.filter(t => t.status === 'completed').length,
                overdueCount: tasks.filter(t => this.isOverdue(t, dateRange.end)).length,
                activeProjects: projects.filter(p => p.status === 'active').length
            }
        }
    }

    private static getProjectHealthScore(project: EnhancedProject, tasks: Task[], dateRange: ExecutiveFilters['dateRange']): number {
        const projectTasks = tasks.filter(t => t.projectId === project.id)
        if (projectTasks.length === 0) return project.progress || 0

        const completedTasks = projectTasks.filter(t => t.status === 'completed').length
        const taskBasedProgress = Math.round((completedTasks / projectTasks.length) * 100)

        return Math.max(project.progress || 0, taskBasedProgress)
    }

    private static scoreToRAG(score: number): 'green' | 'yellow' | 'red' {
        if (score >= 80) return 'green'
        if (score >= 60) return 'yellow'
        return 'red'
    }

    private static isOverdue(task: Task, referenceDate: Date): boolean {
        if (task.status === 'completed' || !task.dueDate) return false
        const dueDate = this.parseDate(task.dueDate)
        return dueDate ? isBefore(dueDate, referenceDate) : false
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
}
