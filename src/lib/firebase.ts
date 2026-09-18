import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { RecloserLog, StreetlightSurveyStatusType, RecloserWorkStatusType } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore directly with the provisioned database ID per integration specification
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SurveyStatusRecord {
  peano: string;
  status: StreetlightSurveyStatusType;
  updatedAt: number;
  village?: string;
}

const COLLECTION_NAME = 'streetlight_surveys';
const RECLOSER_COLLECTION = 'recloser_logs';

/**
 * Real-time listener for all streetlight surveys.
 * Automatically receives updates whenever ANY mobile device makes a change.
 */
export function subscribeToStreetlightSurveys(
  onUpdate: (data: Record<string, { status: StreetlightSurveyStatusType; updatedAt: number }>) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, COLLECTION_NAME);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const results: Record<string, { status: StreetlightSurveyStatusType; updatedAt: number }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.peano && data.status) {
          const validStatus: StreetlightSurveyStatusType =
            data.status === 'สำรวจแล้ว' || data.status === 'กำลังดำเนินการ'
              ? data.status
              : 'ยังไม่สำรวจ';
          results[data.peano] = {
            status: validStatus,
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
          };
        }
      });
      onUpdate(results);
    },
    (err) => {
      if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, COLLECTION_NAME);
      }
      console.warn('[Firebase] Firestore onSnapshot operating in cached/offline state:', err?.message || err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Updates status for a single transformer in Firestore Cloud Database.
 * This instantly broadcasts to all other devices.
 */
export async function setTransformerSurveyStatus(
  peano: string,
  status: StreetlightSurveyStatusType,
  village?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, peano);
    const updatedAt = Date.now();
    await setDoc(
      docRef,
      {
        peano,
        status,
        updatedAt,
        ...(village ? { village } : {})
      },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${peano}`);
    }
    console.warn('[Firebase] Warning setting survey status, falling back to local storage:', err?.message || err);
    throw err;
  }
}

/**
 * Batch updates or initializes multiple survey records in Firestore.
 */
export async function bulkSetTransformerSurveyStatuses(
  statuses: Record<string, { status: StreetlightSurveyStatusType; updatedAt: number; village?: string }>
): Promise<void> {
  const entries = Object.entries(statuses);
  if (entries.length === 0) return;

  try {
    // Firestore batch limit is 500 operations per batch
    const BATCH_SIZE = 400;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const [peano, item] of chunk) {
        const docRef = doc(db, COLLECTION_NAME, peano);
        batch.set(
          docRef,
          {
            peano,
            status: item.status,
            updatedAt: item.updatedAt || Date.now(),
            ...(item.village ? { village: item.village } : {})
          },
          { merge: true }
        );
      }

      await batch.commit();
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTION_NAME);
    }
    console.warn('[Firebase] Warning bulk updating statuses:', err?.message || err);
    throw err;
  }
}

// ==========================================
// RECLOSER WORK COLLECTION & SYNC METHODS
// ==========================================
export const RECLOSER_WORK_COLLECTION = 'recloser_work';

/**
 * Real-time listener for Recloser Work status.
 * Automatically synchronizes across all mobile field devices.
 */
export function subscribeToRecloserWorkSurveys(
  onUpdate: (data: Record<string, { status: RecloserWorkStatusType; updatedAt: number }>) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, RECLOSER_WORK_COLLECTION);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const results: Record<string, { status: RecloserWorkStatusType; updatedAt: number }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.peano && data.status) {
          const validStatus: RecloserWorkStatusType =
            data.status === 'กำลังดำเนินการ' || data.status === 'ดำเนินการเสร็จสิ้น'
              ? data.status
              : 'ยังไม่ดำเนินการ';
          results[data.peano] = {
            status: validStatus,
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()
          };
        }
      });
      onUpdate(results);
    },
    (err) => {
      if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, RECLOSER_WORK_COLLECTION);
      }
      console.warn('[Firebase] Recloser Work onSnapshot operating in cached/offline state:', err?.message || err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Updates status for a single transformer in Recloser Work.
 */
export async function setRecloserWorkStatus(
  peano: string,
  status: RecloserWorkStatusType,
  village?: string
): Promise<void> {
  try {
    const docRef = doc(db, RECLOSER_WORK_COLLECTION, peano);
    const updatedAt = Date.now();
    await setDoc(
      docRef,
      {
        peano,
        status,
        updatedAt,
        ...(village ? { village } : {})
      },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `${RECLOSER_WORK_COLLECTION}/${peano}`);
    }
    console.warn('[Firebase] Warning setting recloser work status:', err?.message || err);
    throw err;
  }
}

/**
 * Batch updates or initializes multiple Recloser Work records.
 */
export async function bulkSetRecloserWorkStatuses(
  statuses: Record<string, { status: RecloserWorkStatusType; updatedAt: number; village?: string }>
): Promise<void> {
  const entries = Object.entries(statuses);
  if (entries.length === 0) return;

  try {
    const BATCH_SIZE = 400;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const [peano, item] of chunk) {
        const docRef = doc(db, RECLOSER_WORK_COLLECTION, peano);
        batch.set(
          docRef,
          {
            peano,
            status: item.status,
            updatedAt: item.updatedAt || Date.now(),
            ...(item.village ? { village: item.village } : {})
          },
          { merge: true }
        );
      }

      await batch.commit();
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, RECLOSER_WORK_COLLECTION);
    }
    console.warn('[Firebase] Warning bulk updating recloser work statuses:', err?.message || err);
    throw err;
  }
}


/**
 * Test connectivity to Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, limit(1));
    await getDocs(q);
    return true;
  } catch (err: any) {
    // If not found or permission check, connection reached server
    if (
      err?.code === 'unavailable' ||
      err?.message?.includes('offline') ||
      err?.message?.includes('could not be completed')
    ) {
      return false;
    }
    return true;
  }
}

/**
 * Fetch all Recloser logs from Firestore Cloud Database.
 * Called on application startup / opening tab without keeping a heavy continuous stream.
 */
export async function fetchRecloserLogsFromFirestore(): Promise<RecloserLog[]> {
  try {
    const colRef = collection(db, RECLOSER_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const logs: RecloserLog[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as RecloserLog;
      if (data && data.id && data.recloserId) {
        logs.push(data);
      }
    });
    return logs;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.GET, RECLOSER_COLLECTION);
    }
    console.warn('[Firebase] Note: Firestore fetch not available, using offline cache:', err?.message || err);
    throw err;
  }
}

/**
 * Save a new or updated Recloser log to Firestore Cloud Database.
 * Triggered on user record action.
 */
export async function saveRecloserLogToFirestore(log: RecloserLog): Promise<void> {
  try {
    const docRef = doc(db, RECLOSER_COLLECTION, log.id);
    await setDoc(docRef, log, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `${RECLOSER_COLLECTION}/${log.id}`);
    }
    console.error('[Firebase] Error saving recloser log to Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Delete a Recloser log from Firestore Cloud Database.
 */
export async function deleteRecloserLogFromFirestore(logId: string): Promise<void> {
  try {
    const docRef = doc(db, RECLOSER_COLLECTION, logId);
    await deleteDoc(docRef);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.DELETE, `${RECLOSER_COLLECTION}/${logId}`);
    }
    console.error('[Firebase] Error deleting recloser log from Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Delete multiple Recloser logs from Firestore Cloud Database in a single batch.
 */
export async function deleteBatchRecloserLogsFromFirestore(logIds: string[]): Promise<void> {
  if (!logIds || logIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of logIds) {
      const docRef = doc(db, RECLOSER_COLLECTION, id);
      batch.delete(docRef);
    }
    await batch.commit();
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, RECLOSER_COLLECTION);
    }
    console.error('[Firebase] Error batch deleting recloser logs from Firestore:', err?.message || err);
    throw err;
  }
}

/**
 * Seeds demo or local recloser logs to Firestore if Cloud is empty.
 */
export async function seedInitialRecloserLogsToFirestore(initialLogs: RecloserLog[]): Promise<void> {
  if (!initialLogs || initialLogs.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const log of initialLogs) {
      const docRef = doc(db, RECLOSER_COLLECTION, log.id);
      batch.set(docRef, log, { merge: true });
    }
    await batch.commit();
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, RECLOSER_COLLECTION);
    }
    console.warn('[Firebase] Error seeding initial recloser logs:', err?.message || err);
  }
}

