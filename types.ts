export type Language = 'ua' | 'en' | 'nl';
export type Theme = 'light' | 'dark';
export type SyncProvider = 'google' | 'microsoft';

export interface AppSettings {
  language: Language;
  theme: Theme;
  vibration: boolean;
  webhookUrl: string;
  microsoftWebhookUrl: string;
  microsoftWorkbookUrl: string;
  syncProvider: SyncProvider;
  adminPassword: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export type Tab = 'personnel' | 'bikes' | 'office' | 'history' | 'settings';

export interface RecordItem {
  id: string;
  label: string;
  count: number | string; // string used for "-" in office
  timestamp: string;
}

export interface Zone {
  id: string;
  name: string;       // display name, e.g. "20"
  isLimited: boolean; // true = only LIMITED_OFFICE_ITEMS
  active: boolean;    // false = archived (replaced by a new version)
  createdAt: string;
}

export type CategoryKind = 'personnel_zone' | 'bike_category';

export interface Category {
  id: string;
  kind: CategoryKind;
  name: string;
  active: boolean;
  order: number;     // for stable display order
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  type: 'personnel' | 'bikes' | 'office';
  summary: string;
  details: any;
  room?: string;
  zoneId?: string;   // office entries: Firestore zone doc id
  zoneName?: string; // snapshot of zone name at time of entry
  images?: string[]; // Base64 strings
  syncedToExcel?: boolean;
  syncedAt?: string | null;
}

export interface OfficeData {
  room: string;
  items: Record<string, number | string>;
}
