import * as Logic from '../shared/logic.js';

const rooms = new Map();
const disconnectTimers = new Map();

export function getRoom(roomId) {
    return rooms.get(roomId);
}

export function joinRoom(roomId, socketId) {
    let room = rooms.get(roomId);

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
            players: [{ id: socketId, team: 'snow' }]
        };
        rooms.set(roomId, room);
        return { success: true, room, team: 'snow', isNew: true, playerCount: 1 };
    } 
    
    if (room.players.length < 2) {
        const hasSnow = room.players.some(p => p.team === 'snow');
        const assignedTeam = hasSnow ? 'ash' : 'snow';
        room.players.push({ id: socketId, team: assignedTeam });
        return { success: true, room, team: assignedTeam, isNew: false, playerCount: room.players.length };
    }
    
    return { success: false, error: 'Room is already full.' };
}

export function removePlayer(socketId) {
    for (const [roomId, room] of rooms.entries()) {
        const idx = room.players.findIndex(p => p.id === socketId);
        if (idx !== -1) {
            const removed = room.players.splice(idx, 1)[0];
            return { roomId, room, removed };
        }
    }
    return null;
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