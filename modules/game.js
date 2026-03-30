import * as C from './constants.js';
import { updateBoardMap, isCaptureSuccessful, getValidMoves } from './utils.js';
import { executeAscensionChoice as _executeAscensionLogic } from './ascension.js';
import {
  showFlashMessage, renderBoard, drawLabels, showVictoryScreen,
  resetTimers, hideAbilityPanel, showAbilityPanel, clearMessageLog,
  showAscensionPopup, hideAscensionPopup
} from './ui.js';
import {
  initParticles, triggerShrineOverloadEffects, spawnSiphonParticles,
  spawnWhiteoutParticles, spawnRiftAssaultEffect, triggerShatterCapture,
  updateShrineParticles
} from './effects.js';

let pieceIdCounter = 0;
let gameState = {};
let currentState = 'AWAITING_PIECE_SELECTION';

export const GameState = {
  AWAITING_PIECE_SELECTION: 'AWAITING_PIECE_SELECTION', PIECE_SELECTED: 'PIECE_SELECTED',
  ABILITY_TARGETING: 'ABILITY_TARGETING', WALL_PLACEMENT_FIRST: 'WALL_PLACEMENT_FIRST',
  WALL_PLACEMENT_SECOND: 'WALL_PLACEMENT_SECOND', ASCENSION_CHOICE: 'ASCENSION_CHOICE', GAME_OVER: 'GAME_OVER',
};

export const getGameState = () => gameState;
export const getCurrentState = () => currentState;
export const setCurrentState = s => { currentState = s; };
export const isState = s => currentState === s;

export function checkTerritoryThresholds(gs) {
    if (!gs || !gs.factionPassives) return;
    gs.factionPassives.snow.territory.IcyHighways = gs.snowTerritory.size >= C.TERRITORY_UNLOCK_THRESHOLD;
    gs.factionPassives.ash.territory.ScorchedEarth = gs.ashTerritory.size >= C.TERRITORY_UNLOCK_THRESHOLD;
}

// Small helpers to reduce repetition and improve readability
const isLeader = piece => piece && (piece.key.includes('Lord') || piece.key.includes('Tyrant'));
const inBounds = (r, c) => r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS;
const flash = (msg, team, gs) => showFlashMessage(msg, team, gs);

export function checkSpecialTerrains(p, r, c, gs) {
    const trapIndex = gs.specialTerrains.findIndex(t => t.row === r && t.col === c);
    if (trapIndex !== -1) {
        const trap = gs.specialTerrains[trapIndex];
        if (trap.type === 'snare') {
            p.stuck = C.ABILITY_VALUES.SetSnare.duration;
            import('./ui.js').then(m => m.showFlashMessage(`${C.PIECE_TYPES[p.key].name} is caught in a Snare!`, 'neutral', gs));
            gs.specialTerrains.splice(trapIndex, 1);
        } else if (trap.type === 'icyGround' && p.team !== 'snow') {
            p.isDazed = true; p.dazedFor = 2;
            import('./ui.js').then(m => m.showFlashMessage(`${C.PIECE_TYPES[p.key].name} slipped on Ice!`, 'neutral', gs));
            gs.specialTerrains.splice(trapIndex, 1);
        }
    }
}

export function activateAbility(piece, unleashCostOrKey = 0) {
  if (!piece) return false;
  let abilityKeyToUse;
  
  if (isLeader(piece)) {
    if (piece.isUltimateActive) { flash(`Ultimate is already active.`, piece.team, gameState); return false; }
    if (piece.ultimateCharges > 0) {
         const abilityKey = piece.ability.key;
         const ability = C.ABILITIES[abilityKey];
         piece.ultimateCharges = 0; piece.isChannelingUltimate = false; piece.isDazed = false; piece.dazedFor = 0;
         piece.isUltimateActive = true; piece.ultimateDurationLeft = piece.ultimateCharges * 2;
         if (ability.effect) ability.effect(piece, null, gameState);
      flash(`${C.PIECE_TYPES[piece.key].name} unleashes the Ultimate Aura!`, piece.team, gameState);
         hideAbilityPanel();
         return true; 
    } else if (piece.isChannelingUltimate) {
     flash('Ultimate needs charges before use.', piece.team, gameState); return false;
    } else {
        if (gameState.turnCount <= C.ULTIMATE_MIN_TURN) {
       flash(`Ultimate locked until Turn ${C.ULTIMATE_MIN_TURN + 1}.`, piece.team, gameState); return false;
        }
        piece.isChannelingUltimate = true;
     flash(`${C.PIECE_TYPES[piece.key].name} begins Channeling.`, piece.team, gameState);
        hideAbilityPanel();
        return true; 
    }
  }
  
  if (typeof unleashCostOrKey === 'string' && C.ABILITIES[unleashCostOrKey]) {
      const isSecondary = piece.secondaryAbilityKey === unleashCostOrKey;
      if (isSecondary) {
          if (piece.secondaryAbilityCooldown > 0) return false;
          abilityKeyToUse = unleashCostOrKey;
      } else {
          const cost = C.ABILITIES[unleashCostOrKey]?.cost || 0;
          if ((piece.charges || 0) < cost) return false;
          abilityKeyToUse = unleashCostOrKey;
      }
  } else if (piece.ability && piece.ability.key && (piece.ability.cooldown <= 0 || C.ABILITIES[piece.ability.key]?.isUltimate)) {
    abilityKeyToUse = piece.ability.key;
  } else return false;

  const ability = C.ABILITIES[abilityKeyToUse];
  if (!ability) return false;
  if (ability.isUltimate && piece.hasUsedUltimate) { flash('Ultimate ability has already been used.', piece.team, gameState); return false; }

  hideAbilityPanel();
  if (abilityKeyToUse === 'GlacialWall' || (piece.ability?.isVeteranFortress && abilityKeyToUse === 'GlacialFortress')) {
    setCurrentState(GameState.WALL_PLACEMENT_FIRST);
    gameState.abilityContext = { piece, abilityKey: 'GlacialWall' }; 
    flash('Select a location for the first wall.', piece.team, gameState);
    return false;
  }

  if (!ability.requiresTargeting) return executeAbility(piece, null, abilityKeyToUse, gameState);
  gameState.abilityContext = { piece, abilityKey: abilityKeyToUse };
  setCurrentState(GameState.ABILITY_TARGETING);
  flash(`Select a target for ${ability.name}.`, piece.team, gameState);
  return false;
}

