-- =====================================================
-- Sales Transactions Table Schema for ClickHouse
-- =====================================================
-- This script creates the sales_transactions table and indexes
-- for storing sales data from Excel day books.
--
-- Usage:
--   clickhouse-client < sales_transactions_schema.sql
--   OR
--   Copy and paste into ClickHouse console
-- =====================================================

-- Create the sales_transactions table
CREATE TABLE IF NOT EXISTS sales_transactions
(
    company_id String,
    transaction_date Date,
    invoice_number Nullable(String),
    customer_name Nullable(String),
    customer_code Nullable(String),
    product_name Nullable(String),
    product_code Nullable(String),
    quantity Nullable(Decimal64(2)),
    unit_price Nullable(Decimal64(2)),
    total_amount Decimal64(2),
    tax_amount Nullable(Decimal64(2)),
    discount_amount Nullable(Decimal64(2)),
    payment_method Nullable(String),
    sales_person Nullable(String),
    region Nullable(String),
    category Nullable(String),
    subcategory Nullable(String),
    notes Nullable(String),
    created_at DateTime,
    updated_at DateTime,
    uploaded_by Nullable(String),
    source_file Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY (company_id, toYYYYMM(transaction_date))
ORDER BY (company_id, transaction_date, invoice_number)
SETTINGS 
    index_granularity = 8192,
    allow_nullable_key = 1;

-- =====================================================
-- Create Indexes for Better Query Performance
-- =====================================================

-- Index on customer code for customer analysis
ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_customer (customer_code) TYPE minmax GRANULARITY 4;

-- Index on product code for product analysis
ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_product (product_code) TYPE minmax GRANULARITY 4;

-- Index on sales person for sales performance analysis
ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_sales_person (sales_person) TYPE minmax GRANULARITY 4;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check if table exists
-- SHOW TABLES;

-- View table structure
-- DESCRIBE sales_transactions;

-- View table creation statement
-- SHOW CREATE TABLE sales_transactions;

-- =====================================================
-- Test Data Insert (Optional)
-- =====================================================

-- Uncomment below to insert a test record
/*
INSERT INTO sales_transactions VALUES
(
    'test-company-123',
    '2024-01-15',
    'INV-001',
    'Test Customer',
    'CUST-001',
    'Test Product',
    'PROD-001',
    5,
    100.00,
    500.00,
    90.00,
    0.00,
    'Cash',
    'Test Sales Person',
    'North',
    'Test Category',
    NULL,
    'Test notes',
    now(),
    now(),
    'user-123',
    'test-file.xlsx'
);
*/

-- Query test data
-- SELECT * FROM sales_transactions LIMIT 10;

-- =====================================================
-- Drop Table (if needed to recreate)
-- =====================================================

-- Uncomment to drop the table (WARNING: This will delete all data!)
-- DROP TABLE IF EXISTS sales_transactions;

