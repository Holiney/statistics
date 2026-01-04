import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TRANSLATIONS } from '../constants';
import { AppSettings, HistoryEntry } from '../types';
import { Trash2, CloudCheck, Calendar, CheckCircle2, Sparkles, X } from 'lucide-react';
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

  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleAnalyze = async () => {
    if (!process.env.API_KEY) {
      onShowToast("API Key not configured", 'error');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Limit to last 20 entries to manage tokens context
      const historySample = sortedHistory.slice(0, 20);
      
      const prompt = `Act as a logistics assistant. Analyze the following work statistics history. 
      Identify key trends (e.g., busiest zones, most common bikes, or supplies usage) and anomalies.
      Keep the summary concise, professional, and encouraging.
      IMPORTANT: Reply in the language code: "${settings.language}".
      
      Data: ${JSON.stringify(historySample)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAnalysisResult(response.text || "No analysis generated.");
    } catch (e) {
      console.error(e);
      onShowToast("Analysis failed. Try again.", 'error');
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.history}</h2>
        {history.length > 0 && (
          <button 
            onClick={() => { if(window.confirm(t.confirmClear)) onClear(); }}
            className="text-red-500 text-sm font-medium flex items-center gap-1 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full"
          >
            <Trash2 size={14} /> {t.clearHistory}
          </button>
        )}
      </div>

      {history.length > 0 && (
        <Card 
          onClick={handleAnalyze}
          className="mb-6 bg-gradient-to-r from-violet-600 to-indigo-600 border-none !text-white cursor-pointer active:scale-98 transition-transform"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles size={24} className="text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Insights</h3>
                <p className="text-indigo-100 text-sm opacity-90">Analyze trends with Gemini</p>
              </div>
            </div>
            {isAnalyzing && (
               <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            )}
          </div>
        </Card>
      )}

      {history.length === 0 ? (
        <div className="text-center py-20 opacity-50">
           <Calendar size={48} className="mx-auto mb-4" />
           <p>{t.noHistory}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedHistory.map((entry) => (
            <Card key={entry.id} className="relative overflow-hidden">
               {entry.synced && (
                 <div className="absolute top-0 right-0 p-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-bl-xl text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} />
                 </div>
               )}
               <div className="flex justify-between items-start mb-2">
                 <div>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      entry.type === 'office' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                      entry.type === 'bikes' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {entry.type === 'personnel' ? t.personnel : entry.type === 'bikes' ? t.bikes : t.office}
                    </span>
                 </div>
                 <span className="text-xs text-slate-400 font-mono">
                   {new Date(entry.date).toLocaleString()}
                 </span>
               </div>
               
               <p className="font-semibold text-slate-800 dark:text-slate-200">{entry.summary}</p>
               
               {/* Tiny detail summary */}
               <div className="mt-2 flex flex-wrap gap-1">
                 {Object.entries(entry.details).slice(0, 5).map(([key, val]) => (
                   <span key={key} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                     {key}: {val as React.ReactNode}
                   </span>
                 ))}
                 {Object.keys(entry.details).length > 5 && (
                   <span className="text-xs px-1 text-slate-400">...</span>
                 )}
               </div>
            </Card>
          ))}
        </div>
      )}

      {/* Analysis Result Modal */}
      <BottomSheet
        isOpen={!!analysisResult}
        onClose={() => setAnalysisResult(null)}
        title="AI Analysis"
      >
        <div className="space-y-4">
          <div className="prose dark:prose-invert text-slate-700 dark:text-slate-300">
             {analysisResult?.split('\n').map((line, i) => (
               <p key={i} className="mb-2">{line}</p>
             ))}
          </div>
          <Button fullWidth onClick={() => setAnalysisResult(null)}>
            Close
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};