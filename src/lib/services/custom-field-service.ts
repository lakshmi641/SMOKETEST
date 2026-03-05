// Custom Field Service
// Handles CRUD operations for custom field definitions, project fields, and task values
// Uses direct Firestore calls (same pattern as TaskTemplateService)

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  writeBatch,
  collectionGroup
} from 'firebase/firestore'
import { db } from '../firebase'
import { companySubcollectionPathSegments } from '../firestore-paths'
import type {
  CustomFieldDefinition,
  ProjectCustomField,
  ProjectCustomFieldWithDefinition,
  CustomFieldValue,
  CustomFieldType,
  AggregationType
} from '@/types/custom-field'
import type { GeneratedTask } from '@/types/task-template-schema'
import { validateCustomFieldDefinition } from '@/types/custom-field'

export class CustomFieldService {
  // ============================================================================
  // DEFINITION MANAGEMENT (LIBRARY OPERATIONS)
  // ============================================================================

  /**
   * Create a new custom field definition
   * @param companyId Company ID
   * @param data Field definition data
   * @param addToLibrary If true, saves to library (customFieldDefinitions collection)
   * @returns Created field ID
   */
  static async createDefinition(
    companyId: string,
    data: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'>,
    addToLibrary: boolean,
    groupId?: string
  ): Promise<string> {
    if (!companyId) {
      throw new Error('Company ID is required')
    }

    // Validate definition
    const errors = validateCustomFieldDefinition(data)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }

