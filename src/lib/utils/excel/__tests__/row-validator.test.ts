/**
 * Row Validator Unit Tests
 * 
 * Tests for Excel row validation including required fields,
 * date validation, and dependency parsing.
 */

import { validateRow, validateAllRows, validatePredecessorResolution } from '../row-validator'
import { ExcelRawRow } from '@/types/excel-import'

describe('validateRow', () => {
    const createRawRow = (overrides: Partial<ExcelRawRow> = {}): ExcelRawRow => ({
        rowNumber: 1,
        taskName: 'Test Task',
        description: 'Test Description',
        startDate: '2024-12-15',
        endDate: '2024-12-20',
        milestone: null,
        predecessor: null,
        dependencyType: null,
        lagDays: null,
        ...overrides,
    })

    describe('Task Name validation', () => {
        test('valid row passes validation', () => {
            const row = createRawRow()
            const result = validateRow(row)
            expect(result.isValid).toBe(true)
            expect(result.taskName).toBe('Test Task')
        })

        test('missing task name fails', () => {
            const row = createRawRow({ taskName: null })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', field: 'taskName' })
            )
        })

        test('empty task name fails', () => {
            const row = createRawRow({ taskName: '' })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
        })

        test('whitespace-only task name fails', () => {
            const row = createRawRow({ taskName: '   ' })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
        })

        test('trims task name', () => {
            const row = createRawRow({ taskName: '  My Task  ' })
            const result = validateRow(row)
            expect(result.taskName).toBe('My Task')
        })
    })

    describe('Date validation', () => {
        test('missing start date fails', () => {
            const row = createRawRow({ startDate: null })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', field: 'startDate' })
            )
        })

        test('missing end date fails', () => {
            const row = createRawRow({ endDate: null })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', field: 'endDate' })
            )
        })

        test('invalid start date format fails', () => {
            const row = createRawRow({ startDate: 'not-a-date' })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'INVALID_DATE_FORMAT', field: 'startDate' })
            )
        })

        test('end before start fails', () => {
            const row = createRawRow({ startDate: '2024-12-20', endDate: '2024-12-15' })
            const result = validateRow(row)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'END_BEFORE_START', field: 'endDate' })
            )
        })

        test('same start and end date is valid', () => {
            const row = createRawRow({ startDate: '2024-12-15', endDate: '2024-12-15' })
            const result = validateRow(row)
            expect(result.isValid).toBe(true)
        })
    })

    describe('Milestone validation', () => {
        test('milestone "Yes" is recognized', () => {
            const row = createRawRow({ milestone: 'Yes' })
            const result = validateRow(row)
            expect(result.isMilestone).toBe(true)
        })

        test('milestone "TRUE" is recognized (case insensitive)', () => {
            const row = createRawRow({ milestone: 'TRUE' })
            const result = validateRow(row)
            expect(result.isMilestone).toBe(true)
        })

        test('milestone "1" is recognized', () => {
            const row = createRawRow({ milestone: '1' })
            const result = validateRow(row)
            expect(result.isMilestone).toBe(true)
        })

        test('milestone "No" is false', () => {
            const row = createRawRow({ milestone: 'No' })
            const result = validateRow(row)
            expect(result.isMilestone).toBe(false)
        })

        test('empty milestone defaults to false', () => {
            const row = createRawRow({ milestone: null })
            const result = validateRow(row)
            expect(result.isMilestone).toBe(false)
        })

        test('milestone with different dates shows warning', () => {
            const row = createRawRow({
                milestone: 'Yes',
                startDate: '2024-12-15',
                endDate: '2024-12-20'
            })
            const result = validateRow(row)
            expect(result.warnings.length).toBeGreaterThan(0)
            expect(result.warnings[0].field).toBe('milestone')
        })
    })

    describe('Predecessor parsing', () => {
        test('parses single predecessor', () => {
            const row = createRawRow({ predecessor: 'Task A' })
            const result = validateRow(row)
            expect(result.predecessorNames).toEqual(['Task A'])
        })

        test('parses multiple predecessors', () => {
            const row = createRawRow({ predecessor: 'Task A, Task B, Task C' })
            const result = validateRow(row)
            expect(result.predecessorNames).toEqual(['Task A', 'Task B', 'Task C'])
        })

        test('trims predecessor names', () => {
            const row = createRawRow({ predecessor: '  Task A  ,  Task B  ' })
            const result = validateRow(row)
            expect(result.predecessorNames).toEqual(['Task A', 'Task B'])
        })

        test('filters empty names', () => {
            const row = createRawRow({ predecessor: 'Task A, , Task B' })
            const result = validateRow(row)
            expect(result.predecessorNames).toEqual(['Task A', 'Task B'])
        })

        test('empty predecessor returns empty array', () => {
            const row = createRawRow({ predecessor: null })
            const result = validateRow(row)
            expect(result.predecessorNames).toEqual([])
        })
    })

    describe('Dependency type validation', () => {
        test('valid FS type accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'FS' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('FS')
        })

        test('valid SS type accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'SS' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('SS')
        })

        test('valid FF type accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'FF' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('FF')
        })

        test('valid SF type accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'SF' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('SF')
        })

        test('lowercase type is converted to uppercase', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'fs' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('FS')
        })

        test('invalid type defaults to FS with error', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: 'XX' })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('FS')
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'INVALID_DEPENDENCY_TYPE' })
            )
        })

        test('empty type defaults to FS', () => {
            const row = createRawRow({ predecessor: 'Task A', dependencyType: null })
            const result = validateRow(row)
            expect(result.dependencyType).toBe('FS')
        })
    })

    describe('Lag days validation', () => {
        test('valid positive lag accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: '5' })
            const result = validateRow(row)
            expect(result.lagDays).toBe(5)
        })

        test('valid negative lag (lead) accepted', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: '-2' })
            const result = validateRow(row)
            expect(result.lagDays).toBe(-2)
        })

        test('decimal lag is rounded', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: '2.7' })
            const result = validateRow(row)
            expect(result.lagDays).toBe(3)
        })

        test('invalid lag value errors', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: 'abc' })
            const result = validateRow(row)
            expect(result.lagDays).toBe(0)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'INVALID_LAG_VALUE' })
            )
        })

        test('excessive lag value errors', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: '500' })
            const result = validateRow(row)
            expect(result.errors).toContainEqual(
                expect.objectContaining({ code: 'INVALID_LAG_VALUE' })
            )
        })

        test('empty lag defaults to 0', () => {
            const row = createRawRow({ predecessor: 'Task A', lagDays: null })
            const result = validateRow(row)
            expect(result.lagDays).toBe(0)
        })
    })
})

