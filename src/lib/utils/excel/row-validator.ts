/**
 * Row Validator Utility
 * 
 * Validates Excel rows for required fields, date consistency,
 * and dependency format.
 * 
 * @module lib/utils/excel/row-validator
 */

import { parseDate, isValidDate, compareDates } from './date-parser'
import {
    ExcelRawRow,
    ExcelValidatedRow,
    ValidationError,
    ValidationWarning,
    ValidationErrorCode,
    DependencyType,
    FIELD_DEFAULTS,
} from '@/types/excel-import'

// ============================================================
// MAIN VALIDATION FUNCTION
// ============================================================

/**
 * Validate and transform a raw Excel row into a validated row.
 * 
 * @param rawRow - Raw row data from Excel
 * @param allTaskNames - Set of all task names in the import (for duplicate check)
 * @returns Validated row with errors and warnings
 */
export function validateRow(
    rawRow: ExcelRawRow,
    allTaskNames?: Set<string>
): ExcelValidatedRow {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate Task Name (required)
    const taskName = validateTaskName(rawRow.taskName, allTaskNames, errors, warnings)

    // Validate Description (optional)
    const description = validateDescription(rawRow.description)

    // Validate Dates (required)
    const { startDate, endDate } = validateDates(
        rawRow.startDate,
        rawRow.endDate,
        errors
    )

    // Validate Milestone (optional)
    const isMilestone = validateMilestone(rawRow.milestone, startDate, endDate, warnings)

    // Validate Predecessor (optional)
    const predecessorNames = validatePredecessor(rawRow.predecessor)

    // Validate Dependency Type (optional)
    const dependencyType = validateDependencyType(rawRow.dependencyType, errors)

    // Validate Lag Days (optional)
    const lagDays = validateLagDays(rawRow.lagDays, errors)

    // Check if valid
    const isValid = errors.length === 0 && taskName !== '' && startDate !== '' && endDate !== ''

    return {
        rowNumber: rawRow.rowNumber,
        taskName,
        description,
        startDate,
        endDate,
        isMilestone,
        predecessorNames,
        dependencyType,
        lagDays,
        isValid,
        errors,
        warnings,
    }
}

/**
 * Validate an array of raw rows.
 * Also checks for duplicate task names across all rows.
 * 
 * @param rawRows - Array of raw Excel rows
 * @returns Array of validated rows
 */
export function validateAllRows(rawRows: ExcelRawRow[]): ExcelValidatedRow[] {
    // Build set of all task names for duplicate detection
    const taskNameCounts = new Map<string, number>()
    for (const row of rawRows) {
        if (row.taskName) {
            const name = row.taskName.toLowerCase().trim()
            taskNameCounts.set(name, (taskNameCounts.get(name) || 0) + 1)
        }
    }

    // Find duplicates
    const duplicates = new Set<string>()
    for (const [name, count] of taskNameCounts.entries()) {
        if (count > 1) {
            duplicates.add(name)
        }
    }

    // Validate each row
    return rawRows.map(row => validateRow(row, duplicates))
}

// ============================================================
// FIELD VALIDATORS
// ============================================================

/**
 * Validate task name.
 */
function validateTaskName(
    taskName: string | null,
    duplicates: Set<string> | undefined,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): string {
    if (!taskName || !taskName.trim()) {
        errors.push({
            field: 'taskName',
            message: 'Task name is required',
            code: 'REQUIRED_FIELD_MISSING',
        })
        return ''
    }

    const trimmed = taskName.trim()

    // Check for duplicates (warning, not error)
    if (duplicates?.has(trimmed.toLowerCase())) {
        warnings.push({
            field: 'taskName',
            message: `Duplicate task name: "${trimmed}". Will use first occurrence for dependencies.`,
        })
    }

    // Check length
    if (trimmed.length > 200) {
        warnings.push({
            field: 'taskName',
            message: 'Task name is very long and may be truncated in some views.',
        })
    }

    return trimmed
}

/**
 * Validate description.
 */
function validateDescription(description: string | null): string {
    if (!description) {
        return FIELD_DEFAULTS.description
    }

    const trimmed = description.trim()

    // Limit length if too long
    if (trimmed.length > 2000) {
        return trimmed.substring(0, 2000)
    }

    return trimmed
}

/**
 * Validate start and end dates.
 */
