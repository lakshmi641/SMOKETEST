'use client'

import { useState, useEffect, useCallback } from 'react'
import { RecentlyViewedService, type RecentlyViewedProject, type RecentlyViewedWorkspace } from '@/lib/services/recently-viewed-service'
import { useAuthStore } from '@/store/authStore'
import { useCompanyId } from '@/contexts/CompanyContext'
import { useCompany } from '@/contexts/CompanyContext'

export function useRecentlyViewed() {
    const { user } = useAuthStore()
    const { companyId, groupId } = useCompany() // Extracted groupId
    const { currentCompanyUser } = useCompany()
    const [recentProjects, setRecentProjects] = useState<RecentlyViewedProject[]>([])
    const [recentWorkspaces, setRecentWorkspaces] = useState<RecentlyViewedWorkspace[]>([])
    const [loading, setLoading] = useState(true)

    const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'

    // Load recently viewed items on mount
    useEffect(() => {
        if (!companyId || !user?.id) {
            setLoading(false)
            return
        }

        const loadRecentlyViewed = async () => {
            try {
                const [projects, workspaces] = await Promise.all([
                    RecentlyViewedService.getRecentlyViewedProjects(companyId, user.id, isGlobalAdmin, 3, groupId || undefined),
                    RecentlyViewedService.getRecentlyViewedWorkspaces(companyId, user.id, isGlobalAdmin, 3, groupId || undefined)
                ])
                setRecentProjects(projects)
                setRecentWorkspaces(workspaces)
            } catch (error) {
                console.error('Error loading recently viewed items:', error)
            } finally {
                setLoading(false)
            }
        }

        loadRecentlyViewed()
    }, [companyId, user?.id, isGlobalAdmin, groupId])

    const trackProjectView = useCallback(
        async (project: { id: string; name: string; color?: string }) => {
            if (!companyId || !user?.id) return

            try {
                await RecentlyViewedService.trackProjectView(companyId, user.id, project, groupId || undefined)
                // Refresh the list
                const projects = await RecentlyViewedService.getRecentlyViewedProjects(companyId, user.id, isGlobalAdmin, 3, groupId || undefined)
                setRecentProjects(projects)
            } catch (error) {
                console.error('Error tracking project view:', error)
            }
        },
        [companyId, user?.id, isGlobalAdmin, groupId]
    )

    const trackWorkspaceView = useCallback(
        async (workspace: { id: string; name: string; color?: string }) => {
            if (!companyId || !user?.id) return

            try {
                await RecentlyViewedService.trackWorkspaceView(companyId, user.id, workspace, groupId || undefined)
                // Refresh the list
                const workspaces = await RecentlyViewedService.getRecentlyViewedWorkspaces(companyId, user.id, isGlobalAdmin, 3, groupId || undefined)
                setRecentWorkspaces(workspaces)
            } catch (error) {
                console.error('Error tracking workspace view:', error)
            }
        },
        [companyId, user?.id, isGlobalAdmin, groupId]
    )

    return {
        recentProjects,
        recentWorkspaces,
        loading,
        trackProjectView,
        trackWorkspaceView
    }
}
