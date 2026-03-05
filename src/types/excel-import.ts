/**
 * Excel Import Types
 * 
 * Type definitions for the WBS Gantt Excel Import feature.
 * These types define the data structures used throughout the import process.
 * 
 * @module types/excel-import
 */

// ============================================================
// RAW DATA TYPES (from Excel parsing)
// ============================================================

/**
 * Raw row data extracted directly from Excel file before validation.
 * All fields are nullable as they come from user input.
 */
export interface ExcelRawRow {
    /** Row number in Excel (1-indexed, excluding header) */
    rowNumber: number
    /** Task name/title - Required field */
    taskName: string | null
    /** Task description - Optional */
    description: string | null
    /** Start date in various formats */
    startDate: string | null
    /** End date in various formats */
    endDate: string | null
    /** Milestone indicator: "Yes", "No", "TRUE", "FALSE", "1", "0" */
    milestone: string | null
    /** Predecessor task name(s) - comma separated for multiple */
    predecessor: string | null
    /** Dependency type: FS, SS, FF, SF */
    dependencyType: string | null
    /** Lag days after predecessor (can be negative for lead) */
    lagDays: string | null
}

// ============================================================
// VALIDATED DATA TYPES (after processing)
// ============================================================

/**
 * Validated and processed row ready for import.
 * All required fields are guaranteed to be present and valid.
 */
export interface ExcelValidatedRow {
    /** Row number in Excel (1-indexed) */
    rowNumber: number
    /** Validated task name */
    taskName: string
    /** Task description (empty string if not provided) */
    description: string
    /** Start date in ISO format (YYYY-MM-DD) */
    startDate: string
    /** End date in ISO format (YYYY-MM-DD) */
    endDate: string
    /** Whether this is a milestone (zero-duration) */
    isMilestone: boolean
    /** Parsed predecessor task names (can be empty) */
    predecessorNames: string[]
    /** Dependency type for all predecessors */
    dependencyType: DependencyType
    /** Lag days (can be negative for lead) */
    lagDays: number
    /** Whether the row is valid for import */
    isValid: boolean
    /** Validation errors (blocking) */
    errors: ValidationError[]
    /** Validation warnings (non-blocking) */
    warnings: ValidationWarning[]
}

// ============================================================
// DEPENDENCY TYPES
// ============================================================

/**
 * Dependency types supported by WBS Gantt.
 * 
 * - FS: Finish-to-Start (most common) - Successor starts after predecessor finishes
 * - SS: Start-to-Start - Both tasks start together
 * - FF: Finish-to-Finish - Both tasks finish together
 * - SF: Start-to-Finish - Successor finishes when predecessor starts (rare)
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

/**
 * Resolved dependency with actual task ID.
 * Created after finding the predecessor task by name.
 */
export interface ResolvedDependency {
    /** Original task name from Excel */
    predecessorName: string
    /** Resolved task ID from Firestore */
    predecessorId: string
    /** Dependency type */
    type: DependencyType
    /** Lag in days */
    lag: number
}

// ============================================================
// VALIDATION TYPES
// ============================================================

/**
 * Validation error codes for specific error types.
 */
export type ValidationErrorCode =
    | 'REQUIRED_FIELD_MISSING'
    | 'INVALID_DATE_FORMAT'
    | 'END_BEFORE_START'
    | 'INVALID_DEPENDENCY_TYPE'
    | 'PREDECESSOR_NOT_FOUND'
    | 'SELF_REFERENCE'
    | 'INVALID_LAG_VALUE'
    | 'DUPLICATE_TASK_NAME'

/**
 * Validation error that blocks row import.
 */
export interface ValidationError {
    /** Field that has the error */
    field: string
    /** User-friendly error message */
    message: string
    /** Error code for programmatic handling */
    code: ValidationErrorCode
}

/**
 * Validation warning that doesn't block import.
 */
