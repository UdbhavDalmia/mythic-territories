import React from 'react';
import { Users, Globe2, Bot, ArrowLeft } from 'lucide-react';

export default function ModeSelectModal({
  showModes,
  showMultiplayer,
  modesOverlayRef,
  modeCardsRef,
  modesBackRef,
  isTransitioningRef,
  handleCloseModes,
  handleModesToMultiplayer,
  loadMultiplayer,
  handleCardMouseMove,
  handleCardMouseLeave,
  navigateTo
}) {
  if (!showModes) return null;

  return (
    <div
      ref={modesOverlayRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-void-black/80 backdrop-blur-md ${showModes && showMultiplayer ? 'pointer-events-none' : ''}`}
      style={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === modesOverlayRef.current && !isTransitioningRef.current) handleCloseModes();
      }}
    >
      <div className="modal-content w-full max-w-5xl my-auto py-6">
        <div className="flex flex-col items-center">
          <div className="mb-7 md:mb-10 text-center">
            <p className="mb-2 font-label-caps text-[10px] tracking-[0.3em] text-on-surface-variant">Enter the conflict</p>
            <h2 className="almendra-font text-xl sm:text-2xl md:text-3xl text-ember-gold tracking-widest uppercase font-bold">
              Select Game Mode
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Pass & Play */}
            <button
              ref={el => modeCardsRef.current[0] = el}
              className="card-frost glass-obsidian border border-outline/20 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer"
              style={{ opacity: 0 }}
              onClick={() => navigateTo('GAME', { mode: 'local' })}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ice-light/10 flex items-center justify-center border border-ice-light/30 group-hover:bg-ice-light/20 transition-all duration-300 ease-out group-hover:scale-105 shrink-0">
                <Users className="h-5 w-5 sm:h-8 sm:w-8 text-ice-light" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start md:items-center">
                <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">PASS &amp; PLAY</h3>
                <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">Two commanders, one device</p>
                <span className="mt-3 rounded-full border border-ice-light/20 bg-ice-light/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-ice-light">Available</span>
              </div>
              <div className="h-1 w-12 bg-ice-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:block rounded-full" />
            </button>

            {/* Online Realm */}
            <button
              ref={el => modeCardsRef.current[1] = el}
              className="card-fire glass-obsidian border border-outline/20 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer"
              style={{ opacity: 0 }}
              onClick={handleModesToMultiplayer}
              onMouseEnter={loadMultiplayer}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-magma-core/10 flex items-center justify-center border border-magma-core/30 group-hover:bg-magma-core/20 transition-all duration-300 ease-out group-hover:scale-105 shrink-0">
                <Globe2 className="h-5 w-5 sm:h-8 sm:w-8 text-magma-core" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start md:items-center">
                <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">ONLINE REALM</h3>
                <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">Create or join with a realm code</p>
                <span className="mt-3 rounded-full border border-magma-core/20 bg-magma-core/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-magma-core">Available</span>
              </div>
              <div className="h-1 w-12 bg-magma-core opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:block rounded-full" />
            </button>

            {/* Ancient Trials */}
            <button
              ref={el => modeCardsRef.current[2] = el}
              className="card-gold glass-obsidian border border-outline/10 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 w-full cursor-not-allowed opacity-50 grayscale"
              style={{ opacity: 0 }}
              disabled={true}
            >
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ember-gold/10 flex items-center justify-center border border-ember-gold/30 shrink-0">
                <Bot className="h-5 w-5 sm:h-8 sm:w-8 text-ember-gold" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start md:items-center">
                <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">ANCIENT TRIALS</h3>
                <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">Test your tactics against the AI</p>
                <span className="mt-3 rounded-full border border-ember-gold/20 bg-ember-gold/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-ember-gold">Coming soon</span>
              </div>
            </button>
          </div>

          <button
            ref={modesBackRef}
            className="mt-8 md:mt-14 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-2 group cursor-pointer font-label-caps tracking-widest text-xs sm:text-sm"
            onClick={handleCloseModes}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 back-arrow-icon" aria-hidden="true" />
            RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}
