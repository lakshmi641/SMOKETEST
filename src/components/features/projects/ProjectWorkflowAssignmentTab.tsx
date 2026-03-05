'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Shield,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    RefreshCw,
    Info,
    Loader2
} from 'lucide-react'
import { getActiveApprovalLines } from '@/lib/services/approval-line-service'
import {
    SYSTEM_REPORTER_APPROVAL_ID,
    SYSTEM_REPORTER_APPROVAL_LINE,
    isSystemApprovalLine
} from '@/lib/constants/system-approval-lines'
import * as EscalationPathService from '@/lib/services/escalation-path-service'
import { ProjectWorkflowAssignmentService } from '@/lib/services/projects/project-workflow-assignment-service'
import {
    getApprovalLinesWithValidation,
    getEscalationPathsWithValidation,
    validateApprovalLine,
    validateEscalationPath
} from '@/lib/services/workflow-validation-service'
import type { ApprovalLine, EscalationPath } from '@/types/approval-line-schema'
import type { ProjectWorkflowAssignment } from '@/types/workflow-schema'
import type {
    ApprovalLineWithValidation,
    EscalationPathWithValidation,
    ValidationResult,
    ValidationIssue
} from '@/types/workflow-validation-schema'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/hooks/useCompany'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ProjectWorkflowAssignmentTabProps {
    companyId: string
    projectId: string
}

