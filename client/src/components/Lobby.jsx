import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import gsap from 'gsap';

export default function Lobby({ navigateTo }) {
  const [showModes, setShowModes] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showFactionSelection, setShowFactionSelection] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  
  const [currentMode, setCurrentMode] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [mySelectedFaction, setMySelectedFaction] = useState(null);
  const [playersList, setPlayersList] = useState([]);

  const socketRef = useRef(null);
  const playersListRef = useRef([]);
  const mySelectedFactionRef = useRef(null);

  // ── Page ref for exit transition ──────────────────────────────────────────
  const pageRef = useRef(null);

  // Exit — fade + drift up, then navigate
  const handleNavigate = (dest, params = {}) => {
    gsap.to(pageRef.current, {
      opacity: 0, y: -30, duration: 0.3, ease: 'power2.in',
      onComplete: () => navigateTo(dest, params)
    });
  };

  // ── Element refs for GSAP ──────────────────────────────────────────────────
  const titleRef        = useRef(null);
  const playBtnRef      = useRef(null);
  const footerLinksRef  = useRef(null);

  const modesOverlayRef = useRef(null);
  const modeCardsRef    = useRef([]);

  const mpModalRef      = useRef(null);
  const mpBackArrowRef  = useRef(null);

  const factionOverlayRef = useRef(null);
  const snowCardRef       = useRef(null);
  const ashCardRef        = useRef(null);
  const factionBackRef    = useRef(null);

  const modesBackRef    = useRef(null);

  // ── 1. Page-load entrance sequence ────────────────────────────────────────
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(titleRef.current,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2 }
    )
    .fromTo(playBtnRef.current,
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' },
      '-=0.8'
    )
    .fromTo(footerLinksRef.current?.children ? Array.from(footerLinksRef.current.children) : [],
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 },
      '-=0.6'
    );
  }, []);

  // ── 2. Game-mode overlay entrance ─────────────────────────────────────────
  useEffect(() => {
    if (!showModes) return;
    // Stagger cards in from below
    const cards = modeCardsRef.current.filter(Boolean);
    gsap.fromTo(modesOverlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' }
    );
    gsap.fromTo(cards,
      { y: 60, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.75, stagger: 0.15, ease: 'expo.out', delay: 0.1 }
    );
    // Back arrow nudge loop
    if (modesBackRef.current) {
      gsap.to(modesBackRef.current.querySelector('.back-arrow-icon'), {
        x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut'
      });
    }
  }, [showModes]);

  // ── 3. Multiplayer modal entrance ─────────────────────────────────────────
  useEffect(() => {
    if (!showMultiplayer) return;
    gsap.fromTo(mpModalRef.current,
      { scale: 0.9, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.2)' }
    );
    if (mpBackArrowRef.current) {
      gsap.to(mpBackArrowRef.current.querySelector('.back-arrow-icon'), {
        x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut'
      });
    }
  }, [showMultiplayer]);

  // ── 4. Faction selection entrance ─────────────────────────────────────────
  useEffect(() => {
    if (!showFactionSelection) return;
    gsap.fromTo(factionOverlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4 }
    );
    // Snow card from left, Ash card from right — "clash" entrance
    gsap.fromTo(snowCardRef.current,
      { x: -80, opacity: 0, scale: 0.95 },
      { x: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'expo.out', delay: 0.1 }
    );
    gsap.fromTo(ashCardRef.current,
      { x: 80, opacity: 0, scale: 0.95 },
      { x: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'expo.out', delay: 0.1 }
    );
    // Back arrow nudge
    if (factionBackRef.current) {
      gsap.to(factionBackRef.current.querySelector('.back-arrow-icon'), {
        x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut'
      });
    }
  }, [showFactionSelection]);

  // ── Socket / utility helpers ───────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const getPlayerId = () => {
    let pId = sessionStorage.getItem('mythic_playerId');
    if (!pId) {
      pId = 'p_' + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('mythic_playerId', pId);
    }
    return pId;
  };

  const handleJoinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 3) { alert('Room code must be at least 3 characters.'); return; }
    if (socketRef.current) socketRef.current.disconnect();

    const devPorts = ['5500', '5501', '5173', '8080', '8081', '3001'];
    const isDevServer = devPorts.includes(window.location.port);
    const connectionUrl = (window.location.protocol === 'file:' || isDevServer) ? 'http://localhost:3000' : '';
    const socket = io(connectionUrl);
    socketRef.current = socket;
    const playerId = getPlayerId();

    socket.on('connect', () => { socket.emit('joinRoom', { roomId: code, playerId }); });
    socket.on('init', (data) => {
      setCurrentRoomId(code);
      playersListRef.current = data.players || [];
      setPlayersList(data.players || []);
      if (data.state && data.state.gameStarted) {
        const me = (data.players || []).find(p => p.id === playerId);
        if (me && me.team) { socket.disconnect(); navigateTo('GAME', { room: code, team: me.team }); return; }
      }
      setShowMultiplayer(false);
      setShowFactionSelection(true);
    });
    socket.on('roomUpdate', (data) => {
      playersListRef.current = data.players || [];
      setPlayersList(data.players || []);
    });
    socket.on('playerJoined', (data) => {
      playersListRef.current = data.players || [];
      setPlayersList(data.players || []);
    });
    socket.on('teamAssigned', (faction) => {
      mySelectedFactionRef.current = faction;
      setMySelectedFaction(faction);
    });
    socket.on('stateUpdate', (data) => {
      const gs = data ? (data.state || data.diff) : null;
      if (gs && gs.gameStarted) {
        const me = playersListRef.current.find(p => p.id === playerId);
        const assignedTeam = me?.team || mySelectedFactionRef.current || 'snow';
        socket.disconnect();
        navigateTo('GAME', { room: code, team: assignedTeam });
      }
    });
    socket.on('error', (msg) => { alert(msg); socket.disconnect(); });
  };

  const handleSelectFaction = (faction) => {
    if (currentMode === 'ai') {
      navigateTo('GAME', { mode: 'local', ai: '1', team: faction });
    } else if (currentMode === 'online' && socketRef.current) {
      mySelectedFactionRef.current = faction;
      setMySelectedFaction(faction);
      socketRef.current.emit('selectFaction', { roomId: currentRoomId, faction });
    }
  };

  const handleCancelFaction = () => {
    if (socketRef.current) {
      socketRef.current.emit('leaveRoom', { roomId: currentRoomId, playerId: getPlayerId() });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setShowFactionSelection(false);
    setMySelectedFaction(null);
    if (currentMode === 'online') setShowMultiplayer(true);
    else setShowModes(true);
  };

  const getFactionBtnState = (faction) => {
    const pId = getPlayerId();
    const isOccupiedByOther = playersList.some(p => p.team === faction && p.id !== pId);
    const amSelected = mySelectedFaction === faction || playersList.some(p => p.team === faction && p.id === pId);
    if (amSelected)  return { label: 'YOUR SELECTION', disabled: true };
    if (isOccupiedByOther) return { label: 'OCCUPIED', disabled: true };
    if (mySelectedFaction && mySelectedFaction !== faction) return { label: 'LOCKED', disabled: true };
    return { label: 'SELECT FACTION', disabled: false };
  };

  const snowBtnState = getFactionBtnState('snow');
  const ashBtnState  = getFactionBtnState('ash');

  return (
    <div ref={pageRef} className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-void-black text-on-surface select-none font-body-md">

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-center animate-slow-zoom"
          style={{ backgroundImage: "url('/images/menu-bg.png')", transformOrigin: 'center' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-void-black/60" />
        <div className="absolute inset-0 bg-void-black/20" />
      </div>

      <div />

      {/* ── SCREEN 1: MAIN MENU ── */}
      <main className="relative z-10 w-full flex-grow flex flex-col items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center mb-16 text-center">
          <h1
            ref={titleRef}
            className="almendra-font animate-title-shimmer uppercase max-w-4xl leading-tight"
            style={{
              background: 'linear-gradient(135deg, rgb(137, 206, 255) 0%, rgb(245, 158, 11) 50%, rgb(137, 206, 255) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(rgba(137, 206, 255, 0.4) 0px 0px 20px) drop-shadow(rgba(245, 158, 11, 0.4) 0px 0px 20px)',
              fontWeight: 700,
              fontSize: 'clamp(40px, 8vw, 72px)',
              opacity: 0  /* GSAP owns initial opacity */
            }}
          >
            MYTHIC TERRITORIES
          </h1>
        </div>
        <div className="relative flex flex-col items-center">
          <button
            ref={playBtnRef}
            className="animate-pulse-glow px-12 py-4 glass-obsidian transition-all duration-300 active:scale-95 group rounded-xl border border-ember-gold/30 hover:border-ember-gold/60 flex items-center justify-center cursor-pointer"
            style={{ opacity: 0 }}  /* GSAP owns initial opacity */
            onClick={() => setShowModes(true)}
          >
            <span className="relative rye-font text-xl md:text-3xl text-ember-gold tracking-[0.4em] group-hover:scale-105 transition-transform block">
              PLAY
            </span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-6 bg-gradient-to-t from-void-black to-transparent gap-4 font-label-caps">
        <div className="text-xs sm:text-sm text-on-surface-variant">
          © 2025 Mythic Territories. All Rights Reserved.
        </div>
        <div ref={footerLinksRef} className="flex gap-8 items-center opacity-80">
          <button
            className="text-xs sm:text-sm text-on-surface-variant hover:text-ember-gold transition-colors duration-300"
            onClick={() => handleNavigate('WHEEL')}
          >
            Wheel of Destiny
          </button>
          <button
            className="text-xs sm:text-sm text-on-surface-variant hover:text-ember-gold transition-colors duration-300"
            onClick={() => handleNavigate('NOTES')}
          >
            Patch Notes
          </button>
          <button
            className="text-xs sm:text-sm text-on-surface-variant hover:text-ember-gold transition-colors duration-300"
            onClick={() => handleNavigate('GUIDE')}
          >
            Rulebook
          </button>
        </div>
      </footer>

      {/* ── SCREEN 2: GAME MODES OVERLAY ── */}
      {showModes && (
        <div
          ref={modesOverlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/80 backdrop-blur-md p-4 sm:p-6"
          style={{ opacity: 0 }}
        >
          <div className="modal-content w-full max-w-5xl">
            <div className="flex flex-col items-center">
              <h2 className="almendra-font text-xl sm:text-2xl md:text-3xl text-ember-gold tracking-widest mb-6 md:mb-12 uppercase font-bold">
                Select Game Mode
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full">

                {/* Pass & Play */}
                <button
                  ref={el => modeCardsRef.current[0] = el}
                  className="card-frost glass-obsidian border border-outline/20 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group transition-all duration-500 w-full cursor-pointer hover:border-ice-light/60"
                  style={{ opacity: 0 }}
                  onClick={() => navigateTo('GAME', { mode: 'local' })}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ice-light/10 flex items-center justify-center border border-ice-light/30 group-hover:bg-ice-light/20 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-ice-light text-xl sm:text-3xl">groups</span>
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">PASS &amp; PLAY</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-60">Local tabletop experience</p>
                  </div>
                  <div className="h-1 w-12 bg-ice-light opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                </button>

                {/* Online Realm */}
                <button
                  ref={el => modeCardsRef.current[1] = el}
                  className="card-fire glass-obsidian border border-outline/20 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group transition-all duration-500 w-full cursor-pointer hover:border-magma-core/60"
                  style={{ opacity: 0 }}
                  onClick={() => { setCurrentMode('online'); setShowModes(false); setShowMultiplayer(true); }}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-magma-core/10 flex items-center justify-center border border-magma-core/30 group-hover:bg-magma-core/20 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-magma-core text-xl sm:text-3xl">language</span>
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">ONLINE REALM</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-60">Challenge the world</p>
                  </div>
                  <div className="h-1 w-12 bg-magma-core opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                </button>

                {/* Ancient Trials */}
                <button
                  ref={el => modeCardsRef.current[2] = el}
                  className="card-gold glass-obsidian border border-outline/10 p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 w-full cursor-not-allowed opacity-50 grayscale transition-all duration-500"
                  style={{ opacity: 0 }}
                  disabled={true}
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-ember-gold/10 flex items-center justify-center border border-ember-gold/30 shrink-0">
                    <span className="material-symbols-outlined text-ember-gold text-xl sm:text-3xl">smart_toy</span>
                  </div>
                  <div className="flex flex-col items-start md:items-center">
                    <h3 className="font-label-caps text-pure-snow text-xs sm:text-base md:text-xl tracking-widest mb-0.5 md:mb-2">ANCIENT TRIALS</h3>
                    <p className="font-body-md text-on-surface-variant text-[10px] sm:text-xs md:text-sm opacity-60">Coming Soon</p>
                  </div>
                </button>

              </div>

              <button
                ref={modesBackRef}
                className="mt-8 md:mt-16 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-2 group cursor-pointer font-label-caps tracking-widest text-xs sm:text-sm"
                onClick={() => setShowModes(false)}
              >
                <span className="material-symbols-outlined text-xl back-arrow-icon">arrow_back</span>
                RETURN TO MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 3: MULTIPLAYER CODE MODAL ── */}
      {showMultiplayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/90 backdrop-blur-lg p-6">
          <div
            ref={mpModalRef}
            className="modal-content w-full max-w-md glass-obsidian border border-magma-core/30 p-10 rounded-2xl"
            style={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-magma-core text-5xl mb-6">shield</span>
              <h2 className="almendra-font text-2xl text-pure-snow tracking-widest mb-8 uppercase font-bold">
                Enter Realm Code
              </h2>
              <div className="w-full mb-8">
                <input
                  type="text"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="####"
                  className="w-full bg-void-black/50 border border-outline/30 text-center text-4xl tracking-[0.5em] py-4 rounded-lg font-mono font-bold text-ember-gold focus:border-ember-gold outline-none uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  autoComplete="off"
                  spellCheck="false"
                />
                <p className="text-on-surface-variant text-xs mt-4 text-center font-body-md opacity-60">
                  Enter a 4-character code to join or host a Realm.
                </p>
              </div>
              <button
                className="w-full py-4 bg-magma-core/20 border border-magma-core/50 hover:bg-magma-core/40 transition-all text-pure-snow rye-font tracking-widest rounded-lg mb-6 cursor-pointer text-sm sm:text-base font-bold"
                onClick={handleJoinRoom}
              >
                JOIN REALM
              </button>
              <button
                ref={mpBackArrowRef}
                className="text-on-surface-variant hover:text-white transition-colors flex items-center gap-2 text-xs font-label-caps tracking-widest cursor-pointer"
                onClick={() => { setShowMultiplayer(false); setShowModes(true); setRoomCode(''); }}
              >
                <span className="material-symbols-outlined text-base back-arrow-icon">arrow_back</span>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 4: FACTION SELECTION MODAL ── */}
      {showFactionSelection && (
        <div
          ref={factionOverlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/90 backdrop-blur-xl p-4 sm:p-6"
          style={{ opacity: 0 }}
        >
          <div className="modal-content w-full max-w-4xl overflow-visible">
            <div className="flex flex-col items-center py-4 overflow-visible">
              <h2 className="almendra-font text-xl sm:text-2xl md:text-4xl text-ember-gold tracking-widest mb-4 md:mb-6 uppercase font-bold">
                Choose Your Faction
              </h2>

              {currentRoomId && (
                <div className="text-ember-gold text-xs sm:text-sm tracking-wider mb-3 md:mb-4 opacity-80 font-label-caps">
                  ROOM CODE: {currentRoomId}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full p-2 overflow-visible">

                {/* FROST LORD CARD */}
                <div
                  ref={snowCardRef}
                  className="card-frost glass-obsidian border border-ice-light/30 rounded-xl overflow-hidden flex flex-col group transition-all duration-500 hover:scale-[1.02]"
                  style={{ opacity: 0 }}
                >
                  <div className="relative h-24 sm:h-44 md:h-52 overflow-hidden bg-void-black">
                    <img
                      alt="Frost Lord"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      src="/units/frost-lord.png"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-transparent" />
                  </div>
                  <div className="p-3 sm:p-6 flex flex-col gap-2 md:gap-3">
                    <h3 className="text-sm sm:text-lg md:text-2xl text-ice-light tracking-widest uppercase almendra-font font-bold">
                      FROST LORD
                    </h3>
                    <p className="text-on-surface-variant text-[10px] sm:text-xs md:text-sm leading-relaxed h-12 sm:h-16">
                      Absolute order and crystalline geometry. Freeze enemies and construct glacial barriers to outlast the storm.
                    </p>
                    <button
                      className={`mt-2 md:mt-4 py-2 sm:py-3 bg-ice-light/10 border border-ice-light/30 text-ice-light tracking-widest transition-all hover:bg-ice-light/20 active:scale-95 text-[10px] sm:text-xs md:text-base w-full rye-font font-bold ${
                        snowBtnState.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      onClick={() => handleSelectFaction('snow')}
                      disabled={snowBtnState.disabled}
                    >
                      {snowBtnState.label}
                    </button>
                  </div>
                </div>

                {/* ASH TYRANT CARD */}
                <div
                  ref={ashCardRef}
                  className="card-fire glass-obsidian border border-magma-core/30 rounded-xl overflow-hidden flex flex-col group transition-all duration-500 hover:scale-[1.02]"
                  style={{ opacity: 0 }}
                >
                  <div className="relative h-24 sm:h-44 md:h-52 overflow-hidden bg-void-black">
                    <img
                      alt="Ash Tyrant"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      src="/units/ash-tyrant.png"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-transparent" />
                  </div>
                  <div className="p-3 sm:p-6 flex flex-col gap-2 md:gap-3">
                    <h3 className="text-sm sm:text-lg md:text-2xl text-magma-core tracking-widest uppercase almendra-font font-bold">
                      ASH TYRANT
                    </h3>
                    <p className="text-on-surface-variant text-[10px] sm:text-xs md:text-sm leading-relaxed h-12 sm:h-16">
                      Explosive violence and volcanic power. Break enemy lines with raw lava projectiles and scorched-earth hazards.
                    </p>
                    <button
                      className={`mt-2 md:mt-4 py-2 sm:py-3 bg-magma-core/10 border border-magma-core/30 text-magma-core tracking-widest transition-all hover:bg-magma-core/20 active:scale-95 text-[10px] sm:text-xs md:text-base w-full rye-font font-bold ${
                        ashBtnState.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      onClick={() => handleSelectFaction('ash')}
                      disabled={ashBtnState.disabled}
                    >
                      {ashBtnState.label}
                    </button>
                  </div>
                </div>

              </div>

              <button
                ref={factionBackRef}
                className="mt-4 md:mt-6 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-2 group cursor-pointer font-label-caps tracking-widest uppercase text-xs sm:text-sm"
                onClick={handleCancelFaction}
              >
                <span className="material-symbols-outlined text-base sm:text-xl back-arrow-icon">arrow_back</span>
                Back to Modes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
