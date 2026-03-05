/**
 * Comprehensive Pipeline Data Cleanup Script
 * 
 * This script performs a complete cleanup of the entire analytics pipeline:
 * 1. ClickHouse: Truncates all staging, analytics, and logs tables
 * 2. GCP Storage: Deletes all files from raw/, processed/, and failed/ folders
 * 3. Optionally: Metabase cleanup (manual step recommended)
 * 
 * ⚠️ WARNING: This script permanently deletes all pipeline data!
 * Use this when you want to start fresh and reprocess files from scratch.
 * 
 * Usage: 
 *   tsx apps/pms/src/scripts/cleanup-pipeline-data.ts
 * 
 * Environment Variables Required:
 *   - CLICKHOUSE_HOST
 *   - CLICKHOUSE_USERNAME
 *   - CLICKHOUSE_PASSWORD
 *   - GCS_BUCKET_NAME (or defaults to 'julley-pms-dev')
 *   - GOOGLE_APPLICATION_CREDENTIALS (for GCP authentication)
 */

import { clickhouseClient } from '../lib/services/analytics/clickhouse-client';
import { Storage } from '@google-cloud/storage';

interface CleanupStats {
  clickhouse: {
    stagingTables: number;
    analyticsTables: number;
    logsTables: number;
    totalRowsDeleted: number;
  };
  gcpStorage: {
    rawFiles: number;
    processedFiles: number;
    failedFiles: number;
    totalFilesDeleted: number;
    totalSizeDeleted: number;
  };
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
    // Table might not exist, return 0
    return 0;
  }
}

/**
 * Cleanup ClickHouse databases
 */
async function cleanupClickHouse(): Promise<CleanupStats['clickhouse']> {
  console.log('\n🗄️  Cleaning up ClickHouse databases...\n');

  const stats = {
    stagingTables: 0,
    analyticsTables: 0,
    logsTables: 0,
    totalRowsDeleted: 0,
  };

  // Staging tables
  const stagingTables = [
    'staging_sales_book',
    'staging_item',
    'staging_account',
    'staging_customer_type',
    'staging_industry_type',
    'staging_region',
    'staging_sale_type',
    'staging_model',
  ];

  console.log('📋 Truncating staging tables...');
  for (const table of stagingTables) {
    try {
      const rowCount = await getRowCount('staging', table);
      if (rowCount > 0) {
        await executeQuery(
          `TRUNCATE TABLE staging.${table}`,
          `Truncated staging.${table} (${rowCount.toLocaleString()} rows)`
        );
        stats.totalRowsDeleted += rowCount;
        stats.stagingTables++;
      } else {
        console.log(`  ⚪ staging.${table} is already empty`);
      }
    } catch (error) {
      console.error(`  ⚠️  Could not truncate staging.${table}:`, error);
    }
  }

  // Analytics tables
  const analyticsTables = [
    'fact_sales',
    'dim_date',
    'dim_item',
    'dim_customer',
    'dim_customer_type',
    'dim_industry_type',
    'dim_region',
    'dim_sale_type',
    'dim_model',
  ];

  console.log('\n📊 Truncating analytics tables...');
  for (const table of analyticsTables) {
    try {
      const rowCount = await getRowCount('analytics', table);
      if (rowCount > 0) {
        await executeQuery(
          `TRUNCATE TABLE analytics.${table}`,
          `Truncated analytics.${table} (${rowCount.toLocaleString()} rows)`
        );
        stats.totalRowsDeleted += rowCount;
        stats.analyticsTables++;
      } else {
        console.log(`  ⚪ analytics.${table} is already empty`);
      }
    } catch (error) {
      console.error(`  ⚠️  Could not truncate analytics.${table}:`, error);
    }
  }

  // Logs tables
  console.log('\n📝 Truncating logs tables...');
  try {
    const rowCount = await getRowCount('logs', 'pipeline_audit_log');
    if (rowCount > 0) {
      await executeQuery(
        `TRUNCATE TABLE logs.pipeline_audit_log`,
        `Truncated logs.pipeline_audit_log (${rowCount.toLocaleString()} rows)`
      );
      stats.totalRowsDeleted += rowCount;
      stats.logsTables++;
    } else {
      console.log(`  ⚪ logs.pipeline_audit_log is already empty`);
    }
  } catch (error) {
    console.error(`  ⚠️  Could not truncate logs.pipeline_audit_log:`, error);
  }

  return stats;
}

/**
 * Delete files from GCP Storage folder
 */
async function deleteFilesFromFolder(
  storage: Storage,
  bucketName: string,
  prefix: string
): Promise<{ count: number; totalSize: number }> {
  const bucket = storage.bucket(bucketName);
  let count = 0;
  let totalSize = 0;

  try {
    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length === 0) {
      return { count: 0, totalSize: 0 };
    }

    console.log(`  📁 Found ${files.length} files in ${prefix}...`);

    // Delete files in batches
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          try {
            const [metadata] = await file.getMetadata();
            const size = Number(metadata.size || 0);
            await file.delete();
            count++;
            totalSize += size;
          } catch (error) {
            console.error(`    ⚠️  Failed to delete ${file.name}:`, error);
          }
        })
      );
    }

    return { count, totalSize };
  } catch (error) {
    console.error(`  ⚠️  Error listing/deleting files from ${prefix}:`, error);
    return { count, totalSize };
  }
}

