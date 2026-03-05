'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, differenceInDays } from 'date-fns'

interface MilestoneForecast {
    milestoneId: string
    milestoneName: string
    targetDate: Date
    predictedDate: Date
    confidenceLevel: number
    scenarios: {
        optimistic: Date
        mostLikely: Date
        pessimistic: Date
    }
    riskFactors: string[]
}

interface MilestonePredictionsProps {
    forecasts?: MilestoneForecast[]
    isLoading?: boolean
}

import { useRouter } from 'next/navigation'

export function MilestonePredictions({ forecasts, isLoading }: MilestonePredictionsProps) {
    const router = useRouter()

    if (isLoading) {
        return (
            <Card className="p-6 h-[400px] flex flex-col gap-4">
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
            </Card>
        )
    }

    if (!forecasts || forecasts.length === 0) {
        return (
            <Card className="p-6 h-[400px] flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <CheckCircle2 className="h-12 w-12 mb-4" />
                <p>No critical milestones predicted</p>
            </Card>
        )
    }

    return (
        <Card className="p-6 h-[400px] flex flex-col gap-6 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Milestone Predictions</h3>
                <p className="text-xs text-muted-foreground">AI-driven delivery confidence & scenario analysis</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {forecasts.map((forecast) => {
                    const variance = differenceInDays(forecast.predictedDate, forecast.targetDate)
                    const status = variance <= 0 ? 'on-time' : variance <= 3 ? 'at-risk' : 'delayed'

                    return (
                        <div
                            key={forecast.milestoneId}
                            onClick={() => router.push(`/projects/${forecast.milestoneId}`)}
                            className="p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold truncate max-w-[180px] group-hover:text-primary transition-colors">{forecast.milestoneName}</h4>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn(
                                            "text-[9px] px-1.5 py-0 uppercase font-bold",
                                            status === 'on-time' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                status === 'at-risk' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                    "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                        )}>
                                            {status.replace('-', ' ')}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                            {forecast.confidenceLevel}% confidence
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        {format(forecast.predictedDate, 'MMM d')}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Predicted Date</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter">
                                    <span className="text-muted-foreground">Target: {format(forecast.targetDate, 'MMM d')}</span>
                                    <span className={cn(
                                        variance > 0 ? "text-rose-500" : "text-emerald-500"
                                    )}>
                                        {variance === 0 ? 'Hitting Target' : variance > 0 ? `+${variance} days delay` : `${Math.abs(variance)} days early`}
                                    </span>
                                </div>
                                <Progress value={forecast.confidenceLevel} className="h-1.5 bg-muted" />
                            </div>

                            {forecast.riskFactors.length > 0 && (
                                <div className="mt-3 flex gap-2">
                                    {forecast.riskFactors.map((risk, idx) => (
                                        <div key={idx} className="flex items-center gap-1 text-[9px] text-rose-600 bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10 font-bold uppercase">
                                            <AlertCircle className="h-2.5 w-2.5" />
                                            {risk}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}

function SkeletonItem() {
    return (
        <div className="p-4 rounded-xl border border-border/40 bg-muted/10 animate-pulse space-y-3">
            <div className="flex justify-between">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
            </div>
            <div className="h-2 w-full bg-muted rounded" />
        </div>
    )
}
