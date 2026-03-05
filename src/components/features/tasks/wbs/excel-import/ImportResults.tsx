'use client'

/**
 * ImportResults Component
 * 
 * Displays import results with success/error counts.
 */

import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImportResult } from '@/types/excel-import'
import { Button } from '@/components/ui/button'

interface ImportResultsProps {
    /** Import result data */
    result: ImportResult
    /** Callback to close dialog */
    onClose: () => void
    /** Callback to retry import */
    onRetry?: () => void
}

export function ImportResults({ result, onClose, onRetry }: ImportResultsProps) {
    const [showErrors, setShowErrors] = React.useState(false)

    const isFullSuccess = result.errorCount === 0 && result.skippedCount === 0
    const isPartialSuccess = result.successCount > 0 && (result.errorCount > 0 || result.skippedCount > 0)
    const isFullFailure = result.successCount === 0

    const failedRows = result.results.filter(r => r.status === 'error' || r.status === 'skipped')

    return (
        <div className="space-y-6">
            {/* Main Status */}
            <div className="text-center">
                {isFullSuccess && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-green-100 rounded-full">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">Import Complete!</h3>
                            <p className="text-gray-600 mt-1">
                                Successfully created {result.successCount} {result.successCount === 1 ? 'task' : 'tasks'}
                            </p>
                        </div>
                    </div>
                )}

                {isPartialSuccess && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-yellow-100 rounded-full">
                            <AlertTriangle className="h-12 w-12 text-yellow-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">Import Partially Complete</h3>
                            <p className="text-gray-600 mt-1">
                                Created {result.successCount} {result.successCount === 1 ? 'task' : 'tasks'},
                                {' '}{result.errorCount + result.skippedCount} failed
                            </p>
                        </div>
                    </div>
                )}

                {isFullFailure && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-red-100 rounded-full">
                            <XCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">Import Failed</h3>
                            <p className="text-gray-600 mt-1">
                                No tasks were created. Please check the errors below.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Summary */}
            <div className="flex justify-center gap-6">
                <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
                    <div className="text-sm text-gray-500">Created</div>
                </div>
                {result.errorCount > 0 && (
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{result.errorCount}</div>
                        <div className="text-sm text-gray-500">Errors</div>
                    </div>
                )}
                {result.skippedCount > 0 && (
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{result.skippedCount}</div>
                        <div className="text-sm text-gray-500">Skipped</div>
                    </div>
                )}
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400">{result.totalRows}</div>
                    <div className="text-sm text-gray-500">Total</div>
                </div>
            </div>

            {/* Duration */}
            <div className="text-center text-sm text-gray-500">
                Completed in {(result.duration / 1000).toFixed(1)}s
            </div>

            {/* Failed Rows */}
            {failedRows.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowErrors(!showErrors)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        <span className="font-medium text-gray-700">
                            View Failed Rows ({failedRows.length})
                        </span>
                        {showErrors ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                    </button>

                    {showErrors && (
                        <div className="max-h-[200px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Row</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Task Name</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {failedRows.map((row) => (
                                        <tr key={row.rowNumber} className="bg-red-50/30">
                                            <td className="px-4 py-2 text-gray-600">{row.rowNumber}</td>
                                            <td className="px-4 py-2 font-medium text-gray-900">{row.taskName}</td>
                                            <td className="px-4 py-2 text-red-600">{row.error || 'Unknown error'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
                {(isPartialSuccess || isFullFailure) && onRetry && (
                    <Button variant="outline" onClick={onRetry}>
                        Try Again
                    </Button>
                )}
                <Button onClick={onClose}>
                    {isFullSuccess ? 'Done' : 'Close'}
                </Button>
            </div>
        </div>
    )
}

export default ImportResults
