import React, { useState, useRef } from 'react';
import { Card, BottomSheet } from '../components/UI';
import { BIKE_CATEGORIES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Bike, Copy, Minus, Plus, Camera, Trash } from 'lucide-react';
import { triggerHaptic, copyToClipboard, getTodayDateString, generateId, compressImage } from '../utils';

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
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fix: added explicit cast to handle potential unknown type issues in specific environments
  const getCount = (key: string) => (counts[key] as number) || 0;

  const handleAdjust = (delta: number) => {
    if (!activeCat) return;
    triggerHaptic(settings.vibration);
    setCounts(prev => {
      const current = prev[activeCat] || 0;
      const newVal = Math.max(0, current + delta);
      return { ...prev, [activeCat]: newVal };
    });
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setSessionImages(prev => [...prev, compressed]);
        onShowToast('Photo attached', 'success');
      } catch (e) {
        onShowToast('Failed to process image', 'error');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearImages = () => setSessionImages([]);

  const handleCopy = async () => {
    let report = `${getTodayDateString()}\n`;
    BIKE_CATEGORIES.forEach(cat => {
      const count = getCount(cat);
      if (count > 0) report += `${cat}: ${count}\n`;
    });
    if (Object.keys(counts).length === 0) report += "No data";

    const success = await copyToClipboard(report);
    if (success) {
      onShowToast(t.copied, 'success');
       if (Object.values(counts).some((v: number) => v > 0)) {
        onSaveHistory({
          id: generateId(),
          date: new Date().toISOString(),
          type: 'bikes',
          summary: t.bikes,
          details: counts,
          images: [...sessionImages]
        });
      }
    } else {
      onShowToast('Copy failed', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-32">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 gap-4">
        {BIKE_CATEGORIES.map(cat => (
          <Card 
            key={cat} 
            onClick={() => setActiveCat(cat)}
            className="flex justify-between items-center py-6 px-6 active:bg-orange-50 dark:active:bg-orange-900/10 hover:border-orange-300 transition-all shadow-sm"
          >
            <div className="flex items-center gap-5">
               <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl">
                 <Bike size={24} />
               </div>
               <span className="font-bold text-lg text-slate-800 dark:text-slate-200">{cat}</span>
            </div>
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
              {getCount(cat)}
            </span>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-3">
        {sessionImages.length > 0 && (
           <div className="bg-slate-800 text-white p-2 rounded-xl shadow-lg flex items-center justify-center gap-2 mb-2">
              <Camera size={16} /> 
              <span className="text-xs font-bold">{sessionImages.length}</span>
              <button onClick={clearImages} className="p-1 bg-white/20 rounded-full ml-1"><Trash size={10} /></button>
           </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCameraClick}
            className="bg-slate-700 hover:bg-slate-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl transition-transform active:scale-90"
          >
            <Camera size={28} />
          </button>
          
          <button
            onClick={handleCopy}
            className="bg-orange-500 hover:bg-orange-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/40 transition-transform active:scale-90"
          >
            <Copy size={28} />
          </button>
        </div>
      </div>

      <BottomSheet
        isOpen={!!activeCat}
        onClose={() => setActiveCat(null)}
        title={activeCat || ''}
      >
        <div className="flex flex-col gap-6 items-center pt-2 pb-6">
          <div className="text-8xl font-black font-mono text-slate-900 dark:text-white tracking-tighter">
            {activeCat ? getCount(activeCat) : 0}
          </div>
          
          {/* Increased Height to h-40 (160px) */}
          <div className="flex gap-4 w-full px-1">
            <button
              onClick={() => handleAdjust(-1)}
              className="flex-1 h-40 rounded-3xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-sm active:bg-slate-200 border border-transparent active:border-slate-300"
            >
              <Minus size={64} strokeWidth={3} className="opacity-80" />
            </button>
            <button
              onClick={() => handleAdjust(1)}
              className="flex-1 h-40 rounded-3xl bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 active:scale-95 transition-all active:bg-orange-600 border border-transparent active:border-orange-400"
            >
              <Plus size={64} strokeWidth={3} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mt-2">
             {[5, 10].map(val => (
                <button 
                  key={val}
                  onClick={() => handleAdjust(val)}
                  className="py-5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl text-xl font-black text-slate-600 dark:text-slate-400 active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
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