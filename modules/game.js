import * as C from './constants.js';
import { updateBoardMap, isCaptureSuccessful, getValidMoves } from './utils.js';
import {
    showFlashMessage,
    renderBoard,
    drawLabels,
    updateTotalTurnsCounter,
    showVictoryScreen,
    resetTimers,
    hideAbilityPanel,
    showAbilityPanel,
    updateMessageLog
} from './ui.js';
import {
    initParticles,
    spawnBattleParticles,
    updateShrineParticles,
    triggerShrineOverloadEffects,
    spawnSiphonParticles,
    spawnWhiteoutParticles,
    spawnMarkHitParticles,
    spawnRiftAssaultEffect
} from './effects.js';

let gameState = {};
export const getGameState = () => gameState;

export const GameState = {
    AWAITING_PIECE_SELECTION: 'AWAITING_PIECE_SELECTION',
    PIECE_SELECTED: 'PIECE_SELECTED',
    ABILITY_TARGETING: 'ABILITY_TARGETING',
    WALL_PLACEMENT_FIRST: 'WALL_PLACEMENT_FIRST',
    WALL_PLACEMENT_SECOND: 'WALL_PLACEMENT_SECOND',
    GAME_OVER: 'GAME_OVER'
};

let currentState = GameState.AWAITING_PIECE_SELECTION;
export const getCurrentState = () => currentState;
export const setCurrentState = s => { currentState = s; };
export const isState = s => currentState === s;

export function initGameState(initialState) {
    gameState = initialState;
}

export function createPiece(r, c, key, team) {
    const properties = C.PIECE_TYPES[key] || {};
    let ability;
    if (properties.ability?.name) {
        const abilityKey = properties.ability.name;
        if (abilityKey === 'Siphon') {
            ability = { ...properties.ability, key: abilityKey, cooldown: 0 };
        } else {
            const baseAbility = C.ABILITIES[abilityKey] || {};
            ability = { ...properties.ability, ...baseAbility, key: abilityKey, cooldown: 0 };
        }
    }

    const piece = {
        row: r,
        col: c,
        key,
        team,
        power: properties.power,
        boosts: properties.boosts || {},
        ability,
        shrineBoost: 0,
        isPhasing: false
    };

    if (key.includes('Chanter') || key.includes('Warden')) piece.charges = 0;
    return piece;
}

export function initGame() {
    if (typeof console.clear === 'function') console.clear();
    console.log('--- NEW GAME STARTED ---');

    gameState.playerTeam = gameState.playerTeam || 'snow';
    gameState.opponentTeam = gameState.opponentTeam || 'ash';
    gameState.pieces = [];
    gameState.snowTerritory.clear();
    gameState.ashTerritory.clear();
    gameState.shrineChargeLevel = 0;
    gameState.shrineIsOverloaded = false;
    gameState.shrineParticles = [];
    gameState.infusionTarget = null;
    gameState.riftPhaseNotified = { strong: false, chaotic: false };
    gameState.messageHistory = [];
    gameState.territoryCaptureTurn = {};
    gameState.glacialWalls = [];
    gameState.markedPieces = [];
    gameState.unstableGrounds = [];
    gameState.selectedPiece = null;
    gameState.currentTurn = 'snow';
    gameState.turnCount = 0;
    gameState.gameOver = false;
    gameState.temporaryBoosts = [];
    gameState.debuffs = [];
    gameState.abilityContext = null;
    gameState.conduitLinkActive = false;
    gameState.projectiles = [];
    gameState.flashEffects = [];
    gameState.conduitTeam = null;
    gameState.riftAnchors = { topLeft: null, bottomRight: null };

    gameState.siphonParticles = [];
    gameState.groundEffectParticles = [];
    gameState.conduitParticles = [];

    gameState.whiteoutParticles = [];
    gameState.riftAssaultAnimations = [];
    gameState.markOfCinderSparks = [];
    gameState.shrineArcs = [];
    gameState.shrineArcs = [];

    C.SHAPES.riftAreas.forEach(rift => { rift.dormantFor = 0; });
    setCurrentState(GameState.AWAITING_PIECE_SELECTION);

    const snowSetup = gameState.playerTeam === 'snow' ? C.SHAPES.bottomLayout : C.SHAPES.topLayout;
    const ashSetup = gameState.playerTeam === 'ash' ? C.SHAPES.bottomLayout : C.SHAPES.topLayout;

    snowSetup.forEach(([r, c, pieceType]) =>
        gameState.pieces.push(createPiece(r, c, C.TEAM_PIECES.snow[pieceType], 'snow'))
    );
    ashSetup.forEach(([r, c, pieceType]) =>
        gameState.pieces.push(createPiece(r, c, C.TEAM_PIECES.ash[pieceType], 'ash'))
    );

    gameState.pieces.forEach(p => (p.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory).add(`${p.row},${p.col}`));

    initParticles(gameState);
    updateBoardMap(gameState);
    renderBoard(gameState);
    drawLabels(gameState);
    updateTotalTurnsCounter(gameState);
    updateMessageLog(gameState);
}