export interface ValidationWarning {
    /** Field with the warning */
    field: string
    /** User-friendly warning message */
    message: string
}

// ============================================================
// IMPORT RESULT TYPES
// ============================================================

/**
 * Result status for a single row import.
 */
export type ImportRowStatus = 'success' | 'error' | 'skipped'

/**
 * Import result for a single row.
 */
export interface ImportRowResult {
    /** Row number from Excel */
    rowNumber: number
    /** Task name (for display) */
    taskName: string
    /** Import status */
    status: ImportRowStatus
    /** Created task ID (if success) */
    taskId?: string
    /** Error message (if error or skipped) */
    error?: string
    /** Resolved dependencies (if success) */
    resolvedDependencies?: ResolvedDependency[]
}

/**
 * Overall import result summary.
 */
export interface ImportResult {
    /** Total rows processed */
    totalRows: number
    /** Successfully imported count */
    successCount: number
    /** Failed import count */
    errorCount: number
    /** Skipped (invalid) count */
    skippedCount: number
    /** Individual row results */
    results: ImportRowResult[]
    /** Total import duration in milliseconds */
    duration: number
}

// ============================================================
// DIALOG STATE TYPES
// ============================================================

/**
 * Import dialog state machine states.
 */
export type ImportDialogState =
    | 'idle'           // Initial state, waiting for file
    | 'file-selected'  // File selected, ready to parse
    | 'parsing'        // Currently parsing Excel
    | 'previewing'     // Showing preview, ready to import
    | 'importing'      // Currently creating tasks
    | 'complete'       // Import finished (success or partial)
    | 'error'          // Critical error occurred

/**
 * Props for the Excel Import Dialog component.
 */
export interface ExcelImportDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean
    /** Callback when dialog is closed */
    onClose: () => void
    /** Current project ID */
    projectId: string
    /** Existing tasks in the project (for predecessor lookup) */
    existingTasks?: Array<{ id: string; title: string }>
    /** Callback when import is complete */
    onImportComplete?: (result: ImportResult) => void
}

// ============================================================
// FILE VALIDATION TYPES
// ============================================================

/**
 * Result of file validation before parsing.
 */
export interface FileValidationResult {
    /** Whether the file is valid */
    valid: boolean
    /** Error message if invalid */
    error?: string
}

/**
 * Supported date formats for auto-detection.
 */
export type DateFormat =
    | 'ISO'         // YYYY-MM-DD
    | 'DMY_SLASH'   // DD/MM/YYYY
    | 'MDY_SLASH'   // MM/DD/YYYY
    | 'DMY_DASH'    // DD-MM-YYYY
    | 'EXCEL'       // Excel serial number

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Maximum file size in bytes (5MB).
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Maximum rows allowed per import.
 */
export const MAX_ROWS = 500

/**
 * Allowed file extensions.
 */
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

/**
 * Allowed MIME types for Excel files.
 */
export const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
]

/**
 * Expected column headers in Excel (case-insensitive matching).
 */
export const EXPECTED_HEADERS = {
    TASK_NAME: ['task name', 'task', 'name', 'title'],
    DESCRIPTION: ['description', 'desc', 'details', 'notes'],
    START_DATE: ['start date', 'start', 'begin'],
    END_DATE: ['end date', 'end', 'due date', 'due', 'finish'],
    MILESTONE: ['milestone', 'is milestone'],
    PREDECESSOR: ['predecessor', 'predecessors', 'depends on', 'dependency', 'producer'],
    DEPENDENCY_TYPE: ['dependency type', 'dep type', 'link type'],
    LAG_DAYS: ['lag', 'lag days', 'delay', 'offset'],
} as const

/**
 * Default values for optional fields.
 */
export const FIELD_DEFAULTS = {
    description: '',
    isMilestone: false,
    dependencyType: 'FS' as DependencyType,
    lagDays: 0,
    priority: 'medium' as const,
    estimatedHours: 8,
} as const
