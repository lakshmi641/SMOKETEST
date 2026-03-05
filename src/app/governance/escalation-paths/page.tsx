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
import { useEscalationPathsQuery, useEscalationPathMutations } from '@/hooks/queries/useGovernanceQueries'
import { EscalationPathStatus } from '@/types/approval-line-schema'
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Archive,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Bell,
    Loader2,
    Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'

const statusColors: Record<EscalationPathStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    inactive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const statusLabels: Record<EscalationPathStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived',
}

export default function EscalationPathsPage() {
    const router = useRouter()
    const { companyId, groupId } = useCompany()
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<EscalationPathStatus | 'all'>('all')

    const { data: escalationPaths = [], isLoading: loading } = useEscalationPathsQuery(companyId, groupId)
    const { updateStatus, archive } = useEscalationPathMutations(companyId, groupId)

    const handleStatusChange = (escalationPathId: string, newStatus: EscalationPathStatus) => {
        toast.promise(
            updateStatus.mutateAsync({ id: escalationPathId, status: newStatus }),
            {
                loading: 'Updating status...',
                success: `Escalation path ${statusLabels[newStatus].toLowerCase()}`,
                error: 'Failed to update status',
            }
        )
    }

    const handleDelete = (escalationPathId: string) => {
        if (!confirm('Are you sure you want to archive this escalation path?')) return

        toast.promise(
            archive.mutateAsync(escalationPathId),
            {
                loading: 'Archiving...',
                success: 'Escalation path archived',
                error: 'Failed to archive escalation path',
            }
        )
    }

    const filteredPaths = escalationPaths.filter((path) => {
        const matchesSearch =
            searchQuery === '' ||
            path.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            path.description?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === 'all' || path.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const getResolutionTypeLabel = (type: string) => {
        switch (type) {
            case 'hierarchy':
                return 'Org Hierarchy'
            case 'custom':
                return 'Custom Targets'
            case 'mixed':
                return 'Mixed'
            default:
                return type
        }
    }

    const getFinalActionLabel = (action: string) => {
        switch (action) {
            case 'auto_approve':
                return 'Auto Approve'
            case 'auto_reject':
                return 'Auto Reject'
            case 'notify_admin':
                return 'Notify Admin'
            case 'cancel':
                return 'Cancel'
            case 'none':
                return 'None'
            default:
                return action
        }
    }

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">
                        Configure escalation rules for overdue approvals
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => router.push('/governance/escalation-paths/new?template=true')}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            From Template
                        </Button>
                        <Button onClick={() => router.push('/governance/escalation-paths/new')}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Escalation Path
                        </Button>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex items-center gap-3">
                    <div className="relative w-64 max-w-[16rem]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search escalation paths..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                            setStatusFilter(value as EscalationPathStatus | 'all')
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
                    ) : filteredPaths.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No escalation paths found</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Create your first escalation path to get started'}
                            </p>
                            {!searchQuery && statusFilter === 'all' && (
                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push('/governance/escalation-paths/new?template=true')}
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        From Template
                                    </Button>
                                    <Button onClick={() => router.push('/governance/escalation-paths/new')}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create New
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-2 border-b border-border bg-muted/30">
                                <p className="text-sm text-muted-foreground">
                                    {filteredPaths.length} escalation path{filteredPaths.length !== 1 ? 's' : ''} found
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Rules</TableHead>
                                            <TableHead>Validation</TableHead>
                                            <TableHead>Final Action</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPaths.map((path) => (
                                            <TableRow key={path.id}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{path.name}</div>
                                                        {path.description && (
                                                            <div className="text-sm text-muted-foreground line-clamp-1">
                                                                {path.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">
                                                        {getResolutionTypeLabel(path.resolutionType || 'custom')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Bell className="h-4 w-4 text-muted-foreground" />
                                                        <span>{path.ruleCount || 0} rules</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex items-center gap-2 cursor-help">
                                                                    {path.validation.status === 'valid' ? (
                                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                                    ) : path.validation.status === 'warning' ? (
                                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                                    ) : (
                                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                                    )}
                                                                    <span className={`text-sm ${
                                                                        path.validation.status === 'valid'
                                                                            ? 'text-green-600'
                                                                            : path.validation.status === 'warning'
                                                                            ? 'text-amber-600'
                                                                            : 'text-red-600'
                                                                    }`}>
                                                                        {path.validation.status === 'valid'
                                                                            ? 'Valid'
                                                                            : path.validation.status === 'warning'
                                                                            ? 'Warning'
                                                                            : 'Error'}
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                {path.validation.status === 'valid' ? (
                                                                    <p>All targets are valid and ready to use</p>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <p className="font-medium">
                                                                            {path.validation.errorCount > 0
                                                                                ? `${path.validation.errorCount} error(s)`
                                                                                : `${path.validation.warningCount} warning(s)`}
                                                                        </p>
                                                                        <ul className="text-sm space-y-1">
                                                                            {path.validation.issues.slice(0, 3).map((issue) => (
                                                                                <li key={issue.id} className="flex items-start gap-1">
                                                                                    <span className={issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>•</span>
                                                                                    <span>{issue.message}</span>
                                                                                </li>
                                                                            ))}
                                                                            {path.validation.issues.length > 3 && (
                                                                                <li className="text-muted-foreground">
                                                                                    ...and {path.validation.issues.length - 3} more
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
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">
                                                            {getFinalActionLabel(path.finalAction || 'none')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={statusColors[path.status]} variant="secondary">
                                                        {statusLabels[path.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.push(`/governance/escalation-paths/${path.id}`)
                                                                }
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {path.status === 'draft' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(path.id, 'active')}
                                                                >
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                            )}
                                                            {path.status === 'active' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(path.id, 'inactive')}
                                                                >
                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                    Deactivate
                                                                </DropdownMenuItem>
                                                            )}
                                                            {path.status === 'inactive' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleStatusChange(path.id, 'active')}
                                                                >
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Reactivate
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(path.id)}
                                                                className="text-destructive"
                                                            >
                                                                <Archive className="mr-2 h-4 w-4" />
                                                                Archive
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
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
