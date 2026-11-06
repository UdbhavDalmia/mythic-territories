import React from 'react';
import * as C from '../../../shared/constants.js';

export default function AscensionModal({ gameState, sendAction }) {
  const pending = gameState?.pendingAscension;
  if (!pending) return null;

  const roleChoices = C.ASCENSION_CHOICES[pending.role];
  const choices = roleChoices ? [roleChoices.A, roleChoices.B] : [];
  const isSnow = pending.team === 'snow';

  const overlayBg = isSnow 
    ? 'bg-blue-950/80 backdrop-blur-md border-blue-500/30' 
    : 'bg-red-950/80 backdrop-blur-md border-red-500/30';
    
  const textTheme = isSnow ? 'text-ice-light' : 'text-magma-core';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/85 backdrop-blur-sm p-4">
      <div className={`border-2 rounded-xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-[shatterIn_0.4s_ease-out] ${overlayBg}`}>
        
        <header className="text-center space-y-1">
          <p className="font-label-caps text-[10px] sm:text-xs tracking-widest text-ember-gold font-bold">PRIMAL ASCENSION UNLOCKED</p>
          <h2 className="font-almendra text-2xl sm:text-3xl text-white font-bold leading-tight">
            {pending.role.toUpperCase()} ASCENSION
          </h2>
        </header>

        {/* Path Descriptions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {choices.map((choice, index) => {
            const descText = choice.passive || (choice.team && choice.team[pending.team]) || '';
            const pathName = choice.name;
            return (
              <div 
                key={index} 
                className="bg-void-black/50 border border-outline/10 p-5 rounded-lg space-y-2 flex flex-col justify-between hover:border-outline/30 transition-all"
              >
                <div className="space-y-1">
                  <h4 className={`font-almendra text-lg font-bold ${textTheme}`}>{pathName}</h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    {descText}
                  </p>
                </div>
                <button
                  className={`w-full py-2.5 mt-4 rounded font-label-caps text-[11px] font-bold border transition-colors ${
                    isSnow 
                      ? 'bg-blue-600/10 border-blue-500/30 text-ice-light hover:bg-blue-600/30' 
                      : 'bg-red-600/10 border-red-500/30 text-magma-core hover:bg-red-600/30'
                  }`}
                  onClick={() => sendAction('ASCENSION_CHOICE', { choice: index === 0 ? 'PathA' : 'PathB' })}
                >
                  Choose {pathName}
                </button>
              </div>
            );
          })}
        </div>

        {/* Cancel Button */}
        <button
          className="w-full py-2 border border-outline/25 text-xs font-label-caps text-on-surface-variant hover:text-white rounded hover:bg-white/5 transition-all"
          onClick={() => sendAction('CANCEL_ASCENSION', {})}
        >
          Cancel Ascension
        </button>

      </div>
    </div>
  );
}
