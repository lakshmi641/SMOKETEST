'use client'

import React from 'react'
import { Treemap, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import type { OrgHierarchyNode } from '@/types/executive-dashboard'
import { cn } from '@/lib/utils'

interface OrgTreemapProps {
    data?: OrgHierarchyNode
    isLoading?: boolean
    onNodeClick?: (node: OrgHierarchyNode) => void
}

const COLORS = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#e11d48',
    background: 'hsl(var(--muted)/0.3)'
}

const CustomizedContent = (props: any) => {
    const { depth, x, y, width, height, name, health, value, onNodeClick, id, type, ...nodeData } = props

    if (width < 30 || height < 20) return null

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth < 2 ? 'transparent' : COLORS[health as keyof typeof COLORS] || COLORS.yellow,
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1),
                    strokeOpacity: 1 / (depth + 1),
                }}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick?.({ id, type, name, health, value, depth, ...nodeData });
                }}
            />
            {width > 60 && height > 30 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={Math.max(10, Math.min(width / 10, 14))}
                    fontWeight="600"
                    className="pointer-events-none select-none"
                >
                    {name}
                </text>
            )}
            {width > 40 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 12}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={10}
                    fillOpacity={0.8}
                    className="pointer-events-none select-none"
                >
                    {value || 0} items
                </text>
            )}
        </g>
    )
}

export function OrgTreemap({ data, isLoading, onNodeClick }: OrgTreemapProps) {
    if (isLoading) {
        return (
            <Card className="p-6 h-[400px] flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="flex-1 w-full rounded-xl" />
            </Card>
        )
    }

    const treemapData = data ? [data] : []

    return (
        <TooltipProvider delayDuration={300}>
            <Card className="p-6 h-[400px] flex flex-col gap-4 shadow-sm border-border bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold tracking-tight">Organization Overview</h3>
                        <p className="text-xs text-muted-foreground">Hierarchical activity map • Sized by task volume</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-help group/healthy">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 group-hover/healthy:scale-125 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground group-hover/healthy:text-emerald-600 transition-colors">Healthy</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-white/95 backdrop-blur-sm border-emerald-500/20 p-3 shadow-xl max-w-[200px]">
                                <div className="text-[10px] leading-relaxed">
                                    <span className="font-bold text-emerald-600 block mb-1">HEALTHY (80-100%)</span>
                                    Projects or workspaces with high completion rates and no critical blockers.
                                </div>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-help group/atrisk">
                                    <span className="h-2 w-2 rounded-full bg-amber-500 group-hover/atrisk:scale-125 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground group-hover/atrisk:text-amber-600 transition-colors">At Risk</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-white/95 backdrop-blur-sm border-amber-500/20 p-3 shadow-xl max-w-[200px]">
                                <div className="text-[10px] leading-relaxed">
                                    <span className="font-bold text-amber-600 block mb-1">AT RISK (60-79%)</span>
                                    Units experiencing delays or moderate task backlogs that require monitoring.
                                </div>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-help group/critical">
                                    <span className="h-2 w-2 rounded-full bg-rose-500 group-hover/critical:scale-125 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground group-hover/critical:text-rose-700 transition-colors">Critical</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-white/95 backdrop-blur-sm border-rose-500/20 p-3 shadow-xl max-w-[200px]">
                                <div className="text-[10px] leading-relaxed">
                                    <span className="font-bold text-rose-600 block mb-1">CRITICAL (&lt; 60%)</span>
                                    Significant delays, overdue tasks, or urgent blockers requiring immediate intervention.
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className="flex-1 min-h-0 w-full rounded-xl bg-muted/20 border border-border/40 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treemapData}
                            dataKey="value"
                            aspectRatio={4 / 3}
                            stroke="#fff"
                            content={<CustomizedContent onNodeClick={onNodeClick} />}
                        >
                            <RechartsTooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const node = payload[0].payload
                                        return (
                                            <div className="bg-popover border border-border p-3 rounded-lg shadow-xl animate-in fade-in zoom-in duration-200 pointer-events-none">
                                                <p className="font-bold text-sm mb-1">{node.name}</p>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">Type:</span>
                                                        <span className="capitalize font-medium">{node.type}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">Health Score:</span>
                                                        <span className={cn(
                                                            "font-bold",
                                                            node.health === 'green' ? "text-emerald-600" :
                                                                node.health === 'yellow' ? "text-amber-600" : "text-rose-700"
                                                        )}>{Math.round(node.healthScore)}%</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">Task Vol:</span>
                                                        <span className="font-medium">{node.value} items</span>
                                                    </div>
                                                </div>
                                                {node.metadata?.overdueCount > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 text-[10px] text-rose-600 font-bold uppercase">
                                                        <span>⚠️ {node.metadata.overdueCount} Overdue</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            </Card>
        </TooltipProvider>
    )
}
