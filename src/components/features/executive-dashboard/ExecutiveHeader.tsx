'use client'

import React from 'react'
import { RefreshCw, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { DashboardExport } from './DashboardExport'
import type { ExecutiveDashboardData } from '@/types/executive-dashboard'

interface ExecutiveHeaderProps {
    lastUpdated?: Date
    onRefresh: () => void
    isRefreshing: boolean
    hasNewData: boolean
    data: ExecutiveDashboardData | null
    onOpenAgent: () => void
}

export function ExecutiveHeader({
    lastUpdated,
    onRefresh,
    isRefreshing,
    hasNewData,
    data,
    onOpenAgent
}: ExecutiveHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border/40 pb-4">
            <p className="text-sm text-muted-foreground">
                Enterprise Performance & Strategic Intelligence
                {lastUpdated && (
                    <span className="ml-2 opacity-70">
                        • Last sync: {format(lastUpdated, 'HH:mm:ss')}
                    </span>
                )}
            </p>

            <div className="flex items-center gap-2 no-print">
                {hasNewData && (
                    <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 animate-pulse">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin-slow" />
                        New updates available
                    </span>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenAgent}
                    className="bg-background hover:bg-muted font-medium h-8 gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                    <Bot className="h-4 w-4" />
                    Ask AI
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="bg-background hover:bg-muted font-medium h-8"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>

                <DashboardExport data={data} />
            </div>
        </div>
    )
}
