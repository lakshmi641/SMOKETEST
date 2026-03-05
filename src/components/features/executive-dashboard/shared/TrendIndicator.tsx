'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
    direction: 'up' | 'down' | 'stable'
    percentage: number
    label?: string
    className?: string
}

export function TrendIndicator({ direction, percentage, label, className }: TrendIndicatorProps) {
    const isUp = direction === 'up'
    const isDown = direction === 'down'

    if (direction === 'stable') {
        return (
            <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
                <Minus className="h-3 w-3" />
                <span>Stable</span>
                {label && <span className="opacity-70">{label}</span>}
            </div>
        )
    }

    return (
        <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isUp ? "text-emerald-600" : "text-rose-600",
            className
        )}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{percentage > 0 ? `+${percentage}%` : `${percentage}%`}</span>
            {label && <span className="text-muted-foreground font-normal">{label}</span>}
        </div>
    )
}
