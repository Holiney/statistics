import React, { useState, useEffect } from 'react';
import { Users, Bike, Briefcase, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';

import { AppSettings, HistoryEntry, Tab } from './types';
import { TRANSLATIONS } from './constants';
import { Personnel } from './features/Personnel';
import { Bikes } from './features/Bikes';
import { Office } from './features/Office';
import { History } from './features/History';
import { Settings } from './features/Settings';
import { Toast } from './components/UI';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ua', // Default per requirements
  theme: 'dark', // Modern default
  vibration: true,
  webhookUrl: 'https://script.google.com/macros/s/AKfycbzgovsIQyZPGdeWR-x4UBuoJRNtSM7n3Q7QYDWg2VTdRuR2RrmXSrriV7Uw8a82FmMc9Q/exec'
};

const App: React.FC = () => {
  // State initialization with LocalStorage
  const [activeTab, setActiveTab] = useState<Tab>('personnel');
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ws_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('ws_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Lifted state to persist data between tab switches
  const [personnelCounts, setPersonnelCounts] = useState<Record<string, number>>({});
  const [bikeCounts, setBikeCounts] = useState<Record<string, number>>({});
  const [officeData, setOfficeData] = useState<Record<string, Record<string, number | string>>>({});

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error'; visible: boolean }>({
    msg: '', type: 'success', visible: false
  });

  // Persist effects
  useEffect(() => {
    localStorage.setItem('ws_settings', JSON.stringify(settings));
    // Apply theme to body
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('ws_history', JSON.stringify(history));
  }, [history]);

  // Actions
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

  // Tab config
  const tabs = [
    { id: 'personnel', icon: Users, label: t.personnel },
    { id: 'bikes', icon: Bike, label: t.bikes },
    { id: 'office', icon: Briefcase, label: t.office },
    { id: 'history', icon: HistoryIcon, label: t.history },
    { id: 'settings', icon: SettingsIcon, label: t.settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 selection:bg-blue-500 selection:text-white pb-safe">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
          Work Stats
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="p-4 max-w-lg mx-auto min-h-[80vh]">
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
                  isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="mb-1 transition-transform duration-200" style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }} />
                <span className="text-[10px] font-medium truncate w-full text-center">
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