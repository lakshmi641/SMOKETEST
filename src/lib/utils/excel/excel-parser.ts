/**
 * Excel Parser Utility
 * 
 * Parses Excel files (.xlsx, .xls) and extracts task data.
 * Uses SheetJS (xlsx) library for parsing.
 * 
 * @module lib/utils/excel/excel-parser
 */

import * as XLSX from 'xlsx'
import {
    ExcelRawRow,
    ExcelValidatedRow,
    FileValidationResult,
    MAX_FILE_SIZE,
    MAX_ROWS,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    EXPECTED_HEADERS,
} from '@/types/excel-import'
import { validateAllRows } from './row-validator'

// ============================================================
// FILE VALIDATION
// ============================================================

/**
 * Validate a file before attempting to parse it.
 * 
 * @param file - File object from input or drag/drop
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
    // Check file exists
    if (!file) {
        return { valid: false, error: 'No file provided' }
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        const maxMB = MAX_FILE_SIZE / (1024 * 1024)
        return { valid: false, error: `File size exceeds ${maxMB}MB limit` }
    }

    // Check file type by extension
    const fileName = file.name.toLowerCase()
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))
    if (!hasValidExtension) {
        return {
            valid: false,
            error: 'Please upload an Excel file (.xlsx or .xls)'
        }
    }

    // Check MIME type (may not be reliable in all browsers)
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        // Some browsers report empty or different MIME types, so just warn
        console.warn(`Unexpected MIME type: ${file.type}`)
    }

    return { valid: true }
}

// ============================================================
// HEADER MAPPING
// ============================================================

/**
 * Column mapping result from header detection.
 */
interface HeaderMapping {
    taskName: number
    description: number
    startDate: number
    endDate: number
    milestone: number
    predecessor: number
    dependencyType: number
    lagDays: number
}

/**
 * Map Excel headers to expected field indices.
 * Uses case-insensitive matching with multiple aliases.
 * 
 * @param headers - Array of header strings from first row
 * @returns Mapping of field names to column indices (-1 if not found)
 */
export function mapHeaders(headers: string[]): {
    mapping: HeaderMapping
    unmapped: string[]
    missingRequired: string[]
} {
    const normalizedHeaders = headers.map(h =>
        (h || '').toString().toLowerCase().trim()
    )

    const findColumn = (aliases: readonly string[]): number => {
        for (const alias of aliases) {
            const index = normalizedHeaders.findIndex(h => h === alias)
            if (index !== -1) return index
        }
        // Try partial match
        for (const alias of aliases) {
            const index = normalizedHeaders.findIndex(h => h.includes(alias))
            if (index !== -1) return index
        }
        return -1
    }

    const mapping: HeaderMapping = {
        taskName: findColumn(EXPECTED_HEADERS.TASK_NAME),
        description: findColumn(EXPECTED_HEADERS.DESCRIPTION),
        startDate: findColumn(EXPECTED_HEADERS.START_DATE),
        endDate: findColumn(EXPECTED_HEADERS.END_DATE),
        milestone: findColumn(EXPECTED_HEADERS.MILESTONE),
        predecessor: findColumn(EXPECTED_HEADERS.PREDECESSOR),
        dependencyType: findColumn(EXPECTED_HEADERS.DEPENDENCY_TYPE),
        lagDays: findColumn(EXPECTED_HEADERS.LAG_DAYS),
    }

    // Find unmapped columns (headers not recognized)
    const mappedIndices = new Set(Object.values(mapping).filter(i => i >= 0))
    const unmapped = headers.filter((_, i) => !mappedIndices.has(i))

    // Check required columns
    const missingRequired: string[] = []
    if (mapping.taskName === -1) missingRequired.push('Task Name')
    if (mapping.startDate === -1) missingRequired.push('Start Date')
    if (mapping.endDate === -1) missingRequired.push('End Date')

    return { mapping, unmapped, missingRequired }
}

// ============================================================
// MAIN PARSING FUNCTION
// ============================================================

/**
 * Parse result from Excel file.
 */
export interface ParseResult {
    /** Validated rows ready for import */
    rows: ExcelValidatedRow[]
    /** Original headers from Excel */
    headers: string[]
    /** Warnings during parsing */
    warnings: string[]
    /** Total rows found (before validation) */
    totalRows: number
    /** Columns that weren't recognized */
    unmappedColumns: string[]
}

/**
 * Parse an Excel file and extract task rows.
 * 
 * @param file - Excel file (.xlsx or .xls)
 * @returns Parsed and validated rows
 * @throws Error if file is invalid or empty
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
    // Validate file first
    const validation = validateFile(file)
    if (!validation.valid) {
        throw new Error(validation.error)
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer()

    // Parse with SheetJS
    const workbook = XLSX.read(buffer, { type: 'array' })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        throw new Error('Excel file has no sheets')
    }

    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
        throw new Error('Could not read Excel sheet')
    }

    // Convert to JSON array
    const jsonData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
    })

    if (jsonData.length === 0) {
        throw new Error('Excel file is empty')
    }

    // Extract headers (first row)
    const headers = (jsonData[0] as string[]).map(h =>
        h ? String(h).trim() : ''
    )

    // Map headers to columns
    const { mapping, unmapped, missingRequired } = mapHeaders(headers)

    const warnings: string[] = []

    // Check for missing required columns
    if (missingRequired.length > 0) {
        throw new Error(
            `Missing required columns: ${missingRequired.join(', ')}. ` +
            `Please ensure your Excel has columns for Task Name, Start Date, and End Date.`
        )
    }

    // Warn about unmapped columns
    if (unmapped.length > 0) {
        warnings.push(`Columns not recognized and will be ignored: ${unmapped.join(', ')}`)
    }

    // Extract data rows (skip header)
    const dataRows = jsonData.slice(1)

    // Check row limit
    if (dataRows.length > MAX_ROWS) {
        throw new Error(
            `Too many rows (${dataRows.length}). Maximum ${MAX_ROWS} rows per import. ` +
            `Please split your file into smaller batches.`
        )
    }

    // Convert to raw rows
    const rawRows: ExcelRawRow[] = dataRows
        .map((row, index) => extractRawRow(row as string[], mapping, index + 2)) // +2 for 1-indexed + header
        .filter(row => row !== null) as ExcelRawRow[]

    // Validate all rows
    const validatedRows = validateAllRows(rawRows)

    return {
        rows: validatedRows,
        headers,
        warnings,
        totalRows: dataRows.length,
        unmappedColumns: unmapped,
    }
}

/**
 * Extract a raw row from Excel data using column mapping.
 * Returns null if the row is empty.
 */
