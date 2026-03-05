'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IndianRupee } from 'lucide-react'
import type { BudgetHealthData } from '@/types/executive-dashboard'
import { cn } from '@/lib/utils'

interface BudgetHealthCardProps {
    data?: BudgetHealthData
    isLoading?: boolean
}

export function BudgetHealthCard({ data, isLoading }: BudgetHealthCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
            </Card>
        )
    }

    const isOver = data?.status === 'over'
    const isUnder = data?.status === 'under'

    return (
        <Card className="p-4 hover:shadow-md transition-all border-border bg-card">
            <div className="flex justify-between items-start mb-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Budget Health
                </p>
                <div className={cn(
                    "p-1 rounded-md",
                    isOver ? "bg-rose-500/10 text-rose-600" : isUnder ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                )}>
                    <IndianRupee className="h-3 w-3" />
                </div>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight">{data?.percentage ?? '--'}%</span>
                <span className="text-xs text-muted-foreground font-medium tracking-tight">Efficiency</span>
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-muted-foreground uppercase">Current Variance</span>
                    <span className={cn(
                        isOver ? "text-rose-600" : isUnder ? "text-amber-600" : "text-emerald-600"
                    )}>
                        {isOver ? '-' : isUnder ? '+' : ''}{data?.variancePercentage ?? 0}%
                    </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                    Comparison vs planned utilization of allocated budgets.
                </p>
            </div>
        </Card>
    )
}
