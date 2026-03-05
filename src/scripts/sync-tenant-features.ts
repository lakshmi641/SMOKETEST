import { initializeApp, getApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.local') });

const app = getApps().length === 0
    ? initializeApp({
        projectId: 'julley-platform-dev',
    })
    : getApp();

const db = getFirestore(app);

async function syncTenantFeatures() {
    const tenantId = 'greensecure-pms';
    const tenantsRef = db.collection('tenants').doc(tenantId);
    const companiesRef = db.collection('companies').doc(tenantId);

    console.log(`Syncing features for tenant/company ID: ${tenantId}...`);

    const featureUpdates = {
        'features': {
            'projectManagement': true,
            'taskManagement': true,
            'workflowAutomation': true,
            'resourceManagement': true,
            'financialTracking': true,
            'advancedReporting': true,
            'fileManagement': true,
            'timeTracking': true,
            'customFields': true,
            'directApprovals': true,
            'escalationPaths': true,
            'approvalInbox': true
        },
        'status': 'active',
        'updatedAt': new Date().toISOString()
    };

    try {
        const batch = db.batch();

        // Use set with merge to ensure the structure is exactly what we want (a Map)
        // and doesn't conflict with any legacy Array fields if they exist
        batch.set(tenantsRef, featureUpdates, { merge: true });
        batch.set(companiesRef, featureUpdates, { merge: true });

        await batch.commit();

        console.log('✅ Synchronized features for both tenants and companies collections.');
        console.log(`   Tenant ID: ${tenantId}`);
        console.log('   Applied Features: projectManagement, taskManagement, workflowAutomation, etc.');
    } catch (error) {
        console.error('❌ Failed to sync features:', error);
    }
}

syncTenantFeatures().catch(console.error);
