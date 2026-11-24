let firestoreDepsPromise = null;
let cachedTimestamp = null;

export async function getFirestoreDeps() {
  if (!firestoreDepsPromise) {
    firestoreDepsPromise = (async () => {
      const [firestore, { getDb, getAuthUser }] = await Promise.all([
        import('firebase/firestore'),
        import('./firebase.js')
      ]);
      const db = await getDb();
      cachedTimestamp = firestore.Timestamp;
      return {
        db,
        getAuthUser,
        ...firestore
      };
    })();
  }
  return firestoreDepsPromise;
}
import * as Logic from '@shared/logic.js';
import * as C from '@shared/constants.js';
import * as E from '@shared/utils.js';
import {
  REALM_WORDS,
  INACTIVITY_TIMEOUT_MS,
  LOBBY_WAIT_TIMEOUT_MS,
  generateRoomCode,
  formatRoomCodeInput,
  isValidRoomCode,
  getOrCreatePlayerId,
  getPlayerId,
  saveActiveSession,
  getActiveSession,
  clearActiveSession
} from './roomCode.js';
export {
  REALM_WORDS,
  INACTIVITY_TIMEOUT_MS,
  LOBBY_WAIT_TIMEOUT_MS,
  generateRoomCode,
  formatRoomCodeInput,
  isValidRoomCode,
  getOrCreatePlayerId,
  getPlayerId,
  saveActiveSession,
  getActiveSession,
  clearActiveSession
};

// Automated TTL (Time-To-Live) generator for native Cloud Firestore retention policies
export const getRoomTtl = (status = 'WAITING') => {
  const now = Date.now();
  const ts = cachedTimestamp;
  if (ts) {
    if (status === 'DISBANDED') return ts.fromMillis(now + 60 * 60 * 1000); // 1 hour for disbanded rooms
    if (status === 'FINISHED') return ts.fromMillis(now + 2 * 60 * 60 * 1000); // 2 hours for finished games
    if (status === 'PLAYING') return ts.fromMillis(now + 6 * 60 * 60 * 1000); // 6 hours for active games
    return ts.fromMillis(now + 24 * 60 * 60 * 1000); // 24 hours for waiting rooms
  }
  if (status === 'DISBANDED') return new Date(now + 60 * 60 * 1000);
  if (status === 'FINISHED') return new Date(now + 2 * 60 * 60 * 1000);
  if (status === 'PLAYING') return new Date(now + 6 * 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000);
};

// Serialize GameState to JSON string for Firestore (bypassing Firestore nested-array restrictions)
export const serializeGameState = (gs) => {
  if (!gs) return null;
  const { images, boardImgs, ...rest } = gs;
  return JSON.stringify(rest, (key, value) => {
    if (value instanceof Set) return Array.from(value);
    return value;
  });
};

