import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  getDocs,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export interface SurveyStatusRecord {
  peano: string;
  status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ';
  updatedAt: number;
  village?: string;
}

const COLLECTION_NAME = 'streetlight_surveys';

/**
 * Real-time listener for all streetlight surveys.
 * Automatically receives updates whenever ANY mobile device makes a change.
 */
export function subscribeToStreetlightSurveys(
  onUpdate: (data: Record<string, { status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ'; updatedAt: number }>) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, COLLECTION_NAME);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const results: Record<string, { status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ'; updatedAt: number }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.peano && data.status) {
          results[data.peano] = {
            status: data.status === 'สำรวจแล้ว' ? 'สำรวจแล้ว' : 'ยังไม่สำรวจ',
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
  status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ',
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
  statuses: Record<string, { status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ'; updatedAt: number; village?: string }>
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
