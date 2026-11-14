import React, { useState, useEffect, useRef } from 'react';
import '../../styles/game.css';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  FlaskConical,
  Play,
  RotateCcw,
  ScrollText,
  Shield,
  Skull,
  Swords,
  Users,
  WifiOff,
} from 'lucide-react';
import Board from './Board.jsx';
import AscensionModal from './AscensionModal.jsx';
import * as Logic from '../../../shared/logic.js';
import * as C from '../../../shared/constants.js';
import * as E from '../../../shared/utils.js';
import * as Effects from '../../js/effects.js';
import {
  subscribeToRoom,
  dispatchGameAction,
  leaveRoom,
  disbandRoom,
  updatePlayerHeartbeat,
  getOrCreatePlayerId
} from '../services/multiplayer.js';

const INITIAL_SNOW_KEYS = [
  'snowFrostLord',
  'snowSoulLinker',
  'snowRampagingYeti',
  'snowIceWeaver',
  'snowGlacialMage',
  'snowSoulFreeze',
  'snowArcticTrapper',
  'snowGlacialBrute',
  'snowFrostbiteStalker',
  'snowHoarfrostMystic'
];

const INITIAL_ASH_KEYS = [
  'ashAshTyrant',
  'ashAshReaper',
  'ashBlazeboundBeast',
  'ashRiftForger',
  'ashMagmaSpitter',
  'ashScorchPriest',
  'ashAshStrider',
  'ashMagmaProwler',
  'ashCinderScout',
  'ashMagmaShaper'
];

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(window.innerWidth <= 1180);
  const [arenaScale, setArenaScale] = useState(1);
  const [battleCountdown, setBattleCountdown] = useState(null);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
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
        const availableH = window.innerHeight - 20;
        const availableW = window.innerWidth - 20;
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
      pieces: gs.pieces ? gs.pieces.map(p => ({ ...p })) : [],
      snowTerritory: gs.snowTerritory ? Array.from(gs.snowTerritory) : [],
      ashTerritory: gs.ashTerritory ? Array.from(gs.ashTerritory) : []
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
      Logic.initGameState({});
      Logic.initGame();
      const gs = Logic.getGameState();
      
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
        updatePlayerHeartbeat(roomId, playerId);
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
            startCountdown();
          }
        } else {
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
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    timerIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev || prev.gameOver || !prev.gameStarted) return prev;
        
        // Hold turn timers during pre-battle countdown
        if (prev.battleStartTime && Date.now() < prev.battleStartTime) return prev;

        const turn = prev.currentTurn || 'snow';
        const updated = { ...prev };
        if (!updated.timers) updated.timers = { snow: 600, ash: 600 };
        
        if (updated.timers[turn] > 0) {
          updated.timers[turn] -= 1;
        } else {
          // Timeout trigger
          if (isLocal) {
            Logic.initGameState(updated);
            Logic.endGame(turn === 'snow' ? 'ash' : 'snow');
            const newGs = Logic.getGameState();
            newGs.images = preloadedImagesRef.current;
            newGs.boardImgs = {
              gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
              gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
            };
            return cloneState(newGs);
          } else {
            dispatchGameAction(roomId, getOrCreatePlayerId(), 'TIMEOUT', { team: turn }).catch(console.warn);
          }
        }
        return updated;
      });
    }, 1000);
  };

  useEffect(() => {
    if (gameState?.gameStarted && !gameState?.gameOver) {
      startCountdown();
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [gameState?.gameStarted, gameState?.gameOver]);

  const handleExitToLobby = () => {
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
    navigateTo('LOBBY');
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

  // Web Worker AI player decision execution
  const checkAITurn = () => {
    if (!isLocal || !vsAI || !gameState || gameState.gameOver) return;
    
    const aiTeam = myTeam === 'snow' ? 'ash' : 'snow';
    if (gameState.currentTurn !== aiTeam) return;

    if (aiWorkerRef.current) aiWorkerRef.current.terminate();
    
    const worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
    aiWorkerRef.current = worker;

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
      worker.terminate();
      aiWorkerRef.current = null;
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
      
      const nextState = { ...prev };
      nextState.events = [];
      
      // Load standard Logic engine with current state
      Logic.initGameState(nextState);
      
      // 1. Process damage animations & lunges
      let turnEnded = false;
      const find = (id) => nextState.pieces.find(x => x.id === id);

      switch (actionType) {
        case 'SELECT_PIECE':
          const p = find(data.pieceId);
          if (p) Logic.selectPiece(p); else Logic.deselectPiece();
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
            turnEnded = Logic.movePiece(mp, data.r, data.c, data.isHighway);
          }
          break;

        case 'ABILITY':
          const cp = find(data.pieceId);
          if (cp) {
            if (data.target) {
              cp.isAnimating = true; // Trigger cast pulse lunge
              turnEnded = Logic.executeAbility(cp, data.target, data.abilityKey, nextState);
            } else {
              turnEnded = Logic.activateAbility(cp, data.abilityKey || data.unleashCostOrKey || 0);
            }
          }
          break;

        case 'HANDLE_CLICK':
          turnEnded = Logic.handleAbilityClick(data.r, data.c);
          break;

        case 'SWITCH_TURN':
          turnEnded = true;
          break;

        case 'ASCENSION_CHOICE':
          turnEnded = Logic.executeAscensionChoice(data.choice);
          break;

        case 'CANCEL_ASCENSION':
          Logic.cancelAscensionChoice();
          break;

        case 'SACRIFICE':
          turnEnded = Logic.executeSacrifice(find(data.pieceId));
          break;

        case 'RELEASE':
          turnEnded = Logic.executeRelease(find(data.pieceId));
          break;

        case 'RIFT_PULSE':
          const rp = find(data.pieceId);
          if (rp) rp.isAnimating = true;
          turnEnded = Logic.executeRiftPulse(rp);
          break;

        case 'DESPAWN':
          Logic.despawnPiece(find(data.pieceId));
          turnEnded = true;
          break;

        case 'TIMEOUT':
          Logic.endGame(data.team === 'snow' ? 'ash' : 'snow');
          break;

        case 'TOGGLE_TEST_MODE':
          nextState.testMode = data.enabled;
          if (nextState.testMode) {
            if (!nextState.originalPieces) {
              nextState.originalPieces = JSON.parse(JSON.stringify(nextState.pieces));
            }
            nextState.pieces = nextState.pieces.filter(x => x.key === 'snowFrostLord' || x.key === 'ashAshTyrant' || x.key === 'ashMagmaShaper');
          } else {
            if (nextState.originalPieces) {
              nextState.pieces = JSON.parse(JSON.stringify(nextState.originalPieces));
              delete nextState.originalPieces;
            }
          }
          break;
      }

      E.updateBoardMap(nextState);

      if (turnEnded) {
        const ascensionTriggered = Logic.checkAscensionReady();
        if (!ascensionTriggered) {
          Logic.switchTurn();
        }
      }

      // Sync and retrieve updated state from logic engine
      const finalState = Logic.getGameState();
      
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
          Effects.initParticles(gs);
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
        break;
      case 'PummelKnockback':
        const target = gs.pieces.find(p => p.id === anim.targetPieceId);
        Effects.spawnPummelKnockbackEffect(target, anim.attackerR, anim.attackerC, anim.oldRow, anim.oldCol, anim.newRow, anim.newCol, gs);
        break;
      case 'TrapDeployment': 
        Effects.spawnTrapDeploymentEffect(anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs); 
        break;
      case 'FrigidPath': 
        Effects.spawnFrigidPathEffect(anim.oldRow, anim.oldCol, anim.targetR, anim.targetC, gs); 
        break;
      case 'GlacialWall': 
        Effects.spawnGlacialWallEffect(anim.r, anim.c, gs); 
        break;
      case 'WallShatter': 
        Effects.spawnWallShatterEffect(anim.r, anim.c, gs); 
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
        break;
      case 'FateLinkCast':
        const src = gs.pieces.find(p => p.id === anim.sourceId);
        const dst = gs.pieces.find(p => p.id === anim.targetId);
        Effects.spawnFateLinkCast(src, dst, gs);
        break;
      case 'GlacialFracture':
        Effects.spawnGlacialFractureEffect(anim.targetR, anim.targetC, gs);
        break;
      case 'AColdFarewell':
        Effects.spawnAColdFarewellEffect(anim.r, anim.c, gs);
        break;
      case 'ReignOfFire':
        const tyrant = gs.pieces.find(p => p.id === anim.pieceId);
        if (tyrant) Effects.spawnReignOfFireEffect(tyrant, anim.targetR, anim.targetC, gs);
        break;
    }
  };

  // Main input action dispatch bridge
  const sendAction = (actionType, data) => {
    if (battleCountdown !== null && battleCountdown > 0) return;
    if (isLocal) {
      processLocalAction(actionType, data);
    } else {
      // Optimistic local update for instantaneous UI feedback
      if (['SELECT_PIECE', 'TOGGLE_TEST_MODE'].includes(actionType)) {
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
    setGameState(prev => {
      if (!prev) return null;
      const gs = { ...prev };
      if (!gs.gameStarted) {
        gs.gameStarted = true;
        gs.timers = { snow: 600, ash: 600 };
      } else {
        Logic.initGameState(gs);
        Logic.initGame();
        const nextGs = Logic.getGameState();
        nextGs.images = preloadedImagesRef.current;
        nextGs.boardImgs = {
          gameBackgroundSnow: preloadedImagesRef.current.gameBackgroundSnow,
          gameBackgroundAsh: preloadedImagesRef.current.gameBackgroundAsh
        };
        nextGs.playerTeam = myTeam;
        nextGs.gameStarted = false;
        nextGs.timers = { snow: 600, ash: 600 };
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
    const isMyTurn = isLocal || gameState?.currentTurn === myTeam;
    if (!isMyTurn || gameState?.gameOver) return;

    if (gameState?.currentState === 'ABILITY_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_FIRST' || gameState?.currentState === 'TETHER_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_SECOND') {
      sendAction('HANDLE_CLICK', { r, c });
    } else if (gameState?.selectedPiece) {
      // Check if clicking on another piece
      const clickedPiece = gameState.pieces.find(p => p.row === r && p.col === c);
      const isAlly = clickedPiece && clickedPiece.team === gameState.selectedPiece.team;
      
      if (isAlly && clickedPiece.id !== gameState.selectedPiece.id) {
        sendAction('SELECT_PIECE', { pieceId: clickedPiece.id });
      } else {
        // Distance check
        const dist = Math.hypot(r - gameState.selectedPiece.row, c - gameState.selectedPiece.col);
        const maxRadius = E.getPieceMoveRadius ? E.getPieceMoveRadius(gameState.selectedPiece, gameState) : (gameState.selectedPiece.agility || 2);
        
        if (dist <= maxRadius) {
          sendAction('MOVE', { pieceId: gameState.selectedPiece.id, r, c, isHighway: false });
        } else {
          sendAction('SELECT_PIECE', { pieceId: null });
        }
      }
    }
  };

  const handleCellClick = (r, c) => {
    handleBoardClick(r, c);
  };

  const handlePieceClick = (piece) => {
    if (battleCountdown !== null && battleCountdown > 0) return;
    const isMyTurn = isLocal || gameState?.currentTurn === myTeam;
    if (!isMyTurn || gameState?.gameOver) return;

    const allowedSelectTeam = isLocal ? gameState.currentTurn : myTeam;
    const isTetherTargeting = gameState?.currentState === 'TETHER_TARGETING' || gameState?.currentState === 'ABILITY_TARGETING';

    if (isTetherTargeting) {
      sendAction('HANDLE_CLICK', { r: piece.row, c: piece.col });
    } else if (piece.team === allowedSelectTeam) {
      sendAction('SELECT_PIECE', { pieceId: piece.id });
    } else if (gameState?.selectedPiece) {
      // Initiate attack/lunge checks
      const dist = Math.hypot(piece.row - gameState.selectedPiece.row, piece.col - gameState.selectedPiece.col);
      const maxRadius = E.getPieceMoveRadius ? E.getPieceMoveRadius(gameState.selectedPiece, gameState) : (gameState.selectedPiece.agility || 2);
      
      if (dist <= maxRadius) {
        sendAction('MOVE', { pieceId: gameState.selectedPiece.id, r: piece.row, c: piece.col, isHighway: false });
      }
    }
  };

  const generatePieceInfoHtml = (piece) => {
    if (!piece) return '';
    const typeInfo = C.PIECE_TYPES[piece.key] || {};
    const effectivePower = E.getEffectivePower(piece, gameState, null, null);
    let info = `<b>${typeInfo.name || 'Unit'}</b> (${piece.team?.charAt(0).toUpperCase() + piece.team?.slice(1)})<br>`;
    const hp = typeof piece.currentHp === 'number' ? piece.currentHp : (piece.maxHp || effectivePower);
    const maxHp = piece.maxHp || hp;
    const hpPct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 100;
    const hpColor = hpPct > 60 ? '#44dd88' : hpPct > 30 ? '#ffcc44' : '#ff4444';
    info += `<div style="margin:3px 0 4px;">`;
    info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>HP</span><span style="color:${hpColor}">${hp}/${maxHp}</span></div>`;
    info += `<div style="height:5px;background:rgba(255,255,255,0.12);border-radius:3px;"><div style="width:${hpPct}%;height:100%;background:${hpColor};border-radius:3px;transition:width 0.3s;"></div></div>`;
    info += `</div>`;
    if (!piece.isVeteran && maxHp > 0) {
      const dmgDealt = piece.damageDealt || 0;
      const vetPct = Math.min(100, Math.round((dmgDealt / maxHp) * 100));
      info += `<div style="margin:3px 0 4px;">`;
      info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#aaccff"><span>Veteran Progress</span><span>${dmgDealt}/${maxHp}</span></div>`;
      info += `<div style="height:4px;background:rgba(255,255,255,0.12);border-radius:2px;"><div style="width:${vetPct}%;height:100%;background:#00aaff;border-radius:2px;transition:width 0.3s;box-shadow:0 0 4px #00aaff;"></div></div>`;
      info += `</div>`;
    } else if (piece.isVeteran) {
      info += `<div style="font-size:11px;color:#00aaff;font-weight:bold;text-shadow:0 0 4px #00aaff;margin-bottom:4px;">★ VETERAN</div>`;
    }
    const s = piece.stats || C.PIECE_TYPES[piece.key]?.stats;
    if (s || typeof piece.strength === 'number') {
      const str = Math.round(piece.strength ?? s?.str ?? piece.power ?? 0);
      const def = Math.round(piece.def ?? s?.def ?? 0);
      const rng = Number((piece.range ?? s?.rng ?? 1).toFixed(1));
      const agi = Number((piece.agility ?? s?.agi ?? 2).toFixed(1));
      info += `<div style="font-size:11px;color:#aac;margin-bottom:4px;display:flex;gap:6px;flex-wrap:wrap;">`;
      info += `<span title="Strength">⚔${str}</span>`;
      info += `<span title="Defense">🛡${def}</span>`;
      info += `<span title="Range">🎯${rng}</span>`;
      info += `<span title="Agility">💨${agi}</span>`;
      info += `</div>`;
    } else {
      info += `Power: ${effectivePower} (Base: ${typeInfo.power || 0})<br>`;
    }
    const boosts = [];
    if (piece.shrineBoost > 0) boosts.push(`Shrine (+${piece.shrineBoost})`);
    if (piece.anchorBoost > 0) boosts.push(`Anchor (+${piece.anchorBoost})`);
    if (piece.overloadBoost?.duration > 0) boosts.push(`Infusion (+${piece.overloadBoost.amount}, ${piece.overloadBoost.duration} turns)`);
    (gameState?.temporaryBoosts || []).filter(b => b.pieceId === piece.id).forEach(boost => {
      const boostName = C.ABILITIES[boost.name]?.name || boost.name;
      boosts.push(`${boostName} (+${boost.amount}, ${boost.duration} turns)`);
    });
    if (boosts.length > 0) info += `<span class="buff-text" style="color:#44ffaa;font-size:11px;">${boosts.join('<br>')}</span><br>`;
    const debuffs = [];
    if ((gameState?.markedPieces || []).some(m => m.targetId === piece.id)) debuffs.push(`Marked (-${C.ABILITY_VALUES.MarkOfCinder.powerDebuff})`);
    (gameState?.debuffs || []).filter(d => d.pieceId === piece.id).forEach(debuff => {
      if (debuff.amount < 0) debuffs.push(`${C.ABILITIES[debuff.name]?.name || debuff.name} (${debuff.amount}, ${debuff.duration} turns)`);
    });
    if (debuffs.length > 0) info += `<span class="debuff-text" style="color:#ff5555;font-size:11px;">${debuffs.join('<br>')}</span><br>`;
    const statuses = [];
    if (piece.stuck > 0) statuses.push(`Stuck (${piece.stuck} turns)`);
    if (piece.isDazed) statuses.push('Dazed');
    if (piece.hasDefensiveWard) statuses.push('Ward (Immune)');
    if (piece.canRiftPulse) statuses.push('Rift Pulse Ready');
    if (piece.isTrapped) statuses.push('Trapped by Shrine');
    const activeShield = (gameState?.shields || []).find(s => s.pieceId === piece.id);
    if (activeShield) {
      if (activeShield.name === 'ObsidianPillarShield') {
        statuses.push(`Obsidian Shield (${activeShield.duration} turns)`);
      } else {
        statuses.push(`Frost Shield (${activeShield.duration} turns)`);
      }
    }
    if (statuses.length > 0) info += `<span style="color:#ffff55;font-size:11px;">Status: ${statuses.join(', ')}</span><br>`;
    
    if (piece.ability?.key && piece.ability.key !== 'Siphon') {
      const cdText = (piece.ability.cooldown || 0) > 0 ? `CD: ${piece.ability.cooldown}` : 'Ready';
      info += `<div style="margin-top:5px;font-size:11px;line-height:1.3;"><span style="color:#88ccff">Active:</span> <span style="color:#ffcc00">${piece.ability.name}</span> (${cdText})`;
      const desc = C.ABILITY_DESCRIPTIONS[piece.ability.key];
      if (desc) {
        info += `<br><span style="color:#ddd">${desc}</span>`;
      }
      info += `</div>`;
    }
    
    const handler = C.PASSIVE_DESCRIPTIONS[piece.key];
    if (handler) {
      const cd = piece.helpFromAboveCooldown || piece.deathMeteorCooldown || 0;
      const active = piece.hasHelpFromAboveActive ? ' [ACTIVE]' : '';
      const name = piece.key === 'snowFrostLord' ? 'Help From Above' : piece.key === 'ashAshTyrant' ? 'Death Meteor' : '';
      let passiveText = handler;
      if (name) {
        passiveText = `${name} — ${cd > 0 ? `CD: ${cd} turns` : 'Ready'}${active}<br><span style="color:#ccc">${handler.split(' — ')[1] || handler}</span>`;
      }
      info += `<div style="margin-top:3px;font-size:11px;line-height:1.3;"><span style="color:#aaffaa">Passive:</span> ${passiveText}</div>`;
    }

    const sel = gameState?.selectedPiece;
    if (sel && sel.team !== piece.team) {
      try {
        const preview = E.previewDamage(sel, piece, gameState);
        const hpNow = typeof piece.currentHp === 'number' ? piece.currentHp : (piece.maxHp || '?');
        const hpMax = piece.maxHp || hpNow;
        let predHtml = `<div id="tacticalPredictor">`;
        predHtml += `<div>⚔ ${C.PIECE_TYPES[sel.key]?.name || sel.key} → ${C.PIECE_TYPES[piece.key]?.name || piece.key}</div>`;
        predHtml += `<div>HP: ${hpNow}/${hpMax} &nbsp;|&nbsp; `;
        predHtml += `DMG: <span class="pred-dmg">-${preview.dmg}</span></div>`;
        if (preview.isFatal) {
          predHtml += `<div class="pred-fatal" style="color:#EF4444;font-weight:bold;margin-top:2px;">☠ LETHAL STRIKE</div>`;
        } else {
          const hpAfter = Math.max(0, hpNow - preview.dmg);
          predHtml += `<div>Remaining HP: <span class="pred-chip" style="color:#44ffaa;">${hpAfter}</span></div>`;
        }
        predHtml += `</div>`;
        info += predHtml;
      } catch (e) {
        console.error(e);
      }
    }

    return info;
  };

  const getTooltipPosition = () => {
    const tooltipWidth = 400;
    let left = mousePos.x + 15;
    let top = mousePos.y + 15;
    if (left + tooltipWidth > window.innerWidth - 15) {
      left = mousePos.x - tooltipWidth - 15;
    }
    if (top + 300 > window.innerHeight - 15) {
      top = window.innerHeight - 315;
    }
    top = Math.max(10, top);
    return { left: `${left}px`, top: `${top}px` };
  };

  const selectedPiece = gameState?.selectedPiece;
  const selectedPieceName = selectedPiece
    ? (selectedPiece.name || C.PIECE_TYPES[selectedPiece.key]?.name || 'Selected Unit')
    : '';
  const hasPrimaryAbility = !!selectedPiece?.ability && selectedPiece.ability.key !== 'Siphon';
  const hasSiphon = selectedPiece?.ability?.key === 'Siphon';
  const hasRiftPulse = !!selectedPiece?.canRiftPulse && !selectedPiece?.hasUsedRiftPulse;
  const canDespawn = !!selectedPiece && ['snowIceWisp', 'glacialWall'].includes(selectedPiece.key);

  useEffect(() => {
    if (!selectedPiece) {
      setDrawerExpanded(false);
    }
  }, [selectedPiece?.id]);

  // Main UI returns
  if (!imagesLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-void-black text-on-surface">
        <div className="w-10 h-10 border-4 border-t-ember-gold border-outline/20 rounded-full animate-spin mb-4" />
        <p className="font-label-caps text-xs tracking-widest text-on-surface-variant font-bold">PREPARING THE BATTLEFIELD...</p>
      </div>
    );
  }

  const calculateDynamicTerritoryAreas = (gs) => {
    if (!gs) return { snow: 0, ash: 0 };
    const N = 6, totalSubcells = 100 * N * N, radius = 1.0;
    let snowCovered = 0, ashCovered = 0;
    const snowSet = gs.snowTerritory instanceof Set ? gs.snowTerritory : new Set(gs.snowTerritory || []);
    const ashSet = gs.ashTerritory instanceof Set ? gs.ashTerritory : new Set(gs.ashTerritory || []);
    const trailsByCell = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => []));
    (gs.territoryTrails || []).forEach(t => {
      const minR = Math.max(0, Math.floor(t.row - 1)), maxR = Math.min(9, Math.ceil(t.row + 1));
      const minC = Math.max(0, Math.floor(t.col - 1)), maxC = Math.min(9, Math.ceil(t.col + 1));
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          trailsByCell[r][c].push(t);
        }
      }
    });
    const checkCover = (x, y, bases, trails, team) =>
      bases.some(b => Math.hypot(x - b.cx, y - b.cy) <= radius) ||
      trails.some(t => t.team === team && Math.hypot(x - (t.col + 0.5), y - (t.row + 0.5)) <= radius);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const pos = `${r},${c}`;
        const isSnow = snowSet.has(pos), isAsh = ashSet.has(pos);
        const cellTrails = trailsByCell[r][c];
        const nearbyBases = { snow: [], ash: [] };
        for (let nr = Math.max(0, r - 1); nr <= Math.min(9, r + 1); nr++) {
          for (let nc = Math.max(0, c - 1); nc <= Math.min(9, c + 1); nc++) {
            const npos = `${nr},${nc}`;
            if (snowSet.has(npos)) nearbyBases.snow.push({ cx: nc + 0.5, cy: nr + 0.5 });
            if (ashSet.has(npos)) nearbyBases.ash.push({ cx: nc + 0.5, cy: nr + 0.5 });
          }
        }
        for (let sr = 0; sr < N; sr++) {
          const y = r + (sr + 0.5) / N;
          for (let sc = 0; sc < N; sc++) {
            const x = c + (sc + 0.5) / N;
            if (!isAsh && checkCover(x, y, nearbyBases.snow, cellTrails, 'snow')) {
              snowCovered++;
            } else if (!isSnow && checkCover(x, y, nearbyBases.ash, cellTrails, 'ash')) {
              ashCovered++;
            }
          }
        }
      }
    }
    return {
      snow: parseFloat(((snowCovered / totalSubcells) * 100).toFixed(1)),
      ash: parseFloat(((ashCovered / totalSubcells) * 100).toFixed(1))
    };
  };

  const isMyTurn = isLocal || gameState?.currentTurn === myTeam;
  const terrScores = calculateDynamicTerritoryAreas(gameState);
  const turnLabel = gameState?.gameOver 
    ? 'GAME OVER' 
    : `TURN ${gameState?.turnCount || 1}: ${gameState?.currentTurn === 'ash' ? 'ASH' : 'FROST'}`;

  const aliveSnowKeys = new Set(gameState?.pieces ? gameState.pieces.filter(p => p.team === 'snow').map(p => p.key) : []);
  const aliveAshKeys = new Set(gameState?.pieces ? gameState.pieces.filter(p => p.team === 'ash').map(p => p.key) : []);
  const fallenSnow = INITIAL_SNOW_KEYS.filter(k => !aliveSnowKeys.has(k));
  const fallenAsh = INITIAL_ASH_KEYS.filter(k => !aliveAshKeys.has(k));

  return (
    <div className="game-screen text-on-surface select-none font-body-md overflow-y-auto overflow-x-hidden min-h-screen w-full flex flex-col items-center justify-start relative">

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
          <button id="menuButton-mobile" className="top-menu-btn icon-btn" aria-label="Return to main menu" onClick={handleExitToLobby}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Menu</span>
          </button>
          {isLocal && (
            <div id="testModeContainer-mobile" className="test-mode-control mobile-test-mode">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              <input 
                type="checkbox" 
                id="testModeToggle-mobile"
                checked={!!gameState?.testMode}
                onChange={(e) => sendAction('TOGGLE_TEST_MODE', { enabled: e.target.checked })}
                style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }}
              />
              <label htmlFor="testModeToggle-mobile">Test</label>
            </div>
          )}
          <div className="mini-timer-block">
            <span id="miniTimerSnow" className={`timer-tag snow ${gameState?.currentTurn === 'snow' ? 'active' : ''}`}>{formatTime(gameState?.timers?.snow)}</span>
            <span className="vs-text">VS</span>
            <span id="miniTimerAsh" className={`timer-tag ash ${gameState?.currentTurn === 'ash' ? 'active' : ''}`}>{formatTime(gameState?.timers?.ash)}</span>
          </div>
          {isLocal && (
            <button id="startResetBtn-mobile" className="menu-btn start-btn-mobile" onClick={handleStartReset}>
              {gameState?.gameStarted ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{gameState?.gameStarted ? 'Reset' : 'Start'}</span>
            </button>
          )}
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
                <div id="snowTimer" className="timer-display">{formatTime(gameState?.timers?.snow)}</div>
              </div>
              <div className={`timer-card ash-card ${gameState?.currentTurn === 'ash' ? 'active' : ''}`}>
                <span className="timer-faction-name">Ash</span>
                <div id="ashTimer" className="timer-display">{formatTime(gameState?.timers?.ash)}</div>
              </div>
            </div>
            
            <div id="ability-info-panel" className={`ability-panel ${selectedPiece ? 'visible' : ''}`}>
              {selectedPiece && (
                <>
                  <div className="selected-unit-heading">
                    <span className="panel-kicker">Selected unit</span>
                    <h3 id="ability-name">{selectedPieceName}</h3>
                  </div>

                  {hasPrimaryAbility && (
                    <button
                      id="abilityBtn"
                      className={!isMyTurn ? 'disabled' : ''}
                      onClick={() => isMyTurn && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: selectedPiece.ability.key })}
                      disabled={!isMyTurn || (selectedPiece.ability.cooldown || 0) > 0}
                    >
                      {selectedPiece.ability.name || 'Use Ability'}
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
                    style={{ display: (selectedPiece.tethers && selectedPiece.tethers.length > 0) ? 'block' : 'none' }}
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
                      onClick={() => sendAction('DESPAWN', { pieceId: selectedPiece.id })}
                    >
                      Despawn
                    </button>
                  )}
                </>
              )}
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
              onCellClick={handleCellClick}
              onBoardClick={handleBoardClick}
              onPieceClick={handlePieceClick}
              onMouseEnterPiece={(piece, event) => {
                setHoveredPiece(piece);
                if (event) setMousePos({ x: event.clientX, y: event.clientY });
              }}
              onMouseLeavePiece={() => setHoveredPiece(null)}
            />
            <div className="labels-bar">
               <div id="snowLabel" className="label snow"><span>Frost control</span><strong>{terrScores.snow.toFixed(1)}%</strong></div>
               <div id="turnLabel" className={`label turn ${gameState?.currentTurn || 'snow'}`}>
                 <Clock3 className="h-4 w-4" aria-hidden="true" />
                 <span>{turnLabel}</span>
               </div>
               <div id="ashLabel" className="label ash"><span>Ash control</span><strong>{terrScores.ash.toFixed(1)}%</strong></div>
            </div>
          </div>

          <div id="right-column" className="ui-column primal-ash">
            <div id="messageLogContainer">
              <div className="event-log-heading">
                <div className="event-log-title">
                  <ScrollText className="h-4 w-4 text-magma-core" aria-hidden="true" />
                  <span>Battle Chronicle</span>
                </div>
              </div>
              <ul id="messageLog" aria-live="polite" aria-label="Battle chronicle event log">
                {eventLog.length === 0 ? (
                  <li className="event-log-empty">Battle events will appear here after the first move.</li>
                ) : eventLog.map((log, i) => {
                  const turnNum = typeof log === 'object' && log.turn ? log.turn : 1;
                  const message = typeof log === 'object' && log.text ? log.text : log;
                  const team = typeof log === 'object' && log.team ? log.team : 'neutral';
                  const badgeColor = team === 'snow'
                    ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                    : team === 'ash'
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                    : 'border-ember-gold/40 bg-ember-gold/15 text-amber-300';

                  return (
                    <li key={i} className="event-log-item">
                      <span className={`event-turn-badge ${badgeColor}`}>
                        T{turnNum}
                      </span>
                      <span className="event-text">{message}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div id="roomStatusOverlay">
              {!isLocal && (
                <div id="playerCountDisplay">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <span>Realm players</span>
                  <strong>{playerCount}/2</strong>
                </div>
              )}
              {isOpponentDisconnected && (
                <div id="disconnectTimerDisplay" style={{ backgroundColor: '#ff4444', color: 'white', fontWeight: 'bold', padding: '10px', borderRadius: '5px', textAlign: 'center', margin: '10px 0', display: 'block' }}>
                  Opponent disconnected. Closing in {disconnectTimeout}s
                </div>
              )}
            </div>
          </div>
          
          <div id="mobileDrawer" className={`mobile-drawer ${drawerExpanded ? 'expanded' : 'peek'}`}>
            <button
              className="drawer-handle"
              onClick={() => setDrawerExpanded(!drawerExpanded)}
              aria-label={drawerExpanded ? 'Collapse unit actions' : 'Expand unit actions'}
              aria-expanded={drawerExpanded}
            >
              {drawerExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
            </button>
            <div className="drawer-content">
              {!selectedPiece ? (
                <div id="drawerPeek" className="drawer-peek-info" onClick={() => setDrawerExpanded(!drawerExpanded)}>
                  <div className="peek-summary">
                    <span id="peek-name" className="peek-name">Select a Unit</span>
                    <span id="peek-desc" className="peek-desc">Tap any friendly unit to view stats & cast abilities</span>
                  </div>
                </div>
              ) : (
                <>
                  <div id="drawerPeek" className="drawer-peek-info" onClick={() => setDrawerExpanded(!drawerExpanded)}>
                    <div className="peek-summary">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span id="peek-name" className="peek-name">{selectedPieceName}</span>
                        <span className="drawer-toggle-badge">{drawerExpanded ? '▼ Close' : '▲ Actions'}</span>
                      </div>
                      <span id="peek-desc" className="peek-desc">{`${selectedPiece.currentHp} HP | ${selectedPiece.strength} STR | ${selectedPiece.def} DEF | ${selectedPiece.agility} AGI`}</span>
                    </div>
                  </div>
                  <div className="drawer-expanded">
                    <div className="unit-header-mobile">
                      {selectedPiece.ability && (
                        <div className="mobile-ability-desc-card">
                          <div style={{ color: '#E8C15E', fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                            Active: {selectedPiece.ability.name} {(selectedPiece.ability.cooldown || 0) > 0 ? `(CD: ${selectedPiece.ability.cooldown})` : '(Ready)'}
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.3' }}>
                            {C.ABILITY_DESCRIPTIONS[selectedPiece.ability.key]}
                          </div>
                        </div>
                      )}
                      {C.PASSIVE_DESCRIPTIONS[selectedPiece.key] && (
                        <div className="mobile-ability-desc-card" style={{ marginTop: '4px', borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                          <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                            Passive
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.3' }}>
                            {C.PASSIVE_DESCRIPTIONS[selectedPiece.key]}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mobile-action-container">
                      <div className="mobile-button-grid">
                        {hasPrimaryAbility && (
                          <button 
                            className="ability-btn-mobile primary-action" 
                            onClick={() => isMyTurn && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: selectedPiece.ability.key })} 
                            disabled={!isMyTurn || (selectedPiece.ability.cooldown || 0) > 0}
                          >
                            {selectedPiece.ability.name || 'Use Ability'}
                          </button>
                        )}
                        {hasSiphon && (
                          <button className="ability-btn-mobile primary-action" onClick={() => isMyTurn && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: 'Siphon' })} disabled={!isMyTurn}>Siphon</button>
                        )}
                        {hasRiftPulse && (
                          <button className="ability-btn-mobile" onClick={() => isMyTurn && sendAction('RIFT_PULSE', { pieceId: selectedPiece.id })} disabled={!isMyTurn}>Rift Pulse</button>
                        )}
                        {selectedPiece.tethers && selectedPiece.tethers.length > 0 && (
                          <button className="ability-btn-mobile unleash-btn" onClick={() => sendAction('RELEASE', { pieceId: selectedPiece.id })}>Release</button>
                        )}
                        {canDespawn && (
                          <button className="ability-btn-mobile" onClick={() => sendAction('DESPAWN', { pieceId: selectedPiece.id })}>Despawn</button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {hoveredPiece && (
        <div 
          id="piecePopup"
          className="piece-Popup"
          style={{
            display: 'block',
            position: 'fixed',
            ...getTooltipPosition(),
          }}
          dangerouslySetInnerHTML={{ __html: generatePieceInfoHtml(hoveredPiece) }}
        />
      )}
    </div>
  );
}
