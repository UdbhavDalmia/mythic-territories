import ModeSelectModal from './lobby/ModeSelectModal.jsx';
import MultiplayerModal from './lobby/MultiplayerModal.jsx';
import FactionSelectionOverlay from './lobby/FactionSelectionOverlay.jsx';
import LobbyHero from './lobby/LobbyHero.jsx';
import LobbyFooter from './lobby/LobbyFooter.jsx';
import { useLobbyMatchmaking } from '../hooks/useLobbyMatchmaking.js';
import React, { useState, useEffect, useRef } from 'react';
import '@/styles/menu.css';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Flame,
  Globe2,
  Lock,
  PlusCircle,
  Radio,
  RotateCcw,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { triggerHaptic } from '../services/haptics.js';
import FactionBanner from './FactionBanner.jsx';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loadMultiplayer = () => import('../services/multiplayer.js');

let gsapPromise = null;
const loadGsap = () => {
  if (!gsapPromise) {
    gsapPromise = import('gsap').then(m => m.default || m);
  }
  return gsapPromise;
};

export default function Lobby({ navigateTo, onWarm }) {
  const [showModes, setShowModes] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showFactionSelection, setShowFactionSelection] = useState(false);
  const [hoveredFaction, setHoveredFaction] = useState(null);

  const {
    roomCode,
    setRoomCode,
    currentMode,
    setCurrentMode,
    currentRoomId,
    currentRoomData,
    mySelectedFaction,
    playersList,
    mpPanel,
    setMpPanel,
    openRooms,
    isLoadingRooms,
    isMatching,
    isHosting,
    hostIsPublic,
    setHostIsPublic,
    hostAutoCode,
    hostCustomCode,
    setHostCustomCode,
    copiedLink,
    disbandCountdown,
    recoverableSession,
    handleResumeSession,
    handleAbandonSession,
    handleJoinSpecificRoom,
    handleQuickMatch,
    handleHostRealm,
    handleRerollCode,
    handleRoomCodeChange,
    handlePasteCode,
    handleCopyInviteLink,
    handleSelectFaction,
    handleCancelFaction,
    snowBtnState,
    ashBtnState
  } = useLobbyMatchmaking({
    showMultiplayer,
    showFactionSelection,
    setShowFactionSelection,
    setShowMultiplayer,
    setShowModes,
    navigateTo
  });

  const hasAnimatedFactionRef = useRef(false);

  // ── Page ref for exit transition ──────────────────────────────────────────
  const pageRef = useRef(null);

  // Exit — fade + drift up, then navigate
  const handleNavigate = (dest, params = {}) => {
    if (prefersReducedMotion()) {
      navigateTo(dest, params);
      return;
    }
    loadGsap().then(gsap => {
      gsap.to(pageRef.current, {
        opacity: 0, y: -30, duration: 0.3, ease: 'power2.in',
        onComplete: () => navigateTo(dest, params)
      });
    }).catch(() => navigateTo(dest, params));
  };

  // ── Element refs for GSAP ──────────────────────────────────────────────────
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const playBtnRef = useRef(null);
  const footerLinksRef = useRef(null);

  const modesOverlayRef = useRef(null);
  const modeCardsRef = useRef([]);
  const modesBackRef = useRef(null);
  const isClosingModesRef = useRef(false);

  const mpOverlayRef = useRef(null);
  const mpCardsRef = useRef([]);
  const mpBackRef = useRef(null);
  const isClosingMpRef = useRef(false);

  const isTransitioningRef = useRef(false);
  const transitionDirectionRef = useRef(null);

  const factionOverlayRef = useRef(null);
  const snowCardRef = useRef(null);
  const ashCardRef = useRef(null);
  const factionBackRef = useRef(null);

  // ── Warm up GSAP during idle time so it is ready on interaction ────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(() => loadGsap(), { timeout: 3500 })
      : setTimeout(() => loadGsap(), 2500);
    return () => {
      if (window.cancelIdleCallback && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, []);

  // ── Card Hover Tilt & Translate Y Handlers ────────────────────────────────
  const handleCardMouseMove = (e) => {
    if (prefersReducedMotion()) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((centerY - y) / centerY) * 7;
    const rotateY = ((x - centerX) / centerX) * 7;
    card.style.setProperty('--card-ty', '-8px');
    card.style.setProperty('--card-rx', `${rotateX.toFixed(2)}deg`);
    card.style.setProperty('--card-ry', `${rotateY.toFixed(2)}deg`);
  };

  const handleCardMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.removeProperty('--card-ty');
    card.style.removeProperty('--card-rx');
    card.style.removeProperty('--card-ry');
  };

  // ── 2. Game-mode overlay entrance & exit ──────────────────────────────────
  const handleCloseModes = () => {
    if (isClosingModesRef.current || isTransitioningRef.current) return;
    if (prefersReducedMotion() || !modesOverlayRef.current) {
      setShowModes(false);
      return;
    }
    isClosingModesRef.current = true;
    const cards = modeCardsRef.current.filter(Boolean);
    const content = modesOverlayRef.current?.querySelector('.modal-content');
    const header = content?.querySelector('.text-center');

    loadGsap().then(gsap => {
      const tl = gsap.timeline({
        onComplete: () => {
          setShowModes(false);
          isClosingModesRef.current = false;
        }
      });

      tl.to(cards, {
        y: 35,
        opacity: 0,
        scale: 0.96,
        duration: 0.28,
        stagger: 0.05,
        ease: 'power2.in'
      })
        .to([header, modesBackRef.current].filter(Boolean), {
          y: -12,
          opacity: 0,
          duration: 0.22,
          ease: 'power2.in'
        }, 0)
        .to(modesOverlayRef.current, {
          opacity: 0,
          duration: 0.28,
          ease: 'power2.in'
        }, '-=0.15');
    }).catch(() => {
      setShowModes(false);
      isClosingModesRef.current = false;
    });
  };

  const handleModesToMultiplayer = () => {
    if (isTransitioningRef.current || isClosingModesRef.current) return;
    loadMultiplayer();
    setCurrentMode('online');

    if (prefersReducedMotion() || !modesOverlayRef.current) {
      setShowModes(false);
      setShowMultiplayer(true);
      return;
    }

    isTransitioningRef.current = true;
    transitionDirectionRef.current = 'modes-to-mp';
    setShowMultiplayer(true);
  };

  useEffect(() => {
    if (!showModes) return;
    isClosingModesRef.current = false;

    // Transitioning from Multiplayer back to Modes in sync
    if (transitionDirectionRef.current === 'mp-to-modes') {
      transitionDirectionRef.current = null;
      let active = true;

      loadGsap().then(gsap => {
        if (!active) return;
        if (prefersReducedMotion()) {
          setShowMultiplayer(false);
          setMpPanel(null);
          isTransitioningRef.current = false;
          gsap.set([modesOverlayRef.current, ...modeCardsRef.current.filter(Boolean)], { opacity: 1, y: 0, scale: 1 });
          return;
        }

        const modesCards = modeCardsRef.current.filter(Boolean);
        const modesContent = modesOverlayRef.current?.querySelector('.modal-content');
        const modesHeader = modesContent?.querySelector('.text-center');
        const modesBack = modesBackRef.current;

        const mpCards = mpCardsRef.current.filter(Boolean);
        const mpContent = mpOverlayRef.current?.querySelector('.modal-content');
        const mpHeader = mpContent?.querySelector('.text-center');
        const mpBack = mpBackRef.current;

        gsap.set(modesOverlayRef.current, { opacity: 1 });
        gsap.set(mpOverlayRef.current, { opacity: 1 });

        if (modesHeader) gsap.set(modesHeader, { opacity: 0, y: -16 });
        gsap.set(modesCards, { opacity: 0, y: -24, scale: 0.96 });
        if (modesBack) gsap.set(modesBack, { opacity: 0, y: -12 });

        const tl = gsap.timeline({
          onComplete: () => {
            setShowMultiplayer(false);
            setMpPanel(null);
            isTransitioningRef.current = false;
            gsap.set([...modesCards, modesHeader, modesBack].filter(Boolean), { clearProps: 'transform' });
          }
        });

        // ── Exit animation of Multiplayer Hub ──
        tl.to(mpCards, {
          y: 24,
          opacity: 0,
          scale: 0.96,
          duration: 0.26,
          stagger: 0.04,
          ease: 'power2.in'
        }, 0);

        if (mpHeader || mpBack) {
          tl.to([mpHeader, mpBack].filter(Boolean), {
            y: 12,
            opacity: 0,
            duration: 0.22,
            ease: 'power2.in'
          }, 0);
        }

        // ── Entry animation of Modes Screen (IN SYNC with Exit) ──
        if (modesHeader) {
          tl.to(modesHeader, {
            opacity: 1,
            y: 0,
            duration: 0.38,
            ease: 'expo.out'
          }, 0.08);
        }

        tl.to(modesCards, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.48,
          stagger: 0.07,
          ease: 'expo.out'
        }, 0.1);

        if (modesBack) {
          tl.to(modesBack, {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: 'expo.out'
          }, 0.18);
        }

        const backArrow = modesBack?.querySelector('.back-arrow-icon');
        if (backArrow) {
          gsap.to(backArrow, { x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut' });
        }
      }).catch(() => {
        setShowMultiplayer(false);
        setMpPanel(null);
        isTransitioningRef.current = false;
      });

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isTransitioningRef.current) handleCloseModes();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        active = false;
        window.removeEventListener('keydown', handleKeyDown);
        loadGsap().then(gsap => {
          const cards = modeCardsRef.current.filter(Boolean);
          const header = modesOverlayRef.current?.querySelector('.modal-content')?.querySelector('.text-center');
          const backArrow = modesBackRef.current?.querySelector('.back-arrow-icon');
          gsap.killTweensOf([modesOverlayRef.current, ...cards, backArrow, header, modesBackRef.current].filter(Boolean));
        }).catch(() => { });
      };
    }

    let active = true;

    loadGsap().then(gsap => {
      if (!active) return;
      if (prefersReducedMotion()) {
        gsap.set([modesOverlayRef.current, ...modeCardsRef.current.filter(Boolean)], { opacity: 1, y: 0, scale: 1 });
        return;
      }
      // Stagger cards in from below
      const cards = modeCardsRef.current.filter(Boolean);
      const content = modesOverlayRef.current?.querySelector('.modal-content');
      const header = content?.querySelector('.text-center');

      gsap.set([modesOverlayRef.current, ...cards], { opacity: 0 });
      if (header) gsap.set(header, { opacity: 0, y: 20 });
      if (modesBackRef.current) gsap.set(modesBackRef.current, { opacity: 0, y: 15 });

      const tl = gsap.timeline();

      tl.to(modesOverlayRef.current, {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out'
      });

      if (header) {
        tl.to(header, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'expo.out'
        }, '-=0.2');
      }

      tl.fromTo(cards,
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'expo.out', clearProps: 'transform' },
        header ? '-=0.35' : 0
      );

      if (modesBackRef.current) {
        tl.to(modesBackRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: 'expo.out'
        }, '-=0.4');
      }

      // Back arrow nudge loop
      const backArrow = modesBackRef.current?.querySelector('.back-arrow-icon');
      if (backArrow) {
        gsap.to(backArrow, {
          x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut'
        });
      }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isTransitioningRef.current) handleCloseModes();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      loadGsap().then(gsap => {
        const cards = modeCardsRef.current.filter(Boolean);
        const header = modesOverlayRef.current?.querySelector('.modal-content')?.querySelector('.text-center');
        const backArrow = modesBackRef.current?.querySelector('.back-arrow-icon');
        gsap.killTweensOf([modesOverlayRef.current, ...cards, backArrow, header, modesBackRef.current].filter(Boolean));
      }).catch(() => { });
    };
  }, [showModes]);

  // ── 3. Multiplayer overlay entrance & exit ────────────────────────────────
  const handleCloseMp = (onDone) => {
    if (isClosingMpRef.current || isTransitioningRef.current) return;
    if (prefersReducedMotion() || !mpOverlayRef.current) {
      setShowMultiplayer(false);
      setMpPanel(null);
      onDone?.();
      return;
    }
    isClosingMpRef.current = true;
    const cards = mpCardsRef.current.filter(Boolean);
    const content = mpOverlayRef.current?.querySelector('.modal-content');
    const header = content?.querySelector('.text-center');

    loadGsap().then(gsap => {
      const tl = gsap.timeline({
        onComplete: () => {
          setShowMultiplayer(false);
          setMpPanel(null);
          isClosingMpRef.current = false;
          onDone?.();
        }
      });
      tl.to(cards, { y: 35, opacity: 0, scale: 0.96, duration: 0.28, stagger: 0.05, ease: 'power2.in' })
        .to([header, mpBackRef.current].filter(Boolean), { y: -12, opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
        .to(mpOverlayRef.current, { opacity: 0, duration: 0.28, ease: 'power2.in' }, '-=0.15');
    }).catch(() => {
      setShowMultiplayer(false);
      setMpPanel(null);
      isClosingMpRef.current = false;
      onDone?.();
    });
  };

  const handleMpToModes = () => {
    if (isTransitioningRef.current || isClosingMpRef.current) return;
    setRoomCode('');

    if (prefersReducedMotion() || !mpOverlayRef.current) {
      setShowMultiplayer(false);
      setMpPanel(null);
      setShowModes(true);
      return;
    }

    isTransitioningRef.current = true;
    transitionDirectionRef.current = 'mp-to-modes';
    setShowModes(true);
  };

  useEffect(() => {
    if (!showMultiplayer) return;
    isClosingMpRef.current = false;

    // Transitioning from Modes to Multiplayer in sync
    if (transitionDirectionRef.current === 'modes-to-mp') {
      transitionDirectionRef.current = null;
      let active = true;

      loadGsap().then(gsap => {
        if (!active) return;
        if (prefersReducedMotion()) {
          setShowModes(false);
          isTransitioningRef.current = false;
          gsap.set([mpOverlayRef.current, ...mpCardsRef.current.filter(Boolean)], { opacity: 1, y: 0, scale: 1 });
          return;
        }

        const modesCards = modeCardsRef.current.filter(Boolean);
        const modesContent = modesOverlayRef.current?.querySelector('.modal-content');
        const modesHeader = modesContent?.querySelector('.text-center');
        const modesBack = modesBackRef.current;

        const mpCards = mpCardsRef.current.filter(Boolean);
        const mpContent = mpOverlayRef.current?.querySelector('.modal-content');
        const mpHeader = mpContent?.querySelector('.text-center');
        const mpBack = mpBackRef.current;

        gsap.set(modesOverlayRef.current, { opacity: 1 });
        gsap.set(mpOverlayRef.current, { opacity: 1 });

        if (mpHeader) gsap.set(mpHeader, { opacity: 0, y: 16 });
        gsap.set(mpCards, { opacity: 0, y: 28, scale: 0.96 });
        if (mpBack) gsap.set(mpBack, { opacity: 0, y: 12 });

        const tl = gsap.timeline({
          onComplete: () => {
            setShowModes(false);
            isTransitioningRef.current = false;
            gsap.set([...mpCards, mpHeader, mpBack].filter(Boolean), { clearProps: 'transform' });
          }
        });

        // ── Exit animation of Modes Screen (floating up) ──
        tl.to(modesCards, {
          y: -24,
          opacity: 0,
          scale: 0.96,
          duration: 0.26,
          stagger: 0.04,
          ease: 'power2.in'
        }, 0);

        if (modesHeader || modesBack) {
          tl.to([modesHeader, modesBack].filter(Boolean), {
            y: -12,
            opacity: 0,
            duration: 0.22,
            ease: 'power2.in'
          }, 0);
        }

        // ── Entry animation of Multiplayer Lobby (IN SYNC with Exit) ──
        if (mpHeader) {
          tl.to(mpHeader, {
            opacity: 1,
            y: 0,
            duration: 0.38,
            ease: 'expo.out'
          }, 0.08);
        }

        tl.to(mpCards, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.48,
          ease: 'expo.out'
        }, 0.1);

        if (mpBack) {
          tl.to(mpBack, {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: 'expo.out'
          }, 0.18);
        }

        const backArrow = mpBack?.querySelector('.back-arrow-icon');
        if (backArrow) {
          gsap.to(backArrow, { x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut' });
        }
      }).catch(() => {
        setShowModes(false);
        isTransitioningRef.current = false;
      });

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isTransitioningRef.current) {
          setMpPanel(prev => {
            if (prev) return null;
            handleCloseMp();
            return null;
          });
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        active = false;
        window.removeEventListener('keydown', handleKeyDown);
        loadGsap().then(gsap => {
          const cards = mpCardsRef.current.filter(Boolean);
          const header = mpOverlayRef.current?.querySelector('.modal-content')?.querySelector('.text-center');
          const backArrow = mpBackRef.current?.querySelector('.back-arrow-icon');
          gsap.killTweensOf([mpOverlayRef.current, ...cards, backArrow, header, mpBackRef.current].filter(Boolean));
        }).catch(() => { });
      };
    }

    let active = true;
    loadGsap().then(gsap => {
      if (!active) return;
      if (prefersReducedMotion()) {
        gsap.set([mpOverlayRef.current, ...mpCardsRef.current.filter(Boolean)], { opacity: 1, y: 0, scale: 1 });
        return;
      }
      const cards = mpCardsRef.current.filter(Boolean);
      const content = mpOverlayRef.current?.querySelector('.modal-content');
      const header = content?.querySelector('.text-center');

      gsap.set([mpOverlayRef.current, ...cards], { opacity: 0 });
      if (header) gsap.set(header, { opacity: 0, y: 20 });
      if (mpBackRef.current) gsap.set(mpBackRef.current, { opacity: 0, y: 15 });

      const tl = gsap.timeline();
      tl.to(mpOverlayRef.current, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      if (header) tl.to(header, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, '-=0.2');
      tl.fromTo(cards,
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out', clearProps: 'transform' },
        header ? '-=0.35' : 0
      );
      if (mpBackRef.current) tl.to(mpBackRef.current, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' }, '-=0.4');

      const backArrow = mpBackRef.current?.querySelector('.back-arrow-icon');
      if (backArrow) gsap.to(backArrow, { x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut' });
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isTransitioningRef.current) {
        setMpPanel(prev => {
          if (prev) return null;
          handleCloseMp();
          return null;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      loadGsap().then(gsap => {
        const cards = mpCardsRef.current.filter(Boolean);
        const header = mpOverlayRef.current?.querySelector('.modal-content')?.querySelector('.text-center');
        const backArrow = mpBackRef.current?.querySelector('.back-arrow-icon');
        gsap.killTweensOf([mpOverlayRef.current, ...cards, backArrow, header, mpBackRef.current].filter(Boolean));
      }).catch(() => { });
    };
  }, [showMultiplayer]);

  // ── 4. Faction selection entrance ─────────────────────────────────────────
  useEffect(() => {
    if (!showFactionSelection) {
      hasAnimatedFactionRef.current = false;
      return;
    }
    if (hasAnimatedFactionRef.current) return;
    hasAnimatedFactionRef.current = true;

    let active = true;
    loadGsap().then(gsap => {
      if (!active) return;
      if (prefersReducedMotion()) {
        gsap.set([factionOverlayRef.current, snowCardRef.current, ashCardRef.current], {
          opacity: 1,
          x: 0,
          scale: 1,
          clearProps: 'all'
        });
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set([snowCardRef.current, ashCardRef.current].filter(Boolean), {
            clearProps: 'transform,scale,x,y'
          });
        }
      });

      tl.fromTo(factionOverlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' },
        0
      );

      // Both banners fly in from the sides (Snow from left, Ash from right)
      tl.fromTo(snowCardRef.current,
        { x: -50, opacity: 0, scale: 0.96 },
        { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' },
        0.05
      );
      tl.fromTo(ashCardRef.current,
        { x: 50, opacity: 0, scale: 0.96 },
        { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' },
        0.05
      );

      // Back arrow nudge
      const backArrow = factionBackRef.current?.querySelector('.back-arrow-icon');
      if (backArrow) {
        gsap.to(backArrow, {
          x: -3, repeat: -1, yoyo: true, duration: 0.65, ease: 'sine.inOut'
        });
      }
    });

    return () => {
      active = false;
      loadGsap().then(gsap => {
        const backArrow = factionBackRef.current?.querySelector('.back-arrow-icon');
        gsap.killTweensOf([
          factionOverlayRef.current,
          snowCardRef.current,
          ashCardRef.current,
          backArrow
        ].filter(Boolean));
        gsap.set([snowCardRef.current, ashCardRef.current].filter(Boolean), {
          clearProps: 'transform,scale,x,y'
        });
      }).catch(() => { });
    };
  }, [showFactionSelection]);

  return (
    <div ref={pageRef} className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-void-black text-on-surface select-none font-body-md">

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <img
          src="/images/menu-bg.webp"
          alt="Mythic Territories"
          className="w-full h-full object-cover object-center animate-slow-zoom pointer-events-none select-none"
          style={{ transformOrigin: 'center' }}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-void-black/60" />
        <div className="absolute inset-0 bg-void-black/20" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_0%_55%,rgba(137,206,255,0.2),transparent_64%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_55%,rgba(239,68,68,0.18),transparent_64%)]" />
        <div className="home-grid absolute inset-0 opacity-20" />
      </div>

      {/* ── SCREEN 1: MAIN MENU HERO & FOOTER ── */}
      <LobbyHero
        recoverableSession={recoverableSession}
        handleResumeSession={handleResumeSession}
        handleAbandonSession={handleAbandonSession}
        titleRef={titleRef}
        subtitleRef={subtitleRef}
        playBtnRef={playBtnRef}
        onWarm={onWarm}
        setShowModes={setShowModes}
      />

      <LobbyFooter
        footerLinksRef={footerLinksRef}
        handleNavigate={handleNavigate}
        onWarm={onWarm}
      />

      {/* ── SCREEN 2: GAME MODES OVERLAY ── */}
      {/* ── SCREEN 2: MODE SELECTION MODAL ── */}
      <ModeSelectModal
        showModes={showModes}
        showMultiplayer={showMultiplayer}
        modesOverlayRef={modesOverlayRef}
        modeCardsRef={modeCardsRef}
        modesBackRef={modesBackRef}
        isTransitioningRef={isTransitioningRef}
        handleCloseModes={handleCloseModes}
        handleModesToMultiplayer={handleModesToMultiplayer}
        loadMultiplayer={loadMultiplayer}
        handleCardMouseMove={handleCardMouseMove}
        handleCardMouseLeave={handleCardMouseLeave}
        navigateTo={navigateTo}
      />

      {/* ── SCREEN 3: MULTIPLAYER REALM HUB ── */}
      <MultiplayerModal
        showMultiplayer={showMultiplayer}
        showModes={showModes}
        mpOverlayRef={mpOverlayRef}
        isTransitioningRef={isTransitioningRef}
        handleCloseMp={handleCloseMp}
        handleMpToModes={handleMpToModes}
        handleQuickMatch={handleQuickMatch}
        isMatching={isMatching}
        handleCardMouseMove={handleCardMouseMove}
        handleCardMouseLeave={handleCardMouseLeave}
        mpCardsRef={mpCardsRef}
        mpBackRef={mpBackRef}
        mpPanel={mpPanel}
        setMpPanel={setMpPanel}
        hostIsPublic={hostIsPublic}
        setHostIsPublic={setHostIsPublic}
        hostAutoCode={hostAutoCode}
        handleRerollCode={handleRerollCode}
        handleHostRealm={handleHostRealm}
        isHosting={isHosting}
        roomCode={roomCode}
        handleRoomCodeChange={handleRoomCodeChange}
        handlePasteCode={handlePasteCode}
        handleJoinSpecificRoom={handleJoinSpecificRoom}
        openRooms={openRooms}
      />

      {/* ── SCREEN 4: FACTION SELECTION MODAL ── */}
      <FactionSelectionOverlay
        showFactionSelection={showFactionSelection}
        factionOverlayRef={factionOverlayRef}
        currentRoomId={currentRoomId}
        copiedLink={copiedLink}
        handleCopyInviteLink={handleCopyInviteLink}
        disbandCountdown={disbandCountdown}
        playersList={playersList}
        snowCardRef={snowCardRef}
        ashCardRef={ashCardRef}
        hoveredFaction={hoveredFaction}
        setHoveredFaction={setHoveredFaction}
        handleSelectFaction={handleSelectFaction}
        factionBackRef={factionBackRef}
        handleCancelFaction={handleCancelFaction}
        currentMode={currentMode}
        snowBtnState={snowBtnState}
        ashBtnState={ashBtnState}
      />

    </div>
  );
}
