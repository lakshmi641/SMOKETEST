/**
 * Firestore Indexes for Recurring Tasks
 * Deploy these using: firebase deploy --only firestore:indexes
 * 
 * Or merge into your root firestore.indexes.json file
 */

export const RECURRING_TASKS_FIRESTORE_INDEXES = {
    indexes: [
        // Index 1: Query due configs for scheduler
        // Query: companies/{companyId}/workspaceRecurringConfigs
        //        WHERE status == 'active' AND nextRunAt <= NOW
        //        ORDER BY nextRunAt ASC
        {
            collectionGroup: 'workspaceRecurringConfigs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'companyId', order: 'ASCENDING' },
                { fieldPath: 'status', order: 'ASCENDING' },
                { fieldPath: 'nextRunAt', order: 'ASCENDING' },
            ],
        },

        // Index 2: Query workspace configs by status
        // Query: companies/{companyId}/workspaceRecurringConfigs
        //        WHERE workspaceId == X AND status == 'active'
        {
            collectionGroup: 'workspaceRecurringConfigs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'workspaceId', order: 'ASCENDING' },
                { fieldPath: 'status', order: 'ASCENDING' },
            ],
        },

        // Index 3: Query project configs by status
        // Query: companies/{companyId}/workspaceRecurringConfigs
        //        WHERE projectId == X AND status == 'active'
        {
            collectionGroup: 'workspaceRecurringConfigs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'projectId', order: 'ASCENDING' },
                { fieldPath: 'status', order: 'ASCENDING' },
            ],
        },

        // Index 4: Query active configs by company
        // Query: companies/{companyId}/workspaceRecurringConfigs
        //        WHERE companyId == X AND isActive == true
        //        ORDER BY nextRunAt ASC
        {
            collectionGroup: 'workspaceRecurringConfigs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'companyId', order: 'ASCENDING' },
                { fieldPath: 'isActive', order: 'ASCENDING' },
                { fieldPath: 'nextRunAt', order: 'ASCENDING' },
            ],
        },

        // Index 5: Query execution logs by config (for history)
        // Query: companies/{companyId}/recurringTaskExecutionLogs
        //        WHERE configId == X
        //        ORDER BY createdAt DESC
        {
            collectionGroup: 'recurringTaskExecutionLogs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'configId', order: 'ASCENDING' },
                { fieldPath: 'createdAt', order: 'DESCENDING' },
            ],
        },

        // Index 6: Idempotency check for execution logs
        // Query: companies/{companyId}/recurringTaskExecutionLogs
        //        WHERE configId == X AND scheduledDate == 'YYYY-MM-DD'
        {
            collectionGroup: 'recurringTaskExecutionLogs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'configId', order: 'ASCENDING' },
                { fieldPath: 'scheduledDate', order: 'ASCENDING' },
            ],
        },

        // Index 7: Query failed logs by workspace
        // Query: companies/{companyId}/recurringTaskExecutionLogs
        //        WHERE workspaceId == X AND status == 'failed'
        //        ORDER BY createdAt DESC
        {
            collectionGroup: 'recurringTaskExecutionLogs',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'workspaceId', order: 'ASCENDING' },
                { fieldPath: 'status', order: 'ASCENDING' },
                { fieldPath: 'createdAt', order: 'DESCENDING' },
            ],
        },

        // Index 8: Idempotency check for generated tasks
        // Query: companies/{companyId}/tasks
        //        WHERE metadata.recurringConfigId == X 
        //          AND metadata.scheduledDate == 'YYYY-MM-DD'
        {
            collectionGroup: 'tasks',
            queryScope: 'COLLECTION',
            fields: [
                { fieldPath: 'metadata.recurringConfigId', order: 'ASCENDING' },
                { fieldPath: 'metadata.scheduledDate', order: 'ASCENDING' },
            ],
        },
    ],
    fieldOverrides: [],
}

// Export as JSON string for copying to firestore.indexes.json
export const RECURRING_TASKS_INDEXES_JSON = JSON.stringify(
    RECURRING_TASKS_FIRESTORE_INDEXES,
    null,
    2
)
