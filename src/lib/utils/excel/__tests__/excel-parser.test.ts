/**
 * Excel Parser Unit Tests
 * 
 * Tests for Excel file parsing, header mapping, and template generation.
 */

import { validateFile, mapHeaders, generateTemplate } from '../excel-parser'
import { EXPECTED_HEADERS, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/types/excel-import'

describe('validateFile', () => {
    const createMockFile = (
        name: string,
        size: number = 1000,
        type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ): File => {
        const file = new File([''], name, { type })
        Object.defineProperty(file, 'size', { value: size })
        return file
    }

    test('accepts valid xlsx file', () => {
        const file = createMockFile('tasks.xlsx')
        const result = validateFile(file)
        expect(result.valid).toBe(true)
    })

    test('accepts valid xls file', () => {
        const file = createMockFile('tasks.xls', 1000, 'application/vnd.ms-excel')
        const result = validateFile(file)
        expect(result.valid).toBe(true)
    })

    test('rejects file over size limit', () => {
        const file = createMockFile('tasks.xlsx', MAX_FILE_SIZE + 1)
        const result = validateFile(file)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('size')
    })

    test('rejects non-Excel file', () => {
        const file = createMockFile('document.pdf', 1000, 'application/pdf')
        const result = validateFile(file)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Excel')
    })

    test('rejects file with wrong extension', () => {
        const file = createMockFile('tasks.csv', 1000, 'text/csv')
        const result = validateFile(file)
        expect(result.valid).toBe(false)
    })
})

describe('mapHeaders', () => {
    test('maps standard headers correctly', () => {
        const headers = [
            'Task Name',
            'Description',
            'Start Date',
            'End Date',
            'Milestone',
            'Predecessor',
            'Dependency Type',
            'Lag Days',
        ]
        const { mapping, missingRequired, unmapped } = mapHeaders(headers)

        expect(mapping.taskName).toBe(0)
        expect(mapping.description).toBe(1)
        expect(mapping.startDate).toBe(2)
        expect(mapping.endDate).toBe(3)
        expect(mapping.milestone).toBe(4)
        expect(mapping.predecessor).toBe(5)
        expect(mapping.dependencyType).toBe(6)
        expect(mapping.lagDays).toBe(7)
        expect(missingRequired).toHaveLength(0)
    })

    test('maps alternative header names', () => {
        const headers = ['Task', 'Notes', 'Start', 'Due Date', 'Type', 'Depends On', 'Link Type', 'Delay']
        const { mapping, missingRequired } = mapHeaders(headers)

        expect(mapping.taskName).toBe(0) // 'Task' is alias for taskName
        expect(mapping.description).toBe(1) // 'Notes' is alias
        expect(mapping.startDate).toBe(2) // 'Start' is alias
        expect(mapping.endDate).toBe(3) // 'Due Date' is alias
        expect(missingRequired).toHaveLength(0)
    })

    test('is case-insensitive', () => {
        const headers = ['TASK NAME', 'description', 'START DATE', 'end DATE']
        const { mapping, missingRequired } = mapHeaders(headers)

        expect(mapping.taskName).toBe(0)
        expect(mapping.description).toBe(1)
        expect(mapping.startDate).toBe(2)
        expect(mapping.endDate).toBe(3)
        expect(missingRequired).toHaveLength(0)
    })

    test('reports missing required columns', () => {
        const headers = ['Description', 'Milestone']
        const { missingRequired } = mapHeaders(headers)

        expect(missingRequired).toContain('Task Name')
        expect(missingRequired).toContain('Start Date')
        expect(missingRequired).toContain('End Date')
    })

    test('reports unmapped columns', () => {
        const headers = ['Task Name', 'Start Date', 'End Date', 'Custom Column', 'Another One']
        const { unmapped } = mapHeaders(headers)

        expect(unmapped).toContain('Custom Column')
        expect(unmapped).toContain('Another One')
    })

    test('handles empty headers array', () => {
        const { missingRequired } = mapHeaders([])
        expect(missingRequired).toContain('Task Name')
        expect(missingRequired).toContain('Start Date')
        expect(missingRequired).toContain('End Date')
    })

    test('handles null/undefined values in headers', () => {
        const headers = ['Task Name', null as unknown as string, 'Start Date', undefined as unknown as string, 'End Date']
        const { mapping, missingRequired } = mapHeaders(headers)

        expect(mapping.taskName).toBe(0)
        expect(mapping.startDate).toBe(2)
        expect(mapping.endDate).toBe(4)
        expect(missingRequired).toHaveLength(0)
    })
})

describe('generateTemplate', () => {
    test('generates a valid Blob', () => {
        const blob = generateTemplate()
        expect(blob).toBeInstanceOf(Blob)
        expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    test('generated blob has content', () => {
        const blob = generateTemplate()
        expect(blob.size).toBeGreaterThan(0)
    })
})
