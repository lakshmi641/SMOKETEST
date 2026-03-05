'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CustomFieldService } from '@/lib/services/custom-field-service'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/hooks/useCompany'
import type {
  CustomFieldDefinition,
  ProjectCustomFieldWithDefinition,
  CustomFieldValue,
  AggregationType
} from '@/types/custom-field'

interface UseProjectCustomFieldsReturn {
  // Data
  definitions: CustomFieldDefinition[]
  projectFields: ProjectCustomFieldWithDefinition[]
  loading: boolean
  error: Error | null

  // Actions
  refresh: () => Promise<void>
  createDefinition: (
    data: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'>,
    addToLibrary: boolean
  ) => Promise<string>
  updateDefinition: (fieldId: string, data: Partial<CustomFieldDefinition>) => Promise<void>
  archiveDefinition: (fieldId: string) => Promise<void>
  enableField: (fieldId: string, order: number) => Promise<void>
  disableField: (fieldId: string) => Promise<void>
  reorderFields: (orders: Array<{ fieldId: string; order: number }>) => Promise<void>
  updateAggregation: (fieldId: string, aggregation: AggregationType) => Promise<void>
  updateTaskValue: (taskId: string, fieldId: string, value: CustomFieldValue) => Promise<void>
  updateProjectValue: (fieldId: string, value: CustomFieldValue, verificationStatus?: 'pending' | 'verified' | 'rejected') => Promise<void>
}

/**
 * Hook to manage custom fields for a project
 * 
 * @param projectId Project ID
 * @param companyId Company ID
 * @returns Custom fields data and mutation functions
 * 
 * @example
 * ```tsx
 * const { projectFields, loading, enableField } = useProjectCustomFields(projectId, companyId)
 * 
 * await enableField(fieldId, order)
 * ```
 */
