import type { FastifyRequest } from 'fastify';
import { COLLECTIONS } from '../config/collections.js';
import { getDb } from '../firestore/admin.js';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

export interface ApiHealthSummary {
  ok: boolean;
  service: 'sip-editor-api';
  timestamp: string;
  checks: {
    firebaseAdmin: 'ok' | 'error';
    firestorePing: 'ok' | 'error';
    collections: 'ok' | 'error';
  };
}

export interface ApiHealthDetails extends ApiHealthSummary {
  requestId: string;
  environment: {
    nodeEnv: string;
    hasFirebaseJson: boolean;
    firebaseProjectId: string | null;
  };
  diagnostics: {
    firestoreLatencyMs: number | null;
    collections: string[];
    errors: string[];
  };
}

export async function buildHealthDetails(
  request: FastifyRequest,
  env: {
    nodeEnv: string;
    hasFirebaseJson: boolean;
    firebaseProjectId: string | null;
  }
): Promise<ApiHealthDetails> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  let firebaseAdmin: 'ok' | 'error' = 'ok';
  let firestorePing: 'ok' | 'error' = 'ok';
  let collections: 'ok' | 'error' = 'ok';
  let latency: number | null = null;

  try {
    const db = getDb();
    const started = Date.now();
    await withTimeout(db.collection(COLLECTIONS.PROJECTS).limit(1).get(), 2000);
    latency = Date.now() - started;
    const names = [COLLECTIONS.PROJECTS, COLLECTIONS.PROJECT_VERSIONS];
    for (const name of names) {
      await withTimeout(db.collection(name).limit(1).get(), 2000);
    }
  } catch (error) {
    firebaseAdmin = 'error';
    firestorePing = 'error';
    collections = 'error';
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const ok = firebaseAdmin === 'ok' && firestorePing === 'ok' && collections === 'ok';
  return {
    ok,
    service: 'sip-editor-api',
    timestamp: now,
    requestId: request.sipRequestId,
    checks: { firebaseAdmin, firestorePing, collections },
    environment: env,
    diagnostics: {
      firestoreLatencyMs: latency,
      collections: [COLLECTIONS.PROJECTS, COLLECTIONS.PROJECT_VERSIONS],
      errors,
    },
  };
}

