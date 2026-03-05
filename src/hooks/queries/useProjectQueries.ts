import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProjectService } from '@/lib/services'
import type { EnhancedProject } from '@/types/project-schema'
import toast from 'react-hot-toast'

export function useProjectsQuery(
    companyId: string | undefined,
    groupId?: string | null,
    userId?: string,
    isAdmin?: boolean,
    initialData?: EnhancedProject[]
) {
    if (process.env.NODE_ENV === 'development' && !userId && !isAdmin) {
        console.warn(
            '[useProjectsQuery] userId was not provided. ' +
            'This will return an empty project list for non-admin users. ' +
            'Pass the current user\'s ID to enable project-level access filtering.'
        )
    }
    return useQuery({
        queryKey: ['projects', groupId ?? companyId, companyId, userId, isAdmin],
        queryFn: async () => {
            if (!companyId) return []
            // Multi-org: pass groupId + companyId so we read from enterprise path
            if (groupId) {
                return ProjectService.getProjects(groupId, companyId, {
                    userId,
                    isGlobalAdmin: isAdmin
                })
            }
            return ProjectService.getProjects(companyId, {
                userId,
                isGlobalAdmin: isAdmin
            })
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        initialData
    })
}

export function useProjectMutations(companyId: string | undefined, groupId?: string | null) {
    const queryClient = useQueryClient()

    const createProject = useMutation({
        mutationFn: (data: any) =>
            ProjectService.createProject(companyId!, data, groupId ? { groupId } : undefined),
        onSuccess: (projectId) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['workspaces'] })
            window.dispatchEvent(new CustomEvent('project-created', { detail: { projectId } }))
        },
        onError: (error) => {
            console.error('Error creating project:', error)
            toast.error('Failed to create project')
        }
    })

    const deleteProject = useMutation({
        mutationFn: (projectId: string) =>
            ProjectService.deleteProject(companyId!, projectId, groupId ? { groupId } : undefined),
        onSuccess: (_, projectId) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['workspaces'] })
            window.dispatchEvent(new CustomEvent('project-deleted', { detail: { projectId } }))
        },
        onError: (error) => {
            console.error('Error deleting project:', error)
            toast.error('Failed to delete project')
        }
    })

    const updateProject = useMutation({
        mutationFn: ({ projectId, data }: { projectId: string, data: any }) =>
            ProjectService.updateProject(companyId!, projectId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        },
        onError: (error) => {
            console.error('Error updating project:', error)
            toast.error('Failed to update project')
        }
    })

    return { createProject, deleteProject, updateProject }
}
