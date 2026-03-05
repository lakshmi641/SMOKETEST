/**
 * Fact Sales Service
 * 
 * Service for querying sales data from analytics.fact_sales (star schema).
 * This is the main fact table for sales analytics, replacing the legacy sales_transactions table.
 * 
 * All queries join with dimension tables to provide human-readable names.
 * 
 * Note: fact_sales does not have company_id. All sales data is queried without company filtering.
 * This is intentional - company_id is not needed for the current implementation.
 */

import { analyticsService } from './analytics-service';

/**
 * Get sales summary by date range
 */
export async function getSalesSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalSales: number;
  totalTransactions: number;
  averageTransaction: number;
  totalTax: number;
  totalDiscount: number;
}> {
  const sql = `
    SELECT 
      sum(gross_amount) as totalSales,
      count() as totalTransactions,
      avg(gross_amount) as averageTransaction,
      sum(total_tax) as totalTax,
      0 as totalDiscount
    FROM analytics.fact_sales
    WHERE invoice_posting_date >= {startDate:Date}
      AND invoice_posting_date <= {endDate:Date}
  `;

  const results = await analyticsService.query<{
    totalSales: number;
    totalTransactions: number;
    averageTransaction: number;
    totalTax: number;
    totalDiscount: number;
  }>(sql, { startDate, endDate });

  return results[0] || {
    totalSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    totalTax: 0,
    totalDiscount: 0,
  };
}

/**
 * Get sales by date (daily aggregation)
 */
export async function getSalesByDate(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; totalSales: number; transactionCount: number }>> {
  const sql = `
    SELECT 
      invoice_posting_date as date,
      sum(gross_amount) as totalSales,
      count() as transactionCount
    FROM analytics.fact_sales
    WHERE invoice_posting_date >= {startDate:Date}
      AND invoice_posting_date <= {endDate:Date}
    GROUP BY date
    ORDER BY date
  `;

  return analyticsService.query(sql, { startDate, endDate });
}

/**
 * Get sales by customer
 * Joins with dim_customer to get customer names
 */
export async function getSalesByCustomer(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<Array<{ customerName: string; customerCode: string; totalSales: number; transactionCount: number }>> {
  const sql = `
    SELECT 
      COALESCE(dc.customer_name, fs.customer_key, 'Unknown') as customerName,
      fs.customer_key as customerCode,
      sum(fs.gross_amount) as totalSales,
      count() as transactionCount
    FROM analytics.fact_sales fs
    LEFT JOIN analytics.dim_customer dc ON fs.customer_key = dc.customer_key
    WHERE fs.invoice_posting_date >= {startDate:Date}
      AND fs.invoice_posting_date <= {endDate:Date}
      AND fs.customer_key != 'N/A'
    GROUP BY customerName, customerCode
    ORDER BY totalSales DESC
    LIMIT {limit:UInt32}
  `;

  return analyticsService.query(sql, { startDate, endDate, limit });
}

/**
 * Get sales by product/item
 * Joins with dim_item to get item names
 */
export async function getSalesByProduct(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<Array<{ productName: string; productCode: string; totalSales: number; totalQuantity: number; transactionCount: number }>> {
  const sql = `
    SELECT 
      COALESCE(di.item_name, fs.item_key, 'Unknown') as productName,
      fs.item_key as productCode,
      sum(fs.gross_amount) as totalSales,
      sum(fs.quantity) as totalQuantity,
      count() as transactionCount
    FROM analytics.fact_sales fs
    LEFT JOIN analytics.dim_item di ON fs.item_key = di.item_key
    WHERE fs.invoice_posting_date >= {startDate:Date}
      AND fs.invoice_posting_date <= {endDate:Date}
      AND fs.item_key != 'N/A'
    GROUP BY productName, productCode
    ORDER BY totalSales DESC
    LIMIT {limit:UInt32}
  `;

  return analyticsService.query(sql, { startDate, endDate, limit });
}

/**
 * Get sales by sales person
 * Note: fact_sales doesn't have sales_person field directly.
 * This returns empty results for now, but keeps the API compatible.
 */
export async function getSalesBySalesPerson(
  startDate: string,
  endDate: string
): Promise<Array<{ salesPerson: string; totalSales: number; transactionCount: number }>> {
  // fact_sales doesn't have sales_person field
  // Return empty array to maintain API compatibility
  return [];
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(
  limit: number = 50
): Promise<Array<{
  invoice_date: string;
  voucher_no: string;
  customer_key: string;
  item_key: string;
  quantity: number;
  rate: number;
  total_value: number;
  total_tax: number;
  loaded_at: string;
}>> {
  const sql = `
    SELECT 
      toString(invoice_posting_date) as invoice_date,
      voucher_no,
      customer_key,
      item_key,
      quantity,
      rate,
      gross_amount as total_value,
      total_tax,
      toString(loaded_at) as loaded_at
    FROM analytics.fact_sales
    ORDER BY invoice_posting_date DESC, voucher_no DESC
    LIMIT {limit:UInt32}
  `;

  return analyticsService.query(sql, { limit });
}

/**
 * Get monthly sales trend
 */
export async function getMonthlySalesTrend(
  months: number = 12
): Promise<Array<{ month: string; totalSales: number; transactionCount: number }>> {
  const sql = `
    SELECT 
      toString(toStartOfMonth(invoice_posting_date)) as month,
      sum(gross_amount) as totalSales,
      count() as transactionCount
    FROM analytics.fact_sales
    WHERE invoice_posting_date >= today() - INTERVAL {months:UInt32} MONTH
    GROUP BY month
    ORDER BY month
  `;

  return analyticsService.query(sql, { months });
}

