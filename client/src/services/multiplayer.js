import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import * as Logic from '../../../shared/logic.js';
import * as C from '../../../shared/constants.js';
import {
  REALM_WORDS,
  INACTIVITY_TIMEOUT_MS,
  LOBBY_WAIT_TIMEOUT_MS,
  generateRoomCode,
  formatRoomCodeInput,
  isValidRoomCode,
  getOrCreatePlayerId,
  getPlayerId
} from './roomCode.js';
export {
  REALM_WORDS,
  INACTIVITY_TIMEOUT_MS,
  LOBBY_WAIT_TIMEOUT_MS,
  generateRoomCode,
  formatRoomCodeInput,
  isValidRoomCode,
  getOrCreatePlayerId,
  getPlayerId
};

// Automated TTL (Time-To-Live) generator for native Cloud Firestore retention policies
export const getRoomTtl = (status = 'WAITING') => {
  const now = Date.now();
  if (status === 'DISBANDED') return Timestamp.fromMillis(now + 60 * 60 * 1000); // 1 hour for disbanded rooms
  if (status === 'FINISHED') return Timestamp.fromMillis(now + 2 * 60 * 60 * 1000); // 2 hours for finished games
  if (status === 'PLAYING') return Timestamp.fromMillis(now + 6 * 60 * 60 * 1000); // 6 hours for active games
  return Timestamp.fromMillis(now + 24 * 60 * 60 * 1000); // 24 hours for waiting rooms
};

// Serialize GameState to JSON string for Firestore (bypassing Firestore nested-array restrictions)
export const serializeGameState = (gs) => {
  if (!gs) return null;
  const raw = JSON.parse(JSON.stringify(gs));
  raw.snowTerritory = Array.from(gs.snowTerritory || []);
  raw.ashTerritory = Array.from(gs.ashTerritory || []);
  delete raw.images;
  delete raw.boardImgs;
  return JSON.stringify(raw);
};

// Rehydrate GameState when loaded from Firestore (re-linking Sets and ability functions)
export function rehydrateGameState(state) {
  if (!state) return state;
  if (Array.isArray(state.snowTerritory)) state.snowTerritory = new Set(state.snowTerritory);
  if (Array.isArray(state.ashTerritory)) state.ashTerritory = new Set(state.ashTerritory);

  if (Array.isArray(state.pieces)) {
    for (const piece of state.pieces) {
      if (!piece || !piece.key) continue;
      const properties = C.PIECE_TYPES[piece.key] || {};
      if (!piece.name) piece.name = properties.name || piece.key;
      if (piece.ability && properties.ability) {
        const abilityKey = piece.ability.key || properties.ability.key || properties.ability.name;
        const baseAbility = C.ABILITIES[abilityKey] || {};
        piece.ability = {
          ...baseAbility,
          ...properties.ability,
          ...piece.ability
        };
      }
      if (piece.veteranAbility && properties.veteranAbility) {
        piece.veteranAbility = {
          ...properties.veteranAbility,
          ...piece.veteranAbility
        };
      }
    }
  }
  return state;
}

export function parseAndRehydrateGameState(rawOrStr) {
  if (!rawOrStr) return null;
  try {
    const state = typeof rawOrStr === 'string' ? JSON.parse(rawOrStr) : rawOrStr;
    return rehydrateGameState(state);
  } catch (err) {
    console.error('Failed to parse game state:', err);
    return null;
  }
}

// ── Room Creation ─────────────────────────────────────────────────────────────
export async function createRoom(playerId, options = {}) {
  const isPublic = options.isPublic !== false;
  const customCode = options.customCode ? options.customCode.trim().toUpperCase() : null;
  const preferredFaction = (options.preferredFaction === 'snow' || options.preferredFaction === 'ash')
    ? options.preferredFaction
    : null;

  let chosenRoomId = customCode || generateRoomCode();

  // Retry up to 3 times if an auto-generated code collides with an active room
  for (let attempt = 0; attempt < 3; attempt++) {
    const roomRef = doc(db, 'rooms', chosenRoomId);
    try {
      return await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef);

        if (roomSnap.exists()) {
          const data = roomSnap.data();
          const isStale = data.updatedAt && (Date.now() - data.updatedAt > 60 * 60 * 1000);
          if (!isStale && data.status !== 'FINISHED') {
            if (customCode) {
              throw new Error(`Realm code "${customCode}" is already in use by an active battle.`);
            }
            // Collision on auto-generated code, generate a new one and retry
            chosenRoomId = generateRoomCode();
            throw new Error('COLLISION_RETRY');
          }
        }

        const initialGS = {};
        Logic.initGameState(initialGS);
        Logic.initGame();
        initialGS.timers = { snow: 600, ash: 600 };
        const freshSerialized = serializeGameState(Logic.getGameState());

        const newRoom = {
          id: chosenRoomId,
          status: 'WAITING',
          isPublic,
          hostId: playerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expireAt: getRoomTtl('WAITING'),
          players: [{ id: playerId, team: preferredFaction, lastSeen: Date.now() }],
          gameState: freshSerialized
        };

        transaction.set(roomRef, newRoom);
        return {
          success: true,
          roomId: chosenRoomId,
          room: { ...newRoom, gameState: parseAndRehydrateGameState(freshSerialized) },
          team: preferredFaction,
          isNew: true,
          playerCount: 1
        };
      });
    } catch (err) {
      if (err.message === 'COLLISION_RETRY' && attempt < 2) continue;
      throw err;
    }
  }
}

