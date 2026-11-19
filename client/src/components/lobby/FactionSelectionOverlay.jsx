import React from 'react';
import FactionBanner from '../FactionBanner.jsx';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeClosed from 'lucide-react/dist/esm/icons/eye-closed.js';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';

export default function FactionSelectionOverlay({
  showFactionSelection,
  factionOverlayRef,
  currentRoomId,
  copiedLink,
  handleCopyInviteLink,
  disbandCountdown,
  playersList,
  snowCardRef,
  ashCardRef,
  hoveredFaction,
  setHoveredFaction,
  handleSelectFaction,
  factionBackRef,
  handleCancelFaction,
  currentMode,
  snowBtnState,
  ashBtnState
}) {
  if (!showFactionSelection) return null;

  return (
            <div
          ref={factionOverlayRef}
          className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-1 sm:pt-2 md:pt-3 pb-2 px-2 sm:px-4 md:px-6 bg-void-black/92 backdrop-blur-xl overflow-y-auto"
          style={{ opacity: 0 }}
        >
          <div className="modal-content w-full max-w-6xl xl:max-w-7xl flex flex-col items-center overflow-visible my-4 sm:my-0">
            <div className="flex flex-col items-center py-0.5 w-full overflow-visible">

              {/* Header */}
              <div className="flex flex-col items-center text-center mb-1 sm:mb-1.5">
                <div className="flex items-center gap-1.5 text-ember-gold/70 text-[8px] sm:text-[9px] font-label-caps tracking-[0.25em] uppercase">
                  <span>⚔️</span>
                  <span>CLASH OF REALMS</span>
                  <span>⚔️</span>
                </div>
                <h2 className="almendra-font text-lg sm:text-2xl md:text-3xl text-ember-gold tracking-widest uppercase font-bold drop-shadow-[0_2px_14px_rgba(245,158,11,0.4)]">
                  CHOOSE YOUR FACTION
                </h2>
                <p className="text-on-surface-variant font-label-caps text-[8px] sm:text-[10px] tracking-[0.18em] uppercase opacity-75 mt-0">
                  Command your legion &bull; Conquer elemental territory
                </p>
              </div>

              {/* Realm & Match Status Bar */}
              {currentRoomId && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 mb-3 md:mb-10 w-full max-w-xl">
                  {/* Realm code badge + copy */}
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-void-black/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1 rounded-xl border border-ember-gold/30 shadow-md">
                    <Shield className="h-3 w-3 text-ember-gold" />
                    <span className="text-[9px] sm:text-[11px] font-label-caps text-ember-gold/80 tracking-wider">REALM</span>
                    <strong className="font-mono text-[11px] sm:text-xs text-pure-snow tracking-wider px-1.5 py-0.5 rounded-md bg-ember-gold/10 border border-ember-gold/25">
                      {currentRoomId}
                    </strong>
                    <button
                      type="button"
                      className="ml-1 px-2 py-0.5 text-[9px] sm:text-[10px] bg-ember-gold/15 hover:bg-ember-gold/30 border border-ember-gold/40 text-ember-gold hover:text-pure-snow rounded-lg cursor-pointer transition-all active:scale-95 font-label-caps flex items-center gap-1 shadow-sm"
                      onClick={() => handleCopyInviteLink(currentRoomId)}
                      title="Copy Realm Invite Link"
                    >
                      {copiedLink ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5 text-ember-gold" />}
                      <span>{copiedLink ? 'Copied' : 'Invite'}</span>
                    </button>
                  </div>

                  {/* Opponent Status Pill */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-void-black/70 border border-outline/20 backdrop-blur-sm text-[9px] sm:text-[11px] font-label-caps tracking-wider shadow-inner">
                    <span className={`inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${playersList.length >= 2 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
                    <span className={playersList.length >= 2 ? 'text-emerald-400 font-semibold' : 'text-on-surface-variant flex items-center gap-1.5'}>
                      {playersList.length >= 2 ? (
                        '2 Connected'
                      ) : (
                        <>
                          <Clock className="h-2.5 w-2.5 text-ember-gold/80" />
                          <span>Waiting for opponent... ({Math.floor(disbandCountdown / 60)}:{(disbandCountdown % 60).toString().padStart(2, '0')})</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ── MOBILE VIEW (< md): Clean Horizontal Cohesive Faction Cards ── */}
              <div className="flex md:hidden flex-col gap-2.5 w-full max-w-lg my-1">
                {/* Mobile Frost Card */}
                <div
                  className={`card-frost card-no-tilt glass-obsidian border rounded-2xl overflow-hidden flex flex-row items-center p-2.5 gap-2.5 transition-all duration-300 cursor-pointer ${snowBtnState.status === 'mine'
                    ? 'border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-[0_0_25px_rgba(52,211,153,0.3)]'
                    : snowBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : hoveredFaction === 'snow'
                        ? 'border-ice-light ring-2 ring-ice-light/35 bg-sky-950/30'
                        : 'border-ice-light/30 bg-sky-950/20'
                    }`}
                  onClick={() => !snowBtnState.disabled && handleSelectFaction('snow')}
                >
                  <div className="w-24 sm:w-28 h-36 sm:h-40 flex-shrink-0 flex items-center justify-center border-r border-ice-light/20 pr-1 relative">
                    <FactionBanner faction="frost" idPrefix="lobby-frost-m" className="h-full w-auto" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between h-full py-0.5 gap-1.5">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">❄</span>
                        <h3 className="text-sm sm:text-base text-ice-light tracking-widest uppercase almendra-font font-bold">
                          FROST DOMAIN
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-[10px] sm:text-xs leading-relaxed line-clamp-3">
                        Absolute order and crystalline geometry. Freeze encroaching enemies and claim eternal winter dominion.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`w-full py-1.5 px-3 rounded-lg tracking-widest transition-all rye-font text-[10px] font-bold flex items-center justify-center gap-1.5 ${snowBtnState.status === 'mine'
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                        : snowBtnState.status === 'occupied'
                          ? 'bg-void-black/60 border border-outline/30 text-on-surface-variant/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-ice-light/25 to-sky-400/35 border border-ice-light/60 text-pure-snow'
                        }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!snowBtnState.disabled) handleSelectFaction('snow');
                      }}
                      disabled={snowBtnState.disabled}
                    >
                      {snowBtnState.status === 'mine' && <Check className="h-3 w-3 text-emerald-400" />}
                      <span>{snowBtnState.label}</span>
                      {snowBtnState.status === 'available' && <ChevronRight className="h-3 w-3 text-ice-light" />}
                    </button>
                  </div>
                </div>

                {/* Mobile Ash Card */}
                <div
                  className={`card-fire card-no-tilt glass-obsidian border rounded-2xl overflow-hidden flex flex-row items-center p-2.5 gap-2.5 transition-all duration-300 cursor-pointer ${ashBtnState.status === 'mine'
                    ? 'border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-[0_0_25px_rgba(52,211,153,0.3)]'
                    : ashBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : hoveredFaction === 'ash'
                        ? 'border-magma-core ring-2 ring-magma-core/35 bg-rose-950/30'
                        : 'border-magma-core/30 bg-rose-950/20'
                    }`}
                  onClick={() => !ashBtnState.disabled && handleSelectFaction('ash')}
                >
                  <div className="w-24 sm:w-28 h-36 sm:h-40 flex-shrink-0 flex items-center justify-center border-r border-magma-core/20 pr-1 relative">
                    <FactionBanner faction="ash" idPrefix="lobby-ash-m" className="h-full w-auto" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between h-full py-0.5 gap-1.5">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">🔥</span>
                        <h3 className="text-sm sm:text-base text-magma-core tracking-widest uppercase almendra-font font-bold">
                          ASH DOMAIN
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-[10px] sm:text-xs leading-relaxed line-clamp-3">
                        Explosive violence and volcanic power. Break enemy lines with raw lava bombardments and scorched-earth dominance.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`w-full py-1.5 px-3 rounded-lg tracking-widest transition-all rye-font text-[10px] font-bold flex items-center justify-center gap-1.5 ${ashBtnState.status === 'mine'
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                        : ashBtnState.status === 'occupied'
                          ? 'bg-void-black/60 border border-outline/30 text-on-surface-variant/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-magma-core/25 to-rose-600/35 border border-magma-core/60 text-pure-snow'
                        }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!ashBtnState.disabled) handleSelectFaction('ash');
                      }}
                      disabled={ashBtnState.disabled}
                    >
                      {ashBtnState.status === 'mine' && <Check className="h-3 w-3 text-emerald-400" />}
                      <span>{ashBtnState.label}</span>
                      {ashBtnState.status === 'available' && <ChevronRight className="h-3 w-3 text-magma-core" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── DESKTOP VIEW (md:): Truly Connected L-Wings with Zero Seam ── */}
              <div className="hidden md:flex flex-row items-stretch justify-center w-full max-w-6xl xl:max-w-7xl overflow-visible my-1 md:h-[390px] lg:h-[415px]">

                {/* LEFT: FROST HERALDIC BANNER PILLAR (SEAMLESSLY CONNECTED AT TOP) */}
                <div
                  ref={snowCardRef}
                  className={`glass-obsidian border-t border-b border-l border-r-0 rounded-l-2xl rounded-r-none overflow-hidden flex flex-col items-center justify-center relative p-3 w-56 lg:w-64 xl:w-72 h-full flex-shrink-0 cursor-pointer transition-all duration-300 z-10 ${snowBtnState.status === 'mine'
                    ? 'border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)] bg-sky-950/30'
                    : snowBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : hoveredFaction === 'snow'
                        ? 'border-ice-light shadow-[0_0_30px_rgba(56,189,248,0.25)] bg-sky-950/35'
                        : 'border-ice-light/35 bg-sky-950/20'
                    }`}
                  style={{ opacity: 0 }}
                  onMouseEnter={() => setHoveredFaction('snow')}
                  onMouseLeave={() => setHoveredFaction(null)}
                  onClick={() => !snowBtnState.disabled && handleSelectFaction('snow')}
                >
                  {/* Atmospheric Radial Aura */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.28)_0%,_transparent_75%)] pointer-events-none" />

                  {/* Status Badges */}
                  {snowBtnState.status === 'mine' && (
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 backdrop-blur-md text-emerald-300 font-label-caps text-[8px] sm:text-[9px] tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>CHOSEN</span>
                    </div>
                  )}
                  {snowBtnState.status === 'occupied' && (
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-void-black/80 border border-outline/40 backdrop-blur-md text-on-surface-variant font-label-caps text-[8px] sm:text-[9px] tracking-widest">
                      <Lock className="h-3 w-3 text-magma-core" />
                      <span>OCCUPIED</span>
                    </div>
                  )}

                  {/* Heraldic Faction Banner */}
                  <div className={`h-full w-full max-w-[190px] flex items-center justify-center transition-transform duration-500 ease-out ${hoveredFaction === 'snow' ? 'scale-105 -translate-y-1' : ''}`}>
                    <FactionBanner faction="frost" idPrefix="lobby-frost" className="h-full w-auto" />
                  </div>

                  {/* Realm Pillar Label */}
                  <div className="absolute bottom-2 inset-x-0 flex flex-col items-center pointer-events-none">
                    <span className="text-[9px] font-label-caps tracking-[0.25em] text-ice-light/80 uppercase font-semibold">
                      FROST REALM
                    </span>
                  </div>

                  {/* Border line on the lower exposed half where no desc box touches */}
                  <div className={`hidden md:block absolute right-0 bottom-0 top-[180px] lg:top-[195px] w-[1px] pointer-events-none transition-colors duration-300 ${snowBtnState.status === 'mine' ? 'bg-emerald-400' : hoveredFaction === 'snow' ? 'bg-ice-light' : 'bg-ice-light/35'
                    }`} />
                </div>

                {/* CENTER: DIVIDED IN HALF */}
                <div className="flex-1 flex flex-col justify-between h-full">

                  {/* TOP HALF: SNOW REGION (FLUSH OVERLAP BY 1PX, ZERO DIVIDING LINE) */}
                  <div
                    className={`glass-obsidian border-t border-b border-r border-l-0 rounded-r-2xl rounded-l-none -ml-[1px] mr-6 lg:mr-8 p-4 lg:p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer h-[180px] lg:h-[195px] ${snowBtnState.status === 'mine'
                      ? 'border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)] bg-sky-950/30'
                      : snowBtnState.status === 'occupied'
                        ? 'border-outline/20 opacity-55 grayscale-[35%]'
                        : hoveredFaction === 'snow'
                          ? 'border-ice-light shadow-[0_0_30px_rgba(56,189,248,0.25)] bg-sky-950/35'
                          : 'border-ice-light/35 bg-sky-950/20'
                      }`}
                    onMouseEnter={() => setHoveredFaction('snow')}
                    onMouseLeave={() => setHoveredFaction(null)}
                    onClick={() => !snowBtnState.disabled && handleSelectFaction('snow')}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base sm:text-lg">❄</span>
                        <h3 className="text-lg sm:text-xl md:text-2xl text-ice-light tracking-widest uppercase almendra-font font-bold drop-shadow-[0_0_12px_rgba(56,189,248,0.45)]">
                          FROST DOMAIN
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed max-w-2xl">
                        Absolute order and crystalline geometry. Freeze encroaching enemies, raise impassable glacial barriers, and claim eternal winter dominion across the northern tundra.
                      </p>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        className={`w-full sm:w-auto min-w-[240px] md:min-w-[280px] py-1.5 sm:py-2 px-8 sm:px-12 rounded-xl tracking-[0.2em] transition-all rye-font text-[11px] sm:text-xs font-bold flex items-center justify-center gap-2 ${snowBtnState.status === 'mine'
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-default'
                          : snowBtnState.status === 'occupied'
                            ? 'bg-void-black/60 border border-outline/30 text-on-surface-variant/40 cursor-not-allowed'
                            : 'bg-gradient-to-r from-ice-light/25 via-sky-400/35 to-ice-light/25 hover:from-sky-400/45 hover:to-ice-light/45 border border-ice-light/60 hover:border-ice-light text-pure-snow shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] cursor-pointer active:scale-98'
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!snowBtnState.disabled) handleSelectFaction('snow');
                        }}
                        disabled={snowBtnState.disabled}
                      >
                        {snowBtnState.status === 'mine' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        <span>{snowBtnState.label}</span>
                        {snowBtnState.status === 'available' && <ChevronRight className="h-3.5 w-3.5 text-ice-light group-hover:translate-x-1 transition-transform" />}
                      </button>
                    </div>
                  </div>

                  {/* BOTTOM HALF: ASH REGION (FLUSH OVERLAP BY 1PX, ZERO DIVIDING LINE) */}
                  <div
                    className={`glass-obsidian border-t border-b border-l border-r-0 rounded-l-2xl rounded-r-none ml-6 lg:ml-8 -mr-[1px] p-4 lg:p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer h-[180px] lg:h-[195px] ${ashBtnState.status === 'mine'
                      ? 'border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)] bg-rose-950/30'
                      : ashBtnState.status === 'occupied'
                        ? 'border-outline/20 opacity-55 grayscale-[35%]'
                        : hoveredFaction === 'ash'
                          ? 'border-magma-core shadow-[0_0_30px_rgba(239,68,68,0.25)] bg-rose-950/35'
                          : 'border-magma-core/35 bg-rose-950/20'
                      }`}
                    onMouseEnter={() => setHoveredFaction('ash')}
                    onMouseLeave={() => setHoveredFaction(null)}
                    onClick={() => !ashBtnState.disabled && handleSelectFaction('ash')}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base sm:text-lg">🔥</span>
                        <h3 className="text-lg sm:text-xl md:text-2xl text-magma-core tracking-widest uppercase almendra-font font-bold drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">
                          ASH DOMAIN
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed max-w-2xl">
                        Explosive violence and volcanic power. Break enemy lines with raw lava bombardments, molten hazards, and scorched-earth dominance from the molten caldera.
                      </p>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        className={`w-full sm:w-auto min-w-[240px] md:min-w-[280px] py-1.5 sm:py-2 px-8 sm:px-12 rounded-xl tracking-[0.2em] transition-all rye-font text-[11px] sm:text-xs font-bold flex items-center justify-center gap-2 ${ashBtnState.status === 'mine'
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-default'
                          : ashBtnState.status === 'occupied'
                            ? 'bg-void-black/60 border border-outline/30 text-on-surface-variant/40 cursor-not-allowed'
                            : 'bg-gradient-to-r from-magma-core/25 via-rose-600/35 to-magma-core/25 hover:from-magma-core/45 hover:to-rose-600/45 border border-magma-core/60 hover:border-magma-core text-pure-snow shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] cursor-pointer active:scale-98'
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!ashBtnState.disabled) handleSelectFaction('ash');
                        }}
                        disabled={ashBtnState.disabled}
                      >
                        {ashBtnState.status === 'mine' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        <span>{ashBtnState.label}</span>
                        {ashBtnState.status === 'available' && <ChevronRight className="h-3.5 w-3.5 text-magma-core group-hover:translate-x-1 transition-transform" />}
                      </button>
                    </div>
                  </div>

                </div>

                {/* RIGHT: ASH HERALDIC BANNER PILLAR (SEAMLESSLY CONNECTED AT BOTTOM) */}
                <div
                  ref={ashCardRef}
                  className={`glass-obsidian border-t border-b border-r border-l-0 rounded-r-2xl rounded-l-none overflow-hidden flex flex-col items-center justify-center relative p-3 w-56 lg:w-64 xl:w-72 h-full flex-shrink-0 cursor-pointer transition-all duration-300 z-10 ${ashBtnState.status === 'mine'
                    ? 'border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)] bg-rose-950/30'
                    : ashBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : hoveredFaction === 'ash'
                        ? 'border-magma-core shadow-[0_0_30px_rgba(239,68,68,0.25)] bg-rose-950/35'
                        : 'border-magma-core/35 bg-rose-950/20'
                    }`}
                  style={{ opacity: 0 }}
                  onMouseEnter={() => setHoveredFaction('ash')}
                  onMouseLeave={() => setHoveredFaction(null)}
                  onClick={() => !ashBtnState.disabled && handleSelectFaction('ash')}
                >
                  {/* Atmospheric Radial Aura */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.28)_0%,_transparent_75%)] pointer-events-none" />

                  {/* Status Badges */}
                  {ashBtnState.status === 'mine' && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 backdrop-blur-md text-emerald-300 font-label-caps text-[8px] sm:text-[9px] tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>CHOSEN</span>
                    </div>
                  )}
                  {ashBtnState.status === 'occupied' && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-void-black/80 border border-outline/40 backdrop-blur-md text-on-surface-variant font-label-caps text-[8px] sm:text-[9px] tracking-widest">
                      <Lock className="h-3 w-3 text-magma-core" />
                      <span>OCCUPIED</span>
                    </div>
                  )}

                  {/* Heraldic Faction Banner */}
                  <div className={`h-full w-full max-w-[190px] flex items-center justify-center transition-transform duration-500 ease-out ${hoveredFaction === 'ash' ? 'scale-105 -translate-y-1' : ''}`}>
                    <FactionBanner faction="ash" idPrefix="lobby-ash" className="h-full w-auto" />
                  </div>

                  {/* Realm Pillar Label */}
                  <div className="absolute bottom-2 inset-x-0 flex flex-col items-center pointer-events-none">
                    <span className="text-[9px] font-label-caps tracking-[0.25em] text-magma-core/80 uppercase font-semibold">
                      ASH REALM
                    </span>
                  </div>

                  {/* Border line on the upper exposed half where no desc box touches */}
                  <div className={`hidden md:block absolute left-0 top-0 bottom-[180px] lg:bottom-[195px] w-[1px] pointer-events-none transition-colors duration-300 ${ashBtnState.status === 'mine' ? 'bg-emerald-400' : hoveredFaction === 'ash' ? 'bg-magma-core' : 'bg-magma-core/35'
                    }`} />
                </div>

              </div>

              {/* Back Button */}
              <button
                ref={factionBackRef}
                className="mt-4 sm:mt-5 md:mt-10 pb-2 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-1.5 group cursor-pointer font-label-caps tracking-widest uppercase text-[11px] sm:text-xs"
                onClick={handleCancelFaction}
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 back-arrow-icon" aria-hidden="true" />
                {currentMode === 'online' ? 'LEAVE REALM' : 'RETURN TO MODES'}
              </button>
            </div>
          </div>
        </div>
      


  );
}
