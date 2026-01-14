import React, { useState, useMemo } from 'react';
import { Card, BottomSheet, Button } from '../components/UI';
import { OFFICE_ROOMS, LIMITED_ROOMS, OFFICE_ITEMS, LIMITED_OFFICE_ITEMS, OFFICE_ITEM_TYPES, TRANSLATIONS, APP_VERSION } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { CloudUpload, ChevronRight, Check, Trash2 } from 'lucide-react';
import { triggerHaptic, generateId } from '../utils';

interface Props {
  settings: AppSettings;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onSaveHistory: (entry: HistoryEntry) => void;
  data: Record<string, Record<string, number | string>>;
  onUpdate: React.Dispatch<React.SetStateAction<Record<string, Record<string, number | string>>>>;
}

export const Office: React.FC<Props> = ({ settings, onShowToast, onSaveHistory, data: roomData, onUpdate: setRoomData }) => {
  const t = TRANSLATIONS[settings.language];
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine available items based on room
  const availableItems = useMemo(() => {
    if (!selectedRoom) return [];
    if (LIMITED_ROOMS.includes(selectedRoom)) return LIMITED_OFFICE_ITEMS;
    return OFFICE_ITEMS;
  }, [selectedRoom]);

  // Get value helper
  const getValue = (room: string, item: string) => {
    return roomData[room]?.[item] ?? '-';
  };

  // Update value
  const handleUpdate = (val: number | string) => {
    if (!selectedRoom || !selectedItem) return;
    triggerHaptic(settings.vibration);
    
    setRoomData(prev => ({
      ...prev,
      [selectedRoom]: {
        ...(prev[selectedRoom] || {}),
        [selectedItem]: val
      }
    }));
    setSelectedItem(null); // Close item sheet
  };

  const handleClear = () => {
    if (window.confirm(t.confirmClear)) {
      setRoomData({});
      onShowToast(t.dataCleared, 'success');
    }
  };

  // Cloud Sync Handler
  const handleSync = async () => {
    if (!selectedRoom) return;
    
    const currentRoomItems = roomData[selectedRoom];
    if (!currentRoomItems || Object.keys(currentRoomItems).length === 0) {
      onShowToast("No data for this room", 'error');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      date: new Date().toISOString(),
      room: selectedRoom,
      items: currentRoomItems
    };

    let synced = false;
    const url = settings.webhookUrl;

    try {
      
      if (url) {
        // Real Cloud Sync
        // Google Apps Script requires no-cors mode and text/plain to avoid preflight CORS issues
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify(payload)
        });

        // In no-cors mode, the response is opaque (status 0, ok false) so we cannot check response.ok.
        // If the fetch promise resolves without throwing, we assume the request was sent successfully.
        synced = true;
        onShowToast(t.success, 'success');
      } else {
        // Demo Mode / Local Save Only
        // Simulating network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        synced = true; // We treat local save as "synced" for demo purposes
        onShowToast(t.success, 'success');
      }

      // Save to History
      onSaveHistory({
        id: generateId(),
        date: payload.date,
        type: 'office',
        summary: `${t.office} - Room ${selectedRoom}`,
        details: currentRoomItems,
        synced: synced
      });

    } catch (error) {
      console.error("Sync failed:", error);
      // Save locally even if sync failed
      onSaveHistory({
        id: generateId(),
        date: payload.date,
        type: 'office',
        summary: `${t.office} - Room ${selectedRoom}`,
        details: currentRoomItems,
        synced: false
      });
      onShowToast(url ? 'Saved Locally (Sync Failed)' : t.error, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic Grid component for numeric input
  const NumberGrid = () => {
    const type = selectedItem ? OFFICE_ITEM_TYPES[selectedItem] || '0-5' : '0-5';
    let numbers: number[] = [];
    let gridCols = "grid-cols-4";

    switch(type) {
        case '0-5':
            numbers = [0, 1, 2, 3, 4, 5];
            gridCols = "grid-cols-3";
            break;
        case '0-10':
            numbers = Array.from({length: 11}, (_, i) => i);
            gridCols = "grid-cols-4";
            break;
        case '0-20':
            numbers = Array.from({length: 21}, (_, i) => i);
            gridCols = "grid-cols-5";
            break;
        case '0-100':
            numbers = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            gridCols = "grid-cols-4";
            break;
        case '0-1':
            numbers = [0, 1];
            gridCols = "grid-cols-2";
            break;
        default:
            numbers = [0, 1, 2, 3, 4, 5];
    }

    // Filter out 0 (Req: Remove 0 from grid, start from 1)
    numbers = numbers.filter(n => n !== 0);

    return (
      <div className={`grid ${gridCols} gap-3 p-2`}>
        <button 
            onClick={() => handleUpdate('-')} 
            className={`col-span-full bg-slate-100 dark:bg-slate-700 py-3 rounded-lg text-slate-500 font-bold active:scale-95 transition-transform`}
        >
            - (Empty)
        </button>
        {numbers.map(num => (
            <button
            key={num}
            onClick={() => handleUpdate(num)}
            className="aspect-square bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-lg font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 active:scale-90 transition-transform active:bg-blue-500 active:text-white active:border-blue-500 flex items-center justify-center"
            >
            {num}
            </button>
        ))}
      </div>
    );
  };

  // If no room selected, show room list
  if (!selectedRoom) {
    return (
      <div className="space-y-4 pb-32">
        <div className="grid grid-cols-3 gap-3">
          <h2 className="col-span-3 text-lg font-semibold text-slate-500 mb-2">{t.selectRoom}</h2>
          {OFFICE_ROOMS.map(room => {
             const hasData = roomData[room] && Object.keys(roomData[room]).length > 0;
             return (
              <Card 
                key={room} 
                onClick={() => setSelectedRoom(room)}
                className={`flex items-center justify-center h-20 transition-all ${
                  hasData 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-indigo-500/10'
                    : 'hover:border-blue-500 dark:hover:border-blue-400'
                }`}
              >
                <span className={`text-xl font-bold ${hasData ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>{room}</span>
              </Card>
             );
          })}
        </div>
        
        <div className="flex justify-between items-center w-full py-4 px-1">
            <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-3 py-2 text-red-500 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
            >
            <Trash2 size={16} />
            {t.clearData}
            </button>
            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono opacity-60">{APP_VERSION}</span>
        </div>
      </div>
    );
  }

  // Room View
  return (
    <div className="space-y-4 pb-32">
       <div className="flex items-center gap-2 mb-4">
         <button onClick={() => setSelectedRoom(null)} className="text-slate-400 hover:text-slate-600">
            {t.office}
         </button>
         <ChevronRight size={16} className="text-slate-400" />
         <span className="font-bold text-xl text-slate-800 dark:text-white">Room {selectedRoom}</span>
       </div>

       <div className="space-y-2">
         {availableItems.map(item => {
           const val = getValue(selectedRoom, item);
           const isSet = val !== '-';
           return (
             <div 
                key={item}
                onClick={() => setSelectedItem(item)}
                className={`p-4 rounded-xl flex justify-between items-center cursor-pointer transition-colors border ${isSet ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-transparent'}`}
             >
                <span className={`font-medium ${isSet ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>{item}</span>
                <span className={`font-mono font-bold ${isSet ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                  {val}
                </span>
             </div>
           );
         })}
       </div>

       {/* Floating Action Button for Cloud Sync */}
       <div className="fixed bottom-24 right-4 left-4 z-30">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleSync}
            disabled={isSubmitting}
            className="shadow-xl"
          >
            <div className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                 <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                 <CloudUpload size={20} />
              )}
              {isSubmitting ? t.submitting : t.submit}
            </div>
          </Button>
       </div>

       {/* Item Selection Grid Sheet */}
       <BottomSheet
         isOpen={!!selectedItem}
         onClose={() => setSelectedItem(null)}
         title={`${selectedRoom} - ${selectedItem}`}
       >
         <NumberGrid />
       </BottomSheet>
    </div>
  );
};