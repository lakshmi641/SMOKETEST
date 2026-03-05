'use client'

import React from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
    ComposedChart
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VelocityData {
    historical: { date: string; value: number }[]
    forecast: { date: string; value: number }[]
    averageVelocity: number
}

interface VelocityForecastChartProps {
    data?: VelocityData
    isLoading?: boolean
}

export function VelocityForecastChart({ data, isLoading }: VelocityForecastChartProps) {
    if (isLoading) {
        return (
            <Card className="p-6 h-[400px] flex flex-col gap-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="flex-1 w-full" />
            </Card>
        )
    }

    if (!data) return null

    // Combined data for chart - now only showing historical data
    const combinedData = data.historical.map(h => ({
        date: h.date,
        historicalValue: h.value,
        type: 'historical'
    }))

    return (
        <Card className="p-6 h-[400px] flex flex-col gap-6 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        Delivery Velocity
                        <div className="group relative">
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-[10px] rounded border shadow-xl z-50">
                                Velocity is based on tasks completed per week.
                            </div>
                        </div>
                    </h3>
                    <p className="text-xs text-muted-foreground">Historical execution trend</p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1.5 text-emerald-600 justify-end">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xl font-bold">{Math.round(data.averageVelocity)}</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Avg. weekly items</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Area for historical shading */}
                        <Area
                            type="monotone"
                            dataKey="historicalValue"
                            stroke="none"
                            fill="url(#colorValue)"
                            connectNulls
                        />

                        {/* Historical Line */}
                        <Line
                            type="monotone"
                            dataKey="historicalValue"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            connectNulls
                        />

                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Card>
    )
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-xl">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold">
                        {payload[0].value} Items
                    </span>
                </div>
            </div>
        )
    }
    return null
}
