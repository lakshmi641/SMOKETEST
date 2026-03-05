import { NextRequest, NextResponse } from 'next/server';
import { pipelineService } from '@/lib/services/analytics/pipeline-service';

/**
 * GET /api/pipeline/summary
 * Get pipeline summary/health metrics
 */
export async function GET(request: NextRequest) {
  try {
    const summary = await pipelineService.getPipelineSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error getting pipeline summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipeline summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

