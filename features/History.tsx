import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Trash2, Calendar, CheckCircle2, Sparkles, ChevronRight, Users, Bike, Package, Clock, ImageIcon, RefreshCw } from 'lucide-react';
import { Card, BottomSheet, Button } from '../components/UI';
import { getISOWeek } from '../utils';

interface Props {
  settings: AppSettings;
  history: HistoryEntry[];
  onClear: () => void;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onUpdateEntry: (id: string, patch: Partial<HistoryEntry>) => void;
  isAdmin: boolean;
}

export const History: React.FC<Props> = ({ settings, history, onClear, onShowToast, onUpdateEntry, isAdmin }) => {
  const t = TRANSLATIONS[settings.language];
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [syncingDayKey, setSyncingDayKey] = useState<string | null>(null);

  const handleRetrySync = async (entry: HistoryEntry) => {
    const isMicrosoft = settings.syncProvider === 'microsoft';
    const url = isMicrosoft ? settings.microsoftWebhookUrl : settings.webhookUrl;
    if (!url) {
      onShowToast('No webhook URL configured', 'error');
      return;
    }

    setRetryingId(entry.id);
    try {
      const entryDate = new Date(entry.date);
      const payload = entry.type === 'office'
        ? { date: entry.date, week: getISOWeek(entryDate), room: entry.room, items: entry.details }
        : { date: entry.date, week: getISOWeek(entryDate), type: entry.type, items: entry.details };

      if (isMicrosoft) {
        const res = await fetch(url, {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await fetch(url, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
        });
      }

      onUpdateEntry(entry.id, { syncedToExcel: true, syncedAt: new Date().toISOString() });
      onShowToast(t.success, 'success');
    } catch (err) {
      console.error('Retry sync failed', err);
      onShowToast('Sync failed', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleSyncDay = async (dayKey: string, entries: HistoryEntry[]) => {
    const syncable = entries.filter(e => e.type !== 'bikes');
    if (!syncable.length) return;

    const isMicrosoft = settings.syncProvider === 'microsoft';
    const url = isMicrosoft ? settings.microsoftWebhookUrl : settings.webhookUrl;
    if (!url) {
      onShowToast('No webhook URL configured', 'error');
      return;
    }

    setSyncingDayKey(dayKey);
    let ok = 0;
    for (const entry of syncable) {
      try {
        const entryDate = new Date(entry.date);
        const payload = entry.type === 'office'
          ? { date: entry.date, week: getISOWeek(entryDate), room: entry.room, items: entry.details }
          : { date: entry.date, week: getISOWeek(entryDate), type: entry.type, items: entry.details };

        if (isMicrosoft) {
          const res = await fetch(url, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          await fetch(url, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
          });
        }
        onUpdateEntry(entry.id, { syncedToExcel: true, syncedAt: new Date().toISOString() });
        ok++;
      } catch (err) {
        console.error('Day sync failed for entry', entry.id, err);
      }
    }
    setSyncingDayKey(null);
    onShowToast(`${t.success} (${ok}/${syncable.length})`, ok === syncable.length ? 'success' : 'error');
  };

  // Grouping: year → date → type
  // dateTimestamps tracks the latest timestamp per date key for sorting.
  const locale = settings.language === 'ua' ? 'uk-UA' : 'en-GB';

  type DateGroup = Record<string, Record<string, HistoryEntry[]>>;
  const groupedByYear: Record<string, DateGroup> = {};
  const dateTimestamps: Record<string, number> = {}; // dateKey → max timestamp for sort

  for (const entry of history) {
    const d = new Date(entry.date);
    const year = d.getFullYear().toString();
    const dateKey = d.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
    const ts = d.getTime();

    if (!groupedByYear[year]) groupedByYear[year] = {};
    if (!groupedByYear[year][dateKey]) groupedByYear[year][dateKey] = {};
    if (!groupedByYear[year][dateKey][entry.type]) groupedByYear[year][dateKey][entry.type] = [];
    groupedByYear[year][dateKey][entry.type].push(entry);

    if (!dateTimestamps[dateKey] || ts > dateTimestamps[dateKey]) dateTimestamps[dateKey] = ts;
  }

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  const handleAnalyze = async () => {
    if (!process.env.API_KEY) {
      onShowToast("API Key not configured", 'error');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const historySample = history.slice(0, 15);
      
      const prompt = `Analyze this work statistics history. Focus on trends and anomalies.
      Reply in ${settings.language === 'ua' ? 'Ukrainian' : 'English'}.
      Data: ${JSON.stringify(historySample)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAnalysisResult(response.text || "No analysis generated.");
    } catch (e) {
      onShowToast("Analysis failed", 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'personnel': return <Users size={18} className="text-blue-500" />;
      case 'bikes': return <Bike size={18} className="text-orange-500" />;
      case 'office': return <Package size={18} className="text-indigo-500" />;
      default: return <Calendar size={18} />;
    }
  };

  const getTypeName = (type: string) => {
    switch(type) {
      case 'personnel': return t.personnel;
      case 'bikes': return t.bikes;
      case 'office': return t.office;
      default: return type;
    }
  };

  return (
    <div className="pb-32">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.history}</h2>
        {history.length > 0 && isAdmin && (
          <button
            onClick={() => { if(window.confirm(t.confirmClear)) onClear(); }}
            className="text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-full border border-red-100 dark:border-red-900/30 active:scale-95 transition-all"
          >
            <Trash2 size={14} /> {t.clearHistory}
          </button>
        )}
      </div>

      {history.length > 0 && (
        <Card 
          onClick={handleAnalyze}
          className="mb-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 border-none !text-white shadow-xl shadow-indigo-500/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <Sparkles size={28} className="text-yellow-200" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Gemini Insights</h3>
                <p className="text-white/80 text-xs">Аналіз трендів за останній тиждень</p>
              </div>
            </div>
            {isAnalyzing ? (
               <div className="animate-spin h-6 w-6 border-3 border-white/30 border-t-white rounded-full" />
            ) : (
               <ChevronRight size={20} className="text-white/50" />
            )}
          </div>
        </Card>
      )}

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
           <Calendar size={64} className="mb-4 stroke-[1.5]" />
           <p className="font-medium text-lg">{t.noHistory}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedYears.map((year) => {
            const sortedDates = Object.keys(groupedByYear[year]).sort(
              (a, b) => (dateTimestamps[b] ?? 0) - (dateTimestamps[a] ?? 0)
            );

            return (
              <div key={year}>
                {/* Year header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-black text-slate-200 dark:text-slate-700">{year}</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>

                <div className="space-y-8">
                  {sortedDates.map((date) => {
                    const allForDay = Object.values(groupedByYear[year][date]).flat() as HistoryEntry[];
                    const hasSyncable = allForDay.some(e => e.type !== 'bikes');
                    const dayKey = `${year}-${date}`;
                    return (
                    <div key={date} className="space-y-4">
                      <h3 className="sticky top-16 z-10 py-3 text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                        <span className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                        {date}
                        <span className="flex-1" />
                        {hasSyncable && (
                          <button
                            onClick={() => handleSyncDay(dayKey, allForDay)}
                            disabled={syncingDayKey === dayKey}
                            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-100 dark:border-blue-900/30 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {syncingDayKey === dayKey
                              ? <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              : <RefreshCw size={11} />
                            }
                            {t.submit}
                          </button>
                        )}
                      </h3>

                      <div className="space-y-6">
                        {Object.entries(groupedByYear[year][date]).map(([type, entries]) => (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center gap-2 px-1 mb-1">
                              {getTypeIcon(type)}
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {getTypeName(type)}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {(entries as HistoryEntry[]).map((entry) => (
                                <Card
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entry)}
                                  className="relative group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all duration-300 active:scale-98"
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">{entry.summary}</p>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                          <Clock size={12} />
                                          {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {entry.images && entry.images.length > 0 && (
                                          <span className="text-xs font-bold text-blue-500 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                            <ImageIcon size={12} /> {entry.images.length}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {entry.syncedToExcel ? (
                                        <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                                      ) : entry.type !== 'bikes' && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleRetrySync(entry); }}
                                          disabled={retryingId === entry.id}
                                          className="p-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 hover:bg-orange-100 active:scale-90 transition-all disabled:opacity-50"
                                          title="Retry sync"
                                        >
                                          <RefreshCw size={14} className={retryingId === entry.id ? 'animate-spin' : ''} />
                                        </button>
                                      )}
                                      <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Analysis Result Modal */}
      <BottomSheet
        isOpen={!!analysisResult}
        onClose={() => setAnalysisResult(null)}
        title="AI Intelligence"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 leading-relaxed text-slate-700 dark:text-slate-300">
             {(analysisResult?.split('\n') ?? []).map((line, i) => (
               <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-3'}>{line}</p>
             ))}
          </div>
          <Button fullWidth onClick={() => setAnalysisResult(null)} variant="primary">
            {t.confirmClear ? 'Зрозуміло' : 'Got it'}
          </Button>
        </div>
      </BottomSheet>

      {/* Full Detail View Modal */}
      <BottomSheet
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.summary || 'Details'}
      >
        {selectedEntry && (
          <div className="space-y-8 pb-8">
            <div className="flex items-center justify-between text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                 <Calendar size={18} />
                 <span className="font-medium">
                    {new Date(selectedEntry.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </span>
              </div>
              <div className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {new Date(selectedEntry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Photos Section */}
            {selectedEntry.images && selectedEntry.images.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <ImageIcon size={16} /> Photos
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedEntry.images.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={img} 
                      alt={`Evidence ${idx + 1}`} 
                      className="rounded-xl border border-slate-200 dark:border-slate-700 w-full h-auto object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Data Table */}
            <div>
               <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Data</h4>
               <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                 {Object.entries(selectedEntry.details).map(([key, val], idx) => (
                   <div 
                     key={key} 
                     className={`flex justify-between items-center p-4 ${idx !== Object.entries(selectedEntry.details).length - 1 ? 'border-b border-slate-200/50 dark:border-slate-800/50' : ''}`}
                   >
                     <span className="font-medium text-slate-700 dark:text-slate-300">{key}</span>
                     <span className="font-mono font-bold text-xl text-blue-600 dark:text-blue-400">{val as React.ReactNode}</span>
                   </div>
                 ))}
               </div>
            </div>

            <Button fullWidth variant="secondary" onClick={() => setSelectedEntry(null)}>
              {t.later}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};