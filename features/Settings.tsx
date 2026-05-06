import React, { useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { AppSettings, Language, TelegramUser, Zone, Category, CategoryKind } from '../types';
import { Moon, Sun, Smartphone, Link, User, Trash2, ShieldCheck, ShieldOff, Lock, Plus, EyeOff, Eye } from 'lucide-react';
import { Card } from '../components/UI';
import { triggerHaptic } from '../utils';
import { filterByKind } from '../services/categoriesStore';

interface Props {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  user: TelegramUser | null;
  onReset: () => void;
  isAdmin: boolean;
  onAdminLogin: (password: string) => boolean;
  onAdminLogout: () => void;
  zones: Zone[];
  onSaveZone: (zone: Zone) => void;
  categories: Category[];
  onSaveCategory: (category: Category) => void;
}

export const Settings: React.FC<Props> = ({
  settings, updateSettings, user, onReset,
  isAdmin, onAdminLogin, onAdminLogout,
  zones, onSaveZone,
  categories, onSaveCategory,
}) => {
  const t = TRANSLATIONS[settings.language];
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLimited, setNewRoomLimited] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [newPersonnelZone, setNewPersonnelZone] = useState('');
  const [newBikeCategory, setNewBikeCategory] = useState('');

  const personnelZones = filterByKind(categories, 'personnel_zone');
  const bikeCats = filterByKind(categories, 'bike_category');

  const addCategory = (kind: CategoryKind, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const prefix = kind === 'personnel_zone' ? 'pz' : 'bc';
    const sameKind = filterByKind(categories, kind);
    const nextOrder = sameKind.length > 0 ? Math.max(...sameKind.map(c => c.order)) + 1 : 0;
    onSaveCategory({
      id: `${prefix}_${trimmed.replace(/\s+/g, '_')}_v${Date.now()}`,
      kind,
      name: trimmed,
      active: true,
      order: nextOrder,
      createdAt: new Date().toISOString(),
    });
  };

  const handleSavePassword = () => {
    const p = newPasswordInput.trim();
    if (!p) return;
    updateSettings({ adminPassword: p });
    setNewPasswordInput('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const handleVibrationToggle = () => {
    const newState = !settings.vibration;
    updateSettings({ vibration: newState });
    if (newState) triggerHaptic(true);
  };

  const handleLogin = () => {
    const ok = onAdminLogin(passwordInput);
    if (ok) {
      setPasswordInput('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t.settings}</h2>

      {/* User Profile */}
      <section>
        <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
          Profile
        </label>
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <User className="text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-white">{t.guest}</p>
              <p className="text-xs text-slate-400">Local Session</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={onReset}
              className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              title={t.resetApp}
            >
              <Trash2 size={20} />
            </button>
          )}
        </Card>
      </section>

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
                {settings.theme === 'light' ? <Sun size={20} className="text-orange-500" /> : <Moon size={20} className="text-indigo-400" />}
                <span className="font-medium text-slate-700 dark:text-slate-200">{t.theme}</span>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.theme === 'dark' ? 'bg-blue-500' : 'bg-slate-300'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${settings.theme === 'dark' ? 'translate-x-6' : ''}`} />
              </div>
            </Card>

            <Card onClick={handleVibrationToggle} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-slate-500" />
                <span className="font-medium text-slate-700 dark:text-slate-200">{t.vibration}</span>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.vibration ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${settings.vibration ? 'translate-x-6' : ''}`} />
              </div>
            </Card>
          </div>
        </section>

        {/* Admin Mode */}
        <section>
          <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
            Admin
          </label>

          {isAdmin ? (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-500">
                  <ShieldCheck size={20} />
                  <span className="font-bold text-sm">Admin mode active</span>
                </div>
                <button
                  onClick={onAdminLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <ShieldOff size={14} /> Logout
                </button>
              </div>

              {/* Change password */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500">Change password</span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
                    placeholder="New password"
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-2.5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={handleSavePassword}
                    className={`px-3 rounded-lg text-sm font-bold transition-colors ${
                      passwordSaved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 hover:bg-blue-500 hover:text-white'
                    }`}
                  >
                    {passwordSaved ? '✓' : 'Save'}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Lock size={18} />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Enter password to unlock admin</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setLoginError(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Password"
                  className={`flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono focus:ring-2 outline-none ${
                    loginError ? 'ring-2 ring-red-400 text-red-500' : 'text-slate-600 dark:text-slate-300 focus:ring-blue-500'
                  }`}
                />
                <button
                  onClick={handleLogin}
                  className="px-4 rounded-lg bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all"
                >
                  OK
                </button>
              </div>
              {loginError && (
                <p className="text-xs text-red-400 px-1">Wrong password</p>
              )}
            </Card>
          )}
        </section>

        {/* Zone management — admin only */}
        {isAdmin && (
          <section>
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
              Rooms (Zones)
            </label>
            <Card className="space-y-3">
              {/* Existing zones */}
              <div className="space-y-2">
                {zones.map(zone => (
                  <div key={zone.id} className="flex items-center justify-between gap-2 py-1">
                    <span className={`font-mono font-bold text-sm ${zone.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}`}>
                      {zone.name}
                      {zone.isLimited && <span className="ml-2 text-[10px] font-normal text-slate-400">limited</span>}
                    </span>
                    <button
                      onClick={() => onSaveZone({ ...zone, active: !zone.active })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title={zone.active ? 'Deactivate' : 'Activate'}
                    >
                      {zone.active ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new zone */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <span className="text-xs font-medium text-slate-500">Add new room</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="Room name"
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-2.5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      const name = newRoomName.trim();
                      if (!name) return;
                      const id = `room_${name.replace(/\s+/g, '_')}_v${Date.now()}`;
                      onSaveZone({ id, name, isLimited: newRoomLimited, active: true, createdAt: new Date().toISOString() });
                      setNewRoomName('');
                    }}
                    className="px-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRoomLimited}
                    onChange={e => setNewRoomLimited(e.target.checked)}
                    className="rounded"
                  />
                  Limited items only (EK13–18)
                </label>
              </div>
            </Card>
          </section>
        )}

        {/* Personnel zones — admin only */}
        {isAdmin && (
          <section>
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
              Personnel Zones
            </label>
            <Card className="space-y-3">
              <div className="space-y-2">
                {personnelZones.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between gap-2 py-1">
                    <span className={`font-mono font-bold text-sm ${cat.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}`}>
                      {cat.name}
                    </span>
                    <button
                      onClick={() => onSaveCategory({ ...cat, active: !cat.active })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title={cat.active ? 'Deactivate' : 'Activate'}
                    >
                      {cat.active ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <span className="text-xs font-medium text-slate-500">Add new zone</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPersonnelZone}
                    onChange={e => setNewPersonnelZone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (addCategory('personnel_zone', newPersonnelZone), setNewPersonnelZone(''))}
                    placeholder="e.g. Zone 270"
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-2.5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => { addCategory('personnel_zone', newPersonnelZone); setNewPersonnelZone(''); }}
                    className="px-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Bike categories — admin only */}
        {isAdmin && (
          <section>
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
              Bike Categories
            </label>
            <Card className="space-y-3">
              <div className="space-y-2">
                {bikeCats.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between gap-2 py-1">
                    <span className={`font-mono font-bold text-sm ${cat.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}`}>
                      {cat.name}
                    </span>
                    <button
                      onClick={() => onSaveCategory({ ...cat, active: !cat.active })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title={cat.active ? 'Deactivate' : 'Activate'}
                    >
                      {cat.active ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <span className="text-xs font-medium text-slate-500">Add new category</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBikeCategory}
                    onChange={e => setNewBikeCategory(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (addCategory('bike_category', newBikeCategory), setNewBikeCategory(''))}
                    placeholder="e.g. Tandem"
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-2.5 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => { addCategory('bike_category', newBikeCategory); setNewBikeCategory(''); }}
                    className="px-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Sync Provider & Webhook — admin only */}
        {isAdmin && (
          <section>
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
              {t.syncProvider}
            </label>
            <Card className="space-y-3">
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <button
                  onClick={() => updateSettings({ syncProvider: 'google' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                    settings.syncProvider === 'google' ? 'bg-blue-500 text-white shadow' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Google Sheets
                </button>
                <button
                  onClick={() => updateSettings({ syncProvider: 'microsoft' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                    settings.syncProvider === 'microsoft' ? 'bg-blue-500 text-white shadow' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Microsoft Excel
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Link size={16} />
                  <span className="text-xs font-medium">Google Apps Script Webhook</span>
                </div>
                <input
                  type="text"
                  value={settings.webhookUrl}
                  onChange={(e) => updateSettings({ webhookUrl: e.target.value })}
                  placeholder="https://script.google.com/..."
                  className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Link size={16} />
                  <span className="text-xs font-medium">Microsoft Power Automate Webhook</span>
                </div>
                <input
                  type="text"
                  value={settings.microsoftWebhookUrl}
                  onChange={(e) => updateSettings({ microsoftWebhookUrl: e.target.value })}
                  placeholder="https://prod-..."
                  className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Link size={16} />
                  <span className="text-xs font-medium">Microsoft Excel File URL</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.microsoftWorkbookUrl}
                    onChange={(e) => updateSettings({ microsoftWorkbookUrl: e.target.value })}
                    placeholder="https://excel.cloud.microsoft/..."
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg p-3 text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => settings.microsoftWorkbookUrl && window.open(settings.microsoftWorkbookUrl, '_blank')}
                    className="px-3 rounded-lg bg-slate-200 dark:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-100"
                  >
                    OPEN
                  </button>
                </div>
                <p className="text-xs text-slate-400 px-1">{t.microsoftWebhookHint}</p>
              </div>

              <p className="text-xs text-slate-400 px-1">
                {t.activeSyncProvider}: {settings.syncProvider === 'google' ? 'Google Sheets' : 'Microsoft Excel'}
              </p>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
};
