import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ProjectTypeService, type ProjectTypeRow } from '@/lib/services/project-type-service'

export const PROJECT_TYPES_QUERY_KEY = ['projectTypes'] as const

export type ProjectTypeOption = { value: string; label: string }

/** System + custom project types from DB. Rows for admin table; options for dropdowns. */
export function useProjectTypesQuery(companyId: string | undefined, groupId?: string | null) {
  const query = useQuery({
    queryKey: [...PROJECT_TYPES_QUERY_KEY, companyId ?? '', groupId ?? ''],
    queryFn: async () => {
      if (!companyId) return []
      return ProjectTypeService.getAllProjectTypeRows(companyId, groupId ?? undefined)
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  })

  const projectTypeRows: ProjectTypeRow[] = query.data ?? []

  /** For dropdown/select: system + active custom */
  const projectTypeOptions: ProjectTypeOption[] = projectTypeRows
    .filter((row) => row.source === 'system' || (row.source === 'custom' && row.isActive !== false))
    .map((row) => ({ value: row.code, label: row.name }))

  return {
    ...query,
    projectTypeRows,
    projectTypeOptions,
  }
}

export function useInvalidateProjectTypes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PROJECT_TYPES_QUERY_KEY })
}
