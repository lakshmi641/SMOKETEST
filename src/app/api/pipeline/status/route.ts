import { NextRequest, NextResponse } from 'next/server';
import { pipelineService } from '@/lib/services/analytics/pipeline-service';

/**
 * GET /api/pipeline/status
 * Get pipeline status for files
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('fileName') || undefined;
    const status = searchParams.get('status') as
      | 'success'
      | 'fail'
      | 'in_progress'
      | 'skipped_duplicate'
      | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let result;

    if (fileName) {
      // Get status for specific file
      const fileStatus = await pipelineService.getFileStatus(fileName);
      if (!fileStatus) {
        return NextResponse.json(
          {
            success: false,
            error: 'File not found',
          },
          { status: 404 }
        );
      }
      result = fileStatus;
    } else if (status) {
      // Get files by status
      const files = await pipelineService.getFilesByStatus(status, limit);
      result = files;
    } else {
      // Get recent files
      const files = await pipelineService.getRecentFiles(limit);
      result = files;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting pipeline status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipeline status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

