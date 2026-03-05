export interface TaskTimeEntry {
    id: string
    taskId: string
    projectId: string
    companyId: string
    date: string // ISO date string (YYYY-MM-DD)
    duration: number // Decimal hours (e.g., 1.5)
    notes?: string
    loggedBy: string // User ID
    loggedByName: string // Cached for display
    createdAt: string
    updatedAt: string
}
