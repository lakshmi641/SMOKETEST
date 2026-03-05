export { clickhouseClient, ClickHouseClientService } from './clickhouse-client';
export { analyticsService, AnalyticsService } from './analytics-service';
// Legacy service (deprecated - uses sales_transactions table which has been removed)
export { salesService, SalesService } from './sales-service';

// New service (uses analytics.fact_sales - star schema)
export * as factSalesService from './fact-sales-service';
export { parseExcelToSalesTransactions } from './excel-parser';
// Server-only exports (ClickHouse dependent)
export { getTableData, getTableColumns } from './data-object-service';
// Client-safe exports (no ClickHouse dependency)
export { getDataObjects, getDataObjectById } from './data-objects';
export type { SalesTransaction } from './sales-schema';
export type { ExcelParseResult } from './excel-parser';
export type { DataObject } from './data-objects';

