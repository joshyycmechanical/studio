
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Import getStorage

const firebaseConfig = {
  // Ensure these environment variables are correctly set in your .env or .env.local file
  // and are prefixed with NEXT_PUBLIC_ to be available on the client-side.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Initialize Firebase app, auth, db, and storage instances to null by default.
let app: FirebaseApp | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;
let storageInstance: ReturnType<typeof getStorage> | null = null; // Declare storageInstance
let firebaseInitializationError: string | null = null;

// Basic check to see if essential variables are loaded and not placeholders
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR_')) {
  firebaseInitializationError =
    "Firebase config API Key is missing or is a placeholder. " +
    "Check your environment variables (e.g., .env or .env.local file) and ensure NEXT_PUBLIC_FIREBASE_API_KEY is correctly set.";
  console.error(firebaseInitializationError);
} else if (!firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.storageBucket) {
  firebaseInitializationError = "Firebase config is missing essential fields (authDomain, projectId, or storageBucket). Check your environment variables.";
  console.error(firebaseInitializationError);
} else {
  // Only attempt initialization if essential config seems present
  try {
      // Initialize Firebase
      // Use getApps() to check if Firebase has already been initialized.
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
      storageInstance = getStorage(app); // Initialize Storage
      console.log("Firebase initialized successfully (including Storage).");
  } catch (error: any) {
      firebaseInitializationError = `Firebase initialization failed: ${error.message}`;
      console.error(firebaseInitializationError, error);
      app = null;
      authInstance = null;
      dbInstance = null;
      storageInstance = null; // Ensure storageInstance is null on error
  }
}


// Export the initialized instances or null if initialization failed
export { app, authInstance as auth, dbInstance as db, storageInstance as storage, firebaseInitializationError };
