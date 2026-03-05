'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Ghost, AlertTriangle, XCircle, Shield, Clock, User } from 'lucide-react'
import type { GhostWorkflowInfo, GhostPositionInfo } from '@/types/task-template-schema'
import { cn } from '@/lib/utils'

interface GhostWorkflowBadgeProps {
    ghostInfo?: GhostWorkflowInfo
    hasGhostIssue?: boolean
    size?: 'sm' | 'md' | 'lg'
    showPopover?: boolean
    onResolve?: () => void
    className?: string
}

export function GhostWorkflowBadge({
    ghostInfo,
    hasGhostIssue,
    size = 'md',
    showPopover = true,
    onResolve,
    className,
}: GhostWorkflowBadgeProps) {
    const [open, setOpen] = useState(false)

    if (!hasGhostIssue && !ghostInfo) {
        return null
    }

    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
    }

    const badgeContent = (
        <div className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full cursor-pointer hover:bg-red-200 dark:hover:bg-red-950/50 transition-colors",
            className
        )}>
            <Ghost className={cn(sizeClasses[size], "animate-pulse")} />
            {size !== 'sm' && (
                <span className="text-xs font-medium">Ghost Issue</span>
            )}
        </div>
    )

    if (!showPopover) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {badgeContent}
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>This task has workflow issues that need attention</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {badgeContent}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-3 border-b bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2">
                        <Ghost className="h-5 w-5 text-red-500" />
                        <span className="font-semibold text-red-700 dark:text-red-400">Ghost Workflow Issue</span>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                        This task has workflow positions that are missing or vacant.
                    </p>
                </div>

                <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
                    {ghostInfo?.hasGhostApproval && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Shield className="h-4 w-4 text-blue-500" />
                                <span>Approval Line Issue</span>
                            </div>
                            <GhostReasonBadge reason={ghostInfo.approvalGhostReason} />
                            {ghostInfo.affectedApprovalPositions && ghostInfo.affectedApprovalPositions.length > 0 && (
                                <AffectedPositionsList positions={ghostInfo.affectedApprovalPositions} />
                            )}
                        </div>
                    )}

                    {ghostInfo?.hasGhostEscalation && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <span>Escalation Path Issue</span>
                            </div>
                            <GhostReasonBadge reason={ghostInfo.escalationGhostReason} />
                            {ghostInfo.affectedEscalationPositions && ghostInfo.affectedEscalationPositions.length > 0 && (
                                <AffectedPositionsList positions={ghostInfo.affectedEscalationPositions} />
                            )}
                        </div>
                    )}

                    {ghostInfo?.detectedAt && (
                        <p className="text-xs text-muted-foreground">
                            Detected: {new Date(ghostInfo.detectedAt).toLocaleString()}
                        </p>
                    )}
                </div>

                {onResolve && (
                    <div className="p-3 border-t bg-muted/30">
                        <Button
                            size="sm"
                            onClick={() => {
                                setOpen(false)
                                onResolve()
                            }}
                            className="w-full"
                        >
                            Resolve Issue
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
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

interface AffectedPositionsListProps {
    positions: GhostPositionInfo[]
}

function AffectedPositionsList({ positions }: AffectedPositionsListProps) {
    if (!positions || positions.length === 0) return null

    return (
        <div className="space-y-1 pl-6">
            {positions.slice(0, 5).map((pos, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{pos.positionTitle || pos.positionId}</span>
                    {pos.stageName && (
                        <span className="text-muted-foreground/70">
                            in {pos.stageName}
                        </span>
                    )}
                    {pos.ruleName && (
                        <span className="text-muted-foreground/70">
                            in {pos.ruleName}
                        </span>
                    )}
                </div>
            ))}
            {positions.length > 5 && (
                <p className="text-xs text-muted-foreground/70 pl-5">
                    ...and {positions.length - 5} more
                </p>
            )}
        </div>
    )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GhostWorkflowBadge