export function useProjectCustomFields(
  projectId: string | null,
  companyId: string | null
): UseProjectCustomFieldsReturn {
  const { user } = useAuthStore()
  const { groupId } = useCompany()
  const userId = user?.id || ''

  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [projectFields, setProjectFields] = useState<ProjectCustomFieldWithDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Track optimistic updates for rollback
  const previousStateRef = useRef<{
    definitions: CustomFieldDefinition[]
    projectFields: ProjectCustomFieldWithDefinition[]
  } | null>(null)

  /**
   * Load definitions and project fields
   */
  const loadData = useCallback(async () => {
    if (!companyId || !projectId) {
      setDefinitions([])
      setProjectFields([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Load in parallel
      const [defs, fields] = await Promise.all([
        CustomFieldService.listDefinitions(companyId, { includeArchived: false }, groupId ?? undefined),
        CustomFieldService.listProjectFields(companyId, projectId, groupId ?? undefined)
      ])

      setDefinitions(defs)
      setProjectFields(fields)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load custom fields')
      setError(error)
      console.error('Error loading custom fields:', error)
    } finally {
      setLoading(false)
    }
  }, [companyId, projectId, groupId])

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Save current state for optimistic rollback
   */
  const saveState = useCallback(() => {
    previousStateRef.current = {
      definitions: [...definitions],
      projectFields: [...projectFields]
    }
  }, [definitions, projectFields])

  /**
   * Rollback to previous state on error
   */
  const rollback = useCallback(() => {
    if (previousStateRef.current) {
      setDefinitions(previousStateRef.current.definitions)
      setProjectFields(previousStateRef.current.projectFields)
      previousStateRef.current = null
    }
  }, [])

  /**
   * Refresh data from server
   */
  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  /**
   * Create a new field definition
   */
  const createDefinition = useCallback(
    async (
      data: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'>,
      addToLibrary: boolean
    ): Promise<string> => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      saveState()

      try {
        const fieldId = await CustomFieldService.createDefinition(companyId, data, addToLibrary, groupId ?? undefined)

        // Refresh definitions if added to library
        if (addToLibrary) {
          await loadData()
        }

        return fieldId
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, groupId, loadData, saveState, rollback]
  )

  /**
   * Archive a field definition (soft delete from library)
   */
  const archiveDefinition = useCallback(
    async (fieldId: string) => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      saveState()

      // Optimistic update
      setDefinitions(prev => prev.filter(d => d.id !== fieldId))

      try {
        await CustomFieldService.archiveDefinition(companyId, fieldId, groupId ?? undefined)
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, groupId, loadData, saveState, rollback]
  )

  /**
   * Update a field definition
   */
  const updateDefinition = useCallback(
    async (fieldId: string, data: Partial<CustomFieldDefinition>) => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      saveState()

      // Optimistic update
      setDefinitions(prev =>
        prev.map(def =>
          def.id === fieldId ? { ...def, ...data, updatedAt: new Date().toISOString() } : def
        )
      )

      // Also update in projectFields if this field is enabled
      setProjectFields(prev =>
        prev.map(field =>
          field.definition.id === fieldId
            ? { ...field, definition: { ...field.definition, ...data, updatedAt: new Date().toISOString() } }
            : field
        )
      )

      try {
        await CustomFieldService.updateDefinition(companyId, fieldId, data, groupId ?? undefined)
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, groupId, loadData, saveState, rollback]
  )

  /**
   * Enable a field for the project
   */
  const enableField = useCallback(
    async (fieldId: string, order: number) => {
      if (!companyId || !projectId || !userId) {
        throw new Error('Company ID, project ID, and user ID are required')
      }

      saveState()

      // Optimistic update
      const definition = definitions.find(d => d.id === fieldId)
      if (definition) {
        const newField: ProjectCustomFieldWithDefinition = {
          id: fieldId,
          order,
          enabledAt: new Date().toISOString(),
          enabledBy: userId,
          aggregation: definition.type === 'number' ? 'sum' : undefined,
          definition
        }
        setProjectFields(prev => [...prev, newField].sort((a, b) => a.order - b.order))
      }

      try {
        await CustomFieldService.enableFieldForProject(companyId, projectId, fieldId, order, userId, groupId ?? undefined)
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, projectId, userId, groupId, definitions, loadData, saveState, rollback]
  )

  /**
   * Disable a field for the project
   */
  const disableField = useCallback(
    async (fieldId: string) => {
      if (!companyId || !projectId) {
        throw new Error('Company ID and project ID are required')
      }

      saveState()

      // Optimistic update
      setProjectFields(prev => prev.filter(f => f.id !== fieldId))

      try {
        await CustomFieldService.disableFieldForProject(companyId, projectId, fieldId, groupId ?? undefined)
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, projectId, groupId, loadData, saveState, rollback]
  )

  /**
   * Reorder fields in the project
   */
  const reorderFields = useCallback(
    async (orders: Array<{ fieldId: string; order: number }>) => {
      if (!companyId || !projectId) {
        throw new Error('Company ID and project ID are required')
      }

      saveState()

      // Optimistic update
      setProjectFields(prev => {
        const updated = prev.map(field => {
          const orderUpdate = orders.find(o => o.fieldId === field.id)
          return orderUpdate ? { ...field, order: orderUpdate.order } : field
        })
        return updated.sort((a, b) => a.order - b.order)
      })

      try {
        await CustomFieldService.reorderProjectFields(companyId, projectId, orders, groupId ?? undefined)
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, projectId, groupId, loadData, saveState, rollback]
  )

  /**
   * Update aggregation setting for number fields
   */
  const updateAggregation = useCallback(
    async (fieldId: string, aggregation: AggregationType) => {
      if (!companyId || !projectId) {
        throw new Error('Company ID and project ID are required')
      }

      saveState()

      // Optimistic update
      setProjectFields(prev =>
        prev.map(field =>
          field.id === fieldId ? { ...field, aggregation } : field
        )
      )

      try {
        await CustomFieldService.updateProjectFieldAggregation(
          companyId,
          projectId,
          fieldId,
          aggregation,
          groupId ?? undefined
        )
        // Refresh to get server state
        await loadData()
      } catch (err) {
        rollback()
        throw err
      }
    },
    [companyId, projectId, groupId, loadData, saveState, rollback]
  )

  /**
   * Update task custom field value
   */
  const updateTaskValue = useCallback(
    async (taskId: string, fieldId: string, value: CustomFieldValue) => {
      if (!companyId) {
        throw new Error('Company ID is required')
      }

      try {
        await CustomFieldService.updateTaskCustomFields(companyId, taskId, {
          [fieldId]: value
        }, groupId ?? undefined)
        // Note: Task updates don't affect projectFields/definitions, so no state update needed
        // The parent component should refresh task data if needed
      } catch (err) {
        throw err
      }
    },
    [companyId, groupId]
  )

  /**
   * Update project custom field value
   */
  const updateProjectValue = useCallback(
    async (fieldId: string, value: CustomFieldValue, verificationStatus?: 'pending' | 'verified' | 'rejected') => {
      if (!companyId || !projectId) {
        throw new Error('Company ID and project ID are required')
      }

      try {
        await CustomFieldService.updateProjectCustomFields(
          companyId,
          projectId,
          { [fieldId]: value },
          verificationStatus ? { [fieldId]: verificationStatus } : undefined,
          groupId ?? undefined
        )
      } catch (err) {
        throw err
      }
    },
    [companyId, projectId, groupId]
  )

  return {
    definitions,
    projectFields,
    loading,
    error,
    refresh,
    createDefinition,
    updateDefinition,
    archiveDefinition,
    enableField,
    disableField,
    reorderFields,
    updateAggregation,
    updateTaskValue,
    updateProjectValue
  }
}

