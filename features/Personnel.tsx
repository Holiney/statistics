import React, { useState } from 'react';
import { Card, BottomSheet, Button } from '../components/UI';
import { ZONES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Users, Car, Copy, Minus, Plus } from 'lucide-react';
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

  // Helper to get count safely
  const getCount = (key: string) => counts[key] || 0;

  const handleAdjust = (delta: number) => {
    if (!activeZone) return;
    triggerHaptic(settings.vibration);
    setCounts(prev => {
      const current = prev[activeZone] || 0;
      const newVal = Math.max(0, current + delta);
      return { ...prev, [activeZone]: newVal };
    });
  };

  const handleCopy = async () => {
    let report = `${getTodayDateString()}\n`;
    
    // Sort keys: Zones first, then Parking
    ZONES.forEach(zone => {
      if (counts[zone] > 0) report += `${zone}: ${counts[zone]}\n`;
    });
    
    if (counts['parking'] > 0) {
      report += `${t.parking}: ${counts['parking']}`;
    }

    if (Object.keys(counts).length === 0) {
        report += "No data";
    }

    const success = await copyToClipboard(report);
    if (success) {
      onShowToast(t.copied, 'success');
      // Auto-save history on copy if there is data
      if (Object.values(counts).some(v => v > 0)) {
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
    <div className="space-y-4 pb-24">
      <div className="grid grid-cols-2 gap-3">
        {/* Car Counter - Special Card */}
        <Card 
          onClick={() => setActiveZone('parking')}
          className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 border-none !text-white"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Car size={24} />
              </div>
              <span className="font-semibold text-lg">{t.parking}</span>
            </div>
            <span className="text-3xl font-bold font-mono">{getCount('parking')}</span>
          </div>
        </Card>

        {/* Zones Grid */}
        {ZONES.map(zone => (
          <Card 
            key={zone} 
            onClick={() => setActiveZone(zone)}
            className="flex flex-col justify-between h-32 active:bg-blue-50 dark:active:bg-blue-900/20"
          >
            <div className="flex justify-between items-start">
              <span className="font-medium text-slate-500 dark:text-slate-400">{zone}</span>
              <Users size={18} className="text-blue-500 opacity-50" />
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono">
                {getCount(zone)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Persistent Copy Button */}
      <div className="fixed bottom-24 right-4 z-30">
        <button
          onClick={handleCopy}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg shadow-blue-600/40 transition-transform active:scale-90"
        >
          <Copy size={24} />
        </button>
      </div>

      {/* Input Bottom Sheet */}
      <BottomSheet
        isOpen={!!activeZone}
        onClose={() => setActiveZone(null)}
        title={activeZone === 'parking' ? t.parking : activeZone || ''}
      >
        <div className="flex flex-col gap-6 items-center">
          <div className="text-6xl font-bold font-mono text-slate-800 dark:text-white">
            {activeZone ? getCount(activeZone) : 0}
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
              className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
            >
              <Plus size={32} />
            </button>
          </div>

           <div className="grid grid-cols-4 gap-2 w-full mt-4">
             {[5, 10, 20, 50].map(val => (
                <button 
                  key={val}
                  onClick={() => handleAdjust(val)}
                  className="py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm font-semibold text-slate-500"
                >
                  +{val}
                </button>
             ))}
           </div>
        </div>
      </BottomSheet>
    </div>
  );
};