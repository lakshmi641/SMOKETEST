import { analyticsService } from './analytics-service';
import { SalesTransaction, CREATE_SALES_TABLE_SQL, CREATE_SALES_INDEXES_SQL } from './sales-schema';
import { logger } from '@/lib/logger';

/**
 * Sales Service
 * 
 * ⚠️ DEPRECATED: This service uses the legacy sales_transactions table.
 * The main fact table for sales analytics is analytics.fact_sales (star schema).
 * 
 * This service is kept for backward compatibility but should be migrated to use
 * analytics.fact_sales instead. All Metabase dashboards use analytics.fact_sales.
 * 
 * Handles sales data operations in ClickHouse including:
 * - Table creation and schema management
 * - Data insertion
 * - Querying sales data for reports
 */
export class SalesService {
  /**
   * Initialize sales table schema
   */
  async initializeSchema(): Promise<void> {
    try {
      // Check if table already exists
      const tableExists = await analyticsService.tableExists('sales_transactions');
      if (tableExists) {
        logger.info('Sales transactions table already exists');
        return;
      }
      
      logger.info('Creating sales_transactions table...');
      // Create main table
      await analyticsService.query(CREATE_SALES_TABLE_SQL);
      logger.info('Sales transactions table created successfully');
      
      // Create indexes (these may fail if already exist, which is fine)
      for (const indexSql of CREATE_SALES_INDEXES_SQL) {
        try {
          await analyticsService.query(indexSql);
        } catch (error) {
          // Index might already exist, ignore
          logger.debug('Index creation skipped (may already exist):', error);
        }
      }
    } catch (error) {
      logger.error('Error initializing sales schema:', error);
      throw error;
    }
  }

  /**
   * Insert sales transactions in batch
   */
  async insertSalesTransactions(transactions: SalesTransaction[]): Promise<void> {
    if (transactions.length === 0) {
      return;
    }

    try {
      await analyticsService.insert('sales_transactions', transactions);
    } catch (error) {
      logger.error('Error inserting sales transactions:', error);
      throw new Error(`Failed to insert sales transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sales summary by date range
   */
  async getSalesSummary(
    companyId: string,
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
        sum(total_amount) as totalSales,
        count() as totalTransactions,
        avg(total_amount) as averageTransaction,
        sum(tax_amount) as totalTax,
        sum(discount_amount) as totalDiscount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= {startDate:Date}
        AND transaction_date <= {endDate:Date}
    `;

    const results = await analyticsService.query<{
      totalSales: number;
      totalTransactions: number;
      averageTransaction: number;
      totalTax: number;
      totalDiscount: number;
    }>(sql, { companyId, startDate, endDate });

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
  async getSalesByDate(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; totalSales: number; transactionCount: number }>> {
    const sql = `
      SELECT 
        toDate(transaction_date) as date,
        sum(total_amount) as totalSales,
        count() as transactionCount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= {startDate:Date}
        AND transaction_date <= {endDate:Date}
      GROUP BY date
      ORDER BY date
    `;

    return analyticsService.query(sql, { companyId, startDate, endDate });
  }

  /**
   * Get sales by customer
   */
  async getSalesByCustomer(
    companyId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<Array<{ customerName: string; customerCode: string; totalSales: number; transactionCount: number }>> {
    const sql = `
      SELECT 
        customer_name as customerName,
        customer_code as customerCode,
        sum(total_amount) as totalSales,
        count() as transactionCount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= {startDate:Date}
        AND transaction_date <= {endDate:Date}
        AND customer_name IS NOT NULL
      GROUP BY customerName, customerCode
      ORDER BY totalSales DESC
      LIMIT {limit:UInt32}
    `;

    return analyticsService.query(sql, { companyId, startDate, endDate, limit });
  }

  /**
   * Get sales by product
   */
  async getSalesByProduct(
    companyId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<Array<{ productName: string; productCode: string; totalSales: number; totalQuantity: number; transactionCount: number }>> {
    const sql = `
      SELECT 
        product_name as productName,
        product_code as productCode,
        sum(total_amount) as totalSales,
        sum(quantity) as totalQuantity,
        count() as transactionCount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= {startDate:Date}
        AND transaction_date <= {endDate:Date}
        AND product_name IS NOT NULL
      GROUP BY productName, productCode
      ORDER BY totalSales DESC
      LIMIT {limit:UInt32}
    `;

    return analyticsService.query(sql, { companyId, startDate, endDate, limit });
  }

  /**
   * Get sales by sales person
   */
  async getSalesBySalesPerson(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ salesPerson: string; totalSales: number; transactionCount: number }>> {
    const sql = `
      SELECT 
        sales_person as salesPerson,
        sum(total_amount) as totalSales,
        count() as transactionCount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= {startDate:Date}
        AND transaction_date <= {endDate:Date}
        AND sales_person IS NOT NULL
      GROUP BY salesPerson
      ORDER BY totalSales DESC
    `;

    return analyticsService.query(sql, { companyId, startDate, endDate });
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(
    companyId: string,
    limit: number = 50
  ): Promise<Array<SalesTransaction & { date: string }>> {
    const sql = `
      SELECT *
      FROM sales_transactions
      WHERE company_id = {companyId:String}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT {limit:UInt32}
    `;

    return analyticsService.query(sql, { companyId, limit });
  }

  /**
   * Get monthly sales trend
   */
  async getMonthlySalesTrend(
    companyId: string,
    months: number = 12
  ): Promise<Array<{ month: string; totalSales: number; transactionCount: number }>> {
    const sql = `
      SELECT 
        toStartOfMonth(transaction_date) as month,
        sum(total_amount) as totalSales,
        count() as transactionCount
      FROM sales_transactions
      WHERE company_id = {companyId:String}
        AND transaction_date >= today() - INTERVAL {months:UInt32} MONTH
      GROUP BY month
      ORDER BY month
    `;

    return analyticsService.query(sql, { companyId, months });
  }
}

// Export singleton instance
export const salesService = new SalesService();

