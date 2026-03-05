/**
 * Analytics Test API Route
 * 
 * Tests connections to ClickHouse and Metabase services
 * Useful for verifying local setup with hosted services
 */

import { NextResponse } from 'next/server';
import { clickhouseClient } from '@/lib/services/analytics/clickhouse-client';
import { getMetabaseService } from '@/lib/services/metabase-service';

export async function GET() {
  const results = {
    clickhouse: {
      configured: false,
      connected: false,
      error: null as string | null,
      details: {} as Record<string, any>,
    },
    metabase: {
      configured: false,
      accessible: false,
      error: null as string | null,
      details: {} as Record<string, any>,
    },
    timestamp: new Date().toISOString(),
  };

  // Test ClickHouse Connection
  try {
    const clickhouseHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
    const clickhouseDatabase = process.env.CLICKHOUSE_DATABASE || 'default';
    const clickhouseUsername = process.env.CLICKHOUSE_USERNAME || 'default';
    
    results.clickhouse.configured = !!clickhouseHost;
    results.clickhouse.details = {
      host: clickhouseHost,
      database: clickhouseDatabase,
      username: clickhouseUsername,
      hasPassword: !!process.env.CLICKHOUSE_PASSWORD,
    };

    if (clickhouseHost) {
      try {
        const connected = await clickhouseClient.testConnection();
        results.clickhouse.connected = connected;
        
        if (connected) {
          // Try a simple query to get database info
          try {
            const client = clickhouseClient.getClient();
            const result = await client.query({
              query: 'SELECT version() as version, currentDatabase() as database',
            });
            const data = (await result.json()) as { data?: Array<{ version?: string; database?: string }> };
            results.clickhouse.details.version = data?.data?.[0]?.version || 'unknown';
            results.clickhouse.details.currentDatabase = data?.data?.[0]?.database || 'unknown';
          } catch (queryError) {
            // Query failed but connection might still work
            results.clickhouse.details.queryError = queryError instanceof Error ? queryError.message : 'Unknown query error';
          }
        }
      } catch (connectionError) {
        results.clickhouse.error = connectionError instanceof Error 
          ? connectionError.message 
          : 'Unknown connection error';
      }
    } else {
      results.clickhouse.error = 'CLICKHOUSE_HOST environment variable not set';
    }
  } catch (error) {
    results.clickhouse.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test Metabase Configuration
  try {
    const metabaseService = getMetabaseService();
    const siteUrl = process.env.METABASE_SITE_URL || '';
    const hasSecretKey = !!process.env.METABASE_EMBEDDING_SECRET_KEY;
    
    results.metabase.configured = metabaseService.isConfigured();
    results.metabase.details = {
      siteUrl: siteUrl || 'not set',
      hasSecretKey: hasSecretKey,
    };

    if (siteUrl && hasSecretKey) {
      try {
        // Test if Metabase is accessible
        const testUrl = siteUrl.replace(/\/$/, '') + '/api/health';
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Add timeout
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          results.metabase.accessible = true;
          try {
            const healthData = await response.json();
            results.metabase.details.health = healthData;
          } catch {
            // Health endpoint might not return JSON
            results.metabase.details.healthStatus = response.status;
          }
        } else {
          results.metabase.error = `Metabase returned status ${response.status}`;
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          results.metabase.error = 'Connection timeout - Metabase may not be accessible';
        } else {
          results.metabase.error = fetchError instanceof Error 
            ? fetchError.message 
            : 'Failed to reach Metabase';
        }
      }
    } else {
      if (!siteUrl) {
        results.metabase.error = 'METABASE_SITE_URL environment variable not set';
      } else if (!hasSecretKey) {
        results.metabase.error = 'METABASE_EMBEDDING_SECRET_KEY environment variable not set';
      }
    }
  } catch (error) {
    results.metabase.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Determine overall status
  const allConfigured = results.clickhouse.configured && results.metabase.configured;
  const allConnected = results.clickhouse.connected && results.metabase.accessible;

  return NextResponse.json({
    success: allConfigured && allConnected,
    status: allConnected ? 'ready' : allConfigured ? 'configured_but_not_connected' : 'not_configured',
    results,
    summary: {
      clickhouse: results.clickhouse.connected ? '✅ Connected' : '❌ Not Connected',
      metabase: results.metabase.accessible ? '✅ Accessible' : '❌ Not Accessible',
    },
  });
}

