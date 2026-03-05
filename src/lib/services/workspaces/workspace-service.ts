// Workspace Service
// CRUD operations for workspaces (functional teams)

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { getFirestoreInstance } from '../../firebase';
import { companySubcollectionPathSegments, companyCollectionPathSegments } from '../../firestore-paths';
import type { Workspace } from '@/types/workspace-schema';
import type { RoleAssignment } from '@/types/access-control-schema';
import { RoleService } from '../access-control/role-service';
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

export class WorkspaceService {
  /**
   * Get all workspaces for a company (enterprise path).
   * Signatures:
   * - getWorkspaces(companyId, filters?) — single-tenant: uses companyId as both groupId and companyId
   * - getWorkspaces(groupId, companyId, filters?) — multi-tenant: explicit group and company
   */
  static async getWorkspaces(
    groupIdOrCompanyId: string,
    companyIdOrFilters?: string | {
      status?: 'active' | 'archived';
      teamName?: string;
      userId?: string;
      isGlobalAdmin?: boolean;
    },
    filtersOptional?: {
      status?: 'active' | 'archived';
      teamName?: string;
      userId?: string;
      isGlobalAdmin?: boolean;
    }
  ): Promise<Workspace[]> {
    const isFiltersObject = (x: unknown): x is NonNullable<typeof filtersOptional> =>
      typeof x === 'object' && x !== null && !('length' in x)
    const filters = isFiltersObject(companyIdOrFilters) ? companyIdOrFilters : filtersOptional
    const groupId = typeof companyIdOrFilters === 'string' ? groupIdOrCompanyId : groupIdOrCompanyId
    const companyId = typeof companyIdOrFilters === 'string' ? companyIdOrFilters : groupIdOrCompanyId
    if (!groupId || !companyId) throw new Error('WorkspaceService.getWorkspaces: groupId and companyId are required')
    try {
      const db = getFirestoreInstance()
      const pathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      let q = query(collection(db, ...pathSegments));

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters?.teamName) {
        q = query(q, where('teamName', '==', filters.teamName));
      }

      q = query(q, orderBy('name', 'asc'));

      const snapshot = await getDocs(q);

      const workspaces = snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as Workspace));

      // Apply filtering based on visibility settings and user membership
      if (filters?.userId) {
        return workspaces.filter(workspace => {
          // Backward compatibility: check both old and new field names
          const oldAdminIds = (workspace as any).adminIds || [];
          const ownerId = workspace.ownerId || (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null);
          const oldSpocIds = (workspace as any).spocIds || [];
          const members = workspace.members || oldSpocIds;

          const isOwner = ownerId === filters.userId;
          const isMember = Array.isArray(members) && members.includes(filters.userId!);
          const isCreator = workspace.createdBy === filters.userId;

          // Check workspace visibility setting
          const visibility = workspace.visibility || 'standard';

          // Private/Secret: Zero inheritance - not visible to managers/admins unless explicitly invited
          // Only show to owner, members, or creator (even if user is admin)
          if (visibility === 'private' || visibility === 'secret') {
            return isOwner || isMember || isCreator;
          }

          // For standard/confidential visibility: admins can see all, non-admins need membership
          if (filters?.isGlobalAdmin) {
            return true; // Admins can see standard/confidential workspaces
          }

          // Non-admins need to be owner, member, or creator
          return isOwner || isMember || isCreator;
        });
      }

      return workspaces;
    } catch (error: any) {
      console.error('[WorkspaceService] Error getting workspaces:', {
        groupId,
        companyId,
        filters,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error;
    }
  }

  /**
   * Get workspace by ID
   */
  static async getWorkspace(groupId: string, companyId: string, workspaceId: string): Promise<Workspace | null> {
    if (!companyId) throw new Error('WorkspaceService.getWorkspace: companyId is required')
    const db = getFirestoreInstance()
    try {
      const pathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      const docRef = doc(db, ...pathSegments, workspaceId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...convertTimestamps(docSnap.data())
        } as Workspace;
      }

      return null;
    } catch (error) {
      console.error('Error getting workspace:', error);
      throw error;
    }
  }

  /**
   * Create a new workspace under enterpriseGroups/{groupId}/companies/{companyId}/workspaces
   */
  static async createWorkspace(
    groupId: string,
    companyId: string,
    workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'totalProjects' | 'activeProjects' | 'totalTasks' | 'completedTasks'>
  ): Promise<string> {
    if (!companyId) throw new Error('WorkspaceService.createWorkspace: companyId is required')
    const db = getFirestoreInstance()
    try {
      const now = new Date().toISOString();

      // Ensure all required fields have default values
      // Backward compatibility: support both old and new field names
      const oldAdminIds = (workspaceData as any).adminIds;
      const ownerId = workspaceData.ownerId ||
        (Array.isArray(oldAdminIds) && oldAdminIds.length > 0 ? oldAdminIds[0] : null) ||
        workspaceData.createdBy || '';

      const oldSpocIds = (workspaceData as any).spocIds;
      const members = workspaceData.members || oldSpocIds || [];

      const workspaceToSave: any = {
        name: workspaceData.name || '',
        description: workspaceData.description || '',
        teamName: workspaceData.teamName || '',
        ownerId: ownerId,
        members: Array.isArray(members) ? members : [],
        positionMembers: workspaceData.positionMembers || [],
        status: workspaceData.status || 'active',
        visibility: workspaceData.visibility || 'standard',
        tags: workspaceData.tags || [],
        color: workspaceData.color || '#3b82f6',
        // Metrics (computed)
        totalProjects: 0,
        activeProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        // Audit fields
        createdBy: workspaceData.createdBy || '',
        createdAt: now,
        updatedAt: now,
      };

      // Only include optional fields if they exist and have valid values
      if (workspaceData.department && typeof workspaceData.department === 'string' && workspaceData.department.trim()) {
        workspaceToSave.department = workspaceData.department.trim();
      }
      if (workspaceData.businessUnit && typeof workspaceData.businessUnit === 'string' && workspaceData.businessUnit.trim()) {
        workspaceToSave.businessUnit = workspaceData.businessUnit.trim();
      }
      if (workspaceData.icon && typeof workspaceData.icon === 'string' && workspaceData.icon.trim()) {
        workspaceToSave.icon = workspaceData.icon.trim();
      }
      if (workspaceData.lastModifiedBy && typeof workspaceData.lastModifiedBy === 'string' && workspaceData.lastModifiedBy.trim()) {
        workspaceToSave.lastModifiedBy = workspaceData.lastModifiedBy.trim();
      }

      // Final cleanup: Remove any undefined, null, or empty string values (except description which can be empty)
      Object.keys(workspaceToSave).forEach(key => {
        const value = workspaceToSave[key];
        if (value === undefined || value === null) {
          delete workspaceToSave[key];
        } else if (typeof value === 'string' && value.trim() === '' && key !== 'description' && key !== 'createdBy') {
          delete workspaceToSave[key];
        }
      });

      // Use enterprise path when groupId is set (multi-org) so writes hit enterprise rules and work for non-primary companies
      const pathSegments = (groupId
        ? (companyCollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]])
        : (companySubcollectionPathSegments(companyId, companyId, 'workspaces') as [string, ...string[]]))
      const docRef = await addDoc(
        collection(db, ...pathSegments),
        workspaceToSave
      );

      // Log activity
      try {
        const { ActivityService } = await import('../activity-service');
        await ActivityService.logActivity(groupId, companyId, {
          actorId: workspaceToSave.createdBy || 'system',
          type: 'workspace_created',
          entityId: docRef.id,
          entityType: 'workspace',
          entityName: workspaceToSave.name
        });
      } catch (err) {
        console.error('Failed to log workspace creation activity:', err);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  }

  /**
   * Update a workspace
   */
  static async updateWorkspace(
    groupId: string,
    companyId: string,
    workspaceId: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<void> {
    if (!companyId) throw new Error('WorkspaceService.updateWorkspace: companyId is required')
    const db = getFirestoreInstance()
    try {
      const pathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      const docRef = doc(db, ...pathSegments, workspaceId);

      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      // Explicitly map known fields to ensure type safety and storage
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.teamName !== undefined) updateData.teamName = updates.teamName;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.businessUnit !== undefined) updateData.businessUnit = updates.businessUnit;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.icon !== undefined) updateData.icon = updates.icon;

      // Handle array fields explicitly
      // Backward compatibility: support both old and new field names
      if (updates.members !== undefined || (updates as any).spocIds !== undefined) {
        const members = updates.members || (updates as any).spocIds;
        updateData.members = Array.isArray(members)
          ? members.filter(id => typeof id === 'string' && id.trim().length > 0)
          : [];
      }

      // Handle position members
      if (updates.positionMembers !== undefined) {
        updateData.positionMembers = Array.isArray(updates.positionMembers)
          ? updates.positionMembers.filter(id => typeof id === 'string' && id.trim().length > 0)
          : [];
      }

      if (updates.ownerId !== undefined || (updates as any).adminIds !== undefined) {
        const ownerId = updates.ownerId ||
          (Array.isArray((updates as any).adminIds) && (updates as any).adminIds.length > 0
            ? (updates as any).adminIds[0]
            : null);
        if (ownerId && typeof ownerId === 'string' && ownerId.trim().length > 0) {
          updateData.ownerId = ownerId.trim();
        }
      }

      if (updates.tags !== undefined) {
        updateData.tags = Array.isArray(updates.tags)
          ? updates.tags.filter(tag => typeof tag === 'string')
          : [];
      }

      // Handle remaining metrics if passed
      if (updates.totalProjects !== undefined) updateData.totalProjects = updates.totalProjects;
      if (updates.activeProjects !== undefined) updateData.activeProjects = updates.activeProjects;
      if (updates.totalTasks !== undefined) updateData.totalTasks = updates.totalTasks;
      if (updates.completedTasks !== undefined) updateData.completedTasks = updates.completedTasks;
      if (updates.lastModifiedBy !== undefined) updateData.lastModifiedBy = updates.lastModifiedBy;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating workspace:', error);
      throw error;
    }
  }

  /**
   * Archive a workspace (soft delete)
   */
  static async archiveWorkspace(groupId: string, companyId: string, workspaceId: string): Promise<void> {
    try {
      await this.updateWorkspace(groupId, companyId, workspaceId, { status: 'archived' });
    } catch (error) {
      console.error('Error archiving workspace:', error);
      throw error;
    }
  }

  /**
   * Delete a workspace (hard delete)
   * Optionally cascades to delete projects and tasks
   */
  static async deleteWorkspace(
    groupId: string,
    companyId: string,
    workspaceId: string,
    options: {
      cascadeProjects?: boolean
      cascadeTasks?: boolean
      forceDelete?: boolean
    } = {}
  ): Promise<{ deletedProjects: number; deletedTasks: number }> {
    if (!companyId) throw new Error('WorkspaceService.deleteWorkspace: companyId is required')
    const db = getFirestoreInstance()
    try {
      const result = { deletedProjects: 0, deletedTasks: 0 };
      const projectsPath = companySubcollectionPathSegments(groupId, companyId, 'projects') as [string, ...string[]]
      const tasksPath = companySubcollectionPathSegments(groupId, companyId, 'tasks') as [string, ...string[]]
      const workspacesPath = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]

      const projectsQuery = query(
        collection(db, ...projectsPath),
        where('workspaceId', '==', workspaceId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      // Filter out soft-deleted projects
      const activeProjects = projectsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.isDeleted; // Only count projects that are NOT deleted
      });

      if (activeProjects.length > 0 && !options.forceDelete && !options.cascadeProjects) {
        throw new Error(
          `Cannot delete workspace: ${activeProjects.length} project(s) exist. ` +
          `Use cascadeProjects option or delete projects first.`
        );
      }

      // Cascade delete projects if requested
      if (options.cascadeProjects && !projectsSnapshot.empty) {
        const projectIds = projectsSnapshot.docs.map(doc => doc.id);

        for (const projectId of projectIds) {
          // Delete project with optional task cascade
          if (options.cascadeTasks) {
            const tasksQuery = query(
              collection(db, ...tasksPath),
              where('projectId', '==', projectId)
            );
            const tasksSnapshot = await getDocs(tasksQuery);

            if (!tasksSnapshot.empty) {
              const taskIds = tasksSnapshot.docs.map(doc => doc.id);
              const batchSize = 500;

              for (let i = 0; i < taskIds.length; i += batchSize) {
                const batchTaskIds = taskIds.slice(i, i + batchSize);
                const batch = writeBatch(db);

                for (const taskId of batchTaskIds) {
                  const taskRef = doc(db, ...tasksPath, taskId);
                  batch.delete(taskRef);
                }

                // Clean up starred entries for tasks BEFORE they are deleted
                // This allows firestore rules to check ownership of each task during cleanup
                try {
                  await Promise.all(batchTaskIds.map(id => StarredItemsService.removeStarredEntity(groupId, companyId, 'task', id)));
                } catch (error) {
                  console.warn('Error cleaning up starred items for tasks:', error);
                }

                await batch.commit();
              }

              result.deletedTasks += taskIds.length;
            }
          }

          // Clean up starred entry for project BEFORE it is deleted
          try {
            await StarredItemsService.removeStarredEntity(groupId, companyId, 'project', projectId);
          } catch (error) {
            console.warn('Error cleaning up starred items for project:', error);
          }

          // Delete the project
          const projectRef = doc(db, ...projectsPath, projectId);
          await deleteDoc(projectRef);

          result.deletedProjects++;
        }
      }

      // Clean up starred entry for workspace BEFORE it is deleted
      try {
        await StarredItemsService.removeStarredEntity(groupId, companyId, 'workspace', workspaceId);
      } catch (error) {
        console.warn('Error cleaning up starred items for workspace:', error);
      }

      // Finally, delete the workspace itself
      const workspaceRef = doc(db, ...workspacesPath, workspaceId);
      await deleteDoc(workspaceRef);

      console.log(`Deleted workspace ${workspaceId} (${result.deletedProjects} projects, ${result.deletedTasks} tasks)`);
      return result;
    } catch (error) {
      console.error('Error deleting workspace:', error);
      throw error;
    }
  }

  /**
   * Get count of projects and tasks for a workspace
   * Useful for confirmation dialogs before deletion
   */
  static async getWorkspaceDependencyCounts(
    groupId: string,
    companyId: string,
    workspaceId: string
  ): Promise<{ projects: number; tasks: number }> {
    if (!companyId) throw new Error('WorkspaceService.getWorkspaceDependencyCounts: companyId is required')
    const db = getFirestoreInstance()
    try {
      const projectsPath = companySubcollectionPathSegments(groupId, companyId, 'projects') as [string, ...string[]]
      const tasksPath = companySubcollectionPathSegments(groupId, companyId, 'tasks') as [string, ...string[]]
      const projectsQuery = query(
        collection(db, ...projectsPath),
        where('workspaceId', '==', workspaceId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      const activeProjects = projectsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.isDeleted;
      });

      const tasksQuery = query(
        collection(db, ...tasksPath),
        where('workspaceId', '==', workspaceId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      // Filter out soft-deleted tasks
      const activeTasks = tasksSnapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.isDeleted;
      });

      return {
        projects: activeProjects.length,
        tasks: activeTasks.length
      };
    } catch (error) {
      console.error('Error getting workspace dependency counts:', error);
      throw error;
    }
  }

  /**
   * Get workspaces by member user ID
   */
  static async getWorkspacesBySPOC(groupId: string, companyId: string, userId: string): Promise<Workspace[]> {
    try {
      const allWorkspaces = await this.getWorkspaces(groupId, companyId, { status: 'active' });
      return allWorkspaces.filter(workspace => {
        // Backward compatibility: check both old and new field names
        const oldSpocIds = (workspace as any).spocIds || [];
        const members = workspace.members || oldSpocIds;
        return Array.isArray(members) && members.includes(userId);
      });
    } catch (error) {
      console.error('Error getting workspaces by member:', error);
      throw error;
    }
  }

  /**
   * Update workspace metrics (computed values)
   */
  static async updateWorkspaceMetrics(
    groupId: string,
    companyId: string,
    workspaceId: string,
    metrics: {
      totalProjects?: number;
      activeProjects?: number;
      totalTasks?: number;
      completedTasks?: number;
    }
  ): Promise<void> {
    try {
      await this.updateWorkspace(groupId, companyId, workspaceId, metrics);
    } catch (error) {
      console.error('Error updating workspace metrics:', error);
      throw error;
    }
  }

  // ============================================================================
  // POSITION MEMBER MANAGEMENT
  // ============================================================================

  /**
   * Add a position as a member of a workspace
   */
  static async addPositionMember(groupId: string, companyId: string, workspaceId: string, positionId: string): Promise<void> {
    if (!companyId) throw new Error('WorkspaceService.addPositionMember: companyId is required')
    const db = getFirestoreInstance()
    try {
      const { arrayUnion, updateDoc, doc } = await import('firebase/firestore');
      const pathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      const workspaceRef = doc(db, ...pathSegments, workspaceId);

      await updateDoc(workspaceRef, {
        positionMembers: arrayUnion(positionId),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding position member:', error);
      throw error;
    }
  }

  /**
   * Remove a position from a workspace
   */
  static async removePositionMember(groupId: string, companyId: string, workspaceId: string, positionId: string): Promise<void> {
    if (!companyId) throw new Error('WorkspaceService.removePositionMember: companyId is required')
    const db = getFirestoreInstance()
    try {
      const { arrayRemove, updateDoc, doc } = await import('firebase/firestore');
      const pathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      const workspaceRef = doc(db, ...pathSegments, workspaceId);

      await updateDoc(workspaceRef, {
        positionMembers: arrayRemove(positionId),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error removing position member:', error);
      throw error;
    }
  }

  // ============================================================================
  // WORKSPACE ROLE ASSIGNMENTS
  // ============================================================================

  /**
   * Assign a role to a user in a workspace
   */
  static async assignRoleToUser(
    groupId: string,
    companyId: string,
    workspaceId: string,
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: string | null
  ): Promise<RoleAssignment> {
    if (!companyId) throw new Error('WorkspaceService.assignRoleToUser: companyId is required')
    const db = getFirestoreInstance()
    try {
      const { doc, collection, setDoc } = await import('firebase/firestore');

      const role = await RoleService.getRole(groupId, companyId, roleId);
      if (!role) {
        throw new Error('Role not found');
      }
      if (role.scope !== 'workspace' && role.scope !== 'system') {
        throw new Error('Role is not valid for workspace assignment');
      }

      const existingAssignment = await this.getUserRoleAssignment(
        groupId,
        companyId,
        workspaceId,
        userId,
        roleId
      );
      if (existingAssignment) {
        throw new Error('User already has this role in this workspace');
      }

      const rolePathSegments = companySubcollectionPathSegments(groupId, companyId, 'roleAssignments') as [string, ...string[]]
      const assignmentRef = doc(collection(db, ...rolePathSegments));
      const now = new Date().toISOString();

      const assignment: RoleAssignment = {
        id: assignmentRef.id,
        companyId,
        userId,
        roleId,
        scopeType: 'workspace',
        scopeId: workspaceId,
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
   * Remove a role assignment from a user in a workspace
   */
  static async removeRoleFromUser(
    groupId: string,
    companyId: string,
    workspaceId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    try {
      const assignment = await this.getUserRoleAssignment(
        groupId,
        companyId,
        workspaceId,
        userId,
        roleId
      );
      if (!assignment) {
        throw new Error('Role assignment not found');
      }

      const db = getFirestoreInstance()
      const { doc, updateDoc } = await import('firebase/firestore');
      const rolePathSegments = companySubcollectionPathSegments(groupId, companyId, 'roleAssignments') as [string, ...string[]]
      const assignmentRef = doc(db, ...rolePathSegments, assignment.id);
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
   * Get a user's role assignment in a workspace
   */
  static async getUserRoleAssignment(
    groupId: string,
    companyId: string,
    workspaceId: string,
    userId: string,
    roleId: string
  ): Promise<RoleAssignment | null> {
    if (!companyId) throw new Error('WorkspaceService.getUserRoleAssignment: companyId is required')
    const db = getFirestoreInstance()
    try {
      const { query, where, getDocs } = await import('firebase/firestore');
      const rolePathSegments = companySubcollectionPathSegments(groupId, companyId, 'roleAssignments') as [string, ...string[]]
      const assignmentsRef = collection(db, ...rolePathSegments);
      const q = query(
        assignmentsRef,
        where('userId', '==', userId),
        where('scopeType', '==', 'workspace'),
        where('scopeId', '==', workspaceId),
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
   * Get all role assignments for a workspace
   */
  static async getWorkspaceRoleAssignments(
    groupId: string,
    companyId: string,
    workspaceId: string
  ): Promise<RoleAssignment[]> {
    if (!companyId) throw new Error('WorkspaceService.getWorkspaceRoleAssignments: companyId is required')
    const db = getFirestoreInstance()
    try {
      const { query, where, getDocs } = await import('firebase/firestore');
      const rolePathSegments = companySubcollectionPathSegments(groupId, companyId, 'roleAssignments') as [string, ...string[]]
      const assignmentsRef = collection(db, ...rolePathSegments);
      const q = query(
        assignmentsRef,
        where('scopeType', '==', 'workspace'),
        where('scopeId', '==', workspaceId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      } as RoleAssignment));
    } catch (error) {
      console.error('Error getting workspace role assignments:', error);
      throw error;
    }
  }

  /**
   * Get all users with a specific role in a workspace
   */
  static async getUsersWithRole(
    groupId: string,
    companyId: string,
    workspaceId: string,
    roleId: string
  ): Promise<string[]> {
    try {
      const assignments = await this.getWorkspaceRoleAssignments(groupId, companyId, workspaceId);
      return assignments
        .filter(a => a.roleId === roleId)
        .map(a => a.userId);
    } catch (error) {
      console.error('Error getting users with role:', error);
      throw error;
    }
  }

  /**
   * Resolve all stakeholders for a workspace (Owner + W-Admins + SystemAdmins)
   * This is used for broadcast notifications (Twilio/Email/In-App)
   */
  static async resolveWorkspaceStakeholders(groupId: string, companyId: string, workspaceId: string): Promise<string[]> {
    if (!companyId) return []
    const db = getFirestoreInstance()
    try {
      const wsPathSegments = companySubcollectionPathSegments(groupId, companyId, 'workspaces') as [string, ...string[]]
      const workspaceRef = doc(db, ...wsPathSegments, workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);

      if (!workspaceSnap.exists()) return [];
      const workspaceData = workspaceSnap.data();

      const usersPathSegments = companySubcollectionPathSegments(groupId, companyId, 'users') as [string, ...string[]]
      const usersRef = collection(db, ...usersPathSegments);
      const adminsQuery = query(usersRef, where('role', 'in', ['admin', 'owner', 'group_admin']));
      const adminsSnap = await getDocs(adminsQuery);
      const systemAdminIds = adminsSnap.docs.map(doc => doc.id);

      // 2. Get workspace owner (backward compatibility: check both old and new field names)
      const oldAdminIds = Array.isArray(workspaceData.adminIds) ? workspaceData.adminIds : [];
      const ownerId = workspaceData.ownerId || (oldAdminIds.length > 0 ? oldAdminIds[0] : null);
      const workspaceOwnerIds = ownerId ? [ownerId] : [];

      // 3. Combine with original creator
      return Array.from(new Set([
        workspaceData.createdBy,
        ...workspaceOwnerIds,
        ...systemAdminIds
      ])).filter(id => !!id && typeof id === 'string');
    } catch (error) {
      console.error('Error resolving workspace stakeholders:', error);
      return [];
    }
  }
}

