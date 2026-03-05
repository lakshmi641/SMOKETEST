import { NextRequest, NextResponse } from 'next/server';
import { gcpStorageService } from '@/lib/services/gcp/gcp-storage-service';
import { pipelineService } from '@/lib/services/analytics/pipeline-service';

/**
 * GET /api/pipeline/files
 * List data management files from GCP bucket with processing status
 * 
 * Lists files from raw/, processed/, and failed/ folders to show all uploaded files
 * regardless of their processing status (since Firebase Functions move files after processing).
 * Query params:
 * - prefix: Optional custom prefix (defaults to listing all: raw/, processed/, failed/)
 * - limit: Maximum number of files to return (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customPrefix = searchParams.get('prefix');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // List files from all relevant folders: raw, processed, and failed
    // This ensures we see files even after they've been processed and moved
    const prefixes = customPrefix 
      ? [customPrefix]
      : ['raw/', 'processed/', 'failed/'];

    const allFiles: any[] = [];
    const errors: string[] = [];

    for (const prefix of prefixes) {
      try {
        // Get more files per prefix to account for multiple prefixes, then limit total
        const files = await gcpStorageService.listFiles({ prefix, limit: limit * 2 });
        console.log(`[API] Found ${files.length} files in GCP bucket with prefix '${prefix}'`);
        allFiles.push(...files);
      } catch (gcpError) {
        console.error(`Error listing files from prefix '${prefix}':`, gcpError);
        const errorMessage = gcpError instanceof Error ? gcpError.message : String(gcpError);
        const errorString = JSON.stringify(gcpError);
        
        // Enhanced authentication error detection
        const authErrorPatterns = [
          'Authentication',
          'invalid_grant',
          'invalid_rapt',
          'reauth',
          'Could not load the default credentials',
          'Could not refresh access token',
          'unauthorized',
          'Unauthorized',
          'credentials',
          'Credential',
          'access_denied',
          'Access Denied',
        ];
        
        const isAuthError = authErrorPatterns.some(pattern => 
          errorMessage.includes(pattern) || 
          errorString.includes(pattern)
        ) ||
        (gcpError as any)?.code === 'UNAUTHENTICATED' ||
        (gcpError as any)?.statusCode === 401 ||
        (gcpError as any)?.statusCode === 403;
        
        if (isAuthError) {
          // Return empty array with auth error for any prefix failure
          return NextResponse.json({
            success: true,
            data: [],
            bucket: gcpStorageService.getBucketName(),
            warning: errorMessage,
            isAuthError: true,
          });
        }
        
        errors.push(`Failed to list ${prefix}: ${errorMessage}`);
      }
    }

    // Remove duplicates (in case a file exists in multiple locations, which shouldn't happen)
    // Use path as unique key since that's the full GCP path
    const uniqueFilesMap = new Map<string, any>();
    allFiles.forEach(file => {
      // Keep the file from the most relevant location (raw > processed > failed)
      const locationPriority = file.path.startsWith('raw/') ? 0 : 
                               file.path.startsWith('processed/') ? 1 : 2;
      const existing = uniqueFilesMap.get(file.path);
      if (!existing || (existing.locationPriority || 999) > locationPriority) {
        uniqueFilesMap.set(file.path, { ...file, locationPriority });
      }
    });
    
    const uniqueFiles = Array.from(uniqueFilesMap.values())
      .sort((a, b) => {
        // Sort by location priority, then by created date (newest first)
        if (a.locationPriority !== b.locationPriority) {
          return a.locationPriority - b.locationPriority;
        }
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      })
      .slice(0, limit);

    console.log(`[API] Total unique files found: ${uniqueFiles.length} (from ${allFiles.length} total files across all prefixes)`);

    // Get processing status for each file
    // Try both filename and full path for status lookup
    const filesWithStatus = await Promise.all(
      uniqueFiles.map(async (file) => {
        try {
          // Try filename first (what Firebase Functions store)
          let status = await pipelineService.getFileStatus(file.name);
          
          // If not found, try with full path (in case audit log stores full path)
          if (!status && file.path !== file.name) {
            try {
              status = await pipelineService.getFileStatus(file.path);
            } catch (e) {
              // Ignore - we'll use null status
            }
          }
          
          return {
            ...file,
            processingStatus: status
              ? {
                  status: status.latestStatus,
                  lastProcessed: status.lastProcessed,
                  lastSuccess: status.lastSuccess,
                  lastFailure: status.lastFailure,
                  sourceRowCount: status.sourceRowCount,
                  targetRowCount: status.targetRowCount,
                  lastError: status.lastError,
                }
              : null,
          };
        } catch (error) {
          console.error(`Error getting status for file ${file.name} (path: ${file.path}):`, error);
          // Return file even if status lookup fails - it should still appear in the list
          return {
            ...file,
            processingStatus: null,
          };
        }
      })
    );

    console.log(`[API] Returning ${filesWithStatus.length} files, ${filesWithStatus.filter(f => f.processingStatus).length} with status`);

    return NextResponse.json({
      success: true,
      data: filesWithStatus,
      bucket: gcpStorageService.getBucketName(),
      ...(errors.length > 0 && { warnings: errors }),
    });
  } catch (error) {
    console.error('Error listing pipeline files:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

