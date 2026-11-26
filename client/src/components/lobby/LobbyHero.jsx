import React from 'react';
import Swords from 'lucide-react/dist/esm/icons/swords.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import { triggerHaptic } from '../../services/haptics.js';
import RecoverableSessionBanner from './RecoverableSessionBanner.jsx';

function LobbyHero({
  recoverableSession,
  handleResumeSession,
  handleAbandonSession,
  titleRef,
  subtitleRef,
  playBtnRef,
  onWarm,
  setShowModes
}) {
  const prewarmLobbyFlow = () => {
    onWarm?.('GAME');
    import('gsap');
  };

  return (
    <main className="relative z-10 w-full flex-grow flex flex-col items-center justify-center px-4 pt-20 pb-12 text-center">
      <RecoverableSessionBanner
        recoverableSession={recoverableSession}
        handleResumeSession={handleResumeSession}
        handleAbandonSession={handleAbandonSession}
      />

      <div className="flex flex-col items-center mb-10 text-center">
        <div className="mb-5 flex items-center gap-3 font-label-caps text-[10px] sm:text-xs tracking-[0.3em] text-on-surface-variant">
          <span className="h-px w-8 bg-ice-light/50" />
          <Swords className="h-3.5 w-3.5 text-ember-gold" aria-hidden="true" />
          Frost versus Ash
          <span className="h-px w-8 bg-magma-core/50" />
        </div>
        <h1
          ref={titleRef}
          className="almendra-font animate-title-shimmer uppercase max-w-4xl leading-tight"
          style={{
            background: 'linear-gradient(135deg, rgb(137, 206, 255) 0%, rgb(245, 158, 11) 50%, rgb(137, 206, 255) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(rgba(137, 206, 255, 0.4) 0px 0px 20px) drop-shadow(rgba(245, 158, 11, 0.4) 0px 0px 20px)',
            fontWeight: 700,
            fontSize: 'clamp(42px, 8vw, 78px)'
          }}
        >
          MYTHIC TERRITORIES
        </h1>
        <p
          ref={subtitleRef}
          className="home-subtitle mt-5 max-w-2xl text-base sm:text-xl md:text-2xl leading-relaxed text-slate-200/90"
        >
          Command{' '}
          <span className="home-subtitle-frost">
            Frost
          </span>{' '}
          <span className="text-on-surface-variant/80 italic font-serif text-sm sm:text-base">or</span>{' '}
          <span className="home-subtitle-ash">
            Ash
          </span>{' '}
          in a tactical battle for territory, power, and dominion.
        </p>
      </div>
      <div className="relative flex flex-col items-center">
        <button
          ref={playBtnRef}
          className="home-play-button min-w-56 px-10 py-4 glass-obsidian transition-all duration-300 active:scale-95 group rounded-xl border border-ember-gold/40 hover:border-ember-gold/80 flex items-center justify-center gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold focus-visible:ring-offset-4 focus-visible:ring-offset-void-black"
          onMouseEnter={prewarmLobbyFlow}
          onTouchStart={prewarmLobbyFlow}
          onFocus={prewarmLobbyFlow}
          onClick={() => { triggerHaptic('light'); prewarmLobbyFlow(); setShowModes(true); }}
        >
          <span className="relative rye-font text-xl md:text-2xl text-ember-gold tracking-[0.32em] group-hover:translate-x-1 transition-transform block">
            PLAY
          </span>
          <ChevronRight className="h-5 w-5 text-ember-gold transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </button>
        <p className="mt-4 font-label-caps text-[10px] sm:text-xs tracking-[0.22em] text-on-surface-variant/70">
          Local and online battles
        </p>
      </div>
    </main>
  );
}

export default React.memo(LobbyHero);
