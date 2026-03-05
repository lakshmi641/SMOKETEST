'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import type { PortfolioStatusData } from '@/types/executive-dashboard'

interface PortfolioStatusCardProps {
    data?: PortfolioStatusData
    isLoading?: boolean
}

export function PortfolioStatusCard({ data, isLoading }: PortfolioStatusCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-6 w-full" />
            </Card>
        )
    }

    const total = data?.total ?? 0
    const greenPercent = total > 0 ? ((data?.byStatus.green ?? 0) / total) * 100 : 0
    const yellowPercent = total > 0 ? ((data?.byStatus.yellow ?? 0) / total) * 100 : 0
    const redPercent = total > 0 ? ((data?.byStatus.red ?? 0) / total) * 100 : 0

    return (
        <Card className="p-4 hover:shadow-md transition-all border-border bg-card">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Portfolio Status
            </p>

            <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight">{total}</span>
                <span className="text-xs text-muted-foreground font-medium">Projects</span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {/* RAG Progress Bar */}
                <div className="h-2 w-full bg-muted rounded-full flex overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${greenPercent}%` }}
                    />
                    <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${yellowPercent}%` }}
                    />
                    <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${redPercent}%` }}
                    />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                    <div className="flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>{data?.byStatus.green ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>{data?.byStatus.yellow ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-rose-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <span>{data?.byStatus.red ?? 0}</span>
                    </div>
                </div>
            </div>


        </Card>
    )
}