// ── Quick Match (Matchmaking) ────────────────────────────────────────────────
export async function quickMatch(playerId) {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('status', '==', 'WAITING'),
      limit(25)
    );
    const snap = await getDocs(q);
    const now = Date.now();
    const candidateRooms = [];

    snap.forEach((d) => {
      const room = d.data();
      if (room.status !== 'WAITING') return;

      const isPublic = room.isPublic !== false;
      const hasSpace = Array.isArray(room.players) && room.players.length === 1;
      const host = hasSpace ? room.players[0] : null;
      const lastSeen = host?.lastSeen || room.updatedAt || room.createdAt || 0;
      const isActive = (now - lastSeen) <= INACTIVITY_TIMEOUT_MS;
      const notExpired = !room.createdAt || (now - room.createdAt <= LOBBY_WAIT_TIMEOUT_MS);
      const isNotSelf = !room.players?.some(p => p.id === playerId);

      if (isPublic && hasSpace && isActive && notExpired && isNotSelf) {
        candidateRooms.push({ id: d.id, ...room });
      } else if (!isActive || !notExpired || (Array.isArray(room.players) && room.players.length === 0)) {
        // Disband inactive/abandoned room
        disbandRoom(d.id, 'INACTIVITY');
      }
    });

    // Match oldest active waiting player first (FIFO)
    candidateRooms.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    for (const target of candidateRooms) {
      try {
        const joinRes = await joinOrCreateRoom(target.id, playerId);
        if (joinRes.success) {
          return {
            success: true,
            matched: true,
            roomId: target.id,
            room: joinRes.room,
            team: joinRes.team
          };
        }
      } catch (e) {
        // Room was likely filled in that split second, try next
        continue;
      }
    }
  } catch (err) {
    console.warn('QuickMatch matchmaking warning:', err);
  }

  // If no waiting room was joined, host a new public realm automatically
  const created = await createRoom(playerId, { isPublic: true });
  return {
    success: true,
    matched: false,
    isHost: true,
    roomId: created.roomId,
    room: created.room,
    team: created.team
  };
}

// ── Realtime Open Realms Browser ──────────────────────────────────────────────
export function subscribeToOpenRooms(callback, onError) {
  const q = query(
    collection(db, 'rooms'),
    where('status', '==', 'WAITING'),
    limit(30)
  );

  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const rooms = [];

    snapshot.forEach((d) => {
      const r = d.data();
      if (r.status !== 'WAITING') return;
      if (r.isPublic === false) return;

      if (!Array.isArray(r.players) || r.players.length === 0) {
        disbandRoom(d.id, 'EMPTY');
        return;
      }
      if (r.players.length !== 1) return;

      const host = r.players[0];
      const lastSeen = host?.lastSeen || r.updatedAt || r.createdAt || 0;

      // If host has been inactive for more than INACTIVITY_TIMEOUT_MS, disband
      if (now - lastSeen > INACTIVITY_TIMEOUT_MS) {
        disbandRoom(d.id, 'INACTIVITY');
        return;
      }

      // If room has been waiting for more than LOBBY_WAIT_TIMEOUT_MS, disband
      if (r.createdAt && (now - r.createdAt > LOBBY_WAIT_TIMEOUT_MS)) {
        disbandRoom(d.id, 'WAIT_TIMEOUT');
        return;
      }

      rooms.push({
        id: d.id,
        createdAt: r.createdAt || r.updatedAt || now,
        hostFaction: host?.team || null,
        playerCount: r.players.length,
        isPublic: true
      });
    });

    rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback?.(rooms);
  }, (err) => {
    console.error('subscribeToOpenRooms error:', err);
    onError?.(err);
  });
}

