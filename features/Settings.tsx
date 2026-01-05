import React from 'react';
import { TRANSLATIONS } from '../constants';
import { AppSettings, Language } from '../types';
import { Moon, Sun, Smartphone, Globe, Link } from 'lucide-react';
import { Card } from '../components/UI';
import { triggerHaptic } from '../utils';

interface Props {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const Settings: React.FC<Props> = ({ settings, updateSettings }) => {
  const t = TRANSLATIONS[settings.language];

  const handleVibrationToggle = () => {
    const newState = !settings.vibration;
    updateSettings({ vibration: newState });
    // Trigger feedback immediately if turning on (or if already on and just testing logic)
    if (newState) {
      triggerHaptic(true);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t.settings}</h2>

      <div className="space-y-4">
        {/* Language */}
        <section>
          <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
            {t.language}
          </label>
          <Card className="flex items-center gap-2 p-1">
            {(['en', 'ua', 'nl'] as Language[]).map(lang => (
               <button
                 key={lang}
                 onClick={() => updateSettings({ language: lang })}
                 className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                   settings.language === lang 
                   ? 'bg-blue-500 text-white shadow-md' 
                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                 }`}
               >
                 {lang.toUpperCase()}
               </button>
            ))}
          </Card>
        </section>

        {/* Theme & Vibration */}
        <section>
           <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
            Appearance & Haptics
          </label>
          <div className="space-y-3">
             <Card 
               onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
               className="flex justify-between items-center"
             >
                <div className="flex items-center gap-3">
                   {settings.theme === 'light' ? <Sun size={20} className="text-orange-500"/> : <Moon size={20} className="text-indigo-400"/>}
                   <span className="font-medium text-slate-700 dark:text-slate-200">{t.theme}</span>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.theme === 'dark' ? 'bg-blue-500' : 'bg-slate-300'}`}>
                   <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${settings.theme === 'dark' ? 'translate-x-6' : ''}`} />
                </div>
             </Card>

             <Card 
               onClick={handleVibrationToggle}
               className="flex justify-between items-center"
             >
                <div className="flex items-center gap-3">
                   <Smartphone size={20} className="text-slate-500"/>
                   <span className="font-medium text-slate-700 dark:text-slate-200">{t.vibration}</span>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.vibration ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                   <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${settings.vibration ? 'translate-x-6' : ''}`} />
                </div>
             </Card>
          </div>
        </section>

        {/* Webhook Configuration */}
        <section>
          <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
            Integration
          </label>
          <Card className="space-y-2">
             <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Link size={16} />
                <span className="text-xs font-medium">Power Automate Webhook</span>
             </div>
             <input 
               type="text"
               value={settings.webhookUrl}
               onChange={(e) => updateSettings({ webhookUrl: e.target.value })}
               placeholder="https://prod-..."
               className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
             />
             <p className="text-xs text-slate-400 px-1">
               Enter the Power Automate 'HTTP Request' URL here for cloud syncing.
             </p>
          </Card>
        </section>
      </div>
    </div>
  );
};