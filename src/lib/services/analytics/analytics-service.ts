import { clickhouseClient } from './clickhouse-client';
import { ResultSet } from '@clickhouse/client';

/**
 * Analytics Service
 * 
 * Provides methods for querying analytics data from ClickHouse.
 * This service handles common analytics queries for reporting.
 * 
 * ⚠️ SERVER-ONLY: This service uses Node.js built-in modules and should only be used in:
 * - API Routes (/app/api/*)
 * - Server Components (default in App Router)
 * - Server Actions
 * - Middleware
 * 
 * Do NOT import this in Client Components (files with 'use client' directive).
 */
export class AnalyticsService {
  /**
   * Execute a raw SQL query against ClickHouse
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    try {
      const client = clickhouseClient.getClient();
      
      const result = await client.query({
        query: sql,
        query_params: params || {},
        format: 'JSONEachRow',
      });

      // ClickHouse client returns data as an array when using JSONEachRow
      const data = await result.json<T[]>();
      
      // Ensure we return an array
      if (Array.isArray(data)) {
        // Flatten if it's a nested array (shouldn't happen, but handle it)
        if (data.length > 0 && Array.isArray(data[0])) {
          return (data as any).flat() as T[];
        }
        return data as T[];
      }
      
      // If data is not an array, try to convert it
      if (data && typeof data === 'object') {
        // If it's a single object, wrap it in an array
        return [data as T];
      }
      
      // If data is null or undefined, return empty array
      return [] as T[];
    } catch (error) {
      console.error('ClickHouse query error:', error);
      throw new Error(`Analytics query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a query and return the raw ResultSet
   * Useful for streaming large datasets
   */
  async queryStream(sql: string, params?: Record<string, any>): Promise<ResultSet<'JSONEachRow'>> {
    try {
      const client = clickhouseClient.getClient();
      
      return await client.query({
        query: sql,
        query_params: params || {},
        format: 'JSONEachRow',
      });
    } catch (error) {
      console.error('ClickHouse query error:', error);
      throw new Error(`Analytics query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Insert data into a ClickHouse table
   */
  async insert(table: string, data: any[]): Promise<void> {
    try {
      const client = clickhouseClient.getClient();
      
      await client.insert({
        table,
        values: data,
        format: 'JSONEachRow',
      });
    } catch (error) {
      console.error('ClickHouse insert error:', error);
      throw new Error(`Analytics insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a query that returns a single value
   * Returns the first value from the first column of the first row
   */
  async querySingleValue<T = any>(sql: string, params?: Record<string, any>): Promise<T | null> {
    try {
      const results = await this.query<Record<string, any>>(sql, params);
      if (results.length === 0) {
        return null;
      }
      // Get the first value from the first row
      const firstRow = results[0];
      if (!firstRow || typeof firstRow !== 'object') {
        return null;
      }
      const firstKey = Object.keys(firstRow)[0];
      return (firstKey ? firstRow[firstKey] : null) as T;
    } catch (error) {
      console.error('ClickHouse query error:', error);
      throw new Error(`Analytics query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(table: string): Promise<any[]> {
    const sql = `
      SELECT 
        name,
        type,
        default_kind,
        default_expression,
        comment
      FROM system.columns
      WHERE database = currentDatabase()
        AND table = {table:String}
      ORDER BY position
    `;
    
    return this.query(sql, { table });
  }

  /**
   * Check if a table exists
   */
  async tableExists(table: string): Promise<boolean> {
    try {
      const sql = `
        SELECT count() as count
        FROM system.tables
        WHERE database = currentDatabase()
          AND name = {table:String}
      `;
      
      const result = await this.querySingleValue<number>(sql, { table });
      return (result || 0) > 0;
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    tableCount: number;
    totalSize: number;
    totalRows: number;
  }> {
    const sql = `
      SELECT 
        count() as tableCount,
        sum(total_bytes) as totalSize,
        sum(total_rows) as totalRows
      FROM system.tables
      WHERE database = currentDatabase()
    `;
    
    const results = await this.query<{
      tableCount: number;
      totalSize: number;
      totalRows: number;
    }>(sql);
    
    return results[0] || { tableCount: 0, totalSize: 0, totalRows: 0 };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

