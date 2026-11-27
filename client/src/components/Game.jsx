import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '@/styles/game.css';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Skull from 'lucide-react/dist/esm/icons/skull.js';
import Swords from 'lucide-react/dist/esm/icons/swords.js';
import Trophy from 'lucide-react/dist/esm/icons/trophy.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Crosshair from 'lucide-react/dist/esm/icons/crosshair.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import Board from './Board.jsx';
import AscensionModal from './AscensionModal.jsx';
import VictoryScreen from './VictoryScreen.jsx';
import PieceTooltip from './game/PieceTooltip.jsx';
import GameActionDrawer from './game/GameActionDrawer.jsx';
import { triggerHaptic } from '../services/haptics.js';
import { computePowerDiagram } from '@shared/voronoi.js';
import * as Logic from '@shared/logic.js';
import * as C from '@shared/constants.js';
import * as E from '@shared/utils.js';
import * as Effects from '@/effects';
import { spawnCastAnimation } from '../services/spriteAnimator.js';
import {
  getOrCreatePlayerId,
  saveActiveSession,
  clearActiveSession
} from '../services/roomCode.js';
import {
  subscribeToRoom,
  dispatchGameAction,
  validatePeerAction,
  leaveRoom,
  disbandRoom,
  updatePlayerHeartbeat
} from '../services/multiplayer.js';
import {
  calculateDynamicTerritoryAreas,
  getFallenUnits,
  resetTerritoryCache
} from '../services/gameTerritory.js';
import { loadGsap } from '../services/gsap.js';

