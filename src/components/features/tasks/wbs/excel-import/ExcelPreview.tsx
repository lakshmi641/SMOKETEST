'use client'

/**
 * ExcelPreview Component
 * 
 * Displays parsed Excel data in a table with validation indicators.
 */

import React from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExcelValidatedRow } from '@/types/excel-import'

interface ExcelPreviewProps {
    /** Validated rows from Excel parsing */
    rows: ExcelValidatedRow[]
    /** Maximum rows to display (rest are hidden with expand option) */
    maxDisplay?: number
}

export function ExcelPreview({ rows, maxDisplay = 10 }: ExcelPreviewProps) {
    const [showAll, setShowAll] = React.useState(false)
    const [expandedRow, setExpandedRow] = React.useState<number | null>(null)

    const displayRows = showAll ? rows : rows.slice(0, maxDisplay)
    const hasMore = rows.length > maxDisplay

    const validCount = rows.filter(r => r.isValid).length
    const errorCount = rows.filter(r => !r.isValid).length
    const warningCount = rows.filter(r => r.isValid && r.warnings.length > 0).length

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{validCount} valid</span>
                </div>
                {warningCount > 0 && (
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>{warningCount} with warnings</span>
                    </div>
                )}
                {errorCount > 0 && (
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span>{errorCount} invalid</span>
                    </div>
                )}
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">{rows.length} total rows</span>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 w-8">#</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 w-10">Status</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 min-w-[180px]">Task Name</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 min-w-[100px]">Start Date</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 min-w-[100px]">End Date</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Milestone</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 min-w-[150px]">Predecessor</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 w-16">Type</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600 w-12">Lag</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayRows.map((row) => (
                                <React.Fragment key={row.rowNumber}>
                                    <tr
                                        className={cn(
                                            'hover:bg-gray-50 transition-colors cursor-pointer',
                                            !row.isValid && 'bg-red-50/50',
                                            row.isValid && row.warnings.length > 0 && 'bg-yellow-50/30'
                                        )}
                                        onClick={() => setExpandedRow(
                                            expandedRow === row.rowNumber ? null : row.rowNumber
                                        )}
                                    >
                                        <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                                        <td className="px-3 py-2">
                                            <StatusIcon row={row} />
                                        </td>
                                        <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[200px]">
                                            {row.taskName || <span className="text-red-400 italic">Missing</span>}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {row.startDate || <span className="text-red-400 italic">Invalid</span>}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {row.endDate || <span className="text-red-400 italic">Invalid</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.isMilestone ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">No</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">
                                            {row.predecessorNames.length > 0
                                                ? row.predecessorNames.join(', ')
                                                : <span className="text-gray-300">—</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {row.predecessorNames.length > 0 ? row.dependencyType : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {row.predecessorNames.length > 0 ? row.lagDays : '—'}
                                        </td>
                                    </tr>

                                    {/* Expanded row for errors/warnings */}
                                    {expandedRow === row.rowNumber && (row.errors.length > 0 || row.warnings.length > 0) && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={9} className="px-4 py-3">
                                                <div className="space-y-2">
                                                    {row.errors.map((err, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                                                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                            <span><strong>{err.field}:</strong> {err.message}</span>
                                                        </div>
                                                    ))}
                                                    {row.warnings.map((warn, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-sm text-yellow-600">
                                                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                            <span><strong>{warn.field}:</strong> {warn.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Show more button */}
            {hasMore && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mx-auto"
                >
                    {showAll ? (
                        <>
                            <ChevronRight className="h-4 w-4" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-4 w-4" />
                            Show all {rows.length} rows
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

/**
 * Status icon component
 */
function StatusIcon({ row }: { row: ExcelValidatedRow }) {
    if (!row.isValid) {
        return (
            <div title={row.errors[0]?.message || 'Invalid'}>
                <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
        )
    }
    if (row.warnings.length > 0) {
        return (
            <div title={row.warnings[0]?.message || 'Warning'}>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </div>
        )
    }
    return (
        <div title="Valid">
            <CheckCircle className="h-4 w-4 text-green-500" />
        </div>
    )
}

export default ExcelPreview
