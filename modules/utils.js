import * as C from './constants.js';

const safe = (v, d = 0) => v ?? d;

export function getEffectivePower(piece, gameState, opponent = null, combatRole = null) {
    if (!piece || (piece.stuck || 0) > 0 || piece.key === 'snowIceWisp' || piece.isTrapped) return 0;

    let base = safe(piece.power) + safe(piece.shrineBoost) + safe(piece.anchorBoost);
    base += (piece.overloadBoost?.duration > 0) ? safe(piece.overloadBoost?.amount) : 0;
    if (piece.isConduitTier1) base += C.ANCHOR_AURA_POWER;

    const boosts = (gameState.temporaryBoosts || []).filter(b => b.pieceId === piece.id);
    for (const b of boosts) {
        if (b.name === 'ConduitHighwayBuff') base += C.ANCHOR_AURA_POWER;
        else if ((b.name === 'FrostArmor' || b.name === 'KindleArmor') && combatRole === 'defending') base += safe(b.amount);
        else if (b.name === 'HuntersRage' && combatRole === 'attacking') base += safe(b.amount);
        else base += safe(b.amount);
    }

    if ((gameState.markedPieces || []).some(m => m.targetId === piece.id)) {
        base -= C.ABILITY_VALUES.MarkOfCinder?.powerDebuff || 0;
    }

    for (const d of (gameState.debuffs || []).filter(x => x.pieceId === piece.id)) {
        if (d.amount > 0) base -= safe(d.amount);
    }

    if ((gameState.unstableGrounds || []).some(g => g.row === piece.row && g.col === piece.col && g.creator?.team !== piece.team)) {
        base -= C.ABILITY_VALUES.UnstableGround?.damage || 0;
    }

    if (piece.team !== 'ash' && gameState.factionPassives?.ash?.territory?.ScorchedEarth) {
        if (gameState.ashTerritory.has(`${piece.row},${piece.col}`)) base -= C.TERRITORY_PASSIVES.DEBUFF_AMOUNT;
    }

    const opponentTeam = piece.team === 'snow' ? 'ash' : 'snow';
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
        if (r === 0 && c === 0) continue;
        const adj = C.getPieceAt(piece.row + r, piece.col + c, gameState.boardMap);
        if (adj?.team === opponentTeam && adj.ability?.name === 'Chilling Aura' && adj.ability.active) {
            base -= C.ABILITY_VALUES.ChillingAura?.powerDebuff || 0;
        }
    }

    if (combatRole === 'defending' && gameState.factionPassives[piece.team]?.ascension?.HomeFieldAdvantage) {
        const startLayout = piece.team === 'snow' ? C.SHAPES.bottomLayout : C.SHAPES.topLayout;
        if (startLayout.some(([r, c]) => r === piece.row && c === piece.col)) base += 1;
    }

    if (combatRole === 'attacking' && gameState.factionPassives[piece.team]?.ascension?.TargetedWeakness && opponent?.id) {
        const isDebuffed = (gameState.debuffs || []).some(d => d.pieceId === opponent.id) ||
            (gameState.markedPieces || []).some(m => m.targetId === opponent.id) ||
            (opponent.stuck || 0) > 0 || opponent.isDazed;
        if (isDebuffed) base += C.ANCHOR_AURA_POWER;
    }

    return Math.max(0, base);
}

