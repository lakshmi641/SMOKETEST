
export type ActivityType =
    | 'workspace_created' | 'workspace_updated'
    | 'project_created' | 'project_updated'
    | 'task_created' | 'task_updated' | 'task_completed' | 'task_assigned' | 'task_escalated'
    | 'subtask_created'
    | 'profile_updated';

export interface Activity {
    id: string;
    companyId: string;
    actorId: string;
    actorName?: string;
    actorAvatar?: string;
    type: ActivityType;
    entityId: string;
    entityType: 'workspace' | 'project' | 'task' | 'user';
    entityName: string;
    recipientId?: string; // e.g., the person assigned to a task
    metadata?: Record<string, any>;
    details?: Record<string, any>; // Alias for metadata used by some services
    timestamp: string;
}