/**
 * Cleanup GCP Storage
 */
async function cleanupGCPStorage(): Promise<CleanupStats['gcpStorage']> {
  console.log('\n☁️  Cleaning up GCP Storage...\n');

  const bucketName = process.env.GCS_BUCKET_NAME || 'julley-pms-dev';
  const storage = new Storage();

  const stats = {
    rawFiles: 0,
    processedFiles: 0,
    failedFiles: 0,
    totalFilesDeleted: 0,
    totalSizeDeleted: 0,
  };

  // Clean raw/ folder
  console.log('🗑️  Deleting files from raw/ folder...');
  const rawPrefixes = [
    'raw/sales/',
    'raw/master-data/',
    'raw/batches/',
  ];

  for (const prefix of rawPrefixes) {
    const result = await deleteFilesFromFolder(storage, bucketName, prefix);
    stats.rawFiles += result.count;
    stats.totalSizeDeleted += result.totalSize;
    if (result.count > 0) {
      const sizeMB = (result.totalSize / (1024 * 1024)).toFixed(2);
      console.log(`  ✅ Deleted ${result.count} files (${sizeMB} MB) from ${prefix}`);
    }
  }

  // Clean processed/ folder
  console.log('\n🗑️  Deleting files from processed/ folder...');
  const processedResult = await deleteFilesFromFolder(storage, bucketName, 'processed/');
  stats.processedFiles = processedResult.count;
  stats.totalSizeDeleted += processedResult.totalSize;
  if (processedResult.count > 0) {
    const sizeMB = (processedResult.totalSize / (1024 * 1024)).toFixed(2);
    console.log(`  ✅ Deleted ${processedResult.count} files (${sizeMB} MB) from processed/`);
  } else {
    console.log(`  ⚪ No files found in processed/`);
  }

  // Clean failed/ folder
  console.log('\n🗑️  Deleting files from failed/ folder...');
  const failedResult = await deleteFilesFromFolder(storage, bucketName, 'failed/');
  stats.failedFiles = failedResult.count;
  stats.totalSizeDeleted += failedResult.totalSize;
  if (failedResult.count > 0) {
    const sizeMB = (failedResult.totalSize / (1024 * 1024)).toFixed(2);
    console.log(`  ✅ Deleted ${failedResult.count} files (${sizeMB} MB) from failed/`);
  } else {
    console.log(`  ⚪ No files found in failed/`);
  }

  stats.totalFilesDeleted = stats.rawFiles + stats.processedFiles + stats.failedFiles;

  return stats;
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('🧹 Starting Comprehensive Pipeline Data Cleanup');
  console.log('='.repeat(60));
  console.log('');
  console.log('⚠️  WARNING: This will permanently delete all pipeline data!');
  console.log('   - All ClickHouse staging, analytics, and logs data');
  console.log('   - All files in GCP Storage (raw/, processed/, failed/)');
  console.log('');

  // Test ClickHouse connection
  console.log('🔌 Testing ClickHouse connection...');
  const isConnected = await clickhouseClient.testConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to ClickHouse. Please check your connection settings.');
  }
  console.log('✅ ClickHouse connection successful\n');

  const overallStats: CleanupStats = {
    clickhouse: {
      stagingTables: 0,
      analyticsTables: 0,
      logsTables: 0,
      totalRowsDeleted: 0,
    },
    gcpStorage: {
      rawFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalFilesDeleted: 0,
      totalSizeDeleted: 0,
    },
  };

  try {
    // Cleanup ClickHouse
    overallStats.clickhouse = await cleanupClickHouse();

    // Cleanup GCP Storage
    overallStats.gcpStorage = await cleanupGCPStorage();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Cleanup Complete!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:\n');

    console.log('🗄️  ClickHouse:');
    console.log(`   - Staging tables truncated: ${overallStats.clickhouse.stagingTables}`);
    console.log(`   - Analytics tables truncated: ${overallStats.clickhouse.analyticsTables}`);
    console.log(`   - Logs tables truncated: ${overallStats.clickhouse.logsTables}`);
    console.log(`   - Total rows deleted: ${overallStats.clickhouse.totalRowsDeleted.toLocaleString()}`);

    console.log('\n☁️  GCP Storage:');
    console.log(`   - Raw files deleted: ${overallStats.gcpStorage.rawFiles}`);
    console.log(`   - Processed files deleted: ${overallStats.gcpStorage.processedFiles}`);
    console.log(`   - Failed files deleted: ${overallStats.gcpStorage.failedFiles}`);
    console.log(`   - Total files deleted: ${overallStats.gcpStorage.totalFilesDeleted}`);
    const totalSizeGB = (overallStats.gcpStorage.totalSizeDeleted / (1024 * 1024 * 1024)).toFixed(2);
    console.log(`   - Total size deleted: ${totalSizeGB} GB`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Upload fresh files through the UI');
    console.log('   2. Files will be processed automatically by the pipeline');
    console.log('   3. Data will flow: GCS → ClickHouse Staging → Analytics → Metabase');
    console.log('\n   Note: Metabase dashboards and questions are preserved.');
    console.log('         They will show empty data until new files are processed.');

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

