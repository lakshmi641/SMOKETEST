/**
 * ImportResults Component Tests
 * 
 * Tests for the import results display.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportResults } from '../ImportResults'
import { ImportResult } from '@/types/excel-import'

describe('ImportResults', () => {
    const mockOnClose = jest.fn()
    const mockOnRetry = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const createResult = (overrides: Partial<ImportResult> = {}): ImportResult => ({
        totalRows: 5,
        successCount: 5,
        errorCount: 0,
        skippedCount: 0,
        results: [],
        duration: 1500,
        ...overrides,
    })

    test('shows success state for full success', () => {
        const result = createResult({ successCount: 5, errorCount: 0, skippedCount: 0 })
        render(<ImportResults result={result} onClose={mockOnClose} />)

        expect(screen.getByText(/import complete/i)).toBeInTheDocument()
        expect(screen.getByText(/5 tasks/i)).toBeInTheDocument()
    })

    test('shows partial success state', () => {
        const result = createResult({ successCount: 3, errorCount: 2 })
        render(<ImportResults result={result} onClose={mockOnClose} onRetry={mockOnRetry} />)

        expect(screen.getByText(/partially complete/i)).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // Success count
        expect(screen.getByText('2')).toBeInTheDocument() // Error count
    })

    test('shows failure state for zero success', () => {
        const result = createResult({ successCount: 0, errorCount: 5 })
        render(<ImportResults result={result} onClose={mockOnClose} onRetry={mockOnRetry} />)

        expect(screen.getByText(/import failed/i)).toBeInTheDocument()
    })

    test('displays duration', () => {
        const result = createResult({ duration: 2500 })
        render(<ImportResults result={result} onClose={mockOnClose} />)

        expect(screen.getByText(/2\.5s/)).toBeInTheDocument()
    })

    test('calls onClose when Done clicked', () => {
        const result = createResult()
        render(<ImportResults result={result} onClose={mockOnClose} />)

        fireEvent.click(screen.getByText('Done'))
        expect(mockOnClose).toHaveBeenCalled()
    })

    test('shows Try Again button for partial failure', () => {
        const result = createResult({ successCount: 2, errorCount: 3 })
        render(<ImportResults result={result} onClose={mockOnClose} onRetry={mockOnRetry} />)

        expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    test('calls onRetry when Try Again clicked', () => {
        const result = createResult({ successCount: 2, errorCount: 3 })
        render(<ImportResults result={result} onClose={mockOnClose} onRetry={mockOnRetry} />)

        fireEvent.click(screen.getByText('Try Again'))
        expect(mockOnRetry).toHaveBeenCalled()
    })

    test('shows expandable failed rows section', () => {
        const result = createResult({
            successCount: 2,
            errorCount: 1,
            results: [
                { rowNumber: 1, taskName: 'Task A', status: 'success', taskId: 'id-1' },
                { rowNumber: 2, taskName: 'Task B', status: 'success', taskId: 'id-2' },
                { rowNumber: 3, taskName: 'Failed Task', status: 'error', error: 'Database error' },
            ],
        })
        render(<ImportResults result={result} onClose={mockOnClose} />)

        expect(screen.getByText(/view failed rows/i)).toBeInTheDocument()
    })

    test('expands to show failed row details', () => {
        const result = createResult({
            successCount: 2,
            errorCount: 1,
            results: [
                { rowNumber: 3, taskName: 'Failed Task', status: 'error', error: 'Database error' },
            ],
        })
        render(<ImportResults result={result} onClose={mockOnClose} />)

        fireEvent.click(screen.getByText(/view failed rows/i))

        expect(screen.getByText('Failed Task')).toBeInTheDocument()
        expect(screen.getByText('Database error')).toBeInTheDocument()
    })

    test('shows skipped count when present', () => {
        const result = createResult({
            successCount: 10,
            errorCount: 5,
            skippedCount: 2
        })
        render(<ImportResults result={result} onClose={mockOnClose} />)

        expect(screen.getByText('2')).toBeInTheDocument() // Skipped count
        expect(screen.getByText('Skipped')).toBeInTheDocument()
    })
})
