import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TaskMasterDataService, type TaskType } from '@/lib/services/tasks/task-master-data-service'
import { SYSTEM_TASK_TYPES } from '@/lib/constants/task-types'

export const TASK_TYPES_QUERY_KEY = ['taskTypes'] as const

export type TaskTypeOption = { value: string; label: string; color?: string }

/** System types (from constant) + custom types from DB. Used for admin table: system rows then custom rows. */
export function useTaskTypesQuery(companyId: string | undefined, groupId?: string | null) {
  const query = useQuery({
    queryKey: [...TASK_TYPES_QUERY_KEY, companyId ?? '', groupId ?? ''],
    queryFn: async () => {
      if (!companyId) return { systemTypes: SYSTEM_TASK_TYPES, customTypes: [] as TaskType[] }
      const customTypes = await TaskMasterDataService.getAllTaskTypes(
        companyId,
        groupId ?? undefined
      )
      return { systemTypes: SYSTEM_TASK_TYPES, customTypes }
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  })

  const systemTypes = query.data?.systemTypes ?? SYSTEM_TASK_TYPES
  const customTypes = query.data?.customTypes ?? []

  /** For dropdown/select: system + active custom (excluding duplicates), sorted by order */
  const systemTypeNames = new Set(systemTypes.map((t) => t.name))
  const taskTypeOptions: TaskTypeOption[] = [
    ...systemTypes.map((t) => ({ value: t.name, label: t.name, color: t.color })),
    ...customTypes
      .filter((t) => t.isActive !== false && !systemTypeNames.has(t.name)) // Exclude duplicates
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => ({ value: t.name, label: t.name, color: t.color })),
  ]

  return {
    ...query,
    systemTypes,
    customTypes,
    taskTypeOptions,
  }
}

export function useInvalidateTaskTypes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: TASK_TYPES_QUERY_KEY })
}
