export interface ExecutiveDashboardData {
    strategicHealth: StrategicHealthScore
    portfolioStatus: PortfolioStatusData
    deliveryVelocity: DeliveryVelocityData
    riskIndex: RiskIndexData
    approvalQueue: ApprovalQueueData
    budgetHealth: BudgetHealthData
    criticalItems: CriticalItemsMatrix
    pendingActions: ExecutiveAction[]
    orgHierarchy: OrgHierarchyNode
    velocityTrend: VelocityTrendData
    milestoneForecasts: MilestoneForecast[]
    scheduledWork: ScheduledWork[]
    workspacePerformance: WorkspacePerformanceData[]
    lastUpdated: Date
}

export interface StrategicHealthScore {
    score: number
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
    components: {
        projectHealth: number
        taskCompletion: number
        resourceUtilization: number
    }
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    historicalScores?: number[]
    componentMetadata?: {
        projectHealth: {
            activeProjects: number
            avgHealthScore: number
        }
        taskCompletion: {
            completedTasks: number
            overdueTasks: number
            completionRate: number
        }
        resourceUtilization: {
            activeUsers: number
            totalUsers: number
            avgTasksPerUser: number
            utilizationRate: number
        }
    }
    details?: {
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

export interface PortfolioStatusData {
    total: number
    byStatus: {
        green: number
        yellow: number
        red: number
    }
    trend: 'up' | 'down' | 'stable'
    trendCount: number
}

export interface DeliveryVelocityData {
    current: number
    periodLabel: string
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
    sparklineData: number[]
}

export interface RiskIndexData {
    level: 'low' | 'medium' | 'high' | 'critical'
    score: number
    trend: 'up' | 'down' | 'stable'
    trendPercentage: number
    breakdown: {
        critical: number
        high: number
        medium: number
        low: number
    }
    riskyProjects?: {
        id: string
        name: string
        priority: string
        status: string
        healthScore: number
    }[]
}

export interface ApprovalQueueData {
    total: number
    urgent: number
    byType: {
        approval: number
        escalation: number
        budgetApproval: number
        blockerResolution: number
    }
    oldestItemDays: number
}

export interface BudgetHealthData {
    percentage: number
    status: 'under' | 'on_budget' | 'over'
    varianceAmount: number
    variancePercentage: number
}

export interface CriticalItem {
    id: string
    type: 'task' | 'approval' | 'escalation' | 'milestone'
    title: string
    urgency: 'urgent' | 'not_urgent'
    importance: 'important' | 'not_important'
    quadrant: 'q1' | 'q2' | 'q3' | 'q4'
    metadata: {
        dueDate?: any
        projectName?: string
        projectId?: string
        workspaceName?: string
        workspaceId?: string
        assignee?: string
        daysPending?: number
        status?: string
    }
}

export interface CriticalItemsMatrix {
    urgentImportant: CriticalItem[]
    urgentNotImportant: CriticalItem[]
    notUrgentImportant: CriticalItem[]
    notUrgentNotImportant: CriticalItem[]
}

export interface ExecutiveAction {
    id: string
    type: 'approval' | 'escalation' | 'decision' | 'review'
    urgency: 'critical' | 'high' | 'medium' | 'low'
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    dueDate?: any
    status: 'pending' | 'completed' | 'not_applicable'
    resourceType: 'project' | 'task' | 'budget' | 'workflow'
    resourceId: string
    requestedBy: string
    requestedAt: any
    metadata?: Record<string, any>
}

export interface OrgHierarchyNode {
    id: string
    type: 'organization' | 'workspace' | 'project'
    name: string
    value: number
    health: 'green' | 'yellow' | 'red'
    healthScore: number
    children?: OrgHierarchyNode[]
    metadata: {
        totalTasks: number
        completedTasks: number
        overdueCount: number
        activeProjects?: number
        progress?: number
        memberIds?: string[]
    }
    [key: string]: any
}

export interface VelocityTrendData {
    historical: { date: string; value: number }[]
    forecast: { date: string; value: number }[]
    averageVelocity: number
}

export interface MilestoneForecast {
    milestoneId: string
    milestoneName: string
    targetDate: Date
    predictedDate: Date
    confidenceLevel: number
    scenarios: {
        optimistic: Date
        mostLikely: Date
        pessimistic: Date
    }
    riskFactors: string[]
}

export interface ScheduledWork {
    id: string
    title: string
    type: 'milestone' | 'project_start' | 'project_end' | 'major_task'
    date: Date
    status: 'on_track' | 'at_risk' | 'delayed'
    projectName: string
    projectId: string
}

export interface WorkspacePerformanceData {
    workspaceId: string
    workspaceName: string
    healthScore: number
    taskVelocity: number
    projectCount: number
    overdueTaskCount: number
}

export interface ExecutiveFilters {
    viewScope: 'organization' | 'my_scope'
    dateRange: {
        start: Date
        end: Date
        label: string
    }
}