function applySacrificeBuff(team, gs) {
  const buffKey = team === 'snow' ? 'HoarfrostArmaments' : 'InnerFurnace';
  const buff = C.ABILITY_VALUES[buffKey];
  gs.pieces.forEach(fp => {
    if (fp.team === team) gs.temporaryBoosts.push({ pieceId: fp.id, amount: buff.powerBoost, duration: buff.duration, name: buffKey });
  });
  flash(`The ${team === 'snow' ? 'Snow' : 'Ash'} faction is empowered by ${buffKey}!`, team, gs);
}

export function cancelAscensionChoice() {
  if (!isState(GameState.ASCENSION_CHOICE) || !gameState.pendingAscension) return false;
  const pending = gameState.pendingAscension;
  const piece = gameState.pieces.find(p => p.id === pending.sacrificedPieceId);
  if (piece) {
    piece.isTrapped = true; gameState.trappedPiece = piece.id; gameState.shrineIsOverloaded = true;
    flash(`Ascension canceled. ${C.PIECE_TYPES[piece.key].name} remains trapped.`, pending.team, gameState);
  }
  gameState.pendingAscension = null; setCurrentState(GameState.AWAITING_PIECE_SELECTION);
  hideAbilityPanel(); hideAscensionPopup();
  return true;
}

export function createPiece(r, c, key, team) {
  const properties = C.PIECE_TYPES[key] || {};
  let ability;
  if (properties.ability?.name) {
    const abilityKey = properties.ability.key || properties.ability.name;
    if (abilityKey === 'Siphon') ability = { ...properties.ability, key: abilityKey, cooldown: 0 };
    else { const baseAbility = C.ABILITIES[abilityKey] || {}; ability = { ...properties.ability, ...baseAbility, key: abilityKey, cooldown: 0 }; }
  }
  const veteranAbility = properties.veteranAbility || {};
  const piece = {
    id: pieceIdCounter++, row: r, col: c, key, team, power: properties.power, boosts: properties.boosts || {}, ability,
    shrineBoost: 0, anchorBoost: 0, isPhasing: false, isTrapped: false, hasUsedUltimate: false,
    isSteadfast: false, hasPriestsWard: false, isRampaging: false, isAcrobat: false, isElementalHarmony: false, isConduitTier1: false,
    isVeteran: false, vanquishes: 0, secondaryAbilityKey: veteranAbility.key || null, secondaryAbilityCooldown: 0,
    isVeteranWispEnhancement: false, isVeteranSiphonCharge: false, ultimateCharges: 0, isChannelingUltimate: false, 
    isUltimateActive: false, ultimateDurationLeft: 0, ultimateChargeTurns: 0, ability: { ...ability },
    canRiftPulse: false, hasUsedRiftPulse: false
  };
  if (key.includes('Chanter') || key.includes('Warden')) piece.charges = 0;
  return piece;
}

export function deactivateUltimate(piece) {
  if (!piece || !piece.isUltimateActive) return false;
  piece.isUltimateActive = false; piece.ultimateDurationLeft = 0;
  flash(`${C.PIECE_TYPES[piece.key].name} deactivates the Ultimate Aura.`, piece.team, gameState);
  deselectPiece();
  return true; 
}

export function deselectPiece() {
  if (gameState.selectedPiece) hideAbilityPanel();
  gameState.selectedPiece = null; gameState.abilityContext = null;
  setCurrentState(GameState.AWAITING_PIECE_SELECTION);
}

export function despawnPiece(piece) {
  if (!piece || piece.key !== 'snowIceWisp') return;
  gameState.pieces = gameState.pieces.filter(p => p !== piece);
  flash('The Ice Wisp dissipates.', 'snow', gameState);
  deselectPiece(); updateBoardMap(gameState); updateConduitLink();
  checkTerritoryThresholds(gameState);
}

export function endGame(winningTeam) {
  gameState.gameOver = true; setCurrentState(GameState.GAME_OVER);
  showVictoryScreen(winningTeam); resetTimers(gameState);
}

function endOfTurnUpkeep() {
  gameState.pieces.forEach(p => {
    if (p.team === gameState.currentTurn) {
        if (p.stuck > 0) p.stuck--;
        if (p.overloadBoost?.duration > 0) p.overloadBoost.duration--;
        if (p.dazedFor > 0) p.dazedFor--;
        if (!p.isChannelingUltimate) p.isDazed = p.dazedFor > 0;
        
        if (p.secondaryAbilityCooldown > 0) p.secondaryAbilityCooldown--; 
        if (p.ability && p.ability.cooldown > 0) p.ability.cooldown--; 
        
        if (p.ability && p.ability.active && p.ability.duration > 0) {
            p.ability.duration--;
            if (p.ability.duration <= 0) {
                p.ability.active = false;
            }
        }
    }
    
    if (p.isSteadfast) {
        const hardenedIce = gameState.debuffs.find(d => d.pieceId === p.id && d.name === 'HardenedIce');
        if (!hardenedIce || hardenedIce.duration <= 0) p.isSteadfast = false;
    }
  });

  const aliveIds = new Set(gameState.pieces.map(p => p.id));
  const filterByTurn = (arr) => arr.filter(item => {
      const pId = item.pieceId !== undefined ? item.pieceId : item.targetId;
      const p = gameState.pieces.find(piece => piece.id === pId);
      if (p && p.team === gameState.currentTurn) item.duration--;
      return item.duration > 0 && aliveIds.has(pId); 
  });

  gameState.temporaryBoosts = filterByTurn(gameState.temporaryBoosts);
  gameState.debuffs = filterByTurn(gameState.debuffs);
  gameState.markedPieces = filterByTurn(gameState.markedPieces);
  gameState.shields = filterByTurn(gameState.shields);

  gameState.glacialWalls = gameState.glacialWalls.filter(w => --w.duration > 0);
  gameState.unstableGrounds = gameState.unstableGrounds.filter(g => --g.duration > 0);
  gameState.specialTerrains = gameState.specialTerrains.filter(t => t.duration === 99 || --t.duration > 0);
}

