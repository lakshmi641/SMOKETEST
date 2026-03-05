'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { TaskApprovalService } from '@/lib/services/tasks/task-approval-service'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { useExecutiveFilters } from '@/hooks/useExecutiveFilters'
import { useExecutiveDashboardData } from '@/hooks/useExecutiveDashboardData'
import { ExecutiveHeader } from './ExecutiveHeader'
import { ExecutiveContextBar } from './ExecutiveContextBar'
import { StrategicHealthCard } from './widgets/StrategicHealthCard'
import { PortfolioStatusCard } from './widgets/PortfolioStatusCard'
import { DeliveryVelocityCard } from './widgets/DeliveryVelocityCard'
import { RiskIndexCard } from './widgets/RiskIndexCard'
import { ApprovalQueueCard } from './widgets/ApprovalQueueCard'
import { OrgTreemap } from './widgets/OrgTreemap'
import { CriticalItemsMatrix } from './widgets/CriticalItemsMatrix'
import { PendingActionsPanel } from './widgets/PendingActionsPanel'
import { VelocityForecastChart } from './widgets/VelocityForecastChart'
import { MilestonePredictions } from './widgets/MilestonePredictions'
import { ScheduledWorkPanel } from './widgets/ScheduledWorkPanel'
import { DrillDownSheet } from './drill-down/DrillDownSheet'
import { useDrillDown } from '@/hooks/useDrillDown'
import { Card } from '@/components/ui/card'
import { toast } from 'react-hot-toast'
import type { ExecutiveAction } from '@/types/executive-dashboard'
import type { OrgHierarchyNode } from '@/types'

import { RiskDetailsDialog } from './drill-down/RiskDetailsDialog'
import { StrategicHealthDialog } from './drill-down/StrategicHealthDialog'
import CeoAgentDrawer from '../ceo-agent/CeoAgentDrawer'

