import { NextRequest, NextResponse } from 'next/server';
import { parseExcelToSalesTransactions } from '@/lib/services/analytics/excel-parser';
import { logger } from '@/lib/logger';

/**
 * POST /api/sales/upload
 * Upload sales data from Excel file
 * 
 * ⚠️ DEPRECATED: This endpoint was designed for the legacy sales_transactions table.
 * 
 * Sales data should now be uploaded through the main data pipeline:
 * - Use /api/data/upload endpoint instead
 * - Files are processed through: GCS → staging.staging_sales_book → analytics.fact_sales (via dbt)
 * 
 * This endpoint is kept for backward compatibility but may not work correctly
 * since sales_transactions table has been removed.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const userId = formData.get('userId') as string | undefined;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx, .xls)' },
        { status: 400 }
      );
    }

    // Parse Excel file
    let parseResult;
    try {
      parseResult = await parseExcelToSalesTransactions(
        file,
        companyId,
        userId,
        file.name
      );
    } catch (parseError) {
      logger.error('Excel parsing error:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse Excel file',
          message: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          details: parseError instanceof Error ? parseError.stack : undefined,
        },
        { status: 400 }
      );
    }

    if (parseResult.transactions.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid transactions found in the file',
          details: {
            totalRows: parseResult.totalRows,
            parsedRows: parseResult.parsedRows,
            errors: parseResult.errors,
          },
          suggestions: [
            'Ensure your Excel file has a header row with column names',
            'Required columns: Date (or Transaction Date) and Amount (or Total)',
            'Check that date values are in a recognizable format (DD/MM/YYYY, MM/DD/YYYY, etc.)',
            'Check that amount values are numeric',
          ],
        },
        { status: 400 }
      );
    }

    // ⚠️ DEPRECATED: sales_transactions table has been removed
    // Sales data should be uploaded through the main pipeline at /api/data/upload
    return NextResponse.json(
      {
        error: 'This endpoint is deprecated',
        message: 'Sales data should be uploaded through the main data pipeline',
        suggestion: 'Use /api/data/upload endpoint instead. Files will be processed through: GCS → staging.staging_sales_book → analytics.fact_sales (via dbt)',
        deprecated: true,
      },
      { status: 410 } // 410 Gone - indicates the resource is no longer available
    );
  } catch (error) {
    logger.error('Sales upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload sales data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

