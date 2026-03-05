import { NextRequest, NextResponse } from 'next/server';
import { getTableData } from '@/lib/services/analytics/data-object-service';
import { getDataObjectById } from '@/lib/services/analytics/data-objects';

/**
 * GET /api/data-objects/[objectId]/data
 * Get paginated data for a specific data object
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ objectId: string }> }
) {
  try {
    const { objectId } = await params;
    
    console.log('API route called with objectId:', objectId);
    console.log('Request URL:', request.url);
    
    const searchParams = request.nextUrl.searchParams;
    
    const companyId = searchParams.get('companyId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    
    // CompanyId is now optional - removed the filter requirement
    
    const dataObject = getDataObjectById(objectId);
    if (!dataObject) {
      return NextResponse.json(
        { error: `Data object ${objectId} not found` },
        { status: 404 }
      );
    }
    
    // Build filters from query params
    const filters: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      if (!['companyId', 'page', 'pageSize'].includes(key)) {
        filters[key] = value;
      }
    });
    
    console.log('Fetching data for object:', objectId, 'table:', dataObject.tableName, 'companyId:', companyId);
    
    const result = await getTableData(
      dataObject.tableName,
      companyId,
      page,
      pageSize,
      filters
    );
    
    console.log('Data fetched successfully:', {
      rowCount: result.data?.length || 0,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
    
    return NextResponse.json({
      success: true,
      data: result.data || [],
      pagination: {
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || 50,
        totalPages: result.totalPages || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching data object data:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? (error instanceof Error ? error.stack : String(error))
      : undefined;
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch data',
        message: errorMessage,
        details: errorDetails,
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

