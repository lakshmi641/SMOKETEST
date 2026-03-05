import { analyticsService } from './analytics-service';
import { getDataObjectById as getDataObjectByIdDef, type DataObject } from './data-objects';

/**
 * Data Object Service
 * 
 * Manages data objects (tables) in ClickHouse and provides methods
 * to query and manage them.
 * 
 * ⚠️ SERVER-ONLY: This service uses ClickHouse and should only be used in API routes.
 */

/**
 * Get table data with pagination
 */
export async function getTableData(
  tableName: string,
  companyId?: string | null, // Optional - no longer used in query
  page: number = 1,
  pageSize: number = 50,
  filters?: Record<string, any>
): Promise<{
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    // Build WHERE clause - use parameterized query for table name
    // Note: ClickHouse doesn't support parameterized table names, so we need to validate
    const validTableNames = ['analytics.fact_sales']; // Main fact table for sales analytics
    if (!validTableNames.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}. Valid tables: ${validTableNames.join(', ')}`);
    }
    
    // Check if table exists
    const tableExists = await analyticsService.tableExists(tableName);
    if (!tableExists) {
      throw new Error(
        `Table "${tableName}" does not exist in ClickHouse. ` +
        `Please ensure the table is created manually or run dbt transformations. ` +
        `For analytics.fact_sales, run: cd dbt && dbt run`
      );
    }
    
    let whereClause = '';
    const params: Record<string, any> = {};
    
    if (filters) {
      const filterConditions: string[] = [];
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          filterConditions.push(`${key} = {${key}:String}`);
          params[key] = value;
        }
      });
      if (filterConditions.length > 0) {
        whereClause = `WHERE ${filterConditions.join(' AND ')}`;
      }
    }
    
    // Get total count - use string interpolation for table name (validated above)
    const countSql = `SELECT count() as total FROM ${tableName} ${whereClause}`;
    const countResult = await analyticsService.query<{ total: number }>(countSql, params);
    const total = countResult[0]?.total || 0;
    
    // Get paginated data
    // Determine order by column based on table name
    let orderByColumn = 'loaded_at DESC';
    if (tableName === 'analytics.fact_sales') {
      // For fact_sales, order by invoice_date and voucher_no
      orderByColumn = 'invoice_date DESC, voucher_no DESC';
    }
    
    const offset = (page - 1) * pageSize;
    const dataSql = `
      SELECT *
      FROM ${tableName}
      ${whereClause}
      ORDER BY ${orderByColumn}
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;
    
    params.limit = pageSize;
    params.offset = offset;
    
    console.log('Executing query:', dataSql);
    console.log('With params:', params);
    
    const data = await analyticsService.query(dataSql, params);
    console.log('Query returned', data?.length || 0, 'rows');
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error('Error fetching table data:', error);
    console.error('Error type:', typeof error);
    console.error('Error details:', error);
    
    // Check if error is about table not existing
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Unknown table') || errorMessage.includes('does not exist')) {
      throw new Error(
        `Table "${tableName}" does not exist in ClickHouse. ` +
        `The table may need to be created or data needs to be uploaded first. ` +
        `For analytics.fact_sales, run: cd dbt && dbt run`
      );
    }
    
    const errorStack = error instanceof Error ? error.stack : undefined;
    throw new Error(`Failed to fetch data: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`);
  }
}

/**
 * Get table schema/columns
 */
export async function getTableColumns(tableName: string): Promise<Array<{
  name: string;
  type: string;
  default_kind: string;
  default_expression: string;
  comment: string;
}>> {
  return analyticsService.getTableSchema(tableName);
}

// Re-export data object functions for server-side use
export { getDataObjectByIdDef as getDataObjectById };
export type { DataObject };

