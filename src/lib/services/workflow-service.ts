import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { OutboxEvent } from '../../types/workflow-schema';
import { companySubcollectionPathSegments } from '../firestore-paths';

/**
 * Workflow Service
 * Handles interaction with the Flowable Workflow Engine via the Transactional Outbox pattern.
 * Instead of calling Flowable directly, we write events to the 'outbox' collection.
 * Cloud Functions then process these events and call Flowable securely.
 */
export const WorkflowService = {
    /**
     * Start a new workflow process instance
     * @param companyId The current company/tenant ID
     * @param processKey The process definition key (e.g., 'expense-approval')
     * @param businessKey Analysis/Entity ID to link the process to (e.g., project ID)
     * @param variables Process variables to start with
     */
    startProcess: async (
        companyId: string,
        processKey: string,
        businessKey?: string,
        variables: Record<string, any> = {},
        resourceType: 'project' | 'task' | 'budget' | 'document' | 'custom' = 'custom',
        groupId?: string
    ): Promise<string> => {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'outbox');
            const outboxRef = collection(db, segments[0], ...segments.slice(1));
            const docRef = await addDoc(outboxRef, {
                eventType: 'START_PROCESS',
                companyId,
                payload: {
                    processDefinitionKey: processKey,
                    businessKey,
                    resourceId: businessKey, // Usually the taskId
                    resourceType,
                    tenantId: companyId,
                    variables,
                },
                status: 'PENDING',
                createdAt: serverTimestamp(),
                retryCount: 0,
            } as OutboxEvent);

            return docRef.id;
        } catch (error) {
            console.error('Error starting workflow process:', error);
            throw error;
        }
    },

    /**
     * Complete a user task
     * @param companyId The current company/tenant ID
     * @param taskId The Flowable Task ID
     * @param variables Variables to update/submit with the task completion
     */
    completeTask: async (
        companyId: string,
        taskId: string,
        variables: Record<string, any> = {},
        groupId?: string
    ): Promise<string> => {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'outbox');
            const outboxRef = collection(db, segments[0], ...segments.slice(1));
            const docRef = await addDoc(outboxRef, {
                eventType: 'COMPLETE_TASK',
                companyId,
                payload: {
                    taskId,
                    variables,
                },
                status: 'PENDING',
                createdAt: serverTimestamp(),
                retryCount: 0,
            } as OutboxEvent);

            return docRef.id;
        } catch (error) {
            console.error('Error completing workflow task:', error);
            throw error;
        }
    },

    /**
     * Cancel a running process instance
     * @param companyId The current company/tenant ID
     * @param processInstanceId The Process Instance ID to cancel
     * @param reason Reason for cancellation
     */
    cancelProcess: async (
        companyId: string,
        processInstanceId: string,
        reason: string,
        groupId?: string
    ): Promise<string> => {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'outbox');
            const outboxRef = collection(db, segments[0], ...segments.slice(1));
            const docRef = await addDoc(outboxRef, {
                eventType: 'CANCEL_PROCESS',
                companyId,
                payload: {
                    processInstanceId,
                    reason,
                },
                status: 'PENDING',
                createdAt: serverTimestamp(),
                retryCount: 0,
            } as OutboxEvent);

            return docRef.id;
        } catch (error) {
            console.error('Error cancelling workflow process:', error);
            throw error;
        }
    }
    ,

    /**
     * Deploy a workflow definition to the engine
     * @param companyId The current company/tenant ID
     * @param workflowId The internal workspace workflow ID
     */
    deployWorkflow: async (
        companyId: string,
        workflowId: string,
        groupId?: string
    ): Promise<string> => {
        try {
            const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'outbox');
            const outboxRef = collection(db, segments[0], ...segments.slice(1));
            const docRef = await addDoc(outboxRef, {
                eventType: 'DEPLOY_WORKFLOW',
                companyId,
                payload: {
                    workflowId,
                    tenantId: companyId
                },
                status: 'PENDING',
                createdAt: serverTimestamp(),
                retryCount: 0,
            } as OutboxEvent);

            return docRef.id;
        } catch (error) {
            console.error('Error deploying workflow:', error);
            throw error;
        }
    }
};
