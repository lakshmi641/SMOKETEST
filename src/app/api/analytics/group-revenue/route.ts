import { NextRequest, NextResponse } from 'next/server';
import * as groupRevenueService from '@/lib/services/analytics/group-revenue-service';

/**
 * GET /api/analytics/group-revenue
 * Get group-level revenue reports aggregated across all companies
 * 
 * Query parameters:
 * - startDate: Start date (YYYY-MM-DD)
 * - endDate: End date (YYYY-MM-DD)
 * - type: Report type (summary, byCompany, trend, byRegion, byCategory, byIndustry, topCustomers, topProducts)
 * - granularity: For trend type (daily, monthly, quarterly)
 * - limit: For topCustomers and topProducts (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type') || 'summary';
    const granularity = searchParams.get('granularity') as 'daily' | 'monthly' | 'quarterly' | null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Default date range: last 30 days
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const queryStartDate = (startDate ?? defaultStartDate) as string;
    const queryEndDate = (endDate ?? defaultEndDate) as string;

    let data: any;

    switch (reportType) {
      case 'summary':
        data = await groupRevenueService.getGroupRevenueSummary(
          queryStartDate,
          queryEndDate
        );
        break;

      case 'byCompany':
        data = await groupRevenueService.getRevenueByCompany(
          queryStartDate,
          queryEndDate
        );
        break;

      case 'trend':
        data = await groupRevenueService.getRevenueTrend(
          queryStartDate,
          queryEndDate,
          granularity || 'daily'
        );
        break;

      case 'byRegion':
        data = await groupRevenueService.getRevenueByRegion(
          queryStartDate,
          queryEndDate
        );
        break;

      case 'byCategory':
        data = await groupRevenueService.getRevenueByProductCategory(
          queryStartDate,
          queryEndDate
        );
        break;

      case 'byIndustry':
        data = await groupRevenueService.getRevenueByIndustryType(
          queryStartDate,
          queryEndDate
        );
        break;

      case 'topCustomers':
        data = await groupRevenueService.getTopCustomers(
          queryStartDate,
          queryEndDate,
          limit
        );
        break;

      case 'topProducts':
        data = await groupRevenueService.getTopProducts(
          queryStartDate,
          queryEndDate,
          limit
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid report type: ${reportType}`,
            validTypes: [
              'summary',
              'byCompany',
              'trend',
              'byRegion',
              'byCategory',
              'byIndustry',
              'topCustomers',
              'topProducts',
            ],
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
      dateRange: {
        startDate: queryStartDate,
        endDate: queryEndDate,
      },
    });
  } catch (error) {
    console.error('Error fetching group revenue data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch group revenue data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

