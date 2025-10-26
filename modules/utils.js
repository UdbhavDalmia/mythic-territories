import * as C from './constants.js';

export function updateBoardMap(gameState) {
    gameState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
    (gameState.pieces || []).forEach(p => {
        if (p?.row >= 0 && p?.row < C.ROWS && p?.col >= 0 && p?.col < C.COLS) {
            gameState.boardMap[p.row][p.col] = p;
        }
    });
}

export function isCaptureSuccessful(attacker, defender, gameState) {
    const attackerPower = getEffectivePower(attacker, gameState, defender);
    const defPower = getEffectivePower(defender, gameState, attacker);

    if (attackerPower > defPower) return true;
    if (attackerPower === defPower) {
        const aTerr = attacker.team === 'snow' ? gameState.snowTerritory.size : gameState.ashTerritory.size;
        const dTerr = defender.team === 'snow' ? gameState.snowTerritory.size : gameState.ashTerritory.size;
        return aTerr > dTerr;
    }
    return false;
}

export function getEffectivePower(piece, gameState, opponent = null) {
    if (!piece || (piece.stuck || 0) > 0 || piece.key === 'snowIceWisp') return 0;

    let base = piece.power || 0;
    base += piece.shrineBoost || 0;

    if (piece.isAnchor) base += C.ABILITY_VALUES.RiftAnchor?.powerBoost || 0;
    if (piece.overloadBoost?.duration > 0) base += piece.overloadBoost.amount || 0;

    const tempBoost = (gameState.temporaryBoosts || []).find(b => b.piece === piece);
    if (tempBoost) base += tempBoost.amount || 0;

    if ((gameState.markedPieces || []).some(m => m.target === piece)) {
        base -= C.ABILITY_VALUES.MarkOfCinder?.powerDebuff || 0;
    }

    const debuff = (gameState.debuffs || []).find(d => d.piece === piece);
    if (debuff) base -= debuff.amount || 0;

    if ((gameState.unstableGrounds || []).some(g => g.row === piece.row && g.col === piece.col && g.creator === opponent)) {
        base -= C.ABILITY_VALUES.UnstableGround?.damage || 0;
    }

    const opponentTeam = piece.team === 'snow' ? 'ash' : 'snow';
    for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
            if (r === 0 && c === 0) continue;
            const adj = C.getPieceAt(piece.row + r, piece.col + c, gameState.boardMap);
            if (adj?.team === opponentTeam && adj.ability?.name === 'Chilling Aura' && adj.ability.active) {
                base -= C.ABILITY_VALUES.ChillingAura?.powerDebuff || 0;
            }
        }
    }

    return Math.max(0, base);
}

export function getValidMoves(piece, gameState) {
    // --- MODIFIED LINE ---
    if (!piece || (piece.stuck || 0) > 0 || piece.isDazed) return [];
    // --- END MODIFICATION ---

    const moves = [];
    const boardMap = gameState.boardMap || [];

    // Conduit/highway moves
    if (gameState.conduitLinkActive && gameState.conduitTeam === piece.team) {
        const anchors = Object.values(gameState.riftAnchors || {});
        const adjacentToAnchor = anchors.find(anchor =>
            anchor && Math.max(Math.abs(piece.row - anchor.row), Math.abs(piece.col - anchor.col)) <= 1
        );

        if (adjacentToAnchor) {
            const otherAnchor = anchors.find(a => a && a !== adjacentToAnchor);
            if (otherAnchor) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const r = otherAnchor.row + dr;
                        const c = otherAnchor.col + dc;
                        if (r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS && !C.getPieceAt(r, c, boardMap)) {
                            moves.push({ row: r, col: c, isHighway: true });
                        }
                    }
                }
            }
        }
    }

    // Normal adjacent moves (including captures)
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = piece.row + dr;
            const c = piece.col + dc;

            if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) continue;

            // Blocked by glacial wall
            if ((gameState.glacialWalls || []).some(w => w.row === r && w.col === c)) continue;

            // Diagonal move should not pass between two walls
            if (dr !== 0 && dc !== 0) {
                const wall1 = (gameState.glacialWalls || []).some(w => w.row === piece.row + dr && w.col === piece.col);
                const wall2 = (gameState.glacialWalls || []).some(w => w.row === piece.row && w.col === piece.col + dc);
                if (wall1 || wall2) continue;
            }

            const defender = C.getPieceAt(r, c, boardMap);
            if (defender) {
                if (defender.team !== piece.team && isCaptureSuccessful(piece, defender, gameState)) {
                    moves.push({ row: r, col: c });
                }
            } else {
                moves.push({ row: r, col: c });
            }
        }
    }

    return moves;
}

export function hasLineOfSight(start, end, gameState) {
    let x0 = start.col;
    let y0 = start.row;
    const x1 = end.col;
    const y1 = end.row;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        if (!(x0 === start.col && y0 === start.row) && !(x0 === x1 && y0 === y1)) {
            if ((gameState.glacialWalls || []).some(w => w.row === y0 && w.col === x0)) return false;
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }

    return true;
}

export function preloadImages(sources, callback) {
    const imgs = {};
    const keys = Object.keys(sources || {});
    let loadedCount = 0;

    if (!keys.length) {
        callback(imgs);
        return;
    }

    keys.forEach(k => {
        const img = new Image();
        img.src = sources[k];
        img.onload = img.onerror = () => {
            imgs[k] = img;
            loadedCount += 1;
            if (loadedCount === keys.length) callback(imgs);
        };
    });
}