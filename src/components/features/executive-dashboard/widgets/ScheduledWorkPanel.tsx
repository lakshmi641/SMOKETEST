'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    CalendarDays,
    Rocket,
    Flag,
    Clock,
    ChevronRight,
    Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isToday, isTomorrow } from 'date-fns'
import Link from 'next/link'

import { type ScheduledWork } from '@/types/executive-dashboard'

interface ScheduledWorkPanelProps {
    items?: ScheduledWork[]
    isLoading?: boolean
}

export function ScheduledWorkPanel({ items, isLoading }: ScheduledWorkPanelProps) {
    if (isLoading) {
        return (
            <Card className="p-6 h-[400px] flex flex-col gap-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-border/20 animate-pulse">
                        <div className="h-10 w-10 bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded" />
                            <div className="h-3 w-1/4 bg-muted rounded" />
                        </div>
                    </div>
                ))}
            </Card>
        )
    }

    const isEmpty = !items || items.length === 0

    return (
        <Card className="p-6 h-[400px] flex flex-col gap-6 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden print:h-auto print:overflow-visible print:shadow-none print:border">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        Upcoming Schedule
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold px-1.5 py-0 h-4">
                            Next 30 Days
                        </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">Strategic milestones & project kickoffs</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar print:overflow-visible print:h-auto">
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                        <CalendarDays className="h-12 w-12" />
                        <p className="text-sm font-medium italic">No major events scheduled</p>
                    </div>
                ) : (
                    <div className="relative pl-4 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                        {items.map((item) => {
                            const href = item.type === 'major_task'
                                ? `/projects/${item.projectId}/tasks/${item.id}`
                                : `/projects/${item.projectId}`

                            return (
                                <div key={item.id} className="relative flex gap-4 group">
                                    {/* Timeline Dot */}
                                    <div className={cn(
                                        "absolute left-[7px] top-1 h-2 w-2 rounded-full ring-4 ring-background shadow-sm transition-transform group-hover:scale-125 z-10",
                                        item.status === 'delayed' ? "bg-rose-500" : "bg-primary"
                                    )} />

                                    {/* Date Column */}
                                    <div className="w-14 pl-2 pt-0.5 space-y-0.5 text-center shrink-0">
                                        <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                                            {format(item.date, 'MMM')}
                                        </span>
                                        <span className="block text-xl font-bold tracking-tighter leading-none">
                                            {format(item.date, 'd')}
                                        </span>
                                    </div>

                                    <Link
                                        href={href}
                                        className="flex-1 p-3 rounded-xl border border-border/40 bg-card/50 hover:bg-card transition-all hover:shadow-md hover:border-primary/20"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[8px] font-bold px-1 rounded-sm uppercase tracking-wider",
                                                        item.type === 'project_start' ? "bg-indigo-500/10 text-indigo-600" : "bg-amber-500/10 text-amber-600"
                                                    )}>
                                                        {item.type.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[120px]">
                                                        {item.projectName}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold leading-snug group-hover:text-primary transition-colors">
                                                    {item.title}
                                                </h4>
                                            </div>
                                            <div className={cn(
                                                "p-2 rounded-lg shrink-0",
                                                item.type === 'project_start' ? "bg-indigo-50 text-indigo-500" : "bg-amber-50 text-amber-500"
                                            )}>
                                                {item.type === 'project_start' ? <Rocket className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground">
                                                <Clock className="h-2.5 w-2.5" />
                                                {isToday(item.date) ? 'Today' : isTomorrow(item.date) ? 'Tomorrow' : format(item.date, 'EEEE')}
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all" />
                                        </div>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </Card>
    )
}