export function getValidMoves(piece, gameState) {
    if (!piece || (piece.stuck || 0) > 0 || piece.isDazed || piece.isTrapped) return [];
    const moves = [];
    const boardMap = gameState.boardMap || [];
    const debuffs = gameState.debuffs || [];
    const isEdict = debuffs.some(d => d.pieceId === piece.id && d.name === 'Edict');
    const isHamstrung = debuffs.some(d => d.pieceId === piece.id && d.name === 'Hamstrung');
    const isIcyHighways = piece.team === 'snow' && gameState.factionPassives?.snow?.territory?.IcyHighways;
    const isLinkOwned = gameState.conduitLinkActive && gameState.conduitTeam === piece.team && !gameState.conduitIsContested;

    // Conduit highway moves
    if (isLinkOwned) {
        const anchors = Object.values(gameState.riftAnchors || {});
        const adj = anchors.find(a => a && Math.max(Math.abs(piece.row - a.row), Math.abs(piece.col - a.col)) <= 1);
        if (adj) {
            const isDiagonal = Math.abs(piece.row - adj.row) === 1 && Math.abs(piece.col - adj.col) === 1;
            if ((!isEdict && !isHamstrung) || !isDiagonal) {
                const other = anchors.find(a => a && a !== adj);
                if (other) {
                    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        if ((isEdict || isHamstrung) && dr !== 0 && dc !== 0) continue;
                        const r = other.row + dr, c = other.col + dc;
                        if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) continue;
                        const target = C.getPieceAt(r, c, boardMap);
                        if (!target || (target.team !== piece.team && isCaptureSuccessful(piece, target, gameState))) moves.push({ row: r, col: c, isHighway: true });
                    }
                }
            }
        }
    }

    // Regular moves + special moves
    const voids = gameState.voidSquares || [];
    const walls = gameState.glacialWalls || [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        // Icy highways (two-step straight move)
        if (isIcyHighways && !isEdict && !isHamstrung && Math.abs(dr) + Math.abs(dc) === 1) {
            const r1 = piece.row + dr, c1 = piece.col + dc;
            const r2 = r1 + dr, c2 = c1 + dc;
            const pos0 = `${piece.row},${piece.col}`;
            if (r2 >= 0 && r2 < C.ROWS && c2 >= 0 && c2 < C.COLS &&
                gameState.snowTerritory.has(pos0) && gameState.snowTerritory.has(`${r1},${c1}`) && gameState.snowTerritory.has(`${r2},${c2}`) &&
                !C.getPieceAt(r1, c1, boardMap) && !walls.some(w => w.row === r1 && w.col === c1) &&
                !walls.some(w => w.row === r2 && w.col === c2) && !voids.some(v => v.row === r1 && v.col === c1) && !voids.some(v => v.row === r2 && v.col === c2)) {
                const target = C.getPieceAt(r2, c2, boardMap);
                if (!target || (target.team !== piece.team && isCaptureSuccessful(piece, target, gameState))) moves.push({ row: r2, col: c2, isIcyHighway: true, isIcyHighways: true });
            }
        }

        // Acrobat jump
        if (piece.isAcrobat && !isEdict && !isHamstrung && (Math.abs(dr) + Math.abs(dc) === 1 || Math.abs(dr) === Math.abs(dc))) {
            const intR = piece.row + dr, intC = piece.col + dc;
            const jumpR = piece.row + dr * 2, jumpC = piece.col + dc * 2;
            if (jumpR >= 0 && jumpR < C.ROWS && jumpC >= 0 && jumpC < C.COLS) {
                const intPiece = C.getPieceAt(intR, intC, boardMap);
                if (intPiece && intPiece.team === piece.team && !walls.some(w => w.row === intR && w.col === intC) && !walls.some(w => w.row === jumpR && w.col === jumpC) && !voids.some(v => v.row === jumpR && v.col === jumpC)) {
                    const target = C.getPieceAt(jumpR, jumpC, boardMap);
                    if (!target || (target.team !== piece.team && isCaptureSuccessful(piece, target, gameState))) moves.push({ row: jumpR, col: jumpC, isAcrobatJump: true });
                }
            }
        }

        if ((isEdict || isHamstrung) && dr !== 0 && dc !== 0) continue;
        const r = piece.row + dr, c = piece.col + dc;
        if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) continue;
        if (walls.some(w => w.row === r && w.col === c)) continue;
        if (voids.some(v => v.row === r && v.col === c)) continue;
        if (dr !== 0 && dc !== 0) {
            const wall1 = walls.some(w => w.row === piece.row + dr && w.col === piece.col);
            const wall2 = walls.some(w => w.row === piece.row && w.col === piece.col + dc);
            if (wall1 || wall2) continue;
        }
        const defender = C.getPieceAt(r, c, boardMap);
        if (defender) {
            if (defender.team !== piece.team && isCaptureSuccessful(piece, defender, gameState)) moves.push({ row: r, col: c });
        } else moves.push({ row: r, col: c });
    }
    return moves;
}

export function updateBoardMap(gameState) {
    gameState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
    for (const p of (gameState.pieces || [])) {
        if (p?.row >= 0 && p?.row < C.ROWS && p?.col >= 0 && p?.col < C.COLS) gameState.boardMap[p.row][p.col] = p;
    }
}

export function hasLineOfSight(start, end, gameState) {
    let x0 = start.col, y0 = start.row;
    const x1 = end.col, y1 = end.row;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        if (!(x0 === start.col && y0 === start.row) && !(x0 === x1 && y0 === y1)) {
            if ((gameState.glacialWalls || []).some(w => w.row === y0 && w.col === x0)) return false;
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return true;
}

export function isCaptureSuccessful(attacker, defender, gameState) {
    const attackerPower = getEffectivePower(attacker, gameState, defender, 'attacking');
    let defPower = getEffectivePower(defender, gameState, attacker, 'defending');
    const aegis = (gameState.temporaryBoosts || []).find(b => b.pieceId === defender.id && b.name === 'AegisDefense');
    if (aegis) defPower += safe(aegis.amount);

    const attackerEntrenched = attacker.isEntrenched && attacker.team === gameState.currentTurn;
    const defenderEntrenched = defender.isEntrenched && defender.team !== gameState.currentTurn;

    if (attackerPower > defPower) return true;
    if (attackerPower === defPower) {
        if (attackerEntrenched) return true;
        if (defenderEntrenched) return false;
        const aTerr = attacker.team === 'snow' ? gameState.snowTerritory.size : gameState.ashTerritory.size;
        const dTerr = defender.team === 'snow' ? gameState.snowTerritory.size : gameState.ashTerritory.size;
        return aTerr > dTerr;
    }
    return false;
}

export function preloadImages(sources, callback) {
    const imgs = {};
    const keys = Object.keys(sources || {});
    if (!keys.length) { callback(imgs); return; }
    let loaded = 0;
    for (const k of keys) {
        const img = new Image();
        img.src = sources[k];
        img.onload = img.onerror = () => {
            imgs[k] = img;
            loaded += 1;
            if (loaded === keys.length) callback(imgs);
        };
    }
}