export function selectPiece(piece) {
    if (piece.team !== gameState.currentTurn) return;
    gameState.selectedPiece = piece;
    setCurrentState(GameState.PIECE_SELECTED);
    showAbilityPanel(piece, gameState);
}

export function deselectPiece() {
    if (gameState.selectedPiece) hideAbilityPanel();
    gameState.selectedPiece = null;
    gameState.abilityContext = null;
    setCurrentState(GameState.AWAITING_PIECE_SELECTION);
}

export function despawnPiece(piece) {
    if (!piece || piece.key !== 'snowIceWisp') return;
    gameState.pieces = gameState.pieces.filter(p => p !== piece);
    showFlashMessage('The Ice Wisp dissipates.', 'snow', gameState);
    deselectPiece();
    updateBoardMap(gameState);
}

export function updatePiecePosition(piece, row, col) {
    if (gameState.glacialWalls.some(w => w.row === row && w.col === col)) return;
    const territory = piece.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
    const opponentTerritory = piece.team === 'snow' ? gameState.ashTerritory : gameState.snowTerritory;

    piece.row = row;
    piece.col = col;

    const newPos = `${row},${col}`;
    territory.add(newPos);
    opponentTerritory.delete(newPos);
    gameState.territoryCaptureTurn[newPos] = gameState.turnCount;

    const unstable = gameState.unstableGrounds.find(g => g.row === row && g.col === col);
    if (unstable) {
        piece.power = Math.max(0, piece.power - C.ABILITY_VALUES.UnstableGround.damage);
        showFlashMessage(`${C.PIECE_TYPES[piece.key].name} takes permanent damage from hazardous ground!`, piece.team, gameState);
    }
}

function applyTerritorySurge(piece) {
    const territorySet = piece.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
    const emptyCells = [];

    for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
            if (!C.getPieceAt(r, c, gameState.boardMap)) emptyCells.push([r, c]);
        }
    }

    for (let i = 0; i < 2 && emptyCells.length > 0; i++) {
        const [r, c] = emptyCells.splice(Math.floor(Math.random() * emptyCells.length), 1)[0];
        territorySet.add(`${r},${c}`);
        gameState.flashEffects.push({
            r, c, life: 1.0,
            color: piece.team === 'snow' ? '100, 150, 255' : '255, 100, 80'
        });
    }
    showFlashMessage('A Territory Surge erupts!', piece.team, gameState);
}

function handleShrineCapture(piece, defender) {
    if (defender.key === 'snowIceWisp') return;

    if (piece.shrineBoost === 0) {
        piece.shrineBoost = C.ABILITY_VALUES.Shrine.powerBoost;
        showFlashMessage(`${C.PIECE_TYPES[piece.key].name} gains a permanent +${C.ABILITY_VALUES.Shrine.powerBoost} boost!`, piece.team, gameState);
    }

    if (!gameState.shrineIsOverloaded) {
        gameState.shrineChargeLevel++;
        updateShrineParticles(gameState.shrineChargeLevel, gameState);
        if (gameState.shrineChargeLevel >= C.ABILITY_VALUES.Shrine.overloadCharges) {
            gameState.shrineIsOverloaded = true;
            triggerShrineOverloadEffects(gameState);
            showFlashMessage('The Shrine is Overloaded!', 'neutral', gameState);
        }
    }
}

