'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, AlertTriangle } from 'lucide-react'
import type { ApprovalQueueData } from '@/types/executive-dashboard'

interface ApprovalQueueCardProps {
    data?: ApprovalQueueData
    isLoading?: boolean
}

export function ApprovalQueueCard({ data, isLoading }: ApprovalQueueCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
            </Card>
        )
    }

    const isUrgent = (data?.urgent ?? 0) > 0

    return (
        <Card className="p-4 hover:shadow-md transition-all border-border bg-card">
            <div className="flex justify-between items-start mb-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Approval Queue
                </p>
                {isUrgent && (
                    <div className="bg-rose-500/10 text-rose-600 p-1 rounded-md">
                        <AlertTriangle className="h-3 w-3" />
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight">{data?.total ?? 0}</span>
                <span className="text-xs text-muted-foreground font-medium">Pending</span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-rose-600 uppercase tracking-tighter">Urgent Action</span>
                    <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{data?.urgent ?? 0}</span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                    <Clock className="h-3 w-3" />
                    <span>Oldest: {data?.oldestItemDays ?? 0} days</span>
                </div>
            </div>
        </Card>
    )
}
