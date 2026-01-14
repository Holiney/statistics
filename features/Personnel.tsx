import React, { useState, useRef } from 'react';
import { Card, BottomSheet } from '../components/UI';
import { ZONES, TRANSLATIONS, APP_VERSION } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { UsersRound, Car, Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { triggerHaptic, copyToClipboard, getTodayDateString, generateId } from '../utils';

interface Props {
  settings: AppSettings;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onSaveHistory: (entry: HistoryEntry) => void;
  data: Record<string, number>;
  onUpdate: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const Personnel: React.FC<Props> = ({ settings, onShowToast, onSaveHistory, data: counts, onUpdate: setCounts }) => {
  const t = TRANSLATIONS[settings.language];
  const [activeZone, setActiveZone] = useState<string | null>(null);
  
  // Refs for repeat logic
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  // Fix: added explicit cast to handle potential unknown type issues in specific environments
  const getCount = (key: string) => (counts[key] as number) || 0;

  const handleAdjust = (delta: number) => {
    if (!activeZone) return;
    triggerHaptic(settings.vibration);
    setCounts(prev => {
      const current = prev[activeZone] || 0;
      const newVal = Math.max(0, current + delta);
      return { ...prev, [activeZone]: newVal };
    });
  };

  const startRepeating = (delta: number) => {
    // Fire immediately
    handleAdjust(delta);
    
    // Clear any existing timers
    stopRepeating();

    // Set delay before rapid fire
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        handleAdjust(delta);
      }, 100); // 100ms repeat speed
    }, 400); // 400ms delay before repeat starts
  };

  const stopRepeating = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleClear = () => {
    if (window.confirm(t.confirmClear)) {
      setCounts({});
      onShowToast(t.dataCleared, 'success');
    }
  };

  const handleCopy = async () => {
    let report = `${getTodayDateString()}\n`;
    ZONES.forEach(zone => {
      const count = getCount(zone);
      if (count > 0) report += `${zone}: ${count}\n`;
    });
    const parkingCount = getCount('parking');
    if (parkingCount > 0) report += `${t.parking}: ${parkingCount}`;
    if (Object.keys(counts).length === 0) report += "No data";

    const success = await copyToClipboard(report);
    if (success) {
      onShowToast(t.copied, 'success');
      if (Object.values(counts).some((v: number) => v > 0)) {
        onSaveHistory({
          id: generateId(),
          date: new Date().toISOString(),
          type: 'personnel',
          summary: `${t.personnel} & ${t.cars}`,
          details: counts
        });
      }
    } else {
      onShowToast('Copy failed', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-32 relative">
      <div className="grid grid-cols-2 gap-4">
        <Card 
          onClick={() => setActiveZone('parking')}
          className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 border-none !text-white shadow-lg shadow-slate-500/10 p-6"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Car size={28} className="text-blue-400" />
              </div>
              <div>
                <span className="block text-white/60 text-xs font-bold uppercase tracking-widest">{t.cars}</span>
                <span className="text-xl font-bold">{t.parking}</span>
              </div>
            </div>
            <span className="text-4xl font-black font-mono tracking-tighter">{getCount('parking')}</span>
          </div>
        </Card>

        {ZONES.map(zone => {
          const count = getCount(zone);
          const isActive = count > 0;
          return (
            <Card 
              key={zone} 
              onClick={() => setActiveZone(zone)}
              className={`flex flex-col justify-between h-36 active:bg-blue-50 dark:active:bg-blue-900/10 p-5 hover:border-blue-300 dark:hover:border-blue-800 transition-all ${
                isActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/10' 
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`font-bold text-xs uppercase tracking-wider ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>{zone}</span>
                <UsersRound size={20} className={isActive ? 'text-blue-600' : 'text-blue-500/40'} />
              </div>
              <div className="text-right">
                <span className={`text-4xl font-black font-mono tracking-tighter ${isActive ? 'text-blue-700 dark:text-blue-100' : 'text-slate-900 dark:text-white'}`}>
                  {count}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between items-center w-full py-2 px-1">
        <button 
          onClick={handleClear}
          className="flex items-center gap-2 px-3 py-2 text-red-500 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
        >
          <Trash2 size={16} />
          {t.clearData}
        </button>
        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono opacity-60">{APP_VERSION}</span>
      </div>

      <div className="fixed bottom-24 right-4 z-30">
          <button
            onClick={handleCopy}
            className="bg-blue-600 hover:bg-blue-700 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 transition-transform active:scale-90"
          >
            <Copy size={28} />
          </button>
      </div>

      <BottomSheet
        isOpen={!!activeZone}
        onClose={() => setActiveZone(null)}
        title={activeZone === 'parking' ? t.parking : activeZone || ''}
      >
        <div className="flex flex-col gap-6 items-center pt-4 pb-8">
          <div className="text-8xl font-black font-mono text-slate-900 dark:text-white tracking-tighter select-none">
            {activeZone ? getCount(activeZone) : 0}
          </div>
          
          <div className="flex gap-4 w-full px-1">
            <button
              onPointerDown={() => startRepeating(-1)}
              onPointerUp={stopRepeating}
              onPointerLeave={stopRepeating}
              onContextMenu={(e) => e.preventDefault()}
              className="flex-1 h-40 rounded-3xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-sm active:bg-slate-200 dark:active:bg-slate-600 border border-transparent active:border-slate-300 touch-none"
            >
              <Minus size={64} strokeWidth={3} className="opacity-80" />
            </button>
            <button
              onPointerDown={() => startRepeating(1)}
              onPointerUp={stopRepeating}
              onPointerLeave={stopRepeating}
              onContextMenu={(e) => e.preventDefault()}
              className="flex-1 h-40 rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 active:scale-95 transition-all active:bg-blue-700 border border-transparent active:border-blue-400 touch-none"
            >
              <Plus size={64} strokeWidth={3} />
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};