// Serialize only mutable gameplay delta to JSON string for Firestore turn sync
export const serializeDelta = (gs) => {
  if (!gs) return null;
  const delta = {
    pieces: gs.pieces || [],
    turnCount: gs.turnCount,
    currentTurn: gs.currentTurn,
    currentState: gs.currentState,
    events: (gs.events || []).slice(-20),
    selectedPiece: gs.selectedPiece || null,
    snowTerritory: Array.from(gs.snowTerritory || []),
    ashTerritory: Array.from(gs.ashTerritory || []),
    territoryTrails: gs.territoryTrails || [],
    territoryCaptureTurn: gs.territoryCaptureTurn || {},
    riftAnchors: gs.riftAnchors || { topLeft: null, bottomRight: null },
    dynamicRifts: gs.dynamicRifts || null,
    voidSquares: gs.voidSquares || [],
    elementalCores: gs.elementalCores || [],
    fateLinks: gs.fateLinks || [],
    TheReapersTolls: gs.TheReapersTolls || [],
    reignOfFires: gs.reignOfFires || [],
    timers: gs.timers || { snow: 600, ash: 600 },
    gameOver: !!gs.gameOver,
    winner: gs.winner || null,
    shrineChargeLevel: gs.shrineChargeLevel || 0,
    shrineIsOverloaded: !!gs.shrineIsOverloaded,
    glacialWalls: gs.glacialWalls || [],
    markedPieces: (gs.markedPieces || []).map(m => (m.target ? { ...m, target: undefined } : m)),
    unstableGrounds: (gs.unstableGrounds || []).filter(Boolean).map(g => ({
      ...g,
      creator: (typeof g.creator === 'object' && g.creator !== null) ? g.creator.id : g.creator
    })),
    specialTerrains: gs.specialTerrains || [],
    shields: (gs.shields || []).map(s => (s.piece ? { ...s, piece: undefined } : s)),
    temporaryBoosts: (gs.temporaryBoosts || []).map(b => (b.piece ? { ...b, piece: undefined } : b)),
    debuffs: (gs.debuffs || []).map(d => (d.piece ? { ...d, piece: undefined } : d)),
    abilityContext: gs.abilityContext || null,
    conduit: gs.conduit || null,
    conduitLinkActive: !!gs.conduitLinkActive,
    conduitIsContested: !!gs.conduitIsContested,
    conduitTeam: gs.conduitTeam || null,
    conduitOverchargeProgress: gs.conduitOverchargeProgress || null,
    factionPassives: gs.factionPassives || null,
    pendingAscension: gs.pendingAscension || null,
    voidScarSquares: gs.voidScarSquares || [],
    deathMeteors: gs.deathMeteors || [],
    trappedPiece: gs.trappedPiece || null,
    gameStarted: gs.gameStarted !== undefined ? gs.gameStarted : true,
    battleStartTime: gs.battleStartTime || null
  };
  return JSON.stringify(delta);
};