export function executeAbility(piece, target, abilityKey, gameStateLocal, isAiTurn = false) {
  const ability = C.ABILITIES[abilityKey];
  if (ability.requiresTargeting && !isTargetValid(piece, target, ability, gameStateLocal)) {
    if (!isAiTurn) { flash('Invalid target.', piece.team, gameStateLocal); deselectPiece(); }
    return false;
  }
  if (ability.isUltimate) return false;
  
  if (abilityKey === 'IcyShift' || abilityKey === 'TacticalSwapAsh') {
      const targetPiece = C.getPieceAt(target.r, target.c, gameStateLocal.boardMap);
      if (!targetPiece) return false;
      const pieceRow = piece.row, pieceCol = piece.col;
      updatePiecePosition(piece, targetPiece.row, targetPiece.col);
      updatePiecePosition(targetPiece, pieceRow, pieceCol);
      piece.isDazed = true; piece.dazedFor = C.ABILITY_VALUES[abilityKey].duration;
      targetPiece.isDazed = true; targetPiece.dazedFor = C.ABILITY_VALUES[abilityKey].duration;
      piece.secondaryAbilityCooldown = C.ABILITY_VALUES[abilityKey].cooldown;
    flash(`${C.PIECE_TYPES[piece.key].name} swaps with ${C.PIECE_TYPES[targetPiece.key].name}!`, piece.team, gameStateLocal);
      if (!isAiTurn) deselectPiece();
      updateBoardMap(gameStateLocal);
      checkTerritoryThresholds(gameStateLocal);
      return true;
  }

  const oldPositions = gameStateLocal.pieces.map(p => ({ id: p.id, r: p.row, c: p.col }));

  if (abilityKey === 'RiftAssault') {
    const oldRow = piece.row, oldCol = piece.col;
    piece.isPhasing = true;
    ability.effect(piece, target, gameStateLocal, createPiece);
    spawnRiftAssaultEffect(piece, oldRow, oldCol, target.r, target.c, gameStateLocal);
  } else {
    const targetPiece = target ? C.getPieceAt(target.r, target.c, gameStateLocal.boardMap) : null;
    if (targetPiece?.hasPriestsWard && ability.canBeBlocked) {
      targetPiece.hasPriestsWard = false;
      flash(`${C.PIECE_TYPES[targetPiece.key].name}'s Ward blocked ${ability.name}!`, targetPiece.team, gameStateLocal);
      if (!isAiTurn) deselectPiece();
      return false;
    }
    if (targetPiece?.hasPermanentAegis && ability.canBeBlocked) {
        flash(`${C.PIECE_TYPES[targetPiece.key].name}'s Aegis blocked ${ability.name}!`, targetPiece.team, gameStateLocal);
        if (!isAiTurn) deselectPiece();
        return false;
    }
    if (piece.isVeteranSiphonCharge && abilityKey === 'SiphonCharge') {
         const mainAbilityKey = C.PIECE_TYPES[piece.key].ability.key;
         piece.power = Math.max(0, piece.power - C.ABILITY_VALUES.SiphonCharge.permDamageCost);
         if (piece.ability?.key === mainAbilityKey) { piece.ability.cooldown = 0; }
         piece.secondaryAbilityCooldown = 0;
         flash(`${C.PIECE_TYPES[piece.key].name} recharges ${C.ABILITIES[mainAbilityKey].name}!`, piece.team, gameStateLocal);
         if (!isAiTurn) deselectPiece();
         updateBoardMap(gameStateLocal);
         return true;
    }
    ability.effect(piece, target, gameStateLocal, createPiece);
    if (abilityKey === 'Whiteout') spawnWhiteoutParticles(piece, gameStateLocal);
  }

  gameStateLocal.pieces.forEach(p => {
      const oldPos = oldPositions.find(op => op.id === p.id);
      if (oldPos && (oldPos.r !== p.row || oldPos.c !== p.col)) {
          checkSpecialTerrains(p, p.row, p.col, gameStateLocal);
          const isShrine = C.SHAPES.shrineArea.some(([sr, sc]) => sr === p.row && sc === p.col);
          if (isShrine && gameStateLocal.shrineIsOverloaded && !gameStateLocal.trappedPiece && !p.isTrapped) {
              p.isTrapped = true; gameStateLocal.trappedPiece = p.id;
          }
      }
  });

  // Replace your existing cooldown lines with these Overclock-aware lines:
  if (piece.ability?.key === abilityKey) { 
      if (!ability.isUltimate) {
          const baseCd = ability.cooldown || 0;
          piece.ability.cooldown = baseCd > 0 ? Math.max(1, baseCd - (piece.cooldownReduction || 0)) : 0;
      }
  } else if (piece.secondaryAbilityKey === abilityKey) {
      const baseCd = ability.cooldown || 0;
      piece.secondaryAbilityCooldown = baseCd > 0 ? Math.max(1, baseCd - (piece.cooldownReduction || 0)) : 0;
  } else if (typeof ability.cost === 'number') { 
      piece.charges = Math.max(0, (piece.charges || 0) - ability.cost);
  }

  if (gameStateLocal.pieces.some(p => p.id === piece.id)) {
      consumeCore(piece, piece.row, piece.col, gameStateLocal);
  }

  if (!isAiTurn) deselectPiece();
  updateBoardMap(gameStateLocal);
  updateConduitLink();
  checkTerritoryThresholds(gameStateLocal);
  return true;
}

export function executeAscensionChoice(choice) {
  if (!gameState.pendingAscension || gameState.factionPassives[gameState.pendingAscension.team].ascension.isChosen) return false;
  const { team, sacrificedPieceId } = gameState.pendingAscension;
  const result = _executeAscensionLogic(gameState, choice);
  if (result) {
    gameState.pieces = gameState.pieces.filter(p => p.id !== sacrificedPieceId);
    resetShrine(gameState);
  flash(`The ${team.toUpperCase()} faction gains Ascension!`, team, gameState);
    updateBoardMap(gameState); setCurrentState(GameState.AWAITING_PIECE_SELECTION);
    hideAbilityPanel(); hideAscensionPopup();
    return true;
  }
  return false;
}

export function executeRelease(piece) {
  if (!piece || !piece.isTrapped) return false;
  flash(`The ${C.PIECE_TYPES[piece.key].name} is released!`, piece.team, gameState);
  piece.power = Math.max(0, piece.power - 1); piece.isDazed = true; piece.dazedFor = 3; piece.isTrapped = false;
  resetShrine(gameState); deselectPiece(); updateBoardMap(gameState);
  return true;
}

