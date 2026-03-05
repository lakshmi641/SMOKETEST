/**
 * Import Job Types
 * 
 * Stage 1: Database Schema for Server-Side Import
 * 
 * These types define the ImportJob entity that tracks the lifecycle
 * of every import operation with a unique Processing ID.
 */

import { Timestamp } from 'firebase/firestore';
import { ImportType, ValidatedRow } from './import-types';

// ============================================================================
// IMPORT JOB STATUS
// ============================================================================

/**
 * Status lifecycle of an import job:
 * 
 * uploaded → validating → review → importing → completed
 *                 ↓           ↓         ↓
 *              failed     failed    failed
 */
export type ImportJobStatus =
    | 'uploaded'      // File uploaded to GCS, waiting for validation
    | 'validating'    // Cloud Function is processing validation
    | 'review'        // Validation complete, waiting for user review
    | 'importing'     // User confirmed, import in progress
    | 'completed'     // All tasks created successfully
    | 'failed';       // Error occurred at any stage

// ============================================================================
// IMPORT JOB STATISTICS
// ============================================================================

export interface ImportJobStats {
    /** Total rows in the Excel file */
    totalRows: number;

    /** Rows that passed validation */
    validRows: number;

    /** Rows with errors (blocking) */
    errorRows: number;

    /** Rows with warnings (non-blocking) */
    warningRows: number;

    /** Tasks successfully created (after import execution) */
    importedCount: number;

    /** Tasks that failed during import execution */
    failedCount: number;
}

// ============================================================================
// IMPORT JOB ERROR
// ============================================================================

export interface ImportJobError {
    /** Stage where the error occurred */
    stage: 'upload' | 'validation' | 'execution';

    /** Human-readable error message */
    message: string;

    /** Additional error details */
    details?: {
        /** Last row processed before failure */
        lastProcessedRow?: number;

        /** Specific error code */
        code?: string;

        /** Stack trace (development only) */
        stack?: string;
    };
}

// ============================================================================
// IMPORT JOB ENTITY
// ============================================================================

/**
 * ImportJob - The core entity for tracking import operations
 * 
 * Collection: companies/{companyId}/importJobs/{jobId}
 * 
 * This serves as the "Processing ID" that the user requested.
 * Every import operation creates one ImportJob document.
 */
export interface ImportJob {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    /** Unique job ID (same as Firestore document ID) - THE PROCESSING ID */
    id: string;

    /** Company this import belongs to */
    companyId: string;

    /** Enterprise Group ID (if applicable) */
    groupId?: string | null;

    /** User who initiated the import */
    userId: string;

    /** Display name of the user (for UI/audit) */
    userName: string;

    // -------------------------------------------------------------------------
    // Context
    // -------------------------------------------------------------------------

    /** Target workspace (if applicable) */
    workspaceId?: string | null;

    /** Target project (for single-project imports) */
    projectId?: string | null;

    /** Type of import being performed */
    importType: ImportType;

    // -------------------------------------------------------------------------
    // File Information
    // -------------------------------------------------------------------------

    /** Original file name */
    fileName: string;

    /** File size in bytes */
    fileSize: number;

    /** GCS path to the uploaded source file */
    sourceFileUrl: string;

    /** Column Mapping (system header -> excel header) */
    columnMapping?: Record<string, string> | null;

    // -------------------------------------------------------------------------
    // Processing State
    // -------------------------------------------------------------------------

    /** Current status of the import job */
    status: ImportJobStatus;

    // -------------------------------------------------------------------------
    // Validation Results (stored in GCS to avoid 1MB limit)
    // -------------------------------------------------------------------------

    /** GCS path to validation_results.json */
    validationResultUrl?: string;

    /** GCS path to user-corrected payload (after editing in review) */
    correctedPayloadUrl?: string;

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /** Import statistics */
    stats: ImportJobStats;

    // -------------------------------------------------------------------------
    // Error Tracking
    // -------------------------------------------------------------------------

    /** Error details if status === 'failed' */
    error?: ImportJobError;

    // -------------------------------------------------------------------------
    // Timestamps
    // -------------------------------------------------------------------------

    /** When the import was initiated */
    createdAt: Timestamp | string;

    /** Last status update */
    updatedAt: Timestamp | string;

    /** When the import completed (success or failure) */
    completedAt?: Timestamp | string;
}

// ============================================================================
// IMPORT JOB CREATE INPUT
// ============================================================================

/**
 * Input for creating a new ImportJob
 * (Used by ImportJobService.createJob)
 */
export interface CreateImportJobInput {
    companyId: string;
    groupId?: string;
    userId: string;
    userName: string;
    workspaceId?: string | null;
    projectId?: string | null;
    importType: ImportType;
    fileName: string;
    fileSize: number;
    columnMapping?: Record<string, string> | null;
}

// ============================================================================
// IMPORT JOB UPDATE INPUT
// ============================================================================

/**
 * Partial update for ImportJob
 * (Used by Cloud Functions to update status)
 */
export interface UpdateImportJobInput {
    status?: ImportJobStatus;
    validationResultUrl?: string;
    correctedPayloadUrl?: string;
    stats?: Partial<ImportJobStats>;
    error?: ImportJobError;
    completedAt?: Timestamp | string;
}

// ============================================================================
// VALIDATION RESULTS FILE STRUCTURE
// ============================================================================

/**
 * Structure of the validation_results.json file stored in GCS
 * This file can be 10MB+ for large imports, hence stored in GCS not Firestore
 */
export interface ValidationResultsFile {
    /** Job ID this result belongs to */
    jobId: string;

    /** Timestamp when validation was performed */
    validatedAt: string;

    /** Summary statistics */
    summary: {
        totalRows: number;
        validRows: number;
        errorRows: number;
        warningRows: number;
    };

    /** All validated rows with their status */
    rows: ValidatedRow[];
}

// ============================================================================
// IMPORT HISTORY QUERY
// ============================================================================

/**
 * Filters for querying import history
 */
export interface ImportJobQuery {
    companyId: string;
    groupId?: string;
    userId?: string;
    projectId?: string;
    status?: ImportJobStatus | ImportJobStatus[];
    importType?: ImportType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

// ============================================================================
// GCS FILE PATHS HELPER
// ============================================================================

/**
 * Generate GCS file paths for an import job
 */
export function getImportJobFilePaths(companyId: string, jobId: string, originalFileName: string = 'source.xlsx', groupId?: string) {
    const basePath = groupId
        ? `enterpriseGroups/${groupId}/companies/${companyId}/imports/${jobId}`
        : `imports/${companyId}/${jobId}`;

    // Preserve extension from original file
    const extMatch = originalFileName.match(/\.[^.]+$/);
    const extension = extMatch ? extMatch[0].toLowerCase() : '.xlsx';

    return {
        /** Path to the original uploaded file (preserves format) */
        sourceFile: `${basePath}/source${extension}`,

        /** Path to the validation results JSON */
        validationResults: `${basePath}/validation_results.json`,

        /** Path to user-corrected payload JSON */
        correctedPayload: `${basePath}/corrected_payload.json`,
    };
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Create default stats object for a new ImportJob
 */
export function createDefaultStats(): ImportJobStats {
    return {
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        warningRows: 0,
        importedCount: 0,
        failedCount: 0,
    };
}
