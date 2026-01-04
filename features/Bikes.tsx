import React, { useState } from 'react';
import { Card, BottomSheet } from '../components/UI';
import { BIKE_CATEGORIES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Bike, Copy, Minus, Plus } from 'lucide-react';
import { triggerHaptic, copyToClipboard, getTodayDateString, generateId } from '../utils';

interface Props {
  settings: AppSettings;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onSaveHistory: (entry: HistoryEntry) => void;
  data: Record<string, number>;
  onUpdate: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const Bikes: React.FC<Props> = ({ settings, onShowToast, onSaveHistory, data: counts, onUpdate: setCounts }) => {
  const t = TRANSLATIONS[settings.language];
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const getCount = (key: string) => counts[key] || 0;

  const handleAdjust = (delta: number) => {
    if (!activeCat) return;
    triggerHaptic(settings.vibration);
    setCounts(prev => {
      const current = prev[activeCat] || 0;
      const newVal = Math.max(0, current + delta);
      return { ...prev, [activeCat]: newVal };
    });
  };

  const handleCopy = async () => {
    let report = `${getTodayDateString()}\n`;
    BIKE_CATEGORIES.forEach(cat => {
      if (counts[cat] > 0) report += `${cat}: ${counts[cat]}\n`;
    });

    if (Object.keys(counts).length === 0) report += "No data";

    const success = await copyToClipboard(report);
    if (success) {
      onShowToast(t.copied, 'success');
       if (Object.values(counts).some(v => v > 0)) {
        onSaveHistory({
          id: generateId(),
          date: new Date().toISOString(),
          type: 'bikes',
          summary: t.bikes,
          details: counts
        });
      }
    } else {
      onShowToast('Copy failed', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="grid grid-cols-1 gap-3">
        {BIKE_CATEGORIES.map(cat => (
          <Card 
            key={cat} 
            onClick={() => setActiveCat(cat)}
            className="flex justify-between items-center py-5 active:bg-blue-50 dark:active:bg-blue-900/20"
          >
            <div className="flex items-center gap-4">
               <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                 <Bike size={20} />
               </div>
               <span className="font-medium text-lg">{cat}</span>
            </div>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono">
              {getCount(cat)}
            </span>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-24 right-4 z-30">
        <button
          onClick={handleCopy}
          className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-full shadow-lg shadow-orange-500/40 transition-transform active:scale-90"
        >
          <Copy size={24} />
        </button>
      </div>

      <BottomSheet
        isOpen={!!activeCat}
        onClose={() => setActiveCat(null)}
        title={activeCat || ''}
      >
        <div className="flex flex-col gap-6 items-center">
          <div className="text-6xl font-bold font-mono text-slate-800 dark:text-white">
            {activeCat ? getCount(activeCat) : 0}
          </div>
          
          <div className="flex gap-4 w-full justify-center">
            <button
              onClick={() => handleAdjust(-1)}
              className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 active:scale-90 transition-transform"
            >
              <Minus size={32} />
            </button>
            <button
              onClick={() => handleAdjust(1)}
              className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 active:scale-90 transition-transform"
            >
              <Plus size={32} />
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};