function triggerOverload(triggeringPiece, targetRow, targetCol) {
    updatePiecePosition(triggeringPiece, targetRow, targetCol);
    showFlashMessage(`The Shrine erupts, vaporizing the ${C.PIECE_TYPES[triggeringPiece.key].name}!`, 'neutral', gameState);

    gameState.pieces = gameState.pieces.filter(p => p !== triggeringPiece);

    if (triggeringPiece.key.includes('Tyrant') || triggeringPiece.key.includes('Lord')) {
        endGame(triggeringPiece.team === 'snow' ? 'ash' : 'snow');
        return;
    }

    triggerShrineOverloadEffects(gameState, true);
    gameState.shockwaves.push({
        x: 5 * C.CELL_SIZE,
        y: 5 * C.CELL_SIZE,
        radius: C.CELL_SIZE,
        life: 1.0,
        color: '255, 0, 0'
    });

    const adjacentZone = new Set();
    const shrineZone = new Set(C.SHAPES.shrineArea.map(s => `${s[0]},${s[1]}`));
    C.SHAPES.shrineArea.forEach(([sr, sc]) => {
        for (let r = sr - 1; r <= sr + 1; r++) {
            for (let c = sc - 1; c <= sc + 1; c++) {
                if (r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS && !shrineZone.has(`${r},${c}`)) {
                    adjacentZone.add(`${r},${c}`);
                }
            }
        }
    });

    const piecesInZone = gameState.pieces.filter(p => adjacentZone.has(`${p.row},${p.col}`));
    if (piecesInZone.length > 0) showFlashMessage('Adjacent pieces are dazed and thrown back!', 'neutral', gameState);

    const shrineCenterR = 4.5, shrineCenterC = 4.5;
    piecesInZone.forEach(p => {
        p.dazedFor = 2;
        p.isDazed = true;

        const dr = Math.sign(p.row - shrineCenterR);
        const dc = Math.sign(p.col - shrineCenterC);

        const newRow = p.row + dr;
        const newCol = p.col + dc;

        if (newRow >= 0 && newRow < C.ROWS && newCol >= 0 && newCol < C.COLS &&
            !C.getPieceAt(newRow, newCol, gameState.boardMap) &&
            !gameState.glacialWalls.some(w => w.row === newRow && w.col === newCol)
        ) {
            updatePiecePosition(p, newRow, newCol);
        }
    });

    gameState.shrineChargeLevel = 0;
    gameState.shrineIsOverloaded = false;
    gameState.shrineParticles = [];
    gameState.shrineArcs = [];
}

function updateConduitLink() {
    const anchors = { topLeft: null, bottomRight: null };
    for (const piece of gameState.pieces) {
        for (const rift of C.SHAPES.riftAreas) {
            if (rift.cells.some(([r, c]) => r === piece.row && c === piece.col)) anchors[rift.id] = piece;
        }
    }

    const wasActive = gameState.conduitLinkActive;
    gameState.conduitLinkActive = anchors.topLeft && anchors.bottomRight && anchors.topLeft.team === anchors.bottomRight.team;

    if (gameState.conduitLinkActive) {
        if (!wasActive) showFlashMessage('A Conduit Link has been forged!', anchors.topLeft.team, gameState);
        gameState.conduitTeam = anchors.topLeft.team;
        gameState.riftAnchors = anchors;
        Object.values(anchors).forEach(p => {
            p.isAnchor = true;
            p.hasDefensiveWard = p === anchors.topLeft;
            p.canRiftPulse = p === anchors.bottomRight;
        });
    } else if (wasActive) {
        showFlashMessage('The Conduit Link has been broken!', gameState.conduitTeam, gameState);
        gameState.conduitTeam = null;
        gameState.riftAnchors = { topLeft: null, bottomRight: null };
        gameState.pieces.forEach(p => {
            p.isAnchor = false;
            p.hasDefensiveWard = false;
            p.canRiftPulse = false;
        });
    }
}

