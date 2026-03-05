'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import {
    AlertCircle,
    AlertTriangle,
    Clock,
    CheckCircle2,
    User,
    Folder,
    ExternalLink,
    Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { CriticalItem } from '@/types/executive-dashboard'
import { format } from 'date-fns'

interface MatrixQuadrantViewProps {
    quadrantId: string
    quadrantName: string
    items: CriticalItem[]
}

export function MatrixQuadrantView({ quadrantId, quadrantName, items }: MatrixQuadrantViewProps) {
    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                <CheckCircle2 className="h-12 w-12 mb-4" />
                <p className="font-medium text-lg">No items in this quadrant</p>
            </div>
        )
    }

    const projects = items.filter(i => i.type === 'milestone')
    const tasks = items.filter(i => i.type === 'task')

    const getQuadrantColor = (id: string) => {
        switch (id) {
            case 'q1': return 'text-rose-600'
            case 'q2': return 'text-amber-600'
            case 'q3': return 'text-emerald-600'
            case 'q4': return 'text-blue-600'
            default: return 'text-primary'
        }
    }

    return (
        <div className="space-y-8">
            {/* Summary Banner */}
            <div className={cn(
                "p-4 rounded-xl border flex items-center justify-between",
                quadrantId === 'q1' ? "bg-rose-500/5 border-rose-500/10" :
                    quadrantId === 'q2' ? "bg-amber-500/5 border-amber-500/10" :
                        quadrantId === 'q3' ? "bg-emerald-500/5 border-emerald-500/10" : "bg-blue-500/5 border-blue-500/10"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-white shadow-sm", getQuadrantColor(quadrantId))}>
                        {quadrantId === 'q1' ? <AlertCircle className="h-5 w-5" /> :
                            quadrantId === 'q2' ? <AlertTriangle className="h-5 w-5" /> :
                                quadrantId === 'q3' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm leading-none">{quadrantName}</h4>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {items.length} items requiring attention
                        </p>
                    </div>
                </div>
            </div>

            {/* List Sections */}
            <div className="space-y-6">
                {/* Project Risks Section */}
                {projects.length > 0 && (
                    <div className="space-y-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Folder className="h-3 w-3" />
                            Strategic Project Risks ({projects.length})
                        </h5>
                        <div className="grid gap-3">
                            {projects.map((project) => (
                                <ProjectItemCard key={project.id} item={project} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Tasks Section */}
                {tasks.length > 0 && (
                    <div className="space-y-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Workflow className="h-3 w-3" />
                            Active Tasks ({tasks.length})
                        </h5>
                        <div className="grid gap-3">
                            {tasks.map((task) => (
                                <TaskItemCard key={task.id} item={task} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function ProjectItemCard({ item }: { item: CriticalItem }) {
    return (
        <Link
            href={`/projects/${item.id}`}
            className="group flex flex-col p-4 rounded-xl border border-border/50 bg-card hover:border-rose-500/30 transition-all hover:shadow-md"
        >
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h6 className="font-bold text-sm group-hover:text-rose-600 transition-colors">
                        {item.title}
                    </h6>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {item.metadata.workspaceName && (
                            <span className="font-bold text-amber-600 uppercase tracking-tighter shrink-0 border-r pr-2 border-border/50">
                                {item.metadata.workspaceName}
                            </span>
                        )}
                        <Badge variant="outline" className="h-4 px-1 text-[8px] border-rose-500/20 text-rose-600 bg-rose-500/5">URGENT PROJECT</Badge>
                        <span className="flex items-center gap-1 font-medium capitalize">
                            Status: {item.metadata.status}
                        </span>
                    </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
        </Link>
    )
}

function TaskItemCard({ item }: { item: CriticalItem }) {
    const formattedDate = item.metadata.dueDate
        ? format(new Date(item.metadata.dueDate), 'MMM d, yyyy')
        : 'No date'

    return (
        <Link
            href={`/projects/${item.metadata.projectId}/tasks/${item.id}`}
            className="group flex flex-col p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all hover:shadow-md"
        >
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h6 className="font-bold text-sm group-hover:text-primary transition-colors">
                        {item.title}
                    </h6>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[10px] text-muted-foreground">
                        {item.metadata.workspaceName && (
                            <>
                                <span className="font-bold text-amber-600 uppercase tracking-tighter shrink-0">
                                    {item.metadata.workspaceName}
                                </span>
                                <span className="text-muted-foreground/40 text-[8px]">•</span>
                            </>
                        )}
                        <span className="font-bold text-primary/80 uppercase tracking-tighter shrink-0">
                            {item.metadata.projectName}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                            <User className="h-3 w-3" /> {item.metadata.assignee || 'Unassigned'}
                        </span>
                        <span className={cn(
                            "flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full font-bold",
                            item.urgency === 'urgent' ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                        )}>
                            <Clock className="h-3 w-3 " /> {formattedDate}
                        </span>
                    </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
            </div>
        </Link>
    )
}
