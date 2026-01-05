
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Trash2, Calendar, CheckCircle2, Sparkles, ChevronRight, Users, Bike, Package } from 'lucide-react';
import { Card, BottomSheet, Button } from '../components/UI';

interface Props {
  settings: AppSettings;
  history: HistoryEntry[];
  onClear: () => void;
  onShowToast: (msg: string, type: 'success' | 'error') => void;
}

export const History: React.FC<Props> = ({ settings, history, onClear, onShowToast }) => {
  const t = TRANSLATIONS[settings.language];
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // Grouping logic
  const groupedHistory = history.reduce((acc, entry) => {
    const dateKey = new Date(entry.date).toLocaleDateString(settings.language === 'ua' ? 'uk-UA' : 'en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    if (!acc[dateKey]) acc[dateKey] = {};
    
    if (!acc[dateKey][entry.type]) acc[dateKey][entry.type] = [];
    acc[dateKey][entry.type].push(entry);
    
    return acc;
  }, {} as Record<string, Record<string, HistoryEntry[]>>);

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => {
    // Basic date parsing for sorting
    return new Date(b).getTime() - new Date(a).getTime();
  });

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
        {history.length > 0 && (
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
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <h3 className="sticky top-16 z-10 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm">
                <span className="w-8 h-px bg-slate-200 dark:bg-slate-800"></span>
                {date}
              </h3>
              
              <div className="space-y-6">
                {Object.entries(groupedHistory[date]).map(([type, entries]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 mb-1">
                      {getTypeIcon(type)}
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {getTypeName(type)}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {entries.map((entry) => (
                        <Card key={entry.id} className="relative group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all duration-300">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">{entry.summary}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(entry.details).slice(0, 6).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                    <span className="opacity-60 mr-1">{key}:</span> {val as React.ReactNode}
                                  </span>
                                ))}
                                {Object.keys(entry.details).length > 6 && (
                                  <span className="text-[10px] text-slate-400 self-center">...</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                               <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded">
                                 {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                               {entry.synced && (
                                 <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Synced</span>
                                 </div>
                               )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
             {/* Fix: safely handle potentially undefined split result using the nullish coalescing operator to avoid unknown property access errors */}
             {(analysisResult?.split('\n') ?? []).map((line, i) => (
               <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-3'}>{line}</p>
             ))}
          </div>
          <Button fullWidth onClick={() => setAnalysisResult(null)} variant="primary">
            {t.confirmClear ? 'Зрозуміло' : 'Got it'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};
