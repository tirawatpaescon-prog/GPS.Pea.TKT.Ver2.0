import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
  writeBatch,
  getDocFromServer,
  query,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { RecloserLog, StreetlightSurveyStatusType } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

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
      console.warn('[Firebase] Firestore onSnapshot subscription error:', err);
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
}

/**
 * Batch updates or initializes multiple survey records in Firestore.
 */
export async function bulkSetTransformerSurveyStatuses(
  statuses: Record<string, { status: StreetlightSurveyStatusType; updatedAt: number; village?: string }>
): Promise<void> {
  const entries = Object.entries(statuses);
  if (entries.length === 0) return;

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
}

/**
 * Test connectivity to Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    return true;
  } catch (err: any) {
    // If permission or not found, it still proved connection reached Firestore server
    if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
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
  } catch (err) {
    console.warn('[Firebase] Error fetching recloser logs from Firestore:', err);
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
  } catch (err) {
    console.error('[Firebase] Error saving recloser log to Firestore:', err);
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
  } catch (err) {
    console.error('[Firebase] Error deleting recloser log from Firestore:', err);
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
  } catch (err) {
    console.error('[Firebase] Error batch deleting recloser logs from Firestore:', err);
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
  } catch (err) {
    console.warn('[Firebase] Error seeding initial recloser logs:', err);
  }
}

