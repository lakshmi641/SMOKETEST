/**
 * Dependency Warning Dialog
 *
 * Shows a warning when user tries to change task status but predecessor
 * dependencies are not satisfied. Allows user to proceed anyway (soft enforcement).
 */

import React from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { DependencyValidationResult } from '@/lib/services/tasks/task-template-service'

interface DependencyWarningDialogProps {
    isOpen: boolean
    onClose: () => void
    onProceed: () => void
    validationResult: DependencyValidationResult | null
    taskTitle: string
    targetStatus: string
}

const STATUS_LABELS: Record<string, string> = {
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'on_hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
}

const DEP_TYPE_LABELS: Record<string, string> = {
    'FS': 'Finish-to-Start',
    'SS': 'Start-to-Start',
    'FF': 'Finish-to-Finish',
    'SF': 'Start-to-Finish'
}

export function DependencyWarningDialog({
    isOpen,
    onClose,
    onProceed,
    validationResult,
    taskTitle,
    targetStatus
}: DependencyWarningDialogProps) {
    if (!validationResult || !validationResult.hasBlockingDependencies) {
        return null
    }

    const handleProceed = () => {
        onProceed()
        onClose()
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        Dependency Warning
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-700">
                                You are trying to change <span className="font-semibold">"{taskTitle}"</span> to{' '}
                                <span className="font-semibold text-blue-600">
                                    {STATUS_LABELS[targetStatus] || targetStatus}
                                </span>
                                , but the following predecessor tasks are not yet in the required status:
                            </p>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                                {validationResult.blockingTasks.map((task, index) => (
                                    <div
                                        key={task.id || index}
                                        className="flex items-start gap-2 text-sm"
                                    >
                                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold mt-0.5">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">
                                                {task.title}
                                            </div>
                                            <div className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                                    {DEP_TYPE_LABELS[task.dependencyType] || task.dependencyType}
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-gray-400" />
                                                <span>
                                                    Currently: <span className="text-red-600 font-medium">{STATUS_LABELS[task.status] || task.status}</span>
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-gray-400" />
                                                <span>
                                                    Needs: <span className="text-green-600 font-medium">{task.requiredStatus}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-gray-500 italic">
                                Proceeding without completing predecessor tasks may cause scheduling conflicts
                                and affect project timeline calculations.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleProceed}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        Proceed Anyway
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
