/**
 * Metabase Embedding API Route
 * 
 * Generates signed embedding URLs for Metabase dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetabaseService } from '@/lib/services/metabase-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dashboardId = searchParams.get('dashboardId');
    const questionId = searchParams.get('questionId');

    if (!dashboardId && !questionId) {
      return NextResponse.json(
        { success: false, error: 'dashboardId or questionId is required' },
        { status: 400 }
      );
    }

    // Parse additional parameters (excluding dashboardId, questionId)
    const params: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'dashboardId' && key !== 'questionId') {
        params[key] = value;
      }
    });

    let embeddingUrl: string;

    const metabaseService = getMetabaseService();
    
    if (dashboardId) {
      embeddingUrl = metabaseService.generateEmbeddingUrl({
        dashboardId: parseInt(dashboardId, 10),
        params,
      });
    } else if (questionId) {
      embeddingUrl = metabaseService.generateQuestionEmbeddingUrl(
        parseInt(questionId, 10),
        params
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      url: embeddingUrl,
    });
  } catch (error) {
    console.error('Error generating Metabase embedding URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

