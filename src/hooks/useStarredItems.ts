'use client'

import { useState, useEffect, useCallback } from 'react'
import { StarredItemsService } from '@/lib/services/starred-items'
import type { StarredItemsMap } from '@/types/starred-items'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { toast } from 'react-hot-toast'

export function useStarredItems() {
    const { user } = useAuthStore()
    const { groupId, companyId } = useCompany()
    const [starredItems, setStarredItems] = useState<StarredItemsMap>({
        tasks: new Set(),
        projects: new Set(),
        workspaces: new Set()
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!groupId || !companyId || !user?.id) {
            setLoading(false)
            return
        }

        const loadStarredItems = async () => {
            try {
                const items = await StarredItemsService.getUserStarredItems(groupId, companyId, user.id)
                setStarredItems(items)
            } catch (error) {
                console.error('Error loading starred items:', error)
                toast.error('Failed to load starred items')
            } finally {
                setLoading(false)
            }
        }

        loadStarredItems()
    }, [groupId, companyId, user?.id])

    const toggleStarred = useCallback(
        async (
            entityType: 'task' | 'project' | 'workspace',
            entityId: string
        ) => {
            if (!groupId || !companyId || !user?.id) {
                toast.error('You must be logged in to star items')
                return
            }

            const key = `${entityType}s` as keyof StarredItemsMap
            let isNowStarred = false

            setStarredItems(prev => {
                const newSet = new Set(prev[key])
                if (newSet.has(entityId)) {
                    newSet.delete(entityId)
                    isNowStarred = false
                } else {
                    newSet.add(entityId)
                    isNowStarred = true
                }

                return {
                    ...prev,
                    [key]: newSet
                }
            })

            try {
                const result = await StarredItemsService.toggleStarred(
                    groupId,
                    companyId,
                    user.id,
                    entityType,
                    entityId
                )

                // Re-sync with server result if needed (though toggleStarred returns the new state)
                if (result !== isNowStarred) {
                    setStarredItems(prev => {
                        const newSet = new Set(prev[key])
                        if (result) newSet.add(entityId)
                        else newSet.delete(entityId)
                        return { ...prev, [key]: newSet }
                    })
                }

                toast.success(result ? 'Item starred' : 'Item unstarred')
            } catch (error) {
                console.error('Error toggling starred:', error)
                toast.error('Failed to update starred status')

                // Rollback on error
                setStarredItems(prev => {
                    const newSet = new Set(prev[key])
                    if (isNowStarred) newSet.delete(entityId)
                    else newSet.add(entityId)
                    return {
                        ...prev,
                        [key]: newSet
                    }
                })
            }
        },
        [groupId, companyId, user?.id]
    )

    const isStarred = useCallback(
        (entityType: 'task' | 'project' | 'workspace', entityId: string) => {
            const key = `${entityType}s` as keyof StarredItemsMap
            return starredItems[key]?.has(entityId) || false
        },
        [starredItems]
    )

    return {
        starredItems,
        loading,
        toggleStarred,
        isStarred
    }
}
