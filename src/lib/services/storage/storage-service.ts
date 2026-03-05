import { storage } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
  StorageReference,
  UploadTask,
  UploadTaskSnapshot
} from 'firebase/storage';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface FileMetadata {
  name: string;
  size: number;
  contentType: string;
  timeCreated: string;
  updated: string;
}

export interface UploadedFile {
  url: string;
  path: string;
  name: string;
  size: number;
  contentType: string;
  metadata?: FileMetadata;
}

/**
 * Upload a file to Firebase Storage via API route (avoids CORS issues)
 * @param file - The file to upload
 * @param path - The storage path (e.g., 'tasks/attachments/task-123/file.pdf')
 * @param onProgress - Optional progress callback (not supported for API route uploads)
 * @returns Promise with the uploaded file information
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFile> {
  try {
    // Get current user's auth token
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User must be authenticated to upload files')
    }

    const token = await currentUser.getIdToken()

    // Use API route to avoid CORS issues
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[StorageService] Detail upload error:', errorData);
      throw new Error(errorData.message || errorData.error || `Upload failed with status ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Upload failed')
    }

    return {
      url: data.url,
      path: data.path,
      name: data.name,
      size: data.size,
      contentType: data.contentType,
      metadata: {
        name: data.name,
        size: data.size,
        contentType: data.contentType,
        timeCreated: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Upload multiple files to Firebase Storage
 * @param files - Array of files to upload
 * @param basePath - Base storage path (e.g., 'tasks/attachments/task-123')
 * @param onProgress - Optional progress callback for each file
 * @returns Promise with array of uploaded file information
 */
export async function uploadMultipleFiles(
  files: File[],
  basePath: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<UploadedFile[]> {
  const uploadPromises = files.map((file, index) => {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${basePath}/${fileName}`;

    const progressCallback = onProgress
      ? (progress: UploadProgress) => onProgress(index, progress)
      : undefined;

    return uploadFile(file, filePath, progressCallback);
  });

  return Promise.all(uploadPromises);
}

/**
 * Get download URL for a file
 * @param path - The storage path
 * @returns Promise with the download URL
 */
export async function getFileDownloadURL(path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
}

/**
 * Delete a file from Firebase Storage via API route (avoids CORS and client-side SDK issues)
 * @param path - The storage path
 * @returns Promise that resolves when file is deleted
 */
export async function deleteFile(path: string): Promise<void> {
  if (!path || path === 'link') {
    console.warn('[StorageService] Skip deleting invalid or placeholder path:', path);
    return;
  }

  try {
    // Get current user's auth token
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User must be authenticated to delete files')
    }

    const token = await currentUser.getIdToken()

    // Use API route to avoid CORS and client-side SDK initialization issues
    const response = await fetch('/api/storage/delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[StorageService] Detail delete error:', errorData);

      // If it's a 404, we can ignore it as the file is already gone
      if (response.status !== 404) {
        throw new Error(errorData.message || errorData.error || `Delete failed with status ${response.status}`)
      }
    }

    const data = await response.json();
    if (data.success) {
      console.log('[StorageService] File deleted successfully via API');
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    // We don't want to crash the whole deletion flow if storage deletion fails
    // as the Firestore cleanup might still be needed.
    throw error;
  }
}

/**
 * List all files in a directory
 * @param path - The storage directory path
 * @returns Promise with array of file references
 */
export async function listFiles(path: string): Promise<StorageReference[]> {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

/**
 * Get file metadata
 * @param path - The storage path
 * @returns Promise with file metadata
 */
export async function getFileMetadata(path: string): Promise<FileMetadata> {
  try {
    const storageRef = ref(storage, path);
    const metadata = await getMetadata(storageRef);

    return {
      name: metadata.name,
      size: metadata.size,
      contentType: metadata.contentType || '',
      timeCreated: metadata.timeCreated,
      updated: metadata.updated
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw error;
  }
}

/**
 * Generate a unique file path for task attachments
 * @param taskId - The task ID
 * @param fileName - The original file name
 * @returns Unique file path
 */
export function generateTaskAttachmentPath(taskId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `tasks/${taskId}/attachments/${timestamp}-${sanitizedFileName}`;
}

/**
 * Format file size to human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

