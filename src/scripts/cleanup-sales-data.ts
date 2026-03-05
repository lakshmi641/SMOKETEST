/**
 * Sales Data Cleanup Script
 * 
 * This script cleans ONLY sales data from ClickHouse to allow reloading
 * a complete sales history file. It truncates:
 * 1. staging.staging_sales_book - Raw sales data from file uploads
 * 2. analytics.fact_sales - Processed sales fact table (main fact table)
 * 3. analytics.src_staging_sales_book - dbt view (dropped, will be recreated by dbt)
 * 
 * ⚠️ WARNING: This script permanently deletes sales data!
 * Use this when you want to reload sales data from scratch.
 * 
 * Note: Dimension tables (dim_item, dim_customer, etc.) are NOT cleaned
 * as they may be used by other fact tables or will be repopulated during processing.
 * 
 * Usage: 
 *   tsx apps/pms/src/scripts/cleanup-sales-data.ts
 * 
 * Environment Variables Required:
 *   - CLICKHOUSE_HOST
 *   - CLICKHOUSE_USERNAME
 *   - CLICKHOUSE_PASSWORD
 *   - CLICKHOUSE_DATABASE (optional, defaults to 'default')
 */

import { clickhouseClient } from '../lib/services/analytics/clickhouse-client';

interface CleanupStats {
  stagingRowsDeleted: number;
  analyticsRowsDeleted: number;
  viewsDropped: number;
  auditLogEntriesDeleted: number;
  totalRowsDeleted: number;
}

/**
 * Execute a ClickHouse query (for TRUNCATE, etc.)
 */
async function executeQuery(query: string, description: string): Promise<void> {
  try {
    const client = clickhouseClient.getClient();
    await client.exec({ query });
    console.log(`✅ ${description}`);
  } catch (error) {
    console.error(`❌ Error: ${description}`, error);
    throw error;
  }
}

/**
 * Get row count from a table
 */
async function getRowCount(database: string, table: string): Promise<number> {
  try {
    const client = clickhouseClient.getClient();
    const result = await client.query({
      query: `SELECT count() as cnt FROM ${database}.${table}`,
      format: 'JSONEachRow',
    });
    const data = await result.json() as Array<{ cnt: string | number }>;
    return Array.isArray(data) && data[0] ? Number(data[0].cnt) : 0;
  } catch (error) {
    // Table/view might not exist, return 0
    return 0;
  }
}

/**
 * Check if a table or view exists
 */
