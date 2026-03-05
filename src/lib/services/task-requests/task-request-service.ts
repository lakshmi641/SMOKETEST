/**
 * Task Request Service
 * 
 * Handles all operations related to cross-workspace task requests.
 * Uses real-time listeners for instant status updates.
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDocs,
    deleteDoc,
    Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TaskRequest, TaskRequestStatus, TaskRequestPriority } from '@/types/task-request-schema'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

export class TaskRequestService {

    /**
     * Create a new task request from one workspace to another
     */
    static async createRequest(params: {
        companyId: string;
        fromWorkspaceId: string;
        fromWorkspaceName: string;
        toWorkspaceId: string;
        toWorkspaceName: string;
        requesterId: string;
        requesterName: string;
        message: string;
        priority: TaskRequestPriority;
        suggestedDueDate?: string;
        groupId?: string;
    }): Promise<string> {
        const { companyId, groupId, ...data } = params;
        const pathSegments = companySubcollectionPathSegments(
            groupId || companyId,
            companyId,
            'task_requests'
        ) as [string, ...string[]];
        const requestsRef = collection(db, ...pathSegments);

        const now = new Date().toISOString();

        const docRef = await addDoc(requestsRef, {
            ...data,
            status: 'pending' as TaskRequestStatus,
            createdAt: now,
            updatedAt: now,
        });

        // Trigger External Notification
        try {
            const { WorkspaceService } = await import('@/lib/services/workspaces/workspace-service');
            const { ExternalNotificationService } = await import('@/lib/services/external-notifications/external-notification-service');

            const recipients = await WorkspaceService.resolveWorkspaceStakeholders(groupId || companyId, companyId, data.toWorkspaceId);

            if (recipients && recipients.length > 0) {
                // Notify each stakeholder
                const notificationPromises = recipients.map(recipientId =>
                    ExternalNotificationService.notifyWorkspaceTaskRequest(
                        companyId,
                        recipientId,
                        params.fromWorkspaceName,
                        params.toWorkspaceName,
                        params.message,
                        params.requesterName,
                        docRef.id,
                        params.toWorkspaceId,
                        params.priority,
                        groupId
                    )
                );
                // Non-blocking wait for notifications
                Promise.allSettled(notificationPromises).then(results => {
                    console.log(`[TaskRequestService] Notification results for ${recipients.length} recipients:`, results);
                });
            }
        } catch (notifyErr) {
            console.error('[TaskRequestService] Failed to send notifications:', notifyErr);
        }

        return docRef.id;
    }

    /**
     * Update request status (Accepted, Task Created, etc.)
     */
    static async updateStatus(params: {
        companyId: string;
        groupId?: string;
        requestId: string;
        status: TaskRequestStatus;
        userId: string;
        userName: string;
        replyNote?: string;
        linkedTaskId?: string;
    }): Promise<void> {
        const { companyId, groupId, requestId, status, userId, userName, replyNote, linkedTaskId } = params;
        const pathSegments = companySubcollectionPathSegments(
            groupId || companyId,
            companyId,
            'task_requests'
        ) as [string, ...string[]];
        const requestRef = doc(db, ...pathSegments, requestId);

        const updates: any = {
            status,
            updatedAt: new Date().toISOString(),
        };

        if (status === 'accepted') {
            updates.acceptedBy = userId;
            updates.acceptedByName = userName;
            updates.acceptedAt = new Date().toISOString();
        } else if (status === 'task_created') {
            updates.completedBy = userId;
            updates.completedByName = userName;
            updates.completedAt = new Date().toISOString();
            if (linkedTaskId) updates.linkedTaskId = linkedTaskId;
        }

        if (replyNote) {
            updates.replyNote = replyNote;
        }

        await updateDoc(requestRef, updates);
    }

    /**
     * Subscribe to requests for a workspace (Real-time)
     */
    static subscribeWorkspaceRequests(
        companyId: string,
        workspaceId: string,
        type: 'incoming' | 'outgoing',
        onUpdate: (requests: TaskRequest[]) => void,
        groupId?: string
    ) {
        const pathSegments = companySubcollectionPathSegments(
            groupId || companyId,
            companyId,
            'task_requests'
        ) as [string, ...string[]];
        const requestsRef = collection(db, ...pathSegments);
        const field = type === 'incoming' ? 'toWorkspaceId' : 'fromWorkspaceId';

        const q = query(
            requestsRef,
            where(field, '==', workspaceId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TaskRequest));
            onUpdate(requests);
        }, (error) => {
            console.error(`Error subscribing to ${type} requests:`, error);
        });
    }

    /**
     * Delete/Archive a request
     */
    static async deleteRequest(companyId: string, requestId: string, groupId?: string): Promise<void> {
        const pathSegments = companySubcollectionPathSegments(
            groupId || companyId,
            companyId,
            'task_requests'
        ) as [string, ...string[]];
        const requestRef = doc(db, ...pathSegments, requestId);
        await updateDoc(requestRef, {
            status: 'archived',
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Permanent delete (Admin only)
     */
    static async hardDeleteRequest(companyId: string, requestId: string, groupId?: string): Promise<void> {
        const pathSegments = companySubcollectionPathSegments(
            groupId || companyId,
            companyId,
            'task_requests'
        ) as [string, ...string[]];
        const requestRef = doc(db, ...pathSegments, requestId);
        await deleteDoc(requestRef);
    }
}
