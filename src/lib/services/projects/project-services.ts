// Firebase Project Module Service
// Comprehensive service for managing all Project module collections

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { setDoc } from 'firebase/firestore';
import { companyCollectionPathSegments } from '../../firestore-paths';
import {
  EnhancedProject,
  ProjectPhase,
  ProjectDeliverable,
  ProjectResource,
  ProjectRisk,
  ProjectMilestone,
  ProjectTemplate,
  ProjectBudget,
  ProjectTimeTracking
} from '../../../types/project-schema';
import type { RoleAssignment } from '@/types/access-control-schema';
import { RoleService } from '../access-control/role-service';
import { ExternalNotificationService } from '../external-notifications/external-notification-service';
import { StarredItemsService } from '../starred-items/starred-items-service';

// Helper to convert Firestore timestamps to ISO strings
const convertTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => convertTimestamps(item));
  }

  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }

  if (typeof data === 'object') {
    const converted = { ...data };
    Object.keys(converted).forEach(key => {
      converted[key] = convertTimestamps(converted[key]);
    });
    return converted;
  }

  return data;
};

// Project Service
export class ProjectService {
  /**
   * Get all projects for a company (enterprise path).
   * Signatures:
   * - getProjects(companyId, filters?) — single-tenant: uses companyId as both groupId and companyId
   * - getProjects(groupId, companyId, filters?) — multi-tenant: explicit group and company
   */
  static async getProjects(
    groupIdOrCompanyId: string,
    companyIdOrFilters?: string | {
      status?: string;
      manager?: string;
      equipmentType?: string;
      manufacturingPhase?: string;
      userId?: string;
      isGlobalAdmin?: boolean;
    },
    filtersOptional?: {
      status?: string;
      manager?: string;
      equipmentType?: string;
      manufacturingPhase?: string;
      userId?: string;
      isGlobalAdmin?: boolean;
    }
  ): Promise<EnhancedProject[]> {
    const isFiltersObject = (x: unknown): x is NonNullable<typeof filtersOptional> =>
      typeof x === 'object' && x !== null && !('length' in x)
    const filters = isFiltersObject(companyIdOrFilters) ? companyIdOrFilters : filtersOptional
    const groupId = typeof companyIdOrFilters === 'string' ? groupIdOrCompanyId : groupIdOrCompanyId
    const companyId = typeof companyIdOrFilters === 'string' ? companyIdOrFilters : groupIdOrCompanyId
    try {
      let q = query(collection(db, ...companyCollectionPathSegments(groupId, companyId, 'projects')));

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters?.manager) {
        q = query(q, where('manager', '==', filters.manager));
      }
      if (filters?.equipmentType) {
        q = query(q, where('equipmentType', '==', filters.equipmentType));
      }
      if (filters?.manufacturingPhase) {
        q = query(q, where('manufacturingPhase', '==', filters.manufacturingPhase));
      }

      q = query(q, orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      const allProjects = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...convertTimestamps(doc.data())
        } as EnhancedProject))
        .filter(p => !p.isDeleted); // Filter out soft-deleted projects

      // Global admins see all projects
      if (filters?.isGlobalAdmin) {
        return allProjects;
      }

      // CHANGED: Filter is now always applied for non-admins. 
      // userId is required for project-level check; if absent, we return empty to be safe.
      const userId = filters?.userId;

      if (userId) {
        return allProjects.filter(p => {
          // RFT projects are globally visible across the company
          const isRftProject = p.projectType === 'rft' || (p.name && p.name.match(/RFT/i));
          if (isRftProject) return true;

          // Project-level membership mapping to the requirements:
          // User should only see the project if they are the manager, in the team array, or the creator.
          const isManager = p.manager === userId;
          const isProjectTeamMember = Array.isArray(p.team) && p.team.includes(userId);
          const isCreator = (p as any).createdBy === userId;

          // Check visibility/privacy settings
          const visibility = p.visibility || 'standard';

          // If project is 'secret' (private to me), only show to manager
          if (visibility === 'secret') {
            return isManager;
          }

          // If project is 'private' (private to members), only show to manager and team members
          if (visibility === 'private') {
            return isManager || isProjectTeamMember;
          }

          // For 'standard' visibility: show if manager, team member, or creator
          return isManager || isProjectTeamMember || isCreator;
        });
      }

      // If no userId provided for a non-admin, return empty to prevent data leakage.
      // Callers should always pass the current user's ID.
      return [];
    } catch (error) {
      console.error('Error getting projects:', error);
      throw error;
    }
  }

  // Get project by ID for a company
  // Optional userId and isGlobalAdmin parameters for privacy checking
  static async getProject(
    companyId: string,
    projectId: string,
    userId?: string,
    isGlobalAdmin?: boolean,
    options?: { groupId?: string }
  ): Promise<EnhancedProject | null> {
    try {
      const groupId = options?.groupId;
      const docRef =
        groupId != null
          ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'), projectId)
          : doc(db, 'companies', companyId, 'projects', projectId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isDeleted) return null; // Return null for soft-deleted projects

        const project = {
          id: docSnap.id,
          ...convertTimestamps(data)
        } as EnhancedProject;

        // Check privacy settings if userId is provided and user is not an admin
        if (userId && !isGlobalAdmin) {
          const visibility = project.visibility || 'standard';
          const isManager = project.manager === userId;
          const isTeamMember = project.team && Array.isArray(project.team) && project.team.includes(userId);

          // If project is 'secret' (private to me), only show to manager
          if (visibility === 'secret') {
            if (!isManager) {
              return null; // Return null to indicate access denied
            }
          }

          // If project is 'private' (private to members), only show to manager and team members
          if (visibility === 'private') {
            if (!isManager && !isTeamMember) {
              return null; // Return null to indicate access denied
            }
          }

          if (visibility === 'standard') {
            const isRftProject = project.projectType === 'rft' || (project.name && !!project.name.match(/RFT/i));
            if (!isRftProject) {
              if (project.workspaceId) {
                // Fetch workspace to check membership
                const { companyCollectionPathSegments } = await import('@/lib/firestore-paths');
                const wsPath = groupId
                  ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'workspaces'), project.workspaceId)
                  : doc(db, 'companies', companyId, 'workspaces', project.workspaceId);
                const wsSnap = await getDoc(wsPath);

                if (wsSnap.exists()) {
                  const wsData = wsSnap.data();
                  const oldAdminIds = wsData.adminIds || [];
                  const ownerId = wsData.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
                  const oldSpocIds = wsData.spocIds || [];
                  const members = wsData.members || oldSpocIds;

                  const isWMember = Array.isArray(members) && members.includes(userId);
                  const isCreator = wsData.createdBy === userId;
                  const isOwner = ownerId === userId;

                  if (!isOwner && !isWMember && !isCreator && !isManager && !isTeamMember) {
                    return null; // Deny standard project access
                  }
                }
              } else if (!isManager && !isTeamMember) {
                return null; // Deny standard project if no workspace and not team
              }
            }
          }
        }

        return project;
      }
      return null;
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  }

  // Helper to remove undefined properties from an object
  private static stripUndefined(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    const result: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  // Helper to generate smart code
  private static generateSmartCode(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase();
    const words = clean.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return 'PRJ';
    if (words.length === 1) {
      const firstWord = words[0];
      return firstWord ? firstWord.substring(0, 3) : 'PRJ';
    }
    return words.map(w => w[0] || '').join('').substring(0, 3);
  }

  // Create new project for a company.
  // When groupId is provided (multi-org), writes to enterpriseGroups/{groupId}/companies/{companyId}/projects
  // so Firestore rules that check enterprise company membership apply.
  static async createProject(
    companyId: string,
    project: Omit<EnhancedProject, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { groupId?: string }
  ): Promise<string> {
    const groupId = options?.groupId;
    const projectsRef =
      groupId != null
        ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'))
        : collection(db, 'companies', companyId, 'projects');

    try {
      // Ensure projectCode exists
      if (!project.projectCode) {
        let candidate = this.generateSmartCode(project.name || 'Project');

        // Uniqueness check (same path we will write to)
        const q1 = query(projectsRef, where('projectCode', '==', candidate));
        const snap1 = await getDocs(q1);

        if (!snap1.empty) {
          // Collision, try appending count 1..5
          let foundUnique = false;
          for (let i = 1; i <= 5; i++) {
            const next = `${candidate}${i}`;
            const q2 = query(projectsRef, where('projectCode', '==', next));
            const snap2 = await getDocs(q2);
            if (snap2.empty) {
              candidate = next;
              foundUnique = true;
              break;
            }
          }
          // If still failed, append random
          if (!foundUnique) {
            candidate = `${candidate}${Math.floor(Math.random() * 1000)}`;
          }
        }

        // Cast to any to allow assigning readonly/optional if needed, or just standard assignment
        (project as any).projectCode = candidate;
      }

      // Ensure createdBy is always set (fallback to manager if not provided)
      const createdBy = (project as any).createdBy || project.manager || 'system';

      // Clean the project data to remove undefined values which Firestore doesn't support
      const cleanedProject = this.stripUndefined({
        ...project,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        positionTeam: project.positionTeam || []
      });

      const docRef = await addDoc(projectsRef, cleanedProject);

      // Log activity
      try {
        const { ActivityService } = await import('../activity-service');
        const actorId = project.createdBy || (project as any).manager || 'system';

        await ActivityService.logActivity(groupId || companyId, companyId, {
          actorId,
          type: 'project_created',
          entityId: docRef.id,
          entityType: 'project',
          entityName: project.name
        });
      } catch (err) {
        console.error('Failed to log project creation activity:', err);
      }

      // Trigger Broadcast Notification for the entire Workspace Authority (Owner + W-Admins + System Admins)
      if (project.workspaceId) {
        try {
          const { WorkspaceService } = await import('../workspaces/workspace-service');
          const recipients = await WorkspaceService.resolveWorkspaceStakeholders(groupId || companyId, companyId, project.workspaceId);

          // Ensure project manager is included even if they aren't a workspace admin
          if (project.manager && !recipients.includes(project.manager)) {
            recipients.push(project.manager);
          }

          const notificationPromises = recipients.map(recipientId =>
            ExternalNotificationService.notifyProjectCreated(
              companyId,
              recipientId,
              project.name,
              'System', // Can be refined to show actual creator name
              docRef.id,
              groupId
            ).catch(err => console.error(`Failed to notify ${recipientId}:`, err))
          );

          Promise.allSettled(notificationPromises);
        } catch (resolveError) {
          console.error('Failed to resolve workspace stakeholders for notification:', resolveError);
          // Fallback to notifying just the manager if resolution fails
          if (project.manager) {
            ExternalNotificationService.notifyProjectCreated(
              companyId,
              project.manager,
              project.name,
              'System',
              docRef.id,
              groupId
            );
          }
        }
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Update project for a company
  static async updateProject(
    companyId: string,
    projectId: string,
    updates: Partial<EnhancedProject>,
    options?: { groupId?: string }
  ): Promise<void> {
    try {
      const groupId = options?.groupId;
      // Validate inputs
      if (!companyId || !projectId) {
        throw new Error('Missing required parameters: companyId or projectId');
      }

      // Log for debugging
      console.log('Updating project:', {
        companyId,
        projectId,
        groupId,
        path: groupId != null
          ? `enterpriseGroups/${groupId}/companies/${companyId}/projects/${projectId}`
          : `companies/${companyId}/projects/${projectId}`,
        updates: Object.keys(updates)
      });

      const docRef =
        groupId != null
          ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'), projectId)
          : doc(db, 'companies', companyId, 'projects', projectId);

      // Verify document exists before updating
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Project not found: ${projectId} in company ${companyId}`);
      }

      // Update the document
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      console.log('Project updated successfully:', projectId);
    } catch (error: any) {
      console.error('Error updating project:', {
        companyId,
        projectId,
        error: error.message,
        code: error.code
      });

      // Provide more specific error messages
      if (error.code === 'not-found' || error.message?.includes('not found')) {
        throw new Error(`Project not found. Please refresh the page and try again.`);
      }

      throw error;
    }
  }

  // Delete project for a company (Soft Delete).
  // When groupId is provided (multi-org), operates on enterpriseGroups/{groupId}/companies/{companyId}/projects.
  static async deleteProject(companyId: string, projectId: string, options?: { groupId?: string }): Promise<void> {
    const groupId = options?.groupId;
    const docRef =
      groupId != null
        ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'), projectId)
        : doc(db, 'companies', companyId, 'projects', projectId);
    try {
      // Clean up starred entry for project BEFORE marking as deleted
      try {
        await StarredItemsService.removeStarredEntity(companyId, companyId, 'project', projectId);
      } catch (error) {
        console.warn('Error cleaning up starred items:', error);
      }

      // Soft delete: Mark as deleted and cancelled
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  // ============================================================================
  // PROJECT ROLE ASSIGNMENTS
  // ============================================================================

  /**
   * Assign a role to a user in a project
   */
  static async assignRoleToUser(
    companyId: string,
    projectId: string,
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: string | null
  ): Promise<RoleAssignment> {
    try {
      // Verify role exists and is project-scoped
      const role = await RoleService.getRole(companyId, companyId, roleId);
      if (!role) {
        throw new Error('Role not found');
      }
      if (role.scope !== 'project' && role.scope !== 'system') {
        throw new Error('Role is not valid for project assignment');
      }

      // Check if assignment already exists
      const existingAssignment = await this.getUserRoleAssignment(
        companyId,
        projectId,
        userId,
        roleId
      );
      if (existingAssignment) {
        throw new Error('User already has this role in this project');
      }

      const assignmentRef = doc(collection(db, 'companies', companyId, 'roleAssignments'));
      const now = new Date().toISOString();

      const assignment: RoleAssignment = {
        id: assignmentRef.id,
        companyId,
        userId,
        roleId,
        scopeType: 'project',
        scopeId: projectId,
        assignedBy,
        expiresAt: expiresAt || null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(assignmentRef, assignment);
      return assignment;
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Remove a role assignment from a user in a project
   */
  static async removeRoleFromUser(
    companyId: string,
    projectId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    try {
      const assignment = await this.getUserRoleAssignment(
        companyId,
        projectId,
        userId,
        roleId
      );
      if (!assignment) {
        throw new Error('Role assignment not found');
      }

      const assignmentRef = doc(db, 'companies', companyId, 'roleAssignments', assignment.id);
      await updateDoc(assignmentRef, {
        status: 'inactive',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  /**
   * Get a user's role assignment in a project
   */
  static async getUserRoleAssignment(
    companyId: string,
    projectId: string,
    userId: string,
    roleId: string
  ): Promise<RoleAssignment | null> {
    try {
      const assignmentsRef = collection(db, 'companies', companyId, 'roleAssignments');
      const q = query(
        assignmentsRef,
        where('userId', '==', userId),
        where('scopeType', '==', 'project'),
        where('scopeId', '==', projectId),
        where('roleId', '==', roleId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      if (!doc) {
        return null;
      }
      return {
        id: doc.id,
        ...convertTimestamps(doc.data()),
      } as RoleAssignment;
    } catch (error) {
      console.error('Error getting user role assignment:', error);
      throw error;
    }
  }

  /**
   * Get all role assignments for a project
   */
  static async getProjectRoleAssignments(
    companyId: string,
    projectId: string
  ): Promise<RoleAssignment[]> {
    try {
      const assignmentsRef = collection(db, 'companies', companyId, 'roleAssignments');
      const q = query(
        assignmentsRef,
        where('scopeType', '==', 'project'),
        where('scopeId', '==', projectId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      } as RoleAssignment));
    } catch (error) {
      console.error('Error getting project role assignments:', error);
      throw error;
    }
  }

  /**
   * Get all users with a specific role in a project
   */
  static async getUsersWithRole(
    companyId: string,
    projectId: string,
    roleId: string
  ): Promise<string[]> {
    try {
      const assignments = await this.getProjectRoleAssignments(companyId, projectId);
      return assignments
        .filter(a => a.roleId === roleId)
        .map(a => a.userId);
    } catch (error) {
      console.error('Error getting users with role:', error);
      throw error;
    }
  }

  // ============================================================================
  // POSITION TEAM MANAGEMENT
  // ============================================================================

  /**
   * Add a position to the project team
   */
  static async addPositionTeamMember(
    companyId: string,
    projectId: string,
    positionId: string,
    options?: { groupId?: string }
  ): Promise<void> {
    try {
      const { arrayUnion, updateDoc, doc } = await import('firebase/firestore');
      const groupId = options?.groupId;
      const docRef =
        groupId != null
          ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'), projectId)
          : doc(db, 'companies', companyId, 'projects', projectId);
      await updateDoc(docRef, {
        positionTeam: arrayUnion(positionId),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error adding position team member:', error);
      throw error;
    }
  }

  /**
   * Remove a position from the project team
   */
  static async removePositionTeamMember(
    companyId: string,
    projectId: string,
    positionId: string,
    options?: { groupId?: string }
  ): Promise<void> {
    try {
      const { arrayRemove, updateDoc, doc } = await import('firebase/firestore');
      const groupId = options?.groupId;
      const docRef =
        groupId != null
          ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'projects'), projectId)
          : doc(db, 'companies', companyId, 'projects', projectId);
      await updateDoc(docRef, {
        positionTeam: arrayRemove(positionId),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error removing position team member:', error);
      throw error;
    }
  }
}

export class ProjectPhaseService {
  static async getProjectPhases(companyId: string, projectId: string): Promise<ProjectPhase[]> {
    try {
      const q = query(
        collection(db, `companies/${companyId}/projectPhases`),
        where('projectId', '==', projectId),
        orderBy('startDate', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectPhase));
    } catch (error) {
      console.error('Error getting project phases:', error);
      throw error;
    }
  }

  static async createPhase(companyId: string, phase: Omit<ProjectPhase, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, `companies/${companyId}/projectPhases`), {
        ...phase,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating phase:', error);
      throw error;
    }
  }

  static async updatePhase(companyId: string, phaseId: string, updates: Partial<ProjectPhase>): Promise<void> {
    try {
      const docRef = doc(db, `companies/${companyId}/projectPhases`, phaseId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating phase:', error);
      throw error;
    }
  }
}

// Project Deliverable Service
export class ProjectDeliverableService {
  static async getPhaseDeliverables(phaseId: string): Promise<ProjectDeliverable[]> {
    try {
      const q = query(
        collection(db, 'projectDeliverables'),
        where('phaseId', '==', phaseId),
        orderBy('dueDate', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectDeliverable));
    } catch (error) {
      console.error('Error getting deliverables:', error);
      throw error;
    }
  }

  static async getUserDeliverables(userId: string): Promise<ProjectDeliverable[]> {
    try {
      const q = query(
        collection(db, 'projectDeliverables'),
        where('assignee', '==', userId),
        orderBy('dueDate', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectDeliverable));
    } catch (error) {
      console.error('Error getting user deliverables:', error);
      throw error;
    }
  }

  static async createDeliverable(deliverable: Omit<ProjectDeliverable, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectDeliverables'), {
        ...deliverable,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating deliverable:', error);
      throw error;
    }
  }

  static async updateDeliverable(deliverableId: string, updates: Partial<ProjectDeliverable>): Promise<void> {
    try {
      const docRef = doc(db, 'projectDeliverables', deliverableId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating deliverable:', error);
      throw error;
    }
  }
}

// Project Resource Service
export class ProjectResourceService {
  static async getProjectResources(projectId: string): Promise<ProjectResource[]> {
    try {
      const q = query(
        collection(db, 'projectResources'),
        where('projectId', '==', projectId),
        orderBy('type', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectResource));
    } catch (error) {
      console.error('Error getting project resources:', error);
      throw error;
    }
  }

  static async createResource(resource: Omit<ProjectResource, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectResources'), {
        ...resource,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating resource:', error);
      throw error;
    }
  }

  static async updateResource(resourceId: string, updates: Partial<ProjectResource>): Promise<void> {
    try {
      const docRef = doc(db, 'projectResources', resourceId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating resource:', error);
      throw error;
    }
  }
}

// Project Risk Service
export class ProjectRiskService {
  static async getProjectRisks(projectId: string): Promise<ProjectRisk[]> {
    try {
      const q = query(
        collection(db, 'projectRisks'),
        where('projectId', '==', projectId),
        orderBy('probability', 'desc'),
        orderBy('impact', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectRisk));
    } catch (error) {
      console.error('Error getting project risks:', error);
      throw error;
    }
  }

  static async createRisk(risk: Omit<ProjectRisk, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectRisks'), {
        ...risk,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating risk:', error);
      throw error;
    }
  }

  static async updateRisk(riskId: string, updates: Partial<ProjectRisk>): Promise<void> {
    try {
      const docRef = doc(db, 'projectRisks', riskId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating risk:', error);
      throw error;
    }
  }
}

// Project Milestone Service
export class ProjectMilestoneService {
  static async getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
    try {
      const q = query(
        collection(db, 'projectMilestones'),
        where('projectId', '==', projectId),
        orderBy('targetDate', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectMilestone));
    } catch (error) {
      console.error('Error getting project milestones:', error);
      throw error;
    }
  }

  static async createMilestone(milestone: Omit<ProjectMilestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectMilestones'), {
        ...milestone,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }

  static async updateMilestone(milestoneId: string, updates: Partial<ProjectMilestone>): Promise<void> {
    try {
      const docRef = doc(db, 'projectMilestones', milestoneId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating milestone:', error);
      throw error;
    }
  }
}

// Project Budget Service
export class ProjectBudgetService {
  static async getProjectBudgets(projectId: string): Promise<ProjectBudget[]> {
    try {
      const q = query(
        collection(db, 'projectBudgets'),
        where('projectId', '==', projectId),
        orderBy('category', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectBudget));
    } catch (error) {
      console.error('Error getting project budgets:', error);
      throw error;
    }
  }

  static async createBudget(budget: Omit<ProjectBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectBudgets'), {
        ...budget,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  }

  static async updateBudget(budgetId: string, updates: Partial<ProjectBudget>): Promise<void> {
    try {
      const docRef = doc(db, 'projectBudgets', budgetId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
  }
}

// Project Time Tracking Service
export class ProjectTimeTrackingService {
  static async getUserTimeEntries(userId: string, startDate?: string, endDate?: string): Promise<ProjectTimeTracking[]> {
    try {
      let q = query(
        collection(db, 'projectTimeTracking'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );

      if (startDate) {
        q = query(q, where('date', '>=', startDate));
      }
      if (endDate) {
        q = query(q, where('date', '<=', endDate));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectTimeTracking));
    } catch (error) {
      console.error('Error getting user time entries:', error);
      throw error;
    }
  }

  static async getProjectTimeEntries(projectId: string): Promise<ProjectTimeTracking[]> {
    try {
      const q = query(
        collection(db, 'projectTimeTracking'),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectTimeTracking));
    } catch (error) {
      console.error('Error getting project time entries:', error);
      throw error;
    }
  }

  static async createTimeEntry(timeEntry: Omit<ProjectTimeTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectTimeTracking'), {
        ...timeEntry,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating time entry:', error);
      throw error;
    }
  }

  static async updateTimeEntry(timeEntryId: string, updates: Partial<ProjectTimeTracking>): Promise<void> {
    try {
      const docRef = doc(db, 'projectTimeTracking', timeEntryId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating time entry:', error);
      throw error;
    }
  }
}

// Project Template Service
export class ProjectTemplateService {
  static async getTemplates(equipmentType?: string): Promise<ProjectTemplate[]> {
    try {
      let q = query(
        collection(db, 'projectTemplates'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );

      if (equipmentType) {
        q = query(q, where('equipmentType', '==', equipmentType));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as ProjectTemplate));
    } catch (error) {
      console.error('Error getting templates:', error);
      throw error;
    }
  }

  static async createTemplate(template: Omit<ProjectTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'projectTemplates'), {
        ...template,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }
}

// Export all services
export const projectServices = {
  ProjectService,
  ProjectPhaseService,
  ProjectDeliverableService,
  ProjectResourceService,
  ProjectRiskService,
  ProjectMilestoneService,
  ProjectBudgetService,
  ProjectTimeTrackingService,
  ProjectTemplateService
};
