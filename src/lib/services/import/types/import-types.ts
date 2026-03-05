/**
 * Task Import Types
 * 
 * Type definitions for the task import system.
 * Supports Project Tasks, WBS Gantt, and Recurring Tasks import.
 */

// ============================================================================
// IMPORT TYPES
// ============================================================================

export type ImportType = 'project_tasks' | 'wbs_gantt' | 'recurring_tasks' | 'subtasks';

export type ImportStep = 'upload' | 'column_mapping' | 'review' | 'importing' | 'complete';

// ============================================================================
// PRE-VALIDATION TYPES
// ============================================================================

export interface FileInfo {
    fileName: string;
    fileSize: number;
    rowCount: number;
    columnCount: number;
    fileType: 'xlsx' | 'csv';
}

export interface HeaderValidation {
    matched: string[];
    missing: string[];
    extra: string[];
    orderDiffers: boolean;
}

export interface PreValidationError {
    rowNumber: number;
    column: string;
    errorType: 'missing_required' | 'invalid_type' | 'empty_row' | 'invalid_format';
    message: string;
    severity: 'error' | 'warning';
}

export interface PreValidationResult {
    success: boolean;
    canProceed: boolean;
    fileInfo: FileInfo;
    headerValidation: HeaderValidation;
    rowErrors: PreValidationError[];
}

// ============================================================================
// SPECIFIC VALIDATION & RESOLUTION TYPES
// ============================================================================

export interface CellSuggestion {
    value: any;
    label: string;
    confidence: number;
}

export interface CellValidationMessage {
    field: string;
    message: string;
    severity: 'error' | 'warning';
    suggestion?: CellSuggestion;
}

export interface ValidatedRow {
    rowNumber: number;
    data: Record<string, any>;
    resolvedData: Record<string, any>;
    status: 'success' | 'warning' | 'error';
    messages: CellValidationMessage[];
}

export interface SpecificValidationResult {
    success: boolean;
    rows: ValidatedRow[];
    summary: {
        totalRows: number;
        validRows: number;
        warningRows: number;
        errorRows: number;
    };
}

export interface ImportContext {
    companyId: string;
    workspaceId: string;
    projectId?: string;
    parentId?: string;
    userId: string;

    /** 
     * Import Job ID (Processing ID) - links created tasks back to the import job
     * Added in Server-Side Import architecture
     */
    importJobId?: string;
}

export interface ResolutionResult<T> {
    success: boolean;
    resolved: boolean;
    value?: T;
    label?: string;
    confidence: 'exact' | 'partial' | 'fuzzy' | 'none';
    error?: string;
    suggestions?: { value: T; label: string; confidence: number }[];
}

// ============================================================================
// EXPECTED SCHEMAS FOR EACH IMPORT TYPE
// ============================================================================

export const PROJECT_TASKS_SCHEMA = {
    required: ['Task Name', 'Project Name'],
    optional: [
        'Description',
        'Priority',

        'Estimated Hours',
        'Start Date',
        'Due Date',
        'Assigned User',
        'Reporter',
        'Task Type',
        'Requirement Type',
        'Status'
    ]
} as const;

export const WBS_GANTT_SCHEMA = {
    required: ['Task Name', 'Start Date', 'End Date'],
    optional: [
        'Description',
        'Priority',
        'Status',

        'Estimated Hours',
        'Assigned User',
        'Reporter',
        'Task Type',
        'Requirement Type',
        'Milestone',
        'Predecessor',
        'Dep Type',
        'Lag Days'
    ]
} as const;


export const RECURRING_TASKS_SCHEMA = {
    required: ['Task Name', 'Project Name', 'Frequency', 'Assignment Type', 'Assigned User'],
    optional: [
        'Description',
        'Priority',

        'Estimated Hours',
        'Department',
        'Position',
        'Interval',
        'Week Days',
        'Month Day',
        'Last Day of Month',
        'Quarter Month',
        'Timezone',
        'Start Date',
        'Due Days',
        'End Type',
        'End Date',
        'End Count'
    ]
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSchemaForImportType(importType: ImportType) {
    switch (importType) {
        case 'project_tasks':
            return PROJECT_TASKS_SCHEMA;
        case 'wbs_gantt':
            return WBS_GANTT_SCHEMA;
        case 'recurring_tasks':
            return RECURRING_TASKS_SCHEMA;
        case 'subtasks':
            return PROJECT_TASKS_SCHEMA;
        default:
            throw new Error(`Unknown import type: ${importType}`);
    }
}

export function getAllExpectedHeaders(importType: ImportType): string[] {
    const schema = getSchemaForImportType(importType);
    return [...schema.required, ...schema.optional];
}

export function getRequiredHeaders(importType: ImportType): string[] {
    const schema = getSchemaForImportType(importType);
    return [...schema.required];
}
