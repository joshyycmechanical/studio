
import admin from 'firebase-admin';

let adminInitializationError: Error | null = null;

try {
  if (!admin.apps.length) {
    console.log('[Admin SDK Init] Initializing Firebase Admin SDK...');
    
    let serviceAccount: any;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('[Admin SDK Init] Found FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      console.warn('[Admin SDK Init] FIREBASE_SERVICE_ACCOUNT_KEY not set. Falling back to local serviceAccountKey.json file.');
      // This fallback is for local development. Ensure you have serviceAccountKey.json in the root directory.
      // IMPORTANT: Add serviceAccountKey.json to your .gitignore file to prevent committing it.
      try {
        serviceAccount = require('../../../keys/serviceAccountKey.json');
      } catch (e: any) {
        throw new Error('Failed to load service account from local file. Please ensure serviceAccountKey.json exists in the project root or set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
      }
    }

    if (!serviceAccount) {
      throw new Error('Service account credentials are not available.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('[Admin SDK Init] Firebase Admin SDK initialized successfully.');

  } else {
    console.log('[Admin SDK Init] Firebase Admin SDK was already initialized.');
  }
} catch (e: any) {
  console.error('[Admin SDK Init] CRITICAL: Failed to initialize Firebase Admin SDK.');
  console.error(`[Admin SDK Init] Error Message: ${e.message}`);
  adminInitializationError = e;
}

export const authAdmin = adminInitializationError ? null : admin.auth();
export const dbAdmin = adminInitializationError ? null : admin.firestore();
export { adminInitializationError };
