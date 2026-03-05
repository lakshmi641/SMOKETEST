'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Ghost,
    Shield,
    Clock,
    RefreshCw,
    ArrowRight,
    UserCheck,
    Settings,
    XCircle,
    AlertTriangle,
    CheckCircle,
} from 'lucide-react'
import type { GeneratedTask, GhostWorkflowInfo, GhostResolutionMethod } from '@/types/task-template-schema'
import type { ApprovalLineWithValidation, EscalationPathWithValidation } from '@/types/workflow-validation-schema'
import { resolveGhostIssue } from '@/lib/services/ghost-workflow-service'
import { getApprovalLinesWithValidation, getEscalationPathsWithValidation } from '@/lib/services/workflow-validation-service'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface GhostResolutionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    task: GeneratedTask | null
    companyId: string
    userId: string
    groupId?: string
    onResolved?: () => void
}

type ResolutionOption = 'change_workflow' | 'wait_for_fix' | 'manual_override'

export function GhostResolutionDialog({
    open,
    onOpenChange,
    task,
    companyId,
    userId,
    groupId,
    onResolved,
}: GhostResolutionDialogProps) {
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [selectedOption, setSelectedOption] = useState<ResolutionOption>('change_workflow')
    const [notes, setNotes] = useState('')

    // Available workflows
    const [approvalLines, setApprovalLines] = useState<ApprovalLineWithValidation[]>([])
    const [escalationPaths, setEscalationPaths] = useState<EscalationPathWithValidation[]>([])

    // Selected replacements
    const [selectedApprovalLine, setSelectedApprovalLine] = useState<string>('')
    const [selectedEscalationPath, setSelectedEscalationPath] = useState<string>('')

    useEffect(() => {
        if (open && companyId) {
            loadWorkflows()
        }
    }, [open, companyId, groupId])

    useEffect(() => {
        // Reset form when dialog opens
        if (open) {
            setSelectedOption('change_workflow')
            setNotes('')
            setSelectedApprovalLine('')
            setSelectedEscalationPath('')
        }
    }, [open])

    const loadWorkflows = async () => {
        setLoading(true)
        try {
            const [lines, paths] = await Promise.all([
                getApprovalLinesWithValidation(companyId, undefined, groupId),
                getEscalationPathsWithValidation(companyId, undefined, groupId)
            ])
            setApprovalLines(lines.filter(l => l.validation.isSelectable))
            setEscalationPaths(paths.filter(p => p.validation.isSelectable))
        } catch (error) {
            console.error('Error loading workflows:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleResolve = async () => {
        if (!task) return

        setSubmitting(true)
        try {
            let method: GhostResolutionMethod = 'manual_override'
            let newWorkflowDefinitionId: string | undefined
            let newEscalationPolicyId: string | undefined

            switch (selectedOption) {
                case 'change_workflow':
                    method = 'workflow_changed'
                    newWorkflowDefinitionId = selectedApprovalLine || undefined
                    newEscalationPolicyId = selectedEscalationPath || undefined
                    break
                case 'wait_for_fix':
                    method = 'position_filled' // Will be auto-resolved when position is filled
                    break
                case 'manual_override':
                    method = 'manual_override'
                    break
            }

            await resolveGhostIssue(companyId, task.id, {
                method,
                resolvedBy: userId,
                notes: notes || undefined,
                newWorkflowDefinitionId,
                newEscalationPolicyId,
            })

            toast.success('Ghost issue resolved')
            onOpenChange(false)
            onResolved?.()
        } catch (error) {
            console.error('Error resolving ghost issue:', error)
            toast.error('Failed to resolve ghost issue')
        } finally {
            setSubmitting(false)
        }
    }

    if (!task) return null

    const ghostInfo = task.ghostInfo

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                            <Ghost className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <DialogTitle>Resolve Ghost Issue</DialogTitle>
                            <DialogDescription>
                                Task: {task.title}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Issue Summary */}
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg space-y-2">
                        <h4 className="font-medium text-sm text-red-700 dark:text-red-400">Issue Summary</h4>

                        {ghostInfo?.hasGhostApproval && (
                            <div className="flex items-center gap-2 text-sm">
                                <Shield className="h-4 w-4 text-blue-500" />
                                <span>Approval Line: </span>
                                <GhostReasonBadge reason={ghostInfo.approvalGhostReason} />
                            </div>
                        )}

                        {ghostInfo?.hasGhostEscalation && (
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <span>Escalation Path: </span>
                                <GhostReasonBadge reason={ghostInfo.escalationGhostReason} />
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Resolution Options */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Resolution Option</Label>

                        <RadioGroup value={selectedOption} onValueChange={(v) => setSelectedOption(v as ResolutionOption)}>
                            {/* Option 1: Change Workflow */}
                            <div className={cn(
                                "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                                selectedOption === 'change_workflow' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                            )}
                                onClick={() => setSelectedOption('change_workflow')}
                            >
                                <RadioGroupItem value="change_workflow" id="change_workflow" className="mt-1" />
                                <div className="flex-1">
                                    <label htmlFor="change_workflow" className="font-medium text-sm cursor-pointer flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4" />
                                        Change to Different Workflow
                                    </label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Replace the problematic workflow with a valid one
                                    </p>
                                </div>
                            </div>

                            {/* Option 2: Wait for Fix */}
                            <div className={cn(
                                "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                                selectedOption === 'wait_for_fix' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                            )}
                                onClick={() => setSelectedOption('wait_for_fix')}
                            >
                                <RadioGroupItem value="wait_for_fix" id="wait_for_fix" className="mt-1" />
                                <div className="flex-1">
                                    <label htmlFor="wait_for_fix" className="font-medium text-sm cursor-pointer flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" />
                                        Wait for Position to be Filled
                                    </label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Keep the issue flagged until someone fills the vacant position
                                    </p>
                                </div>
                            </div>

                            {/* Option 3: Manual Override */}
                            <div className={cn(
                                "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                                selectedOption === 'manual_override' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                            )}
                                onClick={() => setSelectedOption('manual_override')}
                            >
                                <RadioGroupItem value="manual_override" id="manual_override" className="mt-1" />
                                <div className="flex-1">
                                    <label htmlFor="manual_override" className="font-medium text-sm cursor-pointer flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Manual Override
                                    </label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Acknowledge and dismiss the warning (task will proceed without workflow)
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Workflow Selection (for change_workflow option) */}
                    {selectedOption === 'change_workflow' && (
                        <div className="space-y-4 pt-2">
                            {ghostInfo?.hasGhostApproval && (
                                <div className="space-y-2">
                                    <Label className="text-sm">New Approval Line</Label>
                                    <Select value={selectedApprovalLine} onValueChange={setSelectedApprovalLine}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an approval line..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">
                                                <span className="text-muted-foreground">Remove approval line</span>
                                            </SelectItem>
                                            {approvalLines.map(line => (
                                                <SelectItem key={line.id} value={line.id}>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                        {line.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {ghostInfo?.hasGhostEscalation && (
                                <div className="space-y-2">
                                    <Label className="text-sm">New Escalation Path</Label>
                                    <Select value={selectedEscalationPath} onValueChange={setSelectedEscalationPath}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an escalation path..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">
                                                <span className="text-muted-foreground">Remove escalation path</span>
                                            </SelectItem>
                                            {escalationPaths.map(path => (
                                                <SelectItem key={path.id} value={path.id}>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                        {path.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label className="text-sm">Notes (optional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any notes about this resolution..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleResolve} disabled={submitting}>
                        {submitting ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Resolving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Resolve Issue
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface GhostReasonBadgeProps {
    reason?: string
}

function GhostReasonBadge({ reason }: GhostReasonBadgeProps) {
    if (!reason) return null

    const reasonConfig: Record<string, { label: string; variant: 'destructive' | 'warning' }> = {
        position_missing: { label: 'Position Deleted', variant: 'destructive' },
        position_vacant: { label: 'Position Vacant', variant: 'warning' },
        user_inactive: { label: 'User Inactive', variant: 'warning' },
        approval_line_deleted: { label: 'Approval Line Deleted', variant: 'destructive' },
        escalation_path_deleted: { label: 'Escalation Path Deleted', variant: 'destructive' },
    }

    const config = reasonConfig[reason] || { label: reason, variant: 'warning' as const }

    return (
        <Badge variant={config.variant === 'destructive' ? 'destructive' : 'secondary'} className="text-xs">
            {config.variant === 'destructive' ? (
                <XCircle className="h-3 w-3 mr-1" />
            ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {config.label}
        </Badge>
    )
}

export default GhostResolutionDialog
