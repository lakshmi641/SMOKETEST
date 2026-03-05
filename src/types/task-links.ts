/**
 * Task Link Relationship Types
 * Based on Jira/Linear patterns
 */
export type TaskLinkType =
    | 'blocks'           // This task blocks another
    | 'is_blocked_by'    // This task is blocked by another
    | 'clones'           // This task clones another
    | 'is_cloned_by'     // This task is cloned by another
    | 'duplicates'       // This task duplicates another
    | 'is_duplicated_by' // This task is duplicated by another
    | 'relates_to'       // General relationship

/**
 * Task Link Document Structure
 * Stored in companies/{companyId}/taskLinks/{linkId}
 */
export interface TaskLink {
    id: string
    companyId: string
    sourceTaskId: string      // "From" task ID
    targetTaskId: string      // "To" task ID
    sourceProjectId: string   // Cached for security rules
    targetProjectId: string   // Cached for security rules
    linkType: TaskLinkType
    createdBy: string         // User ID
    createdAt: string         // ISO timestamp
}

/**
 * Recently Viewed Task Record
 * Stored in companies/{companyId}/recentlyViewedTasks/{viewId}
 */
export interface RecentlyViewedTask {
    id: string
    companyId: string
    userId: string
    taskId: string
    taskNumber: string
    projectCode: string
    projectId: string         // For access checks
    title: string
    viewedAt: string         // ISO timestamp
}

/**
 * Enriched Task Link with display details
 */
export interface TaskLinkWithDetails extends TaskLink {
    relatedTaskId: string
    relatedProjectId: string
    targetTask: {
        taskNumber: string
        projectCode: string
        title: string
        status: string
        assignedToName?: string
    }
}
