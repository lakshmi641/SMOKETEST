'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface RAGStatusBadgeProps {
    status: 'green' | 'yellow' | 'red'
    label?: string
    className?: string
}

export function RAGStatusBadge({ status, label, className }: RAGStatusBadgeProps) {
    const configs = {
        green: {
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-600',
            dot: 'bg-emerald-500',
            label: 'On Track'
        },
        yellow: {
            bg: 'bg-amber-500/10',
            text: 'text-amber-600',
            dot: 'bg-amber-500',
            label: 'At Risk'
        },
        red: {
            bg: 'bg-rose-500/10',
            text: 'text-rose-600',
            dot: 'bg-rose-500',
            label: 'Critical'
        }
    }

    const config = configs[status]

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
            config.bg,
            config.text,
            className
        )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
            {label || config.label}
        </div>
    )
}
