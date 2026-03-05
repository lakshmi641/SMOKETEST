import { useState, useEffect, useCallback } from 'react'
import { ExecutiveDashboardService } from '@/lib/services/executive-dashboard'
import { useWorkspacesQuery } from '@/hooks/queries/useWorkspaceQueries'
import { useProjectsQuery } from '@/hooks/queries/useProjectQueries'
import type { ExecutiveDashboardData, ExecutiveFilters } from '@/types/executive-dashboard'

interface UseExecutiveDashboardDataProps {
    companyId: string
    userId: string
    groupId?: string | null
    viewScope: ExecutiveFilters['viewScope']
    dateRange: ExecutiveFilters['dateRange']
}

export function useExecutiveDashboardData({
    companyId,
    userId,
    groupId,
    viewScope,
    dateRange
}: UseExecutiveDashboardDataProps) {
    const [data, setData] = useState<ExecutiveDashboardData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const [hasNewData, setHasNewData] = useState(false)

    const effectiveGroupId = groupId ?? companyId

    const workspacesQuery = useWorkspacesQuery(
        effectiveGroupId ?? undefined,
        companyId || undefined
    )
    const projectsQuery = useProjectsQuery(companyId || undefined, groupId ?? undefined, userId)

    const hasWorkspaceAndProjectData =
        workspacesQuery.isSuccess &&
        projectsQuery.isSuccess &&
        workspacesQuery.data !== undefined &&
        projectsQuery.data !== undefined

    const fetchData = useCallback(async () => {
        if (!companyId || !userId || !hasWorkspaceAndProjectData) return

        try {
            setIsLoading(true)
            setError(null)
            const result = await ExecutiveDashboardService.getDashboardData(
                effectiveGroupId,
                companyId,
                userId,
                { viewScope, dateRange },
                {
                    workspaces: workspacesQuery.data ?? [],
                    projects: projectsQuery.data ?? []
                }
            )
            setData(result)
        } catch (err) {
            console.error('Error fetching executive dashboard data:', err)
            setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'))
        } finally {
            setIsLoading(false)
        }
    }, [companyId, userId, groupId, viewScope, dateRange, hasWorkspaceAndProjectData, workspacesQuery.data, projectsQuery.data])

    useEffect(() => {
        if (hasWorkspaceAndProjectData) {
            fetchData()
        } else {
            setData(null)
            setError(null)
            if (!workspacesQuery.isLoading && !projectsQuery.isLoading && (workspacesQuery.isError || projectsQuery.isError)) {
                setError(new Error('Failed to load workspaces or projects'))
            }
        }
    }, [fetchData, hasWorkspaceAndProjectData, workspacesQuery.isLoading, projectsQuery.isLoading, workspacesQuery.isError, projectsQuery.isError])

    const queryError =
        workspacesQuery.error || projectsQuery.error
            ? (workspacesQuery.error instanceof Error ? workspacesQuery.error : projectsQuery.error instanceof Error ? projectsQuery.error : new Error('Failed to load dashboard data'))
            : null

    return {
        data,
        isLoading: workspacesQuery.isLoading || projectsQuery.isLoading || isLoading,
        error: error ?? queryError,
        refresh: () => {
            workspacesQuery.refetch()
            projectsQuery.refetch()
            if (hasWorkspaceAndProjectData) fetchData()
        },
        hasNewData
    }
}