export function executeRiftPulse(piece) {
  if (piece.key !== 'ashRiftWarden' && piece.key !== 'snowVoidChanter') return false;
  if (!piece.canRiftPulse || piece.hasUsedRiftPulse) return false;
  flash('The Anchor unleashes a Rift Pulse!', piece.team, gameState);
  
  piece.canRiftPulse = false;
  piece.hasUsedRiftPulse = true;

  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const adjacentPiece = C.getPieceAt(piece.row + dr, piece.col + dc, gameState.boardMap);
    if (!adjacentPiece) continue;
    if (!adjacentPiece.isSteadfast) { adjacentPiece.isDazed = true; adjacentPiece.dazedFor = 2; }
    
    const newRow = adjacentPiece.row + dr, newCol = adjacentPiece.col + dc;
    if (!adjacentPiece.isSteadfast && newRow >= 0 && newRow < C.ROWS && newCol >= 0 && newCol < C.COLS &&
      !C.getPieceAt(newRow, newCol, gameState.boardMap) &&
      !gameState.glacialWalls.some(w => w.row === newRow && w.col === newCol)
    ) {
        updatePiecePosition(adjacentPiece, newRow, newCol);
        checkSpecialTerrains(adjacentPiece, newRow, newCol, gameState);
        
        const isShrine = C.SHAPES.shrineArea.some(([sr, sc]) => sr === newRow && sc === newCol);
        if (isShrine && gameState.shrineIsOverloaded && !gameState.trappedPiece && !adjacentPiece.isTrapped) {
            adjacentPiece.isTrapped = true; gameState.trappedPiece = adjacentPiece.id;
        }
    }
  }

  deselectPiece(); updateBoardMap(gameState); updateConduitLink();
  checkTerritoryThresholds(gameState);
  return true;
}

export function executeSacrifice(piece) {
  if (!piece || !piece.isTrapped || gameState.factionPassives[piece.team].ascension.isChosen) return false;
  const roles = {
    snowIceWeaver: 'Shaper', ashRiftForger: 'Shaper', snowRampagingYeti: 'Brawler', ashBlazeboundBeast: 'Brawler',
    snowArcticTrapper: 'Skirmisher', ashAshStrider: 'Skirmisher', snowHoarfrostMystic: 'Mystic', ashObsidianShaper: 'Mystic',
    snowVoidChanter: 'Siphoner', ashRiftWarden: 'Siphoner', snowCryomancer: 'Mage', ashMagmaSpitter: 'Mage',
    snowSoulFreeze: 'Priest', ashScorchPriest: 'Priest', snowFrostbiteStalker: 'Striker', ashCinderScout: 'Striker',
    snowGlacialBrute: 'Warrior', ashMagmaProwler: 'Warrior'
  };
  const role = roles[piece.key] || 'Other';
  if (role === 'Other') return false;
  flash(`Sacrificing ${C.PIECE_TYPES[piece.key].name} for Ascension!`, piece.team, gameState);
  piece.isTrapped = false; deselectPiece(); gameState.shrineIsOverloaded = false;
  gameState.pendingAscension = { team: piece.team, role, sacrificedPieceId: piece.id, sacrificedPieceKey: piece.key };
  setCurrentState(GameState.ASCENSION_CHOICE); showAscensionPopup(gameState);
  return true;
}

export function handleAbilityClick(row, col) {
  if (isState(GameState.WALL_PLACEMENT_FIRST) || isState(GameState.WALL_PLACEMENT_SECOND)) return handleGlacialWall(row, col);
  if (isState(GameState.ABILITY_TARGETING)) {
    const { piece, abilityKey } = gameState.abilityContext;
    return executeAbility(piece, { r: row, c: col }, abilityKey, gameState);
  }
  return false;
}

function handleGlacialWall(row, col) {
  const piece = gameState.selectedPiece;
  const targetPiece = C.getPieceAt(row, col, gameState.boardMap);
  const isVeteranFortress = piece.ability?.isVeteranFortress;

  if (isState(GameState.WALL_PLACEMENT_FIRST)) {
    const isVoid = (gameState.voidSquares || []).some(v => v.row === row && v.col === col);
    const hasWall = (gameState.glacialWalls || []).some(w => w.row === row && w.col === col);
    if (!targetPiece && !isVoid && !hasWall && Math.abs(piece.row - row) <= 1 && Math.abs(piece.col - col) <= 1 && !(piece.row === row && piece.col === col)) {
      gameState.firstWallCoords = { row, col }; setCurrentState(GameState.WALL_PLACEMENT_SECOND);
      flash('Select location for the second wall.', piece.team, gameState);
    } else deselectPiece();
    return false;
  }

  const { firstWallCoords } = gameState;
  const isSecondVoid = (gameState.voidSquares || []).some(v => v.row === row && v.col === col);
  const isSecondWall = (gameState.glacialWalls || []).some(w => w.row === row && w.col === col);
  if (!targetPiece && !isSecondVoid && !isSecondWall && Math.abs(firstWallCoords.row - row) <= 1 && Math.abs(firstWallCoords.col - col) <= 1) {
  gameState.glacialWalls.push({ row: firstWallCoords.row, col: firstWallCoords.col, duration: C.ABILITY_VALUES.GlacialWall.duration });
  gameState.glacialWalls.push({ row, col, duration: C.ABILITY_VALUES.GlacialWall.duration });
    if (isVeteranFortress) {
        const walls = [{r: firstWallCoords.row, c: firstWallCoords.col}, {r: row, c: col}];
        let placedThird = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            for (const wall of walls) {
                const r3 = wall.r + dr, c3 = wall.c + dc;
        if (r3 >= 0 && r3 < C.ROWS && c3 >= 0 && c3 < C.COLS && !C.getPieceAt(r3, c3, gameState.boardMap) && !gameState.glacialWalls.some(w => w.row === r3 && w.col === c3) && !(gameState.voidSquares || []).some(v => v.row === r3 && v.col === c3)) {
          gameState.glacialWalls.push({ row: r3, col: c3, duration: C.ABILITY_VALUES.GlacialWall.duration });
                    placedThird = true; break;
                }
            }
            if (placedThird) break;
        }
    piece.ability.cooldown = placedThird ? C.ABILITY_VALUES.GlacialFortress.cooldown : C.ABILITIES.GlacialWall.cooldown;
    } else piece.ability.cooldown = C.ABILITIES.GlacialWall.cooldown;
  }
  deselectPiece(); gameState.firstWallCoords = null; updateBoardMap(gameState);
  return true;
}

export function handleSiphon(piece) {
  if (!piece || piece.charges >= piece.ability.maxCharges) return false;
  const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
  const isOnFriendlyTerritory = gameState.factionPassives[piece.team].ascension.ArcaneAttunement && (piece.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory).has(`${piece.row},${piece.col}`);

  if (rift || C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col) || isOnFriendlyTerritory) {
    piece.charges++; spawnSiphonParticles(piece, rift ? 'rift' : 'shrine', gameState);
    flash(`${C.PIECE_TYPES[piece.key].name} siphons energy.`, piece.team, gameState);
    deselectPiece(); return true;
  }
  return false;
}

function handleUltimateChanneling(piece) {
    if (piece.isChannelingUltimate) {
        piece.isDazed = true; piece.dazedFor = 999; piece.ultimateChargeTurns++;
        if (piece.ultimateChargeTurns % 2 === 0) { 
            piece.ultimateCharges++;
      flash(`${C.PIECE_TYPES[piece.key].name} generates an Ultimate Charge!`, piece.team, gameState);
        }
    }
}