function validateDates(
    startDateStr: string | null,
    endDateStr: string | null,
    errors: ValidationError[]
): { startDate: string; endDate: string } {
    // Validate start date
    let startDate = ''
    if (!startDateStr || !startDateStr.trim()) {
        errors.push({
            field: 'startDate',
            message: 'Start date is required',
            code: 'REQUIRED_FIELD_MISSING',
        })
    } else {
        const parsed = parseDate(startDateStr)
        if (!parsed) {
            errors.push({
                field: 'startDate',
                message: `Invalid date format: "${startDateStr}". Use YYYY-MM-DD or DD/MM/YYYY.`,
                code: 'INVALID_DATE_FORMAT',
            })
        } else {
            startDate = parsed
        }
    }

    // Validate end date
    let endDate = ''
    if (!endDateStr || !endDateStr.trim()) {
        errors.push({
            field: 'endDate',
            message: 'End date is required',
            code: 'REQUIRED_FIELD_MISSING',
        })
    } else {
        const parsed = parseDate(endDateStr)
        if (!parsed) {
            errors.push({
                field: 'endDate',
                message: `Invalid date format: "${endDateStr}". Use YYYY-MM-DD or DD/MM/YYYY.`,
                code: 'INVALID_DATE_FORMAT',
            })
        } else {
            endDate = parsed
        }
    }

    // Validate end >= start
    if (startDate && endDate && compareDates(endDate, startDate) < 0) {
        errors.push({
            field: 'endDate',
            message: 'End date cannot be before start date',
            code: 'END_BEFORE_START',
        })
    }

    return { startDate, endDate }
}

/**
 * Validate milestone field.
 */
function validateMilestone(
    milestone: string | null,
    startDate: string,
    endDate: string,
    warnings: ValidationWarning[]
): boolean {
    if (!milestone || !milestone.trim()) {
        return FIELD_DEFAULTS.isMilestone
    }

    const value = milestone.trim().toLowerCase()
    const isMilestone = ['yes', 'true', '1', 'y'].includes(value)

    // Warn if milestone but dates differ
    if (isMilestone && startDate && endDate && startDate !== endDate) {
        warnings.push({
            field: 'milestone',
            message: 'Milestone should have same start and end date. End date will be used as target.',
        })
    }

    return isMilestone
}

/**
 * Parse predecessor field (comma-separated task names).
 */
function validatePredecessor(predecessor: string | null): string[] {
    if (!predecessor || !predecessor.trim()) {
        return []
    }

    // Split by comma and clean up
    return predecessor
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
}

/**
 * Validate dependency type.
 */
function validateDependencyType(
    depType: string | null,
    errors: ValidationError[]
): DependencyType {
    if (!depType || !depType.trim()) {
        return FIELD_DEFAULTS.dependencyType
    }

    const value = depType.trim().toUpperCase()
    const validTypes: DependencyType[] = ['FS', 'SS', 'FF', 'SF']

    if (validTypes.includes(value as DependencyType)) {
        return value as DependencyType
    }

    errors.push({
        field: 'dependencyType',
        message: `Invalid dependency type: "${depType}". Use FS, SS, FF, or SF.`,
        code: 'INVALID_DEPENDENCY_TYPE',
    })

    return FIELD_DEFAULTS.dependencyType
}

/**
 * Validate lag days.
 */
function validateLagDays(lagDays: string | null, errors: ValidationError[]): number {
    if (!lagDays || !lagDays.trim()) {
        return FIELD_DEFAULTS.lagDays
    }

    const value = parseFloat(lagDays.trim())

    if (isNaN(value)) {
        errors.push({
            field: 'lagDays',
            message: `Invalid lag value: "${lagDays}". Must be a number.`,
            code: 'INVALID_LAG_VALUE',
        })
        return FIELD_DEFAULTS.lagDays
    }

    // Reasonable bounds check
    if (value < -365 || value > 365) {
        errors.push({
            field: 'lagDays',
            message: 'Lag days must be between -365 and 365.',
            code: 'INVALID_LAG_VALUE',
        })
        return FIELD_DEFAULTS.lagDays
    }

    return Math.round(value) // Round to integer days
}

// ============================================================
// PREDECESSOR RESOLUTION (Phase 2)
// ============================================================

/**
 * Resolve predecessor names to task IDs.
 * Called during import when we have the task ID map.
 * 
 * @param predecessorNames - Array of task names from Excel
 * @param taskMap - Map of task name (lowercase) to task ID
 * @returns Array of validation errors for not-found predecessors
 */
export function validatePredecessorResolution(
    predecessorNames: string[],
    taskMap: Map<string, string>
): ValidationError[] {
    const errors: ValidationError[] = []

    for (const name of predecessorNames) {
        const normalized = name.toLowerCase().trim()
        if (!taskMap.has(normalized)) {
            errors.push({
                field: 'predecessor',
                message: `Predecessor task "${name}" not found. Check spelling.`,
                code: 'PREDECESSOR_NOT_FOUND',
            })
        }
    }

    return errors
}
