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
const io = new Server(httpServer);

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
    socket.on('joinRoom', (roomId) => {
        const result = RoomManager.joinRoom(roomId, socket.id);
        if (!result.success) return socket.emit('error', result.error);

        socket.join(roomId);
        const initState = serializeState(result.room.gameState);
        result.room.lastSentState = JSON.parse(JSON.stringify(initState));
        socket.emit('init', {
            state: initState,
            team: result.team,
            playerCount: result.playerCount
        });

        if (!result.isNew) {
            socket.to(roomId).emit('playerJoined', {
                team: result.team,
                playerCount: result.playerCount
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
            const player = room.players.find(p => p.id === socket.id);

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
        const result = RoomManager.removePlayer(socket.id);
        if (result) {
            const { roomId, room, removed } = result;
            if (room.gameState.gameStarted) {
                io.to(roomId).emit('playerLeft', { team: removed.team, playerCount: room.players.length });
                room.gameState.events = [];
                emitStateUpdate(room);
            }
            const timer = setTimeout(() => {
                io.to(roomId).emit('roomClosed', 'Opponent failed to reconnect.');
                RoomManager.deleteRoom(roomId);
            }, 60000);
            RoomManager.setDisconnectTimer(roomId, timer);
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));