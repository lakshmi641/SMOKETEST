import { Storage } from '@google-cloud/storage';

/**
 * GCP Storage Service
 * 
 * Manages interactions with Google Cloud Storage bucket for file listing and metadata.
 * 
 * ⚠️ SERVER-ONLY: This service uses Node.js built-in modules and should only be used in:
 * - API Routes (/app/api/*)
 * - Server Components (default in App Router)
 * - Server Actions
 * - Middleware
 * 
 * Do NOT import this in Client Components (files with 'use client' directive).
 */

export interface GCPFileMetadata {
  name: string;
  path: string;
  size: number;
  contentType: string;
  created: Date;
  updated: Date;
  bucket: string;
  fullPath: string; // gs://bucket/path
}

export interface ListFilesOptions {
  prefix?: string;
  limit?: number;
  maxResults?: number;
}

export class GCPStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.GCS_BUCKET_NAME || 'julley-pms-dev';
  }

  /**
   * List files from GCP bucket
   */
  async listFiles(options: ListFilesOptions = {}): Promise<GCPFileMetadata[]> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const { prefix = '', limit = 100, maxResults = limit } = options;

      const [files] = await bucket.getFiles({
        prefix,
        maxResults,
      });

      return files.map((file) => ({
        name: file.name.split('/').pop() || file.name,
        path: file.name,
        size: Number(file.metadata.size || 0),
        contentType: file.metadata.contentType || 'application/octet-stream',
        created: file.metadata.timeCreated ? new Date(file.metadata.timeCreated) : new Date(),
        updated: file.metadata.updated ? new Date(file.metadata.updated) : new Date(),
        bucket: this.bucketName,
        fullPath: `gs://${this.bucketName}/${file.name}`,
      }));
    } catch (error) {
      console.error('Error listing files from GCP bucket:', error);
      
      // Enhanced error detection for authentication and permission errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);
      
      // Check error code and status code if available
      const errorCode = (error as any)?.code;
      const statusCode = (error as any)?.statusCode || (error as any)?.response?.statusCode;
      
      // Authentication error patterns
      const authErrorPatterns = [
        'invalid_grant',
        'invalid_rapt',
        'reauth',
        'Could not load the default credentials',
        'Could not refresh access token',
        'unauthorized',
        'Unauthorized',
        'authentication',
        'Authentication',
        'credentials',
        'Credential',
        'access_denied',
        'Access Denied',
      ];
      
      // Check if error is an authentication error
      const isAuthError = authErrorPatterns.some(pattern => 
        errorMessage.includes(pattern) || 
        errorString.includes(pattern)
      ) || 
      errorCode === 'UNAUTHENTICATED' ||
      statusCode === 401 ||
      statusCode === 403;
      
      if (isAuthError) {
        throw new Error(
          'GCP Authentication Error: Your Google Cloud credentials have expired or are invalid. ' +
          'Please refresh your authentication. If using Application Default Credentials (ADC), run: ' +
          '`gcloud auth application-default login`. If using a service account, verify the ' +
          'GOOGLE_APPLICATION_CREDENTIALS environment variable points to a valid service account key file.'
        );
      }
      
      // Permission/bucket access errors
      if (errorMessage.includes('ENOENT') || 
          errorMessage.includes('not found') ||
          errorCode === 'NOT_FOUND' ||
          statusCode === 404) {
        throw new Error(
          `GCP Bucket Not Found: The bucket "${this.bucketName}" does not exist or you don't have access to it. ` +
          'Please verify the bucket name and your permissions.'
        );
      }
      
      // Permission denied errors
      if (errorMessage.includes('permission denied') ||
          errorMessage.includes('Permission denied') ||
          errorCode === 'PERMISSION_DENIED' ||
          statusCode === 403) {
        throw new Error(
          `GCP Permission Denied: You don't have permission to access the bucket "${this.bucketName}". ` +
          'Please verify your service account has the Storage Object Viewer role for this bucket.'
        );
      }
      
      throw new Error(
        `Failed to list files from GCP bucket: ${errorMessage}`
      );
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<GCPFileMetadata | null> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [metadata] = await file.getMetadata();

      return {
        name: filePath.split('/').pop() || filePath,
        path: filePath,
        size: Number(metadata.size || 0),
        contentType: metadata.contentType || 'application/octet-stream',
        created: metadata.timeCreated ? new Date(metadata.timeCreated) : new Date(),
        updated: metadata.updated ? new Date(metadata.updated) : new Date(),
        bucket: this.bucketName,
        fullPath: `gs://${this.bucketName}/${filePath}`,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      return exists;
    } catch (error) {
      console.error('Error checking bucket existence:', error);
      return false;
    }
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }
}

// Export singleton instance
export const gcpStorageService = new GCPStorageService();

