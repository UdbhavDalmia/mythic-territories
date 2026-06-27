import * as Logic from '../shared/logic.js';

const rooms = new Map();
const disconnectTimers = new Map();
const playerDisconnectTimers = new Map();

export function getRoom(roomId) {
    return rooms.get(roomId);
}

export function joinRoom(roomId, socketId, playerId) {
    const pId = playerId || socketId;
    let room = rooms.get(roomId);

    // Clear player disconnect timer if reconnecting
    if (playerDisconnectTimers.has(pId)) {
        clearTimeout(playerDisconnectTimers.get(pId));
        playerDisconnectTimers.delete(pId);
    }

    if (disconnectTimers.has(roomId)) {
        clearTimeout(disconnectTimers.get(roomId));
        disconnectTimers.delete(roomId);
    }

    if (!room) {
        const initialState = {};
        Logic.initGameState(initialState);
        Logic.initGame();

        room = {
            id: roomId,
            gameState: Logic.getGameState(),
            players: [{ id: pId, socketId: socketId, team: null }]
        };
        rooms.set(roomId, room);
        return { success: true, room, team: null, isNew: true, playerCount: 1 };
    }

    const existingPlayer = room.players.find(p => p.id === pId);
    if (existingPlayer) {
        existingPlayer.socketId = socketId;
        return { success: true, room, team: existingPlayer.team, isNew: false, playerCount: room.players.length };
    }

    if (room.players.length < 2) {
        room.players.push({ id: pId, socketId: socketId, team: null });
        return { success: true, room, team: null, isNew: false, playerCount: room.players.length };
    }

    return { success: false, error: 'Room is already full.' };
}

export function getPlayerBySocketId(socketId) {
    for (const room of rooms.values()) {
        const p = room.players.find(player => player.socketId === socketId);
        if (p) return { room, player: p };
    }
    return null;
}

export function setPlayerDisconnectTimer(playerId, timer) {
    if (playerDisconnectTimers.has(playerId)) {
        clearTimeout(playerDisconnectTimers.get(playerId));
    }
    playerDisconnectTimers.set(playerId, timer);
}

export function clearPlayerDisconnectTimer(playerId) {
    if (playerDisconnectTimers.has(playerId)) {
        clearTimeout(playerDisconnectTimers.get(playerId));
        playerDisconnectTimers.delete(playerId);
    }
}

export function setDisconnectTimer(roomId, timer) {
    if (disconnectTimers.has(roomId)) {
        clearTimeout(disconnectTimers.get(roomId));
    }
    disconnectTimers.set(roomId, timer);
}

export function deleteRoom(roomId) {
    if (disconnectTimers.has(roomId)) {
        clearTimeout(disconnectTimers.get(roomId));
        disconnectTimers.delete(roomId);
    }
    rooms.delete(roomId);
}