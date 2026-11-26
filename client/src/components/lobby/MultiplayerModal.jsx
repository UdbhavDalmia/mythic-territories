import React from 'react';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import Swords from 'lucide-react/dist/esm/icons/swords.js';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Globe from 'lucide-react/dist/esm/icons/globe.js';
import Globe2 from 'lucide-react/dist/esm/icons/globe-2.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import PlusCircle from 'lucide-react/dist/esm/icons/plus-circle.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Radio from 'lucide-react/dist/esm/icons/radio.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { isValidRoomCode } from '../../services/roomCode.js';

const formatTimeAgo = (ts) => {
  if (!ts) return 'Just now';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  return `${mins}m ago`;
};

function MultiplayerModal({
  showMultiplayer,
  showModes,
  mpOverlayRef,
  isTransitioningRef,
  handleCloseMp,
  handleMpToModes,
  handleQuickMatch,
  isMatching,
  handleCardMouseMove,
  handleCardMouseLeave,
  mpCardsRef,
  mpBackRef,
  mpPanel,
  setMpPanel,
  hostIsPublic,
  setHostIsPublic,
  hostAutoCode,
  handleRerollCode,
  handleHostRealm,
  isHosting,
  roomCode,
  handleRoomCodeChange,
  handlePasteCode,
  handleJoinSpecificRoom,
  openRooms
}) {
  if (!showMultiplayer) return null;

  return (
            <div
          ref={mpOverlayRef}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${showModes && showMultiplayer
            ? 'bg-transparent backdrop-blur-none pointer-events-none overflow-hidden'
            : 'bg-void-black/80 backdrop-blur-md overflow-y-auto'
            }`}
          style={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === mpOverlayRef.current && !isTransitioningRef.current) handleCloseMp();
          }}
        >
          <div className="modal-content w-full max-w-5xl my-auto py-6">
            <div className="flex flex-col items-center">

              {/* Header */}
              <div className="mb-7 md:mb-10 text-center">
                <p className="mb-2 font-label-caps text-[10px] tracking-[0.3em] text-on-surface-variant">Online PvP</p>
                <h2 className="almendra-font text-xl sm:text-2xl md:text-3xl text-ember-gold tracking-widest uppercase font-bold">
                  Multiplayer Realm
                </h2>
              </div>

              {/* Three action cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full">

                {/* Quick Match */}
                <button
                  ref={el => mpCardsRef.current[0] = el}
                  className={`card-gold glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${isMatching ? 'border-ember-gold ring-2 ring-ember-gold/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]' : 'border-outline/20'
                    }`}
                  style={{ opacity: 0 }}
                  onClick={handleQuickMatch}
                  disabled={isMatching}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ember-gold/10 flex items-center justify-center border border-ember-gold/30 group-hover:bg-ember-gold/20 transition-all duration-300 ease-out group-hover:scale-105 shrink-0">
                    <Zap className={`h-5 w-5 sm:h-8 sm:w-8 text-ember-gold ${isMatching ? 'animate-bounce' : ''}`} aria-hidden="true" />
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">QUICK MATCH</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">
                      {isMatching ? 'Entering active realm...' : 'Auto-match with an available player'}
                    </p>
                    <span className="mt-3 rounded-full border border-ember-gold/20 bg-ember-gold/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-ember-gold">
                      {isMatching ? 'Matching...' : openRooms.length > 0 ? `${openRooms.length} realm${openRooms.length !== 1 ? 's' : ''} open` : 'Instant Action'}
                    </span>
                  </div>
                  <div className="h-1 w-12 bg-ember-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:block rounded-full" />
                </button>

                {/* Host Realm */}
                <button
                  ref={el => mpCardsRef.current[1] = el}
                  className={`card-frost glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${mpPanel === 'host' ? 'border-ice-light ring-2 ring-ice-light/40 shadow-[0_0_25px_rgba(165,243,252,0.2)]' : 'border-outline/20'
                    }`}
                  style={{ opacity: 0 }}
                  onClick={() => { setMpPanel(mpPanel === 'host' ? null : 'host'); if (!hostAutoCode) handleRerollCode(); }}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ice-light/10 flex items-center justify-center border border-ice-light/30 group-hover:bg-ice-light/20 transition-all duration-300 ease-out group-hover:scale-105 shrink-0">
                    <PlusCircle className="h-5 w-5 sm:h-8 sm:w-8 text-ice-light" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">HOST REALM</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">Create a battle and invite your rival</p>
                    <span className="mt-3 rounded-full border border-ice-light/20 bg-ice-light/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-ice-light">
                      {mpPanel === 'host' ? 'Configuring' : 'Public or Private'}
                    </span>
                  </div>
                  <div className="h-1 w-12 bg-ice-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:block rounded-full" />
                </button>

                {/* Join by Code */}
                <button
                  ref={el => mpCardsRef.current[2] = el}
                  className={`card-fire glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${mpPanel === 'join' ? 'border-magma-core ring-2 ring-magma-core/40 shadow-[0_0_25px_rgba(239,68,68,0.2)]' : 'border-outline/20'
                    }`}
                  style={{ opacity: 0 }}
                  onClick={() => setMpPanel(mpPanel === 'join' ? null : 'join')}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-magma-core/10 flex items-center justify-center border border-magma-core/30 group-hover:bg-magma-core/20 transition-all duration-300 ease-out group-hover:scale-105 shrink-0">
                    <Lock className="h-5 w-5 sm:h-8 sm:w-8 text-magma-core" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">JOIN REALM</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-70">Enter a realm code or browse open battles</p>
                    <span className="mt-3 rounded-full border border-magma-core/20 bg-magma-core/10 px-2.5 py-1 font-label-caps text-[9px] tracking-widest text-magma-core">
                      {mpPanel === 'join' ? 'Entering Code' : 'Direct Entry'}
                    </span>
                  </div>
                  <div className="h-1 w-12 bg-magma-core opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:block rounded-full" />
                </button>

              </div>

              {/* Back button */}
              <button
                ref={mpBackRef}
                className="mt-8 md:mt-14 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-2 group cursor-pointer font-label-caps tracking-widest text-xs sm:text-sm"
                onClick={handleMpToModes}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 back-arrow-icon" aria-hidden="true" />
                RETURN TO MODES
              </button>

            </div>
          </div>

          {/* Modal Overlay for Host Realm / Join Realm */}
          {mpPanel && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-void-black/80 backdrop-blur-md p-4 sm:p-6"
              onClick={(e) => {
                if (e.target === e.currentTarget) setMpPanel(null);
              }}
            >
              {/* Host Realm Dialog */}
              {mpPanel === 'host' && (
                <div className="w-full max-w-sm sm:max-w-md glass-obsidian border border-ice-light/35 rounded-lg p-5 sm:p-6 flex flex-col gap-4 shadow-2xl modal-pop-in relative">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-outline/15 pb-3">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-ice-light" />
                      <span className="font-label-caps text-xs sm:text-sm text-pure-snow tracking-wider font-bold">Host Realm</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMpPanel(null)}
                      className="p-1 rounded text-on-surface-variant hover:text-pure-snow hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Assigned Code Section */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps text-[10px] sm:text-[11px] text-on-surface-variant tracking-wider uppercase">Realm Code</span>
                      <button
                        type="button"
                        onClick={handleRerollCode}
                        className="flex items-center gap-1 text-[10px] sm:text-[11px] font-label-caps text-ember-gold/80 hover:text-ember-gold transition-colors cursor-pointer"
                        title="Roll a new realm code"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reroll</span>
                      </button>
                    </div>
                    <div className="bg-void-black/90 border border-outline/25 rounded-md py-3 px-4 flex items-center justify-center">
                      <span className="font-mono text-xl sm:text-2xl font-bold text-ember-gold tracking-[0.25em]">
                        {hostAutoCode || 'GENERATING...'}
                      </span>
                    </div>
                  </div>

                  {/* Visibility Segmented Toggle */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-caps text-[10px] sm:text-[11px] text-on-surface-variant tracking-wider uppercase">Realm Visibility</span>
                    <div className="flex bg-void-black/70 p-1 rounded-md border border-outline/25">
                      <button
                        type="button"
                        onClick={() => setHostIsPublic(true)}
                        className={`flex-1 py-2 px-3 rounded text-xs font-label-caps tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${hostIsPublic
                          ? 'bg-ember-gold/20 text-ember-gold border border-ember-gold/40 shadow-sm font-bold'
                          : 'text-on-surface-variant hover:text-pure-snow'
                          }`}
                      >
                        <Globe2 className="h-3.5 w-3.5" />
                        <span>Public</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostIsPublic(false)}
                        className={`flex-1 py-2 px-3 rounded text-xs font-label-caps tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${!hostIsPublic
                          ? 'bg-ember-gold/20 text-ember-gold border border-ember-gold/40 shadow-sm font-bold'
                          : 'text-on-surface-variant hover:text-pure-snow'
                          }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Private</span>
                      </button>
                    </div>
                  </div>

                  {/* Create Button */}
                  <button
                    type="button"
                    onClick={handleHostRealm}
                    disabled={isHosting}
                    className="w-full py-3 bg-gradient-to-r from-ember-gold/25 via-amber-500/35 to-magma-core/25 hover:from-ember-gold/35 hover:to-magma-core/35 border border-ember-gold/50 text-pure-snow rye-font tracking-widest rounded-md text-sm font-bold shadow-md cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isHosting ? 'CREATING REALM...' : 'CREATE REALM'}
                  </button>
                </div>
              )}

              {/* Join Realm Dialog */}
              {mpPanel === 'join' && (
                <div className="w-full max-w-sm sm:max-w-md glass-obsidian border border-magma-core/35 rounded-lg p-5 sm:p-6 flex flex-col gap-4 shadow-2xl modal-pop-in relative">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-outline/15 pb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-magma-core" />
                      <span className="font-label-caps text-xs sm:text-sm text-pure-snow tracking-wider font-bold">Join Realm</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMpPanel(null)}
                      className="p-1 rounded text-on-surface-variant hover:text-pure-snow hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Input with Paste Action */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps text-[10px] sm:text-[11px] text-on-surface-variant tracking-wider uppercase">Realm Code</span>
                      <button
                        type="button"
                        onClick={handlePasteCode}
                        className="flex items-center gap-1 text-[10px] sm:text-[11px] font-label-caps text-ember-gold/80 hover:text-ember-gold transition-colors cursor-pointer"
                        title="Paste from clipboard"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Paste</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={9}
                      value={roomCode}
                      onChange={handleRoomCodeChange}
                      placeholder="FROST-402"
                      className="w-full bg-void-black/90 border border-outline/25 focus:border-ember-gold text-center text-xl sm:text-2xl tracking-[0.25em] py-2.5 sm:py-3 rounded-md font-mono font-bold text-ember-gold outline-none uppercase shadow-inner placeholder:text-on-surface-variant/25 transition-colors"
                      onKeyDown={(e) => { if (e.key === 'Enter' && isValidRoomCode(roomCode)) handleJoinSpecificRoom(roomCode); }}
                      autoComplete="off"
                      spellCheck="false"
                      autoFocus
                    />
                  </div>

                  {/* Join Button */}
                  <button
                    type="button"
                    onClick={() => handleJoinSpecificRoom(roomCode)}
                    disabled={!isValidRoomCode(roomCode)}
                    className={`w-full py-3 transition-all rye-font tracking-widest rounded-md text-sm font-bold cursor-pointer ${isValidRoomCode(roomCode)
                      ? 'bg-gradient-to-r from-ember-gold via-amber-500 to-magma-core text-void-black shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:brightness-110 active:scale-[0.99]'
                      : 'bg-void-black/60 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                      }`}
                  >
                    JOIN REALM
                  </button>

                  {/* Active Public Realms List */}
                  {openRooms.length > 0 && (
                    <div className="pt-3 border-t border-outline/15 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                        <span className="font-label-caps text-[11px] tracking-wider text-pure-snow font-bold">
                          Open Battles ({openRooms.length})
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {openRooms.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-2 rounded-md border border-outline/20 bg-void-black/70 hover:border-ember-gold/40 transition-all gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{r.hostFaction === 'snow' ? '❄️' : r.hostFaction === 'ash' ? '🔥' : '⚔️'}</span>
                              <span className="font-mono text-xs font-bold text-pure-snow tracking-wider">{r.id}</span>
                              <span className="text-[10px] text-on-surface-variant">&bull; {formatTimeAgo(r.createdAt)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleJoinSpecificRoom(r.id)}
                              className="px-2.5 py-1 bg-ember-gold/15 hover:bg-ember-gold/30 border border-ember-gold/40 text-ember-gold font-bold text-[10px] tracking-wider rounded transition-all active:scale-95 cursor-pointer font-label-caps"
                            >
                              JOIN
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      


  );
}

export default React.memo(MultiplayerModal);
