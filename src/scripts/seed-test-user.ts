
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
// process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.GCLOUD_PROJECT = 'julley-pms-dev';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'julley-pms-dev'
    });
}

const auth = admin.auth();
const db = admin.firestore();

async function seedTestUser() {
    const companyId = 'test-company-1';
    const email = 'admin@test.com';
    const password = 'password123';

    try {
        console.log('🌱 Seeding test data...');

        // 1. Create Company
        console.log(`Creating company: ${companyId}...`);
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: 'Test Company',
            domain: 'test-company-1.localhost',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // 2. Create Auth User
        let uid = '';
        try {
            const userRecord = await auth.getUserByEmail(email);
            uid = userRecord.uid;
            console.log(`User ${email} already exists (UID: ${uid})`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                const userRecord = await auth.createUser({
                    email,
                    password,
                    displayName: 'Test Admin'
                });
                uid = userRecord.uid;
                console.log(`Created new user: ${email} (UID: ${uid})`);
            } else {
                throw error;
            }
        }

        // 3. Create Company User (link)
        console.log(`Linking user to company...`);
        await db.collection('companies').doc(companyId).collection('users').doc(uid).set({
            uid,
            email,
            role: 'owner', // Give full permissions
            companyId,
            permissions: {
                canManageUsers: true,
                canManageSettings: true,
                canManageWorkflow: true,
            },
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // 4. Create User Profile
        await db.collection('users').doc(uid).set({
            uid,
            email,
            displayName: 'Test Admin',
            currentCompanyId: companyId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log('✅ Seeding complete!');
        console.log(`\ncredentials:\nEmail: ${email}\nPassword: ${password}`);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedTestUser();
