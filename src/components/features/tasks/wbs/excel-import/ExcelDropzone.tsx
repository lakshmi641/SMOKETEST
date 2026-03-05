'use client'

/**
 * ExcelDropzone Component
 * 
 * Drag & drop zone for Excel file upload.
 * Supports click-to-browse and drag-and-drop.
 */

import React, { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { downloadTemplate } from '@/lib/utils/excel'

interface ExcelDropzoneProps {
    /** Callback when a valid file is selected */
    onFileSelect: (file: File) => void
    /** Callback when an error occurs */
    onError: (error: string) => void
    /** Whether the dropzone is disabled */
    isDisabled?: boolean
    /** Currently selected file (for display) */
    selectedFile?: File | null
    /** Clear selected file */
    onClear?: () => void
}

export function ExcelDropzone({
    onFileSelect,
    onError,
    isDisabled = false,
    selectedFile,
    onClear,
}: ExcelDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isDisabled) {
            setIsDragging(true)
        }
    }, [isDisabled])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (isDisabled) return

        const files = e.dataTransfer.files
        if (files.length === 0) {
            onError('No file dropped')
            return
        }

        const file = files[0]
        if (!file) {
            onError('Invalid file')
            return
        }

        // Check file type
        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            onError('Please upload an Excel file (.xlsx or .xls)')
            return
        }

        onFileSelect(file)
    }, [isDisabled, onFileSelect, onError])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const file = files[0]
        if (!file) return

        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            onError('Please upload an Excel file (.xlsx or .xls)')
            return
        }

        onFileSelect(file)

        // Reset input so same file can be selected again
        e.target.value = ''
    }, [onFileSelect, onError])

    const handleDownloadTemplate = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        downloadTemplate()
    }, [])

    // If a file is selected, show file info
    if (selectedFile) {
        return (
            <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{selectedFile.name}</p>
                            <p className="text-sm text-gray-500">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    </div>
                    {onClear && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClear}
                            className="text-gray-500 hover:text-red-500"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div
                className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
                    isDragging
                        ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isDisabled && document.getElementById('excel-file-input')?.click()}
            >
                <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={isDisabled}
                />

                <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                        'p-4 rounded-full transition-colors duration-200',
                        isDragging ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                        <Upload className={cn(
                            'h-8 w-8 transition-colors duration-200',
                            isDragging ? 'text-blue-600' : 'text-gray-400'
                        )} />
                    </div>

                    <div>
                        <p className="font-medium text-gray-700">
                            {isDragging ? 'Drop your Excel file here' : 'Drop Excel file here or click to browse'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Supports .xlsx and .xls files (max 5MB)
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                </Button>
            </div>
        </div>
    )
}

export default ExcelDropzone
