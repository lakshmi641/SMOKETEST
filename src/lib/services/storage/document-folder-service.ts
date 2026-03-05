import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

export interface DocumentFolder {
  id: string
  name: string
  projectId: string
  companyId: string
  parentFolderId?: string | null // For nested folders
  isDefault: boolean // Only one default folder per project - system-managed
  isSystemFolder: boolean // true for default folder, false for user-created
  createdBy: string // 'system' for default folder, userId for user-created
  createdAt: string
  updatedAt: string
  documentCount?: number // Cached count
}

const DEFAULT_FOLDER_NAME = 'Default'

/**
 * Wait for Firebase Auth to be ready
 * Returns a promise that resolves when auth state is initialized
 * onAuthStateChanged fires immediately when subscribed if auth is already initialized
 */
function waitForAuth(): Promise<void> {
  return new Promise((resolve) => {
    // onAuthStateChanged fires immediately with current state when subscribed
    // This ensures we wait for auth to be initialized
    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe()
      resolve()
    })
  })
}

/**
 * Get the collection reference for document folders.
 * When groupId is provided, uses enterprise path (required for Firestore rules in multi-org).
 */
function getFoldersCollection(companyId: string, projectId: string, groupId?: string) {
  if (groupId) {
    return collection(db, 'enterpriseGroups', groupId, 'companies', companyId, 'projects', projectId, 'documentFolders')
  }
  return collection(db, 'companies', companyId, 'projects', projectId, 'documentFolders')
}

/**
 * Get or create the default folder for a project
 * When groupId is provided, uses enterprise path (required for Firestore rules in multi-org).
 */
export async function getDefaultFolder(
  companyId: string,
  projectId: string,
  userId: string,
  groupId?: string
): Promise<DocumentFolder> {
  if (!companyId || !projectId) {
    throw new Error('Company ID and Project ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to access document folders')
  }

  try {
    // Try to find existing default folder
    const foldersRef = getFoldersCollection(companyId, projectId, groupId)
    const defaultQuery = query(foldersRef, where('isDefault', '==', true))
    const snapshot = await getDocs(defaultQuery)

    if (!snapshot.empty) {
      const defaultFolderDoc = snapshot.docs[0]
      if (defaultFolderDoc) {
        return {
          id: defaultFolderDoc.id,
          ...defaultFolderDoc.data()
        } as DocumentFolder
      }
    }

    // Create default folder if it doesn't exist
    const now = new Date().toISOString()
    const newFolder = {
      name: DEFAULT_FOLDER_NAME,
      projectId,
      companyId,
      isDefault: true,
      isSystemFolder: true, // System-managed folder
      createdBy: 'system', // System-created, not user-created
      createdAt: now,
      updatedAt: now,
      documentCount: 0
    }

    const docRef = await addDoc(foldersRef, newFolder)

    return {
      id: docRef.id,
      ...newFolder
    } as DocumentFolder
  } catch (error) {
    console.error('Error getting/creating default folder:', error)
    throw error
  }
}

/**
 * Get all folders for a project
 */
export async function getFolders(
  companyId: string,
  projectId: string,
  groupId?: string
): Promise<DocumentFolder[]> {
  if (!companyId || !projectId) {
    throw new Error('Company ID and Project ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to access document folders')
  }

  try {
    const foldersRef = getFoldersCollection(companyId, projectId, groupId)
    const snapshot = await getDocs(foldersRef)

    const folders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DocumentFolder[]

    // Sort: default folder first, then user-created folders
    return folders.sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Error getting folders:', error)
    throw error
  }
}

/**
 * Get a specific folder by ID
 */
export async function getFolder(
  companyId: string,
  projectId: string,
  folderId: string,
  groupId?: string
): Promise<DocumentFolder | null> {
  if (!companyId || !projectId || !folderId) {
    throw new Error('Company ID, Project ID, and Folder ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to access document folders')
  }

  try {
    const folderRef = doc(getFoldersCollection(companyId, projectId, groupId), folderId)
    const folderDoc = await getDoc(folderRef)

    if (!folderDoc.exists()) {
      return null
    }

    return {
      id: folderDoc.id,
      ...folderDoc.data()
    } as DocumentFolder
  } catch (error) {
    console.error('Error getting folder:', error)
    throw error
  }
}

/**
 * Create a new folder (admin only)
 */
