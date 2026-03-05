'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ExternalLink, AlertCircle, CheckCircle2, User, Clock, Info, ChevronRight, User2 } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface StrategicHealthDialogProps {
    isOpen: boolean
    onClose: () => void
    defaultTab?: string
    data?: {
        atRiskProjects: {
            id: string
            name: string
            healthScore: number
            manager: string
            workspaceName: string
        }[]
        overdueTasks: {
            id: string
            title: string
            projectName: string
            workspaceName: string
            assignee: string
            assigneePosition: string
            reportsTo: string
            reportsToPosition: string
            dueDate: Date | null
            type: string
        }[]
        underutilizedResources: {
            userId: string
            name: string
            assignedTasks: number
            positionCode?: string
            positionTitle?: string
            orgUnit?: string
            reportsToName?: string
            reportsToPositionTitle?: string
            role: string
        }[]
    }
}

export function StrategicHealthDialog({ isOpen, onClose, defaultTab = 'projects', data }: StrategicHealthDialogProps) {
    const router = useRouter()

    if (!data) return null

    return (
        <TooltipProvider>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-sm shadow-2xl border border-border/50 h-[85vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-6 border-b border-border/40 bg-muted/30">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                Strategic Health Breakdown
                            </DialogTitle>
                            <DialogDescription>
                                Detailed analysis of project health, delivery performance, and resource allocation.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-hidden p-6 pt-2">
                        <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="projects" className="gap-2">
                                    <AlertCircle className="h-4 w-4" /> At-Risk Projects
                                </TabsTrigger>
                                <TabsTrigger value="tasks" className="gap-2">
                                    <Clock className="h-4 w-4" /> Overdue Tasks
                                </TabsTrigger>
                                <TabsTrigger value="resources" className="gap-2">
                                    <User className="h-4 w-4" /> Resource Utilization
                                </TabsTrigger>
                            </TabsList>


                            <TabsContent value="projects" className="flex-1 outline-none min-h-0 overflow-y-auto pr-2 data-[state=active]:flex flex-col">
                                {data.atRiskProjects.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
                                        <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                                        <p className="text-muted-foreground">No at-risk projects found. Great job!</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col min-h-full">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            {data.atRiskProjects.slice(0, 6).map((project) => (
                                                <Card key={project.id} className="group hover:shadow-md transition-all border-l-4 border-l-red-500 bg-card/50 backdrop-blur-sm overflow-hidden">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start gap-4 mb-2">
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-sm tracking-tight truncate group-hover:text-primary transition-colors">
                                                                    {project.name}
                                                                </h4>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                                                    {project.workspaceName}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-lg font-black text-red-600 leading-none">
                                                                    {project.healthScore}%
                                                                </span>
                                                                <span className="text-[9px] text-muted-foreground font-bold uppercase">Health</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-6 w-6 border border-border/60">
                                                                    <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                                                        {project.manager.charAt(0)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-medium text-foreground/80 leading-none">
                                                                        {project.manager}
                                                                    </span>
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5">Manager</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => {
                                                                    onClose()
                                                                    router.push(`/projects/${project.id}`)
                                                                }}
                                                            >
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            className="w-full h-11 border-dashed border-2 hover:border-primary hover:bg-primary/5 group mt-auto mb-2 shrink-0"
                                            onClick={() => {
                                                onClose()
                                                router.push('/executive-dashboard/strategic-health/at-risk')
                                            }}
                                        >
                                            <span className="flex items-center gap-2 font-semibold">
                                                View Full At-Risk List {data.atRiskProjects.length > 6 && `(${data.atRiskProjects.length})`}
                                                <ExternalLink className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            </span>
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="tasks" className="flex-1 outline-none min-h-0 overflow-y-auto pr-2 data-[state=active]:flex flex-col">
                                {data.overdueTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
                                        <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                                        <p className="text-muted-foreground">No overdue tasks. All caught up!</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col min-h-full">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                                            {data.overdueTasks.slice(0, 6).map((task) => (
                                                <Card
                                                    key={task.id}
                                                    className="group hover:shadow-md transition-all border-l-4 border-l-red-500 bg-card/50 backdrop-blur-sm overflow-hidden cursor-pointer"
                                                    onClick={() => {
                                                        onClose()
                                                        router.push(`/my-tasks?task=${task.id}`)
                                                    }}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start gap-4 mb-2">
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-sm tracking-tight truncate group-hover:text-primary transition-colors">
                                                                    {task.title}
                                                                </h4>
                                                                <div className="flex flex-col gap-0.5 mt-1">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                                                        {task.projectName}
                                                                    </p>
                                                                    <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                                                        <span className="h-1 w-1 rounded-full bg-red-600 animate-pulse" />
                                                                        Overdue {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No date'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0">
                                                                <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center transition-colors group-hover:bg-red-100">
                                                                    <Clock className="h-4 w-4 text-red-600" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight">Assignee</span>
                                                                    <span className="text-[11px] font-medium text-foreground/80 leading-tight">
                                                                        {task.assignee}
                                                                    </span>
                                                                    <span className="text-[9px] text-muted-foreground italic">
                                                                        {task.assigneePosition}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight">Reports To</span>
                                                                <span className="text-[10px] font-medium text-foreground/70">
                                                                    {task.reportsTo}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>

                                        <Button
                                            variant="ghost"
                                            className="w-full text-primary font-bold hover:bg-primary/5 gap-2 h-11 shrink-0 mt-auto mb-2"
                                            onClick={() => {
                                                onClose()
                                                router.push('/executive-dashboard/strategic-health/overdue-tasks')
                                            }}
                                        >
                                            View All Overdue Tasks ({data.overdueTasks.length})
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="resources" className="flex-1 outline-none min-h-0 overflow-y-auto pr-2 data-[state=active]:flex flex-col">
                                {data.underutilizedResources.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
                                        <CheckCircle2 className="h-12 w-12 text-blue-500/50 mb-3" />
                                        <p className="text-muted-foreground">All team members are actively engaged.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col min-h-full">
                                        <div className="border rounded-md bg-card/50 backdrop-blur-sm overflow-hidden mb-4">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider py-3">Resource</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Tasks</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Reports To</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {data.underutilizedResources.slice(0, 8).map((resource) => (
                                                        <TableRow key={resource.userId} className="group hover:bg-muted/40 transition-colors">
                                                            <TableCell className="py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-7 w-7 border border-border/60 shrink-0">
                                                                        <AvatarFallback className="text-[10px] bg-blue-50 text-blue-600 font-bold">
                                                                            {resource.name.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                                                                            {resource.name}
                                                                        </span>
                                                                        <span className="text-[9px] text-muted-foreground truncate uppercase font-semibold">
                                                                            {resource.positionTitle} {resource.positionCode && `(${resource.positionCode})`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[8px] font-bold px-1.5 py-0 leading-tight">
                                                                    AVAILABLE
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <span className="text-xs font-black text-foreground">
                                                                    {resource.assignedTasks}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[10px] font-semibold text-foreground/80 truncate">
                                                                        {resource.reportsToName}
                                                                    </span>
                                                                    <span className="text-[8px] text-muted-foreground truncate italic">
                                                                        {resource.reportsToPositionTitle}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full h-11 border-dashed border-2 hover:border-primary hover:bg-primary/5 group mt-auto mb-2 shrink-0"
                                            onClick={() => {
                                                onClose()
                                                router.push('/executive-dashboard/strategic-health/resource-utilization')
                                            }}
                                        >
                                            <span className="flex items-center gap-2 font-semibold">
                                                View Full Resource Utilization List {data.underutilizedResources.length > 8 && `(${data.underutilizedResources.length})`}
                                                <ExternalLink className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            </span>
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
