import { analyticsService } from './analytics-service';

/**
 * Pipeline Service
 * 
 * Manages queries to the pipeline audit log from self-hosted ClickHouse on GCP.
 * Provides methods to track file processing status and pipeline health.
 * 
 * ⚠️ SERVER-ONLY: This service uses Node.js built-in modules and should only be used in:
 * - API Routes (/app/api/*)
 * - Server Components (default in App Router)
 * - Server Actions
 * - Middleware
 * 
 * Do NOT import this in Client Components (files with 'use client' directive).
 */

export interface PipelineAuditLogEntry {
  audit_event_id: string;
  run_id: string;
  event_timestamp: Date;
  event_source: string;
  file_name: string;
  event_type: string;
  status: 'success' | 'fail' | 'in_progress' | 'skipped_duplicate';
  source_row_count: number | null;
  target_row_count: number | null;
  error_message: string | null;
  dbt_model_name: string | null;
  max_watermark_processed: Date | null;
}

export interface FileProcessingStatus {
  fileName: string;
  latestStatus: 'success' | 'fail' | 'in_progress' | 'skipped_duplicate';
  lastProcessed: Date | null;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  processingAttempts: number;
  sourceRowCount: number | null;
  targetRowCount: number | null;
  lastError: string | null;
  stages: Array<{
    eventType: string;
    status: string;
    timestamp: Date;
    rowCount: number | null;
    error: string | null;
  }>;
}

export interface PipelineSummary {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
  skippedCount: number;
  successRate: number;
  recentErrors: Array<{
    fileName: string;
    errorMessage: string;
    timestamp: Date;
  }>;
  latestDataDate: Date | null;
  pipelineStages: {
    staging: { status: string; lastRun: Date | null };
    transform: { status: string; lastRun: Date | null };
    metabase: { status: string; lastRun: Date | null };
  };
}