export function movePiece(piece, targetRow, targetCol, isHighwayMove = false) {
    // --- MODIFIED LINE ---
    if (gameState.gameOver || !piece || piece.isDazed || (piece.stuck || 0) > 0 || piece.team !== gameState.currentTurn) return false;
    // --- END MODIFICATION ---
    const validMoves = getValidMoves(piece, gameState);
    const move = validMoves.find(m => m.row === targetRow && m.col === targetCol);
    if (!move && !isHighwayMove) return false;

    const fromRow = piece.row, fromCol = piece.col;
    const actionTaken = () => {
        gameState.lastMoveIndicator = { row: fromRow, col: fromCol, life: 1.0 };
        deselectPiece();
        updateBoardMap(gameState);
        updateConduitLink();
    };

    if (isHighwayMove) {
        showFlashMessage(`The ${C.PIECE_TYPES[piece.key].name} travels the Conduit Highway!`, piece.team, gameState);
        updatePiecePosition(piece, targetRow, targetCol);
        actionTaken();
        return true;
    }

    const isMovingToShrine = C.SHAPES.shrineArea.some(([r, c]) => r === targetRow && c === targetCol);
    if (gameState.shrineIsOverloaded && isMovingToShrine) {
        triggerOverload(piece, targetRow, targetCol);
        updateBoardMap(gameState);
        deselectPiece();
        return true;
    }

    const defender = C.getPieceAt(targetRow, targetCol, gameState.boardMap);
    if (defender) {
        if (isCaptureSuccessful(piece, defender, gameState)) {
            showFlashMessage(`The ${C.PIECE_TYPES[piece.key].name} has vanquished the ${C.PIECE_TYPES[defender.key].name}!`, piece.team, gameState);
            gameState.pieces = gameState.pieces.filter(p => p !== defender);
            spawnBattleParticles(piece, defender, gameState);

            if (defender.key.includes('Tyrant') || defender.key.includes('Lord')) {
                endGame(piece.team);
                return true;
            }

            if (isMovingToShrine) handleShrineCapture(piece, defender);
            updatePiecePosition(piece, targetRow, targetCol);

            if (piece.boosts.territorySurge) applyTerritorySurge(piece);
        } else {
            showFlashMessage(`The ${C.PIECE_TYPES[defender.key].name} holds its ground!`, piece.team, gameState);
            return false;
        }
    } else {
        updatePiecePosition(piece, targetRow, targetCol);
    }

    actionTaken();
    return true;
}

function startOfTurnUpkeep(team) {
    gameState.pieces.forEach(p => {
        if (p.team === team) {
            p.isDazed = p.dazedFor > 0;
        }
    });
}

function endOfTurnUpkeep() {
    gameState.pieces.forEach(p => {
        if (p.stuck > 0) p.stuck--;
        if (p.overloadBoost?.duration > 0) p.overloadBoost.duration--;

        if (p.team === gameState.currentTurn) {
            if (p.dazedFor > 0) p.dazedFor--;
            p.isDazed = p.dazedFor > 0;
        }
    });
}

function updateRoundBasedAbilities() {
    gameState.temporaryBoosts = gameState.temporaryBoosts.filter(b => --b.duration > 0);
    gameState.debuffs = gameState.debuffs.filter(d => --d.duration > 0);

    gameState.pieces.forEach(p => {
        if (p.ability?.cooldown > 0) p.ability.cooldown--;
        if (p.ability?.active && --p.ability.duration <= 0) p.ability.active = false;
    });

    gameState.unstableGrounds = gameState.unstableGrounds.filter(g => --g.duration > 0);
    gameState.glacialWalls = gameState.glacialWalls.filter(w => --w.duration > 0);
    gameState.markedPieces = gameState.markedPieces.filter(m => --m.duration > 0);
}

export function switchTurn() {
    endOfTurnUpkeep();

    if (gameState.currentTurn === 'ash') {
        gameState.turnCount++;
        updateTotalTurnsCounter(gameState);
        updateRoundBasedAbilities();
    }

    const nextTurn = gameState.currentTurn === 'snow' ? 'ash' : 'snow';
    startOfTurnUpkeep(nextTurn);
    gameState.currentTurn = nextTurn;

    drawLabels(gameState);
}

export function endGame(winningTeam) {
    gameState.gameOver = true;
    setCurrentState(GameState.GAME_OVER);
    showVictoryScreen(winningTeam);
    resetTimers(gameState);
}

export function resetGame() {
    initGame();
    resetTimers(gameState);
    hideAbilityPanel();
}

export function handleSiphon(piece) {
    if (!piece || piece.charges >= piece.ability.maxCharges) return false;

    const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
    const isOnActiveRift = !!rift;
    const isOnShrine = C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col);

    if (isOnActiveRift || isOnShrine) {
        piece.charges++;
        spawnSiphonParticles(piece, isOnActiveRift ? 'rift' : 'shrine', gameState);
        showFlashMessage(`${C.PIECE_TYPES[piece.key].name} siphons 1 charge.`, piece.team, gameState);
        deselectPiece();
        return true;
    }

    showFlashMessage('There is no energy here to Siphon.', piece.team, gameState);
    deselectPiece();
    return false;
}

