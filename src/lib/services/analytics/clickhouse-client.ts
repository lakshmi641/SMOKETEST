import { createClient, ClickHouseClient } from '@clickhouse/client';

/**
 * ClickHouse Client Service
 * 
 * Manages connection to ClickHouse database for analytics and reporting.
 * This service provides a singleton client instance that can be reused
 * across the application.
 * 
 * ⚠️ CRITICAL: All connections must use self-hosted ClickHouse on GCP.
 * Configure CLICKHOUSE_HOST environment variable to point to your self-hosted instance.
 * 
 * ⚠️ SERVER-ONLY: This service uses Node.js built-in modules and should only be used in:
 * - API Routes (/app/api/*)
 * - Server Components (default in App Router)
 * - Server Actions
 * - Middleware
 * 
 * Do NOT import this in Client Components (files with 'use client' directive).
 */
class ClickHouseClientService {
  private client: ClickHouseClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the ClickHouse client with configuration from environment variables
   */
  private initializeClient(): ClickHouseClient {
    if (this.client) {
      return this.client;
    }

    const host = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
    const url = host.startsWith('http') ? host : `http://${host}`;
    
    const config = {
      url: url,
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'default',
      // Optional: Add connection pool settings
      max_open_connections: parseInt(process.env.CLICKHOUSE_MAX_CONNECTIONS || '10', 10),
      // Request timeout in milliseconds
      request_timeout: parseInt(process.env.CLICKHOUSE_REQUEST_TIMEOUT || '30000', 10),
    };

    // Validate required configuration
    if (!config.url) {
      throw new Error('CLICKHOUSE_HOST or CLICKHOUSE_URL environment variable is required');
    }

    this.client = createClient({
      url: config.url,
      username: config.username,
      password: config.password,
      database: config.database,
      max_open_connections: config.max_open_connections,
      request_timeout: config.request_timeout,
    });

    this.isInitialized = true;
    return this.client;
  }

  /**
   * Get the ClickHouse client instance
   * Initializes the client if it hasn't been initialized yet
   */
  getClient(): ClickHouseClient {
    if (!this.client) {
      return this.initializeClient();
    }
    return this.client;
  }

  /**
   * Check if the client is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Close the ClickHouse client connection
   * Useful for cleanup in serverless environments
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.isInitialized = false;
    }
  }

  /**
   * Test the connection to ClickHouse
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.query({
        query: 'SELECT 1',
      });
      await result.text();
      return true;
    } catch (error) {
      console.error('ClickHouse connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const clickhouseClient = new ClickHouseClientService();

// Export the service class for testing purposes
export { ClickHouseClientService };