    // Get current Firebase Auth user to ensure createdBy matches request.auth.uid
    const { auth } = await import('../firebase')
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User not authenticated')
    }

    // Use Firebase Auth UID directly to ensure it matches Firestore rules
    const createdByUid = currentUser.uid

    console.debug('[CustomFieldService.createDefinition] request', {
      companyId,
      providedCreatedBy: data.createdBy,
      firebaseAuthUid: createdByUid,
      uidMatch: data.createdBy === createdByUid
    })

    const now = new Date().toISOString()

    // Build definition data, omitting undefined/empty fields (Firestore doesn't allow undefined)
    // IMPORTANT: Use Firebase Auth UID for createdBy to match Firestore security rules
    const definitionData: any = {
      name: data.name,
      type: data.type,
      createdBy: createdByUid, // Use Firebase Auth UID, not the passed-in value
      createdAt: now,
      updatedAt: now,
      isArchived: !addToLibrary // Respect the addToLibrary parameter
    }

    // Include value (required)
    definitionData.value = data.value.trim();

    // Only include units if it has a value
    if (data.units && data.units.trim()) {
      definitionData.units = data.units.trim();
    }

    // Include options for select fields
    if (data.options && data.options.length > 0) {
      definitionData.options = data.options
    }

    // Include number field settings
    if (data.format) {
      definitionData.format = data.format
    }
    if (data.decimals !== undefined) {
      definitionData.decimals = data.decimals
    }
    if (data.customLabel && data.customLabel.trim()) {
      definitionData.customLabel = data.customLabel.trim()
    }

    // Include formula definition
    if (data.formula) {
      definitionData.formula = data.formula
    }

    // Always save definition to library (required for reference by projectFields)
    // The "addToLibrary" checkbox is more about user intent to reuse it later
    // But technically, we need to store it in the library collection for the reference to work
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'customFieldDefinitions')
    const definitionRef = collection(db, segments[0], ...segments.slice(1))

    try {
      console.debug('[CustomFieldService.createDefinition] Attempting to create document', {
        path: `companies/${companyId}/customFieldDefinitions`,
        definitionData
      })
      const docRef = await addDoc(definitionRef, definitionData)
      console.debug('[CustomFieldService.createDefinition] Document created successfully', {
        docId: docRef.id
      })
      return docRef.id
    } catch (error: any) {
      console.error('[CustomFieldService.createDefinition] Firestore error', {
        code: error?.code,
        message: error?.message,
        path: `companies/${companyId}/customFieldDefinitions`,
        createdByUid,
        definitionData
      })
      throw error
    }
  }

  /**
   * List custom field definitions (library)
   * @param companyId Company ID
   * @param options Search and filter options
   * @returns List of field definitions
   */
  static async listDefinitions(
    companyId: string,
    options?: {
      includeArchived?: boolean
      searchQuery?: string
      typeFilter?: CustomFieldType
    },
    groupId?: string
  ): Promise<CustomFieldDefinition[]> {
    if (!companyId) return []

    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'customFieldDefinitions')
      const definitionRef = collection(db, segments[0], ...segments.slice(1))
      let q = query(definitionRef)

      // Filter by archived status
      if (!options?.includeArchived) {
        q = query(q, where('isArchived', '==', false))
      }

      // Filter by type if provided
      if (options?.typeFilter) {
        q = query(q, where('type', '==', options.typeFilter))
      }

      // Note: Removed orderBy from query to avoid requiring composite index
      // We'll sort client-side instead

      const snapshot = await getDocs(q)
      let definitions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CustomFieldDefinition))

      // Sort by updatedAt descending (most recent first) - client-side
      definitions.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return dateB - dateA
      })

      // Client-side search filter (Firestore doesn't support full-text search)
      if (options?.searchQuery) {
        const queryLower = options.searchQuery.toLowerCase()
        definitions = definitions.filter(def =>
          def.name.toLowerCase().includes(queryLower) ||
          def.value.toLowerCase().includes(queryLower) ||
          def.units?.toLowerCase().includes(queryLower)
        )
      }

      return definitions
    } catch (error) {
      console.error('Error listing custom field definitions:', error)
      return []
    }
  }

  /**
   * Get a single field definition
   */
  static async getDefinition(
    companyId: string,
    fieldId: string,
    groupId?: string
  ): Promise<CustomFieldDefinition | null> {
    if (!companyId || !fieldId) return null

    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'customFieldDefinitions')
      const definitionRef = doc(db, segments[0], ...segments.slice(1), fieldId)
      const snapshot = await getDoc(definitionRef)

      if (!snapshot.exists()) {
        return null
      }

      return { id: snapshot.id, ...snapshot.data() } as CustomFieldDefinition
    } catch (error) {
      console.error('Error getting custom field definition:', error)
      return null
    }
  }

  /**
   * Update a field definition
   */
  static async updateDefinition(
    companyId: string,
    fieldId: string,
    updates: Partial<CustomFieldDefinition>,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !fieldId) {
      throw new Error('Company ID and field ID are required')
    }

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'customFieldDefinitions')
    const definitionRef = doc(db, ...segments, fieldId)
    await updateDoc(definitionRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * Archive a field definition (soft delete)
   * Note: Does not remove field from projects where it's already enabled
   */
  static async archiveDefinition(
    companyId: string,
    fieldId: string,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !fieldId) {
      throw new Error('Company ID and field ID are required')
    }

    // Note: We deliberately allow archiving even if the field is used in projects.
    // The field will remain in projects but be hidden from the library.

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'customFieldDefinitions')
    const definitionRef = doc(db, ...segments, fieldId)
    const payload = {
      isArchived: true,
      updatedAt: new Date().toISOString()
    }

    // Debug logging for server-side call context
    console.debug('[CustomFieldService.archiveDefinition] request', {
      companyId,
      fieldId,
      payload
    })

    await updateDoc(definitionRef, payload)

    console.debug('[CustomFieldService.archiveDefinition] success', {
      companyId,
      fieldId
    })
  }

  // ============================================================================
  // PROJECT FIELD MANAGEMENT
  // ============================================================================

  /**
   * List enabled fields for a project (with definitions joined)
   */
  static async listProjectFields(
    companyId: string,
    projectId: string,
    groupId?: string
  ): Promise<ProjectCustomFieldWithDefinition[]> {
    if (!companyId || !projectId) return []

    try {
      const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
      const projectFieldsRef = collection(
        db,
        projectSegments[0],
        ...projectSegments.slice(1),
        projectId,
        'customFields'
      )
      const projectFieldsSnapshot = await getDocs(projectFieldsRef)
      const projectFields = projectFieldsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProjectCustomField))

      // Join with definitions
      const definitions = await Promise.all(
        projectFields.map(pf => this.getDefinition(companyId, pf.id, groupId))
      )

      // Filter out null definitions and create joined objects
      const joinedFields: ProjectCustomFieldWithDefinition[] = []
      projectFields.forEach((pf, i) => {
        const definition = definitions[i]
        if (definition) {
          joinedFields.push({
            ...pf,
            definition
          })
        }
      })

      // Sort by order
      joinedFields.sort((a, b) => a.order - b.order)

      return joinedFields
    } catch (error) {
      console.error('Error listing project custom fields:', error)
      return []
    }
  }

  /**
   * Enable a field for a project (add to project)
   */
  static async enableFieldForProject(
    companyId: string,
    projectId: string,
    fieldId: string,
    order: number,
    userId: string,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !projectId || !fieldId || !userId) {
      throw new Error('Company ID, project ID, field ID, and user ID are required')
    }

    // Check if field definition exists
    const definition = await this.getDefinition(companyId, fieldId, groupId)
    if (!definition) {
      throw new Error('Field definition not found')
    }

    // Check if field is already enabled
    const existingFields = await this.listProjectFields(companyId, projectId, groupId)
    if (existingFields.some(f => f.id === fieldId)) {
      throw new Error('Field is already enabled for this project')
    }

    const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
    const projectFieldRef = doc(
      db,
      projectSegments[0],
      ...projectSegments.slice(1),
      projectId,
      'customFields',
      fieldId
    )

    // Build project field data, only including aggregation for number fields
    const projectFieldData: any = {
      id: fieldId,
      order: order,
      enabledAt: new Date().toISOString(),
      enabledBy: userId
    }

    // Only include aggregation for number fields (Firestore doesn't allow undefined)
    if (definition.type === 'number') {
      projectFieldData.aggregation = 'sum' // Default aggregation for numbers
    }

    await setDoc(projectFieldRef, projectFieldData)
  }

  /**
   * Disable a field for a project (remove from project)
   */
  static async disableFieldForProject(
    companyId: string,
    projectId: string,
    fieldId: string,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !projectId || !fieldId) {
      throw new Error('Company ID, project ID, and field ID are required')
    }

    const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
    const projectFieldRef = doc(
      db,
      projectSegments[0],
      ...projectSegments.slice(1),
      projectId,
      'customFields',
      fieldId
    )

    await deleteDoc(projectFieldRef)
  }

  /**
   * Reorder fields in a project
   */
  static async reorderProjectFields(
    companyId: string,
    projectId: string,
    fieldOrders: Array<{ fieldId: string; order: number }>,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !projectId) {
      throw new Error('Company ID and project ID are required')
    }

    const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
    const batch = writeBatch(db)
    fieldOrders.forEach(({ fieldId, order }) => {
      const ref = doc(
        db,
        projectSegments[0],
        ...projectSegments.slice(1),
        projectId,
        'customFields',
        fieldId
      )
      batch.update(ref, { order })
    })

    await batch.commit()
  }

  /**
   * Update aggregation setting for number fields
   */
  static async updateProjectFieldAggregation(
    companyId: string,
    projectId: string,
    fieldId: string,
    aggregation: AggregationType,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !projectId || !fieldId) {
      throw new Error('Company ID, project ID, and field ID are required')
    }

    const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
    const projectFieldRef = doc(
      db,
      projectSegments[0],
      ...projectSegments.slice(1),
      projectId,
      'customFields',
      fieldId
    )

    await updateDoc(projectFieldRef, { aggregation })
  }

  // ============================================================================
  // TASK VALUE MANAGEMENT
  // ============================================================================

  /**
   * Update task custom field values
   */
  static async updateTaskCustomFields(
    companyId: string,
    taskId: string,
    values: Partial<Record<string, CustomFieldValue>>,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !taskId) {
      throw new Error('Company ID and task ID are required')
    }

    const taskSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const taskRef = doc(db, taskSegments[0], ...taskSegments.slice(1), taskId)

    // Get current task to merge with existing customFields
    const taskSnap = await getDoc(taskRef)
    if (!taskSnap.exists()) {
      throw new Error('Task not found')
    }

    const currentTask = taskSnap.data() as GeneratedTask
    const currentCustomFields = currentTask.customFields || {}

    // Merge new values with existing
    const updatedCustomFields = {
      ...currentCustomFields,
      ...values
    }

    await updateDoc(taskRef, {
      customFields: updatedCustomFields,
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * Update project custom field values
   */
  static async updateProjectCustomFields(
    companyId: string,
    projectId: string,
    values: Partial<Record<string, CustomFieldValue>>,
    verificationStatus?: Partial<Record<string, 'pending' | 'verified' | 'rejected'>>,
    groupId?: string
  ): Promise<void> {
    if (!companyId || !projectId) {
      throw new Error('Company ID and project ID are required')
    }

    const projectSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projects')
    const projectRef = doc(db, projectSegments[0], ...projectSegments.slice(1), projectId)
    const projectSnap = await getDoc(projectRef)

    if (!projectSnap.exists()) {
      throw new Error('Project not found')
    }

    const projectData = projectSnap.data()
    const currentCustomFields = projectData.customFields || {}
    const currentVerification = projectData.verificationStatus || {}

    const payload: any = {
      customFields: { ...currentCustomFields, ...values },
      updatedAt: new Date().toISOString()
    }

    if (verificationStatus) {
      payload.verificationStatus = { ...currentVerification, ...verificationStatus }
    }

    await updateDoc(projectRef, payload)
  }

  /**
   * Get task custom field values
   */
  static async getTaskCustomFields(
    companyId: string,
    taskId: string
  ): Promise<Record<string, CustomFieldValue> | null> {
    if (!companyId || !taskId) return null

    try {
      const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
      const taskSnap = await getDoc(taskRef)

      if (!taskSnap.exists()) {
        return null
      }

      const task = taskSnap.data() as GeneratedTask
      return task.customFields || null
    } catch (error) {
      console.error('Error getting task custom fields:', error)
      return null
    }
  }

  // ============================================================================
  // AGGREGATION HELPERS
  // ============================================================================

  /**
   * Calculate aggregation for number fields
   */
  static calculateAggregation(
    fieldId: string,
    aggregationType: AggregationType,
    tasks: GeneratedTask[]
  ): number | null {
    if (aggregationType === 'none') {
      return null
    }

    // Extract number values from tasks
    const values = tasks
      .map(task => {
        const customFields = task.customFields || {}
        const value = customFields[fieldId]
        return typeof value === 'number' ? value : null
      })
      .filter((v): v is number => v !== null)

    if (values.length === 0) {
      return null
    }

    switch (aggregationType) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0)
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length
      case 'count':
        return values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
      default:
        return null
    }
  }
}

