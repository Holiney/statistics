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

export interface HistoryEntry {
  id: string;
  date: string;
  type: 'personnel' | 'bikes' | 'office';
  summary: string;
  details: any;
  room?: string;
  images?: string[]; // Base64 strings
  synced?: boolean;
}

export interface OfficeData {
  room: string;
  items: Record<string, number | string>;
}
