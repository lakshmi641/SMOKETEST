'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { SparklineChart } from '../shared/SparklineChart'
import type { DeliveryVelocityData } from '@/types/executive-dashboard'

interface DeliveryVelocityCardProps {
    data?: DeliveryVelocityData
    isLoading?: boolean
}

export function DeliveryVelocityCard({ data, isLoading }: DeliveryVelocityCardProps) {
    if (isLoading) {
        return (
            <Card className="p-4 bg-card border-border shadow-sm">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-8 w-full" />
            </Card>
        )
    }

    return (
        <Card className="p-4 hover:shadow-md transition-all border-border bg-card group">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Delivery Velocity
            </p>

            <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-bold tracking-tight">{data?.current ?? 0}</span>
                <span className="text-xs text-muted-foreground font-medium">Tasks</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{data?.periodLabel ?? 'per week'}</p>



            <SparklineChart
                data={data?.sparklineData ?? []}
                className="mt-3 h-8 opacity-60 group-hover:opacity-100 transition-opacity"
            />
        </Card>
    )
}
