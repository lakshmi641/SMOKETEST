'use client'

import React from 'react'
import { RotateCcw, Users, Globe, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExecutiveFilters } from '@/types/executive-dashboard'
import { subDays, format } from 'date-fns'

interface ExecutiveContextBarProps {
    userId: string
    viewScope: ExecutiveFilters['viewScope']
    onViewScopeChange: (scope: ExecutiveFilters['viewScope']) => void
    dateRange: ExecutiveFilters['dateRange']
    onDateRangeChange: (range: ExecutiveFilters['dateRange']) => void
}

export function ExecutiveContextBar({
    viewScope,
    onViewScopeChange,
    dateRange,
    onDateRangeChange
}: ExecutiveContextBarProps) {
    const datePresets = [
        { label: 'Last 7 Days', days: 7 },
        { label: 'Last 30 Days', days: 30 },
        { label: 'Last 90 Days', days: 90 },
        { label: 'Year to Date', days: new Date().getMonth() * 30 + new Date().getDate() } // Approximation
    ]

    const handleDatePreset = (preset: { label: string, days: number }) => {
        onDateRangeChange({
            start: subDays(new Date(), preset.days),
            end: new Date(),
            label: preset.label
        })
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl shadow-sm mb-2">
            <div className="flex flex-wrap items-center gap-8">
                {/* View Scope Toggle */}
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Scope</span>
                    <div className="relative flex bg-muted/60 p-1 rounded-xl border border-border/40 w-[240px]">
                        {/* Animated Slider */}
                        <motion.div
                            className={cn(
                                "absolute inset-y-1 rounded-lg shadow-sm z-0",
                                viewScope === 'organization' ? "bg-blue-600" : "bg-indigo-600"
                            )}
                            initial={false}
                            animate={{
                                x: viewScope === 'organization' ? 0 : 116,
                                width: 116
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />

                        <button
                            onClick={() => onViewScopeChange('organization')}
                            className={cn(
                                "relative z-10 flex-1 flex items-center justify-center gap-2 h-8 text-[11px] font-semibold transition-colors duration-200",
                                viewScope === 'organization' ? "text-white" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Globe className={cn("h-3.5 w-3.5", viewScope === 'organization' ? "text-white" : "text-muted-foreground")} />
                            Full Org
                        </button>

                        <button
                            onClick={() => onViewScopeChange('my_scope')}
                            className={cn(
                                "relative z-10 flex-1 flex items-center justify-center gap-2 h-8 text-[11px] font-semibold transition-colors duration-200",
                                viewScope === 'my_scope' ? "text-white" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className={cn("h-3.5 w-3.5", viewScope === 'my_scope' ? "text-white" : "text-muted-foreground")} />
                            My Hierarchy
                        </button>
                    </div>
                </div>

                {/* Date Presets */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeframe:</span>
                    <div className="flex items-center gap-1.5">
                        {datePresets.map(preset => (
                            <Button
                                key={preset.label}
                                variant={dateRange.label === preset.label ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => handleDatePreset(preset)}
                                className={cn(
                                    "h-8 px-3 text-xs font-medium border-border/60",
                                    dateRange.label === preset.label && "border-primary/20 bg-primary/5 text-primary"
                                )}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Active Range Display */}
                <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg border border-border/40">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">
                        {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-8 text-xs h-8 px-2"
                    onClick={() => {
                        onViewScopeChange('organization')
                        handleDatePreset(datePresets[1]!) // Last 30 days
                    }}
                >
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Reset
                </Button>
            </div>
        </div>
    )
}