function extractRawRow(
    row: string[],
    mapping: HeaderMapping,
    rowNumber: number
): ExcelRawRow | null {
    const getValue = (index: number): string | null => {
        if (index < 0 || index >= row.length) return null
        const value = row[index]
        if (value === undefined || value === null) return null
        return String(value).trim() || null
    }

    const taskName = getValue(mapping.taskName)

    // Skip completely empty rows
    if (!taskName && !getValue(mapping.startDate) && !getValue(mapping.endDate)) {
        return null
    }

    return {
        rowNumber,
        taskName,
        description: getValue(mapping.description),
        startDate: getValue(mapping.startDate),
        endDate: getValue(mapping.endDate),
        milestone: getValue(mapping.milestone),
        predecessor: getValue(mapping.predecessor),
        dependencyType: getValue(mapping.dependencyType),
        lagDays: getValue(mapping.lagDays),
    }
}

// ============================================================
// TEMPLATE GENERATION
// ============================================================

/**
 * Generate a downloadable Excel template with correct headers.
 * 
 * @returns Blob containing the Excel file
 */
export function generateTemplate(): Blob {
    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Tasks sheet with sample data
    const tasksData = [
        // Headers
        [
            'Task Name',
            'Description',
            'Start Date',
            'End Date',
            'Milestone',
            'Predecessor',
            'Dependency Type',
            'Lag Days',
        ],
        // Sample data
        [
            'Project Kickoff',
            'Initial project meeting',
            '2024-12-10',
            '2024-12-10',
            'Yes',
            '',
            '',
            '',
        ],
        [
            'Site Preparation',
            'Clear and level the site',
            '2024-12-11',
            '2024-12-15',
            'No',
            'Project Kickoff',
            'FS',
            '0',
        ],
        [
            'Foundation',
            'Lay concrete foundation',
            '2024-12-16',
            '2024-12-22',
            'No',
            'Site Preparation',
            'FS',
            '0',
        ],
        [
            'Foundation Complete',
            'Milestone marking foundation completion',
            '2024-12-22',
            '2024-12-22',
            'Yes',
            'Foundation',
            'FS',
            '0',
        ],
        [
            'Wall Framing',
            'Build wall frames',
            '2024-12-23',
            '2024-12-30',
            'No',
            'Foundation Complete',
            'FS',
            '1',
        ],
        // Empty row for user data
        ['', '', '', '', '', '', '', ''],
    ]

    const tasksSheet = XLSX.utils.aoa_to_sheet(tasksData)

    // Set column widths
    tasksSheet['!cols'] = [
        { wch: 25 }, // Task Name
        { wch: 35 }, // Description
        { wch: 12 }, // Start Date
        { wch: 12 }, // End Date
        { wch: 10 }, // Milestone
        { wch: 25 }, // Predecessor
        { wch: 15 }, // Dependency Type
        { wch: 10 }, // Lag Days
    ]

    XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tasks')

    // Instructions sheet
    const instructionsData = [
        ['WBS Gantt Import Template - Instructions'],
        [''],
        ['Column', 'Required', 'Description', 'Example'],
        ['Task Name', 'Yes', 'Name of the task (must be unique for dependencies)', 'Foundation Work'],
        ['Description', 'No', 'Detailed task description', 'Lay concrete foundation'],
        ['Start Date', 'Yes', 'When task starts (YYYY-MM-DD recommended)', '2024-12-15'],
        ['End Date', 'Yes', 'When task ends (same as Start for milestones)', '2024-12-20'],
        ['Milestone', 'No', 'Yes or No - marks zero-duration event', 'Yes'],
        ['Predecessor', 'No', 'Task name this depends on (use exact name)', 'Site Preparation'],
        ['Dependency Type', 'No', 'FS=Finish-Start, SS=Start-Start, FF=Finish-Finish, SF=Start-Finish', 'FS'],
        ['Lag Days', 'No', 'Days to wait after predecessor (can be negative)', '2'],
        [''],
        ['Notes:'],
        ['- Multiple predecessors: separate with comma (e.g., "Task A, Task B")'],
        ['- Milestone tasks should have same Start and End date'],
        ['- Task names are matched case-insensitively'],
        ['- Maximum 500 rows per import'],
    ]

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData)
    instructionsSheet['!cols'] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 50 },
        { wch: 25 },
    ]

    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

    // Generate blob
    const wbout = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array'
    })

    return new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
}

/**
 * Trigger download of the template file.
 */
export function downloadTemplate(): void {
    const blob = generateTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'task-import-template.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
