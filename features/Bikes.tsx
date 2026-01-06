import React, { useState, useRef, useEffect } from 'react';
import { Card, BottomSheet } from '../components/UI';
import { BIKE_CATEGORIES, TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Bike, FileText, Minus, Plus, Camera, X, ImageIcon, Image as ImageIcon2, Trash2 } from 'lucide-react';
import { triggerHaptic, copyToClipboard, getTodayDateString, generateId, compressImage, base64ToFile } from '../utils';
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
      // 1. Try Loading Draft
      const draftImgs = await get<string[]>('ws_bikes_images_draft');
      if (draftImgs && draftImgs.length > 0) {
        setSessionImages(draftImgs);
      } else {
        // 2. If draft empty, check History for today (to allow continuing work/editing)
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
      if(window.confirm('Clear all photos?')) {
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

  // Option 1: Share Text (Report)
  const handleShareText = async () => {
    triggerHaptic(settings.vibration);
    const saved = saveHistoryIfNeeded();

    let report = `📅 *${getTodayDateString()}* - ${t.bikes}\n\n`;
    BIKE_CATEGORIES.forEach(cat => {
      const count = getCount(cat);
      if (count > 0) report += `▪️ ${cat}: *${count}*\n`;
    });
    if (Object.keys(counts).length === 0) report += "No data";

    if (navigator.share && navigator.canShare && navigator.canShare({text: report})) {
      try {
        await navigator.share({
            title: 'Work Stats',
            text: report
        });
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

  // Option 2: Share Photos (Files Only)
  const handleSharePhotos = async () => {
    triggerHaptic(settings.vibration);
    
    if (sessionImages.length === 0) {
      onShowToast('No photos', 'error');
      return;
    }

    const saved = saveHistoryIfNeeded();

    if (navigator.share && navigator.canShare) {
      try {
        const filesArray = sessionImages.map((b64, idx) => 
          base64ToFile(b64, `bike_${idx+1}.jpg`)
        );

        if (navigator.canShare({ files: filesArray })) {
          await navigator.share({
            files: filesArray,
            title: 'Work Stats Photos'
          });
          // Do not send text here to avoid confusion in some apps
          onShowToast(t.sharing, 'success');
        } else {
          onShowToast('Sharing files not supported', 'error');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed', err);
          onShowToast('Share failed', 'error');
        }
      }
    } else {
      onShowToast('Sharing not supported on this device', 'error');
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

      <div className="flex justify-center w-full py-2">
         <button 
          onClick={handleClearData}
          className="flex items-center gap-2 px-3 py-2 text-red-500 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
        >
          <Trash2 size={16} />
          {t.clearData}
        </button>
      </div>

      <div className="fixed bottom-24 right-4 z-30 flex gap-3">
          <button
            onClick={handleCameraClick}
            className="bg-slate-700 hover:bg-slate-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-transform active:scale-90 relative"
          >
            <Camera size={24} />
            {sessionImages.length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-800">
                {sessionImages.length}
              </div>
            )}
          </button>
          
          <button
            onClick={handleShareText}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90 gap-2 flex-1"
          >
            <FileText size={20} strokeWidth={2.5} />
            <span className="font-bold text-sm uppercase">{t.shareText}</span>
          </button>

          <button
            onClick={handleSharePhotos}
            className={`bg-blue-600 hover:bg-blue-500 text-white px-4 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90 gap-2 flex-1 ${sessionImages.length === 0 ? 'opacity-50 grayscale' : ''}`}
            disabled={sessionImages.length === 0}
          >
            <ImageIcon2 size={20} strokeWidth={2.5} />
            <span className="font-bold text-sm uppercase">{t.sharePhotos}</span>
          </button>
      </div>

      <BottomSheet
        isOpen={!!activeCat}
        onClose={() => setActiveCat(null)}
        title={activeCat || ''}
      >
        <div className="flex flex-col gap-6 items-center pt-4 pb-8">
          <div className="text-8xl font-black font-mono text-slate-900 dark:text-white tracking-tighter select-none">
            {activeCat ? getCount(activeCat) : 0}
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