function isTargetValid(piece, target, ability, gameStateLocal) {
    if (!target) return true;
    const { r, c } = target;
    const targetPiece = C.getPieceAt(r, c, gameStateLocal.boardMap);
    const distance = Math.max(Math.abs(piece.row - r), Math.abs(piece.col - c));
    if (ability.range > 0 && distance > ability.range) return false;
    if (targetPiece?.hasDefensiveWard && ability.canBeBlocked) return false;

    switch (ability.targetType) {
        case 'enemy': return targetPiece && targetPiece.team !== piece.team;
        case 'friendly': return targetPiece && targetPiece.team === piece.team;
        case 'empty': return !targetPiece;
        case 'any': return true;
        case 'special': return ability.specialTargeting(piece, target, gameStateLocal);
        default: return false;
    }
}

export function executeAbility(piece, target, abilityKey, gameStateLocal, isAiTurn = false) {
    const ability = C.ABILITIES[abilityKey];
    if (ability.requiresTargeting && !isTargetValid(piece, target, ability, gameStateLocal)) {
        if (!isAiTurn) {
            showFlashMessage('Invalid target.', piece.team, gameStateLocal);
            deselectPiece();
        }
        return false;
    }

    if (abilityKey === 'LavaGlob' || abilityKey === 'MarkOfCinder') {
        const targetPiece = C.getPieceAt(target.r, target.c, gameStateLocal.boardMap);
        if (targetPiece) {
            const projBase = {
                x: piece.col * C.CELL_SIZE + C.CELL_SIZE / 2,
                y: piece.row * C.CELL_SIZE + C.CELL_SIZE / 2,
                target: targetPiece,
                targetRow: target.r,
                targetCol: target.c
            };

            if (abilityKey === 'LavaGlob') {
                gameStateLocal.projectiles.push({
                    ...projBase,
                    speed: 10, size: 10, color: 'orangered',
                    onHit: hitTarget => {
                        ability.effect(piece, target, gameStateLocal, createPiece);
                        for (let i = 0; i < 20; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = Math.random() * 3 + 1;
                            gameStateLocal.battleParticles.push({
                                x: hitTarget.col * C.CELL_SIZE + C.CELL_SIZE / 2,
                                y: hitTarget.row * C.CELL_SIZE + C.CELL_SIZE / 2,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                alpha: 1,
                                radius: Math.random() * 3 + 1,
                                color: '255, 69, 0'
                            });
                        }
                    }
                });
            } else {
                gameStateLocal.projectiles.push({
                    ...projBase,
                    speed: 12, size: 6, color: '255, 100, 0',
                    onHit: hitTarget => {
                        ability.effect(piece, target, gameStateLocal, createPiece);
                        spawnMarkHitParticles(hitTarget, gameStateLocal);
                    }
                });
            }
        }
    } else if (abilityKey === 'RiftAssault') {
        const oldRow = piece.row, oldCol = piece.col;
        piece.isPhasing = true;
        ability.effect(piece, target, gameStateLocal, createPiece);
        spawnRiftAssaultEffect(piece, oldRow, oldCol, target.r, target.c, gameStateLocal);
    } else {
        ability.effect(piece, target, gameStateLocal, createPiece);
        if (abilityKey === 'Whiteout') spawnWhiteoutParticles(piece, gameStateLocal);
    }

    if (piece.ability?.key === abilityKey) {
        piece.ability.cooldown = ability.cooldown || 0;
    } else if (typeof ability.cost === 'number') {
        piece.charges = Math.max(0, (piece.charges || 0) - ability.cost);
    }

    showFlashMessage(`${C.PIECE_TYPES[piece.key].name} uses ${ability.name}!`, piece.team, gameStateLocal);
    if (!isAiTurn) deselectPiece();
    updateBoardMap(gameStateLocal);
    return true;
}

function prepareAbility(piece, abilityKey, gameStateLocal) {
    const ability = C.ABILITIES[abilityKey];
    if (ability.requiresTargeting) {
        gameStateLocal.abilityContext = { piece, abilityKey };
        setCurrentState(GameState.ABILITY_TARGETING);
        showFlashMessage(`Select a target for ${ability.name}.`, piece.team, gameStateLocal);
    } else {
        executeAbility(piece, null, abilityKey, gameStateLocal);
    }
}

