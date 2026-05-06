import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Category, CategoryKind } from '../types';
import { ZONES, BIKE_CATEGORIES } from '../constants';

const COLLECTION = 'categories';

export async function loadCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => d.data() as Category);
}

// On first run, seeds personnel zones + bike categories from constants.
export async function seedCategoriesIfEmpty(): Promise<Category[]> {
  const existing = await loadCategories();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const seeded: Category[] = [];

  ZONES.forEach((name, i) => {
    const id = `pz_${name.replace(/\s+/g, '_')}_v1`;
    const cat: Category = {
      id,
      kind: 'personnel_zone',
      name,
      active: true,
      order: i,
      createdAt: now,
    };
    batch.set(doc(db, COLLECTION, id), cat);
    seeded.push(cat);
  });

  BIKE_CATEGORIES.forEach((name, i) => {
    const id = `bc_${name.replace(/\s+/g, '_')}_v1`;
    const cat: Category = {
      id,
      kind: 'bike_category',
      name,
      active: true,
      order: i,
      createdAt: now,
    };
    batch.set(doc(db, COLLECTION, id), cat);
    seeded.push(cat);
  });

  await batch.commit();
  return seeded;
}

export async function saveCategory(category: Category): Promise<void> {
  await setDoc(doc(db, COLLECTION, category.id), category);
}

export function filterByKind(categories: Category[], kind: CategoryKind): Category[] {
  return categories
    .filter(c => c.kind === kind)
    .sort((a, b) => a.order - b.order);
}