export function initGame() {
  pieceIdCounter = 0; gameState.pieces = []; gameState.snowTerritory.clear(); gameState.ashTerritory.clear();
  gameState.shrineChargeLevel = 0; gameState.shrineIsOverloaded = false; gameState.trappedPiece = null;
  gameState.messageHistory = []; gameState.territoryCaptureTurn = {}; gameState.glacialWalls = [];
  gameState.markedPieces = []; gameState.unstableGrounds = []; gameState.specialTerrains = []; gameState.shields = [];
  gameState.selectedPiece = null; gameState.currentTurn = 'snow'; gameState.turnCount = 1; gameState.gameOver = false;
  gameState.temporaryBoosts = []; gameState.debuffs = []; gameState.abilityContext = null;
  gameState.conduitLinkActive = false; gameState.conduitIsContested = false; gameState.conduitInstabilityPhase = 0;
  gameState.voidScarSquares = []; gameState.flashEffects = []; gameState.conduitTeam = null;
  gameState.riftAnchors = { topLeft: null, bottomRight: null };
  gameState.factionPassives = { snow: { ascension: {}, territory: {} }, ash: { ascension: {}, territory: {} } };
  gameState.pendingAscension = null;
  gameState.conduitOverchargeProgress = { snow: { turnsUncontested: 0, contested: false }, ash: { turnsUncontested: 0, contested: false } };
  
  gameState.conduit = {
    owner: null,
    consecutiveTurnsHeld: 0,
    consecutiveTurnsContested: 0,
    hasBeenHighlyCharged: false,
    riftSquares: []
  }
  gameState.dynamicRifts = JSON.parse(JSON.stringify(C.SHAPES.riftAreas));
  gameState.voidSquares = [];
  gameState.elementalCores = [];

  setCurrentState(GameState.AWAITING_PIECE_SELECTION);

  const snowSetup = gameState.playerTeam === 'snow' ? C.SHAPES.bottomLayout : C.SHAPES.topLayout;
  const ashSetup = gameState.playerTeam === 'ash' ? C.SHAPES.bottomLayout : C.SHAPES.topLayout;
  snowSetup.forEach(([r, c, pieceType]) => gameState.pieces.push(createPiece(r, c, C.TEAM_PIECES.snow[pieceType], 'snow')));
  ashSetup.forEach(([r, c, pieceType]) => gameState.pieces.push(createPiece(r, c, C.TEAM_PIECES.ash[pieceType], 'ash')));
  gameState.pieces.forEach(p => (p.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory).add(`${p.row},${p.col}`));

  initParticles(gameState); updateBoardMap(gameState); renderBoard(gameState); drawLabels(gameState); clearMessageLog(); 
}

export function initGameState(initialState) { gameState = initialState; }

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
    case 'empty':
      return !targetPiece && !(gameStateLocal.glacialWalls || []).some(w => w.row === r && w.col === c) && !(gameStateLocal.voidSquares || []).some(v => v.row === r && v.col === c);
    case 'any': return true;
    case 'special': return ability.specialTargeting(piece, target, gameStateLocal);
    default: return false;
  }
}

export function movePiece(piece, targetRow, targetCol, isHighwayMove = false) {
  if (piece.isChannelingUltimate || gameState.gameOver || !piece || piece.isDazed || (piece.stuck || 0) > 0 || piece.isTrapped || piece.team !== gameState.currentTurn) return false;
  const validMoves = getValidMoves(piece, gameState);
  const move = validMoves.find(m => m.row === targetRow && m.col === targetCol);
  if (!move && !isHighwayMove) return false;

  const isActualHighway = isHighwayMove || (move && (move.isHighway || move.isIcyHighway));
  let addedBoost = false;

  const actionTaken = () => {
    gameState.lastMoveIndicator = { row: piece.row, col: piece.col, life: 1.0 };
    deselectPiece(); updateBoardMap(gameState); updateConduitLink();
    checkTerritoryThresholds(gameState);
  };

  if (isActualHighway) {
      gameState.temporaryBoosts.push({ pieceId: piece.id, amount: C.ANCHOR_AURA_POWER, duration: C.CONDUIT_HIGHWAY_BUFF_DURATION, name: "ConduitHighwayBuff" });
      addedBoost = true;
  }

  const defender = C.getPieceAt(targetRow, targetCol, gameState.boardMap);
  const isMovingToShrine = C.SHAPES.shrineArea.some(([r, c]) => r === targetRow && c === targetCol);

  if (isMovingToShrine && gameState.shrineIsOverloaded) {
    const trapped = gameState.pieces.find(p => p.id === gameState.trappedPiece);
    if (defender && trapped && trapped.team !== piece.team && defender.id === trapped.id) {
      applySacrificeBuff(piece.team, gameState);
      gameState.pieces = gameState.pieces.filter(p => p.id !== trapped.id);
      resetShrine(gameState); updatePiecePosition(piece, targetRow, targetCol); checkSpecialTerrains(piece, targetRow, targetCol, gameState);
      actionTaken(); return true;
    } else if (!defender && !trapped) {
      updatePiecePosition(piece, targetRow, targetCol);
      piece.isTrapped = true; gameState.trappedPiece = piece.id;
      updateBoardMap(gameState); deselectPiece(); return true;
    }
  }

  if (defender) {
    if (isCaptureSuccessful(piece, defender, gameState)) {
      try {
        const centerX = defender.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const centerY = defender.row * C.CELL_SIZE + C.CELL_SIZE / 2;
        const color = defender.team === 'ash' ? '#ff4400' : '#00ccff';
        triggerShatterCapture(centerX, centerY, color);
      } catch (e) {}

      if (gameState.factionPassives[defender.team].ascension.Martyrdom && !piece.isSteadfast) { piece.isDazed = true; piece.dazedFor = 2; }
      if (gameState.factionPassives[defender.team].ascension.Vengeance) { gameState.markedPieces.push({ targetId: piece.id, duration: 2 }); }
      gameState.pieces = gameState.pieces.filter(p => p !== defender);
      
      if (gameState.factionPassives[piece.team].ascension.HitAndRun) piece.isEntrenched = true;
      if (gameState.factionPassives[piece.team].ascension.TerritorialClaim) {
          const territory = piece.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
          const oppTerritory = piece.team === 'snow' ? gameState.ashTerritory : gameState.snowTerritory;
          const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
          let caps = 0;
          for (const [dr, dc] of dirs) {
              if (caps >= 2) break;
              const nr = targetRow + dr; const nc = targetCol + dc;
              if (nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS) {
                  const posStr = `${nr},${nc}`;
                  if (!territory.has(posStr)) {
                      territory.add(posStr); oppTerritory.delete(posStr); gameState.territoryCaptureTurn[posStr] = gameState.turnCount; caps++;
                  }
              }
          }
      }

      if (gameState.factionPassives[piece.team].ascension.EnergySiphon) {
          const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
          for (const [dr, dc] of dirs) {
              const adjPiece = C.getPieceAt(targetRow + dr, targetCol + dc, gameState.boardMap);
              if (adjPiece && adjPiece.team !== piece.team && !adjPiece.isSteadfast) { adjPiece.isDazed = true; adjPiece.dazedFor = 2; }
          }
      }

      if (!piece.isVeteran && ++piece.vanquishes >= 2) promoteToVeteran(piece);
      if (isMovingToShrine) handleShrineCapture(piece, defender);
      
      updatePiecePosition(piece, targetRow, targetCol);
      if (isMovingToShrine && gameState.shrineIsOverloaded && !gameState.trappedPiece) {
          piece.isTrapped = true; gameState.trappedPiece = piece.id;
      }
      
      if (defender.key.includes('Tyrant') || defender.key.includes('Lord')) endGame(piece.team);
    } else {
      if (addedBoost) { gameState.temporaryBoosts.pop(); } 
      if (gameState.factionPassives[piece.team].ascension.MagicalSupremacy) { piece.power = Math.max(0, piece.power - 1); piece.isDazed = true; piece.dazedFor = 2; }
      return false;
    }
  } else updatePiecePosition(piece, targetRow, targetCol);

  checkSpecialTerrains(piece, targetRow, targetCol, gameState);
  consumeCore(piece, targetRow, targetCol, gameState);
  actionTaken(); return true;
}