export function activateAbility(piece, unleashCostOrKey = 0) {
    if (!piece) return false;
    let abilityKeyToUse;

    if (typeof unleashCostOrKey === 'string') {
        abilityKeyToUse = unleashCostOrKey;
        const cost = C.ABILITIES[abilityKeyToUse]?.cost || 0;
        if ((piece.charges || 0) < cost) return false;
    } else if (piece.ability && piece.ability.key && piece.ability.cooldown <= 0) {
        abilityKeyToUse = piece.ability.key;
    } else {
        return false;
    }

    if (abilityKeyToUse) {
        hideAbilityPanel();
        if (abilityKeyToUse === 'GlacialWall') {
            setCurrentState(GameState.WALL_PLACEMENT_FIRST);
            gameState.abilityContext = { piece, abilityKey: 'GlacialWall' };
            showFlashMessage('Select a location for the first wall.', piece.team, gameState);
        } else {
            prepareAbility(piece, abilityKeyToUse, gameState);
        }
        return !C.ABILITIES[abilityKeyToUse].requiresTargeting;
    }
    return false;
}

function handleGlacialWall(row, col) {
    const piece = gameState.selectedPiece;
    const targetPiece = C.getPieceAt(row, col, gameState.boardMap);

    if (isState(GameState.WALL_PLACEMENT_FIRST)) {
        if (!targetPiece && Math.abs(piece.row - row) <= 1 && Math.abs(piece.col - col) <= 1 && !(piece.row === row && piece.col === col)) {
            gameState.firstWallCoords = { row, col };
            setCurrentState(GameState.WALL_PLACEMENT_SECOND);
            showFlashMessage('Select an adjacent location for the second wall.', piece.team, gameState);
        } else {
            showFlashMessage('Invalid wall location.', piece.team, gameState);
            deselectPiece();
        }
        return false;
    }

    const { firstWallCoords } = gameState;
    if (!targetPiece && Math.abs(firstWallCoords.row - row) <= 1 && Math.abs(firstWallCoords.col - col) <= 1) {
        gameState.glacialWalls.push({ row: firstWallCoords.row, col: firstWallCoords.col, duration: C.ABILITY_VALUES.GlacialWall.duration });
        gameState.glacialWalls.push({ row, col, duration: C.ABILITY_VALUES.GlacialWall.duration });
        piece.ability.cooldown = C.ABILITIES.GlacialWall.cooldown;
        showFlashMessage(`${C.PIECE_TYPES[piece.key].name} creates Glacial Walls!`, piece.team, gameState);
    } else {
        showFlashMessage('Second wall must be adjacent to the first.', piece.team, gameState);
    }

    deselectPiece();
    gameState.firstWallCoords = null;
    updateBoardMap(gameState);
    return true;
}

export function handleAbilityClick(row, col) {
    if (isState(GameState.WALL_PLACEMENT_FIRST) || isState(GameState.WALL_PLACEMENT_SECOND)) {
        return handleGlacialWall(row, col);
    } else if (isState(GameState.ABILITY_TARGETING)) {
        const { piece, abilityKey } = gameState.abilityContext;
        return executeAbility(piece, { r: row, c: col }, abilityKey, gameState);
    }
    return false;
}

export function executeRiftPulse(piece) {
    if (!piece.canRiftPulse) return false;
    showFlashMessage('The Anchor unleashes a powerful Rift Pulse!', piece.team, gameState);
    piece.canRiftPulse = false;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const adjacentPiece = C.getPieceAt(piece.row + dr, piece.col + dc, gameState.boardMap);
            if (adjacentPiece) {
                adjacentPiece.isDazed = true;
                adjacentPiece.dazedFor = 2;

                const newRow = adjacentPiece.row + dr;
                const newCol = adjacentPiece.col + dc;

                if (newRow >= 0 && newRow < C.ROWS && newCol >= 0 && newCol < C.COLS &&
                    !C.getPieceAt(newRow, newCol, gameState.boardMap) &&
                    !gameState.glacialWalls.some(w => w.row === newRow && w.col === newCol)
                ) {
                    updatePiecePosition(adjacentPiece, newRow, newCol);
                }
            }
        }
    }

    deselectPiece();
    updateBoardMap(gameState);
    updateConduitLink();
    return true;
}