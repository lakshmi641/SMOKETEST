import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WorkspaceService, ProjectService } from '@/lib/services'
import { collection, getDocs } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import { useAuthStore } from '@/store/authStore'
import type { Workspace } from '@/types/workspace-schema'
import type { GeneratedTask } from '@/types/task-template-schema'
import toast from 'react-hot-toast'

export interface WorkspaceWithMetrics extends Workspace {
    totalProjects?: number
    activeProjects?: number
    totalTasks?: number
    completedTasks?: number
}

export function useWorkspacesQuery(groupId: string | undefined, companyId: string | undefined, initialData?: Workspace[]) {
    const { user: authUser, loading: authLoading } = useAuthStore()

    return useQuery({
        queryKey: ['workspaces', groupId, companyId],
        queryFn: async () => {
            if (!groupId || !companyId) {
                console.log('[useWorkspacesQuery] groupId or companyId missing')
                return []
            }

            try {
                const db = getFirestoreInstance()

                const workspacesData = await WorkspaceService.getWorkspaces(groupId, companyId, { status: 'active' })

                // Pass userId to get projects the user has access to, or isGlobalAdmin to get all
                const projectsData = await ProjectService.getProjects(groupId, companyId, {
                    userId: authUser?.id,
                    isGlobalAdmin: true // Show all projects for workspace metrics
                }).catch((err) => {
                    console.error('[useWorkspacesQuery] Error fetching projects:', err)
                    return []
                })
                console.log('[useWorkspacesQuery] Fetched projects:', projectsData.length, 'Sample project workspaceIds:', projectsData.slice(0, 3).map((p: any) => ({ id: p.id, workspaceId: p.workspaceId })))

                let allTasks: GeneratedTask[] = []
                try {
                    const tasksPath = companySubcollectionPathSegments(groupId, companyId, 'tasks')
                    const tasksSnapshot = await getDocs(collection(db, ...(tasksPath as [string, ...string[]])))
                    allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GeneratedTask[]
                    console.log('[useWorkspacesQuery] Fetched tasks:', allTasks.length)
                } catch (taskError: any) {
                    // Handle permission errors gracefully
                    if (taskError.code === 'permission-denied' || taskError.message?.includes('permission')) {
                        console.log('[useWorkspacesQuery] Tasks query permission denied (expected for some users)')
                    } else {
                        console.error('[useWorkspacesQuery] Error fetching tasks:', taskError)
                    }
                    // Continue with empty tasks array
                }

                // Calculate metrics for each workspace
                const workspacesWithMetrics = workspacesData.map(workspace => {
                    // Filter projects by workspaceId
                    const workspaceProjects = projectsData.filter((p: any) => p.workspaceId === workspace.id)
                    const activeProjects = workspaceProjects.filter((p: any) => p.status === 'active')

                    // Filter tasks by workspaceId directly (more reliable) OR by projectId
                    const workspaceTasks = allTasks.filter(t =>
                        t.workspaceId === workspace.id ||
                        workspaceProjects.some(p => p.id === t.projectId)
                    )
                    const completedTasks = workspaceTasks.filter(t => t.status === 'completed').length

                    return {
                        ...workspace,
                        totalProjects: workspaceProjects.length,
                        activeProjects: activeProjects.length,
                        totalTasks: workspaceTasks.length,
                        completedTasks: completedTasks,
                    }
                })

                console.log('[useWorkspacesQuery] Returning workspaces with metrics:', workspacesWithMetrics.length)
                return workspacesWithMetrics
            } catch (error) {
                console.error('[useWorkspacesQuery] Fatal error in workspace query:', error)
                // Return empty array on error to prevent UI from breaking
                return []
            }
        },
        enabled: !!groupId && !!companyId && !authLoading && !!authUser,
        staleTime: 5 * 60 * 1000, // 5 minutes
        initialData: initialData as WorkspaceWithMetrics[]
    })
}

export function useWorkspaceMutations(groupId: string | undefined, companyId: string | undefined) {
    const queryClient = useQueryClient()

    const createWorkspace = useMutation({
        mutationFn: (data: any) => WorkspaceService.createWorkspace(groupId!, companyId!, data),
        onSuccess: (workspaceId) => {
            queryClient.invalidateQueries({ queryKey: ['workspaces', groupId, companyId] })
            window.dispatchEvent(new CustomEvent('workspace-created', { detail: { workspaceId } }))
        },
        onError: (error: any) => {
            console.error('Error creating workspace:', error)
            const msg = error?.code === 'permission-denied' || error?.message?.includes('permission')
                ? 'You don’t have permission to create workspaces in this company. If you just switched companies, try refreshing the page.'
                : 'Failed to create workspace'
            toast.error(msg)
        }
    })

    const deleteWorkspace = useMutation({
        mutationFn: (workspaceId: string) => WorkspaceService.deleteWorkspace(groupId!, companyId!, workspaceId),
        onSuccess: (_, workspaceId) => {
            queryClient.invalidateQueries({ queryKey: ['workspaces', groupId, companyId] })
            window.dispatchEvent(new CustomEvent('workspace-deleted', { detail: { workspaceId } }))
        },
        onError: (error) => {
            console.error('Error deleting workspace:', error)
            toast.error('Failed to delete workspace')
        }
    })

    const updateWorkspace = useMutation({
        mutationFn: ({ workspaceId, data }: { workspaceId: string, data: any }) =>
            WorkspaceService.updateWorkspace(groupId!, companyId!, workspaceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces', groupId, companyId] })
        },
        onError: (error) => {
            console.error('Error updating workspace:', error)
            toast.error('Failed to update workspace')
        }
    })

    return { createWorkspace, deleteWorkspace, updateWorkspace }
}
