/**
 * Group Revenue Service
 * 
 * Service for querying aggregated revenue data across all companies
 * from the multi-company sales analytics view (default.view_sales_analytics).
 * 
 * All queries aggregate data across Company_Name to provide group-level insights.
 */

import { analyticsService } from './analytics-service';

/**
 * Get group-level revenue summary across all companies
 */
export async function getGroupRevenueSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  totalTax: number;
  totalProfit: number;
  marginPercentage: number;
  totalQuantity: number;
}> {
  const sql = `
    SELECT 
      sum(Total_Revenue) as totalRevenue,
      count() as totalTransactions,
      avg(Total_Revenue) as averageTransactionValue,
      sum(Total_Tax) as totalTax,
      sum(Profit) as totalProfit,
      avg(Margin_Percentage) as marginPercentage,
      sum(Quantity) as totalQuantity
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
  `;

  const results = await analyticsService.query<{
    totalRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
    totalTax: number;
    totalProfit: number;
    marginPercentage: number;
    totalQuantity: number;
  }>(sql, { startDate, endDate });

  return results[0] || {
    totalRevenue: 0,
    totalTransactions: 0,
    averageTransactionValue: 0,
    totalTax: 0,
    totalProfit: 0,
    marginPercentage: 0,
    totalQuantity: 0,
  };
}

/**
 * Get revenue breakdown by company
 */
export async function getRevenueByCompany(
  startDate: string,
  endDate: string
): Promise<Array<{
  companyName: string;
  totalRevenue: number;
  transactionCount: number;
  totalProfit: number;
  marginPercentage: number;
  revenueShare: number;
}>> {
  const sql = `
    SELECT 
      Company_Name as companyName,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount,
      sum(Profit) as totalProfit,
      avg(Margin_Percentage) as marginPercentage
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
    GROUP BY Company_Name
    ORDER BY totalRevenue DESC
  `;

  const results = await analyticsService.query<{
    companyName: string;
    totalRevenue: number;
    transactionCount: number;
    totalProfit: number;
    marginPercentage: number;
  }>(sql, { startDate, endDate });

  // Calculate total revenue for share calculation
  const totalRevenue = results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);

  // Add revenue share percentage
  return results.map((r) => ({
    ...r,
    revenueShare: totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0,
  }));
}

/**
 * Get revenue trend over time
 */
export async function getRevenueTrend(
  startDate: string,
  endDate: string,
  granularity: 'daily' | 'monthly' | 'quarterly' = 'daily'
): Promise<Array<{
  period: string;
  totalRevenue: number;
  transactionCount: number;
  totalProfit: number;
}>> {
  let dateGrouping: string;
  switch (granularity) {
    case 'monthly':
      dateGrouping = 'toStartOfMonth(Transaction_Date)';
      break;
    case 'quarterly':
      dateGrouping = 'toStartOfQuarter(Transaction_Date)';
      break;
    default:
      dateGrouping = 'Transaction_Date';
  }

  const sql = `
    SELECT 
      toString(${dateGrouping}) as period,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount,
      sum(Profit) as totalProfit
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
    GROUP BY period
    ORDER BY period
  `;

  return analyticsService.query(sql, { startDate, endDate });
}

/**
 * Get revenue by region across all companies
 */
export async function getRevenueByRegion(
  startDate: string,
  endDate: string
): Promise<Array<{
  regionName: string;
  totalRevenue: number;
  transactionCount: number;
  revenueShare: number;
}>> {
  const sql = `
    SELECT 
      Region_Name as regionName,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
      AND Region_Name != ''
    GROUP BY Region_Name
    ORDER BY totalRevenue DESC
  `;

  const results = await analyticsService.query<{
    regionName: string;
    totalRevenue: number;
    transactionCount: number;
  }>(sql, { startDate, endDate });

  const totalRevenue = results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);

  return results.map((r) => ({
    ...r,
    revenueShare: totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0,
  }));
}

/**
 * Get revenue by product category
 */
export async function getRevenueByProductCategory(
  startDate: string,
  endDate: string
): Promise<Array<{
  productCategory: string;
  totalRevenue: number;
  transactionCount: number;
  totalQuantity: number;
  revenueShare: number;
}>> {
  const sql = `
    SELECT 
      Product_Category as productCategory,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount,
      sum(Quantity) as totalQuantity
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
    GROUP BY Product_Category
    ORDER BY totalRevenue DESC
  `;

  const results = await analyticsService.query<{
    productCategory: string;
    totalRevenue: number;
    transactionCount: number;
    totalQuantity: number;
  }>(sql, { startDate, endDate });

  const totalRevenue = results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);

  return results.map((r) => ({
    ...r,
    revenueShare: totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0,
  }));
}

/**
 * Get revenue by industry type
 */
export async function getRevenueByIndustryType(
  startDate: string,
  endDate: string
): Promise<Array<{
  industryType: string;
  totalRevenue: number;
  transactionCount: number;
  revenueShare: number;
}>> {
  const sql = `
    SELECT 
      Industry_Type_Name as industryType,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
      AND Industry_Type_Name != ''
    GROUP BY Industry_Type_Name
    ORDER BY totalRevenue DESC
  `;

  const results = await analyticsService.query<{
    industryType: string;
    totalRevenue: number;
    transactionCount: number;
  }>(sql, { startDate, endDate });

  const totalRevenue = results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);

  return results.map((r) => ({
    ...r,
    revenueShare: totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0,
  }));
}

/**
 * Get top customers across all companies
 */
export async function getTopCustomers(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<Array<{
  customerName: string;
  companyName: string;
  totalRevenue: number;
  transactionCount: number;
  totalQuantity: number;
}>> {
  const sql = `
    SELECT 
      Customer_Name as customerName,
      Company_Name as companyName,
      sum(Total_Revenue) as totalRevenue,
      count() as transactionCount,
      sum(Quantity) as totalQuantity
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
      AND Customer_Name != ''
    GROUP BY Customer_Name, Company_Name
    ORDER BY totalRevenue DESC
    LIMIT {limit:UInt32}
  `;

  return analyticsService.query(sql, { startDate, endDate, limit });
}

/**
 * Get top products across all companies
 */
export async function getTopProducts(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<Array<{
  itemName: string;
  itemCode: string;
  companyName: string;
  productCategory: string;
  totalRevenue: number;
  totalQuantity: number;
  transactionCount: number;
}>> {
  const sql = `
    SELECT 
      Item_Name as itemName,
      Item_Code as itemCode,
      Company_Name as companyName,
      Product_Category as productCategory,
      sum(Total_Revenue) as totalRevenue,
      sum(Quantity) as totalQuantity,
      count() as transactionCount
    FROM default.view_sales_analytics
    WHERE Transaction_Date >= {startDate:Date}
      AND Transaction_Date <= {endDate:Date}
      AND Item_Name != ''
    GROUP BY Item_Name, Item_Code, Company_Name, Product_Category
    ORDER BY totalRevenue DESC
    LIMIT {limit:UInt32}
  `;

  return analyticsService.query(sql, { startDate, endDate, limit });
}

