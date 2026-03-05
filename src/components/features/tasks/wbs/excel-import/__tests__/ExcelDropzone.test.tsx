/**
 * ExcelDropzone Component Tests
 * 
 * Integration tests for the file upload dropzone.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExcelDropzone } from '../ExcelDropzone'

// Mock the downloadTemplate function
jest.mock('@/lib/utils/excel', () => ({
    downloadTemplate: jest.fn(),
}))

describe('ExcelDropzone', () => {
    const mockOnFileSelect = jest.fn()
    const mockOnError = jest.fn()
    const mockOnClear = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const renderDropzone = (props = {}) => {
        return render(
            <ExcelDropzone
                onFileSelect={mockOnFileSelect}
                onError={mockOnError}
                {...props}
            />
        )
    }

    test('renders upload prompt', () => {
        renderDropzone()
        expect(screen.getByText(/drop.*excel.*file/i)).toBeInTheDocument()
    })

    test('renders download template button', () => {
        renderDropzone()
        expect(screen.getByText(/download template/i)).toBeInTheDocument()
    })

    test('shows file info when file is selected', () => {
        const mockFile = new File([''], 'tasks.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        Object.defineProperty(mockFile, 'size', { value: 5120 }) // 5 KB

        renderDropzone({ selectedFile: mockFile, onClear: mockOnClear })

        expect(screen.getByText('tasks.xlsx')).toBeInTheDocument()
        expect(screen.getByText(/5\.0 KB/)).toBeInTheDocument()
    })

    test('calls onClear when clear button clicked', () => {
        const mockFile = new File([''], 'tasks.xlsx')
        renderDropzone({ selectedFile: mockFile, onClear: mockOnClear })

        const clearButton = screen.getByRole('button')
        fireEvent.click(clearButton)

        expect(mockOnClear).toHaveBeenCalled()
    })

    test('calls onError for non-Excel files', () => {
        renderDropzone()

        const input = document.getElementById('excel-file-input') as HTMLInputElement
        const pdfFile = new File([''], 'document.pdf', { type: 'application/pdf' })

        fireEvent.change(input, { target: { files: [pdfFile] } })

        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Excel'))
        expect(mockOnFileSelect).not.toHaveBeenCalled()
    })

    test('calls onFileSelect for valid Excel file', () => {
        renderDropzone()

        const input = document.getElementById('excel-file-input') as HTMLInputElement
        const xlsxFile = new File([''], 'tasks.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })

        fireEvent.change(input, { target: { files: [xlsxFile] } })

        expect(mockOnFileSelect).toHaveBeenCalledWith(xlsxFile)
        expect(mockOnError).not.toHaveBeenCalled()
    })

    test('disables dropzone when isDisabled is true', () => {
        renderDropzone({ isDisabled: true })

        const input = document.getElementById('excel-file-input') as HTMLInputElement
        expect(input).toBeDisabled()
    })
})
