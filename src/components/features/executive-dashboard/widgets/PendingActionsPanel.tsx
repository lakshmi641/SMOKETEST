'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Clock,
    AlertCircle,
    User,
    Workflow,
    ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExecutiveAction } from '@/types/executive-dashboard'
import { formatDistanceToNow } from 'date-fns'

interface PendingActionsPanelProps {
    actions: ExecutiveAction[]
    onApprove?: (id: string) => void
    onReject?: (id: string) => void
    onView?: (action: ExecutiveAction) => void
    onViewHistory?: () => void
    isLoading?: boolean
}

export function PendingActionsPanel({
    actions,
    onApprove,
    onReject,
    onView,
    onViewHistory,
    isLoading
}: PendingActionsPanelProps) {
    if (isLoading) {
        return (
            <Card className="p-6 h-full flex flex-col gap-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 w-full bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            </Card>
        )
    }

    return (
        <Card className="p-6 h-full flex flex-col gap-6 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden print:h-auto print:overflow-visible print:shadow-none print:border">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold tracking-tight">Pending Executive Actions</h3>
                    <p className="text-xs text-muted-foreground">Approvals & escalations requiring your attention</p>
                </div>
                <Badge variant="outline" className="bg-primary/5 font-mono">
                    {actions.length} Active
                </Badge>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 print:overflow-visible print:h-auto">
                {actions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 py-10">
                        <CheckCircle2 className="h-10 w-10 mb-2" />
                        <p className="text-sm font-medium">All clear! No pending actions.</p>
                    </div>
                ) : (
                    actions.slice(0, 5).map((action) => (
                        <div
                            key={action.id}
                            className="p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-3">
                                    <div className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                                        action.type === 'approval' ? "bg-blue-500/10 text-blue-600" : "bg-rose-500/10 text-rose-600"
                                    )}>
                                        {action.type === 'approval' ? <Workflow className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold leading-none line-clamp-1">{action.title}</h4>
                                            <Badge className={cn(
                                                "text-[8px] px-1.5 h-4 uppercase font-bold",
                                                action.urgency === 'critical' ? "bg-rose-500" :
                                                    action.urgency === 'high' ? "bg-amber-500" : "bg-blue-500"
                                            )}>
                                                {action.urgency}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1 italic">{action.description}</p>

                                        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" /> {action.requestedBy}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(action.requestedAt?.seconds ? action.requestedAt.seconds * 1000 : action.requestedAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-1 items-center">
                                    {action.type === 'approval' && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600"
                                                onClick={() => onApprove?.(action.id)}
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600"
                                                onClick={() => onReject?.(action.id)}
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onView?.(action)}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="pt-4 border-t border-border/40">
                <Button
                    variant="outline"
                    className="w-full text-xs font-bold border-dashed h-9"
                    onClick={onViewHistory}
                >
                    View Complete History {actions.length > 5 && `(${actions.length})`}
                    <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                </Button>
            </div>
        </Card>
    )
}
