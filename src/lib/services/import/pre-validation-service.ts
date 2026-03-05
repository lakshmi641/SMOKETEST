/**
 * Pre-Validation Service
 * 
 * Stage 1: Pre-Validation
 * Validates Excel files BEFORE processing:
 * - File format (.xlsx, .csv)
 * - Column headers (missing, extra)
 * - Required fields
 * - Data types
 */

import * as XLSX from 'xlsx';
import { parseDate, detectDateFormat, DateFormat } from '../../utils/excel/date-parser';
import {
    ImportType,
    PreValidationResult,
    PreValidationError,
    FileInfo,
    HeaderValidation,
    getSchemaForImportType,
    getAllExpectedHeaders,
    getRequiredHeaders
} from './types/import-types';

export class PreValidationService {

    /**
     * Validate file format
     */
    static validateFileFormat(file: File): { valid: boolean; error?: string } {
        const validExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.csv'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            return {
                valid: false,
                error: `Invalid file format "${fileName.split('.').pop()}". Please upload a valid Excel (.xlsx, .xls) or CSV file.`
            };
        }

        return { valid: true };
    }

    /**
     * Validate headers against expected schema
     */
    static validateHeaders(
        headers: string[],
        importType: ImportType,
        projectId?: string
    ): HeaderValidation {
        const expectedHeaders = getAllExpectedHeaders(importType);
        let requiredHeaders = getRequiredHeaders(importType);

        // If we have a projectId context, Project Name is not strictly required in the file (except for recurring tasks)
        if (projectId && importType !== 'recurring_tasks') {
            requiredHeaders = requiredHeaders.filter(h =>
                !['Project Name', 'Project', 'projectName', 'Project ID', 'projectId'].includes(h)
            );
        }

        // Normalize headers (trim, lowercase for comparison)
        const normalizedHeaders = headers.map(h => h.trim());
        const normalizedExpected = expectedHeaders.map(h => h.toLowerCase());
        const normalizedRequired = requiredHeaders.map(h => h.toLowerCase());

        // Find matched headers
        const matched = normalizedHeaders.filter(h =>
            normalizedExpected.includes(h.toLowerCase())
        );

        // Find missing required headers
        const missing = requiredHeaders.filter(h =>
            !normalizedHeaders.some(nh => nh.toLowerCase() === h.toLowerCase())
        );

        // Find extra headers (not in expected)
        const extra = normalizedHeaders.filter(h =>
            !normalizedExpected.includes(h.toLowerCase()) && h.trim() !== ''
        );

        // Check if order differs
        const expectedOrder = expectedHeaders.filter(h =>
            normalizedHeaders.some(nh => nh.toLowerCase() === h.toLowerCase())
        );
        const actualOrder = normalizedHeaders.filter(h =>
            normalizedExpected.includes(h.toLowerCase())
        );
        const orderDiffers = JSON.stringify(expectedOrder.map(h => h.toLowerCase())) !==
            JSON.stringify(actualOrder.map(h => h.toLowerCase()));

        return {
            matched,
            missing,
            extra,
            orderDiffers
        };
    }

    /**
     * Validate all rows for required fields and data types
     */
    static validateRows(
        rows: any[],
        importType: ImportType,
        projectId?: string
    ): PreValidationError[] {
        const errors: PreValidationError[] = [];
        let requiredHeaders = getRequiredHeaders(importType);

        if (projectId !== undefined && projectId !== null && importType !== 'recurring_tasks') {
            requiredHeaders = requiredHeaders.filter(h =>
                !['Project Name', 'Project', 'projectName', 'Project ID', 'projectId'].includes(h)
            );
        }

        // Ensure rows and requiredHeaders are arrays
        if (!Array.isArray(rows)) {
            console.error('Invalid rows data in validateRows:', typeof rows);
            return errors;
        }
        if (!Array.isArray(requiredHeaders)) {
            console.error('Invalid requiredHeaders in validateRows:', typeof requiredHeaders);
            return errors;
        }

        // Ensure rows and requiredHeaders are arrays
        if (!Array.isArray(rows)) {
            console.error('Invalid rows data in validateRows:', typeof rows);
            return errors;
        }
        if (!Array.isArray(requiredHeaders)) {
            console.error('Invalid requiredHeaders in validateRows:', typeof requiredHeaders);
            return errors;
        }

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // +2 because: +1 for header, +1 for 1-indexed

            // Check if row is completely empty (Trim whitespace first)
            const isEmpty = Object.values(row).every(val =>
                val === null || val === undefined || String(val).trim() === ''
            );

            if (isEmpty) {
                errors.push({
                    rowNumber,
                    column: '',
                    errorType: 'empty_row',
                    message: 'Empty row will be skipped',
                    severity: 'warning'
                });
                return;
            }

            // Check required fields (Case-Insensitive Resolution)
            requiredHeaders.forEach(header => {
                // Try exact match first, then case-insensitive
                let value = row[header];
                if (value === undefined) {
                    const actualKey = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
                    if (actualKey) value = row[actualKey];
                }

                if (value === null || value === undefined || String(value).trim() === '') {
                    errors.push({
                        rowNumber,
                        column: header,
                        errorType: 'missing_required',
                        message: `Required field '${header}' is missing`,
                        severity: 'error'
                    });
                }
            });

            // Validate data types
            this.validateDataTypes(row, rowNumber, importType, errors);
        });

        return errors;
    }

    /**
     * Validate data types for specific fields
     */
    private static validateDataTypes(
        row: any,
        rowNumber: number,
        importType: ImportType,
        errors: PreValidationError[]
    ): void {
        // Date fields
        const dateFields = this.getDateFields(importType) || [];
        if (!Array.isArray(dateFields)) return;
        dateFields.forEach(field => {
            const value = row[field];
            if (value && !this.isValidDate(value)) {
                errors.push({
                    rowNumber,
                    column: field,
                    errorType: 'invalid_type',
                    message: `'${field}' must be a valid date (YYYY-MM-DD or DD/MM/YYYY)`,
                    severity: 'error'
                });
            }
        });

        // Number fields
        const numberFields = this.getNumberFields(importType) || [];
        if (!Array.isArray(numberFields)) return;
        numberFields.forEach(field => {
            const value = row[field];
            if (value && !this.isValidNumber(value)) {
                errors.push({
                    rowNumber,
                    column: field,
                    errorType: 'invalid_type',
                    message: `'${field}' must be a valid number`,
                    severity: 'error'
                });
            }
        });

        // Enum fields
        const enumFields = this.getEnumFields(importType) || {};
        if (!enumFields || typeof enumFields !== 'object' || Array.isArray(enumFields)) return;
        const enumEntries = Object.entries(enumFields);
        if (!Array.isArray(enumEntries)) return;
        enumEntries.forEach(([field, validValues]) => {
            const value = row[field];
            if (value && !validValues.includes(value.toLowerCase())) {
                errors.push({
                    rowNumber,
                    column: field,
                    errorType: 'invalid_type',
                    message: `'${field}' must be one of: ${validValues.join(', ')}`,
                    severity: 'error'
                });
            }
        });
    }

    /**
     * Get date fields for import type
     */
    private static getDateFields(importType: ImportType): string[] {
        switch (importType) {
            case 'project_tasks':
                return ['Due Date', 'Start Date', 'End Date'];
            case 'wbs_gantt':
                return ['Start Date', 'End Date', 'Target Date'];
            case 'recurring_tasks':
                return ['Start Date', 'End Date'];
            default:
                return [];
        }
    }

    /**
     * Get number fields for import type
     */
    private static getNumberFields(importType: ImportType): string[] {
        const common = ['Estimated Hours'];

        switch (importType) {
            case 'wbs_gantt':
                return [...common, 'Lag Days'];
            case 'recurring_tasks':
                return [...common, 'Interval', 'Month Day', 'Due Days', 'End Count'];
            default:
                return common;
        }
    }

    /**
     * Get enum fields with valid values
     */
    private static getEnumFields(importType: ImportType): Record<string, string[]> {
        const common = {
            'Priority': ['low', 'medium', 'high', 'urgent', 'critical']
        };

        switch (importType) {
            case 'wbs_gantt':
                return {
                    ...common,
                    'Milestone': ['yes', 'no', 'true', 'false'],
                    'Dep Type': ['fs', 'ss', 'ff', 'sf']
                };
            case 'recurring_tasks':
                return {
                    ...common,
                    'Frequency': ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
                    'Assignment Type': ['specific_user', 'position'],
                    'End Type': ['never', 'on_date', 'after_count']
                };
            default:
                return common;
        }
    }

    /**
     * Check if value is a valid date
     */
    private static isValidDate(value: any): boolean {
        if (!value) return false;

        // Try parsing as Date
        const date = new Date(value);
        if (!isNaN(date.getTime())) return true;

        // Try DD/MM/YYYY format
        const ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        if (typeof value === 'string' && ddmmyyyy.test(value)) {
            const parts = value.split('/').map(Number);
            const day = parts[0];
            const month = parts[1];
            const year = parts[2];

            if (day === undefined || month === undefined || year === undefined) return false;

            const testDate = new Date(year, month - 1, day);
            return testDate.getDate() === day &&
                testDate.getMonth() === month - 1 &&
                testDate.getFullYear() === year;
        }

        return false;
    }

    /**
     * Check if value is a valid number
     */
    private static isValidNumber(value: any): boolean {
        if (value === null || value === undefined || value === '') return false;
        return !isNaN(Number(value));
    }

    /**
     * Full pre-validation pipeline
     */
    static async preValidate(
        file: File,
        importType: ImportType,
        projectId?: string
    ): Promise<PreValidationResult> {
        // Step 1: Validate file format
        const formatCheck = this.validateFileFormat(file);
        if (!formatCheck.valid) {
            return {
                success: false,
                canProceed: false,
                fileInfo: {
                    fileName: file.name,
                    fileSize: file.size,
                    rowCount: 0,
                    columnCount: 0,
                    fileType: file.name.endsWith('.csv') ? 'csv' : 'xlsx'
                },
                headerValidation: {
                    matched: [],
                    missing: [],
                    extra: [],
                    orderDiffers: false
                },
                rowErrors: [{
                    rowNumber: 0,
                    column: '',
                    errorType: 'invalid_format',
                    message: formatCheck.error!,
                    severity: 'error'
                }]
            };
        }

        // Step 2: Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error("No sheets found in workbook");
        }
        const firstSheet = workbook.Sheets[sheetName];
        if (!firstSheet) {
            throw new Error("First sheet not found in workbook");
        }

        // Step 2: Extract rows and filter out completely empty ones
        // Use raw: false to get formatted strings directly (e.g. "5/2/2026")
        // this avoids Excel's internal serial number misinterpretation.
        const allRows = XLSX.utils.sheet_to_json<any>(firstSheet, {
            defval: '',
            raw: false,
            dateNF: 'yyyy-mm-dd'
        });

        // Aggressively filter out rows that have no content in any meaningful field
        let rows = allRows.filter(row => {
            return !Object.values(row).every(val =>
                val === null || val === undefined || String(val).trim() === ''
            );
        });

        if (rows.length === 0) {
            return {
                success: false,
                canProceed: false,
                fileInfo: {
                    fileName: file.name,
                    fileSize: file.size,
                    rowCount: 0,
                    columnCount: 0,
                    fileType: file.name.endsWith('.csv') ? 'csv' : 'xlsx'
                },
                headerValidation: {
                    matched: [],
                    missing: [],
                    extra: [],
                    orderDiffers: false
                },
                rowErrors: [{
                    rowNumber: 0,
                    column: '',
                    errorType: 'invalid_format',
                    message: 'File is empty or has no data rows',
                    severity: 'error'
                }]
            };
        }

        // Post-process to normalize date values...
        const dateFields = this.getDateFields(importType) || [];
        // Ensure rows is an array
        if (!Array.isArray(rows)) {
            console.error('Invalid rows data in pre-validation:', typeof rows);
            rows = [];
        }

        if (Array.isArray(dateFields) && dateFields.length > 0) {
            // 1. Detect format for each date column
            const columnFormats: Record<string, DateFormat | null> = {};

            dateFields.forEach(field => {
                // Find actual column key that matches (case-insensitive)
                const actualKey = rows.length > 0
                    ? Object.keys(rows[0]).find(k => k.toLowerCase().trim() === field.toLowerCase().trim())
                    : null;

                const targetKey = actualKey || field;

                // CRITICAL: Use the values directly (they are already formatted strings from raw: false)
                const samples = rows
                    .map(r => String(r[targetKey] || '').trim())
                    .filter(val => val !== '' && val !== 'undefined' && val !== 'null');

                columnFormats[field] = detectDateFormat(samples);
                console.log(`[PreValidation] Detected format for ${field}: ${columnFormats[field]} (Samples: ${samples.slice(0, 3).join(', ')})`);
            });

            // 2. Normalize date values using detected format
            rows.forEach((row: any) => {
                dateFields.forEach(field => {
                    // Find actual column key that matches (case-insensitive)
                    const actualKey = Object.keys(row).find(k => k.toLowerCase().trim() === field.toLowerCase().trim());
                    if (!actualKey) return;

                    const val = row[actualKey];

                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        // Normalize date string with format hint
                        // CRITICAL: If no format detected but looks like a standard date, FORCE DMY_SLASH
                        let formatHint = columnFormats[field];
                        if (!formatHint && String(val).includes('/')) {
                            formatHint = 'DMY_SLASH';
                        } else if (!formatHint && String(val).includes('.')) {
                            formatHint = 'DMY_SLASH';
                        } else if (!formatHint && String(val).includes('-') && !String(val).match(/^\d{4}-/)) {
                            formatHint = 'DMY_DASH';
                        }

                        // Pass to parser
                        const normalized = parseDate(String(val), formatHint);

                        console.log(`[PreValidation] Field: ${field} (Key: ${actualKey}), Raw: ${val}, Detected: ${formatHint}, Normalized: ${normalized}`);

                        if (normalized) {
                            // Update the original key to the normalized YYYY-MM-DD
                            row[actualKey] = normalized;

                            // Also ensure standard camelCase key exists (e.g. "Due Date" -> "dueDate")
                            const camelKey = field.toLowerCase().split(' ').map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join('');
                            row[camelKey] = normalized;

                            // Debug log for normalization
                            if (val !== normalized) {
                                console.log(`[PreValidation] Normalized ${field}: ${val} -> ${normalized} (Stored in ${actualKey} and ${camelKey})`);
                            }
                        }
                    }
                });
            });
        }


        // Step 3: Validate headers
        const firstDataRow = rows[0];
        const headers = firstDataRow ? Object.keys(firstDataRow) : [];
        const headerValidation = this.validateHeaders(headers, importType, projectId);

        // Step 4: Validate rows
        const rowErrors = this.validateRows(rows, importType, projectId);

        // Step 5: Determine if can proceed
        // CRITICAL CHANGE: We only block if headers are missing. 
        // Row-level errors (invalid values, missing cells) should be fixable in the Review stage.
        const hasHeaderErrors = headerValidation.missing.length > 0;

        const fileInfo: FileInfo = {
            fileName: file.name,
            fileSize: file.size,
            rowCount: rows.length,
            columnCount: headers.length,
            fileType: file.name.endsWith('.csv') ? 'csv' : 'xlsx'
        };

        return {
            success: !hasHeaderErrors,
            canProceed: !hasHeaderErrors,
            fileInfo,
            headerValidation,
            rowErrors
        };
    }
}
