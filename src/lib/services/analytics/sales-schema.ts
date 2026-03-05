/**
 * Sales Data Schema for ClickHouse
 * 
 * ⚠️ DEPRECATED: This schema is for the legacy sales_transactions table.
 * The main fact table for sales analytics is analytics.fact_sales (star schema).
 * 
 * This schema is kept for backward compatibility but should not be used for new development.
 * All Metabase dashboards and reports use analytics.fact_sales instead.
 * 
 * This schema is designed to store sales transaction data from day books.
 * The schema supports multi-tenant architecture with company_id partitioning.
 */

export interface SalesTransaction {
  company_id: string;
  transaction_date: string; // YYYY-MM-DD format
  invoice_number?: string;
  customer_name?: string;
  customer_code?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  unit_price?: number;
  total_amount: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  sales_person?: string;
  region?: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  uploaded_by?: string; // User ID who uploaded the data
  source_file?: string; // Original file name
}

/**
 * ClickHouse table creation SQL for sales_transactions
 */
export const CREATE_SALES_TABLE_SQL = `
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
`;

/**
 * Indexes for better query performance
 */
export const CREATE_SALES_INDEXES_SQL = [
  // Index on customer for customer analysis
  `ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_customer (customer_code) TYPE minmax GRANULARITY 4`,
  // Index on product for product analysis
  `ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_product (product_code) TYPE minmax GRANULARITY 4`,
  // Index on sales person
  `ALTER TABLE sales_transactions ADD INDEX IF NOT EXISTS idx_sales_person (sales_person) TYPE minmax GRANULARITY 4`,
];

