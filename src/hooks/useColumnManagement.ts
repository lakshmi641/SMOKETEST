import { useState, useEffect, useMemo } from 'react'
import type { ProjectCustomFieldWithDefinition } from '@/types/custom-field'

interface Column {
  id: string
  label: string
  type: 'standard' | 'custom'
  order: number
}

const defaultVisibleColumns = ['work', 'assignee', 'reporter', 'taskType', 'requirementType', 'priority', 'status', 'resolution', 'created', 'updated', 'dueDate']
const defaultColumnOrder = ['work', 'assignee', 'reporter', 'taskType', 'requirementType', 'priority', 'status', 'resolution', 'created', 'updated', 'dueDate']

const STORAGE_KEY_PREFIX = 'pms_project_columns_'

function loadPersistedColumns(projectId: string | undefined, customFieldIds: string[]): { visible: Set<string>; order: string[] } {
  const validOrder = defaultColumnOrder.concat(customFieldIds)
  let visible = new Set(defaultVisibleColumns)
  let order = [...defaultColumnOrder]
  if (!projectId || typeof window === 'undefined') return { visible, order }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`)
    if (!raw) return { visible, order }
    const data = JSON.parse(raw) as { visible?: string[]; order?: string[] }
    if (Array.isArray(data.order) && data.order.length > 0) {
      const filtered = data.order.filter((id: string) => validOrder.includes(id))
      const newIds = validOrder.filter(id => !filtered.includes(id))
      order = newIds.length ? [...filtered, ...newIds] : filtered
    }
    if (Array.isArray(data.visible) && data.visible.length > 0) {
      const validVisible = data.visible.filter((id: string) => validOrder.includes(id))
      if (validVisible.length > 0) visible = new Set(validVisible)
    }
  } catch {
    // ignore
  }
  return { visible, order }
}

export function useColumnManagement(projectFields: ProjectCustomFieldWithDefinition[], projectId?: string) {
  const [columnChooserOpen, setColumnChooserOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() =>
    loadPersistedColumns(projectId, projectFields.map(f => f.id)).visible
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    loadPersistedColumns(projectId, projectFields.map(f => f.id)).order
  )
  const [sortColumn, setSortColumn] = useState<{ field: string; direction: 'asc' | 'desc' } | null>({
    field: 'created',
    direction: 'desc'
  })

  // Re-load persisted columns when projectId changes (e.g. navigating to another project)
  useEffect(() => {
    if (!projectId) return
    const { visible, order } = loadPersistedColumns(projectId, projectFields.map(f => f.id))
    setVisibleColumns(visible)
    setColumnOrder(order)
  }, [projectId])

  // Persist column selection to localStorage when it changes
  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify({
        visible: Array.from(visibleColumns),
        order: columnOrder,
      }))
    } catch {
      // ignore
    }
  }, [projectId, visibleColumns, columnOrder])

  // Initialize custom fields in column order when they're loaded
  useEffect(() => {
    if (projectFields.length > 0) {
      setColumnOrder(prev => {
        const existingCustomFields = prev.filter(id => projectFields.some(f => f.id === id))
        const newCustomFields = projectFields
          .filter(f => !existingCustomFields.includes(f.id))
          .map(f => f.id)
        if (newCustomFields.length > 0) {
          return [...prev, ...newCustomFields]
        }
        return prev
      })
      // Make new custom fields visible by default
      projectFields.forEach(field => {
        setVisibleColumns(prev => {
          if (!prev.has(field.id)) {
            return new Set([...prev, field.id])
          }
          return prev
        })
      })
    }
  }, [projectFields])

  const handleToggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      const newVisible = new Set(prev)
      if (newVisible.has(columnId)) {
        newVisible.delete(columnId)
      } else {
        newVisible.add(columnId)
      }
      return newVisible
    })
  }

  const handleReorderColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumnOrder(prev => {
      const newOrder = [...prev]
      const currentIndex = newOrder.indexOf(columnId)
      if (currentIndex === -1) return prev

      if (direction === 'up' && currentIndex > 0) {
        const temp = newOrder[currentIndex]
        const prevItem = newOrder[currentIndex - 1]
        if (temp && prevItem) {
          newOrder[currentIndex] = prevItem
          newOrder[currentIndex - 1] = temp
        }
      } else if (direction === 'down' && currentIndex < newOrder.length - 1) {
        const temp = newOrder[currentIndex]
        const nextItem = newOrder[currentIndex + 1]
        if (temp && nextItem) {
          newOrder[currentIndex] = nextItem
          newOrder[currentIndex + 1] = temp
        }
      }
      return newOrder
    })
  }

  const handleSort = (field: string) => {
    setSortColumn(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { field, direction: 'asc' }
    })
  }

  // Build columns list for column chooser
  const allColumns = useMemo(() => {
    const standardCols = [
      { id: 'work', label: 'Task', type: 'standard' as const, order: 0 },
      { id: 'assignee', label: 'Assignee', type: 'standard' as const, order: 1 },
      { id: 'reporter', label: 'Reporter', type: 'standard' as const, order: 2 },
      { id: 'taskType', label: 'Task type', type: 'standard' as const, order: 3 },
      { id: 'requirementType', label: 'Requirement type', type: 'standard' as const, order: 4 },
      { id: 'priority', label: 'Priority', type: 'standard' as const, order: 5 },
      { id: 'status', label: 'Status', type: 'standard' as const, order: 6 },
      { id: 'resolution', label: 'Resolution', type: 'standard' as const, order: 7 },
      { id: 'created', label: 'Created', type: 'standard' as const, order: 8 },
      { id: 'updated', label: 'Updated', type: 'standard' as const, order: 9 },
      { id: 'dueDate', label: 'Due date', type: 'standard' as const, order: 10 },
    ]

    const customCols = projectFields.map((field, index) => ({
      id: field.id,
      label: field.definition.name,
      type: 'custom' as const,
      order: 11 + index,
    }))

    // Merge and sort by current order
    const all = [...standardCols, ...customCols]
    return all.sort((a, b) => {
      const aIndex = columnOrder.indexOf(a.id)
      const bIndex = columnOrder.indexOf(b.id)
      if (aIndex === -1 && bIndex === -1) return a.order - b.order
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [projectFields, columnOrder])

  // Get ordered visible columns
  const visibleOrderedColumns = useMemo(() => {
    return columnOrder.filter(colId => visibleColumns.has(colId))
  }, [columnOrder, visibleColumns])

  return {
    columnChooserOpen,
    setColumnChooserOpen,
    visibleColumns,
    sortColumn,
    allColumns,
    visibleOrderedColumns,
    handleToggleColumn,
    handleReorderColumn,
    handleSort,
  }
}

