/**
 * Script to initialize ClickHouse schema for Sales Performance Analytics
 * 
 * Creates:
 * - Databases: staging, analytics, logs
 * - Staging tables for raw data
 * - Dimension tables in analytics database
 * - Fact table (fact_sales) in analytics database
 * - Pipeline audit log table in logs database
 * 
 * Usage: tsx src/scripts/init-clickhouse-schema.ts
 */

import { clickhouseClient } from '../lib/services/analytics/clickhouse-client';

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

async function main() {
  try {
    console.log('🚀 Initializing ClickHouse schema for Sales Performance Analytics...\n');

    // Test connection first
    const isConnected = await clickhouseClient.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to ClickHouse. Please check your connection settings.');
    }
    console.log('✅ ClickHouse connection successful\n');

    // Phase 1.1: Create Databases
    console.log('📦 Creating databases...');
    await executeQuery('CREATE DATABASE IF NOT EXISTS staging', 'Created staging database');
    await executeQuery('CREATE DATABASE IF NOT EXISTS analytics', 'Created analytics database');
    await executeQuery('CREATE DATABASE IF NOT EXISTS logs', 'Created logs database');
    console.log('');

    // Phase 1.2: Create Staging Tables
    console.log('📋 Creating staging tables...');
    
    // Staging Sales Book - flexible schema for raw CSV data
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_sales_book
      (
        \`Invoice Date\` Nullable(String),
        \`Invoice Posting Date\` Nullable(String),
        \`Voucher\` Nullable(String),
        \`Item Code\` Nullable(String),
        \`Item Name\` Nullable(String),
        \`Customer Account Code\` Nullable(String),
        \`Customer Account Name\` Nullable(String),
        \`Business Types\` Nullable(String),
        \`Industry Type Name\` Nullable(String),
        \`Region Name\` Nullable(String),
        \`Sale Type Name\` Nullable(String),
        \`Model Name\` Nullable(String),
        \`Serial No / Chasis No.\` Nullable(String),
        \`Quantity\` Nullable(String),
        \`Rate\` Nullable(String),
        \`Gross\` Nullable(String),
        \`Taxable Value\` Nullable(String),
        \`CGST\` Nullable(String),
        \`SGST\` Nullable(String),
        \`IGST\` Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
    `, 'Created staging.staging_sales_book');

    // Staging Item Master
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_item
      (
        sCode Nullable(String),
        sName Nullable(String),
        iProductType Nullable(String),
        HSNSAC Nullable(String),
        iParentId Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_item');

    // Staging Account (Customer) Master
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_account
      (
        sCode Nullable(String),
        sName Nullable(String),
        iAccountType Nullable(String),
        fCreditLimit Nullable(String),
        iParentId Nullable(String),
        ParentName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_account');

    // Staging Customer Type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_customer_type
      (
        sCode Nullable(String),
        sName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_customer_type');

    // Staging Industry Type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_industry_type
      (
        sCode Nullable(String),
        sName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_industry_type');

    // Staging Region
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_region
      (
        sCode Nullable(String),
        sName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_region');

    // Staging Sale Type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_sale_type
      (
        sCode Nullable(String),
        sName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_sale_type');

    // Staging Model
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS staging.staging_model
      (
        sCode Nullable(String),
        sName Nullable(String),
        iParentId Nullable(String),
        ParentName Nullable(String),
        file_name String,
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (file_name, loaded_at)
      SETTINGS allow_nullable_key = 1
    `, 'Created staging.staging_model');

    console.log('');

    // Phase 1.3: Create Dimension Tables
    console.log('📊 Creating dimension tables...');

    // dim_date - Date dimension (will be populated by dbt)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_date
      (
        date_key Int32,
        full_date Date,
        day UInt8,
        month UInt8,
        year UInt16,
        quarter UInt8,
        day_of_week_name String,
        month_name String
      )
      ENGINE = MergeTree()
      ORDER BY date_key
    `, 'Created analytics.dim_date');

    // dim_item
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_item
      (
        item_key String,
        item_name String,
        item_type String,
        hsn_sac String,
        L1_Item_Category String,
        L2_Item_SubCategory String,
        L3_Item_Name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY item_key
    `, 'Created analytics.dim_item');

    // dim_customer
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_customer
      (
        customer_key String,
        customer_name String,
        account_type String,
        credit_limit Decimal64(2),
        L1_Parent_Group String,
        L2_Customer_Name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY customer_key
    `, 'Created analytics.dim_customer');

    // dim_customer_type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_customer_type
      (
        customer_type_key String,
        customer_type_name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY customer_type_key
    `, 'Created analytics.dim_customer_type');

    // dim_industry_type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_industry_type
      (
        industry_type_key String,
        industry_type_name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY industry_type_key
    `, 'Created analytics.dim_industry_type');

    // dim_region
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_region
      (
        region_key String,
        region_name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY region_key
    `, 'Created analytics.dim_region');

    // dim_sale_type
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_sale_type
      (
        sale_type_key String,
        sale_type_name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY sale_type_key
    `, 'Created analytics.dim_sale_type');

    // dim_model
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.dim_model
      (
        model_key String,
        model_name String,
        L1_Product_Category String,
        L2_Model_Name String,
        updated_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY model_key
    `, 'Created analytics.dim_model');

    console.log('');

    // Phase 1.4: Create Fact Table
    console.log('📈 Creating fact table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS analytics.fact_sales
      (
        date_key Int32,
        item_key String,
        customer_key String,
        customer_type_key String,
        industry_type_key String,
        region_key String,
        sale_type_key String,
        model_key String,
        voucher_no String,
        invoice_date Date,
        invoice_posting_date Date,
        serial_no_chasis_no String,
        quantity Decimal64(2),
        rate Decimal64(2),
        gross_amount Decimal64(2),
        taxable_value Decimal64(2),
        cgst Decimal64(2),
        sgst Decimal64(2),
        igst Decimal64(2),
        total_tax Decimal64(2),
        total_value Decimal64(2),
        loaded_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(invoice_date)
      ORDER BY (date_key, customer_key, item_key, invoice_date)
    `, 'Created analytics.fact_sales');

    console.log('');

    // Phase 1.5: Create Pipeline Audit Log Table
    console.log('📝 Creating pipeline audit log table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS logs.pipeline_audit_log
      (
        audit_event_id UUID DEFAULT generateUUIDv4(),
        run_id String,
        event_timestamp DateTime DEFAULT now(),
        event_source String,
        file_name String,
        event_type String,
        status Enum8('success' = 1, 'fail' = 2, 'in_progress' = 3, 'skipped_duplicate' = 4),
        source_row_count Int64,
        target_row_count Int64,
        error_message String,
        dbt_model_name String,
        max_watermark_processed DateTime
      )
      ENGINE = MergeTree()
      ORDER BY (event_timestamp, run_id, file_name)
      PARTITION BY toYYYYMM(event_timestamp)
    `, 'Created logs.pipeline_audit_log');

    console.log('');
    console.log('🎉 Schema initialization completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('  - Databases: staging, analytics, logs');
    console.log('  - Staging tables: 8 tables');
    console.log('  - Dimension tables: 8 tables');
    console.log('  - Fact table: fact_sales');
    console.log('  - Audit log: pipeline_audit_log');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set up dbt project for transformations');
    console.log('  2. Configure Firebase Cloud Functions for data ingestion');
    console.log('  3. Set up Metabase for dashboards');

    await clickhouseClient.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing schema:', error);
    await clickhouseClient.close();
    process.exit(1);
  }
}

main();
