import { NextRequest, NextResponse } from 'next/server';
import * as factSalesService from '@/lib/services/analytics/fact-sales-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/sales/report
 * Get sales report data from analytics.fact_sales (star schema)
 * 
 * Note: companyId parameter is accepted for API compatibility but not used.
 * fact_sales does not have company_id - this is intentional and company filtering is not needed.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId'); // Kept for API compatibility
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type') || 'summary';

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
        data = await factSalesService.getSalesSummary(queryStartDate, queryEndDate);
        break;
      case 'byDate':
        data = await factSalesService.getSalesByDate(queryStartDate, queryEndDate);
        break;
      case 'byCustomer':
        const customerLimit = parseInt(searchParams.get('limit') || '10', 10);
        data = await factSalesService.getSalesByCustomer(queryStartDate, queryEndDate, customerLimit);
        break;
      case 'byProduct':
        const productLimit = parseInt(searchParams.get('limit') || '10', 10);
        data = await factSalesService.getSalesByProduct(queryStartDate, queryEndDate, productLimit);
        break;
      case 'bySalesPerson':
        data = await factSalesService.getSalesBySalesPerson(queryStartDate, queryEndDate);
        break;
      case 'monthlyTrend':
        const months = parseInt(searchParams.get('months') || '12', 10);
        data = await factSalesService.getMonthlySalesTrend(months);
        break;
      case 'recent':
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        data = await factSalesService.getRecentTransactions(limit);
        break;
      default:
        return NextResponse.json(
          { error: `Invalid report type: ${reportType}` },
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
    logger.error('Sales report error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch sales report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

