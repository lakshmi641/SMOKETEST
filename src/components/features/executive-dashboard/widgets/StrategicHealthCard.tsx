'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

import { RAGStatusBadge } from '../shared/RAGStatusBadge'
import { SparklineChart } from '../shared/SparklineChart'
import type { StrategicHealthScore } from '@/types/executive-dashboard'

interface StrategicHealthCardProps {
    data?: StrategicHealthScore
    isLoading?: boolean
    onClick?: () => void
}

export function StrategicHealthCard({ data, isLoading, onClick }: StrategicHealthCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-9 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
            </Card>
        )
    }

    const scoreToRAG = (score?: number): 'green' | 'yellow' | 'red' => {
        if (score === undefined) return 'yellow'
        if (score >= 80) return 'green'
        if (score >= 60) return 'yellow'
        return 'red'
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Card
                        className={`p-4 hover:shadow-md transition-all border-border bg-card group ${onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
                        onClick={onClick}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Strategic Health
                            </p>
                            <RAGStatusBadge status={scoreToRAG(data?.score)} />
                        </div>

                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-3xl font-bold tracking-tight">{data?.score ?? '--'}</span>
                            <span className="text-xs text-muted-foreground font-medium">/ 100</span>
                        </div>



                        {data?.historicalScores && data.historicalScores.length > 0 && (
                            <SparklineChart
                                data={data.historicalScores}
                                className="mt-3 h-8 opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                        )}
                    </Card>
                </TooltipTrigger>
                <TooltipContent className="w-64 p-3 bg-popover border-border shadow-xl">
                    <div className="space-y-3">
                        <p className="font-bold text-xs uppercase tracking-tight">Health Composition</p>
                        <div className="space-y-2">
                            {/* Project Health */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <div className="flex items-center gap-1">
                                        <span>Project Health</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-popover border-border text-[10px] p-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold">Active Projects: {data?.componentMetadata?.projectHealth.activeProjects ?? 0}</span>
                                                    <span>Avg Health Score: {data?.componentMetadata?.projectHealth.avgHealthScore ?? 0}%</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <span>{data?.components?.projectHealth ?? 0}%</span>
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${data?.components?.projectHealth ?? 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Task Completion */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <div className="flex items-center gap-1">
                                        <span>Task Completion</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-popover border-border text-[10px] p-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold">Completion Rate: {data?.componentMetadata?.taskCompletion.completionRate ?? 0}%</span>
                                                    <span>Completed: {data?.componentMetadata?.taskCompletion.completedTasks ?? 0}</span>
                                                    <span>Overdue: {data?.componentMetadata?.taskCompletion.overdueTasks ?? 0}</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <span>{data?.components?.taskCompletion ?? 0}%</span>
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${data?.components?.taskCompletion ?? 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Resource Util */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <div className="flex items-center gap-1">
                                        <span>Resource Util.</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-popover border-border text-[10px] p-2">
                                                <div className="flex flex-col gap-1 min-w-[120px]">
                                                    <span className="font-bold border-b border-border/50 pb-1 mb-1">Utilization Breakdown</span>
                                                    <div className="grid grid-cols-[1fr,auto] gap-2">
                                                        <span className="text-muted-foreground">Assigned Users:</span>
                                                        <span className="font-mono font-bold">{data?.componentMetadata?.resourceUtilization.activeUsers ?? 0}/{data?.componentMetadata?.resourceUtilization.totalUsers ?? 0}</span>

                                                        <span className="text-muted-foreground">Tasks/User:</span>
                                                        <span className="font-mono font-bold">{data?.componentMetadata?.resourceUtilization.avgTasksPerUser ?? 0}</span>
                                                    </div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <span>{data?.components?.resourceUtilization ?? 0}%</span>
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${data?.components?.resourceUtilization ?? 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
                            Weighted average of across all active modules.
                        </p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
