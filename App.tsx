import React, { useState, useEffect } from 'react';
import { UsersRound, Bike, Package, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';

import { AppSettings, HistoryEntry, Tab } from './types';
import { TRANSLATIONS } from './constants';
import { Personnel } from './features/Personnel';
import { Bikes } from './features/Bikes';
import { Office } from './features/Office';
import { History } from './features/History';
import { Settings } from './features/Settings';
import { Toast } from './components/UI';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ua',
  theme: 'dark',
  vibration: true,
  webhookUrl: 'https://script.google.com/macros/s/AKfycbzgovsIQyZPGdeWR-x4UBuoJRNtSM7n3Q7QYDWg2VTdRuR2RrmXSrriV7Uw8a82FmMc9Q/exec'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('personnel');
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ws_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('ws_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [personnelCounts, setPersonnelCounts] = useState<Record<string, number>>({});
  const [bikeCounts, setBikeCounts] = useState<Record<string, number>>({});
  const [officeData, setOfficeData] = useState<Record<string, Record<string, number | string>>>({});

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error'; visible: boolean }>({
    msg: '', type: 'success', visible: false
  });

  useEffect(() => {
    localStorage.setItem('ws_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('ws_history', JSON.stringify(history));
  }, [history]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  };

  const addHistoryEntry = (entry: HistoryEntry) => {
    setHistory(prev => [entry, ...prev]);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 selection:bg-blue-500 selection:text-white pb-safe">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-5">
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent tracking-tighter">
          Work Stats
        </h1>
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
                onClick={() => setActiveTab(tab.id as Tab)}
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