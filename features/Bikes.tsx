import React, { useState, useRef, useEffect } from 'react';
import { Card, BottomSheet, Button } from '../components/UI';
import { BIKE_CATEGORIES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Bike, FileText, Minus, Plus, Camera, X, ImageIcon, Image as ImageIcon2, Trash2 } from 'lucide-react';
import { triggerHaptic, copyToClipboard, generateId, compressImage, base64ToFile } from '../utils';
import { get, set } from 'idb-keyval';

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

  // Refs for repeat logic
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  // Load unsaved images from IDB on mount
  useEffect(() => {
    const loadImages = async () => {
      const draftImgs = await get<string[]>('ws_bikes_images_draft');
      if (draftImgs && draftImgs.length > 0) {
        setSessionImages(draftImgs);
      } else {
        const history = await get<HistoryEntry[]>('ws_history');
        if (history) {
          const todayStr = new Date().toDateString();
          const todayEntry = history.find(h => new Date(h.date).toDateString() === todayStr && h.type === 'bikes');
          if (todayEntry && todayEntry.images) {
            setSessionImages(todayEntry.images);
          }
        }
      }
      setIsImagesLoaded(true);
    };
    loadImages();
  }, []);

  // Save images to IDB whenever they change
  useEffect(() => {
    if (isImagesLoaded) {
      set('ws_bikes_images_draft', sessionImages);
    }
  }, [sessionImages, isImagesLoaded]);

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

  const startRepeating = (delta: number) => {
    handleAdjust(delta);
    stopRepeating();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        handleAdjust(delta);
      }, 100);
    }, 400);
  };

  const stopRepeating = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleClearData = () => {
    if (window.confirm(t.confirmClear)) {
      setCounts({});
      onShowToast(t.dataCleared, 'success');
    }
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
    if (window.confirm('Clear all photos?')) {
      setSessionImages([]);
    }
  };

  const saveHistoryIfNeeded = () => {
    const historyEntry: HistoryEntry = {
      id: generateId(),
      date: new Date().toISOString(),
      type: 'bikes',
      summary: t.bikes,
      details: counts,
      images: [...sessionImages]
    };

    if (Object.values(counts).some((v: number) => v > 0) || sessionImages.length > 0) {
      onSaveHistory(historyEntry);
      return true;
    }
    return false;
  };

  const handleShareText = async () => {
    triggerHaptic(settings.vibration);
    saveHistoryIfNeeded();
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

    let report = `${dateStr}\n`;
    BIKE_CATEGORIES.forEach(cat => {
      const count = getCount(cat);
      report += `${cat}: ${count}\n`;
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ text: report })) {
      try {
        await navigator.share({ title: 'Work Stats', text: report });
        onShowToast(t.sharing, 'success');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          await copyToClipboard(report);
          onShowToast(t.copied, 'success');
        }
      }
    } else {
      await copyToClipboard(report);
      onShowToast(t.copied, 'success');
    }
  };

  const handleSharePhotos = async () => {
    triggerHaptic(settings.vibration);
    if (sessionImages.length === 0) {
      onShowToast('No photos', 'error');
      return;
    }
    saveHistoryIfNeeded();

    if (navigator.share && navigator.canShare) {
      try {
        const filesArray = sessionImages.map((b64, idx) => base64ToFile(b64, `bike_${idx + 1}.jpg`));
        if (navigator.canShare({ files: filesArray })) {
          await navigator.share({ files: filesArray, title: 'Work Stats Photos' });
          onShowToast(t.sharing, 'success');
        } else {
          onShowToast('Sharing files not supported', 'error');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onShowToast('Share failed', 'error');
        }
      }
    } else {
      onShowToast('Sharing not supported on this device', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

      {/* Gallery Block */}
      {sessionImages.length > 0 && (
        <Card className="border-2 border-orange-500/20 bg-orange-50 dark:bg-orange-900/10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <ImageIcon size={18} className="text-orange-500" />
              Gallery ({sessionImages.length})
            </h3>
            <button onClick={clearImages} className="text-red-500 text-xs font-bold uppercase p-2">Clear All</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sessionImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square">
                <img src={img} alt={`Shot ${idx}`} className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12} strokeWidth={3} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category List */}
      <div className="grid grid-cols-1 gap-3">
        {BIKE_CATEGORIES.map(cat => {
          const count = getCount(cat);
          const isActive = count > 0;
          return (
            <Card
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`flex justify-between items-center py-5 px-6 active:bg-orange-50 dark:active:bg-orange-900/10 hover:border-orange-300 transition-all ${isActive ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-orange-500/10' : 'border-transparent'}`}
            >
              <div className="flex items-center gap-5">
                <div className={`p-3 rounded-2xl ${isActive ? 'bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                  <Bike size={24} />
                </div>
                <span className={`font-bold text-lg ${isActive ? 'text-orange-900 dark:text-orange-100' : 'text-slate-800 dark:text-slate-200'}`}>{cat}</span>
              </div>
              <span className={`text-3xl font-black font-mono tracking-tighter ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}>{count}</span>
            </Card>
          );
        })}
      </div>

      {/* NEW Actions Block at the bottom of the scrollable list */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-3">
          <button
            onClick={handleCameraClick}
            className="bg-slate-700 hover:bg-slate-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all relative shrink-0"
          >
            <Camera size={28} />
            {sessionImages.length > 0 && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-800">{sessionImages.length}</div>
            )}
          </button>
          
          <div className="flex flex-1 gap-2">
            <button
              onClick={handleShareText}
              className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all gap-1 px-2"
            >
              <FileText size={20} />
              <span className="font-bold text-[10px] uppercase">{t.shareText}</span>
            </button>
            <button
              onClick={handleSharePhotos}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all gap-1 px-2"
            >
              <ImageIcon2 size={20} />
              <span className="font-bold text-[10px] uppercase">{t.sharePhotos}</span>
            </button>
          </div>
        </div>

        <button onClick={handleClearData} className="w-full flex items-center justify-center gap-2 py-4 text-red-500 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-95 transition-all border border-dashed border-red-200 dark:border-red-900/30">
          <Trash2 size={16} />{t.clearData}
        </button>
      </div>

      <BottomSheet isOpen={!!activeCat} onClose={() => setActiveCat(null)} title={activeCat || ''}>
        <div className="flex flex-col gap-6 items-center pt-4 pb-8">
          <div className="text-8xl font-black font-mono text-slate-900 dark:text-white tracking-tighter select-none">{activeCat ? getCount(activeCat) : 0}</div>
          <div className="flex gap-4 w-full px-1">
            <button onPointerDown={() => startRepeating(-1)} onPointerUp={stopRepeating} onPointerLeave={stopRepeating} className="flex-1 h-40 rounded-3xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-sm border border-transparent active:border-slate-300 touch-none"><Minus size={64} strokeWidth={3} className="opacity-80" /></button>
            <button onPointerDown={() => startRepeating(1)} onPointerUp={stopRepeating} onPointerLeave={stopRepeating} className="flex-1 h-40 rounded-3xl bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 active:scale-95 transition-all active:bg-orange-600 border border-transparent active:border-orange-400 touch-none"><Plus size={64} strokeWidth={3} /></button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};