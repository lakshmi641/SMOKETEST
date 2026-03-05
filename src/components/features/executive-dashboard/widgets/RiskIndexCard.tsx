'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendIndicator } from '../shared/TrendIndicator'
import { RAGStatusBadge } from '../shared/RAGStatusBadge'
import type { RiskIndexData } from '@/types/executive-dashboard'

interface RiskIndexCardProps {
    data?: RiskIndexData
    isLoading?: boolean
    onClick?: () => void
}

export function RiskIndexCard({ data, isLoading, onClick }: RiskIndexCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-9 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
            </Card>
        )
    }

    const levelToRAG = (level?: RiskIndexData['level']): 'green' | 'yellow' | 'red' => {
        if (level === 'critical' || level === 'high') return 'red'
        if (level === 'medium') return 'yellow'
        return 'green'
    }

    return (
        <Card
            className="p-4 hover:shadow-md transition-all border-border bg-card cursor-pointer group hover:border-primary/50"
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Risk Index
                </p>
                <RAGStatusBadge
                    status={levelToRAG(data?.level)}
                    label={data?.level}
                />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight">{data?.score ?? '--'}</span>
                <span className="text-xs text-muted-foreground font-medium">/ 100</span>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-medium">
                    <span className="text-muted-foreground">Critical/High Risks</span>
                    <span className="text-rose-600 font-bold">{(data?.breakdown.critical ?? 0) + (data?.breakdown.high ?? 0)}</span>
                </div>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-rose-500"
                        style={{ width: `${Math.min(100, ((data?.breakdown.critical ?? 0) + (data?.breakdown.high ?? 1)) * 10)}%` }}
                    />
                </div>
            </div>

            {data?.trend && (
                <TrendIndicator
                    direction={data.trend}
                    percentage={data.trendPercentage}
                    label="exposure"
                    className="mt-3"
                />
            )}
        </Card>
    )
}