export default function Game({ navigateTo }) {
  const [gameState, setGameState] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  const [disconnectTimeout, setDisconnectTimeout] = useState(60);
  const [eventLog, setEventLog] = useState([]);
  const [hoveredPiece, setHoveredPiece] = useState(null);
  const [hoveredMousePos, setHoveredMousePos] = useState(null);
  const [hoveredAbilityKey, setHoveredAbilityKey] = useState(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(window.innerWidth <= 1180);
  const [arenaScale, setArenaScale] = useState(1);
  const [battleCountdown, setBattleCountdown] = useState(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [timers, setTimers] = useState({ snow: 600, ash: 600 });
  const gameStateRef = useRef(gameState);
  const pageRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setHoveredAbilityKey(null);
  }, [gameState?.selectedPiece?.id, gameState?.currentState]);

  // Entry animation (opposite of exit: smoothly fade and slide in from -25px down to 0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) return;

    let ctx;
    loadGsap().then(gsap => {
      if (pageRef.current?.nodeType === 1) {
        ctx = gsap.context(() => {
          gsap.fromTo(
            pageRef.current,
            { opacity: 0, y: -25 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' }
          );
        }, pageRef);
      }
    }).catch(console.warn);

    return () => ctx?.revert();
  }, []);

  // Smooth Game Over entrance transition and hover dismissal
  useEffect(() => {
    if (gameState?.gameOver) {
      clearActiveSession();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
      const isWinner = gameState.winner === myTeam;
      if (isWinner) {
        triggerHaptic('victory');
      } else {
        triggerHaptic('defeat');
      }
      setHoveredPiece(null);
      const timer = setTimeout(() => {
        setShowGameOverModal(true);
        requestAnimationFrame(() => {
          setModalVisible(true);
        });
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setShowGameOverModal(false);
      setModalVisible(false);
    }
  }, [gameState?.gameOver, myTeam]);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState?.timers) {
      setTimers(prev => {
        if (prev.snow !== gameState.timers.snow || prev.ash !== gameState.timers.ash) {
          return { snow: gameState.timers.snow, ash: gameState.timers.ash };
        }
        return prev;
      });
    }
  }, [gameState]);

  // Global 5s Battle Countdown when match begins in multiplayer
  useEffect(() => {
    if (!gameState?.gameStarted || gameState?.gameOver) {
      setBattleCountdown(null);
      return;
    }

    const targetTime = gameState.battleStartTime;
    if (!targetTime) {
      setBattleCountdown(null);
      return;
    }

    const checkCountdown = () => {
      const diff = targetTime - Date.now();
      if (diff > 0) {
        setBattleCountdown(Math.ceil(diff / 1000));
      } else if (diff > -1000) {
        setBattleCountdown(0);
      } else {
        setBattleCountdown(null);
      }
    };

    checkCountdown();
    const interval = setInterval(checkCountdown, 100);
    return () => clearInterval(interval);
  }, [gameState?.gameStarted, gameState?.battleStartTime, gameState?.gameOver]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth <= 1180;
      setIsCompactLayout(compact);
      if (!compact) {
        const availableH = window.innerHeight - 8;
        const availableW = window.innerWidth - 8;
        const sY = availableH / 985;
        const sX = availableW / 1536;
        setArenaScale(Math.min(sY, sX, 1));
      } else {
        setArenaScale(1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const preloadedImagesRef = useRef({});
  const roomUnsubRef = useRef(null);
  const lastProcessedEventsRef = useRef(null);
  const lastVerifiedGsRef = useRef(null);
  const prevPlayersCountRef = useRef(1);
  const aiWorkerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const disconnectTimerIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const gameMode = params.get('mode');
  const isLocal = gameMode === 'local';
  const vsAI = params.get('ai') === '1';

  // Helper to format remaining timer values
  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '10:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Safe state cloner avoiding DataCloneError on Image objects
  const cloneState = (gs) => {
    if (!gs) return null;
    return {
      ...gs,
      pieces: gs.pieces ? gs.pieces.map(p => ({
        ...p,
        ability: p.ability ? { ...p.ability } : undefined,
        veteranAbility: p.veteranAbility ? { ...p.veteranAbility } : undefined
      })) : [],
      frostfallBlessings: gs.frostfallBlessings?.length ? gs.frostfallBlessings.map(b => ({ ...b })) : [],
      spikeRains: gs.spikeRains?.length ? gs.spikeRains.map(s => ({ ...s })) : [],
      reignOfFires: gs.reignOfFires?.length ? gs.reignOfFires.map(r => ({ ...r })) : [],
      shields: gs.shields?.length ? gs.shields.map(s => ({ ...s })) : [],
      debuffs: gs.debuffs?.length ? gs.debuffs.map(d => ({ ...d })) : [],
      temporaryBoosts: gs.temporaryBoosts?.length ? gs.temporaryBoosts.map(b => ({ ...b })) : [],
      specialTerrains: gs.specialTerrains?.length ? gs.specialTerrains.map(t => ({ ...t })) : [],
      unstableGrounds: gs.unstableGrounds?.length ? gs.unstableGrounds.map(u => ({ ...u })) : [],
      glacialWalls: gs.glacialWalls?.length ? gs.glacialWalls.map(w => ({ ...w })) : [],
      deathMeteors: gs.deathMeteors?.length ? gs.deathMeteors.map(m => ({ ...m })) : [],
      events: gs.events?.length ? [...gs.events] : [],
      snowTerritory: Array.isArray(gs.snowTerritory) ? gs.snowTerritory : (gs.snowTerritory ? Array.from(gs.snowTerritory) : []),
      ashTerritory: Array.isArray(gs.ashTerritory) ? gs.ashTerritory : (gs.ashTerritory ? Array.from(gs.ashTerritory) : [])
    };
  };

  // Toast/Flash messages
  const showFlash = (msg, type = 'neutral') => {
    setFlashMessage({ msg, type });
    setTimeout(() => setFlashMessage(null), 3000);
  };

  // 1. Load board textures first, then warm secondary effect assets without blocking play.
  useEffect(() => {
    let cancelled = false;
    let idleTask = null;
    const preferredBoardKey = params.get('team') === 'ash'
      ? 'gameBackgroundAsh'
      : 'gameBackgroundSnow';
    const criticalSources = {
      [preferredBoardKey]: C.IMAGES[preferredBoardKey]
    };
    const deferredSources = Object.fromEntries(
      Object.entries(C.IMAGES).filter(([key]) => key !== preferredBoardKey)
    );

    E.preloadImages(criticalSources, (imgs) => {
      if (cancelled) return;
      Object.assign(preloadedImagesRef.current, imgs);
      setImagesLoaded(true);

      const loadDeferredAssets = () => {
        E.preloadImages(deferredSources, (secondaryImages) => {
          if (!cancelled) Object.assign(preloadedImagesRef.current, secondaryImages);
        }, { fetchPriority: 'low' });
      };

      idleTask = window.requestIdleCallback
        ? window.requestIdleCallback(loadDeferredAssets, { timeout: 1800 })
        : window.setTimeout(loadDeferredAssets, 500);
    }, { fetchPriority: 'high' });

    return () => {
      cancelled = true;
      if (idleTask !== null) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleTask);
        else window.clearTimeout(idleTask);
      }
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
      if (roomId) {
        leaveRoom(roomId, getOrCreatePlayerId());
      }
      if (aiWorkerRef.current) aiWorkerRef.current.terminate();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (disconnectTimerIntervalRef.current) clearInterval(disconnectTimerIntervalRef.current);
    };
  }, []);

  // 2. Main Game Setup and Connections
  useEffect(() => {
    if (!imagesLoaded) return;

    if (isLocal) {
      // Local Play Setup
      const initialGs = {};
      Logic.initGameState(initialGs);
      Logic.initGame(initialGs);
      const gs = Logic.getGameState(initialGs);

      // Attach images so effects.js canvas drawing won't crash
      gs.images = preloadedImagesRef.current;
      gs.boardImgs = {
        gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
        gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
      };

      gs.timers = { snow: 600, ash: 600 };
      if (!vsAI) {
        setMyTeam('snow');
        gs.gameStarted = false;
      } else {
        const teamParam = params.get('team') || 'snow';
        setMyTeam(teamParam);
        gs.gameStarted = false;
      }

      gs.playerTeam = params.get('team') || 'snow';
      E.updateBoardMap(gs);
      setGameState(cloneState(gs));

      // If AI goes first
      if (vsAI && gs.currentTurn !== (params.get('team') || 'snow')) {
        setTimeout(checkAITurn, 200);
      }
    } else {
      // Cloud Firestore Online Multiplayer Setup
      const assignedTeam = params.get('team') || 'snow';
      setMyTeam(assignedTeam);

      const playerId = getOrCreatePlayerId();
      let isFirstSync = true;
      updatePlayerHeartbeat(roomId, playerId);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        if (!gameStateRef.current?.gameOver) {
          updatePlayerHeartbeat(roomId, playerId);
        } else if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      }, 20000);

      roomUnsubRef.current = subscribeToRoom(roomId, (roomData) => {
        if (!roomData) return;

        if (roomData.status === 'DISBANDED') {
          if (roomUnsubRef.current) {
            roomUnsubRef.current();
            roomUnsubRef.current = null;
          }
          alert('This battle realm has been disbanded.');
          handleExitToLobby();
          return;
        }

        const gs = roomData.gameState;
        if (!gs) return;

        // Anti-Cheat Peer Move Verification
        if (roomData.lastAction && lastVerifiedGsRef.current) {
          const action = roomData.lastAction;
          if (action.senderId !== playerId && ['MOVE', 'ABILITY', 'HANDLE_CLICK', 'SACRIFICE', 'RELEASE', 'RIFT_PULSE', 'DESPAWN'].includes(action.type)) {
            const verification = validatePeerAction(lastVerifiedGsRef.current, action, gs);
            if (!verification.valid) {
              console.warn('[Anti-Cheat] Flagged invalid opponent action:', verification.reason);
              showFlash(`Anti-Cheat Alert: ${verification.reason}`, 'error');
            }
          }
        }
        lastVerifiedGsRef.current = cloneState(gs);

        const players = roomData.players || [];
        setPlayerCount(players.length);

        // Determine player team
        const me = players.find(p => p.id === playerId);
        const effectiveTeam = me?.team || assignedTeam;
        setMyTeam(effectiveTeam);

        // Maintain local asset images
        gs.images = preloadedImagesRef.current;
        gs.boardImgs = {
          gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
          gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
        };
        gs.playerTeam = effectiveTeam;

        E.updateBoardMap(gs);

        // Process any new events from this update
        if (gs.events && gs.events.length > 0) {
          const eventsKey = JSON.stringify(gs.events) + '_' + (roomData.updatedAt || '');
          if (lastProcessedEventsRef.current !== eventsKey) {
            lastProcessedEventsRef.current = eventsKey;
            processAnimationEvents(gs.events, gs);
          }
        }

        setGameState(cloneState(gs));

        if (isFirstSync) {
          isFirstSync = false;
          showFlash(`Joined realm ${roomId} as Team ${effectiveTeam.toUpperCase()}`, 'neutral');
          if (gs.gameStarted && !gs.gameOver) {
            saveActiveSession({ roomId, team: effectiveTeam, mode: 'online' });
          }
        } else {
          if (gs.gameStarted && !gs.gameOver) {
            saveActiveSession({ roomId, team: effectiveTeam, mode: 'online' });
          }
          // Detect player joins / disconnects
          if (players.length > prevPlayersCountRef.current) {
            showFlash('An opponent has entered the realm!', 'neutral');
            setIsOpponentDisconnected(false);
            if (disconnectTimerIntervalRef.current) {
              clearInterval(disconnectTimerIntervalRef.current);
            }
          } else if (players.length < prevPlayersCountRef.current) {
            showFlash('Opponent disconnected from the realm.', 'error');
            if (gs.gameStarted && !gs.gameOver) {
              setIsOpponentDisconnected(true);
              setDisconnectTimeout(60);
              startDisconnectTimer();
            }
          }
        }
        prevPlayersCountRef.current = players.length;
      }, (err) => {
        console.error('Firestore room error:', err);
        alert(err.message || 'Unable to connect to realm.');
      });

      const handleOnline = () => {
        showFlash('Connection restored. Resyncing realm...', 'neutral');
        updatePlayerHeartbeat(roomId, playerId);
      };
      window.addEventListener('online', handleOnline);

      return () => {
        window.removeEventListener('online', handleOnline);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (roomUnsubRef.current) {
          roomUnsubRef.current();
          roomUnsubRef.current = null;
        }
      };
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
        roomUnsubRef.current = null;
      }
    };
  }, [imagesLoaded]);

  // Local clock ticking interval
  const startCountdown = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    let lastTick = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTick) / 1000;
      if (elapsed < 1) return;
      const deltaSec = Math.floor(elapsed);
      lastTick += deltaSec * 1000;

      const gs = gameStateRef.current;
      if (!gs || gs.gameOver || !gs.gameStarted) return;

      // Hold turn timers during pre-battle countdown
      if (gs.battleStartTime && Date.now() < gs.battleStartTime) {
        lastTick = Date.now();
        return;
      }

      const turn = gs.currentTurn || 'snow';
      if (!gs.timers) gs.timers = { snow: 600, ash: 600 };

      if (gs.timers[turn] > 0) {
        gs.timers[turn] = Math.max(0, gs.timers[turn] - 1);
        setTimers({ snow: gs.timers.snow, ash: gs.timers.ash });
      } else {
        // Timeout trigger
        if (isLocal) {
          setGameState(prev => {
            if (!prev) return null;
            const updated = cloneState(prev);
            Logic.initGameState(updated);
            Logic.endGame(turn === 'snow' ? 'ash' : 'snow', updated);
            const newGs = Logic.getGameState(updated);
            newGs.images = preloadedImagesRef.current;
            newGs.boardImgs = {
              gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
              gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
            };
            return cloneState(newGs);
          });
        } else {
          dispatchGameAction(roomId, getOrCreatePlayerId(), 'TIMEOUT', { team: turn }).catch(console.warn);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    if (gameState?.gameStarted && !gameState?.gameOver) {
      startCountdown();
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameState?.gameStarted, gameState?.gameOver]);

  useEffect(() => {
    if (!gameState?.selectedPiece) {
      setDrawerExpanded(false);
    }
  }, [gameState?.selectedPiece?.id]);

  const piecesKey = useMemo(() => {
    return gameState?._piecesKey || (gameState?.pieces ? gameState.pieces.map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`).join('|') : '');
  }, [gameState?.pieces, gameState?._piecesKey]);
  const terrScores = useMemo(() => calculateDynamicTerritoryAreas(gameState), [gameState, piecesKey]);
  const { fallenSnow, fallenAsh } = useMemo(() => getFallenUnits(gameState?.pieces), [piecesKey]);

  const handleMouseEnterPiece = useCallback((piece, e) => {
    if (gameStateRef.current?.gameOver) return;
    if (e) {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setHoveredMousePos({ x: e.clientX, y: e.clientY });
    }
    setHoveredPiece(piece);
  }, []);

  const handleMouseMovePiece = useCallback((piece, e) => {
    if (e) mousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseLeavePiece = useCallback(() => {
    mousePosRef.current = null;
    setHoveredPiece(null);
    setHoveredMousePos(null);
  }, []);

  const handleExitToLobby = () => {
    clearActiveSession();
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }
    if (roomId) {
      leaveRoom(roomId, getOrCreatePlayerId());
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) {
      navigateTo('LOBBY');
      return;
    }

    loadGsap().then(gsap => {
      if (pageRef.current?.nodeType === 1) {
        gsap.to(pageRef.current, {
          opacity: 0,
          y: -25,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => navigateTo('LOBBY')
        });
      } else {
        navigateTo('LOBBY');
      }
    }).catch(() => navigateTo('LOBBY'));
  };

  // Disconnect countdown timer
  const startDisconnectTimer = () => {
    if (disconnectTimerIntervalRef.current) clearInterval(disconnectTimerIntervalRef.current);

    disconnectTimerIntervalRef.current = setInterval(() => {
      setDisconnectTimeout(prev => {
        if (prev <= 1) {
          clearInterval(disconnectTimerIntervalRef.current);
          if (roomId) disbandRoom(roomId, 'DISCONNECT_TIMEOUT');
          alert('Match ended due to player disconnection.');
          handleExitToLobby();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getOrCreateAiWorker = () => {
    if (!aiWorkerRef.current) {
      aiWorkerRef.current = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
    }
    return aiWorkerRef.current;
  };

  // Web Worker AI player decision execution
  const checkAITurn = () => {
    if (!isLocal || !vsAI || !gameState || gameState.gameOver) return;

    const aiTeam = myTeam === 'snow' ? 'ash' : 'snow';
    if (gameState.currentTurn !== aiTeam) return;

    const worker = getOrCreateAiWorker();

    worker.onmessage = (ev) => {
      const { bestAction } = ev.data;
      if (bestAction) {
        if (bestAction.type === 'move') {
          processLocalAction('MOVE', {
            pieceId: bestAction.piece.id,
            r: bestAction.target.row,
            c: bestAction.target.col,
            isHighway: bestAction.target.isHighway || false
          });
        } else if (bestAction.type === 'ability') {
          processLocalAction('ABILITY', {
            pieceId: bestAction.piece.id,
            abilityKey: bestAction.abilityKey,
            target: bestAction.target
          });
        }
      }
    };

    const workerState = cloneState(gameState);
    if (workerState) {
      delete workerState.images;
      delete workerState.boardImgs;
    }
    worker.postMessage({
      gameState: workerState,
      aiConfig: {}
    });
  };

  // Helper to apply local gameplay actions
  const processLocalAction = (actionType, data) => {
    setGameState(prev => {
      if (!prev) return null;

      const nextState = cloneState(prev);
      nextState.events = [];

      // Load standard Logic engine with current state
      Logic.initGameState(nextState);

      // 1. Process damage animations & lunges
      let turnEnded = false;
      const find = (id) => nextState.pieces.find(x => x.id === id);

      switch (actionType) {
        case 'SELECT_PIECE':
          const p = find(data.pieceId);
          if (p) Logic.selectPiece(p, nextState); else Logic.deselectPiece(nextState);
          break;

        case 'MOVE':
          const mp = find(data.pieceId);
          if (mp) {
            const defender = C.getPieceAt(data.r, data.c, nextState.pieces);
            if (defender && defender.team !== mp.team) {
              if (mp.key === 'ashMagmaShaper') {
                Effects.spawnLavaGlobEffect(mp.row, mp.col, data.r, data.c, nextState);
              } else {
                mp.isAnimating = true; // Trigger visual shake/lunge in Piece.jsx
              }
              const preview = E.previewDamage(mp, defender, nextState);
              if (preview.isFatal) {
                // Piece dissolve trigger
                defender.fadeAlpha = 1.0;
                defender.isFading = true;
              }
            }
            turnEnded = Logic.movePiece(mp, data.r, data.c, data.isHighway, nextState);
          }
          break;

        case 'ABILITY':
          const cp = find(data.pieceId);
          if (cp) {
            if (data.target) {
              cp.isAnimating = true; // Trigger cast pulse lunge
              turnEnded = Logic.executeAbility(cp, data.target, data.abilityKey, nextState);
            } else {
              turnEnded = Logic.activateAbility(cp, data.abilityKey || data.unleashCostOrKey || 0, nextState);
            }
          }
          break;

        case 'HANDLE_CLICK':
          turnEnded = Logic.handleAbilityClick(data.r, data.c, nextState);
          break;

        case 'SWITCH_TURN':
          turnEnded = true;
          break;

        case 'ASCENSION_CHOICE':
          turnEnded = Logic.executeAscensionChoice(data.choice, nextState);
          break;

        case 'CANCEL_ASCENSION':
          Logic.cancelAscensionChoice(nextState);
          break;

        case 'SACRIFICE':
          turnEnded = Logic.executeSacrifice(find(data.pieceId), nextState);
          break;

        case 'RELEASE':
          turnEnded = Logic.executeRelease(find(data.pieceId), nextState);
          break;

        case 'RIFT_PULSE':
          const rp = find(data.pieceId);
          if (rp) rp.isAnimating = true;
          turnEnded = Logic.executeRiftPulse(rp, nextState);
          break;

        case 'DESPAWN':
          Logic.despawnPiece(find(data.pieceId), nextState);
          turnEnded = true;
          break;

        case 'TIMEOUT':
          Logic.endGame(data.team === 'snow' ? 'ash' : 'snow', nextState);
          break;

        case 'TOGGLE_TEST_MODE':
          nextState.testMode = data.enabled;
          if (nextState.testMode) {
            if (!nextState.originalPieces) {
              nextState.originalPieces = JSON.parse(JSON.stringify(nextState.pieces));
            }
            const testKeys = ['snowFrostLord', 'snowGlacialMage', 'snowSoulLinker', 'ashAshTyrant', 'ashMagmaShaper', 'ashAshReaper'];
            nextState.pieces = nextState.pieces.filter(x => testKeys.includes(x.key));
          } else {
            if (nextState.originalPieces) {
              nextState.pieces = JSON.parse(JSON.stringify(nextState.originalPieces));
              delete nextState.originalPieces;
            }
            nextState.glacialRemnants = [];
            nextState.knownGlacialRemnants = [];
            nextState.dyingGlacialRemnants = [];
            nextState.blizzardStorms = [];
            nextState.glacialFractureAnimations = [];
            nextState.aColdFarewellAnimations = [];
            nextState.farewellVignette = null;
          }
          break;
      }

      E.updateBoardMap(nextState);

      if (turnEnded && !nextState.gameOver) {
        const ascensionTriggered = Logic.checkAscensionReady(nextState);
        if (!ascensionTriggered) {
          Logic.switchTurn(nextState);
        }
      }

      // Sync and retrieve updated state from logic engine
      const finalState = Logic.getGameState(nextState);

      // Keep preloaded image assets intact
      finalState.images = preloadedImagesRef.current;
      finalState.boardImgs = {
        gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
        gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
      };
      finalState.playerTeam = myTeam;

      // Handle visual animation ticks
      if (nextState.events && nextState.events.length > 0) {
        processAnimationEvents(nextState.events, finalState);
      }

      // Check if AI turn scheduled
      if (vsAI && finalState.currentTurn !== myTeam && !finalState.gameOver) {
        setTimeout(checkAITurn, 500);
      }

      return cloneState(finalState);
    });
  };

  // Visual effects trigger hook
  const processAnimationEvents = (events, gs) => {
    events.forEach(event => {
      switch (event.type) {
        case 'FLASH':
          setEventLog(prev => [{
            text: event.message,
            turn: gs?.turnCount || 1,
            team: event.team === 'snow' ? 'snow' : event.team === 'ash' ? 'ash' : 'neutral'
          }, ...prev.slice(0, 49)]);
          break;

        case 'GAME_OVER':
          setEventLog(prev => [{
            text: `GAME OVER: Team ${event.winningTeam === 'snow' ? 'FROST' : 'ASH'} has secured victory!`,
            turn: gs?.turnCount || 1,
            team: event.winningTeam === 'snow' ? 'snow' : 'ash'
          }, ...prev.slice(0, 49)]);
          break;

        case 'ANIMATION':
          // Trigger particles inside effects.js canvas systems
          playVisualParticleAnimation(event, gs);
          break;

        case 'RESET_GAME':
          setEventLog([]);
          gs.frostfallBlessings = [];
          gs.knownFrostfallBlessings = [];
          gs.dyingFrostfallBlessings = [];
          gs.frostfallShards = [];
          gs.frostVignette = null;
          gs.deathMeteors = [];
          gs.deathMeteorAnimations = [];
          gs.glacialRemnants = [];
          gs.knownGlacialRemnants = [];
          gs.dyingGlacialRemnants = [];
          gs.blizzardStorms = [];
          gs.glacialFractureAnimations = [];
          gs.aColdFarewellAnimations = [];
          gs.farewellVignette = null;
          Effects.initParticles(gs);
          resetTerritoryCache();
          break;
      }
    });
  };

  // Map incoming visual events to effects.js spawning arrays
  const playVisualParticleAnimation = (anim, gs) => {
    switch (anim.name) {
      case 'VentEffect':
        Effects.spawnVentEffect(anim.r, anim.c, anim.team, gs);
        break;
      case 'FrenziedDash':
        const dashPiece = gs.pieces.find(p => p.id === anim.pieceId);
        Effects.spawnFrenziedDashEffect(dashPiece, anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs);
        break;
      case 'GuardianSave':
        const savedPiece = gs.pieces.find(p => p.id === anim.pieceId);
        Effects.spawnGuardianSaveEffect(savedPiece, gs);
        break;
      case 'SummonWisp':
        const wisp = gs.pieces.find(p => p.id === anim.wispId);
        Effects.spawnSummonWispEffect(anim.r, anim.c, wisp, gs);
        break;
      case 'LavaGlob':
        Effects.spawnLavaGlobEffect(anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs);
        { const casterLG = gs.pieces.find(p => p.id === anim.pieceId); if (casterLG) spawnCastAnimation(casterLG, 'LavaGlob', gs); }
        break;
      case 'PummelKnockback':
        const target = gs.pieces.find(p => p.id === anim.targetPieceId);
        Effects.spawnPummelKnockbackEffect(target, anim.attackerR, anim.attackerC, anim.oldRow, anim.oldCol, anim.newRow, anim.newCol, gs);
        { const casterPK = gs.pieces.find(p => p.row === anim.attackerR && p.col === anim.attackerC); if (casterPK) spawnCastAnimation(casterPK, 'PummelKnockback', gs); }
        break;
      case 'TrapDeployment':
        Effects.spawnTrapDeploymentEffect(anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs);
        { const casterTD = gs.pieces.find(p => p.id === anim.pieceId); if (casterTD) spawnCastAnimation(casterTD, 'TrapDeployment', gs); }
        break;
      case 'FrigidPath':
        Effects.spawnFrigidPathEffect(anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs);
        { const casterFP = gs.pieces.find(p => p.id === anim.pieceId); if (casterFP) spawnCastAnimation(casterFP, 'FrigidPath', gs); }
        break;
      case 'GlacialWall':
        Effects.spawnGlacialWallEffect(anim.r, anim.c, gs);
        { const casterGW = gs.pieces.find(p => p.id === anim.pieceId); if (casterGW) spawnCastAnimation(casterGW, 'GlacialWall', gs); }
        break;
      case 'WallShatter':
        Effects.spawnWallShatterEffect(anim.r, anim.c, gs, anim.wallType === 'obsidianPillar');
        break;
      case 'SiphonParticles':
        const siphoner = gs.pieces.find(p => p.id === anim.pieceId);
        Effects.spawnSiphonParticles(siphoner, anim.source, gs);
        break;
      case 'TrapTrigger':
        const stuckPiece = gs.pieces.find(p => p.id === anim.pieceId);
        Effects.spawnTrapTriggerEffect(anim.r, anim.c, stuckPiece, gs);
        break;
      case 'FrostfallBlessing':
        Effects.spawnFrostfallBlessingEffect(anim.targetR, anim.targetC, gs);
        { const casterFB = gs.pieces.find(p => p.id === anim.pieceId); if (casterFB) spawnCastAnimation(casterFB, 'FrostfallBlessing', gs); }
        break;
      case 'FateLinkCast':
        const src = gs.pieces.find(p => p.id === anim.sourceId);
        const dst = gs.pieces.find(p => p.id === anim.targetId);
        Effects.spawnFateLinkCast(src, dst, gs);
        if (src) spawnCastAnimation(src, 'FateLinkCast', gs);
        break;
      case 'GlacialFracture':
        Effects.spawnGlacialFractureEffect(anim.targetR, anim.targetC, gs);
        { const casterGF = gs.pieces.find(p => p.id === anim.pieceId); if (casterGF) spawnCastAnimation(casterGF, 'GlacialFracture', gs); }
        break;
      case 'AColdFarewell':
        Effects.spawnAColdFarewellEffect(anim.r, anim.c, gs);
        { const casterAC = gs.pieces.find(p => p.id === anim.pieceId); if (casterAC) spawnCastAnimation(casterAC, 'AColdFarewell', gs); }
        break;
      case 'ReignOfFire':
        const tyrant = gs.pieces.find(p => p.id === anim.pieceId);
        if (tyrant) Effects.spawnReignOfFireEffect(tyrant, anim.targetR, anim.targetC, gs);
        if (tyrant) spawnCastAnimation(tyrant, 'ReignOfFire', gs);
        break;
      case 'DeathMeteor':
        const ashTyrant = (gs.pieces || []).find(p => p.id === anim.pieceId) || (gs.pieces || []).find(p => p.key === 'ashAshTyrant');
        if (ashTyrant) Effects.spawnDeathMeteorEffect(ashTyrant, gs, anim.originR, anim.originC, anim.targetR, anim.targetC);
        if (ashTyrant) spawnCastAnimation(ashTyrant, 'DeathMeteor', gs);
        break;
      case 'ShieldBreak':
        if (Effects.spawnShieldBreakEffect) Effects.spawnShieldBreakEffect(anim.r, anim.c, anim.faction, gs);
        break;
      case 'ObsidianPillarCast':
        if (Effects.spawnObsidianPillarCastEffect) Effects.spawnObsidianPillarCastEffect(anim, gs);
        { const casterOP = gs.pieces.find(p => p.id === anim.pieceId); if (casterOP) spawnCastAnimation(casterOP, 'ObsidianPillar', gs); }
        break;
    }
  };

  // Main input action dispatch bridge
  const sendAction = (actionType, data) => {
    if (battleCountdown !== null && battleCountdown > 0) return;
    if (['ABILITY', 'RIFT_PULSE', 'HANDLE_CLICK'].includes(actionType)) {
      triggerHaptic('ability');
    } else if (['SACRIFICE', 'RELEASE', 'ASCENSION_CHOICE'].includes(actionType)) {
      triggerHaptic('medium');
    }
    if (isLocal) {
      processLocalAction(actionType, data);
    } else {
      // Optimistic local update for instantaneous UI feedback
      if (actionType === 'SELECT_PIECE') {
        processLocalAction(actionType, data);
      }
      const playerId = getOrCreatePlayerId();
      dispatchGameAction(roomId, playerId, actionType, {
        ...data,
        timers: gameStateRef.current?.timers
      }).catch(err => {
        console.warn('Action dispatch failed:', err);
      });
    }
  };

  const handleStartReset = () => {
    if (!isLocal) return; // In multiplayer, match start & turns are automated
    if (aiWorkerRef.current) {
      aiWorkerRef.current.terminate();
      aiWorkerRef.current = null;
    }
    setTimers({ snow: 600, ash: 600 });
    setGameState(prev => {
      if (!prev) return null;
      const gs = { ...prev };
      if (!gs.gameStarted) {
        gs.gameStarted = true;
        gs.timers = { snow: 600, ash: 600 };
      } else {
        Logic.initGameState(gs);
        Logic.initGame(gs);
        const nextGs = Logic.getGameState(gs);
        if (nextGs.testMode) {
          const freshFullGame = Logic.initGame({});
          nextGs.originalPieces = JSON.parse(JSON.stringify(freshFullGame.pieces));
        }
        nextGs.images = preloadedImagesRef.current;
        nextGs.boardImgs = {
          gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
          gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
        };
        nextGs.playerTeam = myTeam;
        nextGs.gameStarted = false;
        nextGs.timers = { snow: 600, ash: 600 };
        nextGs.frostfallBlessings = [];
        nextGs.knownFrostfallBlessings = [];
        nextGs.dyingFrostfallBlessings = [];
        nextGs.frostfallShards = [];
        nextGs.frostVignette = null;
        nextGs.deathMeteors = [];
        nextGs.deathMeteorAnimations = [];
        nextGs.glacialRemnants = [];
        nextGs.knownGlacialRemnants = [];
        nextGs.dyingGlacialRemnants = [];
        nextGs.blizzardStorms = [];
        nextGs.glacialFractureAnimations = [];
        nextGs.aColdFarewellAnimations = [];
        nextGs.farewellVignette = null;
        Effects.initParticles(nextGs);
        resetTerritoryCache();
        E.updateBoardMap(nextGs);
        setEventLog([]);
        return cloneState(nextGs);
      }
      return gs;
    });
  };

  // Board clicking routers
  const handleBoardClick = (r, c) => {
    if (battleCountdown !== null && battleCountdown > 0) return;
    const currentGs = gameStateRef.current || gameState;
    const isMyTurn = isLocal || currentGs?.currentTurn === myTeam;
    if (!isMyTurn || currentGs?.gameOver) return;

    if (currentGs?.currentState === 'ABILITY_TARGETING' || currentGs?.currentState === 'WALL_PLACEMENT_FIRST' || currentGs?.currentState === 'TETHER_TARGETING' || currentGs?.currentState === 'WALL_PLACEMENT_SECOND') {
      triggerHaptic('ability');
      sendAction('HANDLE_CLICK', { r, c });
    } else if (currentGs?.selectedPiece) {
      // Check if clicking on or near an allied piece (within body radius 0.65 from unit center)
      const alliedPiece = currentGs.pieces.find(
        p => p.team === currentGs.selectedPiece.team && Math.hypot((p.row + 0.5) - r, (p.col + 0.5) - c) <= 0.65
      );

      if (alliedPiece) {
        if (alliedPiece.id === currentGs.selectedPiece.id) {
          triggerHaptic('light');
          sendAction('SELECT_PIECE', { pieceId: null });
        } else {
          triggerHaptic('select');
          sendAction('SELECT_PIECE', { pieceId: alliedPiece.id });
        }
      } else {
        // Check if destination is within continuous agility radius or matches a legal BFS path tile
        const selCenterR = currentGs.selectedPiece.row + 0.5;
        const selCenterC = currentGs.selectedPiece.col + 0.5;
        const dist = Math.hypot(r - selCenterR, c - selCenterC);
        const maxRadius = E.getPieceMoveRadius ? E.getPieceMoveRadius(currentGs.selectedPiece, currentGs) : (currentGs.selectedPiece.agility || 2);

        const validMoves = E.getValidMoves ? E.getValidMoves(currentGs.selectedPiece, currentGs) : [];
        const matchingLegalCell = validMoves.find(m => {
          const mr = m.row !== undefined ? m.row : m.r;
          const mc = m.col !== undefined ? m.col : m.c;
          return Math.abs(r - (mr + 0.5)) <= 0.55 && Math.abs(c - (mc + 0.5)) <= 0.55;
        });

        if (dist <= maxRadius + 0.15 || matchingLegalCell) {
          // Check if clicking near an enemy piece to trigger capture/combat
          const defender = currentGs.pieces.find(
            p => p.team !== currentGs.selectedPiece.team && Math.hypot((p.row + 0.5) - r, (p.col + 0.5) - c) <= 0.65
          );

          if (defender) {
            const isLegalBfs = validMoves.some(m => Math.hypot((m.row !== undefined ? m.row : m.r) - defender.row, (m.col !== undefined ? m.col : m.c) - defender.col) <= 0.65);
            if (!isLegalBfs) {
              const los = C.hasLineOfSight(currentGs.selectedPiece.row, currentGs.selectedPiece.col, defender.row, defender.col, currentGs, {
                ignoredPieceId: currentGs.selectedPiece.id,
                targetPieceId: defender.id
              });
              if (!los.hasLos) {
                triggerHaptic('error');
                return;
              }
            }
            triggerHaptic('capture');
            sendAction('MOVE', { pieceId: currentGs.selectedPiece.id, r: defender.row, c: defender.col, isHighway: false });
          } else if (matchingLegalCell) {
            // Legal grid-based move (e.g. stepping around allies or along BFS paths)
            const placeRow = matchingLegalCell.row !== undefined ? matchingLegalCell.row : matchingLegalCell.r;
            const placeCol = matchingLegalCell.col !== undefined ? matchingLegalCell.col : matchingLegalCell.c;
            triggerHaptic('move');
            sendAction('MOVE', { pieceId: currentGs.selectedPiece.id, r: placeRow, c: placeCol, isHighway: matchingLegalCell.isHighway || false });
          } else {
            // Freeform continuous ground movement: places piece center EXACTLY where clicked
            const placeCol = Math.max(0, Math.min(9, c - 0.5));
            const placeRow = Math.max(0, Math.min(9, r - 0.5));

            const tooCloseToAlly = currentGs.pieces.some(
              p => p.team === currentGs.selectedPiece.team && p.id !== currentGs.selectedPiece.id && Math.hypot((p.row + 0.5) - r, (p.col + 0.5) - c) < 0.65
            );
            if (!tooCloseToAlly) {
              const los = C.hasLineOfSight(currentGs.selectedPiece.row, currentGs.selectedPiece.col, placeRow, placeCol, currentGs, {
                ignoredPieceId: currentGs.selectedPiece.id
              });
              if (!los.hasLos) {
                triggerHaptic('error');
                return;
              }
              triggerHaptic('move');
              sendAction('MOVE', { pieceId: currentGs.selectedPiece.id, r: Number(placeRow.toFixed(2)), c: Number(placeCol.toFixed(2)), isHighway: false });
            }
          }
        } else {
          triggerHaptic('light');
          sendAction('SELECT_PIECE', { pieceId: null });
        }
      }
    } else {
      // No piece currently selected: allow selecting an allied piece by clicking on or near it
      const activeTeam = isLocal ? currentGs.currentTurn : myTeam;
      const clickedAlly = currentGs.pieces.find(
        p => (currentGs.testMode || p.team === activeTeam) && Math.hypot((p.row + 0.5) - r, (p.col + 0.5) - c) <= 0.65
      );
      if (clickedAlly) {
        triggerHaptic('select');
        sendAction('SELECT_PIECE', { pieceId: clickedAlly.id });
      }
    }
  };

  const handleCellClick = (r, c) => {
    handleBoardClick(r, c);
  };

  const handlePieceClick = (piece) => {
    if (battleCountdown !== null && battleCountdown > 0) return;
    const currentGs = gameStateRef.current || gameState;
    const isMyTurn = isLocal || currentGs?.currentTurn === myTeam;
    if (!isMyTurn || currentGs?.gameOver) return;

    const allowedSelectTeam = isLocal ? currentGs.currentTurn : myTeam;
    const isAllowedPiece = currentGs?.testMode || piece.team === allowedSelectTeam;
    const isTetherTargeting = currentGs?.currentState === 'TETHER_TARGETING' || currentGs?.currentState === 'ABILITY_TARGETING';

    if (isTetherTargeting) {
      triggerHaptic('ability');
      sendAction('HANDLE_CLICK', { r: piece.row, c: piece.col });
    } else if (isAllowedPiece) {
      if (currentGs?.selectedPiece?.id === piece.id) {
        triggerHaptic('light');
        sendAction('SELECT_PIECE', { pieceId: null });
      } else {
        triggerHaptic('select');
        sendAction('SELECT_PIECE', { pieceId: piece.id });
      }
    } else if (currentGs?.selectedPiece) {
      // Initiate attack/lunge checks
      const dist = Math.hypot(piece.row - currentGs.selectedPiece.row, piece.col - currentGs.selectedPiece.col);
      const maxRadius = E.getPieceMoveRadius ? E.getPieceMoveRadius(currentGs.selectedPiece, currentGs) : (currentGs.selectedPiece.agility || 2);

      if (dist <= maxRadius) {
        const validMoves = E.getValidMoves ? E.getValidMoves(currentGs.selectedPiece, currentGs) : [];
        const isLegalBfs = validMoves.some(m => Math.hypot((m.row !== undefined ? m.row : m.r) - piece.row, (m.col !== undefined ? m.col : m.c) - piece.col) <= 0.65);
        if (!isLegalBfs) {
          const los = C.hasLineOfSight(currentGs.selectedPiece.row, currentGs.selectedPiece.col, piece.row, piece.col, currentGs, {
            ignoredPieceId: currentGs.selectedPiece.id,
            targetPieceId: piece.id
          });
          if (!los.hasLos) {
            triggerHaptic('error');
            return;
          }
        }
        triggerHaptic('capture');
        sendAction('MOVE', { pieceId: currentGs.selectedPiece.id, r: piece.row, c: piece.col, isHighway: false });
      }
    }
  };

  const selectedPiece = gameState?.selectedPiece;
  const selectedPieceName = selectedPiece
    ? (selectedPiece.name || C.PIECE_TYPES[selectedPiece.key]?.name || 'Selected Unit')
    : '';
  const hasPrimaryAbility = !!selectedPiece?.ability && selectedPiece.ability.key !== 'Siphon';
  const hasSiphon = selectedPiece?.ability?.key === 'Siphon';
  const hasRiftPulse = !!selectedPiece?.canRiftPulse && !selectedPiece?.hasUsedRiftPulse;
  const canDespawn = !!selectedPiece && ['snowIceWisp', 'glacialWall'].includes(selectedPiece.key);

  // Main UI returns
  if (!imagesLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-void-black text-on-surface">
        <div className="w-10 h-10 border-4 border-t-ember-gold border-outline/20 rounded-full animate-spin mb-4" />
        <p className="font-label-caps text-xs tracking-widest text-on-surface-variant font-bold">PREPARING THE BATTLEFIELD...</p>
      </div>
    );
  }

  const isMyTurn = isLocal || gameState?.currentTurn === myTeam;
  const turnLabel = gameState?.gameOver
    ? 'GAME OVER'
    : `TURN ${gameState?.turnCount || 1}: ${gameState?.currentTurn === 'ash' ? 'ASH' : 'FROST'}`;

  return (
    <div ref={pageRef} className="game-screen text-on-surface select-none font-body-md overflow-hidden w-full h-screen h-[100dvh] max-h-screen max-h-[100dvh] flex flex-col items-center justify-start relative">

      {/* Atmospheric Battlefield Page Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0">
        <img
          src="/images/menu-bg.webp"
          alt="Battlefield Arena"
          className="w-full h-full object-cover object-center pointer-events-none select-none opacity-45"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-void-black/80" />
        <div className="absolute inset-0 bg-void-black/45" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_0%_50%,rgba(56,189,248,0.22),transparent_70%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_50%,rgba(239,68,68,0.22),transparent_70%)]" />
      </div>

      {/* 5-Second Global Battle Countdown Overlay */}
      {battleCountdown !== null && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-void-black/80 backdrop-blur-md pointer-events-auto transition-opacity duration-300">
          <div className="flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl glass-obsidian border border-ember-gold/40 shadow-[0_0_60px_rgba(245,158,11,0.35)] max-w-sm sm:max-w-md w-full mx-4">
            <span className="font-label-caps text-xs sm:text-sm tracking-[0.3em] text-ember-gold/80 uppercase mb-2">
              ⚔️ Both Commanders Connected ⚔️
            </span>
            <h2 className="almendra-font text-2xl sm:text-3xl font-bold tracking-widest text-pure-snow uppercase mb-4">
              {battleCountdown > 0 ? 'Battle Commences In' : 'Battle Commences!'}
            </h2>

            <div className="relative flex items-center justify-center my-3">
              {battleCountdown > 0 ? (
                <div key={battleCountdown} className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-ember-gold/60 bg-ember-gold/15 flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.5)] animate-pulse">
                  <span className="rye-font text-5xl sm:text-6xl font-black text-ember-gold drop-shadow-[0_2px_12px_rgba(245,158,11,0.8)]">
                    {battleCountdown}
                  </span>
                </div>
              ) : (
                <div className="px-6 py-3 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 font-label-caps tracking-widest text-base sm:text-xl font-bold shadow-[0_0_30px_rgba(52,211,153,0.5)] animate-bounce">
                  ❄️ FROST COMMANDS FIRST!
                </div>
              )}
            </div>

            <p className="text-on-surface-variant font-label-caps text-[11px] sm:text-xs tracking-wider mt-4">
              {battleCountdown > 0 ? 'Synchronizing elemental battlefield...' : 'The war for dominion begins!'}
            </p>
          </div>
        </div>
      )}

      {/* Disconnect Overlay */}
      {isOpponentDisconnected && (
        <div id="disconnectModal" className="fixed inset-0 z-[10000] flex items-center justify-center bg-void-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-obsidian border border-magma-core/30 p-8 rounded-2xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <WifiOff className="mx-auto mb-4 h-12 w-12 text-magma-core" aria-hidden="true" />
            <div id="disconnectMessage" className="font-display-lg text-lg text-pure-snow tracking-widest mb-6 uppercase">
              Opponent disconnected. Closing in {disconnectTimeout}s
            </div>
            <button id="mainMenuBtn" className="action-btn w-full py-3 bg-magma-core/20 border border-magma-core/50 hover:bg-magma-core/40 transition-all text-pure-snow font-label-caps tracking-widest rounded-lg" onClick={handleExitToLobby}>
              Go to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Ascension Modal */}
      {gameState?.pendingAscension && (
        <AscensionModal gameState={gameState} sendAction={sendAction} />
      )}

      {/* Floating Flash Toast Notification */}
      {flashMessage && (
        <div id="flashMessage" className="floating-flash-toast-container" role="status" aria-live="polite">
          <div className={`floating-flash-toast ${
            flashMessage.type === 'snow' ? 'snow' : 
            flashMessage.type === 'ash' ? 'ash' : 
            flashMessage.type === 'error' ? 'error' : 'neutral'
          }`}>
            <AlertCircle className="flash-toast-icon" aria-hidden="true" />
            <span className="flash-toast-text">{flashMessage.msg}</span>
            <button 
              type="button"
              className="flash-toast-close"
              aria-label="Dismiss alert"
              onClick={() => setFlashMessage(null)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Ability / Tether Targeting Prompt Action Banner */}
      {(() => {
        const isTargeting = gameState?.currentState === 'ABILITY_TARGETING' ||
          gameState?.currentState === 'WALL_PLACEMENT_FIRST' ||
          gameState?.currentState === 'WALL_PLACEMENT_SECOND' ||
          gameState?.currentState === 'TETHER_TARGETING';

        if (!isTargeting || !isMyTurn) return null;

        const currentAbilityKey = gameState?.abilityContext?.abilityKey || selectedPiece?.ability?.key;
        const abilityDef = C.ABILITIES[currentAbilityKey] || {};
        const abilityDisplayName = abilityDef.name || selectedPiece?.ability?.name || 'Target Ability';

        let promptText = 'Select a valid target on the battlefield.';
        if (gameState?.currentState === 'WALL_PLACEMENT_FIRST') {
          promptText = 'Select location for the first glacial wall.';
        } else if (gameState?.currentState === 'WALL_PLACEMENT_SECOND') {
          promptText = 'Select location for the second glacial wall.';
        } else if (gameState?.currentState === 'TETHER_TARGETING') {
          const mode = gameState?.abilityContext?.mode;
          if (mode === 'resonance') {
            promptText = gameState?.abilityContext?.allyTarget ? 'Select an enemy target for Resonance.' : 'Select a friendly target for Resonance.';
          } else if (mode === 'benevolent' || mode === 'parasitic') {
            promptText = 'Select a friendly target.';
          } else {
            promptText = 'Select an enemy target.';
          }
        } else if (currentAbilityKey === 'FateLink') {
          promptText = gameState?.abilityContext?.step === 2 ? 'Select an enemy target for Fate Link.' : 'Select a friendly target for Fate Link.';
        } else if (currentAbilityKey === 'ObsidianPillar') {
          promptText = 'Target empty tile for Pillar, ally for Shield, or enemy to strike.';
        }

        const bannerTeam = selectedPiece?.team || gameState?.currentTurn || 'neutral';

        return (
          <div className="targeting-banner-wrapper" role="region" aria-label="Ability targeting active">
            <div className={`targeting-banner ${bannerTeam}`}>
              <div className="targeting-banner-left">
                <div className="targeting-pulse-ring">
                  <Crosshair className="targeting-icon" aria-hidden="true" />
                </div>
                <div className="targeting-info">
                  <span className="targeting-ability-title">{abilityDisplayName}</span>
                  <span className="targeting-prompt-subtitle">{promptText}</span>
                </div>
              </div>
              <button
                type="button"
                className="targeting-cancel-btn"
                onClick={() => {
                  triggerHaptic('light');
                  sendAction('SELECT_PIECE', { pieceId: null });
                }}
                title="Cancel ability targeting"
              >
                <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Game Over Modal — Full-Screen Victory Presentation with Animated Heraldic Banners */}
      {showGameOverModal && gameState?.gameOver && (() => {
        const isWinnerSnow = gameState.winner === 'snow';
        const voronoi = gameState?.voronoiData || computePowerDiagram(gameState?.pieces || []);
        const winnerShare = isWinnerSnow ? voronoi.frostShare : voronoi.ashShare;

        return (
          <VictoryScreen
            team={isWinnerSnow ? 'frost' : 'ash'}
            isLocal={isLocal}
            myTeam={myTeam}
            modalVisible={modalVisible}
            winnerShare={winnerShare}
            onPlayAgain={handleStartReset}
            onMainMenu={handleExitToLobby}
          />
        );
      })()}

      <div
        className="arena-scale-container"
        style={isCompactLayout ? { width: '100%' } : {
          width: `${1536 * arenaScale}px`,
          height: `${981 * arenaScale}px`,
          margin: '0 auto',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          id="game-wrapper"
          className="relative z-10"
          style={isCompactLayout ? {} : {
            transform: `scale(${arenaScale})`,
            transformOrigin: 'top left',
            width: '1536px',
            height: '981px',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <div id="mobileHeader" className="mobile-only-header">
            <div className="mobile-header-left">
              <button id="menuButton-mobile" className="top-menu-btn icon-btn" aria-label="Return to main menu" onClick={handleExitToLobby}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Menu</span>
              </button>
            </div>

            <div className="mobile-header-center">
              <div className="mobile-timer-stack" title="Remaining match timers">
                <div className={`mobile-timer-card snow-card ${gameState?.currentTurn === 'snow' ? 'active' : ''}`}>
                  <span className="mobile-timer-name">Frost</span>
                  <span id="miniTimerSnow" className="mobile-timer-val">{formatTime(timers?.snow ?? gameState?.timers?.snow)}</span>
                </div>
                <span className="mobile-timer-vs">VS</span>
                <div className={`mobile-timer-card ash-card ${gameState?.currentTurn === 'ash' ? 'active' : ''}`}>
                  <span className="mobile-timer-name">Ash</span>
                  <span id="miniTimerAsh" className="mobile-timer-val">{formatTime(timers?.ash ?? gameState?.timers?.ash)}</span>
                </div>
              </div>
            </div>

            <div className="mobile-header-right header-action-group">
              {isLocal && (
                <button id="startResetBtn-mobile" className="menu-btn start-btn-mobile" onClick={handleStartReset}>
                  {gameState?.gameStarted ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{gameState?.gameStarted ? 'Reset' : 'Start'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="main-layout">
            <div id="left-column" className="ui-column primal-snow">
              <div className="battle-controls-heading">
                <div className="battle-controls-title">
                  <Swords className="h-4 w-4 text-ice-light" aria-hidden="true" />
                  <span>Battle Controls</span>
                </div>
              </div>

              <button id="menuButton" className="top-menu-btn" onClick={handleExitToLobby}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Main menu</span>
              </button>

              {isLocal && (
                <button id="startResetBtn" className="top-menu-btn" onClick={handleStartReset}>
                  {gameState?.gameStarted ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  <span>{gameState?.gameStarted ? 'Reset battle' : 'Start battle'}</span>
                </button>
              )}

              <div className="timer-stack">
                <div className={`timer-card snow-card ${gameState?.currentTurn === 'snow' ? 'active' : ''}`}>
                  <span className="timer-faction-name">Frost</span>
                  <div id="snowTimer" className="timer-display">{formatTime(timers?.snow ?? gameState?.timers?.snow)}</div>
                </div>
                <div className={`timer-card ash-card ${gameState?.currentTurn === 'ash' ? 'active' : ''}`}>
                  <span className="timer-faction-name">Ash</span>
                  <div id="ashTimer" className="timer-display">{formatTime(timers?.ash ?? gameState?.timers?.ash)}</div>
                </div>
              </div>

              <div id="ability-info-panel" className="ability-panel">
                <div className="selected-unit-heading">
                  <span className="panel-kicker">Selected unit</span>
                  <div className="unit-name-container">
                    {selectedPiece ? (
                      <h3 key={selectedPiece.id} id="ability-name" className="unit-name-active">{selectedPieceName}</h3>
                    ) : (
                      <span key="no-unit" className="no-unit-text">No unit selected</span>
                    )}
                  </div>
                </div>

                <div className={`ability-actions-wrapper ${selectedPiece && (hasPrimaryAbility || hasSiphon || (selectedPiece.tethers && selectedPiece.tethers.length > 0) || hasRiftPulse || canDespawn) ? 'open' : ''}`}>
                  <div className="ability-actions-inner">
                    {hasPrimaryAbility && (
                      <button
                        id="abilityBtn"
                        className={!isMyTurn || (selectedPiece.ability.cooldown || 0) > 0 ? 'disabled' : ''}
                        onClick={() => isMyTurn && (selectedPiece.ability.cooldown || 0) <= 0 && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: selectedPiece.ability.key })}
                        onMouseEnter={() => setHoveredAbilityKey(selectedPiece.ability.key)}
                        onMouseLeave={() => setHoveredAbilityKey(null)}
                        disabled={!isMyTurn || (selectedPiece.ability.cooldown || 0) > 0}
                      >
                        {selectedPiece.ability.name || 'Use Ability'}
                        {(selectedPiece.ability.cooldown || 0) > 0 ? ` (CD: ${selectedPiece.ability.cooldown})` : ''}
                      </button>
                    )}
                    {hasSiphon && (
                      <button
                        id="siphonBtn"
                        className={!isMyTurn ? 'disabled' : ''}
                        onClick={() => isMyTurn && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: 'Siphon' })}
                        disabled={!isMyTurn}
                      >
                        Siphon
                      </button>
                    )}
                    <button
                      id="releaseBtn"
                      className="unleash-btn"
                      style={{ display: (selectedPiece?.tethers && selectedPiece.tethers.length > 0) ? 'block' : 'none' }}
                      onClick={() => sendAction('RELEASE', { pieceId: selectedPiece.id })}
                    >
                      Release
                    </button>
                    {hasRiftPulse && (
                      <button
                        id="riftPulseBtn"
                        className={!isMyTurn ? 'disabled' : ''}
                        onClick={() => isMyTurn && sendAction('RIFT_PULSE', { pieceId: selectedPiece.id })}
                        disabled={!isMyTurn}
                      >
                        Rift Pulse
                      </button>
                    )}
                    {canDespawn && (
                      <button
                        id="despawnBtn"
                        className={!isMyTurn ? 'disabled' : ''}
                        onClick={() => isMyTurn && sendAction('DESPAWN', { pieceId: selectedPiece.id })}
                        disabled={!isMyTurn}
                      >
                        Despawn
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div id="fallenUnitsPanel" className="fallen-units-panel">
                <div className="fallen-units-header">
                  <div className="fallen-units-title">
                    <Skull className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Fallen Units</span>
                  </div>
                  <div className="fallen-units-counts">
                    <span className="frost-count">❄ {fallenSnow.length}</span>
                    <span className="ash-count">🔥 {fallenAsh.length}</span>
                  </div>
                </div>

                <div className="fallen-units-columns">
                  {/* Frost Casualties */}
                  <div className="fallen-column snow-column">
                    <div className="fallen-column-label">Frost ({10 - fallenSnow.length}/10)</div>
                    <div className="fallen-list">
                      {fallenSnow.length === 0 ? (
                        <div className="fallen-empty-card">
                          <span className="empty-sub">Vanguard Intact</span>
                          <span className="empty-count">10 Active</span>
                        </div>
                      ) : (
                        fallenSnow.map(key => {
                          const info = C.PIECE_TYPES[key] || {};
                          const imgPath = C.IMAGES[key] ? `/${C.IMAGES[key]}` : null;
                          return (
                            <div key={key} className="fallen-unit-card snow" title={info.name || key}>
                              {imgPath && <img src={imgPath} alt={info.name || key} className="fallen-unit-avatar" />}
                              <span className="fallen-unit-name">{info.name || key}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Ash Casualties */}
                  <div className="fallen-column ash-column">
                    <div className="fallen-column-label">Ash ({10 - fallenAsh.length}/10)</div>
                    <div className="fallen-list">
                      {fallenAsh.length === 0 ? (
                        <div className="fallen-empty-card">
                          <span className="empty-sub">Vanguard Intact</span>
                          <span className="empty-count">10 Active</span>
                        </div>
                      ) : (
                        fallenAsh.map(key => {
                          const info = C.PIECE_TYPES[key] || {};
                          const imgPath = C.IMAGES[key] ? `/${C.IMAGES[key]}` : null;
                          return (
                            <div key={key} className="fallen-unit-card ash" title={info.name || key}>
                              {imgPath && <img src={imgPath} alt={info.name || key} className="fallen-unit-avatar" />}
                              <span className="fallen-unit-name">{info.name || key}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isLocal && (
                <div id="testModeContainer" className="test-mode-control mt-auto">
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  <input
                    type="checkbox"
                    id="testModeToggle"
                    checked={!!gameState?.testMode}
                    onChange={(e) => sendAction('TOGGLE_TEST_MODE', { enabled: e.target.checked })}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                  />
                  <label htmlFor="testModeToggle">Test mode</label>
                </div>
              )}
            </div>

            <div className="game-container">
              <Board
                gameState={gameState}
                myTeam={myTeam}
                hoveredAbilityKey={hoveredAbilityKey}
                onCellClick={handleCellClick}
                onBoardClick={handleBoardClick}
                onPieceClick={handlePieceClick}
                onMouseEnterPiece={handleMouseEnterPiece}
                onMouseMovePiece={handleMouseMovePiece}
                onMouseLeavePiece={handleMouseLeavePiece}
              />
              <div className="labels-bar">
                <div id="snowLabel" className="label snow">
                  <span>Frost Control</span>
                  <strong>{terrScores.snow.toFixed(1)}%</strong>
                </div>

                <div id="turnLabel" className={`label turn ${gameState?.currentTurn || 'snow'}`}>
                  <div className="turn-content">
                    <div className="turn-main">
                      <Clock3 className="turn-clock-icon" aria-hidden="true" />
                      <span>{turnLabel}</span>
                    </div>
                    {terrScores.neutral !== undefined && terrScores.neutral > 0 && (
                      <span className="uncontested-label">
                        Uncontested: {terrScores.neutral.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div id="ashLabel" className="label ash">
                  <span>Ash Control</span>
                  <strong>{terrScores.ash.toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            <GameActionDrawer
              eventLog={eventLog}
              isLocal={isLocal}
              playerCount={playerCount}
              isOpponentDisconnected={isOpponentDisconnected}
              disconnectTimeout={disconnectTimeout}
              drawerExpanded={drawerExpanded}
              setDrawerExpanded={setDrawerExpanded}
              selectedPiece={selectedPiece}
              selectedPieceName={selectedPieceName}
              hasPrimaryAbility={hasPrimaryAbility}
              hasSiphon={hasSiphon}
              hasRiftPulse={hasRiftPulse}
              canDespawn={canDespawn}
              isMyTurn={isMyTurn}
              sendAction={sendAction}
              setHoveredAbilityKey={setHoveredAbilityKey}
              fallenSnow={fallenSnow}
              fallenAsh={fallenAsh}
            />
          </div>
        </div>
      </div>

      <PieceTooltip hoveredPiece={hoveredPiece} gameState={gameState} initialMousePos={hoveredMousePos} />
    </div>
  );
}
