/**
 * Pre-Validation Service Tests
 * 
 * Tests for Stage 1: Pre-Validation
 * Must achieve 100% coverage before proceeding to Stage 2
 */

import { describe, it, expect } from '@jest/globals';
import { PreValidationService } from '../pre-validation-service';
import { ImportType } from '../types/import-types';

describe('PreValidationService', () => {

    describe('validateFileFormat', () => {
        it('should accept .xlsx files', () => {
            const file = new File([], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const result = PreValidationService.validateFileFormat(file);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should accept .csv files', () => {
            const file = new File([], 'test.csv', { type: 'text/csv' });
            const result = PreValidationService.validateFileFormat(file);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject .txt files', () => {
            const file = new File([], 'test.txt', { type: 'text/plain' });
            const result = PreValidationService.validateFileFormat(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid file format');
        });

        it('should reject .pdf files', () => {
            const file = new File([], 'test.pdf', { type: 'application/pdf' });
            const result = PreValidationService.validateFileFormat(file);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid file format');
        });

        it('should be case-insensitive', () => {
            const file = new File([], 'TEST.XLSX', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const result = PreValidationService.validateFileFormat(file);
            expect(result.valid).toBe(true);
        });
    });

    describe('validateHeaders - Project Tasks', () => {
        const importType: ImportType = 'project_tasks';

        it('should accept all required headers', () => {
            const headers = ['Task Name', 'Due Date'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toHaveLength(0);
            expect(result.matched).toContain('Task Name');
            expect(result.matched).toContain('Due Date');
        });

        it('should detect missing required headers', () => {
            const headers = ['Task Name']; // Missing 'Due Date'
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toContain('Due Date');
        });

        it('should accept optional headers', () => {
            const headers = ['Task Name', 'Due Date', 'Description', 'Priority'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toHaveLength(0);
            expect(result.matched).toContain('Description');
            expect(result.matched).toContain('Priority');
        });

        it('should flag extra headers as warning', () => {
            const headers = ['Task Name', 'Due Date', 'Unknown Column'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.extra).toContain('Unknown Column');
        });

        it('should be case-insensitive for headers', () => {
            const headers = ['task name', 'due date'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toHaveLength(0);
        });

        it('should detect order differences', () => {
            const headers = ['Due Date', 'Task Name']; // Reversed order
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.orderDiffers).toBe(true);
        });
    });

    describe('validateHeaders - WBS Gantt', () => {
        const importType: ImportType = 'wbs_gantt';

        it('should require Start Date and End Date', () => {
            const headers = ['Task Name']; // Missing Start Date, End Date
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toContain('Start Date');
            expect(result.missing).toContain('End Date');
        });

        it('should accept WBS-specific headers', () => {
            const headers = ['Task Name', 'Start Date', 'End Date', 'Milestone', 'Predecessor'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toHaveLength(0);
            expect(result.matched).toContain('Milestone');
            expect(result.matched).toContain('Predecessor');
        });
    });

    describe('validateHeaders - Recurring', () => {
        const importType: ImportType = 'recurring_tasks';

        it('should require all recurring-specific fields', () => {
            const headers = ['Task Title']; // Missing Frequency, Time, Assignment Type, Assignee
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toContain('Frequency');
            expect(result.missing).toContain('Time');
            expect(result.missing).toContain('Assignment Type');
            expect(result.missing).toContain('Assignee');
        });

        it('should accept all required recurring headers', () => {
            const headers = ['Task Title', 'Frequency', 'Time', 'Assignment Type', 'Assignee'];
            const result = PreValidationService.validateHeaders(headers, importType);
            expect(result.missing).toHaveLength(0);
        });
    });

    describe('validateRows - Required Fields', () => {
        const importType: ImportType = 'project_tasks';

        it('should detect missing required field values', () => {
            const rows = [
                { 'Task Name': 'Test Task', 'Due Date': '' } // Missing Due Date value
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const dueDateError = errors.find(e => e.column === 'Due Date');
            expect(dueDateError).toBeDefined();
            expect(dueDateError?.errorType).toBe('missing_required');
        });

        it('should pass when all required fields have values', () => {
            const rows = [
                { 'Task Name': 'Test Task', 'Due Date': '2024-12-30' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const requiredErrors = errors.filter(e => e.errorType === 'missing_required');
            expect(requiredErrors).toHaveLength(0);
        });

        it('should detect empty rows', () => {
            const rows = [
                { 'Task Name': '', 'Due Date': '' } // Empty row
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const emptyRowError = errors.find(e => e.errorType === 'empty_row');
            expect(emptyRowError).toBeDefined();
            expect(emptyRowError?.severity).toBe('warning');
        });
    });

    describe('validateRows - Data Types', () => {
        const importType: ImportType = 'project_tasks';

        it('should validate date format - YYYY-MM-DD', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '2024-12-30' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const dateErrors = errors.filter(e => e.column === 'Due Date' && e.errorType === 'invalid_type');
            expect(dateErrors).toHaveLength(0);
        });

        it('should validate date format - DD/MM/YYYY', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '30/12/2024' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const dateErrors = errors.filter(e => e.column === 'Due Date' && e.errorType === 'invalid_type');
            expect(dateErrors).toHaveLength(0);
        });

        it('should reject invalid date format', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': 'invalid-date' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const dateError = errors.find(e => e.column === 'Due Date' && e.errorType === 'invalid_type');
            expect(dateError).toBeDefined();
        });

        it('should validate number fields', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '2024-12-30', 'Estimated Hours': '8' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const numberErrors = errors.filter(e => e.column === 'Estimated Hours' && e.errorType === 'invalid_type');
            expect(numberErrors).toHaveLength(0);
        });

        it('should reject invalid number values', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '2024-12-30', 'Estimated Hours': 'abc' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const numberError = errors.find(e => e.column === 'Estimated Hours' && e.errorType === 'invalid_type');
            expect(numberError).toBeDefined();
        });

        it('should validate enum fields - Priority', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '2024-12-30', 'Priority': 'high' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const enumErrors = errors.filter(e => e.column === 'Priority' && e.errorType === 'invalid_type');
            expect(enumErrors).toHaveLength(0);
        });

        it('should reject invalid enum values', () => {
            const rows = [
                { 'Task Name': 'Test', 'Due Date': '2024-12-30', 'Priority': 'super' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const enumError = errors.find(e => e.column === 'Priority' && e.errorType === 'invalid_type');
            expect(enumError).toBeDefined();
        });
    });

    describe('validateRows - WBS Specific', () => {
        const importType: ImportType = 'wbs_gantt';

        it('should validate Milestone enum', () => {
            const rows = [
                { 'Task Name': 'Test', 'Start Date': '2024-12-25', 'End Date': '2024-12-30', 'Milestone': 'Yes' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const milestoneErrors = errors.filter(e => e.column === 'Milestone' && e.errorType === 'invalid_type');
            expect(milestoneErrors).toHaveLength(0);
        });

        it('should validate Dependency Type enum', () => {
            const rows = [
                { 'Task Name': 'Test', 'Start Date': '2024-12-25', 'End Date': '2024-12-30', 'Dep Type': 'FS' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const depErrors = errors.filter(e => e.column === 'Dep Type' && e.errorType === 'invalid_type');
            expect(depErrors).toHaveLength(0);
        });
    });

    describe('validateRows - Recurring Specific', () => {
        const importType: ImportType = 'recurring_tasks';

        it('should validate Frequency enum', () => {
            const rows = [
                { 'Task Title': 'Test', 'Frequency': 'weekly', 'Time': '09:00', 'Assignment Type': 'specific_user', 'Assignee': 'Test User' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const freqErrors = errors.filter(e => e.column === 'Frequency' && e.errorType === 'invalid_type');
            expect(freqErrors).toHaveLength(0);
        });

        it('should validate Assignment Type enum', () => {
            const rows = [
                { 'Task Title': 'Test', 'Frequency': 'daily', 'Time': '09:00', 'Assignment Type': 'position', 'Assignee': 'Team Lead' }
            ];
            const errors = PreValidationService.validateRows(rows, importType);
            const assignErrors = errors.filter(e => e.column === 'Assignment Type' && e.errorType === 'invalid_type');
            expect(assignErrors).toHaveLength(0);
        });
    });
});
