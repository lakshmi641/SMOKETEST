'use client'

import React from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface SparklineChartProps {
    data: number[]
    color?: string
    className?: string
}

export function SparklineChart({ data, color = 'hsl(var(--primary))', className }: SparklineChartProps) {
    // Map data to recharts format
    const chartData = data.map((val, i) => ({ val, i }))

    if (data.length === 0) return <div className={cn("h-full w-full bg-muted/20 rounded", className)} />

    return (
        <div className={cn("w-full h-8", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <Line
                        type="monotone"
                        dataKey="val"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
