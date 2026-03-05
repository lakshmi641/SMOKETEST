'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Target, Layout, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectItem {
    id: string
    name: string
    health: 'green' | 'yellow' | 'red'
    healthScore: number
    metadata: {
        totalTasks: number
        completedTasks: number
        overdueCount: number
        progress: number
    }
}

interface WorkspaceDetailViewProps {
    workspaceId: string
    data: any // OrgHierarchyNode for this workspace
    onProjectClick: (id: string, name: string) => void
}

export function WorkspaceDetailView({ workspaceId, data, onProjectClick }: WorkspaceDetailViewProps) {
    if (!data || !data.children) return null

    const projects = data.children as ProjectItem[]

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                        <Target className="h-3 w-3" /> Projects
                    </p>
                    <p className="text-xl font-bold">{projects.length}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="h-3 w-3 text-rose-500" /> Overdue
                    </p>
                    <p className="text-xl font-bold text-rose-600">{data.metadata?.overdueCount || 0}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                        <Layout className="h-3 w-3" /> Avg Health
                    </p>
                    <p className={cn(
                        "text-xl font-bold",
                        data.health === 'green' ? "text-emerald-600" :
                            data.health === 'yellow' ? "text-amber-600" : "text-rose-600"
                    )}>
                        {Math.round(data.healthScore)}%
                    </p>
                </div>
            </div>

            {/* Project List */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                    Project Performance Breakdown
                </h4>

                <div className="space-y-2">
                    {projects.map(project => (
                        <Card
                            key={project.id}
                            className="p-4 hover:border-primary/50 transition-colors cursor-pointer group"
                            onClick={() => onProjectClick(project.id, project.name)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        project.health === 'green' ? "bg-emerald-500" :
                                            project.health === 'yellow' ? "bg-amber-500" : "bg-rose-500"
                                    )} />
                                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">{project.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] py-0 h-5 font-bold">
                                        {Math.round(project.healthScore)}% Health
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 items-end">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted-foreground">Execution Progress</span>
                                        <span className="font-bold">{project.metadata.progress}%</span>
                                    </div>
                                    <Progress value={project.metadata.progress} className="h-1.5" />
                                </div>
                                <div className="flex justify-around text-center">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Tasks</p>
                                        <p className="text-xs font-bold font-mono">{project.metadata.totalTasks}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Done</p>
                                        <p className="text-xs font-bold font-mono text-emerald-600">{project.metadata.completedTasks}</p>
                                    </div>
                                    {project.metadata.overdueCount > 0 && (
                                        <div>
                                            <p className="text-[10px] text-rose-600 uppercase font-bold">Overdue</p>
                                            <p className="text-xs font-bold font-mono text-rose-600">{project.metadata.overdueCount}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
