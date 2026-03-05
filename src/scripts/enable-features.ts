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

async function enableFeatures() {
    const tenantId = 'greensecure-pms';
    const tenantRef = db.collection('tenants').doc(tenantId);

    console.log(`Updating features for tenant: ${tenantId}...`);

    // Update the features map to ensure all required fields are true
    await tenantRef.update({
        'features.projectManagement': true,
        'features.taskManagement': true,
        'features.workflowAutomation': true,
        'features.resourceManagement': true,
        'features.financialTracking': true,
        'features.advancedReporting': true
    });

    console.log('✅ Features enabled successfully for Greensecure.');
}

enableFeatures().catch(console.error);
