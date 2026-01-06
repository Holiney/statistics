import { Language } from './types';

export const APP_VERSION = 'v1.22';

// --- Lists ---

export const ZONES = [
  'Zone 220', 'Zone 230', 'Zone 240', 'Zone 250', 'Zone 260', 'Zone 440', 'Zone 520'
];

export const BIKE_CATEGORIES = [
  'Kinderzitje', 'Buitenformaat', 'Op te hangen', 'Op te laden', 
  'Steps', 'Standaardfietsen', 'MPA', 'MV', '6A'
];

export const OFFICE_ROOMS = [
  '20', '30', '40', '50', '140', '162', '170', '220', '250', '340', '422', '463'
];

export const LIMITED_ROOMS = ['20', '30', '40'];

// Full list of items sorted naturally
export const OFFICE_ITEMS = [
  'EK 1', 'EK 2', 'EK 3', 'EK 4', 'EK 5', 'EK 6', 
  'EK 7 A', 'EK 7 B', 'EK 7 C', 
  'EK 8 A', 'EK 8 B', 'EK 8 C', 
  'EK 9 A', 'EK 9 B', 'EK 9 C', 
  'EK 10 A', 'EK 10 B', 
  'EK 11 A', 'EK 11 B', 
  'EK 12', 'EK 13', 'EK 14', 'EK 15', 'EK 16', 'EK 17', 'EK 18', 'EK 19'
];

// Configuration for input ranges
export const OFFICE_ITEM_TYPES: Record<string, string> = {
  'EK 1': '0-5', 'EK 2': '0-5',
  'EK 3': '0-10', 'EK 4': '0-10',
  'EK 5': '0-100', 'EK 6': '0-100',
  'EK 7 A': '0-20', 'EK 7 B': '0-20', 'EK 7 C': '0-20',
  'EK 8 A': '0-5', 'EK 8 B': '0-5', 'EK 8 C': '0-5',
  'EK 9 A': '0-5', 'EK 9 B': '0-5', 'EK 9 C': '0-5',
  'EK 10 A': '0-10', 'EK 10 B': '0-20',
  'EK 11 A': '0-1', 'EK 11 B': '0-1',
  'EK 12': '0-1', 'EK 13': '0-1', 'EK 14': '0-1', 'EK 15': '0-1',
  'EK 16': '0-1', 'EK 17': '0-1', 'EK 18': '0-1', 'EK 19': '0-1'
};

// Limited rooms get specific items (EK 13 - EK 18)
export const LIMITED_OFFICE_ITEMS = [
  'EK 13', 'EK 14', 'EK 15', 'EK 16', 'EK 17', 'EK 18'
];

// --- Translations ---

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    personnel: 'Personnel',
    bikes: 'Bikes',
    office: 'Office',
    history: 'History',
    settings: 'Settings',
    zones: 'Zones',
    cars: 'Cars',
    parking: 'Total Parking',
    copy: 'Copy',
    copied: 'Copied to clipboard!',
    share: 'Share',
    shareText: 'Text',
    sharePhotos: 'Photos',
    sharing: 'Sharing...',
    save: 'Save',
    submit: 'Submit Cloud',
    submitting: 'Sending...',
    success: 'Saved Successfully',
    error: 'Error Saving',
    selectRoom: 'Select Room',
    selectItem: 'Select Item',
    vibration: 'Haptic Feedback',
    theme: 'Dark Mode',
    language: 'Language',
    webhook: 'API URL',
    noHistory: 'No history yet',
    clearHistory: 'Clear History',
    items: 'items',
    synced: 'Synced',
    local: 'Local',
    confirmClear: 'Are you sure?',
    officeNote: 'Office Supply Log',
    installApp: 'Install App',
    installDesc: 'Add to home screen for quick access',
    install: 'Install',
    later: 'Later',
  },
  ua: {
    personnel: 'Персонал',
    bikes: 'Велосипеди',
    office: 'Канцелярія',
    history: 'Історія',
    settings: 'Налаштування',
    zones: 'Зони',
    cars: 'Авто',
    parking: 'Всього авто',
    copy: 'Копіювати',
    copied: 'Скопійовано!',
    share: 'Поділитись',
    shareText: 'Текст',
    sharePhotos: 'Фото',
    sharing: 'Відкриваю...',
    save: 'Зберегти',
    submit: 'Google ☁️',
    submitting: 'Надсилання...',
    success: 'Успішно збережено',
    error: 'Помилка збереження',
    selectRoom: 'Оберіть кімнату',
    selectItem: 'Оберіть товар',
    vibration: 'Вібрація',
    theme: 'Темна тема',
    language: 'Мова',
    webhook: 'API URL',
    noHistory: 'Історія порожня',
    clearHistory: 'Очистити історію',
    items: 'товарів',
    synced: 'Синхр.',
    local: 'Локально',
    confirmClear: 'Ви впевнені?',
    officeNote: 'Облік канцелярії',
    installApp: 'Встановити додаток',
    installDesc: 'Додати на головний екран',
    install: 'Встановити',
    later: 'Пізніше',
  },
  nl: {
    personnel: 'Personeel',
    bikes: 'Fietsen',
    office: 'Kantoor',
    history: 'Geschiedenis',
    settings: 'Instellingen',
    zones: 'Zones',
    cars: 'Auto\'s',
    parking: 'Totaal parkeren',
    copy: 'Kopiëren',
    copied: 'Gekopieerd!',
    share: 'Delen',
    shareText: 'Tekst',
    sharePhotos: 'Fotos',
    sharing: 'Delen...',
    save: 'Opslaan',
    submit: 'Cloud Sync',
    submitting: 'Verzenden...',
    success: 'Succesvol opgeslagen',
    error: 'Fout bij opslaan',
    selectRoom: 'Selecteer kamer',
    selectItem: 'Selecteer item',
    vibration: 'Trilling',
    theme: 'Donkere modus',
    language: 'Taal',
    webhook: 'API URL',
    noHistory: 'Nog geen geschiedenis',
    clearHistory: 'Geschiedenis wissen',
    items: 'items',
    synced: 'Gesynct',
    local: 'Lokaal',
    confirmClear: 'Weet u het zeker?',
    officeNote: 'Kantoorartikelen log',
    installApp: 'App installeren',
    installDesc: 'Toevoegen aan startscherm',
    install: 'Installeren',
    later: 'Later',
  }
};