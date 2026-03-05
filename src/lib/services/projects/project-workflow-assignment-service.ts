import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where
} from 'firebase/firestore'
import { db } from '../../firebase'
import { companySubcollectionPathSegments } from '../../firestore-paths'
import type { ProjectWorkflowAssignment } from '@/types/workflow-schema'

/**
 * ProjectWorkflowAssignmentService
 * 
 * Manages the assignment of Approval Lines and Escalation Paths to projects.
 * This allows reusable workflows to be scoped to specific projects.
 */
export class ProjectWorkflowAssignmentService {
    private static getCollection(companyId: string, groupId?: string) {
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectWorkflowAssignments')
        return collection(db, segments[0], ...segments.slice(1))
    }

    /**
     * Assign a workflow (Approval Line or Escalation Path) to a project
     */
    static async assignWorkflowToProject(
        companyId: string,
        data: Omit<ProjectWorkflowAssignment, 'id' | 'assignedAt'>,
        userId: string,
        groupId?: string
    ): Promise<string> {
        try {
            const colRef = this.getCollection(companyId, groupId)
            const now = new Date().toISOString()

            const docRef = await addDoc(colRef, {
                ...data,
                assignedAt: now,
                assignedBy: userId,
                isActive: true
            })

            console.log(`Assigned workflow ${data.workflowDefinitionId || data.escalationPolicyId} to project ${data.projectId}`)
            return docRef.id
        } catch (error) {
            console.error('Error assigning workflow to project:', error)
            throw error
        }
    }

    /**
     * Get all workflow assignments for a project
     */
    static async getProjectAssignments(
        companyId: string,
        projectId: string,
        groupId?: string
    ): Promise<ProjectWorkflowAssignment[]> {
        try {
            const q = query(
                this.getCollection(companyId, groupId),
                where('projectId', '==', projectId),
                where('isActive', '==', true)
            )

            const snapshot = await getDocs(q)
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectWorkflowAssignment))
        } catch (error) {
            console.error('Error fetching project assignments:', error)
            throw error
        }
    }

    /**
     * Update an assignment
     */
    static async updateAssignment(
        companyId: string,
        assignmentId: string,
        updates: Partial<ProjectWorkflowAssignment>,
        groupId?: string
    ): Promise<void> {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectWorkflowAssignments')
            const docRef = doc(db, ...segments, assignmentId)
            await updateDoc(docRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            })
        } catch (error) {
            console.error('Error updating project assignment:', error)
            throw error
        }
    }

    /**
     * Remove an assignment (soft delete)
     */
    static async removeAssignment(
        companyId: string,
        assignmentId: string,
        groupId?: string
    ): Promise<void> {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectWorkflowAssignments')
            const docRef = doc(db, ...segments, assignmentId)
            await updateDoc(docRef, {
                isActive: false,
                updatedAt: new Date().toISOString()
            })
        } catch (error) {
            console.error('Error removing project assignment:', error)
            throw error
        }
    }

    /**
     * Get the IDs of approval lines and escalation paths assigned to a project
     * Used by TaskForm to filter available workflows
     */
    static async getProjectWorkflowIds(
        companyId: string,
        projectId: string,
        groupId?: string
    ): Promise<{ approvalLineIds: string[], escalationPathIds: string[] }> {
        try {
            const assignments = await this.getProjectAssignments(companyId, projectId, groupId)

            const approvalLineIds = assignments
                .filter(a => a.type === 'approval_line' && a.workflowDefinitionId)
                .map(a => a.workflowDefinitionId!)

            const escalationPathIds = assignments
                .filter(a => a.type === 'escalation_path' && a.escalationPolicyId)
                .map(a => a.escalationPolicyId!)

            return { approvalLineIds, escalationPathIds }
        } catch (error) {
            console.error('Error fetching project workflow IDs:', error)
            return { approvalLineIds: [], escalationPathIds: [] }
        }
    }
}
