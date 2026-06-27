import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Logic from '../shared/logic.js';
import * as C from '../shared/constants.js';
import * as RoomManager from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const serializeState = (gs) => ({
    ...gs,
    snowTerritory: Array.from(gs.snowTerritory || []),
    ashTerritory: Array.from(gs.ashTerritory || [])
});

function computeDiff(oldS, newS) {
    const diff = {};
    for (const k of Object.keys(newS)) {
        const a = oldS ? oldS[k] : undefined;
        const b = newS[k];
        try {
            if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = b;
        } catch (e) {
            diff[k] = b;
        }
    }
    return diff;
}

function emitStateUpdate(room) {
    const newS = serializeState(room.gameState);
    const oldS = room.lastSentState || null;
    const events = room.gameState.events || [];

    if (!oldS) {
        io.to(room.id).emit('stateUpdate', { state: newS, events });
    } else {
        const diff = computeDiff(oldS, newS);
        if (Object.keys(diff).length === 0) {
            io.to(room.id).emit('stateUpdate', { diff: {}, events });
        } else {
            io.to(room.id).emit('stateUpdate', { diff, events });
        }
    }

    // CRITICAL FIX: Deep clone prevents state mutation from destroying the diff checking
    room.lastSentState = JSON.parse(JSON.stringify(newS));
}

app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