export function checkAscensionReady() {
  if (!gameState) return false;
  const required = (C.ABILITY_VALUES && C.ABILITY_VALUES.Shrine && C.ABILITY_VALUES.Shrine.overloadCharges) ? C.ABILITY_VALUES.Shrine.overloadCharges : 3;
  if (gameState.shrineChargeLevel >= required && !isState(GameState.ASCENSION_CHOICE)) {
    setCurrentState(GameState.ASCENSION_CHOICE);
    showAscensionPopup(gameState);
    return true;
  }
  return false;
}

export function promoteToVeteran(piece) {
    if (piece.isVeteran || piece.key.includes('Tyrant') || piece.key.includes('Lord') || piece.key.includes('Wisp')) return false;
    piece.isVeteran = true;
    const vetAb = C.PIECE_TYPES[piece.key]?.veteranAbility;
    if (vetAb?.isPermanentUpgrade) {
        switch (vetAb.key) {
            case 'WispEnhancement': piece.isVeteranWispEnhancement = true; break;
            case 'GlacialFortress': piece.ability.isVeteranFortress = true; break;
            case 'VolatileForge': piece.ability.isVeteranForge = true; break;
            case 'SiphonCharge': piece.isVeteranSiphonCharge = true; break;
        }
    }
    if (piece.secondaryAbilityKey && vetAb.cooldown) piece.secondaryAbilityCooldown = vetAb.cooldown;
  flash(`${C.PIECE_TYPES[piece.key].name} becomes a Veteran!`, piece.team, gameState);
    return true;
}

export function resetGame() { initGame(); resetTimers(gameState); hideAbilityPanel(); clearMessageLog(); drawLabels(gameState); }

function resetShrine(gs) { 
    gs.shrineChargeLevel = 0; 
    gs.shrineIsOverloaded = false; 
    gs.trappedPiece = null; 
    updateShrineParticles(0, gs);
}

export function selectPiece(piece) {
  if (piece.team !== gameState.currentTurn || isState(GameState.ASCENSION_CHOICE)) return;
  gameState.selectedPiece = piece; setCurrentState(GameState.PIECE_SELECTED); showAbilityPanel(piece, gameState);
}

function startOfTurnUpkeep(team) {
  gameState.pieces.forEach(p => {
    p.hasUsedRiftPulse = false;
    
    if (p.isSteadfast) {
        const hardenedIce = gameState.debuffs.find(d => d.pieceId === p.id && d.name === 'HardenedIce');
        if (!hardenedIce || hardenedIce.duration <= 0) p.isSteadfast = false;
    }
    if (p.team === team) { 
        p.isEntrenched = false; 
        if (p.key.includes('Lord') || p.key.includes('Tyrant')) handleUltimateChanneling(p);
    }
  });
}

export function switchTurn() {
  endOfTurnUpkeep();
  processAbyssalForgeTurn();
  gameState.pieces.forEach(p => {
    if (p.isUltimateActive && --p.ultimateDurationLeft <= 0) {
        p.isUltimateActive = false; flash(`${C.PIECE_TYPES[p.key].name}'s Aura fades.`, p.team, gameState);
    }
  });
  if (gameState.conduitLinkActive && !gameState.conduitIsContested) {
    const progress = gameState.conduitOverchargeProgress[gameState.conduitTeam];
    if (++progress.turnsUncontested === C.CONDUIT_OVERCHARGE_TIER2_TURNS) {
        const { topLeft, bottomRight } = gameState.riftAnchors;
        if (topLeft) topLeft.power++; if (bottomRight) bottomRight.power++;
        progress.turnsUncontested = 0;
    }
  }

  const nextTurn = gameState.currentTurn === 'snow' ? 'ash' : 'snow';
  startOfTurnUpkeep(nextTurn);
  gameState.currentTurn = nextTurn;
  if (nextTurn === 'snow') gameState.turnCount++;
  drawLabels(gameState);
  checkTerritoryThresholds(gameState);
}

