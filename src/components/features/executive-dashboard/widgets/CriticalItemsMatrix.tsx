'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CriticalItemsMatrix, CriticalItem } from '@/types/executive-dashboard'
import { AlertCircle, AlertTriangle, Clock, Info } from 'lucide-react'

interface CriticalItemsMatrixProps {
    items: CriticalItemsMatrix
    onQuadrantClick?: (quadrant: string) => void
    isLoading?: boolean
}

export function CriticalItemsMatrix({ items, onQuadrantClick, isLoading }: CriticalItemsMatrixProps) {
    const quadrants = [
        {
            id: 'q1',
            title: 'Urgent & Important',
            description: 'Critical Action',
            items: items.urgentImportant,
            color: 'bg-rose-500/10 border-rose-500/20 text-rose-600',
            icon: <AlertCircle className="h-4 w-4" />,
            dotColor: 'bg-rose-500'
        },
        {
            id: 'q2',
            title: 'Urgent',
            description: 'Immediate Review',
            items: items.urgentNotImportant,
            color: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
            icon: <AlertTriangle className="h-4 w-4" />,
            dotColor: 'bg-amber-500'
        },
        {
            id: 'q3',
            title: 'Important',
            description: 'Needs Attention',
            items: items.notUrgentImportant,
            color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
            icon: <Info className="h-4 w-4" />,
            dotColor: 'bg-emerald-500'
        },
        {
            id: 'q4',
            title: 'Neither',
            description: 'Monitor Only',
            items: items.notUrgentNotImportant,
            color: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
            icon: <Clock className="h-4 w-4" />,
            dotColor: 'bg-blue-500'
        }
    ]

    return (
        <Card className="p-6 h-full flex flex-col gap-6 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Critical Items Matrix</h3>
                <p className="text-xs text-muted-foreground">Eisenhower prioritization of pending issues</p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
                {quadrants.map((q) => (
                    <div
                        key={q.id}
                        onClick={() => onQuadrantClick?.(q.id)}
                        className={cn(
                            "group p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]",
                            q.color,
                            "flex flex-col justify-between"
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                    {q.title}
                                </span>
                                <span className="text-xs font-semibold mt-0.5">
                                    {q.description}
                                </span>
                            </div>
                            <div className={cn("p-1.5 rounded-lg bg-white/50 dark:bg-black/20")}>
                                {q.icon}
                            </div>
                        </div>

                        <div className="mt-4 flex items-baseline gap-1.5">
                            <span className="text-3xl font-bold tracking-tight">
                                {q.items.length}
                            </span>
                            <span className="text-[10px] font-bold opacity-60">items</span>
                        </div>


                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground font-bold uppercase">
                <span>Updated Real-time</span>
                <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Data
                </span>
            </div>
        </Card>
    )
}