export async function createFolder(
  companyId: string,
  projectId: string,
  name: string,
  userId: string,
  parentFolderId?: string,
  groupId?: string
): Promise<DocumentFolder> {
  if (!companyId || !projectId || !name || !userId) {
    throw new Error('Company ID, Project ID, name, and user ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to create document folders')
  }

  // Validate name
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Folder name cannot be empty')
  }

  if (trimmedName.length > 100) {
    throw new Error('Folder name cannot exceed 100 characters')
  }

  try {
    // Check if folder with same name already exists
    const foldersRef = getFoldersCollection(companyId, projectId, groupId)
    const existingQuery = query(foldersRef, where('name', '==', trimmedName))
    const existingSnapshot = await getDocs(existingQuery)

    if (!existingSnapshot.empty) {
      throw new Error(`A folder with the name "${trimmedName}" already exists`)
    }

    const now = new Date().toISOString()
    const newFolder = {
      name: trimmedName,
      projectId,
      companyId,
      parentFolderId: parentFolderId || null,
      isDefault: false,
      isSystemFolder: false, // User-created folder
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      documentCount: 0
    }

    const docRef = await addDoc(foldersRef, newFolder)

    return {
      id: docRef.id,
      ...newFolder
    } as DocumentFolder
  } catch (error) {
    console.error('Error creating folder:', error)
    throw error
  }
}

/**
 * Update a folder (admin only)
 */
