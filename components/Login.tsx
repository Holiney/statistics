import React, { useEffect, useRef } from 'react';
import { TelegramUser } from '../types';
import { motion } from 'framer-motion';

interface Props {
  onLogin: (user: TelegramUser) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Define the global callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onLogin(user);
    };

    if (containerRef.current) {
      // Clear previous content just in case
      containerRef.current.innerHTML = '';

      const script = document.createElement('script');
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute('data-telegram-login', 'statistikvit_bot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;

      containerRef.current.appendChild(script);
    }
  }, [onLogin]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700"
      >
        <div className="mb-8">
           <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white w-12 h-12">
               <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
               <path d="M22 12A10 10 0 0 0 12 2v10z" />
             </svg>
           </div>
           <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Work Stats</h1>
           <p className="text-slate-500 dark:text-slate-400">Please authorize to continue</p>
        </div>

        <div 
          ref={containerRef} 
          id="telegram-login-container" 
          className="flex justify-center min-h-[50px]"
        >
          {/* Telegram widget will be injected here */}
        </div>
        
        <p className="mt-8 text-xs text-slate-400">
           By logging in, you allow the app to identify you in statistics reports.
        </p>
      </motion.div>
    </div>
  );
};