// ── Room Join / Create ────────────────────────────────────────────────────────
export async function joinOrCreateRoom(roomId, playerId) {
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);

  return await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);

    if (!roomSnap.exists()) {
      // Room doesn't exist yet: initialize fresh state
      const initialGS = {};
      Logic.initGameState(initialGS);
      Logic.initGame();
      initialGS.timers = { snow: 600, ash: 600 };
      const freshSerialized = serializeGameState(Logic.getGameState());

      const newRoom = {
        id: normalizedId,
        status: 'WAITING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        players: [{ id: playerId, team: null, lastSeen: Date.now() }],
        gameState: freshSerialized
      };

      transaction.set(roomRef, newRoom);
      return {
        success: true,
        room: { ...newRoom, gameState: parseAndRehydrateGameState(freshSerialized) },
        team: null,
        isNew: true,
        playerCount: 1
      };
    }

    const room = roomSnap.data();

    // If room is explicitly disbanded, block join
    if (room.status === 'DISBANDED') {
      return { success: false, error: 'This realm has been disbanded due to inactivity.' };
    }

    // If all previous players are inactive and match didn't start, reset room cleanly
    const now = Date.now();
    const activePlayers = (room.players || []).filter(p => (now - (p.lastSeen || 0)) <= INACTIVITY_TIMEOUT_MS);
    if (activePlayers.length === 0 && room.status !== 'PLAYING') {
      const initialGS = {};
      Logic.initGameState(initialGS);
      Logic.initGame();
      initialGS.timers = { snow: 600, ash: 600 };
      const freshSerialized = serializeGameState(Logic.getGameState());

      const resetRoom = {
        id: normalizedId,
        status: 'WAITING',
        createdAt: now,
        updatedAt: now,
        expireAt: getRoomTtl('WAITING'),
        hostId: playerId,
        players: [{ id: playerId, team: null, lastSeen: now }],
        gameState: freshSerialized
      };

      transaction.set(roomRef, resetRoom);
      return {
        success: true,
        room: { ...resetRoom, gameState: parseAndRehydrateGameState(freshSerialized) },
        team: null,
        isNew: true,
        playerCount: 1
      };
    }

    const existing = room.players?.find(p => p.id === playerId);
    const parsedGS = parseAndRehydrateGameState(room.gameState);

    if (existing) {
      // Reconnecting player
      existing.lastSeen = Date.now();
      transaction.update(roomRef, {
        players: room.players,
        updatedAt: Date.now()
      });
      return {
        success: true,
        room: { ...room, gameState: parsedGS },
        team: existing.team,
        isNew: false,
        playerCount: room.players.length
      };
    }

    if (room.players?.length < 2) {
      const updatedPlayers = [...room.players, { id: playerId, team: null, lastSeen: Date.now() }];
      transaction.update(roomRef, {
        players: updatedPlayers,
        updatedAt: Date.now()
      });
      return {
        success: true,
        room: { ...room, players: updatedPlayers, gameState: parsedGS },
        team: null,
        isNew: false,
        playerCount: updatedPlayers.length
      };
    }

    return { success: false, error: 'Room is already full (2 commanders maximum).' };
  });
}

// ── Faction Selection ─────────────────────────────────────────────────────────
export async function selectFaction(roomId, playerId, faction) {
  if (faction !== 'snow' && faction !== 'ash') {
    throw new Error('Invalid faction selection.');
  }

  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(roomRef);
    if (!snap.exists()) throw new Error('Room not found.');

    const room = snap.data();
    const isOccupied = room.players?.some(p => p.id !== playerId && p.team === faction);
    if (isOccupied) {
      throw new Error(`Faction ${faction.toUpperCase()} is already chosen by the other commander.`);
    }

    const players = (room.players || []).map(p => {
      if (p.id === playerId) return { ...p, team: faction, lastSeen: Date.now() };
      return p;
    });

    const hasSnow = players.some(p => p.team === 'snow');
    const hasAsh = players.some(p => p.team === 'ash');
    let gs = parseAndRehydrateGameState(room.gameState);
    let status = room.status;

    // Both players chosen -> automatically start game with 5s preparation countdown
    if (players.length === 2 && hasSnow && hasAsh) {
      const now = Date.now();
      const battleStartTime = now + 5000;
      Logic.withGameState(gs, () => {
        if (!gs.gameStarted) {
          Logic.initGame();
          gs.gameStarted = true;
          gs.timers = { snow: 600, ash: 600 };
          gs.battleStartTime = battleStartTime;
        }
      });
      status = 'PLAYING';
    }

    const serializedGS = serializeGameState(gs);

    transaction.update(roomRef, {
      players,
      gameState: serializedGS,
      status,
      expireAt: getRoomTtl(status),
      updatedAt: Date.now()
    });

    return { players, faction, status };
  });
}