describe('validateAllRows', () => {
    const createRawRow = (taskName: string, rowNumber: number): ExcelRawRow => ({
        rowNumber,
        taskName,
        description: null,
        startDate: '2024-12-15',
        endDate: '2024-12-20',
        milestone: null,
        predecessor: null,
        dependencyType: null,
        lagDays: null,
    })

    test('validates all rows', () => {
        const rows = [
            createRawRow('Task A', 1),
            createRawRow('Task B', 2),
            createRawRow('Task C', 3),
        ]
        const results = validateAllRows(rows)
        expect(results).toHaveLength(3)
        expect(results.every(r => r.isValid)).toBe(true)
    })

    test('detects duplicate task names with warning', () => {
        const rows = [
            createRawRow('Task A', 1),
            createRawRow('Task A', 2), // Duplicate
            createRawRow('Task B', 3),
        ]
        const results = validateAllRows(rows)
        expect(results[0].warnings.length).toBeGreaterThan(0)
        expect(results[1].warnings.length).toBeGreaterThan(0)
    })
})

describe('validatePredecessorResolution', () => {
    test('returns no errors when all predecessors found', () => {
        const taskMap = new Map([
            ['task a', 'id-1'],
            ['task b', 'id-2'],
        ])
        const errors = validatePredecessorResolution(['Task A', 'Task B'], taskMap)
        expect(errors).toHaveLength(0)
    })

    test('returns error for not-found predecessor', () => {
        const taskMap = new Map([
            ['task a', 'id-1'],
        ])
        const errors = validatePredecessorResolution(['Task A', 'Task C'], taskMap)
        expect(errors).toHaveLength(1)
        expect(errors[0].code).toBe('PREDECESSOR_NOT_FOUND')
        expect(errors[0].message).toContain('Task C')
    })

    test('matching is case-insensitive', () => {
        const taskMap = new Map([
            ['site preparation', 'id-1'],
        ])
        const errors = validatePredecessorResolution(['SITE PREPARATION'], taskMap)
        expect(errors).toHaveLength(0)
    })
})
