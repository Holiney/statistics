import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { HistoryEntry } from '../types';

const COLLECTION = 'history';

export async function loadAllHistory(): Promise<HistoryEntry[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const items: HistoryEntry[] = snap.docs.map(d => d.data() as HistoryEntry);
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  await setDoc(doc(db, COLLECTION, entry.id), entry);
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function clearAllHistory(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}
