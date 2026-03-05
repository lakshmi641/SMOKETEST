'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { useExecutiveFilters } from '@/hooks/useExecutiveFilters'
import { useExecutiveDashboardData } from '@/hooks/useExecutiveDashboardData'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ExternalLink, Clock, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export default function OverdueTasksPage() {
    const router = useRouter()
    const { user } = useAuthStore()
    const { companyId, groupId } = useCompany()
    const { viewScope, dateRange } = useExecutiveFilters()
    const [searchQuery, setSearchQuery] = React.useState('')

    const { data, isLoading } = useExecutiveDashboardData({
        groupId: groupId ?? undefined,
        companyId: companyId || '',
        userId: user?.id || '',
        viewScope,
        dateRange
    })

    const tasks = data?.strategicHealth.details?.overdueTasks || []
    const filteredTasks = tasks.filter(t =>
        (t.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.projectName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.assignee?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.type?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )

    return (
        <DashboardLayout>
            <ProtectedPage>
                <div className="flex flex-col gap-6 max-w-[1600px] mx-auto relative">
                    {/* Sticky Header Section */}
                    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md pt-4 pb-6 border-b -mx-6 px-6 mb-2 before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-background/95 before:backdrop-blur-md before:content-['']">
                        <div className="flex flex-col gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                                onClick={() => router.push('/executive-dashboard')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Executive Dashboard
                            </Button>
                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Overdue Tasks</h1>
                                    <p className="text-muted-foreground mt-1">
                                        Analysis of delivery delays across the organization with management hierarchy context.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search tasks..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Badge variant="secondary" className="h-9 px-4 text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200">
                                        {tasks.length} Overdue Items
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <Card className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-red-500" />
                                Delivery Delay Registry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow>
                                            <TableHead className="pl-6 min-w-[200px]">Task Title</TableHead>
                                            <TableHead>Project & Workspace</TableHead>
                                            <TableHead>Assignee & Position</TableHead>
                                            <TableHead>Reports To (Manager & Position)</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell colSpan={7} className="h-16 animate-pulse bg-muted/5" />
                                                </TableRow>
                                            ))
                                        ) : filteredTasks.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-64 text-center">
                                                    <p className="text-muted-foreground">No overdue tasks found matching your search.</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredTasks.map((task) => (
                                                <TableRow key={task.id} className="group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="pl-6 py-4">
                                                        <span className="font-semibold text-sm line-clamp-2">{task.title}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-bold text-slate-700">{task.projectName}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{task.workspaceName}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                                                                {task.assignee.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold">{task.assignee}</span>
                                                                <span className="text-[10px] text-muted-foreground">{task.assigneePosition}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium">{task.reportsTo || 'N/A'}</span>
                                                            <span className="text-[10px] text-muted-foreground italic">{task.reportsToPosition}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-1.5 h-5">
                                                            {task.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-red-600">
                                                                {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No Date'}
                                                            </span>
                                                            <span className="text-[10px] text-red-500/70 font-bold uppercase">Overdue</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => router.push(`/my-tasks?task=${task.id}`)}
                                                        >
                                                            Go to Task
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ProtectedPage>
        </DashboardLayout>
    )
}
