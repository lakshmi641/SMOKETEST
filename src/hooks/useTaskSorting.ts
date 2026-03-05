import { useMemo } from 'react'
import type { GeneratedTask } from '@/types/task-template-schema'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'

export function useTaskSorting(
  tasks: GeneratedTask[],
  sortState: { fieldId: string; direction: 'asc' | 'desc' } | null,
  projectFields: ProjectCustomFieldWithDefinition[]
) {
  const sortedTasks = useMemo(() => {
    // Apply sorting if sortState is set
    const sorted = [...tasks]
    if (sortState) {
      const sortField = projectFields.find(pf => pf.id === sortState.fieldId)
      if (sortField) {
        sorted.sort((a, b) => {
          const aValue = a.customFields?.[sortField.id]
          const bValue = b.customFields?.[sortField.id]

          // Handle null/undefined values - put them at the end
          const aHasValue = aValue !== null && aValue !== undefined
          const bHasValue = bValue !== null && bValue !== undefined

          if (!aHasValue && !bHasValue) return 0
          if (!aHasValue) return 1
          if (!bHasValue) return -1

          let comparison = 0

          // Sort based on field type
          switch (sortField.definition.type) {
            case 'number':
              comparison = (aValue as number) - (bValue as number)
              break
            case 'date':
              const aDate = new Date(aValue as string).getTime()
              const bDate = new Date(bValue as string).getTime()
              if (isNaN(aDate) && isNaN(bDate)) comparison = 0
              else if (isNaN(aDate)) comparison = 1
              else if (isNaN(bDate)) comparison = -1
              else comparison = aDate - bDate
              break
            case 'text':
              comparison = String(aValue).localeCompare(String(bValue))
              break
            case 'single':
              // Sort by option label if available
              const aOption = sortField.definition.options?.find(opt => opt.id === aValue)
              const bOption = sortField.definition.options?.find(opt => opt.id === bValue)
              const aLabel = aOption?.label || String(aValue)
              const bLabel = bOption?.label || String(bValue)
              comparison = aLabel.localeCompare(bLabel)
              break
            case 'multi':
              // Sort by first selected option label
              const aIds = Array.isArray(aValue) ? aValue : []
              const bIds = Array.isArray(bValue) ? bValue : []
              if (aIds.length === 0 && bIds.length === 0) comparison = 0
              else if (aIds.length === 0) comparison = 1
              else if (bIds.length === 0) comparison = -1
              else {
                const aFirstOption = sortField.definition.options?.find(opt => opt.id === aIds[0])
                const bFirstOption = sortField.definition.options?.find(opt => opt.id === bIds[0])
                const aFirstLabel = aFirstOption?.label || ''
                const bFirstLabel = bFirstOption?.label || ''
                comparison = aFirstLabel.localeCompare(bFirstLabel)
              }
              break
            case 'people':
              // Sort by first selected user ID (alphabetical)
              const aPeopleIds = Array.isArray(aValue) ? aValue : (aValue ? [aValue] : [])
              const bPeopleIds = Array.isArray(bValue) ? bValue : (bValue ? [bValue] : [])
              if (aPeopleIds.length === 0 && bPeopleIds.length === 0) comparison = 0
              else if (aPeopleIds.length === 0) comparison = 1
              else if (bPeopleIds.length === 0) comparison = -1
              else {
                comparison = String(aPeopleIds[0]).localeCompare(String(bPeopleIds[0]))
              }
              break
            default:
              comparison = String(aValue).localeCompare(String(bValue))
          }

          return sortState.direction === 'asc' ? comparison : -comparison
        })
      }
    }
    return sorted
  }, [tasks, sortState, projectFields])

  return sortedTasks
}

