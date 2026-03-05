'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { TaskTemplateService } from '@/lib/services'
import { calculateCriticalPath } from '@/lib/gantt-utils'
import { analyzeMilestones, analyzeBlockers, analyzeVariance } from '@/lib/services/dashboard/analytics'
import type { GeneratedTask } from '@/types/task-template-schema'
import { DashboardThemeWrapper } from './theme/DashboardThemeWrapper'
import { MilestoneBattery } from './widgets/MilestoneBattery'
import { BlockerAnalysis } from './widgets/BlockerAnalysis'
import { CriticalPathMonitor } from './widgets/CriticalPathMonitor'
import { VarianceTable } from './widgets/VarianceTable'
import { Card, CardContent } from '@/components/ui/card'

interface DashboardContainerProps {
  projectId: string
  onTaskClick?: (taskId: string) => void
}

export function DashboardContainer({ projectId, onTaskClick }: DashboardContainerProps) {
  const { companyId, groupId, currentCompany } = useCompany()
  const [tasks, setTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch tasks
  useEffect(() => {
    const loadTasks = async () => {
      if (!companyId || !projectId) return

      try {
        setLoading(true)
        setError(null)
        const projectTasks = await TaskTemplateService.getProjectTasks(companyId, projectId, groupId ?? undefined)
        setTasks(projectTasks)
      } catch (err) {
        console.error('Error loading dashboard tasks:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [companyId, projectId, groupId])

  // Compute metrics using analytics engine
  const metrics = useMemo(() => {
    if (tasks.length === 0) {
      return {
        milestones: [],
        blockers: [],
        criticalTasks: [],
        variances: [],
        totalActive: 0
      }
    }

    // Convert to GanttItem format for CPM
    const ganttItems = tasks.map(t => ({
      id: t.id,
      title: t.title,
      type: 'task' as const,
      dependencies: t.dependencies,
      estimatedHours: t.estimatedHours || 0,
      startDate: t.startDate,
      endDate: t.endDate
    }))

    const criticalPathIds = calculateCriticalPath(ganttItems)
    const criticalTasks = tasks.filter(t => criticalPathIds.has(t.id))
    const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

    return {
      milestones: analyzeMilestones(tasks),
      blockers: analyzeBlockers(tasks),
      criticalTasks,
      variances: analyzeVariance(tasks),
      totalActive: activeTasks.length
    }
  }, [tasks])

  if (loading) {
    return (
      <DashboardThemeWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-muted animate-pulse rounded-lg border" />
          <div className="h-64 bg-muted animate-pulse rounded-lg border" />
          <div className="h-64 bg-muted animate-pulse rounded-lg border" />
          <div className="h-64 bg-muted animate-pulse rounded-lg border" />
        </div>
      </DashboardThemeWrapper>
    )
  }

  if (error) {
    return (
      <DashboardThemeWrapper>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive py-12">
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardThemeWrapper>
    )
  }

  return (
    <DashboardThemeWrapper>
      <div className="">
        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Milestone Battery */}
          <MilestoneBattery milestones={metrics.milestones} />

          {/* Blocker Analysis */}
          <BlockerAnalysis
            blockers={metrics.blockers}
            totalActiveTasks={metrics.totalActive}
            onTaskClick={onTaskClick}
            companyId={companyId ?? undefined}
            companyDomain={currentCompany?.domain ?? undefined}
          />

          {/* Critical Path Monitor */}
          <CriticalPathMonitor criticalTasks={metrics.criticalTasks} />

          {/* Schedule Variance */}
          <VarianceTable variances={metrics.variances} companyId={companyId ?? undefined} companyDomain={currentCompany?.domain ?? undefined} />
        </div>
      </div>
    </DashboardThemeWrapper>
  )
}

