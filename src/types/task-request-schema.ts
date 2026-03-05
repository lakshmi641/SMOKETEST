/**
 * Task Request Schema
 * 
 * Defines the structure for cross-workspace task requests.
 * Used for manual task creation workflows between workspaces.
 */

import { Timestamp } from 'firebase/firestore';

export type TaskRequestStatus = 'pending' | 'accepted' | 'task_created' | 'rejected' | 'archived';
export type TaskRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskRequest {
    id: string;
    companyId: string;

    // Requester Info (Workspace A)
    fromWorkspaceId: string;
    fromWorkspaceName: string;
    requesterId: string;
    requesterName: string;

    // Target Info (Workspace B)
    toWorkspaceId: string;
    toWorkspaceName: string;

    // Request Content
    message: string;      // Detailed task description provided by requester
    priority: TaskRequestPriority;
    suggestedDueDate?: string; // ISO string or human-readable

    // Workflow State
    status: TaskRequestStatus;

    // Tracking (Filled as it moves through states)
    acceptedBy?: string;    // User ID who accepted the request
    acceptedByName?: string;
    acceptedAt?: string;    // ISO string

    completedBy?: string;   // User ID who marked as task created
    completedByName?: string;
    completedAt?: string;   // ISO string

    linkedTaskId?: string;  // Optional: ID of the manually created task
    replyNote?: string;     // Optional: Note from receiver when accepting/completing

    // Metadata
    createdAt: string;      // ISO string for frontend, will use serverTimestamp for safety
    updatedAt: string;      // ISO string
}

/**
 * Filter options for task requests
 */
export interface TaskRequestFilters {
    type: 'incoming' | 'outgoing';
    status?: TaskRequestStatus;
    priority?: TaskRequestPriority;
}
