import React from 'react';
import Swords from 'lucide-react/dist/esm/icons/swords.js';

export default function RecoverableSessionBanner({
  recoverableSession,
  handleResumeSession,
  handleAbandonSession
}) {
  if (!recoverableSession) return null;

  return (
    <div className="w-full max-w-xl mx-auto mb-6 p-3.5 sm:p-4 rounded-2xl border border-ember-gold/60 bg-void-black/95 backdrop-blur-xl shadow-[0_0_35px_rgba(245,158,11,0.3)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in z-20">
      <div className="flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-xl bg-ember-gold/15 border border-ember-gold/40 flex items-center justify-center shrink-0">
          <Swords className="h-5 w-5 text-ember-gold animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-xs text-ember-gold font-bold tracking-wider">ACTIVE REALM IN PROGRESS</span>
            <span className="font-mono text-[10px] text-pure-snow bg-ember-gold/20 px-1.5 py-0.5 rounded border border-ember-gold/30">{recoverableSession.roomId}</span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            You have an ongoing battle as <strong className="text-pure-snow capitalize">{recoverableSession.team}</strong>. Reconnect to resume command.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <button
          type="button"
          onClick={handleResumeSession}
          className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-ember-gold via-amber-500 to-magma-core text-void-black font-bold text-xs tracking-wider rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all font-label-caps cursor-pointer"
        >
          REJOIN BATTLE
        </button>
        <button
          type="button"
          onClick={handleAbandonSession}
          className="px-3 py-2 text-on-surface-variant hover:text-rose-400 text-xs tracking-wider transition-colors font-label-caps cursor-pointer"
          title="Abandon match"
        >
          ABANDON
        </button>
      </div>
    </div>
  );
}