export function ProjectWorkflowAssignmentTab({ companyId, projectId }: ProjectWorkflowAssignmentTabProps) {
    const { user } = useAuthStore()
    const { groupId } = useCompany()
    const [assignments, setAssignments] = useState<ProjectWorkflowAssignment[]>([])
    const [approvalLinesWithValidation, setApprovalLinesWithValidation] = useState<ApprovalLineWithValidation[]>([])
    const [escalationPathsWithValidation, setEscalationPathsWithValidation] = useState<EscalationPathWithValidation[]>([])
    const [loading, setLoading] = useState(true)
    const [validating, setValidating] = useState(false)
    const [saving, setSaving] = useState(false)

    // Selected workflow IDs (for multi-select)
    const [selectedApprovalLineIds, setSelectedApprovalLineIds] = useState<string[]>([])
    const [selectedEscalationPathIds, setSelectedEscalationPathIds] = useState<string[]>([])

    useEffect(() => {
        loadData()
    }, [companyId, projectId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [assigned, linesWithValidation, pathsWithValidation] = await Promise.all([
                ProjectWorkflowAssignmentService.getProjectAssignments(companyId, projectId, groupId ?? undefined),
                getApprovalLinesWithValidation(companyId, undefined, groupId ?? undefined),
                getEscalationPathsWithValidation(companyId, undefined, groupId ?? undefined)
            ])
            setAssignments(assigned)

            // ═══════════════════════════════════════════════════════════════════════
            // SYSTEM APPROVAL LINE: Add at the TOP of the list
            // System lines are always available, always valid, and always pre-selected
            // ═══════════════════════════════════════════════════════════════════════
            const systemApprovalLineWithValidation: ApprovalLineWithValidation = {
                id: SYSTEM_REPORTER_APPROVAL_ID,
                companyId: companyId,
                name: SYSTEM_REPORTER_APPROVAL_LINE.name || 'Reporter Approval',
                description: SYSTEM_REPORTER_APPROVAL_LINE.description,
                status: 'active',
                version: 1,
                resolutionType: 'custom',
                stages: SYSTEM_REPORTER_APPROVAL_LINE.stages || [],
                settings: SYSTEM_REPORTER_APPROVAL_LINE.settings as any,
                createdBy: 'system',
                createdAt: SYSTEM_REPORTER_APPROVAL_LINE.createdAt || '',
                updatedAt: SYSTEM_REPORTER_APPROVAL_LINE.updatedAt || '',
                isSystemLine: true,
                systemType: 'reporter_approval',
                stageCount: 1,
                validation: {
                    isSelectable: true,
                    status: 'valid',
                    errorCount: 0,
                    warningCount: 0,
                    issues: [],
                    validatedAt: new Date().toISOString()
                }
            }

            // Combine: System line first, then user-created lines
            const allLinesWithValidation = [systemApprovalLineWithValidation, ...linesWithValidation]
            setApprovalLinesWithValidation(allLinesWithValidation)
            setEscalationPathsWithValidation(pathsWithValidation)

            // Set selected IDs from existing assignments
            // SYSTEM LINE is ALWAYS selected by default (cannot be deselected)
            const approvalLineIds = assigned
                .filter(a => a.type === 'approval_line' && a.isActive && a.workflowDefinitionId)
                .map(a => a.workflowDefinitionId!)

            // Always include system line in selected (it's mandatory)
            const selectedWithSystem = Array.from(new Set([SYSTEM_REPORTER_APPROVAL_ID, ...approvalLineIds]))

            const escalationPathIds = assigned
                .filter(a => a.type === 'escalation_path' && a.isActive && a.escalationPolicyId)
                .map(a => a.escalationPolicyId!)

            setSelectedApprovalLineIds(selectedWithSystem)
            setSelectedEscalationPathIds(escalationPathIds)
        } catch (error) {
            console.error('Error loading workflow data:', error)
            toast.error('Failed to load workflow configuration')
        } finally {
            setLoading(false)
        }
    }

    const handleRefreshValidation = async () => {
        setValidating(true)
        try {
            await loadData()
            toast.success('Validation refreshed')
        } catch (error) {
            toast.error('Failed to refresh validation')
        } finally {
            setValidating(false)
        }
    }

    const toggleApprovalLine = (id: string) => {
        const item = approvalLinesWithValidation.find(l => l.id === id)
        const isCurrentlySelected = selectedApprovalLineIds.includes(id)

        // SYSTEM LINE: Cannot be deselected - it's mandatory for all projects
        if (id === SYSTEM_REPORTER_APPROVAL_ID) {
            toast.error('System approval lines cannot be removed. They are enabled for all projects.')
            return
        }

        // Only block NEW selections for items with errors - allow deselection
        if (item && !item.validation.isSelectable && !isCurrentlySelected) {
            toast.error('This approval line has validation errors and cannot be selected')
            return
        }

        setSelectedApprovalLineIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        )
    }

    const toggleEscalationPath = (id: string) => {
        const item = escalationPathsWithValidation.find(p => p.id === id)
        const isCurrentlySelected = selectedEscalationPathIds.includes(id)

        // Only block NEW selections for items with errors - allow deselection
        if (item && !item.validation.isSelectable && !isCurrentlySelected) {
            toast.error('This escalation path has validation errors and cannot be selected')
            return
        }

        setSelectedEscalationPathIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        )
    }

    const handleSaveAssignments = async () => {
        if (!user) return

        setSaving(true)
        try {
            // Get current assignments (excluding system lines - they're not stored as assignments)
            const currentApprovalLineIds = assignments
                .filter(a => a.type === 'approval_line' && a.isActive && a.workflowDefinitionId !== SYSTEM_REPORTER_APPROVAL_ID)
                .map(a => ({ id: a.id, workflowId: a.workflowDefinitionId! }))
            const currentEscalationPathIds = assignments
                .filter(a => a.type === 'escalation_path' && a.isActive)
                .map(a => ({ id: a.id, policyId: a.escalationPolicyId! }))

            // Filter out system line from selected (it's always available, no need to store)
            const userSelectedApprovalLineIds = selectedApprovalLineIds.filter(id => id !== SYSTEM_REPORTER_APPROVAL_ID)

            // Find items to remove
            const approvalLinesToRemove = currentApprovalLineIds.filter(
                c => !userSelectedApprovalLineIds.includes(c.workflowId)
            )
            const escalationPathsToRemove = currentEscalationPathIds.filter(
                c => !selectedEscalationPathIds.includes(c.policyId)
            )

            // Find items to add (excluding system line)
            const approvalLinesToAdd = userSelectedApprovalLineIds.filter(
                id => !currentApprovalLineIds.some(c => c.workflowId === id)
            )
            const escalationPathsToAdd = selectedEscalationPathIds.filter(
                id => !currentEscalationPathIds.some(c => c.policyId === id)
            )

            // Remove assignments
            for (const item of approvalLinesToRemove) {
                await ProjectWorkflowAssignmentService.removeAssignment(companyId, item.id, groupId ?? undefined)
            }
            for (const item of escalationPathsToRemove) {
                await ProjectWorkflowAssignmentService.removeAssignment(companyId, item.id, groupId ?? undefined)
            }

            // Add new assignments
            for (const workflowId of approvalLinesToAdd) {
                await ProjectWorkflowAssignmentService.assignWorkflowToProject(companyId, {
                    companyId,
                    projectId,
                    type: 'approval_line',
                    workflowDefinitionId: workflowId,
                    isActive: true,
                    assignedBy: user.id
                }, user.id, groupId ?? undefined)
            }
            for (const policyId of escalationPathsToAdd) {
                await ProjectWorkflowAssignmentService.assignWorkflowToProject(companyId, {
                    companyId,
                    projectId,
                    type: 'escalation_path',
                    escalationPolicyId: policyId,
                    isActive: true,
                    assignedBy: user.id
                }, user.id, groupId ?? undefined)
            }

            toast.success('Workflow assignments saved successfully')
            await loadData() // Refresh data
        } catch (error) {
            console.error('Error saving assignments:', error)
            toast.error('Failed to save workflow assignments')
        } finally {
            setSaving(false)
        }
    }

    // Check if there are unsaved changes (excluding system line which is always present)
    const hasChanges = () => {
        const currentApprovalLineIds = assignments
            .filter(a => a.type === 'approval_line' && a.isActive && a.workflowDefinitionId && a.workflowDefinitionId !== SYSTEM_REPORTER_APPROVAL_ID)
            .map(a => a.workflowDefinitionId!)
            .sort()
        const currentEscalationPathIds = assignments
            .filter(a => a.type === 'escalation_path' && a.isActive && a.escalationPolicyId)
            .map(a => a.escalationPolicyId!)
            .sort()

        // Exclude system line from comparison
        const selectedApproval = selectedApprovalLineIds.filter(id => id !== SYSTEM_REPORTER_APPROVAL_ID).sort()
        const selectedEscalation = [...selectedEscalationPathIds].sort()

        return (
            JSON.stringify(currentApprovalLineIds) !== JSON.stringify(selectedApproval) ||
            JSON.stringify(currentEscalationPathIds) !== JSON.stringify(selectedEscalation)
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-1 tracking-tight">Project Workflow Configuration</h2>
                        <p className="text-sm text-muted-foreground">
                            Select which approval lines and escalation paths are available for tasks in this project.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshValidation}
                            disabled={validating}
                            className="gap-2"
                        >
                            <RefreshCw className={cn("w-4 h-4", validating && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveAssignments}
                            disabled={saving || !hasChanges()}
                            className="gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </div>

                {/* Validation Legend */}
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                    <span className="text-muted-foreground font-medium">Status:</span>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Valid (selectable)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>Error - position vacant or missing (not selectable)</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Approval Lines Card */}
                    <Card className="border-none shadow-md bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-950 dark:to-blue-950/10">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Available Approval Lines</CardTitle>
                                    <CardDescription>
                                        Select approval workflows available for tasks.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {approvalLinesWithValidation.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No approval lines available.</p>
                                    <p className="text-xs mt-1">Create approval lines in workflow settings.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {approvalLinesWithValidation.map(item => (
                                        <WorkflowCheckboxItem
                                            key={item.id}
                                            id={item.id}
                                            name={item.name}
                                            description={item.description}
                                            badge={`${(item as any).stageCount || item.stages?.length || 1} stage${((item as any).stageCount || item.stages?.length || 1) !== 1 ? 's' : ''}`}
                                            validation={item.validation}
                                            checked={selectedApprovalLineIds.includes(item.id)}
                                            onToggle={() => toggleApprovalLine(item.id)}
                                            isSystemLine={item.id === SYSTEM_REPORTER_APPROVAL_ID || (item as any).isSystemLine === true}
                                        />
                                    ))}
                                </div>
                            )}
                            {selectedApprovalLineIds.length > 0 && (
                                <div className="pt-3 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        {selectedApprovalLineIds.length} approval line(s) selected
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Escalation Paths Card */}
                    <Card className="border-none shadow-md bg-gradient-to-br from-white to-orange-50/20 dark:from-slate-950 dark:to-orange-950/10">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Available Escalation Paths</CardTitle>
                                    <CardDescription>
                                        Select escalation rules available for tasks.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {escalationPathsWithValidation.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No escalation paths available.</p>
                                    <p className="text-xs mt-1">Create escalation paths in workflow settings.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {escalationPathsWithValidation.map(item => (
                                        <WorkflowCheckboxItem
                                            key={item.id}
                                            id={item.id}
                                            name={item.name}
                                            description={item.description}
                                            badge={`${item.ruleCount} rules`}
                                            validation={item.validation}
                                            checked={selectedEscalationPathIds.includes(item.id)}
                                            onToggle={() => toggleEscalationPath(item.id)}
                                        />
                                    ))}
                                </div>
                            )}
                            {selectedEscalationPathIds.length > 0 && (
                                <div className="pt-3 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        {selectedEscalationPathIds.length} escalation path(s) selected
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Info message */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">How it works</p>
                        <p className="text-blue-600 dark:text-blue-400">
                            When creating or editing tasks in this project, users can only select from the approval lines
                            and escalation paths you enable here. This ensures consistent workflow policies across the project.
                        </p>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface WorkflowCheckboxItemProps {
    id: string
    name: string
    description?: string
    badge: string
    validation: ValidationResult
    checked: boolean
    onToggle: () => void
    isSystemLine?: boolean
}

function WorkflowCheckboxItem({
    id,
    name,
    description,
    badge,
    validation,
    checked,
    onToggle,
    isSystemLine = false
}: WorkflowCheckboxItemProps) {
    const hasValidationErrors = !validation.isSelectable
    const hasError = validation.status === 'error'
    // System lines are always locked (cannot be toggled)
    // Allow deselection even if item has errors - only block NEW selections
    const canInteract = !isSystemLine && (checked || !hasValidationErrors)

    return (
        <div
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                isSystemLine
                    ? "bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700 cursor-default"
                    : checked
                    ? hasError
                        ? "bg-red-50 dark:bg-red-950/20 border-red-400 dark:border-red-700 cursor-pointer"
                        : "bg-primary/5 border-primary cursor-pointer"
                    : hasValidationErrors
                    ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 cursor-not-allowed"
                    : "bg-white/50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 cursor-pointer",
                hasError && !isSystemLine && "border-l-4 border-l-red-500",
                isSystemLine && "border-l-4 border-l-purple-500"
            )}
            onClick={() => canInteract && onToggle()}
        >
            <Checkbox
                checked={checked}
                disabled={!canInteract}
                className="mt-0.5"
                onCheckedChange={() => canInteract && onToggle()}
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {isSystemLine && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300">
                            System
                        </Badge>
                    )}
                    <span className={cn(
                        "font-medium",
                        hasValidationErrors && !checked && !isSystemLine && "text-muted-foreground line-through"
                    )}>
                        {name}
                    </span>
                    <ValidationStatusIcon
                        status={validation.status}
                        issues={validation.issues}
                    />
                    <Badge variant="outline" className="text-[10px] ml-auto">
                        {badge}
                    </Badge>
                </div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {description}
                    </p>
                )}
                {isSystemLine && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Enabled for all projects. Cannot be removed.
                    </p>
                )}
                {validation.issues.length > 0 && !isSystemLine && (
                    <div className="mt-2 space-y-1">
                        {validation.issues.slice(0, 2).map(issue => (
                            <p
                                key={issue.id}
                                className={cn(
                                    "text-xs",
                                    issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                                )}
                            >
                                • {issue.message}
                            </p>
                        ))}
                        {validation.issues.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                                ...and {validation.issues.length - 2} more
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

interface ValidationStatusIconProps {
    status: 'valid' | 'warning' | 'error'
    issues: ValidationIssue[]
}

function ValidationStatusIcon({ status, issues }: ValidationStatusIconProps) {
    const icon = status === 'valid' ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
    ) : status === 'warning' ? (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
    ) : (
        <XCircle className="w-4 h-4 text-red-500" />
    )

    if (issues.length === 0) {
        return icon
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="cursor-help inline-flex">{icon}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                <ul className="text-sm space-y-1">
                    {issues.slice(0, 5).map((issue) => (
                        <li key={issue.id} className="flex items-start gap-1">
                            <span className={issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'}>
                                •
                            </span>
                            <span>{issue.message}</span>
                        </li>
                    ))}
                    {issues.length > 5 && (
                        <li className="text-muted-foreground">...and {issues.length - 5} more</li>
                    )}
                </ul>
            </TooltipContent>
        </Tooltip>
    )
}