export function updateConduitLink() {
  if (!gameState.dynamicRifts || gameState.dynamicRifts.length < 2) {
      gameState.conduitLinkActive = false;
      gameState.conduitTeam = null;
      gameState.riftAnchors = { topLeft: null, bottomRight: null };
      return; 
  }
  const [rift1, rift2] = gameState.dynamicRifts;
  const wasActive = gameState.conduitLinkActive;
  gameState.pieces.forEach(p => { p.isAnchor = false; p.hasDefensiveWard = false; p.anchorBoost = 0; p.canRiftPulse = false; });
  gameState.conduitLinkActive = false;
  const piecesOnTL = gameState.pieces.filter(p => rift1.cells.some(([r, c]) => r === p.row && c === p.col));
  const piecesOnBR = gameState.pieces.filter(p => rift2.cells.some(([r, c]) => r === p.row && c === p.col));
  const snowAnchor = piecesOnTL.find(p => p.team === 'snow') && piecesOnBR.find(p => p.team === 'snow');
  const ashAnchor = piecesOnTL.find(p => p.team === 'ash') && piecesOnBR.find(p => p.team === 'ash');
  const linkTeam = snowAnchor ? 'snow' : ashAnchor ? 'ash' : null;

  if (linkTeam) {
    gameState.conduitLinkActive = true; gameState.conduitTeam = linkTeam;
    const anchors = { TL: piecesOnTL.find(p => p.team === linkTeam), BR: piecesOnBR.find(p => p.team === linkTeam) };
    gameState.riftAnchors = { topLeft: anchors.TL, bottomRight: anchors.BR };
    gameState.conduitIsContested = piecesOnTL.some(p => p.team !== linkTeam) || piecesOnBR.some(p => p.team !== linkTeam);
    
    // Check for boost, but do NOT trigger old Reality Tear
    const boost = (gameState.conduitIsContested && !gameState.factionPassives[linkTeam].ascension.RiftReinforcement) ? 1 : 2;
    
    anchors.TL.isAnchor = true; anchors.TL.hasDefensiveWard = true; anchors.TL.anchorBoost = boost;
    if ((anchors.TL.key.includes('Warden') || anchors.TL.key.includes('Chanter')) && !anchors.TL.hasUsedRiftPulse) anchors.TL.canRiftPulse = true;
    
    anchors.BR.isAnchor = true; anchors.BR.anchorBoost = boost;
    if ((anchors.BR.key.includes('Warden') || anchors.BR.key.includes('Chanter')) && !anchors.BR.hasUsedRiftPulse) anchors.BR.canRiftPulse = true;
  } 
}

function updatePiecePosition(p, r, c) {
    p.row = r; p.col = c;
    (p.team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory).add(`${r},${c}`);
    (p.team === 'snow' ? gameState.ashTerritory : gameState.snowTerritory).delete(`${r},${c}`);
    gameState.territoryCaptureTurn[`${r},${c}`] = gameState.turnCount;
}

function handleShrineCapture(piece, defender) {
  if (defender.key === 'snowIceWisp') return;
  if (piece.shrineBoost === 0) piece.shrineBoost = C.ABILITY_VALUES.Shrine.powerBoost;
  if (!gameState.shrineIsOverloaded) {
    if (++gameState.shrineChargeLevel >= C.ABILITY_VALUES.Shrine.overloadCharges) {
      gameState.shrineIsOverloaded = true; triggerShrineOverloadEffects(gameState);
    }
  }
}

export function processAbyssalForgeTurn() {
  if (!gameState.dynamicRifts || gameState.dynamicRifts.length === 0) return;

    let snowPresence = false;
    let ashPresence = false;

    // Get all current rift cells (including any future expanded ones)
    const riftCells = [];
    gameState.dynamicRifts.forEach(rift => {
        rift.cells.forEach(cell => riftCells.push(cell));
    });

    // Check which teams are standing on the Rift
    gameState.pieces.forEach(p => {
        if (riftCells.some(([r, c]) => r === p.row && c === p.col)) {
            if (p.team === 'snow') snowPresence = true;
            if (p.team === 'ash') ashPresence = true;
        }
    });

    // Determine the current state of the board
    let currentTurnOwner = null;
    if (snowPresence && !ashPresence) currentTurnOwner = 'snow';
    else if (ashPresence && !snowPresence) currentTurnOwner = 'ash';

    const conduit = gameState.conduit;

    // --- State 1: Contested or Neutral ---
    if (!currentTurnOwner) {
        conduit.consecutiveTurnsContested++;
        
        // OPTION A: Unified Timings (Triggers at exactly 4 turns / 2 full rounds)
        if (conduit.consecutiveTurnsContested >= 4) {
            
            // 1. If it was highly charged, execute Instant Annihilation!
            if (conduit.hasBeenHighlyCharged) {
                executeVoidSnap(gameState);
            } 
            // 2. Otherwise, just do standard Territory Loss
            else if (conduit.owner !== null) {
                const territory = conduit.owner === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
                riftCells.forEach(([r, c]) => { territory.delete(`${r},${c}`); });
                
                import('./ui.js').then(m => m.showFlashMessage('The Conduit destabilizes! Territory lost.', 'neutral', gameState));
                conduit.owner = null;
                conduit.consecutiveTurnsHeld = 0;
            }
        }
    }
    // --- State 2: Uncontested Control ---
    else {
        if (conduit.owner === currentTurnOwner) {
            conduit.consecutiveTurnsHeld++;
            conduit.consecutiveTurnsContested = 0; // Reset contest timer
            
            // --- PHASE 5 TRACKER (Prime to snap after 6 turns / 3 full rounds) ---
            if (conduit.consecutiveTurnsHeld >= 6) conduit.hasBeenHighlyCharged = true;
            
            // --- PHASE 3 THE FORGE TRIGGER (Now every 4 turns / 2 full rounds) ---
            if (conduit.consecutiveTurnsHeld > 0 && conduit.consecutiveTurnsHeld % 4 === 0) {
                triggerAbyssalForge(gameState);
            }
        } else {
            // A new owner takes over
            conduit.owner = currentTurnOwner;
            conduit.consecutiveTurnsHeld = 1;
            conduit.consecutiveTurnsContested = 0;
        }

        // Territory Claim (Now 6 turns / 3 full rounds Uncontested)
        if (conduit.consecutiveTurnsHeld === 6) {
            const territory = conduit.owner === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
            riftCells.forEach(([r, c]) => {
                territory.add(`${r},${c}`);
                gameState.territoryCaptureTurn[`${r},${c}`] = gameState.turnCount;
            });
            import('./ui.js').then(m => m.showFlashMessage(`The ${conduit.owner.toUpperCase()} faction claims the Conduit!`, conduit.owner, gameState));
        }
    }
}

function executeVoidSnap(gs) {
    import('./ui.js').then(m => m.showFlashMessage('THE VOID SNAPS! The Conduit collapses!', 'neutral', gs));
    
    const riftCells = [];
    gs.dynamicRifts.forEach(rift => {
        rift.cells.forEach(([r, c]) => {
            riftCells.push({row: r, col: c});
            
            // --- BUG FIX 1: Completely wipe the territory from both teams ---
            const posStr = `${r},${c}`;
            gs.snowTerritory.delete(posStr);
            gs.ashTerritory.delete(posStr);
            // ----------------------------------------------------------------
            
            // Instantly kill any piece standing on the snapping void!
            const pieceOnVoid = C.getPieceAt(r, c, gs.boardMap);
            if (pieceOnVoid) gs.pieces = gs.pieces.filter(p => p.id !== pieceOnVoid.id);
        });
    });

    gs.voidSquares.push(...riftCells);
    gs.dynamicRifts = []; // Erase the conduit
    gs.conduit.owner = null;
    gs.conduit.hasBeenHighlyCharged = false;
    gs.conduit.consecutiveTurnsContested = 0;
    gs.conduitLinkActive = false;
    gs.riftAnchors = { topLeft: null, bottomRight: null };
    
    updateBoardMap(gs);
}