async function tableExists(database: string, table: string): Promise<boolean> {
  try {
    const client = clickhouseClient.getClient();
    const result = await client.query({
      query: `EXISTS TABLE ${database}.${table}`,
      format: 'JSONEachRow',
    });
    const data = await result.json() as Array<{ result: number }>;
    return Array.isArray(data) && data.length > 0 && (data[0]?.result ?? 0) === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Cleanup sales data from ClickHouse
 */
async function cleanupSalesData(): Promise<CleanupStats> {
  console.log('\n🗄️  Cleaning up Sales Data in ClickHouse...\n');

  const stats: CleanupStats = {
    stagingRowsDeleted: 0,
    analyticsRowsDeleted: 0,
    viewsDropped: 0,
    auditLogEntriesDeleted: 0,
    totalRowsDeleted: 0,
  };

  // 1. Clean staging table
  console.log('📋 Cleaning staging table: staging.staging_sales_book');
  try {
    const stagingRowCount = await getRowCount('staging', 'staging_sales_book');
    if (stagingRowCount > 0) {
      await executeQuery(
        `TRUNCATE TABLE staging.staging_sales_book`,
        `Truncated staging.staging_sales_book (${stagingRowCount.toLocaleString()} rows)`
      );
      stats.stagingRowsDeleted = stagingRowCount;
    } else {
      console.log(`  ⚪ staging.staging_sales_book is already empty`);
    }
  } catch (error) {
    console.error(`  ⚠️  Could not truncate staging.staging_sales_book:`, error);
    throw error;
  }

  // 2. Clean analytics fact table
  console.log('\n📊 Cleaning analytics table: analytics.fact_sales');
  try {
    const analyticsRowCount = await getRowCount('analytics', 'fact_sales');
    if (analyticsRowCount > 0) {
      await executeQuery(
        `TRUNCATE TABLE analytics.fact_sales`,
        `Truncated analytics.fact_sales (${analyticsRowCount.toLocaleString()} rows)`
      );
      stats.analyticsRowsDeleted = analyticsRowCount;
    } else {
      console.log(`  ⚪ analytics.fact_sales is already empty`);
    }
  } catch (error) {
    console.error(`  ⚠️  Could not truncate analytics.fact_sales:`, error);
    throw error;
  }

  // 3. Drop analytics.src_staging_sales_book view (dbt will recreate it)
  console.log('\n📊 Dropping analytics view: analytics.src_staging_sales_book');
  try {
    const exists = await tableExists('analytics', 'src_staging_sales_book');
    if (exists) {
      await executeQuery(
        `DROP VIEW IF EXISTS analytics.src_staging_sales_book`,
        `Dropped analytics.src_staging_sales_book view (will be recreated by dbt)`
      );
      stats.viewsDropped = 1;
    } else {
      console.log(`  ⚪ analytics.src_staging_sales_book does not exist`);
    }
  } catch (error) {
    console.error(`  ⚠️  Could not drop analytics.src_staging_sales_book:`, error);
    // Don't throw - this view might not exist in all setups
  }

  // 4. Clean audit log entries for sales files (allows re-uploading same filename)
  console.log('\n📝 Cleaning audit log entries for sales files...');
  try {
    const client = clickhouseClient.getClient();
    const result = await client.query({
      query: `
        SELECT count() as cnt 
        FROM logs.pipeline_audit_log 
        WHERE event_source = 'IngestionFunction' 
          AND (file_name LIKE '%sales%' OR file_name LIKE '%Sales%' OR event_type = 'Staging Load')
      `,
      format: 'JSONEachRow',
    });
    const data = await result.json() as Array<{ cnt: string | number }>;
    const auditLogCount = Array.isArray(data) && data[0] ? Number(data[0].cnt) : 0;
    
    if (auditLogCount > 0) {
      await executeQuery(
        `ALTER TABLE logs.pipeline_audit_log DELETE WHERE event_source = 'IngestionFunction' AND (file_name LIKE '%sales%' OR file_name LIKE '%Sales%' OR event_type = 'Staging Load')`,
        `Deleted ${auditLogCount.toLocaleString()} audit log entries for sales files (allows re-uploading same filename)`
      );
      stats.auditLogEntriesDeleted = auditLogCount;
    } else {
      console.log(`  ⚪ No sales-related audit log entries found`);
    }
  } catch (error) {
    console.error(`  ⚠️  Could not clean audit log entries:`, error);
    // Don't throw - this is optional
  }

  stats.totalRowsDeleted = stats.stagingRowsDeleted + stats.analyticsRowsDeleted;

  return stats;
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('🧹 Sales Data Cleanup Script');
  console.log('='.repeat(60));
  console.log('');
  console.log('⚠️  WARNING: This will permanently delete sales data!');
  console.log('   - staging.staging_sales_book (raw sales data)');
  console.log('   - analytics.fact_sales (processed sales fact table - main fact table)');
  console.log('   - analytics.src_staging_sales_book (dbt view, will be recreated)');
  console.log('');
  console.log('ℹ️  Note: Dimension tables are NOT cleaned.');
  console.log('   They will be repopulated when you reload sales data.');
  console.log('');

  // Test ClickHouse connection
  console.log('🔌 Testing ClickHouse connection...');
  const isConnected = await clickhouseClient.testConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to ClickHouse. Please check your connection settings.');
  }
  console.log('✅ ClickHouse connection successful\n');

  try {
    // Cleanup sales data
    const stats = await cleanupSalesData();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Sales Data Cleanup Complete!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:\n');

    console.log('🗄️  ClickHouse:');
    console.log(`   - Staging rows deleted: ${stats.stagingRowsDeleted.toLocaleString()}`);
    console.log(`   - Analytics fact_sales rows deleted: ${stats.analyticsRowsDeleted.toLocaleString()}`);
    console.log(`   - Views dropped: ${stats.viewsDropped}`);
    console.log(`   - Audit log entries deleted: ${stats.auditLogEntriesDeleted.toLocaleString()}`);
    console.log(`   - Total rows deleted: ${stats.totalRowsDeleted.toLocaleString()}`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Upload your new/updated sales data file through the UI');
    console.log('   2. The file will be processed automatically by the pipeline');
    console.log('   3. Data will flow: GCS → ClickHouse Staging → Analytics → Metabase');
    console.log('   4. Dimension tables will be automatically repopulated during processing');
    console.log('   5. Run dbt to transform: cd dbt && dbt run');
    console.log('');
    console.log('💡 Note: Audit log entries have been cleaned, so you can reuse the same filename.');

    await clickhouseClient.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    await clickhouseClient.close();
    process.exit(1);
  }
}

// Run the cleanup
main();