export async function updateFolder(
  companyId: string,
  projectId: string,
  folderId: string,
  updates: Partial<Pick<DocumentFolder, 'name'>>,
  groupId?: string
): Promise<void> {
  if (!companyId || !projectId || !folderId) {
    throw new Error('Company ID, Project ID, and Folder ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to update document folders')
  }

  try {
    const folderRef = doc(getFoldersCollection(companyId, projectId, groupId), folderId)
    const folderDoc = await getDoc(folderRef)

    if (!folderDoc.exists()) {
      throw new Error('Folder not found')
    }

    const folderData = folderDoc.data() as DocumentFolder

    // Prevent renaming default folder
    if (folderData.isDefault && updates.name && updates.name !== folderData.name) {
      throw new Error('Cannot rename the default folder')
    }

    // Validate name if provided
    if (updates.name) {
      const trimmedName = updates.name.trim()
      if (!trimmedName) {
        throw new Error('Folder name cannot be empty')
      }

      if (trimmedName.length > 100) {
        throw new Error('Folder name cannot exceed 100 characters')
      }

      // Check if another folder with same name exists
      const foldersRef = getFoldersCollection(companyId, projectId, groupId)
      const existingQuery = query(
        foldersRef,
        where('name', '==', trimmedName)
      )
      const existingSnapshot = await getDocs(existingQuery)

      const conflictingFolder = existingSnapshot.docs.find(
        doc => doc.id !== folderId
      )

      if (conflictingFolder) {
        throw new Error(`A folder with the name "${trimmedName}" already exists`)
      }

      updates.name = trimmedName
    }

    await updateDoc(folderRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating folder:', error)
    throw error
  }
}

/**
 * Delete a folder (admin only)
 * Can only delete if folder is empty and not the default folder
 */
export async function deleteFolder(
  companyId: string,
  projectId: string,
  folderId: string,
  groupId?: string
): Promise<void> {
  if (!companyId || !projectId || !folderId) {
    throw new Error('Company ID, Project ID, and Folder ID are required')
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    throw new Error('User must be authenticated to delete document folders')
  }

  try {
    const folderRef = doc(getFoldersCollection(companyId, projectId, groupId), folderId)
    const folderDoc = await getDoc(folderRef)

    if (!folderDoc.exists()) {
      throw new Error('Folder not found')
    }

    const folderData = folderDoc.data() as DocumentFolder

    // Prevent deleting default folder
    if (folderData.isDefault) {
      throw new Error('Cannot delete the default folder')
    }

    // Check if folder is empty (documentCount === 0)
    if (folderData.documentCount && folderData.documentCount > 0) {
      throw new Error('Cannot delete folder that contains documents')
    }

    await deleteDoc(folderRef)
  } catch (error) {
    console.error('Error deleting folder:', error)
    throw error
  }
}

/**
 * Delete a folder and all its contents (admin only)
 * Reassigns documents to default folder and recursively deletes sub-folders
 */
export async function deleteFolderRecursive(
  companyId: string,
  projectId: string,
  folderId: string,
  defaultFolderId: string,
  groupId?: string
): Promise<void> {
  if (!companyId || !projectId || !folderId || !defaultFolderId) {
    throw new Error('All parameters are required for recursive deletion')
  }

  await waitForAuth()
  if (!auth.currentUser) throw new Error('Unauthenticated')

  try {
    const foldersRef = getFoldersCollection(companyId, projectId, groupId)

    // 1. Find all sub-folders recursively
    const allFolders = await getFolders(companyId, projectId, groupId)
    const foldersToDelete = new Set<string>([folderId])

    const getChildren = (parentId: string) => {
      const children = allFolders.filter(f => f.parentFolderId === parentId)
      children.forEach(child => {
        foldersToDelete.add(child.id)
        getChildren(child.id)
      })
    }
    getChildren(folderId)

    // 2. Reassign documents from ALL targeted folders to Default
    // This is done task-by-task usually, but here we'll need to find tasks containing any of these folderIds
    // For simplicity in this service, we'll implement a batch reassigner
    await reassignDocumentsToDefault(companyId, projectId, Array.from(foldersToDelete), defaultFolderId, groupId)

    // 3. Delete the folders
    const batch = writeBatch(db)
    foldersToDelete.forEach(id => {
      batch.delete(doc(foldersRef, id))
    })
    await batch.commit()

  } catch (error) {
    console.error('Error in recursive deletion:', error)
    throw error
  }
}

/**
 * Reassigns documents from specific folders to a target folder (usually Default)
 */
async function reassignDocumentsToDefault(
  companyId: string,
  projectId: string,
  folderIds: string[],
  targetFolderId: string,
  groupId?: string
): Promise<void> {
  try {
    const tasksRef = groupId
      ? collection(db, 'enterpriseGroups', groupId, 'companies', companyId, 'tasks')
      : collection(db, 'companies', companyId, 'tasks')
    const q = query(tasksRef, where('projectId', '==', projectId))
    const snapshot = await getDocs(q)

    const batch = writeBatch(db)
    let hasChanges = false

    snapshot.docs.forEach(taskDoc => {
      const data = taskDoc.data()
      const attachments = data.attachments || []
      let taskChanged = false

      const updatedAttachments = attachments.map((att: any) => {
        if (att.folderId && folderIds.includes(att.folderId)) {
          taskChanged = true
          hasChanges = true
          return { ...att, folderId: targetFolderId, folderName: 'Default' }
        }
        return att
      })

      if (taskChanged) {
        batch.update(taskDoc.ref, {
          attachments: updatedAttachments,
          updatedAt: new Date().toISOString()
        })
      }
    })

    if (hasChanges) {
      await batch.commit()
    }
  } catch (error) {
    console.error('Error reassigning documents:', error)
    throw error
  }
}

/**
 * Move a file/attachment to a different folder
 * This updates the folderId in the attachment record
 */
export async function moveFileToFolder(
  companyId: string,
  taskId: string,
  attachmentId: string,
  targetFolderId: string,
  groupId?: string
): Promise<void> {
  if (!companyId || !taskId || !attachmentId || !targetFolderId) {
    throw new Error('All parameters are required')
  }

  try {
    const taskRef = groupId
      ? doc(db, 'enterpriseGroups', groupId, 'companies', companyId, 'tasks', taskId)
      : doc(db, 'companies', companyId, 'tasks', taskId)
    const taskDoc = await getDoc(taskRef)

    if (!taskDoc.exists()) {
      throw new Error('Task not found')
    }

    const attachments = taskDoc.data().attachments || []
    const attachmentIndex = attachments.findIndex(
      (att: any) => att.id === attachmentId
    )

    if (attachmentIndex === -1) {
      throw new Error('Attachment not found')
    }

    // Update the attachment's folderId
    const updatedAttachments = [...attachments]
    updatedAttachments[attachmentIndex] = {
      ...updatedAttachments[attachmentIndex],
      folderId: targetFolderId
    }

    await updateDoc(taskRef, {
      attachments: updatedAttachments,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error moving file to folder:', error)
    throw error
  }
}

/**
 * Update document count for a folder
 * This is called when files are added/removed
 */
export async function updateFolderDocumentCount(
  companyId: string,
  projectId: string,
  folderId: string,
  delta: number,
  groupId?: string
): Promise<void> {
  if (!companyId || !projectId || !folderId) {
    return
  }

  // Wait for auth to be ready before making queries
  await waitForAuth()

  if (!auth.currentUser) {
    // Silently fail for non-critical operations
    return
  }

  try {
    const folderRef = doc(getFoldersCollection(companyId, projectId, groupId), folderId)
    const folderDoc = await getDoc(folderRef)

    if (!folderDoc.exists()) {
      return
    }

    const currentCount = folderDoc.data().documentCount || 0
    const newCount = Math.max(0, currentCount + delta)

    await updateDoc(folderRef, {
      documentCount: newCount,
      updatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    // Only log if it's not a permission error - this is a non-critical operation
    // and non-admin users are expected to be blocked by security rules
    if (error?.code !== 'permission-denied') {
      console.error('Error updating folder document count:', error)
    }
  }
}

