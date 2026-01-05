import React, { useState, useEffect } from 'react';
import { UsersRound, Bike, Package, History as HistoryIcon, Settings as SettingsIcon, Download } from 'lucide-react';
import { get, set } from 'idb-keyval';

import { AppSettings, HistoryEntry, Tab } from './types';
import { TRANSLATIONS } from './constants';
import { Personnel } from './features/Personnel';
import { Bikes } from './features/Bikes';
import { Office } from './features/Office';
import { History } from './features/History';
import { Settings } from './features/Settings';
import { Toast, Button } from './components/UI';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ua',
  theme: 'dark',
  vibration: true,
  webhookUrl: 'https://script.google.com/macros/s/AKfycbzgovsIQyZPGdeWR-x4UBuoJRNtSM7n3Q7QYDWg2VTdRuR2RrmXSrriV7Uw8a82FmMc9Q/exec'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('personnel');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('ws_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // Initialize state from LocalStorage to persist data across app restarts
  const [personnelCounts, setPersonnelCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ws_personnel_draft') || '{}');
    } catch { return {}; }
  });

  const [bikeCounts, setBikeCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ws_bikes_draft') || '{}');
    } catch { return {}; }
  });

  const [officeData, setOfficeData] = useState<Record<string, Record<string, number | string>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ws_office_draft') || '{}');
    } catch { return {}; }
  });

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error'; visible: boolean }>({
    msg: '', type: 'success', visible: false
  });

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Handle Android Back Button & History Navigation
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ tab: 'personnel' }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('personnel');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    window.history.pushState({ tab: newTab }, '');
  };

  // Load History from IndexedDB
  useEffect(() => {
    const initHistory = async () => {
      try {
        let data = await get<HistoryEntry[]>('ws_history');
        const historyList = data || [];
        setHistory(historyList);
        
        const todayStr = new Date().toDateString();
        
        const todayPersonnel = historyList.find(h => new Date(h.date).toDateString() === todayStr && h.type === 'personnel');
        if (todayPersonnel && Object.keys(JSON.parse(localStorage.getItem('ws_personnel_draft') || '{}')).length === 0) {
          setPersonnelCounts(todayPersonnel.details);
        }

        const todayBikes = historyList.find(h => new Date(h.date).toDateString() === todayStr && h.type === 'bikes');
        if (todayBikes && Object.keys(JSON.parse(localStorage.getItem('ws_bikes_draft') || '{}')).length === 0) {
          setBikeCounts(todayBikes.details);
        }

      } catch (err) {
        console.error('Failed to load history', err);
        showToast('Storage Error', 'error');
      } finally {
        setIsHistoryLoaded(true);
      }
    };
    initHistory();
  }, []);

  // Persist Settings
  useEffect(() => {
    localStorage.setItem('ws_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Persist Draft Data
  useEffect(() => {
    localStorage.setItem('ws_personnel_draft', JSON.stringify(personnelCounts));
  }, [personnelCounts]);

  useEffect(() => {
    localStorage.setItem('ws_bikes_draft', JSON.stringify(bikeCounts));
  }, [bikeCounts]);

  useEffect(() => {
    localStorage.setItem('ws_office_draft', JSON.stringify(officeData));
  }, [officeData]);

  // Persist History
  useEffect(() => {
    if (isHistoryLoaded) {
      set('ws_history', history).catch(err => {
        console.error('Failed to save history', err);
        showToast('Failed to save history!', 'error');
      });
    }
  }, [history, isHistoryLoaded]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  };

  const addHistoryEntry = (entry: HistoryEntry) => {
    setHistory(prev => {
      const entryDateStr = new Date(entry.date).toDateString();
      const existingIndex = prev.findIndex(item => 
        new Date(item.date).toDateString() === entryDateStr && 
        item.type === entry.type
      );

      if (existingIndex >= 0) {
        const newHistory = [...prev];
        newHistory[existingIndex] = { 
          ...entry, 
          id: prev[existingIndex].id 
        };
        return newHistory;
      } else {
        return [entry, ...prev];
      }
    });
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const t = TRANSLATIONS[settings.language];

  const tabs = [
    { id: 'personnel', icon: UsersRound, label: t.personnel },
    { id: 'bikes', icon: Bike, label: t.bikes },
    { id: 'office', icon: Package, label: t.office },
    { id: 'history', icon: HistoryIcon, label: t.history },
    { id: 'settings', icon: SettingsIcon, label: t.settings },
  ];

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 selection:bg-blue-500 selection:text-white pb-safe">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-5 flex justify-between items-center pt-safe">
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent tracking-tighter">
          Work Stats
        </h1>
        {installPrompt && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <Download size={14} /> {t.installApp}
          </button>
        )}
      </header>

      <main className="p-4 max-w-lg mx-auto min-h-[85vh]">
        {activeTab === 'personnel' && (
          <Personnel 
            settings={settings} 
            onShowToast={showToast} 
            onSaveHistory={addHistoryEntry} 
            data={personnelCounts}
            onUpdate={setPersonnelCounts}
          />
        )}
        {activeTab === 'bikes' && (
          <Bikes 
            settings={settings} 
            onShowToast={showToast} 
            onSaveHistory={addHistoryEntry}
            data={bikeCounts}
            onUpdate={setBikeCounts}
          />
        )}
        {activeTab === 'office' && (
          <Office 
            settings={settings} 
            onShowToast={showToast} 
            onSaveHistory={addHistoryEntry}
            data={officeData}
            onUpdate={setOfficeData}
          />
        )}
        {activeTab === 'history' && (
          <History 
            settings={settings} 
            history={history} 
            onClear={clearHistory} 
            onShowToast={showToast} 
          />
        )}
        {activeTab === 'settings' && (
          <Settings settings={settings} updateSettings={updateSettings} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
        <div className="flex justify-around items-center max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as Tab)}
                className={`flex flex-col items-center py-4 px-1 w-full transition-all ${
                  isActive 
                  ? 'text-blue-600 dark:text-blue-400 scale-110' 
                  : 'text-slate-400 dark:text-slate-600 hover:text-slate-600'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 3 : 2} className="mb-1" />
                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <Toast message={toast.msg} type={toast.type} isVisible={toast.visible} />
    </div>
  );
};

export default App;