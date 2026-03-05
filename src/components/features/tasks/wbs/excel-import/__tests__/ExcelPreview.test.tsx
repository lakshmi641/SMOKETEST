/**
 * ExcelPreview Component Tests
 * 
 * Tests for the preview table displaying parsed data.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExcelPreview } from '../ExcelPreview'
import { ExcelValidatedRow } from '@/types/excel-import'

describe('ExcelPreview', () => {
    const createValidRow = (overrides: Partial<ExcelValidatedRow> = {}): ExcelValidatedRow => ({
        rowNumber: 1,
        taskName: 'Test Task',
        description: 'Test Description',
        startDate: '2024-12-15',
        endDate: '2024-12-20',
        isMilestone: false,
        predecessorNames: [],
        dependencyType: 'FS',
        lagDays: 0,
        isValid: true,
        errors: [],
        warnings: [],
        ...overrides,
    })

    test('renders task data in table', () => {
        const rows = [createValidRow({ taskName: 'Foundation Work' })]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('Foundation Work')).toBeInTheDocument()
        expect(screen.getByText('2024-12-15')).toBeInTheDocument()
        expect(screen.getByText('2024-12-20')).toBeInTheDocument()
    })

    test('shows valid count', () => {
        const rows = [
            createValidRow({ rowNumber: 1 }),
            createValidRow({ rowNumber: 2 }),
            createValidRow({ rowNumber: 3, isValid: false, errors: [{ field: 'taskName', message: 'Missing', code: 'REQUIRED_FIELD_MISSING' }] }),
        ]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('2 valid')).toBeInTheDocument()
        expect(screen.getByText('1 invalid')).toBeInTheDocument()
    })

    test('shows milestone indicator', () => {
        const rows = [createValidRow({ isMilestone: true })]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('Yes')).toBeInTheDocument()
    })

    test('shows predecessor names', () => {
        const rows = [createValidRow({ predecessorNames: ['Task A', 'Task B'] })]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('Task A, Task B')).toBeInTheDocument()
    })

    test('shows dependency type when has predecessors', () => {
        const rows = [createValidRow({ predecessorNames: ['Task A'], dependencyType: 'SS' })]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('SS')).toBeInTheDocument()
    })

    test('shows "Missing" for empty task name', () => {
        const rows = [createValidRow({
            taskName: '',
            isValid: false,
            errors: [{ field: 'taskName', message: 'Required', code: 'REQUIRED_FIELD_MISSING' }]
        })]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('Missing')).toBeInTheDocument()
    })

    test('shows row count', () => {
        const rows = [
            createValidRow({ rowNumber: 1 }),
            createValidRow({ rowNumber: 2 }),
            createValidRow({ rowNumber: 3 }),
        ]
        render(<ExcelPreview rows={rows} />)

        expect(screen.getByText('3 total rows')).toBeInTheDocument()
    })

    test('shows "Show all" when more than maxDisplay rows', () => {
        const rows = Array.from({ length: 15 }, (_, i) => createValidRow({ rowNumber: i + 1 }))
        render(<ExcelPreview rows={rows} maxDisplay={10} />)

        expect(screen.getByText(/show all 15 rows/i)).toBeInTheDocument()
    })

    test('expands row to show errors on click', () => {
        const rows = [createValidRow({
            isValid: false,
            errors: [{ field: 'startDate', message: 'Invalid date format', code: 'INVALID_DATE_FORMAT' }]
        })]
        render(<ExcelPreview rows={rows} />)

        // Click on the row to expand
        const row = screen.getByText('Test Task').closest('tr')
        fireEvent.click(row!)

        expect(screen.getByText(/invalid date format/i)).toBeInTheDocument()
    })
})