export class PipelineService {
  /**
   * Get file status by file name
   */
  async getFileStatus(fileName: string): Promise<FileProcessingStatus | null> {
    try {
      const sql = `
        SELECT 
          file_name,
          status,
          event_timestamp,
          event_type,
          source_row_count,
          target_row_count,
          error_message,
          run_id
        FROM logs.pipeline_audit_log
        WHERE file_name = {fileName:String}
        ORDER BY event_timestamp DESC
      `;

      const entries = await analyticsService.query<PipelineAuditLogEntry>(sql, { fileName });

      if (entries.length === 0) {
        return null;
      }

      const latest = entries[0];
      if (!latest) {
        return null;
      }
      
      const successEntries = entries.filter((e) => e.status === 'success');
      const failureEntries = entries.filter((e) => e.status === 'fail');

      return {
        fileName,
        latestStatus: latest.status as any,
        lastProcessed: latest.event_timestamp ? new Date(latest.event_timestamp) : null,
        lastSuccess: successEntries[0]?.event_timestamp ? new Date(successEntries[0].event_timestamp) : null,
        lastFailure: failureEntries[0]?.event_timestamp ? new Date(failureEntries[0].event_timestamp) : null,
        processingAttempts: entries.length,
        sourceRowCount: latest.source_row_count,
        targetRowCount: latest.target_row_count,
        lastError: latest.error_message,
        stages: entries.map((e) => ({
          eventType: e.event_type,
          status: e.status,
          timestamp: e.event_timestamp ? new Date(e.event_timestamp) : new Date(),
          rowCount: e.target_row_count,
          error: e.error_message,
        })),
      };
    } catch (error) {
      console.error('Error getting file status:', error);
      throw new Error(
        `Failed to get file status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get recent files
   */
  async getRecentFiles(limit: number = 50): Promise<FileProcessingStatus[]> {
    try {
      const sql = `
        SELECT 
          file_name,
          MAX(event_timestamp) as last_event,
          MAX(CASE WHEN status = 'success' THEN event_timestamp END) as last_success,
          MAX(CASE WHEN status = 'fail' THEN event_timestamp END) as last_failure,
          COUNT(*) as attempts,
          MAX(source_row_count) as source_rows,
          MAX(target_row_count) as target_rows,
          MAX(CASE WHEN status = 'fail' THEN error_message END) as last_error,
          MAX(status) as latest_status
        FROM logs.pipeline_audit_log
        GROUP BY file_name
        ORDER BY last_event DESC
        LIMIT {limit:UInt32}
      `;

      const results = await analyticsService.query<{
        file_name: string;
        last_event: Date;
        last_success: Date | null;
        last_failure: Date | null;
        attempts: number;
        source_rows: number | null;
        target_rows: number | null;
        last_error: string | null;
        latest_status: string;
      }>(sql, { limit });

      return results.map((r) => ({
        fileName: r.file_name,
        latestStatus: r.latest_status as any,
        lastProcessed: r.last_event ? new Date(r.last_event) : null,
        lastSuccess: r.last_success ? new Date(r.last_success) : null,
        lastFailure: r.last_failure ? new Date(r.last_failure) : null,
        processingAttempts: r.attempts,
        sourceRowCount: r.source_rows,
        targetRowCount: r.target_rows,
        lastError: r.last_error,
        stages: [], // Would need separate query for full stage details
      }));
    } catch (error) {
      console.error('Error getting recent files:', error);
      throw new Error(
        `Failed to get recent files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get files by status
   */
  async getFilesByStatus(
    status: 'success' | 'fail' | 'in_progress' | 'skipped_duplicate',
    limit: number = 50
  ): Promise<FileProcessingStatus[]> {
    try {
      const sql = `
        SELECT 
          file_name,
          MAX(event_timestamp) as last_event,
          MAX(CASE WHEN status = 'success' THEN event_timestamp END) as last_success,
          MAX(CASE WHEN status = 'fail' THEN event_timestamp END) as last_failure,
          COUNT(*) as attempts,
          MAX(source_row_count) as source_rows,
          MAX(target_row_count) as target_rows,
          MAX(CASE WHEN status = 'fail' THEN error_message END) as last_error
        FROM logs.pipeline_audit_log
        WHERE status = {status:String}
        GROUP BY file_name
        ORDER BY last_event DESC
        LIMIT {limit:UInt32}
      `;

      const results = await analyticsService.query<{
        file_name: string;
        last_event: Date;
        last_success: Date | null;
        last_failure: Date | null;
        attempts: number;
        source_rows: number | null;
        target_rows: number | null;
        last_error: string | null;
      }>(sql, { status, limit });

      return results.map((r) => ({
        fileName: r.file_name,
        latestStatus: status,
        lastProcessed: r.last_event ? new Date(r.last_event) : null,
        lastSuccess: r.last_success ? new Date(r.last_success) : null,
        lastFailure: r.last_failure ? new Date(r.last_failure) : null,
        processingAttempts: r.attempts,
        sourceRowCount: r.source_rows,
        targetRowCount: r.target_rows,
        lastError: r.last_error,
        stages: [],
      }));
    } catch (error) {
      console.error('Error getting files by status:', error);
      throw new Error(
        `Failed to get files by status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get pipeline summary
   */
  async getPipelineSummary(): Promise<PipelineSummary> {
    try {
      // Get overall statistics
      const statsSql = `
        SELECT 
          COUNT(DISTINCT file_name) as total_files,
          COUNT(DISTINCT CASE WHEN status = 'success' THEN file_name END) as success_count,
          COUNT(DISTINCT CASE WHEN status = 'fail' THEN file_name END) as failure_count,
          COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN file_name END) as in_progress_count,
          COUNT(DISTINCT CASE WHEN status = 'skipped_duplicate' THEN file_name END) as skipped_count
        FROM logs.pipeline_audit_log
        WHERE event_timestamp >= today() - INTERVAL 30 DAY
      `;

      const stats = await analyticsService.query<{
        total_files: number;
        success_count: number;
        failure_count: number;
        in_progress_count: number;
        skipped_count: number;
      }>(statsSql);

      const stat = stats[0] || {
        total_files: 0,
        success_count: 0,
        failure_count: 0,
        in_progress_count: 0,
        skipped_count: 0,
      };

      // Get recent errors
      const errorsSql = `
        SELECT 
          file_name,
          error_message,
          event_timestamp
        FROM logs.pipeline_audit_log
        WHERE status = 'fail'
          AND event_timestamp >= today() - INTERVAL 7 DAY
        ORDER BY event_timestamp DESC
        LIMIT 10
      `;

      const errors = await analyticsService.query<{
        file_name: string;
        error_message: string;
        event_timestamp: Date;
      }>(errorsSql);

      // Get latest data date (watermark)
      const watermarkSql = `
        SELECT MAX(max_watermark_processed) as latest_date
        FROM logs.pipeline_audit_log
        WHERE status = 'success'
          AND max_watermark_processed IS NOT NULL
      `;

      const watermark = await analyticsService.query<{ latest_date: Date | null }>(watermarkSql);
      
      // Validate watermark date - ensure it's not null or invalid
      let validWatermark: Date | null = null;
      if (watermark[0]?.latest_date) {
        const date = new Date(watermark[0].latest_date);
        // Check if date is valid (not epoch or invalid)
        if (!isNaN(date.getTime()) && date.getTime() !== 0) {
          validWatermark = date;
        }
      }

      // Get pipeline stage status
      const stagesSql = `
        SELECT 
          event_type,
          MAX(event_timestamp) as last_run,
          MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as has_success
        FROM logs.pipeline_audit_log
        WHERE event_type IN ('Staging Load', 'Transform')
          AND event_timestamp >= today() - INTERVAL 7 DAY
        GROUP BY event_type
      `;

      const stages = await analyticsService.query<{
        event_type: string;
        last_run: Date | null;
        has_success: number;
      }>(stagesSql);

      const stagingStage = stages.find((s) => s.event_type === 'Staging Load') || {
        event_type: 'Staging Load',
        last_run: null,
        has_success: 0,
      };

      const transformStage = stages.find((s) => s.event_type === 'Transform') || {
        event_type: 'Transform',
        last_run: null,
        has_success: 0,
      };

      const successRate =
        stat.total_files > 0
          ? (stat.success_count / stat.total_files) * 100
          : 0;

      return {
        totalFiles: stat.total_files,
        successCount: stat.success_count,
        failureCount: stat.failure_count,
        inProgressCount: stat.in_progress_count,
        skippedCount: stat.skipped_count,
        successRate: Math.round(successRate * 10) / 10,
        recentErrors: errors.map((e) => ({
          fileName: e.file_name,
          errorMessage: e.error_message || 'Unknown error',
          timestamp: e.event_timestamp ? new Date(e.event_timestamp) : new Date(),
        })),
        latestDataDate: validWatermark,
        pipelineStages: {
          staging: {
            status: stagingStage.has_success > 0 ? 'operational' : 'unknown',
            lastRun: stagingStage.last_run ? new Date(stagingStage.last_run) : null,
          },
          transform: {
            status: transformStage.has_success > 0 ? 'operational' : 'unknown',
            lastRun: transformStage.last_run ? new Date(transformStage.last_run) : null,
          },
          metabase: {
            status: 'operational', // Assume operational if staging and transform are working
            lastRun: transformStage.last_run ? new Date(transformStage.last_run) : null,
          },
        },
      };
    } catch (error) {
      console.error('Error getting pipeline summary:', error);
      throw new Error(
        `Failed to get pipeline summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const pipelineService = new PipelineService();

