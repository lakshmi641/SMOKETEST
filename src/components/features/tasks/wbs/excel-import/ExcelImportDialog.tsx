'use client'

/**
 * ExcelImportDialog Component
 * 
 * Main dialog for importing tasks from Excel files.
 * Manages the import flow: Upload → Preview → Import → Results
 */

import React, { useState, useCallback } from 'react'
import { Loader2, FileSpreadsheet } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useExcelParser } from '@/hooks/useExcelParser'
import { ExcelDropzone } from './ExcelDropzone'
import { ExcelPreview } from './ExcelPreview'
import { ImportResults } from './ImportResults'
import {
    ImportResult,
    ExcelImportDialogProps,
    FIELD_DEFAULTS,
    DependencyType,
} from '@/types/excel-import'
import { TaskTemplateService } from '@/lib/services/tasks/task-template-service'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'

/**
 * Excel Import Dialog
 * 
 * @example
 * <ExcelImportDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   projectId="project-123"
 *   existingTasks={currentTasks}
 *   onImportComplete={(result) => console.log(result)}
 * />
 */
export function ExcelImportDialog({
    isOpen,
    onClose,
    projectId,
    existingTasks = [],
    onImportComplete,
}: ExcelImportDialogProps) {
    const { user } = useAuthStore()
    const { currentCompany, groupId } = useCompany()
    const {
        state,
        parseResult,
        error,
        file,
        parseFile,
        reset,
        setState,
    } = useExcelParser()

    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [importProgress, setImportProgress] = useState(0)

    /**
     * Handle file selection
     */
    const handleFileSelect = useCallback(async (selectedFile: File) => {
        await parseFile(selectedFile)
    }, [parseFile])

    /**
     * Handle file upload error
     */
    const handleFileError = useCallback((errorMessage: string) => {
        console.error('File error:', errorMessage)
    }, [])

    /**
     * Clear selected file
     */
    const handleClearFile = useCallback(() => {
        reset()
    }, [reset])

    /**
     * Start import process
     */
    const handleImport = useCallback(async () => {
        if (!parseResult || !currentCompany || !user) return

        setState('importing')
        setImportProgress(0)

        const startTime = Date.now()
        const results: ImportResult['results'] = []
        const createdTasksMap = new Map<string, string>() // name → taskId

        // Build lookup map for existing tasks
        for (const task of existingTasks) {
            createdTasksMap.set(task.title.toLowerCase().trim(), task.id)
        }

        const validRows = parseResult.rows.filter(r => r.isValid)

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i]
            if (!row) continue
            setImportProgress(Math.round(((i + 1) / validRows.length) * 100))

            try {
                // Resolve predecessors by name
                const dependencies = row.predecessorNames
                    .map(name => {
                        const normalizedName = name.toLowerCase().trim()
                        const taskId = createdTasksMap.get(normalizedName)
                        if (taskId) {
                            return {
                                targetTaskId: taskId,
                                type: row.dependencyType as DependencyType,
                                lag: row.lagDays,
                            }
                        }
                        return null
                    })
                    .filter((dep): dep is { targetTaskId: string; type: DependencyType; lag: number } => dep !== null)

                // Create task using existing service
                const createdTask = await TaskTemplateService.createManualTask(
                    currentCompany.id,
                    user.id,
                    {
                        title: row.taskName,
                        description: row.description,
                        startDate: row.startDate,
                        endDate: row.endDate,
                        dueDate: row.endDate,
                        isMilestone: row.isMilestone,
                        targetDate: row.isMilestone ? row.endDate : undefined,
                        projectId: projectId,
                        dependencies: dependencies,
                        // Defaults
                        priority: FIELD_DEFAULTS.priority,
                        estimatedHours: row.isMilestone ? 0 : FIELD_DEFAULTS.estimatedHours,
                    },
                    groupId ?? undefined
                )
                const taskId = createdTask.id

                // Add to lookup map for future rows
                createdTasksMap.set(row.taskName.toLowerCase().trim(), taskId)

                results.push({
                    rowNumber: row.rowNumber,
                    taskName: row.taskName,
                    status: 'success',
                    taskId,
                })
            } catch (err) {
                results.push({
                    rowNumber: row.rowNumber,
                    taskName: row.taskName,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Failed to create task',
                })
            }
        }

        // Add skipped rows
        const skippedRows = parseResult.rows.filter(r => !r.isValid)
        for (const row of skippedRows) {
            results.push({
                rowNumber: row.rowNumber,
                taskName: row.taskName || 'Unknown',
                status: 'skipped',
                error: row.errors[0]?.message || 'Validation failed',
            })
        }

        const result: ImportResult = {
            totalRows: parseResult.rows.length,
            successCount: results.filter(r => r.status === 'success').length,
            errorCount: results.filter(r => r.status === 'error').length,
            skippedCount: results.filter(r => r.status === 'skipped').length,
            results,
            duration: Date.now() - startTime,
        }

        setImportResult(result)
        setState('complete')
        onImportComplete?.(result)
    }, [parseResult, currentCompany, user, projectId, existingTasks, setState, onImportComplete])

    /**
     * Handle dialog close
     */
    const handleClose = useCallback(() => {
        reset()
        setImportResult(null)
        setImportProgress(0)
        onClose()
    }, [reset, onClose])

    /**
     * Handle retry
     */
    const handleRetry = useCallback(() => {
        setImportResult(null)
        setState('previewing')
    }, [setState])

    /**
     * Get valid row count for import button
     */
    const validRowCount = parseResult?.rows.filter(r => r.isValid).length ?? 0

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Import Tasks from Excel
                    </DialogTitle>
                    <DialogDescription>
                        Upload an Excel file to bulk import tasks into your project.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* State: Idle / File Selected / Error */}
                    {(state === 'idle' || state === 'file-selected' || state === 'error') && (
                        <div className="space-y-4">
                            <ExcelDropzone
                                onFileSelect={handleFileSelect}
                                onError={handleFileError}
                                selectedFile={file}
                                onClear={handleClearFile}
                            />
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* State: Parsing */}
                    {state === 'parsing' && (
                        <div className="flex flex-col items-center gap-4 py-12">
                            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                            <p className="text-gray-600">Parsing Excel file...</p>
                        </div>
                    )}

                    {/* State: Previewing */}
                    {state === 'previewing' && parseResult && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-gray-900">Preview Import Data</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFile}
                                    className="text-gray-500"
                                >
                                    Upload Different File
                                </Button>
                            </div>

                            {parseResult.warnings.length > 0 && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                                    {parseResult.warnings.join(', ')}
                                </div>
                            )}

                            <ExcelPreview rows={parseResult.rows} />

                            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                                <strong>Importing to:</strong> Project {projectId}
                                <br />
                                <strong>Defaults:</strong> Priority = {FIELD_DEFAULTS.priority}
                            </div>
                        </div>
                    )}

                    {/* State: Importing */}
                    {state === 'importing' && (
                        <div className="flex flex-col items-center gap-4 py-12">
                            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                            <div className="text-center">
                                <p className="text-gray-900 font-medium">Creating tasks...</p>
                                <p className="text-gray-500 text-sm mt-1">{importProgress}% complete</p>
                            </div>
                            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${importProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* State: Complete */}
                    {state === 'complete' && importResult && (
                        <ImportResults
                            result={importResult}
                            onClose={handleClose}
                            onRetry={handleRetry}
                        />
                    )}
                </div>

                {/* Footer with action buttons */}
                {state === 'previewing' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={validRowCount === 0}
                        >
                            Import {validRowCount} {validRowCount === 1 ? 'Task' : 'Tasks'}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default ExcelImportDialog
