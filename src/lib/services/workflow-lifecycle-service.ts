/**
 * Workflow Lifecycle Service
 *
 * Manages workflow version control, lifecycle states, and sharing.
 *
 * Lifecycle States:
 * - draft: Initial state, can be edited freely
 * - pending_review: Submitted for review (optional)
 * - active: Published and can be used
 * - inactive: Temporarily disabled
 * - archived: No longer active, kept for history
 * - deleted: Soft deleted, 30-day retention
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import { WorkflowDefinition, WorkflowVersion, WorkflowShare, WorkflowStep } from '@/types/workflow-schema'

function workflowCollection(companyId: string, groupId?: string) {
  const seg = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'workflows')
  return collection(db, seg[0], ...seg.slice(1))
}

function workflowDoc(companyId: string, workflowId: string, groupId?: string) {
  const seg = companySubcollectionPathSegments(groupId ?? companyId, companyId, 'workflows')
  return doc(db, seg[0], ...seg.slice(1), workflowId)
}

type WorkflowStatus = WorkflowDefinition['status']

interface CreateWorkflowData {
  name: string
  description?: string
  category?: string
  bpmnXml?: string
  steps?: WorkflowStep[]
  triggerType?: 'manual' | 'automatic' | 'scheduled'
  approvalLineId?: string
  escalationPathId?: string
  ownerWorkspaceId?: string
}

export class WorkflowLifecycleService {
  /**
   * Create a new draft workflow
   */
  static async createDraft(
    companyId: string,
    data: CreateWorkflowData,
    userId: string,
    groupId?: string
  ): Promise<string> {
    const workflowsRef = workflowCollection(companyId, groupId)

    const workflow: Partial<WorkflowDefinition> = {
      companyId,
      name: data.name,
      description: data.description,
      category: data.category || 'general',
      bpmnXml: data.bpmnXml,
      steps: data.steps || [],
      triggerType: data.triggerType || 'manual',
    } as Partial<WorkflowDefinition>

    if (data.approvalLineId) workflow.approvalLineId = data.approvalLineId
    if (data.escalationPathId) workflow.escalationPathId = data.escalationPathId
    if (data.ownerWorkspaceId) workflow.ownerWorkspaceId = data.ownerWorkspaceId

    Object.assign(workflow, {

      // Version management
      version: 1,
      versionHistory: [],
      isDraft: true,

      // Lifecycle
      status: 'draft',
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: userId,

      // Deployment
      isDeployed: false,
      isActive: false, // Legacy

      // Ownership
      ownerId: userId,
      maintainers: [userId],

      // Visibility
      visibility: 'private',
      sharedWith: [],
      allowCopy: true,

      // Tracking
      usageCount: 0,

      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
    })

    const docRef = await addDoc(workflowsRef, workflow)
    return docRef.id
  }

  /**
   * Save draft changes (auto-save)
   */
  static async saveDraft(
    companyId: string,
    workflowId: string,
    updates: Partial<WorkflowDefinition>,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition

    // Only allow saving drafts (relaxed to allow active for redeployment during debug)
    const canSave = workflow.isDraft || workflow.status === 'draft' || workflow.status === 'active';
    if (!canSave) {
      throw new Error('Cannot save changes to this workflow status. Create a new version instead.')
    }

    // Restricted updates for drafts
    const allowedUpdates = [
      'name', 'description', 'category', 'bpmnXml', 'steps',
      'triggerType', 'triggerCondition', 'triggerSchedule',
      'approvalLineId', 'escalationPathId', 'visibility', 'allowCopy'
    ]

    const filteredUpdates: Record<string, unknown> = {}
    for (const key of allowedUpdates) {
      if (key in updates) {
        filteredUpdates[key] = (updates as Record<string, unknown>)[key]
      }
    }

    await updateDoc(workflowRef, {
      ...filteredUpdates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Create a new version from the current workflow
   */
  static async createVersion(
    companyId: string,
    workflowId: string,
    changeNotes: string,
    userId: string,
    groupId?: string
  ): Promise<number> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition
    const newVersion = workflow.version + 1

    // Create version snapshot
    const versionSnapshot: WorkflowVersion = {
      version: workflow.version,
      bpmnXml: workflow.bpmnXml || '',
      steps: workflow.steps,
      approvalLineId: workflow.approvalLineId,
      escalationPathId: workflow.escalationPathId,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeNotes,
      status: 'draft',
    }

    const updatedVersionHistory = [...(workflow.versionHistory || []), versionSnapshot]

    await updateDoc(workflowRef, {
      version: newVersion,
      versionHistory: updatedVersionHistory,
      isDraft: true,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })

    return newVersion
  }

  /**
   * Publish a version (makes it deployable)
   */
  static async publishVersion(
    companyId: string,
    workflowId: string,
    version: number,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition

    if (workflow.version !== version) {
      throw new Error('Version mismatch. Create a new version before publishing.')
    }

    // Mark the current version as published in history
    const updatedVersionHistory = (workflow.versionHistory || []).map(v =>
      v.version === version ? { ...v, status: 'published' as const } : v
    )

    await updateDoc(workflowRef, {
      isDraft: false,
      latestPublishedVersion: version,
      versionHistory: updatedVersionHistory,
      status: 'active',
      statusChangedAt: serverTimestamp(),
      statusChangedBy: userId,
      isActive: true, // Legacy
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Rollback to a previous version
   */
  static async rollbackToVersion(
    companyId: string,
    workflowId: string,
    targetVersion: number,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition
    const targetVersionData = workflow.versionHistory?.find(v => v.version === targetVersion)

    if (!targetVersionData) {
      throw new Error(`Version ${targetVersion} not found in history`)
    }

    // Create a new version with the old data
    const newVersion = workflow.version + 1

    const rollbackSnapshot: WorkflowVersion = {
      version: workflow.version,
      bpmnXml: workflow.bpmnXml || '',
      steps: workflow.steps,
      approvalLineId: workflow.approvalLineId,
      escalationPathId: workflow.escalationPathId,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changeNotes: `Rollback from v${workflow.version} to v${targetVersion}`,
      status: 'deprecated',
    }

    await updateDoc(workflowRef, {
      version: newVersion,
      bpmnXml: targetVersionData.bpmnXml,
      steps: targetVersionData.steps,
      approvalLineId: targetVersionData.approvalLineId,
      escalationPathId: targetVersionData.escalationPathId,
      versionHistory: [...(workflow.versionHistory || []), rollbackSnapshot],
      isDraft: true,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Lifecycle transitions
   */
  static async activate(
    companyId: string,
    workflowId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    await this.transitionStatus(companyId, workflowId, 'active', userId, groupId)
  }

  static async deactivate(
    companyId: string,
    workflowId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    await this.transitionStatus(companyId, workflowId, 'inactive', userId, groupId)
  }

  static async archive(
    companyId: string,
    workflowId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    await this.transitionStatus(companyId, workflowId, 'archived', userId, groupId)
  }

  static async restore(
    companyId: string,
    workflowId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    await this.transitionStatus(companyId, workflowId, 'inactive', userId, groupId)
  }

  static async softDelete(
    companyId: string,
    workflowId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    await this.transitionStatus(companyId, workflowId, 'deleted', userId, groupId)
  }

  private static async transitionStatus(
    companyId: string,
    workflowId: string,
    newStatus: WorkflowStatus,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition

    // Validate transition
    const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
      draft: ['active', 'pending_review', 'deleted'],
      pending_review: ['active', 'draft', 'deleted'],
      active: ['inactive', 'archived'],
      inactive: ['active', 'archived', 'deleted'],
      archived: ['inactive', 'deleted'],
      deleted: [], // Cannot transition from deleted
    }

    if (!validTransitions[workflow.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${workflow.status} to ${newStatus}`)
    }

    await updateDoc(workflowRef, {
      status: newStatus,
      statusChangedAt: serverTimestamp(),
      statusChangedBy: userId,
      isActive: newStatus === 'active', // Legacy
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Share workflow with users/workspaces
   */
  static async shareWorkflow(
    companyId: string,
    workflowId: string,
    share: Omit<WorkflowShare, 'sharedAt' | 'sharedBy'>,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition

    const newShare: WorkflowShare = {
      ...share,
      sharedAt: new Date().toISOString(),
      sharedBy: userId,
    }

    // Remove existing share for same target if exists
    const existingShares = (workflow.sharedWith || []).filter(
      s => !(s.type === share.type && s.targetId === share.targetId)
    )

    await updateDoc(workflowRef, {
      sharedWith: [...existingShares, newShare],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Remove share
   */
  static async removeShare(
    companyId: string,
    workflowId: string,
    shareType: 'user' | 'workspace' | 'role',
    targetId: string,
    userId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) {
      throw new Error('Workflow not found')
    }

    const workflow = workflowSnap.data() as WorkflowDefinition

    const updatedShares = (workflow.sharedWith || []).filter(
      s => !(s.type === shareType && s.targetId === targetId)
    )

    await updateDoc(workflowRef, {
      sharedWith: updatedShares,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  /**
   * Copy/fork a workflow
   */
  static async copyWorkflow(
    companyId: string,
    sourceWorkflowId: string,
    newName: string,
    targetWorkspaceId: string | undefined,
    userId: string,
    groupId?: string
  ): Promise<string> {
    const sourceRef = workflowDoc(companyId, sourceWorkflowId, groupId)
    const sourceDoc = await getDoc(sourceRef)

    if (!sourceDoc.exists()) {
      throw new Error('Source workflow not found')
    }

    const source = sourceDoc.data() as WorkflowDefinition

    if (!source.allowCopy) {
      throw new Error('This workflow does not allow copying')
    }

    // Create a new draft based on the source
    const newWorkflowId = await this.createDraft(
      companyId,
      {
        name: newName,
        description: source.description ? `(Copied from ${source.name}) ${source.description}` : undefined,
        category: source.category,
        bpmnXml: source.bpmnXml,
        steps: source.steps,
        triggerType: source.triggerType,
        approvalLineId: source.approvalLineId,
        escalationPathId: source.escalationPathId,
        ownerWorkspaceId: targetWorkspaceId,
      },
      userId,
      groupId
    )

    return newWorkflowId
  }

  /**
   * Get workflows accessible to a user
   */
  static async getAccessibleWorkflows(
    companyId: string,
    userId: string,
    filters?: {
      status?: WorkflowStatus[]
      category?: string
      workspaceId?: string
    },
    groupId?: string
  ): Promise<WorkflowDefinition[]> {
    const workflowsRef = workflowCollection(companyId, groupId)

    // Build query - start with non-deleted workflows
    let q = query(workflowsRef, where('status', '!=', 'deleted'))

    if (filters?.category) {
      q = query(q, where('category', '==', filters.category))
    }

    if (filters?.workspaceId) {
      q = query(q, where('ownerWorkspaceId', '==', filters.workspaceId))
    }

    const snapshot = await getDocs(q)
    const allWorkflows = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as WorkflowDefinition[]

    // Filter by accessibility
    const accessibleWorkflows = allWorkflows.filter(workflow => {
      // Owner always has access
      if (workflow.ownerId === userId) return true

      // Maintainers have access
      if (workflow.maintainers?.includes(userId)) return true

      // Company-wide visibility
      if (workflow.visibility === 'company') return true

      // Check explicit shares
      const userShare = workflow.sharedWith?.find(
        s => s.type === 'user' && s.targetId === userId
      )
      if (userShare) return true

      return false
    })

    // Apply status filter if provided
    if (filters?.status && filters.status.length > 0) {
      return accessibleWorkflows.filter(w => filters.status!.includes(w.status))
    }

    return accessibleWorkflows
  }

  /**
   * Increment usage count
   */
  static async incrementUsageCount(
    companyId: string,
    workflowId: string,
    groupId?: string
  ): Promise<void> {
    const workflowRef = workflowDoc(companyId, workflowId, groupId)
    const workflowSnap = await getDoc(workflowRef)

    if (!workflowSnap.exists()) return

    const workflow = workflowSnap.data() as WorkflowDefinition

    await updateDoc(workflowRef, {
      usageCount: (workflow.usageCount || 0) + 1,
      lastUsedAt: serverTimestamp(),
    })
  }
}
