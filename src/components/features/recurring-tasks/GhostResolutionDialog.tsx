'use client'

/**
 * Ghost Resolution Dialog
 * Specialized dialog for resolving ghost tasks by re-assigning them.
 */

import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, CheckCircle } from 'lucide-react'
import { AssignmentStep } from './AssignmentStep'
import type {
    WorkspaceRecurringConfig,
    TaskAssignment,
} from '@/types/recurring-task-schema'

interface GhostResolutionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    config: WorkspaceRecurringConfig | null
    onResolve: (configId: string, newAssignment: TaskAssignment) => Promise<void>
    users?: { id: string; name: string }[]
    positions?: { id: string; name: string }[]
}

export function GhostResolutionDialog({
    open,
    onOpenChange,
    config,
    onResolve,
    users = [],
    positions = [],
}: GhostResolutionDialogProps) {
    const [assignment, setAssignment] = useState<TaskAssignment>({
        type: 'specific_user',
        value: '',
    })
    const [isResolving, setIsResolving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Sync with current config assignment when opened
    React.useEffect(() => {
        if (open && config) {
            setAssignment(config.assignment)
            setError(null)
        }
    }, [open, config])

    const handleResolve = async () => {
        if (!config) return
        if (!assignment.value) {
            setError('Please select a valid user or position.')
            return
        }

        setIsResolving(true)
        setError(null)
        try {
            await onResolve(config.id, assignment)
            onOpenChange(false)
        } catch (err) {
            console.error('Failed to resolve ghost task:', err)
            setError('Failed to update assignment. Please try again.')
        } finally {
            setIsResolving(false)
        }
    }

    if (!config) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        Resolve Ghost Task
                    </DialogTitle>
                    <DialogDescription>
                        The task <span className="font-semibold">{config.taskDefinition.title}</span> has no valid assignee.
                        Please re-assign it to continue automatic generation.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 border-y my-4 space-y-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30 text-sm">
                        <p className="font-semibold text-red-800 dark:text-red-200">
                            Reason: {config.ghostReason?.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-red-700 dark:text-red-300 mt-1 italic">
                            "The previously {config.assignment.type === 'position' ? 'position' : 'user'} assignment is no longer valid."
                        </p>
                    </div>

                    <AssignmentStep
                        assignment={assignment}
                        onChange={setAssignment}
                        users={users}
                        positions={positions}
                    />

                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isResolving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleResolve}
                        disabled={isResolving || !assignment.value}
                        className="gap-2"
                    >
                        {isResolving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Resolving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                Update & Reactivate
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
