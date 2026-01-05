import React, { useState, useRef, useEffect } from 'react';
import { Card, BottomSheet } from '../components/UI';
import { BIKE_CATEGORIES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Bike, Copy, Minus, Plus, Camera, Trash, X, ImageIcon } from 'lucide-react';
import { triggerHaptic, copyToClipboard, getTodayDateString, generateId, compressImage } from '../utils';
import { get, set, del } from 'idb-keyval';

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
  const [isImagesLoaded, setIsImagesLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load unsaved images from IDB on mount
  useEffect(() => {
    get<string[]>('ws_bikes_images_draft').then((imgs) => {
      if (imgs) setSessionImages(imgs);
      setIsImagesLoaded(true);
    });
  }, []);

  // Save images to IDB whenever they change (Auto-save draft)
  useEffect(() => {
    if (isImagesLoaded) {
      set('ws_bikes_images_draft', sessionImages);
    }
  }, [sessionImages, isImagesLoaded]);

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

  const removeImage = (index: number) => {
    if (window.confirm('Delete this photo?')) {
      setSessionImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const clearImages = () => {
      if(window.confirm('Clear all photos?')) {
          setSessionImages([]);
      }
  };

  const handleCopy = async () => {
    let report = `${getTodayDateString()}\n`;
    BIKE_CATEGORIES.forEach(cat => {
      const count = getCount(cat);
      if (count > 0) report += `${cat}: ${count}\n`;
    });
    if (Object.keys(counts).length === 0) report += "No data";

    // 1. Copy to clipboard
    const success = await copyToClipboard(report);
    if (success) {
      onShowToast(t.copied, 'success');
    } else {
      onShowToast('Copy failed, check permissions', 'error');
    }

    // 2. Always save to history if there is data, regardless of copy success
    if (Object.values(counts).some((v: number) => v > 0) || sessionImages.length > 0) {
      onSaveHistory({
        id: generateId(),
        date: new Date().toISOString(),
        type: 'bikes',
        summary: t.bikes,
        details: counts,
        images: [...sessionImages]
      });
      
      // 3. Clear images after saving to prevent duplicates in next entry
      setSessionImages([]);
      // Clear IDB draft
      del('ws_bikes_images_draft');
      
      if (!success) onShowToast(t.success, 'success');
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

      {/* Gallery Block */}
      {sessionImages.length > 0 && (
        <Card className="border-2 border-orange-500/20 bg-orange-50 dark:bg-orange-900/10">
          <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
               <ImageIcon size={18} className="text-orange-500"/>
               Gallery ({sessionImages.length})
             </h3>
             <button onClick={clearImages} className="text-red-500 text-xs font-bold uppercase p-2">
               Clear All
             </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sessionImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square group">
                <img 
                  src={img} 
                  alt={`Shot ${idx}`} 
                  className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

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
        <div className="flex gap-3">
          <button
            onClick={handleCameraClick}
            className="bg-slate-700 hover:bg-slate-600 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl transition-transform active:scale-90 relative"
          >
            <Camera size={28} />
            {sessionImages.length > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-800">
                {sessionImages.length}
              </div>
            )}
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