// ── Realtime Room Subscription ────────────────────────────────────────────────
export function subscribeToRoom(roomId, onUpdate, onError) {
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  return onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      onError?.(new Error('Room does not exist.'));
      return;
    }
    const data = snapshot.data();
    if (data?.gameState) {
      data.gameState = parseAndRehydrateGameState(data.gameState);
    }
    onUpdate?.(data);
  }, (err) => {
    onError?.(err);
  });
}

// ── Game Action Execution ─────────────────────────────────────────────────────
export async function dispatchGameAction(roomId, playerId, actionType, data = {}) {
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(roomRef);
    if (!snap.exists()) throw new Error('Room does not exist.');

    const room = snap.data();
    const gs = parseAndRehydrateGameState(room.gameState);
    const player = room.players?.find(p => p.id === playerId);

    if (!gs) throw new Error('Game state missing.');

    // Atomically synchronize timers if provided in action payload
    if (data?.timers && typeof data.timers === 'object') {
      gs.timers = { ...gs.timers, ...data.timers };
    }

    const coordsOk = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      const r = parseFloat(obj.r);
      const c = parseFloat(obj.c);
      if (isNaN(r) || isNaN(c)) return false;
      return C.inBounds(r, c);
    };

    if (actionType === 'START_GAME') {
      if (room.players?.length < 2) throw new Error('Waiting for an opponent to join...');
      if (player?.team === 'snow') {
        const battleStartTime = Date.now() + 5000;
        Logic.withGameState(gs, () => {
          if (!gs.gameStarted) {
            Logic.initGame();
            gs.gameStarted = true;
            gs.timers = { snow: 600, ash: 600 };
            gs.battleStartTime = battleStartTime;
          }
        });
      }
      transaction.update(roomRef, { gameState: serializeGameState(gs), status: 'PLAYING', updatedAt: Date.now() });
      return;
    }

    if (actionType === 'SYNC_TIMERS') {
      if (data.timers) gs.timers = data.timers;
      transaction.update(roomRef, { gameState: serializeGameState(gs), updatedAt: Date.now() });
      return;
    }

    if (actionType === 'RESET_GAME') {
      Logic.withGameState(gs, () => {
        Logic.resetGame();
        gs.timers = { snow: 600, ash: 600 };
      });
      transaction.update(roomRef, { gameState: serializeGameState(gs), updatedAt: Date.now() });
      return;
    }

    if (actionType === 'TOGGLE_TEST_MODE') {
      Logic.withGameState(gs, () => {
        gs.testMode = data.enabled;
        if (gs.testMode) {
          if (!gs.originalPieces) gs.originalPieces = JSON.parse(JSON.stringify(gs.pieces));
          gs.pieces = gs.pieces.filter(p => p.key === 'snowFrostLord' || p.key === 'ashAshTyrant' || p.key === 'ashMagmaShaper');
        } else {
          if (gs.originalPieces) {
            gs.pieces = JSON.parse(JSON.stringify(gs.originalPieces));
            delete gs.originalPieces;
          }
        }
      });
      transaction.update(roomRef, { gameState: serializeGameState(gs), updatedAt: Date.now() });
      return;
    }

    if (actionType === 'TIMEOUT') {
      Logic.withGameState(gs, () => {
        Logic.endGame(data.team === 'snow' ? 'ash' : 'snow');
      });
      transaction.update(roomRef, {
        gameState: serializeGameState(gs),
        status: 'FINISHED',
        expireAt: getRoomTtl('FINISHED'),
        updatedAt: Date.now()
      });
      return;
    }

    // Turn validation
    if (!player || gs.currentTurn !== player.team) {
      return; // Not this player's turn
    }

    if (!gs.gameStarted) throw new Error('Game has not started yet.');

    if (actionType === 'MOVE' && !coordsOk({ r: data.r, c: data.c })) throw new Error('Invalid move coordinates');
    if (actionType === 'HANDLE_CLICK' && !coordsOk({ r: data.r, c: data.c })) throw new Error('Invalid target coordinates');
    if (actionType === 'ABILITY' && data.target && !coordsOk(data.target)) throw new Error('Invalid ability target');

    Logic.withGameState(gs, () => {
      gs.events = [];
      let turnEnded = false;
      const find = (id) => gs.pieces.find(x => x.id === id);
      const p = find(data?.pieceId);

      switch (actionType) {
        case 'SELECT_PIECE':
          if (p && p.team === player.team) Logic.selectPiece(p);
          else Logic.deselectPiece();
          break;
        case 'MOVE':
          if (p && p.team === player.team) turnEnded = Logic.movePiece(p, data.r, data.c, data.isHighway);
          break;
        case 'ABILITY':
          if (p && p.team === player.team) {
            if (data.target) turnEnded = Logic.executeAbility(p, data.target, data.abilityKey, gs);
            else turnEnded = Logic.activateAbility(p, data.abilityKey || 0);
          }
          break;
        case 'HANDLE_CLICK':
          turnEnded = Logic.handleAbilityClick(data.r, data.c);
          break;
        case 'SWITCH_TURN': turnEnded = true; break;
        case 'ASCENSION_CHOICE': turnEnded = Logic.executeAscensionChoice(data.choice); break;
        case 'CANCEL_ASCENSION': Logic.cancelAscensionChoice(); break;
        case 'SACRIFICE': if (p && p.team === player.team) turnEnded = Logic.executeSacrifice(p); break;
        case 'RELEASE': if (p && p.team === player.team) turnEnded = Logic.executeRelease(p); break;
        case 'RIFT_PULSE': if (p && p.team === player.team) turnEnded = Logic.executeRiftPulse(p); break;
        case 'DESPAWN': if (p && p.team === player.team) { Logic.despawnPiece(p); turnEnded = true; } break;
        default:
          break;
      }

      if (turnEnded) {
        if (!Logic.checkAscensionReady()) Logic.switchTurn();
      }
    });

    const finalStatus = gs.gameOver ? 'FINISHED' : room.status;
    transaction.update(roomRef, {
      gameState: serializeGameState(gs),
      status: finalStatus,
      expireAt: getRoomTtl(finalStatus),
      updatedAt: Date.now()
    });
  });
}