io.on('connection', (socket) => {
    socket.on('joinRoom', (data) => {
        let roomId = data;
        let playerId = null;
        if (data && typeof data === 'object') {
            roomId = data.roomId;
            playerId = data.playerId;
        }
        const result = RoomManager.joinRoom(roomId, socket.id, playerId);
        if (!result.success) return socket.emit('error', result.error);

        socket.join(roomId);
        const initState = serializeState(result.room.gameState);
        result.room.lastSentState = JSON.parse(JSON.stringify(initState));
        socket.emit('init', {
            state: initState,
            team: result.team,
            playerCount: result.playerCount,
            players: result.room.players
        });

        if (!result.isNew) {
            socket.to(roomId).emit('playerJoined', {
                team: result.team,
                playerCount: result.playerCount,
                players: result.room.players
            });
        }
    });

    socket.on('selectFaction', ({ roomId, faction }) => {
        const room = RoomManager.getRoom(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (faction !== 'snow' && faction !== 'ash') {
            return socket.emit('error', 'Invalid faction selection.');
        }

        const isOccupied = room.players.some(p => p.socketId !== socket.id && p.team === faction);
        if (isOccupied) {
            return socket.emit('error', `Faction ${faction.toUpperCase()} is already occupied.`);
        }

        player.team = faction;

        // Send back team confirmation to this player
        socket.emit('teamAssigned', faction);

        // Notify room about player list update
        io.to(roomId).emit('roomUpdate', { players: room.players });

        // If both players selected different teams, automatically start the game
        const hasSnow = room.players.some(p => p.team === 'snow');
        const hasAsh = room.players.some(p => p.team === 'ash');
        if (room.players.length === 2 && hasSnow && hasAsh) {
            Logic.withGameState(room.gameState, () => {
                const gs = room.gameState;
                if (!gs.gameStarted) {
                    Logic.initGame();
                    gs.gameStarted = true;
                }
                room.lastSentState = null;
                emitStateUpdate(room);
            });
        }
    });

    socket.on('gameAction', ({ roomId, actionType, data }) => {
        const room = RoomManager.getRoom(roomId);
        if (!room) return;

        if (actionType === 'START_GAME' && room.players.length < 2) {
            return socket.emit('error', 'Waiting for an opponent to join...');
        }

        Logic.withGameState(room.gameState, () => {
            const gs = room.gameState;
            const player = room.players.find(p => p.socketId === socket.id);

            const coordsOk = (obj) => {
                if (!obj || typeof obj !== 'object') return false;
                const r = parseInt(obj.r);
                const c = parseInt(obj.c);
                if (isNaN(r) || isNaN(c)) return false;
                return C.inBounds(r, c);
            };

            if (actionType === 'START_GAME') {
                if (player?.team === 'snow') {
                    // CRITICAL FIX: Only initialize a fresh board if the game hasn't started yet!
                    if (!gs.gameStarted) {
                        Logic.initGame();
                        gs.gameStarted = true;
                    }
                    room.lastSentState = null;
                    emitStateUpdate(room);
                }
                return;
            }

            if (actionType === 'SYNC_TIMERS') {
                if (data.timers) gs.timers = data.timers;
                gs.events = []
                emitStateUpdate(room);
                return;
            }

            if (actionType === 'RESET_GAME') {
                Logic.resetGame();
                room.lastSentState = null;
                emitStateUpdate(room);
                return;
            }

            if (actionType === 'TOGGLE_TEST_MODE') {
                gs.testMode = data.enabled;
                if (gs.testMode) {
                    if (!gs.originalPieces) {
                        gs.originalPieces = JSON.parse(JSON.stringify(gs.pieces));
                    }
                    gs.pieces = gs.pieces.filter(p => p.key === 'snowFrostLord' || p.key === 'ashAshTyrant' || p.key === 'ashMagmaShaper');
                } else {
                    if (gs.originalPieces) {
                        gs.pieces = JSON.parse(JSON.stringify(gs.originalPieces));
                        delete gs.originalPieces;
                    }
                }
                room.lastSentState = null;
                emitStateUpdate(room);
                return;
            }

            if (!player || gs.currentTurn !== player.team) return;

            if (!gs.gameStarted) {
                return socket.emit('error', 'Game has not started yet.');
            }

            // FIX: Replace silent returns with explicit error emissions
            if (actionType === 'MOVE' && !coordsOk({ r: data.r, c: data.c })) return socket.emit('error', 'Invalid move coordinates');
            if (actionType === 'HANDLE_CLICK' && !coordsOk({ r: data.r, c: data.c })) return socket.emit('error', 'Invalid target coordinates');
            if (actionType === 'ABILITY' && data.target && !coordsOk(data.target)) return socket.emit('error', 'Invalid ability target');

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

                // CRITICAL FIX: Added missing START_TETHER and secured VENT_OVERLOAD
                case 'VENT_OVERLOAD':
                    if (p && p.team === player.team) turnEnded = Logic.ventOverload(p);
                    break;
                case 'START_TETHER':
                    if (p && p.team === player.team) {
                        gs.abilityContext = { piece: p, siphoner: p, mode: data.mode, abilityKey: 'Tether' };
                        Logic.setCurrentState(Logic.GameState.TETHER_TARGETING);
                        Logic.emit(gs, { type: 'FLASH', message: `Select target for ${data.mode}`, team: p.team });
                    }
                    break;

                case 'SACRIFICE': if (p && p.team === player.team) turnEnded = Logic.executeSacrifice(p); break;
                case 'RELEASE': if (p && p.team === player.team) turnEnded = Logic.executeRelease(p); break;
                case 'RIFT_PULSE': if (p && p.team === player.team) turnEnded = Logic.executeRiftPulse(p); break;
                case 'DESPAWN': if (p && p.team === player.team) { Logic.despawnPiece(p); turnEnded = true; } break;
                case 'TIMEOUT':
                    Logic.endGame(data.team === 'snow' ? 'ash' : 'snow');
                    break;
            }

            if (turnEnded) {
                if (!Logic.checkAscensionReady()) Logic.switchTurn();
            }

            emitStateUpdate(room);
        });
    });

    socket.on('disconnect', () => {
        const result = RoomManager.getPlayerBySocketId(socket.id);
        if (result) {
            const { room, player } = result;
            const roomId = room.id;
            const playerId = player.id;
            const removedTeam = player.team;

            // Set a 4-second timeout to remove player
            const timer = setTimeout(() => {
                const r = RoomManager.getRoom(roomId);
                if (r) {
                    const idx = r.players.findIndex(p => p.id === playerId);
                    if (idx !== -1) {
                        r.players.splice(idx, 1);
                        if (r.gameState.gameStarted) {
                            io.to(roomId).emit('playerLeft', { team: removedTeam, playerCount: r.players.length });
                            r.gameState.events = [];
                            emitStateUpdate(r);
                        } else {
                            io.to(roomId).emit('roomUpdate', { players: r.players });
                            io.to(roomId).emit('playerLeft', { team: removedTeam, playerCount: r.players.length });
                        }

                        // If room is empty, delete it after 60s
                        if (r.players.length === 0) {
                            const roomTimer = setTimeout(() => {
                                io.to(roomId).emit('roomClosed', 'Opponent failed to reconnect.');
                                RoomManager.deleteRoom(roomId);
                            }, 60000);
                            RoomManager.setDisconnectTimer(roomId, roomTimer);
                        }
                    }
                }
                RoomManager.clearPlayerDisconnectTimer(playerId);
            }, 4000);

            RoomManager.setPlayerDisconnectTimer(playerId, timer);
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));