import React, { useState, useEffect, useRef } from 'react';
import '../../styles/menu.css';
import {
  ArrowLeft,
  BookOpen,
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
  ScrollText,
  Shield,
  Snowflake,
  Swords,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  formatRoomCodeInput,
  isValidRoomCode,
  generateRoomCode,
  getOrCreatePlayerId,
  getPlayerId
} from '../services/roomCode.js';

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
  const [roomCode, setRoomCode] = useState('');

  const [currentMode, setCurrentMode] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [currentRoomData, setCurrentRoomData] = useState(null);
  const [mySelectedFaction, setMySelectedFaction] = useState(null);
  const [playersList, setPlayersList] = useState([]);

  // Multiplayer Hub State
  const [mpPanel, setMpPanel] = useState(null); // null | 'host' | 'join'
  const [openRooms, setOpenRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState('');
  const [isHosting, setIsHosting] = useState(false);
  const [hostIsPublic, setHostIsPublic] = useState(true);
  const [hostAutoCode, setHostAutoCode] = useState('');
  const [hostCustomCode, setHostCustomCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [disbandCountdown, setDisbandCountdown] = useState(180);

  const roomUnsubRef = useRef(null);
  const openRoomsUnsubRef = useRef(null);
  const playersListRef = useRef([]);
  const mySelectedFactionRef = useRef(null);
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

      // Snow card from left, Ash card from right — "clash" entrance
      tl.fromTo(snowCardRef.current,
        { x: -60, opacity: 0, scale: 0.96 },
        { x: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' },
        0.05
      );
      tl.fromTo(ashCardRef.current,
        { x: 60, opacity: 0, scale: 0.96 },
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

  // ── Firestore / multiplayer helpers ───────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
    };
  }, []);

  // Listen to live open rooms when multiplayer hub is open
  useEffect(() => {
    if (!showMultiplayer) {
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
      return;
    }

    setIsLoadingRooms(true);
    let isCurrent = true;

    loadMultiplayer().then(({ subscribeToOpenRooms, generateRoomCode }) => {
      if (!isCurrent) return;
      setHostAutoCode(generateRoomCode());

      openRoomsUnsubRef.current = subscribeToOpenRooms((rooms) => {
        if (isCurrent) {
          setOpenRooms(rooms);
          setIsLoadingRooms(false);
        }
      }, (err) => {
        console.warn('Open rooms subscription error:', err);
        if (isCurrent) setIsLoadingRooms(false);
      });
    });

    return () => {
      isCurrent = false;
      if (openRoomsUnsubRef.current) {
        openRoomsUnsubRef.current();
        openRoomsUnsubRef.current = null;
      }
    };
  }, [showMultiplayer]);

  // Direct join from URL invite (?room=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const roomFromUrl = p.get('room');
    if (roomFromUrl && !p.get('team')) {
      setCurrentMode('online');
      handleJoinSpecificRoom(roomFromUrl);
    }
  }, []);

  const attachRoomSubscription = (code, playerId) => {
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }

    loadMultiplayer().then(({ subscribeToRoom }) => {
      roomUnsubRef.current = subscribeToRoom(code, (roomData) => {
        if (!roomData) return;

        // Disbanded room handler
        if (roomData.status === 'DISBANDED') {
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          const reasonText = roomData.disbandReason === 'HOST_LEFT'
            ? 'The host has left the realm. The battle has been disbanded.'
            : 'This realm was disbanded due to inactivity.';
          alert(reasonText);
          setShowFactionSelection(false);
          setMySelectedFaction(null);
          setCurrentRoomId(null);
          setCurrentRoomData(null);
          setShowModes(true);
          return;
        }

        setCurrentRoomData(roomData);
        const players = roomData.players || [];
        playersListRef.current = players;
        setPlayersList(players);

        const me = players.find(p => p.id === playerId);
        if (me && me.team) {
          mySelectedFactionRef.current = me.team;
          setMySelectedFaction(me.team);
        } else {
          mySelectedFactionRef.current = null;
          setMySelectedFaction(null);
        }

        if (roomData.gameState?.gameStarted) {
          const assignedTeam = me?.team || mySelectedFactionRef.current || 'snow';
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          navigateTo('GAME', { room: code, team: assignedTeam });
        }
      }, (err) => {
        console.error('Room subscription error:', err);
      });
    });
  };

  // Heartbeat & Lobby Inactivity Timer in Faction Selection
  useEffect(() => {
    if (!showFactionSelection || !currentRoomId) return;

    const playerId = getPlayerId();
    // Immediate heartbeat ping on entering faction selection
    loadMultiplayer().then(({ updatePlayerHeartbeat }) => {
      updatePlayerHeartbeat(currentRoomId, playerId);
    });

    // Send heartbeat every 15 seconds to stay active
    const heartbeatInterval = setInterval(() => {
      loadMultiplayer().then(({ updatePlayerHeartbeat }) => {
        updatePlayerHeartbeat(currentRoomId, playerId);
      });
    }, 15000);

    // If waiting alone, run a 3-minute inactivity timer
    setDisbandCountdown(180);
    const countdownInterval = setInterval(() => {
      setDisbandCountdown((prev) => {
        if (playersListRef.current.length >= 2) return 180; // Opponent joined, reset timer
        if (prev <= 1) {
          // Timer expired: disband room
          loadMultiplayer().then(({ disbandRoom }) => {
            disbandRoom(currentRoomId, 'WAIT_TIMEOUT');
          });
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          alert('Realm was disbanded due to inactivity (no opponent joined within 3 minutes).');
          setShowFactionSelection(false);
          setMySelectedFaction(null);
          setCurrentRoomId(null);
          setCurrentRoomData(null);
          setShowModes(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(countdownInterval);
    };
  }, [showFactionSelection, currentRoomId]);

  const handleJoinSpecificRoom = async (rawCode) => {
    const code = (rawCode || '').trim().toUpperCase();
    if (!isValidRoomCode(code)) {
      alert('Please enter a valid realm code (e.g. FROST-402).');
      return;
    }

    try {
      const { joinOrCreateRoom, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();
      setCurrentRoomId(code);

      const res = await joinOrCreateRoom(code, playerId);
      if (!res.success) {
        setCurrentRoomId(null);
        alert(res.error || 'Failed to enter realm.');
        return;
      }

      setCurrentRoomData(res.room);

      // Reconnecting to active game
      if (res.room.gameState?.gameStarted && res.team) {
        navigateTo('GAME', { room: code, team: res.team });
        return;
      }

      setPlayersList(res.room.players || []);
      playersListRef.current = res.room.players || [];
      if (res.team) {
        setMySelectedFaction(res.team);
        mySelectedFactionRef.current = res.team;
      }

      setShowMultiplayer(false);
      setShowModes(false);
      setShowFactionSelection(true);

      attachRoomSubscription(code, playerId);
    } catch (err) {
      setCurrentRoomId(null);
      alert(err.message || 'Unable to join realm. Check connection or code.');
    }
  };

  const handleQuickMatch = async () => {
    if (isMatching) return;
    setIsMatching(true);
    setMatchingStatus('Scanning active realms...');

    try {
      const { quickMatch, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();

      setMatchingStatus('Entering realm...');
      const res = await quickMatch(playerId);

      if (!res.success) {
        alert('Matchmaking encountered an issue. Try hosting a realm directly.');
        setIsMatching(false);
        return;
      }

      const code = res.roomId;
      setCurrentRoomId(code);
      setCurrentRoomData(res.room);
      setPlayersList(res.room.players || []);
      playersListRef.current = res.room.players || [];

      if (res.team) {
        setMySelectedFaction(res.team);
        mySelectedFactionRef.current = res.team;
      }

      setShowMultiplayer(false);
      setShowModes(false);
      setShowFactionSelection(true);

      attachRoomSubscription(code, playerId);
    } catch (err) {
      console.error('Quick match error:', err);
      alert(err.message || 'Quick match failed.');
    } finally {
      setIsMatching(false);
      setMatchingStatus('');
    }
  };

  const handleHostRealm = async () => {
    if (isHosting) return;
    setIsHosting(true);

    try {
      const { createRoom, getOrCreatePlayerId } = await loadMultiplayer();
      const playerId = getOrCreatePlayerId();
      const targetCode = hostAutoCode || generateRoomCode();

      const res = await createRoom(playerId, {
        isPublic: hostIsPublic,
        customCode: targetCode
      });

      if (!res.success) {
        alert('Failed to host realm.');
        setIsHosting(false);
        return;
      }

      const code = res.roomId;
      setCurrentRoomId(code);
      setCurrentRoomData(res.room);
      setPlayersList(res.room.players || []);
      playersListRef.current = res.room.players || [];

      setShowMultiplayer(false);
      setShowModes(false);
      setShowFactionSelection(true);

      attachRoomSubscription(code, playerId);
    } catch (err) {
      alert(err.message || 'Failed to host realm.');
    } finally {
      setIsHosting(false);
    }
  };

  const handleRerollCode = () => {
    setHostAutoCode(generateRoomCode());
  };

  const handleRoomCodeChange = (e) => {
    const next = e.target.value;
    const formatted = formatRoomCodeInput(next, roomCode);
    setRoomCode(formatted);
  };

  const handlePasteCode = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const formatted = formatRoomCodeInput(text, roomCode);
          setRoomCode(formatted);
        }
      }
    } catch (_) { }
  };

  const handleCopyInviteLink = (code) => {
    const target = code || currentRoomId;
    if (!target) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(target)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }).catch(() => {
        prompt('Copy invite link:', url);
      });
    } else {
      prompt('Copy invite link:', url);
    }
  };

  const formatTimeAgo = (ts) => {
    if (!ts) return 'Just now';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  };

  const handleSelectFaction = async (faction) => {
    if (currentMode === 'ai') {
      navigateTo('GAME', { mode: 'local', ai: '1', team: faction });
    } else if (currentMode === 'online') {
      mySelectedFactionRef.current = faction;
      setMySelectedFaction(faction);
      try {
        const { selectFaction, getOrCreatePlayerId } = await loadMultiplayer();
        await selectFaction(currentRoomId, getOrCreatePlayerId(), faction);
      } catch (err) {
        alert(err.message || 'Failed to claim faction.');
        mySelectedFactionRef.current = null;
        setMySelectedFaction(null);
      }
    }
  };

  const handleCancelFaction = async () => {
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }
    if (currentRoomId) {
      try {
        const { leaveRoom, getOrCreatePlayerId } = await loadMultiplayer();
        await leaveRoom(currentRoomId, getOrCreatePlayerId());
      } catch (e) { }
    }
    setShowFactionSelection(false);
    setMySelectedFaction(null);
    setCurrentRoomId(null);
    setCurrentRoomData(null);
    setPlayersList([]);
    playersListRef.current = [];
    if (currentMode === 'online') { setShowMultiplayer(true); setMpPanel(null); }
    else setShowModes(true);
  };

  const getFactionBtnState = (faction) => {
    const pId = getPlayerId();
    const myPlayer = playersList.find(p => p.id === pId);
    const otherPlayer = playersList.find(p => p.id !== pId);

    const isMySelection = myPlayer?.team === faction || mySelectedFaction === faction;
    const isOtherSelection = otherPlayer?.team === faction;

    if (isMySelection) return { label: 'FACTION SELECTED', disabled: true, status: 'mine' };
    if (isOtherSelection) return { label: 'OCCUPIED BY ENEMY', disabled: true, status: 'occupied' };
    if (mySelectedFaction && mySelectedFaction !== faction) return { label: 'LOCKED', disabled: true, status: 'locked' };
    return { label: 'SELECT FACTION', disabled: false, status: 'available' };
  };

  const snowBtnState = getFactionBtnState('snow');
  const ashBtnState = getFactionBtnState('ash');

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

      <div />

      {/* ── SCREEN 1: MAIN MENU ── */}
      <main className="relative z-10 w-full flex-grow flex flex-col items-center justify-center px-4 pt-20 pb-12 text-center">
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
            onClick={() => { onWarm?.('GAME'); setShowModes(true); }}
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

      {/* Footer */}
      <footer className="relative z-10 w-full flex flex-col items-center px-6 md:px-12 py-6 bg-gradient-to-t from-void-black via-void-black/80 to-transparent gap-5 font-label-caps">
        <nav ref={footerLinksRef} aria-label="Game resources" className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
          <button
            className="home-resource-link"
            onClick={() => handleNavigate('NOTES')}
            onMouseEnter={() => onWarm?.('NOTES')}
          >
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            <span>Patch Notes</span>
          </button>
          <button
            className="home-resource-link"
            onClick={() => handleNavigate('GUIDE')}
            onMouseEnter={() => onWarm?.('GUIDE')}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Rulebook</span>
          </button>
        </nav>
        <div className="text-[10px] sm:text-xs tracking-wider text-on-surface-variant/60">
          © 2025 Mythic Territories
        </div>
      </footer>

      {/* ── SCREEN 2: GAME MODES OVERLAY ── */}
      {showModes && (
        <div
          ref={modesOverlayRef}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-void-black/80 backdrop-blur-md ${
            showModes && showMultiplayer ? 'pointer-events-none' : ''
          }`}
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
      )}

      {/* ── SCREEN 3: MULTIPLAYER REALM HUB ── */}
      {showMultiplayer && (
        <div
          ref={mpOverlayRef}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
            showModes && showMultiplayer
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
                  className={`card-gold glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${
                    isMatching ? 'border-ember-gold ring-2 ring-ember-gold/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]' : 'border-outline/20'
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
                  className={`card-frost glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${
                    mpPanel === 'host' ? 'border-ice-light ring-2 ring-ice-light/40 shadow-[0_0_25px_rgba(165,243,252,0.2)]' : 'border-outline/20'
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
                  className={`card-fire glass-obsidian border p-4 sm:p-6 md:p-8 rounded-xl flex flex-row md:flex-col items-center text-left md:text-center justify-start md:justify-center gap-4 sm:gap-6 group w-full cursor-pointer transition-all ${
                    mpPanel === 'join' ? 'border-magma-core ring-2 ring-magma-core/40 shadow-[0_0_25px_rgba(239,68,68,0.2)]' : 'border-outline/20'
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
                        className={`flex-1 py-2 px-3 rounded text-xs font-label-caps tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          hostIsPublic
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
                        className={`flex-1 py-2 px-3 rounded text-xs font-label-caps tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          !hostIsPublic
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
                    className={`w-full py-3 transition-all rye-font tracking-widest rounded-md text-sm font-bold cursor-pointer ${
                      isValidRoomCode(roomCode)
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
      )}

      {/* ── SCREEN 4: FACTION SELECTION MODAL ── */}
      {showFactionSelection && (
        <div
          ref={factionOverlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/90 backdrop-blur-xl p-2 sm:p-4 md:p-6 overflow-hidden"
          style={{ opacity: 0 }}
        >
          <div className="modal-content w-full max-w-4xl max-h-[98vh] flex flex-col justify-center items-center overflow-visible">
            <div className="flex flex-col items-center py-1 sm:py-2 w-full overflow-visible">

              {/* Header */}
              <div className="flex flex-col items-center text-center mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 text-ember-gold/70 text-[9px] sm:text-[10px] font-label-caps tracking-[0.25em] mb-0.5 uppercase">
                  <span>⚔️</span>
                  <span>CLASH OF REALMS</span>
                  <span>⚔️</span>
                </div>
                <h2 className="almendra-font text-xl sm:text-2xl md:text-3xl lg:text-4xl text-ember-gold tracking-widest uppercase font-bold drop-shadow-[0_2px_14px_rgba(245,158,11,0.4)]">
                  CHOOSE YOUR FACTION
                </h2>
                <p className="text-on-surface-variant font-label-caps text-[9px] sm:text-xs tracking-[0.18em] mt-0.5 uppercase opacity-75">
                  Command your legion &bull; Conquer elemental territory
                </p>
              </div>

              {/* Realm & Match Status Bar */}
              {currentRoomId && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-2.5 sm:mb-4 w-full max-w-xl">
                  {/* Realm code badge + copy */}
                  <div className="flex items-center gap-2 bg-void-black/80 backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-xl border border-ember-gold/30 shadow-md">
                    <Shield className="h-3.5 w-3.5 text-ember-gold" />
                    <span className="text-[10px] sm:text-xs font-label-caps text-ember-gold/80 tracking-wider">REALM</span>
                    <strong className="font-mono text-xs sm:text-sm text-pure-snow tracking-wider px-2 py-0.5 rounded-md bg-ember-gold/10 border border-ember-gold/25">
                      {currentRoomId}
                    </strong>
                    <button
                      type="button"
                      className="ml-1 px-2.5 py-1 text-[10px] sm:text-[11px] bg-ember-gold/15 hover:bg-ember-gold/30 border border-ember-gold/40 text-ember-gold hover:text-pure-snow rounded-lg cursor-pointer transition-all active:scale-95 font-label-caps flex items-center gap-1 shadow-sm"
                      onClick={() => handleCopyInviteLink(currentRoomId)}
                      title="Copy Realm Invite Link"
                    >
                      {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedLink ? 'Copied' : 'Invite'}</span>
                    </button>
                  </div>

                  {/* Opponent Status Pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-void-black/70 border border-outline/20 backdrop-blur-sm text-[10px] sm:text-xs font-label-caps tracking-wider shadow-inner">
                    <span className={`inline-block h-2 w-2 rounded-full ${playersList.length >= 2 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
                    <span className={playersList.length >= 2 ? 'text-emerald-400 font-semibold' : 'text-on-surface-variant flex items-center gap-1.5'}>
                      {playersList.length >= 2 ? (
                        '2 Connected'
                      ) : (
                        <>
                          <Clock className="h-3 w-3 text-ember-gold/80" />
                          <span>Waiting for opponent... ({Math.floor(disbandCountdown / 60)}:{(disbandCountdown % 60).toString().padStart(2, '0')})</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Faction Cards Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-5 w-full p-1 sm:p-2 overflow-visible">

                {/* FROST LORD CARD */}
                <div
                  ref={snowCardRef}
                  className={`card-frost glass-obsidian border rounded-xl overflow-hidden flex flex-col group ${
                    snowBtnState.status === 'mine'
                      ? 'border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                      : snowBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : 'border-ice-light/30 cursor-pointer'
                  }`}
                  style={{ opacity: 0 }}
                  onClick={() => !snowBtnState.disabled && handleSelectFaction('snow')}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                >
                  {/* Hero Artwork Container */}
                  <div className="relative h-24 sm:h-36 md:h-44 lg:h-48 overflow-hidden bg-void-black">
                    {/* Atmospheric Glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.25)_0%,_transparent_75%)] pointer-events-none" />

                    {/* Domain Badge Top-Left */}
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-void-black/80 border border-ice-light/40 backdrop-blur-md shadow-lg">
                      <Snowflake className="h-3 w-3 text-ice-light" />
                      <span className="font-label-caps text-[8px] sm:text-[10px] tracking-widest text-ice-light font-bold">FROST DOMAIN</span>
                    </div>

                    {/* Status Indicator Badge Top-Right */}
                    {snowBtnState.status === 'mine' && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 backdrop-blur-md text-emerald-300 font-label-caps text-[8px] sm:text-[10px] tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>CHOSEN</span>
                      </div>
                    )}
                    {snowBtnState.status === 'occupied' && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-void-black/80 border border-outline/40 backdrop-blur-md text-on-surface-variant font-label-caps text-[8px] sm:text-[10px] tracking-widest">
                        <Lock className="h-3 w-3 text-magma-core" />
                        <span>OCCUPIED</span>
                      </div>
                    )}

                    <img
                      alt="Frost Lord"
                      decoding="async"
                      className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-108"
                      src="/units/frost-lord.webp"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-void-black to-transparent" />
                  </div>

                  {/* Card Content */}
                  <div className="p-3 sm:p-4 md:p-5 flex flex-col justify-between flex-grow gap-2 sm:gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className="text-sm sm:text-base md:text-xl text-ice-light tracking-widest uppercase almendra-font font-bold drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
                          FROST LORD
                        </h3>
                        <span className="text-[8px] sm:text-[9px] font-label-caps tracking-widest text-ice-light/70 hidden sm:inline-block">CONTROL / DEFENSE</span>
                      </div>
                      <p className="text-on-surface-variant text-[10px] sm:text-xs leading-relaxed mb-2">
                        Absolute order and crystalline geometry. Freeze enemies and construct glacial barriers to outlast the storm.
                      </p>

                      {/* Trait Pills */}
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-ice-light/10 border border-ice-light/20 text-[8px] sm:text-[9px] font-label-caps text-ice-light tracking-wider">
                          ❄️ Glacial Wall
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-ice-light/10 border border-ice-light/20 text-[8px] sm:text-[9px] font-label-caps text-ice-light tracking-wider">
                          🛡️ Heavy Armor
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-ice-light/10 border border-ice-light/20 text-[8px] sm:text-[9px] font-label-caps text-ice-light tracking-wider">
                          🧊 Chill Aura
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className={`mt-1 py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 rounded-xl tracking-widest transition-all rye-font text-[10px] sm:text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${
                        snowBtnState.status === 'mine'
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-default'
                          : snowBtnState.status === 'occupied'
                          ? 'bg-void-black/60 border border-outline/30 text-on-surface-variant/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-ice-light/20 via-sky-400/30 to-ice-light/20 hover:from-sky-400/40 hover:to-ice-light/40 border border-ice-light/60 hover:border-ice-light text-pure-snow shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] cursor-pointer active:scale-98'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!snowBtnState.disabled) handleSelectFaction('snow');
                      }}
                      disabled={snowBtnState.disabled}
                    >
                      {snowBtnState.status === 'mine' && <Check className="h-4 w-4 text-emerald-400" />}
                      <span>{snowBtnState.label}</span>
                      {snowBtnState.status === 'available' && <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-ice-light group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>
                </div>

                {/* ASH TYRANT CARD */}
                <div
                  ref={ashCardRef}
                  className={`card-fire glass-obsidian border rounded-xl overflow-hidden flex flex-col group ${
                    ashBtnState.status === 'mine'
                      ? 'border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                      : ashBtnState.status === 'occupied'
                      ? 'border-outline/20 opacity-55 grayscale-[35%]'
                      : 'border-magma-core/30 cursor-pointer'
                  }`}
                  style={{ opacity: 0 }}
                  onClick={() => !ashBtnState.disabled && handleSelectFaction('ash')}
                  onMouseMove={handleCardMouseMove}
                  onMouseLeave={handleCardMouseLeave}
                >
                  {/* Hero Artwork Container */}
                  <div className="relative h-24 sm:h-36 md:h-44 lg:h-48 overflow-hidden bg-void-black">
                    {/* Atmospheric Glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.28)_0%,_transparent_75%)] pointer-events-none" />

                    {/* Domain Badge Top-Left */}
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-void-black/80 border border-magma-core/40 backdrop-blur-md shadow-lg">
                      <Flame className="h-3 w-3 text-magma-core" />
                      <span className="font-label-caps text-[8px] sm:text-[10px] tracking-widest text-magma-core font-bold">ASH DOMAIN</span>
                    </div>

                    {/* Status Indicator Badge Top-Right */}
                    {ashBtnState.status === 'mine' && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 backdrop-blur-md text-emerald-300 font-label-caps text-[8px] sm:text-[10px] tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>CHOSEN</span>
                      </div>
                    )}
                    {ashBtnState.status === 'occupied' && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-void-black/80 border border-outline/40 backdrop-blur-md text-on-surface-variant font-label-caps text-[8px] sm:text-[10px] tracking-widest">
                        <Lock className="h-3 w-3 text-magma-core" />
                        <span>OCCUPIED</span>
                      </div>
                    )}

                    <img
                      alt="Ash Tyrant"
                      decoding="async"
                      className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-108"
                      src="/units/ash-tyrant.webp"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-void-black to-transparent" />
                  </div>

                  {/* Card Content */}
                  <div className="p-3 sm:p-4 md:p-5 flex flex-col justify-between flex-grow gap-2 sm:gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className="text-sm sm:text-base md:text-xl text-magma-core tracking-widest uppercase almendra-font font-bold drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                          ASH TYRANT
                        </h3>
                        <span className="text-[8px] sm:text-[9px] font-label-caps tracking-widest text-magma-core/70 hidden sm:inline-block">ASSAULT / BURST</span>
                      </div>
                      <p className="text-on-surface-variant text-[10px] sm:text-xs leading-relaxed mb-2">
                        Explosive violence and volcanic power. Break enemy lines with raw lava projectiles and scorched-earth hazards.
                      </p>

                      {/* Trait Pills */}
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-magma-core/10 border border-magma-core/20 text-[8px] sm:text-[9px] font-label-caps text-magma-core tracking-wider">
                          🔥 Scorched Earth
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-magma-core/10 border border-magma-core/20 text-[8px] sm:text-[9px] font-label-caps text-magma-core tracking-wider">
                          ⚔️ Armor Pierce
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-magma-core/10 border border-magma-core/20 text-[8px] sm:text-[9px] font-label-caps text-magma-core tracking-wider">
                          💥 Lava Blast
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className={`mt-1 py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 rounded-xl tracking-widest transition-all rye-font text-[10px] sm:text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${
                        ashBtnState.status === 'mine'
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
                      {ashBtnState.status === 'mine' && <Check className="h-4 w-4 text-emerald-400" />}
                      <span>{ashBtnState.label}</span>
                      {ashBtnState.status === 'available' && <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-magma-core group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Back Button */}
              <button
                ref={factionBackRef}
                className="mt-3 sm:mt-5 text-on-surface-variant hover:text-ember-gold transition-colors flex items-center gap-2 group cursor-pointer font-label-caps tracking-widest uppercase text-xs sm:text-sm"
                onClick={handleCancelFaction}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 back-arrow-icon" aria-hidden="true" />
                {currentMode === 'online' ? 'LEAVE REALM' : 'RETURN TO MODES'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
