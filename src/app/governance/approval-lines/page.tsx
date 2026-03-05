'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCompany } from '@/contexts/CompanyContext'
import { useApprovalLinesQuery, useApprovalLineMutations } from '@/hooks/queries/useGovernanceQueries'
import { ApprovalLineStatus } from '@/types/approval-line-schema'
import {
    SYSTEM_REPORTER_APPROVAL_ID,
    SYSTEM_REPORTER_APPROVAL_LINE,
    isSystemApprovalLine
} from '@/lib/constants/system-approval-lines'
import type { ApprovalLineWithValidation } from '@/types/workflow-validation-schema'
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Archive,
    CheckCircle,
    XCircle,
    AlertTriangle,
    GitBranch,
    Users,
    Clock,
    Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const statusColors: Record<ApprovalLineStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    inactive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const statusLabels: Record<ApprovalLineStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived',
}

export default function ApprovalLinesPage() {
    const router = useRouter()
    const { companyId, groupId } = useCompany()
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<ApprovalLineStatus | 'all'>('all')

    const { data: approvalLines = [], isLoading: loading } = useApprovalLinesQuery(companyId, groupId)
    const { updateStatus, archive } = useApprovalLineMutations(companyId, groupId)

    const handleStatusChange = (approvalLineId: string, newStatus: ApprovalLineStatus) => {
        toast.promise(
            updateStatus.mutateAsync({ id: approvalLineId, status: newStatus }),
            {
                loading: 'Updating status...',
                success: `Approval line ${statusLabels[newStatus].toLowerCase()}`,
                error: 'Failed to update status',
            }
        )
    }

    const handleDelete = (approvalLineId: string) => {
        if (!confirm('Are you sure you want to archive this approval line?')) return

        toast.promise(
            archive.mutateAsync(approvalLineId),
            {
                loading: 'Archiving...',
                success: 'Approval line archived',
                error: 'Failed to archive approval line',
            }
        )
    }

    // Create system approval line entry for display
    const systemApprovalLine: ApprovalLineWithValidation = {
        id: SYSTEM_REPORTER_APPROVAL_ID,
        companyId: companyId || '',
        name: SYSTEM_REPORTER_APPROVAL_LINE.name || 'Reporter Approval',
        description: SYSTEM_REPORTER_APPROVAL_LINE.description,
        status: 'active',
        version: 1,
        resolutionType: 'custom',
        stages: SYSTEM_REPORTER_APPROVAL_LINE.stages || [],
        settings: SYSTEM_REPORTER_APPROVAL_LINE.settings as any,
        createdBy: 'system',
        createdAt: SYSTEM_REPORTER_APPROVAL_LINE.createdAt || '',
        updatedAt: SYSTEM_REPORTER_APPROVAL_LINE.updatedAt || '',
        isSystemLine: true,
        systemType: 'reporter_approval',
        stageCount: 1,
        validation: {
            isSelectable: true,
            status: 'valid',
            errorCount: 0,
            warningCount: 0,
            issues: [],
            validatedAt: new Date().toISOString()
        }
    }

    // Combine system line (first) with user-created lines
    const allLines = [systemApprovalLine, ...approvalLines]

    const filteredLines = allLines.filter((line) => {
        const matchesSearch =
            searchQuery === '' ||
            line.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            line.description?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === 'all' || line.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const getResolutionTypeLabel = (type?: string) => {
        if (!type) return 'Unknown'
        switch (type) {
            case 'hierarchy':
                return 'Org Hierarchy'
            case 'custom':
                return 'Custom Approvers'
            case 'mixed':
                return 'Mixed'
            default:
                return type
        }
    }

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">
                        Configure reusable approval chains for workflows
                    </p>
                    <Button onClick={() => router.push('/governance/approval-lines/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Approval Line
                    </Button>
                </div>

                {/* Search and filters */}
                <div className="flex items-center gap-3">
                    <div className="relative w-64 max-w-[16rem]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search approval lines..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                            setStatusFilter(value as ApprovalLineStatus | 'all')
                        }
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <div className="border rounded-md overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredLines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <GitBranch className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No approval lines found</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Create your first approval line to get started'}
                            </p>
                            {!searchQuery && statusFilter === 'all' && (
                                <Button
                                    className="mt-4"
                                    onClick={() => router.push('/governance/approval-lines/new')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Approval Line
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-2 border-b border-border bg-muted/30">
                                <p className="text-sm text-muted-foreground">
                                    {filteredLines.length} approval line{filteredLines.length !== 1 ? 's' : ''} found
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Stages</TableHead>
                                            <TableHead>Validation</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Version</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLines.map((line) => {
                                            const isSystem = line.id === SYSTEM_REPORTER_APPROVAL_ID || (line as any).isSystemLine === true
                                            return (
                                            <TableRow key={line.id} className={isSystem ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''}>
                                                <TableCell>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            {isSystem && (
                                                                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300">
                                                                    System
                                                                </Badge>
                                                            )}
                                                            <span className="font-medium">{line.name}</span>
                                                        </div>
                                                        {line.description && (
                                                            <div className="text-sm text-muted-foreground line-clamp-1">
                                                                {line.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {line.resolutionType === 'hierarchy' && (
                                                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                        {line.resolutionType === 'custom' && (
                                                            <Users className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                        {line.resolutionType === 'mixed' && (
                                                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                        <span className="text-sm">
                                                            {getResolutionTypeLabel(line.resolutionType)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <span>{line.stageCount || 0} stages</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex items-center gap-2 cursor-help">
                                                                    {line.validation.status === 'valid' ? (
                                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                                    ) : line.validation.status === 'warning' ? (
                                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                                    ) : (
                                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                                    )}
                                                                    <span className={`text-sm ${line.validation.status === 'valid'
                                                                        ? 'text-green-600'
                                                                        : line.validation.status === 'warning'
                                                                            ? 'text-amber-600'
                                                                            : 'text-red-600'
                                                                        }`}>
                                                                        {line.validation.status === 'valid'
                                                                            ? 'Valid'
                                                                            : line.validation.status === 'warning'
                                                                                ? 'Warning'
                                                                                : 'Error'}
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                {line.validation.status === 'valid' ? (
                                                                    <p>All positions are filled and ready to use</p>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <p className="font-medium">
                                                                            {line.validation.errorCount > 0
                                                                                ? `${line.validation.errorCount} error(s)`
                                                                                : `${line.validation.warningCount} warning(s)`}
                                                                        </p>
                                                                        <ul className="text-sm space-y-1">
                                                                            {line.validation.issues.slice(0, 3).map((issue) => (
                                                                                <li key={issue.id} className="flex items-start gap-1">
                                                                                    <span className={issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>•</span>
                                                                                    <span>{issue.message}</span>
                                                                                </li>
                                                                            ))}
                                                                            {line.validation.issues.length > 3 && (
                                                                                <li className="text-muted-foreground">
                                                                                    ...and {line.validation.issues.length - 3} more
                                                                                </li>
                                                                            )}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={statusColors[line.status]} variant="secondary">
                                                        {statusLabels[line.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">v{line.version || 1}</span>
                                                </TableCell>
                                                <TableCell>
                                                    {isSystem ? (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" disabled className="opacity-50">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>System approval lines cannot be edited</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.push(`/governance/approval-lines/${line.id}`)
                                                                }
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {line.status === 'draft' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(line.id, 'active')}
                                                                >
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                            )}
                                                            {line.status === 'active' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(line.id, 'inactive')}
                                                                >
                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                    Deactivate
                                                                </DropdownMenuItem>
                                                            )}
                                                            {line.status === 'inactive' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(line.id, 'active')}
                                                                >
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Reactivate
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(line.id)}
                                                                className="text-destructive"
                                                            >
                                                                <Archive className="mr-2 h-4 w-4" />
                                                                Archive
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
