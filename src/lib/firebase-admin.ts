/**
 * Firebase Admin SDK initialization for server-side operations
 * This is used in API routes to perform admin operations like creating users
 */

import * as admin from 'firebase-admin'

let adminApp: admin.app.App | null = null

interface FirebaseAdminCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

/**
 * Get Firebase Admin credentials from environment variables
 * Returns null during build time when env vars are not available
 */
function getFirebaseAdminCredentials(): FirebaseAdminCredentials | null {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  // During Vercel build, env vars may not be available
  // Return null instead of throwing to allow build to complete
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin SDK credentials not available (expected during build)')
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

/**
 * Initialize Firebase Admin SDK
 * This should only be called in server-side contexts (API routes, server components)
 * Returns null during build time when credentials are not available
 */
export function getFirebaseAdmin(): admin.app.App | null {
  if (adminApp) {
    return adminApp
  }

  // Check if already initialized in global scope (prevents "app already exists" error during hot reload)
  if (admin.apps.length > 0) {
    adminApp = admin.app()
    return adminApp
  }

  try {
    const credentials = getFirebaseAdminCredentials()

    // Return null during build time when credentials are not available
    if (!credentials) {
      return null
    }

    let privateKey = credentials.privateKey
    // Remove surrounding quotes if present (common issue with .env files)
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }

    // Replace escaped newlines in private key
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n')

    // Get storage bucket from environment variable
    // Use FIREBASE_STORAGE_BUCKET (GCS bucket name) or fallback to project-based name
    // Don't use NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as it's in firebasestorage.app format
    // which is for client-side Firebase SDK, not Admin SDK
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.GCS_BUCKET_NAME ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${credentials.projectId}.appspot.com`

    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: formattedPrivateKey,
      }),
      projectId: credentials.projectId,
      storageBucket: storageBucket,
    })

    console.log('✓ Firebase Admin SDK initialized')
    return adminApp
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error)
    throw new Error(`Failed to initialize Firebase Admin SDK: ${(error as Error).message}`)
  }
}

/**
 * Get Firebase Admin Auth instance
 * Returns a Proxy that throws only when accessed, allowing top-level calls during build
 */
export function getAdminAuth(): admin.auth.Auth {
  const app = getFirebaseAdmin()
  if (!app) {
    // Return a proxy that will throw if any property/method is accessed
    // This allows the build to import and reference the function without crashing
    return new Proxy({} as admin.auth.Auth, {
      get: (_, prop) => {
        throw new Error(`Firebase Admin Auth is not available. Missing credentials. Prop: ${String(prop)}`)
      },
    })
  }
  return app.auth()
}

/**
 * Get Firebase Admin Firestore instance
 * Returns a Proxy that throws only when accessed, allowing top-level calls during build
 */
export function getAdminFirestore(): admin.firestore.Firestore {
  const app = getFirebaseAdmin()
  if (!app) {
    // Return a proxy that will throw if any property/method is accessed
    // This allows the build to import and reference the function without crashing
    return new Proxy({} as admin.firestore.Firestore, {
      get: (_, prop) => {
        throw new Error(`Firebase Admin Firestore is not available. Missing credentials. Prop: ${String(prop)}`)
      },
    })
  }
  return app.firestore()
}

/**
 * Verify an ID token from the client
 * Returns the decoded token if valid
 */
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    const auth = getAdminAuth()
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken
  } catch (error) {
    console.error('Error verifying ID token:', error)
    throw new Error(`Invalid or expired authentication token: ${(error as Error).message}`)
  }
}

