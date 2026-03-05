'use client'

/**
 * Recurring Task List Component
 * Displays list of recurring tasks with filters and search
 */

import React, { useState } from 'react'
import { Plus, Search, Filter, LayoutGrid, List, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkspaceRecurringConfig } from '@/types/recurring-task-schema'
import { RecurringTaskCard } from './RecurringTaskCard'
import { RecurringTaskTable } from './RecurringTaskTable'
import { RecurringTaskDetailDialog } from './RecurringTaskDetailDialog'
import { cn } from '@/lib/utils'

interface RecurringTaskListProps {
    configs: WorkspaceRecurringConfig[]
    onCreateNew?: () => void
    onEdit?: (config: WorkspaceRecurringConfig) => void
    onView?: (config: WorkspaceRecurringConfig) => void
    onToggle?: (config: WorkspaceRecurringConfig) => void
    onArchive?: (config: WorkspaceRecurringConfig) => void
    onUnarchive?: (config: WorkspaceRecurringConfig) => void
    onRunNow?: (config: WorkspaceRecurringConfig) => void
    onDelete?: (config: WorkspaceRecurringConfig) => void
    onResolveGhost?: (config: WorkspaceRecurringConfig) => void
    onImport?: () => void
    users?: { id: string; name: string; position?: string }[]
    projects?: { id: string; name: string; projectCode?: string }[]
    isLoading?: boolean
}

export function RecurringTaskList({
    configs,
    onCreateNew,
    onEdit,
    onView,
    onToggle,
    onArchive,
    onUnarchive,
    onRunNow,
    onDelete,
    onResolveGhost,
    onImport,
    users = [],
    projects = [],
    isLoading,
}: RecurringTaskListProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'ghosted' | 'archived'>('all')
    const [viewingConfig, setViewingConfig] = useState<WorkspaceRecurringConfig | null>(null)
    const [viewMode, setViewMode] = useState<'card' | 'table'>('table') // Default to table as requested

    // Filter configs
    const filteredConfigs = configs.filter((config) => {
        // Search filter
        const matchesSearch =
            searchQuery === '' ||
            config.taskDefinition.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            config.taskDefinition.description?.toLowerCase().includes(searchQuery.toLowerCase())

        // Status filter
        let matchesStatus = true
        if (statusFilter === 'all') {
            matchesStatus = config.status !== 'archived'
        } else if (statusFilter === 'active') {
            matchesStatus = config.isActive && config.status === 'active'
        } else if (statusFilter === 'paused') {
            matchesStatus = (!config.isActive && config.status !== 'archived') || config.status === 'paused'
        } else if (statusFilter === 'ghosted') {
            matchesStatus = config.status === 'ghosted'
        } else if (statusFilter === 'archived') {
            matchesStatus = config.status === 'archived'
        }

        return matchesSearch && matchesStatus
    })

    // Count by status
    const statusCounts = {
        all: configs.filter(c => c.status !== 'archived').length,
        active: configs.filter(c => c.isActive && c.status === 'active').length,
        paused: configs.filter(c => (!c.isActive && c.status !== 'archived') || c.status === 'paused').length,
        ghosted: configs.filter(c => c.status === 'ghosted').length,
        archived: configs.filter(c => c.status === 'archived').length,
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-muted-foreground">
                        Manage automated recurring task configurations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {onImport && (
                        <Button variant="outline" onClick={onImport} className="gap-2 border-slate-200">
                            <FileSpreadsheet className="h-4 w-4" />
                            Import
                        </Button>
                    )}
                    {onCreateNew && (
                        <Button onClick={onCreateNew} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Recurring Task
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search recurring tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 border-slate-200 focus:ring-primary/20"
                    />
                </div>

                {/* View Toggles */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <Button
                        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn("h-8 w-8 p-0", viewMode === 'table' && "bg-white shadow-sm border border-slate-200")}
                        onClick={() => setViewMode('table')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn("h-8 w-8 p-0", viewMode === 'card' && "bg-white shadow-sm border border-slate-200")}
                        onClick={() => setViewMode('card')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>

                {/* Status Tabs */}
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <TabsList>
                        <TabsTrigger value="all">
                            All ({statusCounts.all})
                        </TabsTrigger>
                        <TabsTrigger value="active">
                            Active ({statusCounts.active})
                        </TabsTrigger>
                        <TabsTrigger value="paused">
                            Paused ({statusCounts.paused})
                        </TabsTrigger>
                        <TabsTrigger value="ghosted" className={statusCounts.ghosted > 0 ? "text-red-600 font-bold" : ""}>
                            Ghosted ({statusCounts.ghosted})
                        </TabsTrigger>
                        <TabsTrigger value="archived">
                            Archived ({statusCounts.archived})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Cards Grid */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
                    ))}
                </div>
            ) : filteredConfigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                        <Filter className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No recurring tasks found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {searchQuery
                            ? 'Try adjusting your search or filters'
                            : 'Get started by creating your first recurring task'}
                    </p>
                    {onCreateNew && !searchQuery && (
                        <Button onClick={onCreateNew} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Recurring Task
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {viewMode === 'card' ? (
                        <div className="space-y-4">
                            {filteredConfigs.map((config) => (
                                <RecurringTaskCard
                                    key={config.id}
                                    config={config}
                                    users={users}
                                    projects={projects}
                                    onEdit={onEdit}
                                    onView={(c) => {
                                        setViewingConfig(c)
                                        onView?.(c)
                                    }}
                                    onToggle={onToggle}
                                    onArchive={onArchive}
                                    onUnarchive={onUnarchive}
                                    onRunNow={onRunNow}
                                    onDelete={onDelete}
                                    onResolveGhost={onResolveGhost}
                                />
                            ))}
                        </div>
                    ) : (
                        <RecurringTaskTable
                            configs={filteredConfigs}
                            users={users}
                            projects={projects}
                            onEdit={onEdit}
                            onView={(c) => {
                                setViewingConfig(c)
                                onView?.(c)
                            }}
                            onRunNow={onRunNow}
                            onDelete={onDelete}
                            onToggle={onToggle}
                            onArchive={onArchive}
                            onUnarchive={onUnarchive}
                        />
                    )}
                </div>
            )}
            {/* Detail Dialog */}
            <RecurringTaskDetailDialog
                open={!!viewingConfig}
                onOpenChange={(open) => !open && setViewingConfig(null)}
                config={viewingConfig}
                onEdit={onEdit}
                users={users}
                projects={projects}
            />
        </div>
    )
}
