// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, Messaging, isSupported } from "firebase/messaging";
import { getFunctions } from "firebase/functions";
import { initializeSharedServices } from "@julley/shared-services";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Build-safe Firebase service getters
 * These return real instances but handle build-time SSR cases safely.
 * Services like Firestore, Storage, and Functions need real instances
 * because their SDK functions (e.g. collection(), ref(), httpsCallable())
 * perform type checks or access internal properties that Proxies break.
 */

export function getAuthInstance() {
  try {
    return getAuth(app);
  } catch (error) {
    if (typeof window === 'undefined') {
      console.warn('Auth accessed during build but failed to initialize');
      return undefined as any;
    }
    console.error('Error getting Auth instance:', error);
    throw new Error('Auth is not properly initialized');
  }
}

export function getFirestoreInstance() {
  try {
    return getFirestore(app);
  } catch (error) {
    if (typeof window === 'undefined') {
      console.warn('Firestore accessed during build but failed to initialize');
      return undefined as any;
    }
    console.error('Error getting Firestore instance:', error);
    throw new Error('Firestore is not properly initialized');
  }
}

export function getStorageInstance() {
  try {
    return getStorage(app);
  } catch (error) {
    if (typeof window === 'undefined') {
      console.warn('Storage accessed during build but failed to initialize');
      return undefined as any;
    }
    console.error('Error getting Storage instance:', error);
    throw new Error('Storage is not properly initialized');
  }
}

export function getFunctionsInstance() {
  try {
    return getFunctions(app, 'us-central1');
  } catch (error) {
    if (typeof window === 'undefined') {
      console.warn('Functions accessed during build but failed to initialize');
      return undefined as any;
    }
    console.error('Error getting Functions instance:', error);
    throw new Error('Functions is not properly initialized');
  }
}

// Export real instances
export const auth = getAuthInstance();
export const db = getFirestoreInstance();
export const storage = getStorageInstance();
export const functions = getFunctionsInstance();

// Initialize shared services so @julley/shared-services can use the same Firebase instances
try {
  if (db && auth) {
    initializeSharedServices(db, auth, functions);
  }
} catch {
  // During build time, this may fail — that's OK
}

// Lazy initialization of Firebase Cloud Messaging
// Messaging must be initialized after service worker is registered
let messaging: Messaging | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

/**
 * Initialize Firebase Cloud Messaging lazily
 * Call this after service worker is registered
 */
export async function initializeMessaging(): Promise<Messaging | null> {
  // Only initialize in browser
  if (typeof window === "undefined") {
    return null;
  }

  // Return existing instance if already initialized
  if (messaging) {
    return messaging;
  }

  // Return existing promise if initialization is in progress
  if (messagingPromise) {
    return messagingPromise;
  }

  // Create new initialization promise
  messagingPromise = (async () => {
    try {
      // Check if messaging is supported
      const isMessagingSupported = await isSupported();
      if (!isMessagingSupported) {
        console.warn("Firebase Messaging is not supported in this environment");
        return null;
      }

      // Initialize messaging
      messaging = getMessaging(app);
      console.log("Firebase Messaging initialized successfully");
      return messaging;
    } catch (error) {
      console.warn("Firebase Messaging initialization error:", error);
      return null;
    }
  })();

  return messagingPromise;
}

/**
 * Get the messaging instance (lazy initialization)
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) {
    return messaging;
  }
  return await initializeMessaging();
}

// Export messaging for backward compatibility (will be null until initialized)
export { messaging };

// Helper to get messaging token (for use in services)
export const getMessagingToken = async (): Promise<string | null> => {
  const messagingInstance = await getMessagingInstance();

  if (!messagingInstance) {
    console.warn("Messaging is not available");
    return null;
  }

  try {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VAPID key is not configured. Push notifications may not work.");
      return null;
    }

    const currentToken = await getToken(messagingInstance, { vapidKey });
    if (currentToken) {
      console.log("FCM registration token:", currentToken);
      return currentToken;
    } else {
      console.log("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while retrieving token:", error);
    return null;
  }
};

// Helper to listen for foreground messages
export const onMessageListener = async (): Promise<any> => {
  const messagingInstance = await getMessagingInstance();

  if (!messagingInstance) {
    return Promise.reject(new Error("Messaging is not available"));
  }

  return new Promise((resolve) => {
    onMessage(messagingInstance, (payload) => {
      console.log("Message received in foreground:", payload);
      resolve(payload);
    });
  });
};

export default app;