// Rehydrate GameState when loaded from Firestore (re-linking Sets and ability functions)
export function rehydrateGameState(state) {
  if (!state) return state;

  state.pieces = state.pieces || [];
  state.events = state.events || [];
  state.territoryTrails = state.territoryTrails || [];
  state.territoryCaptureTurn = state.territoryCaptureTurn || {};
  state.riftAnchors = state.riftAnchors || { topLeft: null, bottomRight: null };
  state.dynamicRifts = state.dynamicRifts || (C.SHAPES && C.SHAPES.riftAreas ? JSON.parse(JSON.stringify(C.SHAPES.riftAreas)) : null);
  state.voidSquares = state.voidSquares || [];
  state.elementalCores = state.elementalCores || [];
  state.fateLinks = state.fateLinks || [];
  state.TheReapersTolls = state.TheReapersTolls || [];
  state.reignOfFires = state.reignOfFires || [];
  state.glacialWalls = state.glacialWalls || [];
  state.markedPieces = state.markedPieces || [];
  state.unstableGrounds = state.unstableGrounds || [];
  state.specialTerrains = state.specialTerrains || [];
  state.shields = state.shields || [];
  state.temporaryBoosts = state.temporaryBoosts || [];
  state.debuffs = state.debuffs || [];
  state.voidScarSquares = state.voidScarSquares || [];
  state.deathMeteors = state.deathMeteors || [];

  if (Array.isArray(state.snowTerritory)) state.snowTerritory = new Set(state.snowTerritory);
  else if (!state.snowTerritory) state.snowTerritory = new Set();

  if (Array.isArray(state.ashTerritory)) state.ashTerritory = new Set(state.ashTerritory);
  else if (!state.ashTerritory) state.ashTerritory = new Set();

  const pieceMap = new Map((state.pieces || []).filter(Boolean).map(p => [p.id, p]));
  if (Array.isArray(state.unstableGrounds)) {
    state.unstableGrounds.forEach(g => {
      const creatorId = (typeof g.creator === 'object' && g.creator !== null) ? g.creator.id : g.creator;
      if (creatorId != null && pieceMap.has(creatorId)) {
        g.creator = pieceMap.get(creatorId);
      }
    });
  }

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
  const { doc, runTransaction, db, getAuthUser } = await getFirestoreDeps();
  const isPublic = options.isPublic !== false;
  const customCode = options.customCode ? options.customCode.trim().toUpperCase() : null;
  const preferredFaction = (options.preferredFaction === 'snow' || options.preferredFaction === 'ash')
    ? options.preferredFaction
    : null;

  let chosenRoomId = customCode || generateRoomCode();
  const authUser = await getAuthUser();
  const authUid = authUser?.uid || null;

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
        Logic.initGame(initialGS);
        initialGS.timers = { snow: 600, ash: 600 };
        const freshSerialized = serializeDelta(initialGS);

        const newRoom = {
          id: chosenRoomId,
          status: 'WAITING',
          isPublic,
          hostId: playerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expireAt: getRoomTtl('WAITING'),
          moveIndex: 0,
          playerIds: [playerId],
          playerUids: authUid ? [authUid] : [],
          players: [{ id: playerId, uid: authUid, team: preferredFaction, lastSeen: Date.now() }],
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
    const { query, collection, where, limit, getDocs, db } = await getFirestoreDeps();
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

export const findQuickMatch = quickMatch;

export async function createCustomRoom(code, isPublic, playerId) {
  return createRoom(playerId, { customCode: code, isPublic });
}

// ── Realtime Open Realms Browser ──────────────────────────────────────────────
export function subscribeToOpenRooms(callback, onError) {
  let unsub = null;
  let cancelled = false;

  getFirestoreDeps().then(({ collection, query, where, limit, onSnapshot, db }) => {
    if (cancelled) return;
    const q = query(
      collection(db, 'rooms'),
      where('status', '==', 'WAITING'),
      limit(30)
    );

    unsub = onSnapshot(q, (snapshot) => {
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

    if (cancelled && unsub) {
      unsub();
      unsub = null;
    }
  }).catch((err) => {
    if (!cancelled) onError?.(err);
  });

  return () => {
    cancelled = true;
    if (unsub) {
      unsub();
      unsub = null;
    }
  };
}

// ── Room Join / Create ────────────────────────────────────────────────────────
export async function joinOrCreateRoom(roomId, playerId) {
  const { doc, runTransaction, db, getAuthUser } = await getFirestoreDeps();
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  const authUser = await getAuthUser();
  const authUid = authUser?.uid || null;

  return await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);

    if (!roomSnap.exists()) {
      // Room doesn't exist yet: initialize fresh state
      const initialGS = {};
      Logic.initGameState(initialGS);
      Logic.initGame(initialGS);
      initialGS.timers = { snow: 600, ash: 600 };
      const freshSerialized = serializeDelta(initialGS);

      const newRoom = {
        id: normalizedId,
        status: 'WAITING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        moveIndex: 0,
        playerIds: [playerId],
        playerUids: authUid ? [authUid] : [],
        players: [{ id: playerId, uid: authUid, team: null, lastSeen: Date.now() }],
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
      Logic.initGame(initialGS);
      initialGS.timers = { snow: 600, ash: 600 };
      const freshSerialized = serializeDelta(initialGS);

      const resetRoom = {
        id: normalizedId,
        status: 'WAITING',
        createdAt: now,
        updatedAt: now,
        expireAt: getRoomTtl('WAITING'),
        hostId: playerId,
        moveIndex: 0,
        playerIds: [playerId],
        playerUids: authUid ? [authUid] : [],
        players: [{ id: playerId, uid: authUid, team: null, lastSeen: now }],
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
      if (authUid && !existing.uid) existing.uid = authUid;
      const updatedPlayerUids = room.playerUids || [];
      if (authUid && !updatedPlayerUids.includes(authUid)) updatedPlayerUids.push(authUid);

      transaction.update(roomRef, {
        players: room.players,
        playerIds: room.playerIds || room.players.map(p => p.id),
        playerUids: updatedPlayerUids,
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
      const updatedPlayers = [...room.players, { id: playerId, uid: authUid, team: null, lastSeen: Date.now() }];
      const updatedPlayerIds = Array.from(new Set([...(room.playerIds || room.players.map(p => p.id)), playerId]));
      const updatedPlayerUids = Array.from(new Set([...(room.playerUids || []), ...(authUid ? [authUid] : [])]));

      transaction.update(roomRef, {
        players: updatedPlayers,
        playerIds: updatedPlayerIds,
        playerUids: updatedPlayerUids,
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

  const { doc, runTransaction, db } = await getFirestoreDeps();
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
      if (!gs.gameStarted) {
        Logic.initGame(gs);
        gs.gameStarted = true;
        gs.timers = { snow: 600, ash: 600 };
        gs.battleStartTime = battleStartTime;
      }
      status = 'PLAYING';
    }

    const serializedGS = serializeDelta(gs);

    transaction.update(roomRef, {
      players,
      playerIds: room.playerIds || players.map(p => p.id),
      playerUids: room.playerUids || [],
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
  let unsub = null;
  let cancelled = false;

  getFirestoreDeps().then(({ doc, db, onSnapshot }) => {
    if (cancelled) return;
    const normalizedId = roomId.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedId);
    unsub = onSnapshot(roomRef, (snapshot) => {
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

    if (cancelled && unsub) {
      unsub();
      unsub = null;
    }
  }).catch((err) => {
    if (!cancelled) onError?.(err);
  });

  return () => {
    cancelled = true;
    if (unsub) {
      unsub();
      unsub = null;
    }
  };
}

// ── Game Action Execution ─────────────────────────────────────────────────────
export async function dispatchGameAction(roomId, playerId, actionType, data = {}) {
  const { doc, runTransaction, db } = await getFirestoreDeps();
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
        if (!gs.gameStarted) {
          Logic.initGame(gs);
          gs.gameStarted = true;
          gs.timers = { snow: 600, ash: 600 };
          gs.battleStartTime = battleStartTime;
        }
      }
      transaction.update(roomRef, { gameState: serializeDelta(gs), status: 'PLAYING', updatedAt: Date.now() });
      return;
    }

    if (actionType === 'SYNC_TIMERS') {
      if (data.timers) gs.timers = data.timers;
      transaction.update(roomRef, { gameState: serializeDelta(gs), updatedAt: Date.now() });
      return;
    }

    if (actionType === 'RESET_GAME') {
      throw new Error('Anti-Cheat: Arbitrary game resets are prohibited in active multiplayer matches.');
    }

    if (actionType === 'TOGGLE_TEST_MODE') {
      throw new Error('Anti-Cheat: Test mode is disabled in multiplayer matches.');
    }

    if (actionType === 'TIMEOUT') {
      const victimTeam = data?.team;
      // Anti-Cheat: Validate that player clock has legitimately expired (<= 0)
      if (!victimTeam || (gs.timers && gs.timers[victimTeam] > 0)) {
        throw new Error('Anti-Cheat: Cannot declare timeout; player timer has not expired.');
      }
      Logic.endGame(victimTeam === 'snow' ? 'ash' : 'snow', gs);
      const nextMoveIndex = (room.moveIndex || 0) + 1;
      transaction.update(roomRef, {
        gameState: serializeDelta(gs),
        status: 'FINISHED',
        moveIndex: nextMoveIndex,
        playerIds: room.playerIds || room.players.map(p => p.id),
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

    if (actionType === 'MOVE') {
      if (!coordsOk({ r: data.r, c: data.c })) throw new Error('Invalid move coordinates');
      const p = gs.pieces?.find(x => x.id === data?.pieceId);
      if (!p || p.team !== player.team) throw new Error('Anti-Cheat: Cannot move enemy or non-existent unit');
      const validMoves = E.getValidMoves ? E.getValidMoves(p, gs) : [];
      const isLegal = validMoves.some(m => {
        const mr = m.row !== undefined ? m.row : m.r;
        const mc = m.col !== undefined ? m.col : m.c;
        return Math.hypot(mr - data.r, mc - data.c) < 0.75;
      });
      if (!isLegal) {
        throw new Error('Anti-Cheat: Target tile is outside legal movement paths.');
      }
    }
    if (actionType === 'HANDLE_CLICK' && !coordsOk({ r: data.r, c: data.c })) throw new Error('Invalid target coordinates');
    if (actionType === 'ABILITY' && data.target && !coordsOk(data.target)) throw new Error('Invalid ability target');

    Logic.withGameState(gs, () => {
      gs.events = [];
      let turnEnded = false;
      const find = (id) => gs.pieces.find(x => x.id === id);
      const p = find(data?.pieceId);

      switch (actionType) {
        case 'SELECT_PIECE':
          if (p && p.team === player.team) Logic.selectPiece(p, gs);
          else Logic.deselectPiece(gs);
          break;
        case 'MOVE':
          if (p && p.team === player.team) turnEnded = Logic.movePiece(p, data.r, data.c, data.isHighway, gs);
          break;
        case 'ABILITY':
          if (p && p.team === player.team) {
            if (p.abilityCooldown > 0) throw new Error('Anti-Cheat: Ability is currently on cooldown');
            if (data.target) turnEnded = Logic.executeAbility(p, data.target, data.abilityKey, gs);
            else turnEnded = Logic.activateAbility(p, data.abilityKey || 0, gs);
          }
          break;
        case 'HANDLE_CLICK':
          turnEnded = Logic.handleAbilityClick(data.r, data.c, gs);
          break;
        case 'SWITCH_TURN': turnEnded = true; break;
        case 'ASCENSION_CHOICE': turnEnded = Logic.executeAscensionChoice(data.choice, gs); break;
        case 'CANCEL_ASCENSION': Logic.cancelAscensionChoice(gs); break;
        case 'SACRIFICE': if (p && p.team === player.team) turnEnded = Logic.executeSacrifice(p, gs); break;
        case 'RELEASE': if (p && p.team === player.team) turnEnded = Logic.executeRelease(p, gs); break;
        case 'RIFT_PULSE': if (p && p.team === player.team) turnEnded = Logic.executeRiftPulse(p, gs); break;
        case 'DESPAWN': if (p && p.team === player.team) { Logic.despawnPiece(p, gs); turnEnded = true; } break;
        default:
          break;
      }

      if (turnEnded) {
        if (!Logic.checkAscensionReady(gs)) Logic.switchTurn(gs);
      }
    });

    const finalStatus = gs.gameOver ? 'FINISHED' : room.status;
    const nextMoveIndex = (room.moveIndex || 0) + 1;
    const lastAction = {
      type: actionType,
      pieceId: data?.pieceId || null,
      r: data?.r ?? null,
      c: data?.c ?? null,
      isHighway: !!data?.isHighway,
      target: data?.target || null,
      abilityKey: data?.abilityKey ?? null,
      choice: data?.choice ?? null,
      senderId: playerId,
      moveIndex: nextMoveIndex,
      timestamp: Date.now()
    };

    transaction.update(roomRef, {
      gameState: serializeDelta(gs),
      status: finalStatus,
      moveIndex: nextMoveIndex,
      lastAction,
      playerIds: room.playerIds || room.players.map(p => p.id),
      expireAt: getRoomTtl(finalStatus),
      updatedAt: Date.now()
    });
  });
}

// ── Leave Room ────────────────────────────────────────────────────────────────
export async function leaveRoom(roomId, playerId) {
  if (!roomId) return;
  const { doc, runTransaction, db } = await getFirestoreDeps();
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
          playerIds: (room.playerIds || []).filter(id => id !== playerId),
          status: 'DISBANDED',
          disbandReason: 'HOST_LEFT',
          expireAt: getRoomTtl('DISBANDED'),
          updatedAt: Date.now()
        });
        return;
      }

      transaction.update(roomRef, {
        players: updatedPlayers,
        playerIds: (room.playerIds || []).filter(id => id !== playerId),
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
  const { doc, runTransaction, deleteDoc, db } = await getFirestoreDeps();
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  try {
    // Attempt complete deletion from Firestore first so inactive rooms don't accumulate
    if (typeof deleteDoc === 'function') {
      try {
        await deleteDoc(roomRef);
        return;
      } catch (delErr) {
        // Fall back to transactional status update if delete permissions fail
      }
    }

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const room = snap.data();
      if (room.status === 'DISBANDED') return;
      transaction.update(roomRef, {
        status: 'DISBANDED',
        disbandReason: reason,
        players: [],
        playerIds: [],
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
  const { doc, runTransaction, db } = await getFirestoreDeps();
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
          playerIds: room.playerIds || room.players.map(p => p.id),
          updatedAt: now
        });
      }
    });
  } catch (e) {
    // Non-critical background ping
  }
}

// ── Room Recovery Inspector ──────────────────────────────────────────────────
export async function checkRoomStatus(roomId, playerId) {
  if (!roomId) return { exists: false, active: false };
  const { doc, getDoc, db } = await getFirestoreDeps();
  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'rooms', normalizedId);
  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { exists: false, active: false };
    const data = snap.data();
    if (data.status === 'DISBANDED' || data.status === 'FINISHED') {
      return { exists: true, active: false, reason: data.disbandReason || 'FINISHED' };
    }
    const me = (data.players || []).find(p => p.id === playerId);
    const parsedGS = parseAndRehydrateGameState(data.gameState);
    return {
      exists: true,
      active: true,
      room: { ...data, gameState: parsedGS },
      team: me?.team || null,
      status: data.status,
      gameStarted: !!parsedGS?.gameStarted,
      isMember: !!me
    };
  } catch (err) {
    console.warn('Failed to check recoverable room status:', err);
    return { exists: false, active: false };
  }
}

// ── Peer Move Verification (Anti-Cheat) ───────────────────────────────────────
export function validatePeerAction(prevGameState, lastAction, reportedGameState) {
  if (!prevGameState || !lastAction || !reportedGameState) {
    return { valid: true };
  }

  const { type, pieceId, r, c, isHighway, target, abilityKey, senderId } = lastAction;

  // 1. Actions can only happen while match is active
  if (!prevGameState.gameStarted || prevGameState.gameOver) {
    return { valid: false, reason: 'Action dispatched while match was inactive' };
  }

  // 2. Turn validation: acting piece must match current turn in previous state
  const actingTeam = prevGameState.currentTurn;
  const findPiece = (state, id) => state.pieces?.find(p => p.id === id);
  const prevPiece = pieceId ? findPiece(prevGameState, pieceId) : null;

  if (prevPiece && prevPiece.team !== actingTeam) {
    return { valid: false, reason: `Action attempted on unit (${pieceId}) not owned by active team (${actingTeam})` };
  }

  // 3. Movement range and boundary validation
  if (type === 'MOVE') {
    if (!prevPiece) {
      return { valid: false, reason: 'Move targeted non-existent piece' };
    }
    if (!C.inBounds(r, c)) {
      return { valid: false, reason: 'Target coordinates out of arena bounds' };
    }
    const validMoves = E.getValidMoves ? E.getValidMoves(prevPiece, prevGameState) : [];
    const isLegalTarget = validMoves.some(m => {
      const mr = m.row !== undefined ? m.row : m.r;
      const mc = m.col !== undefined ? m.col : m.c;
      return Math.hypot(mr - r, mc - c) < 0.75;
    });
    if (!isLegalTarget) {
      return { valid: false, reason: `Illegal move: (${r}, ${c}) is outside unit's valid movement paths` };
    }
  }

  // 4. Ability readiness validation
  if (type === 'ABILITY') {
    if (prevPiece && (prevPiece.abilityCooldown || 0) > 0) {
      return { valid: false, reason: 'Ability triggered while still on cooldown' };
    }
  }

  // 5. Piece Count Tampering (Opponent cannot arbitrarily eliminate pieces)
  const prevOpponentCount = prevGameState.pieces?.filter(p => p.team !== actingTeam).length || 0;
  const repOpponentCount = reportedGameState.pieces?.filter(p => p.team !== actingTeam).length || 0;

  if (prevOpponentCount - repOpponentCount > 2) {
    return { valid: false, reason: 'Abnormal elimination of multiple units in a single action' };
  }

  return { valid: true };
}
