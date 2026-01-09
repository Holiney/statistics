import React, { useEffect, useRef, useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { AppSettings, Language, TelegramUser } from '../types';
import { Moon, Sun, Smartphone, Globe, Link, UserCircle, LogOut } from 'lucide-react';
import { Card } from '../components/UI';
import { triggerHaptic } from '../utils';

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: TelegramUser) => void;
    };
  }
}

interface Props {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  telegramUser: TelegramUser | null;
  onTelegramAuth: (user: TelegramUser) => void;
  onTelegramLogout: () => void;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
}

export const Settings: React.FC<Props> = ({
  settings,
  updateSettings,
  telegramUser,
  onTelegramAuth,
  onTelegramLogout,
  onShowToast
}) => {
  const t = TRANSLATIONS[settings.language];
  const telegramContainerRef = useRef<HTMLDivElement>(null);
  const [showTelegramWidget, setShowTelegramWidget] = useState(false);

  const handleVibrationToggle = () => {
    const newState = !settings.vibration;
    updateSettings({ vibration: newState });
    // Trigger feedback immediately if turning on (or if already on and just testing logic)
    if (newState) {
      triggerHaptic(true);
    }
  };

  const handleTelegramLogin = () => {
    if (!settings.telegramBotUsername) {
      onShowToast(t.telegramRequired, 'error');
      return;
    }
    setShowTelegramWidget(true);
  };

  useEffect(() => {
    if (showTelegramWidget && telegramContainerRef.current && settings.telegramBotUsername) {
      // Clear previous widget
      telegramContainerRef.current.innerHTML = '';

      // Setup callback
      (window as any).onTelegramAuth = (user: TelegramUser) => {
        onTelegramAuth(user);
        setShowTelegramWidget(false);
      };

      // Create script element
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', settings.telegramBotUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;

      telegramContainerRef.current.appendChild(script);
    }
  }, [showTelegramWidget, settings.telegramBotUsername]);

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

        {/* Telegram Authorization */}
        <section>
          <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
            {t.telegramAuth}
          </label>
          <Card className="space-y-3">
            {telegramUser ? (
              <>
                <div className="flex items-center gap-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  {telegramUser.photo_url ? (
                    <img
                      src={telegramUser.photo_url}
                      alt={telegramUser.first_name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <UserCircle size={48} className="text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t.telegramLoggedIn}
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {telegramUser.first_name} {telegramUser.last_name || ''}
                    </div>
                    {telegramUser.username && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        @{telegramUser.username}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onTelegramLogout}
                    className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <UserCircle size={16} />
                    <span className="text-xs font-medium">{t.telegramBotUsername}</span>
                  </div>
                  <input
                    type="text"
                    value={settings.telegramBotUsername || ''}
                    onChange={(e) => updateSettings({ telegramBotUsername: e.target.value })}
                    placeholder={t.telegramBotPlaceholder}
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-400 px-1">
                    Enter your Telegram bot username (without @)
                  </p>
                </div>
                {!showTelegramWidget ? (
                  <button
                    onClick={handleTelegramLogin}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <UserCircle size={20} />
                    {t.telegramLogin}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div ref={telegramContainerRef} className="flex justify-center py-2" />
                    <button
                      onClick={() => setShowTelegramWidget(false)}
                      className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium py-2"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
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