// Generated Task Service
// CRUD operations for generated tasks (task instances created from templates)

import {
  collection,
  doc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  runTransaction,
  Timestamp
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { GeneratedTask } from '@/types/task-template-schema'
import { StarredItemsService } from '../starred-items/starred-items-service'
import { companySubcollectionPathSegments } from '../../firestore-paths'

export class Taskservice {
  /**
   * Delete a single generated task
   * 
   * @param companyId Company ID
   * @param taskId Task ID to delete
   */
  static async deleteTask(companyId: string, taskId: string, groupId?: string): Promise<void> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const fullPath = [...segments, taskId]
      const taskRef = doc(db, fullPath[0], ...fullPath.slice(1))

      // Check if task exists
      const taskDoc = await getDoc(taskRef)
      if (!taskDoc.exists()) {
        throw new Error('Task not found')
      }

      // Clean up starred entries BEFORE deleting the task document
      // This allows firestore rules to check ownership of the task during cleanup
      try {
        await StarredItemsService.removeStarredEntity(companyId, companyId, 'task', taskId)
      } catch (error) {
        console.warn('Error cleaning up starred items:', error)
      }

      // Delete the task document
      await deleteDoc(taskRef)

      console.log(`Deleted task ${taskId} from company ${companyId}`)
    } catch (error) {
      console.error('Error deleting task:', error)
      throw error
    }
  }

  /**
   * Delete multiple tasks by IDs
   * Uses batched writes for efficiency (up to 500 tasks at a time)
   * 
   * @param companyId Company ID
   * @param taskIds Array of task IDs to delete
   */
  static async deleteTasks(companyId: string, taskIds: string[], groupId?: string): Promise<void> {
    if (taskIds.length === 0) {
      return
    }

    try {
      // Firestore batch limit is 500 operations
      const batchSize = 500
      const batches = []

      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batchTaskIds = taskIds.slice(i, i + batchSize)
        const batch = writeBatch(db)

        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
        for (const taskId of batchTaskIds) {
          const fullPath = [...segments, taskId]
          const taskRef = doc(db, fullPath[0], ...fullPath.slice(1))
          batch.delete(taskRef)
        }

        batches.push(batch.commit())
      }

      // Clean up starred entries for all tasks BEFORE committing the batch
      // This allows firestore rules to check ownership of each task during cleanup
      try {
        await Promise.all(taskIds.map(id => StarredItemsService.removeStarredEntity(companyId, companyId, 'task', id)))
      } catch (error) {
        console.warn('Error cleaning up starred items for batch:', error)
      }

      await Promise.all(batches)

      console.log(`Deleted ${taskIds.length} tasks from company ${companyId}`)
    } catch (error) {
      console.error('Error deleting tasks:', error)
      throw error
    }
  }

  /**
   * Delete all tasks for a specific project
   * 
   * @param companyId Company ID
   * @param projectId Project ID
   * @returns Number of tasks deleted
   */
  static async deleteProjectTasks(companyId: string, projectId: string, groupId?: string): Promise<number> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      // Query all tasks for this project
      const tasksQuery = query(
        collection(db, segments[0], ...segments.slice(1)),
        where('projectId', '==', projectId)
      )

      const snapshot = await getDocs(tasksQuery)

      if (snapshot.empty) {
        console.log(`No tasks found for project ${projectId}`)
        return 0
      }

      const taskIds = snapshot.docs.map(doc => doc.id)

      // Delete tasks in batches
      await this.deleteTasks(companyId, taskIds, groupId)

      console.log(`Deleted ${taskIds.length} tasks for project ${projectId}`)
      return taskIds.length
    } catch (error) {
      console.error('Error deleting project tasks:', error)
      throw error
    }
  }

  /**
   * Delete all tasks for a specific workspace
   * 
   * @param companyId Company ID
   * @param workspaceId Workspace ID
   * @returns Number of tasks deleted
   */
  static async deleteWorkspaceTasks(companyId: string, workspaceId: string, groupId?: string): Promise<number> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      // Query all tasks for this workspace
      const tasksQuery = query(
        collection(db, segments[0], ...segments.slice(1)),
        where('workspaceId', '==', workspaceId)
      )

      const snapshot = await getDocs(tasksQuery)

      if (snapshot.empty) {
        console.log(`No tasks found for workspace ${workspaceId}`)
        return 0
      }

      const taskIds = snapshot.docs.map(doc => doc.id)

      // Delete tasks in batches
      await this.deleteTasks(companyId, taskIds, groupId)

      console.log(`Deleted ${taskIds.length} tasks for workspace ${workspaceId}`)
      return taskIds.length
    } catch (error) {
      console.error('Error deleting workspace tasks:', error)
      throw error
    }
  }

  /**
   * Delete all tasks assigned to a specific user
   * 
   * @param companyId Company ID
   * @param userId User ID
   * @returns Number of tasks deleted
   */
  static async deleteUserTasks(companyId: string, userId: string, groupId?: string): Promise<number> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      // Query all tasks assigned to this user
      const tasksQuery = query(
        collection(db, segments[0], ...segments.slice(1)),
        where('assignedUserId', '==', userId)
      )

      const snapshot = await getDocs(tasksQuery)

      if (snapshot.empty) {
        console.log(`No tasks found for user ${userId}`)
        return 0
      }

      const taskIds = snapshot.docs.map(doc => doc.id)

      // Delete tasks in batches
      await this.deleteTasks(companyId, taskIds, groupId)

      console.log(`Deleted ${taskIds.length} tasks for user ${userId}`)
      return taskIds.length
    } catch (error) {
      console.error('Error deleting user tasks:', error)
      throw error
    }
  }

  /**
   * Get count of tasks for a project
   * Useful for showing confirmation messages before deletion
   * 
   * @param companyId Company ID
   * @param projectId Project ID
   * @returns Number of tasks
   */
  static async getProjectTaskCount(companyId: string, projectId: string, groupId?: string): Promise<number> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksQuery = query(
        collection(db, segments[0], ...segments.slice(1)),
        where('projectId', '==', projectId)
      )

      const snapshot = await getDocs(tasksQuery)
      return snapshot.size
    } catch (error) {
      console.error('Error getting project task count:', error)
      throw error
    }
  }

  /**
   * Get count of tasks for a workspace
   * 
   * @param companyId Company ID
   * @param workspaceId Workspace ID
   * @returns Number of tasks
   */
  static async getWorkspaceTaskCount(companyId: string, workspaceId: string, groupId?: string): Promise<number> {
    try {
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksQuery = query(
        collection(db, segments[0], ...segments.slice(1)),
        where('workspaceId', '==', workspaceId)
      )

      const snapshot = await getDocs(tasksQuery)
      return snapshot.size
    } catch (error) {
      console.error('Error getting workspace task count:', error)
      throw error
    }
  }
  /**
   * Fetch all tasks for a project (supports multi-tenancy)
   */
  static async fetchTasksForProject(companyId: string, projectId: string, groupId?: string): Promise<GeneratedTask[]> {
    try {
      // Construct the correct collection reference based on tenant mode
      const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksRef = collection(db, segments[0], ...segments.slice(1))

      const tasksQuery = query(
        tasksRef,
        where('projectId', '==', projectId)
      )

      const snapshot = await getDocs(tasksQuery)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedTask))
    } catch (error) {
      console.error('Error getting project tasks:', error)
      return []
    }
  }
}

