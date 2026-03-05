import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserService } from '@/lib/services'
import type { User } from '@/types'
import toast from 'react-hot-toast'

export function useUsersQuery(
    companyId: string | undefined,
    groupId?: string | null,
    options?: { mergeCompanyProfiles?: boolean; initialData?: User[] }
) {
    return useQuery({
        queryKey: ['users', companyId, groupId ?? '', options?.mergeCompanyProfiles ?? false],
        queryFn: async () => {
            if (!companyId) return []
            return UserService.getUsers(companyId, groupId ?? undefined, {
                mergeCompanyProfiles: options?.mergeCompanyProfiles
            })
        },
        enabled: !!companyId,
        staleTime: 5 * 60 * 1000,
        initialData: options?.initialData
    })
}

export function useUserMutations(companyId: string | undefined, groupId?: string | null) {
    const queryClient = useQueryClient()

    const createUser = useMutation({
        mutationFn: (data: any) =>
            UserService.createUser(companyId!, data, groupId != null && groupId !== '' ? { groupId } : undefined),
        onSuccess: (newUser) => {
            queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })
            window.dispatchEvent(new CustomEvent('user-created', { detail: { userId: newUser.id } }))
        },
        onError: (error) => {
            console.error('Error creating user:', error)
            toast.error('Failed to create user')
        }
    })

    const deleteUser = useMutation({
        mutationFn: (userId: string) => UserService.deleteUser(companyId!, userId, groupId ?? undefined),
        onSuccess: (_, userId) => {
            queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })
            window.dispatchEvent(new CustomEvent('user-deleted', { detail: { userId } }))
        },
        onError: (error) => {
            console.error('Error deleting user:', error)
            toast.error('Failed to delete user')
        }
    })

    const updateUser = useMutation({
        mutationFn: ({ userId, data }: { userId: string, data: any }) =>
            UserService.updateUser(companyId!, userId, data, undefined, groupId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })
        },
        onError: (error) => {
            console.error('Error updating user:', error)
            toast.error('Failed to update user')
        }
    })

    return { createUser, deleteUser, updateUser }
}
