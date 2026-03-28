import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let app: App | null = null;

function initFromEnv(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      }),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp();
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }

  return initializeApp();
}

export function getFirebaseApp(): App {
  if (!app) {
    app = initFromEnv();
  }
  return app;
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

export function getStorageBucket() {
  const appInstance = getFirebaseApp();
  const explicit = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const fromProject = process.env.FIREBASE_PROJECT_ID?.trim();
  /** Firebase Console по умолчанию даёт бакет `*.firebasestorage.app`; legacy — `*.appspot.com`. */
  const bucketName =
    explicit || (fromProject ? `${fromProject}.firebasestorage.app` : undefined);
  return getStorage(appInstance).bucket(bucketName);
}
