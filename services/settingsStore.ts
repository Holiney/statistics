import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings } from '../types';

const DOC_PATH = ['app', 'globalSettings'];

// Fields that should be shared across all devices (admin-controlled).
// Per-device UI prefs (theme, language, vibration) are intentionally excluded.
export type GlobalSettings = Pick<AppSettings,
  'webhookUrl' | 'microsoftWebhookUrl' | 'microsoftWorkbookUrl' | 'syncProvider' | 'adminPassword'
>;

export const GLOBAL_KEYS: (keyof GlobalSettings)[] = [
  'webhookUrl',
  'microsoftWebhookUrl',
  'microsoftWorkbookUrl',
  'syncProvider',
  'adminPassword',
];

export async function loadGlobalSettings(): Promise<Partial<GlobalSettings> | null> {
  const snap = await getDoc(doc(db, DOC_PATH[0], DOC_PATH[1]));
  if (!snap.exists()) return null;
  return snap.data() as Partial<GlobalSettings>;
}

export async function saveGlobalSettings(settings: AppSettings): Promise<void> {
  const payload: Partial<GlobalSettings> = {};
  for (const k of GLOBAL_KEYS) {
    payload[k] = settings[k] as any;
  }
  await setDoc(doc(db, DOC_PATH[0], DOC_PATH[1]), payload, { merge: true });
}