export function ExecutiveDashboard() {
    const { user } = useAuthStore()
    const { companyId, groupId } = useCompany()
    const { viewScope, dateRange, setViewScope, setDateRange } = useExecutiveFilters()
    const drillDown = useDrillDown()
    const router = useRouter()
    const [isRiskDialogOpen, setIsRiskDialogOpen] = React.useState(false)
    const [isStrategicHealthDialogOpen, setIsStrategicHealthDialogOpen] = React.useState(false)
    const [isAgentDrawerOpen, setIsAgentDrawerOpen] = React.useState(false)

    // ... existing handlers ...
    const handleApprove = async (id: string) => {
        const action = data?.pendingActions.find(a => a.id === id)
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
        const action = data?.pendingActions.find(a => a.id === id)
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

        // Primary route: Direct task navigation (works for both approvals and escalations)
        if (projectId && taskId) {
            router.push(`/projects/${projectId}/tasks/${taskId}`)
        }
        // Fallback for approval instances without task context
        else if (instanceId) {
            router.push(`/approvals?instance=${instanceId}`)
        }
        // Final fallback for escalations without project context
        else if (action.type === 'escalation' && action.resourceId) {
            router.push(`/tasks/${action.resourceId}`)
        }
    }

    const findNodeById = (node: OrgHierarchyNode | undefined, id: string | null): OrgHierarchyNode | null => {
        if (!node || !id) return null
        if (node.id === id) return node
        if (node.children) {
            for (const child of node.children) {
                const found = findNodeById(child, id)
                if (found) return found
            }
        }
        return null
    }


    const { data, isLoading, error, refresh, hasNewData } = useExecutiveDashboardData({
        groupId: groupId ?? undefined,
        companyId: companyId || '',
        userId: user?.id || '',
        viewScope,
        dateRange
    })

    const hierarchyData = findNodeById(data?.orgHierarchy, drillDown.selectedId)
    const activeData = drillDown.level === 'matrix' ? drillDown.selectedData : hierarchyData

    if (!companyId || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Initializing...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6">
                <h2 className="text-xl font-semibold text-red-600">Error Loading Dashboard</h2>
                <p className="text-muted-foreground mt-2">{error.message}</p>
                <button
                    onClick={() => refresh()}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
                >
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col gap-6 w-full min-h-0 overflow-y-auto scrollbar-ultrathin">
            {/* Header */}
            <ExecutiveHeader
                lastUpdated={data?.lastUpdated}
                onRefresh={refresh}
                isRefreshing={isLoading}
                hasNewData={hasNewData}
                data={data}
                onOpenAgent={() => setIsAgentDrawerOpen(true)}
            />

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .dashboard-card { break-inside: avoid; border: 1px solid #eee !important; }
                    body { background: white !important; }
                    .max-w-\\[1600px\\] { max-width: 100% !important; padding: 0 !important; }
                    .grid { gap: 1rem !important; }
                }
            `}</style>

            {/* Context Bar */}
            <ExecutiveContextBar
                userId={user.id}
                viewScope={viewScope}
                onViewScopeChange={setViewScope}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            />

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                <StrategicHealthCard
                    data={data?.strategicHealth}
                    isLoading={isLoading}
                    onClick={() => setIsStrategicHealthDialogOpen(true)}
                />
                <PortfolioStatusCard data={data?.portfolioStatus} isLoading={isLoading} />
                <DeliveryVelocityCard data={data?.deliveryVelocity} isLoading={isLoading} />
                {/* <RiskIndexCard
                    data={data?.riskIndex}
                    isLoading={isLoading}
                    onClick={() => setIsRiskDialogOpen(true)}
                /> */}
                <ApprovalQueueCard data={data?.approvalQueue} isLoading={isLoading} />
            </div>

            {/* <RiskDetailsDialog
                isOpen={isRiskDialogOpen}
                onClose={() => setIsRiskDialogOpen(false)}
                projects={data?.riskIndex.riskyProjects || []}
            /> */}

            {/* Phase 2: Hierarchy Mapping */}
            <div className="grid grid-cols-1 gap-4">
                <OrgTreemap
                    data={data?.orgHierarchy}
                    isLoading={isLoading}
                    onNodeClick={(node) => {
                        if (node.type === 'workspace') {
                            router.push(`/workspaces/${node.id}`)
                        } else if (node.type === 'project') {
                            router.push(`/projects/${node.id}`)
                        }
                    }}
                />
            </div>

            {/* Drill-Down Panel */}
            <DrillDownSheet
                isOpen={drillDown.isOpen}
                onClose={drillDown.close}
                level={drillDown.level}
                selectedId={drillDown.selectedId}
                selectedName={drillDown.selectedName}
                selectedData={activeData}
                breadcrumb={drillDown.breadcrumb}
                onNavigate={drillDown.navigateTo}
                onProjectClick={(id, name) => {
                    const workspaceContext = drillDown.level === 'workspace'
                        ? { id: drillDown.selectedId || '', name: drillDown.selectedName || '' }
                        : undefined
                    drillDown.openProject(id, name, workspaceContext)
                }}
            />

            {/* Phase 3: Action Center */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CriticalItemsMatrix
                    items={data?.criticalItems || {
                        urgentImportant: [],
                        urgentNotImportant: [],
                        notUrgentImportant: [],
                        notUrgentNotImportant: []
                    }}
                    isLoading={isLoading}
                    onQuadrantClick={(id) => {
                        const quadrantMap: Record<string, { name: string, items: any[] }> = {
                            q1: { name: 'Urgent & Important', items: data?.criticalItems.urgentImportant || [] },
                            q2: { name: 'Urgent (Immediate Review)', items: data?.criticalItems.urgentNotImportant || [] },
                            q3: { name: 'Important (Needs Attention)', items: data?.criticalItems.notUrgentImportant || [] },
                            q4: { name: 'Neither (Monitor Only)', items: data?.criticalItems.notUrgentNotImportant || [] }
                        }
                        const quadrant = quadrantMap[id]
                        if (quadrant) {
                            drillDown.openMatrixQuadrant(id, quadrant.name, quadrant.items)
                        }
                    }}
                />
                <PendingActionsPanel
                    actions={data?.pendingActions || []}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onView={handleViewAction}
                    onViewHistory={() => router.push('/executive-dashboard/pending-actions')}
                    isLoading={isLoading}
                />
            </div>

            {/* Phase 4 & 5: Analytics & Roadmap */}
            <div className="grid grid-cols-1 gap-6">
                <VelocityForecastChart
                    data={data?.velocityTrend}
                    isLoading={isLoading}
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <ScheduledWorkPanel
                    items={data?.scheduledWork}
                    isLoading={isLoading}
                />
            </div>

            <StrategicHealthDialog
                isOpen={isStrategicHealthDialogOpen}
                onClose={() => setIsStrategicHealthDialogOpen(false)}
                data={data?.strategicHealth.details}
            />

            <CeoAgentDrawer
                isOpen={isAgentDrawerOpen}
                onClose={() => setIsAgentDrawerOpen(false)}
            />
        </div>
    )
}