// ── Leave Room ────────────────────────────────────────────────────────────────
export async function leaveRoom(roomId, playerId) {
  if (!roomId) return;
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data();
      const updatedPlayers = (room.players || []).filter(p => p.id !== playerId);

      // If no players remain, immediately disband the room!
      if (updatedPlayers.length === 0) {
        transaction.update(roomRef, {
          players: [],
          status: 'DISBANDED',
          disbandReason: 'EMPTY',
          expireAt: getRoomTtl('DISBANDED'),
          updatedAt: Date.now()
        });
        return;
      }

      // If host leaves before the game started, disband the room
      if (room.status === 'WAITING' && room.hostId === playerId) {
        transaction.update(roomRef, {
          players: updatedPlayers,
          status: 'DISBANDED',
          disbandReason: 'HOST_LEFT',
          expireAt: getRoomTtl('DISBANDED'),
          updatedAt: Date.now()
        });
        return;
      }

      transaction.update(roomRef, {
        players: updatedPlayers,
        updatedAt: Date.now()
      });
    });
  } catch (err) {
    console.error('Failed to leave room:', err);
  }
}

// ── Disband Room ──────────────────────────────────────────────────────────────
export async function disbandRoom(roomId, reason = 'INACTIVITY') {
  if (!roomId) return;
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data();
      if (room.status === 'DISBANDED') return;
      transaction.update(roomRef, {
        status: 'DISBANDED',
        disbandReason: reason,
        players: [],
        expireAt: getRoomTtl('DISBANDED'),
        updatedAt: Date.now()
      });
    });
  } catch (err) {
    console.error('Failed to disband room:', err);
  }
}

// ── Heartbeat Ping ────────────────────────────────────────────────────────────
export async function updatePlayerHeartbeat(roomId, playerId) {
  if (!roomId || !playerId) return;
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data();
      if (room.status === 'DISBANDED' || room.status === 'FINISHED') return;

      const now = Date.now();
      let changed = false;
      const players = (room.players || []).map(p => {
        if (p.id === playerId) {
          changed = true;
          return { ...p, lastSeen: now };
        }
        return p;
      });

      if (changed) {
        transaction.update(roomRef, {
          players,
          updatedAt: now
        });
      }
    });
  } catch (e) {
    // Non-critical background ping
  }
}