function triggerAbyssalForge(gs) {
    // 1. Map out all current Rift cells
    const currentRiftCells = new Set();
    gs.dynamicRifts.forEach(rift => rift.cells.forEach(([r, c]) => currentRiftCells.add(`${r},${c}`)));

    // 2. Find all empty, valid adjacent cells
    const adjacentEmptyCells = new Set();
    const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];

    currentRiftCells.forEach(cellStr => {
        const [r, c] = cellStr.split(',').map(Number);
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS) {
                const nStr = `${nr},${nc}`;
                // Must be completely empty
                if (!currentRiftCells.has(nStr) && 
                    !C.getPieceAt(nr, nc, gs.boardMap) &&
                    !gs.glacialWalls.some(w => w.row === nr && w.col === nc) &&
                    !gs.voidSquares.some(v => v.row === nr && v.col === nc) &&
                    !gs.elementalCores.some(ec => ec.row === nr && ec.col === nc)) {
                    adjacentEmptyCells.add(nStr);
                }
            }
        }
    });

    const possibleTargets = Array.from(adjacentEmptyCells).map(str => {
        const [r, c] = str.split(',').map(Number);
        return {r, c};
    });

    if (possibleTargets.length === 0) return; // Nowhere to expand or spawn

    // Pick a random adjacent cell
    const targetCell = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];

    // 3. The 50/50 Roll
    if (Math.random() < 0.5) {
        // Outcome A: Expansion
        // Find which specific rift area to attach it to (based on adjacency)
        let attached = false;
        for (let rift of gs.dynamicRifts) {
            if (rift.cells.some(([rr, cc]) => Math.abs(rr - targetCell.r) <= 1 && Math.abs(cc - targetCell.c) <= 1)) {
                rift.cells.push([targetCell.r, targetCell.c]);
                attached = true;
                break;
            }
        }
        if (!attached) gs.dynamicRifts[0].cells.push([targetCell.r, targetCell.c]); // Fallback
        
        // If they already claimed the territory, immediately give them this new square too
        if (gs.conduit.consecutiveTurnsHeld >= 6) {
            const territory = gs.conduit.owner === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            territory.add(`${targetCell.r},${targetCell.c}`);
            gs.territoryCaptureTurn[`${targetCell.r},${targetCell.c}`] = gs.turnCount;
        }
    flash(`The Abyssal Forge expands the Rift!`, gs.conduit.owner, gs);
    } else {
        // Outcome B: Elemental Core
        const coreTypes = ['ruby', 'topaz', 'emerald', 'sapphire'];
        const randomType = coreTypes[Math.floor(Math.random() * coreTypes.length)];
        gs.elementalCores.push({ row: targetCell.r, col: targetCell.c, type: randomType });
        import('./ui.js').then(m => m.showFlashMessage(`The Forge spawns a ${randomType.toUpperCase()} Core!`, gs.conduit.owner, gs));
    }
}

export function consumeCore(piece, r, c, gs) {
    const coreIndex = gs.elementalCores.findIndex(ec => ec.row === r && ec.col === c);
    if (coreIndex === -1) return;

    const core = gs.elementalCores[coreIndex];
    gs.elementalCores.splice(coreIndex, 1); // Remove it from the board
    let msg = "";

    if (core.type === 'ruby') {
        piece.rubyCores = piece.rubyCores || 0;
        if (piece.rubyCores < 2) {
            piece.power += 1;
            piece.rubyCores++;
            msg = `${C.PIECE_TYPES[piece.key].name} gained +1 Permanent Power!`;
        } else {
            gs.temporaryBoosts.push({ pieceId: piece.id, amount: 1, duration: 2, name: "RubySurge" });
            msg = `${C.PIECE_TYPES[piece.key].name} gained +1 Power for 2 turns!`;
        }
    } 
    else if (core.type === 'topaz') {
        const isLeader = piece.key.includes('Tyrant') || piece.key.includes('Lord');
        if (!piece.isVeteran && !isLeader) {
            promoteToVeteran(piece);
            msg = `${C.PIECE_TYPES[piece.key].name} awakened as a Veteran!`;
        } else {
            const territory = piece.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            const oppTerritory = piece.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
            const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
            dirs.forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                // BUG FIX 6: Added void check to prevent drawing territory over the abyss
                if (nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS && 
                    !gs.voidSquares.some(v => v.row === nr && v.col === nc)) {
                    territory.add(`${nr},${nc}`); oppTerritory.delete(`${nr},${nc}`);
                    gs.territoryCaptureTurn[`nr},${nc}`] = gs.turnCount;
                }
            });
            msg = `${C.PIECE_TYPES[piece.key].name} triggers a Territorial Burst!`;
        }
    }
    else if (core.type === 'emerald') {
        if (!piece.hasPermanentAegis) {
            piece.hasPermanentAegis = true;
            msg = `${C.PIECE_TYPES[piece.key].name} gains Permanent Aegis!`;
        } else {
            gs.temporaryBoosts.push({ pieceId: piece.id, amount: 1, duration: 3, name: "AegisDefense", defensiveOnly: true });
            msg = `${C.PIECE_TYPES[piece.key].name} gains +1 Defense for 3 turns!`;
        }
    } 
    else if (core.type === 'sapphire') {
        piece.cooldownReduction = piece.cooldownReduction || 0;
        if (piece.cooldownReduction === 0) { 
            piece.cooldownReduction = 1; // Permanently reduce future cooldowns
            if (piece.ability && piece.ability.cooldown > 0) piece.ability.cooldown = 0;
            if (piece.secondaryAbilityCooldown > 0) piece.secondaryAbilityCooldown = 0;
            msg = `${C.PIECE_TYPES[piece.key].name} is Overclocked!`;
        } else {
            gs.pieces.forEach(p => {
                if (p.team === piece.team) {
                    if (p.ability && p.ability.cooldown > 0) p.ability.cooldown--;
                    if (p.secondaryAbilityCooldown > 0) p.secondaryAbilityCooldown--;
                }
            });
            msg = `Global Sync! Faction cooldowns reduced!`;
        }
    }
    
    import('./ui.js').then(m => m.showFlashMessage(msg, piece.team, gs));
}