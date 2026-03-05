import { Storage } from '@google-cloud/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from apps/pms/.env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

async function setupCORS() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'julley-pms-dev';

    if (!projectId) {
        console.error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID in environment variables');
        process.exit(1);
    }

    console.log(`Setting up CORS for bucket: ${bucketName} in project: ${projectId}`);

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    let storage;
    if (clientEmail && privateKey) {
        console.log('Using Service Account credentials...');
        storage = new Storage({
            projectId,
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
        });
    } else {
        console.log('Using Default Application Credentials...');
        storage = new Storage({
            projectId: projectId,
        });
    }

    const corsConfiguration = [
        {
            origin: [
                '*',
                'http://localhost:3000',
                'http://autocracy.localhost:3000',
                'https://julley-platform-dev.web.app',
                'https://julley-platform-dev.firebaseapp.com'
            ],
            method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
            responseHeader: ['Content-Type', 'Authorization', 'x-goog-resumable', 'Content-Length', 'User-Agent'],
            maxAgeSeconds: 3600,
        },
    ];

    try {
        await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
        console.log(`✅ CORS configuration updated successfully for ${bucketName}!`);
    } catch (error: any) {
        console.error('❌ Failed to update CORS configuration:', error.message);
        if (error.message.includes('Could not load the default credentials')) {
            console.log('\nTip: Try running "gcloud auth application-default login" or ensure you have a service account key configured.');
        }
        process.exit(1);
    }
}

setupCORS();
