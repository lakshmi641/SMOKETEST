'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { useExecutiveFilters } from '@/hooks/useExecutiveFilters'
import { useExecutiveDashboardData } from '@/hooks/useExecutiveDashboardData'
import { TaskApprovalService } from '@/lib/services/tasks/task-approval-service'
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
import {
    ArrowLeft,
    ExternalLink,
    Clock,
    Search,
    Workflow,
    AlertCircle,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExecutiveAction } from '@/types/executive-dashboard'

export default function PendingActionsPage() {
    const router = useRouter()
    const { user } = useAuthStore()
    const { companyId, groupId } = useCompany()
    const { viewScope, dateRange } = useExecutiveFilters()
    const [searchTerm, setSearchTerm] = React.useState('')
    const [filterType, setFilterType] = React.useState<'all' | 'approval' | 'escalation'>('all')

    const { data, isLoading, refresh } = useExecutiveDashboardData({
        groupId: groupId ?? undefined,
        companyId: companyId || '',
        userId: user?.id || '',
        viewScope,
        dateRange
    })

    const actions = data?.pendingActions || []

    const filteredActions = actions.filter(action => {
        const matchesSearch = (action.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (action.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (action.metadata?.projectName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (action.metadata?.workspaceName?.toLowerCase() || '').includes(searchTerm.toLowerCase())

        const matchesType = filterType === 'all' || action.type === filterType

        return matchesSearch && matchesType
    })

    const handleApprove = async (id: string) => {
        const action = actions.find(a => a.id === id)
        if (!action) return

        toast.promise(
            (async () => {
                if (action.metadata?.isDirectApproval) {
                    await TaskApprovalService.submitDecision(companyId!, action.metadata.instanceId, user!.id, 'approved', undefined, groupId ?? undefined)
                }
                await refresh()
            })(),
            {
                loading: 'Processing approval...',
                success: 'Action approved successfully',
                error: (err) => `Failed to approve: ${err.message}`,
            }
        )
    }

    const handleReject = async (id: string) => {
        const action = actions.find(a => a.id === id)
        if (!action) return

        toast.promise(
            (async () => {
                if (action.metadata?.isDirectApproval) {
                    await TaskApprovalService.submitDecision(companyId!, action.metadata.instanceId, user!.id, 'rejected', undefined, groupId ?? undefined)
                }
                await refresh()
            })(),
            {
                loading: 'Processing rejection...',
                success: 'Action rejected successfully',
                error: (err) => `Failed to reject: ${err.message}`,
            }
        )
    }

    const handleViewAction = (action: ExecutiveAction) => {
        const { projectId, taskId, instanceId } = action.metadata || {}
        if (projectId && taskId) {
            router.push(`/projects/${projectId}/tasks/${taskId}`)
        } else if (instanceId) {
            router.push(`/approvals?instance=${instanceId}`)
        } else if (action.type === 'escalation' && action.resourceId) {
            router.push(`/tasks/${action.resourceId}`)
        }
    }

    return (
        <DashboardLayout>
            <ProtectedPage>
                <TooltipProvider>
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
                                        <h1 className="text-3xl font-bold tracking-tight">Executive Actions Registry</h1>
                                        <p className="text-muted-foreground mt-1">
                                            Manage and resolve all pending approvals and escalations across the organization.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-72">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search actions, projects, workspaces..."
                                                className="pl-9 h-10"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                                            <Button
                                                variant={filterType === 'all' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider px-3"
                                                onClick={() => setFilterType('all')}
                                            >
                                                All
                                            </Button>
                                            <Button
                                                variant={filterType === 'approval' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider px-3"
                                                onClick={() => setFilterType('approval')}
                                            >
                                                Approvals
                                            </Button>
                                            <Button
                                                variant={filterType === 'escalation' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                className="h-8 text-[10px] font-bold uppercase tracking-wider px-3"
                                                onClick={() => setFilterType('escalation')}
                                            >
                                                Escalations
                                            </Button>
                                        </div>
                                        <Badge variant="outline" className="h-9 px-4 text-sm font-bold bg-primary/5">
                                            {filteredActions.length} Pending Actions
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <Card className="border-border/50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Workflow className="h-4 w-4 text-primary" />
                                    Action Queue
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/10">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-wider py-4 pl-6 text-center">Status</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 min-w-[250px]">Action Item</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Workspace</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Project</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Timeline</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 pr-6 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell colSpan={6} className="h-16 animate-pulse bg-muted/5" />
                                                    </TableRow>
                                                ))
                                            ) : filteredActions.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-64 text-center">
                                                        <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                                            <CheckCircle2 className="h-12 w-12 mb-3" />
                                                            <p className="text-lg font-medium">No pending actions found.</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredActions.map((action) => (
                                                    <TableRow key={action.id} className="group hover:bg-muted/30 transition-colors border-b border-border/40">
                                                        <TableCell className="pl-6 text-center py-4">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <div className={cn(
                                                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                                                                    action.type === 'approval' ? "bg-blue-500/10 text-blue-600" : "bg-rose-500/10 text-rose-600"
                                                                )}>
                                                                    {action.type === 'approval' ? <Workflow className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                                </div>
                                                                <span className={cn(
                                                                    "text-[8px] font-black uppercase tracking-tighter leading-none",
                                                                    action.type === 'approval' ? "text-blue-600" : "text-rose-600"
                                                                )}>
                                                                    {action.type}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold leading-none group-hover:text-primary transition-colors">
                                                                        {action.title}
                                                                    </span>
                                                                    <Badge className={cn(
                                                                        "text-[8px] px-1 h-3.5 uppercase font-black",
                                                                        action.urgency === 'critical' ? "bg-rose-500" :
                                                                            action.urgency === 'high' ? "bg-amber-500" : "bg-blue-500"
                                                                    )}>
                                                                        {action.urgency}
                                                                    </Badge>
                                                                </div>
                                                                <span className="text-[11px] text-muted-foreground line-clamp-2 italic leading-relaxed">
                                                                    {action.description}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wide">
                                                                {action.metadata?.workspaceName || 'Global'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                                                                {action.metadata?.projectName || 'N/A'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[11px] font-bold flex items-center gap-1.5 leading-none">
                                                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    {formatDistanceToNow(new Date(action.requestedAt?.seconds ? action.requestedAt.seconds * 1000 : action.requestedAt), { addSuffix: true })}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="pr-6 text-right py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {action.type === 'approval' && (
                                                                    <>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-9 w-9 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg transition-all"
                                                                                    onClick={() => handleApprove(action.id)}
                                                                                >
                                                                                    <CheckCircle2 className="h-4.5 w-4.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top">Approve</TooltipContent>
                                                                        </Tooltip>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-9 w-9 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-all"
                                                                                    onClick={() => handleReject(action.id)}
                                                                                >
                                                                                    <XCircle className="h-4.5 w-4.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top">Reject</TooltipContent>
                                                                        </Tooltip>
                                                                    </>
                                                                )}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 gap-2 font-bold text-[10px] uppercase group-hover:border-primary group-hover:text-primary transition-all"
                                                                            onClick={() => handleViewAction(action)}
                                                                        >
                                                                            View Details
                                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">Go to resource page</TooltipContent>
                                                                </Tooltip>
                                                            </div>
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
                </TooltipProvider>
            </ProtectedPage>
        </DashboardLayout>
    )
}
