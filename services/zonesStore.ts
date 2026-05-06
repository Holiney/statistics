import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Zone } from '../types';
import { OFFICE_ROOMS, LIMITED_ROOMS } from '../constants';

const COLLECTION = 'zones';

export async function loadZones(): Promise<Zone[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const zones: Zone[] = snap.docs.map(d => d.data() as Zone);
  return zones;
}

// Called on first app load. If no zones exist in Firestore, seeds from constants.
export async function seedZonesIfEmpty(): Promise<Zone[]> {
  const existing = await loadZones();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const batch = writeBatch(db);

  const seeded: Zone[] = OFFICE_ROOMS.map(name => {
    const id = `room_${name}_v1`;
    const zone: Zone = {
      id,
      name,
      isLimited: LIMITED_ROOMS.includes(name),
      active: true,
      createdAt: now,
    };
    batch.set(doc(db, COLLECTION, id), zone);
    return zone;
  });

  await batch.commit();
  return seeded;
}

export async function saveZone(zone: Zone): Promise<void> {
  await setDoc(doc(db, COLLECTION, zone.id), zone);
}
