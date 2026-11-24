import * as C from "./constants.js";
import { updateBoardMap, isCaptureSuccessful, getValidMoves, dealDamage, previewDamage, getPieceMoveRadius, getEffectiveControl } from "./utils.js";
import { executeAscensionChoice as _executeAscensionLogic } from "./ascension.js";
import { computePowerDiagram, syncTerritorySetsFromVoronoi } from "./voronoi.js";

let gameState = {};

/**
 * Updates the continuous Weighted Voronoi (Power Diagram) state
 * and synchronizes the discrete territory sets for existing mechanics.
 */
export function updateVoronoiState(gs = gameState) {
  if (!gs || !gs.pieces) return;
  const piecesKey = gs._piecesKey || gs.pieces
    .map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`)
    .join('|');
  if (gs._piecesKey === piecesKey && gs.voronoiData && Array.isArray(gs.voronoiData.cells) && gs.snowTerritory && gs.ashTerritory) {
    return;
  }
  gs._piecesKey = piecesKey;
  const voronoi = computePowerDiagram(gs.pieces);
  gs.voronoiData = voronoi;
  syncTerritorySetsFromVoronoi(gs, voronoi);
}

export const GameState = {
  AWAITING_PIECE_SELECTION: "AWAITING_PIECE_SELECTION",
  PIECE_SELECTED: "PIECE_SELECTED",
  ABILITY_TARGETING: "ABILITY_TARGETING",
  WALL_PLACEMENT_FIRST: "WALL_PLACEMENT_FIRST",
  WALL_PLACEMENT_SECOND: "WALL_PLACEMENT_SECOND",
  ASCENSION_CHOICE: "ASCENSION_CHOICE",
  GAME_OVER: "GAME_OVER",
  TETHER_TARGETING: "TETHER_TARGETING"
};

export const getGameState = (gs = gameState) => gs;
export const getCurrentState = (gs = gameState) => (gs && gs.currentState) || GameState.AWAITING_PIECE_SELECTION;
export const setCurrentState = (s, gs = gameState) => {
  if (gs) {
    gs.currentState = s;
    emit(gs, { type: "STATE_CHANGE", state: s });
  }
};
export const isState = (s, gs = gameState) => getCurrentState(gs) === s;

// ============================================================================
// THE EVENT QUEUE (Multiplayer Architecture)
// ============================================================================
export function emit(gs = gameState, eventPayload) {
  if (!eventPayload && typeof gs === 'object' && gs?.type) {
    eventPayload = gs;
    gs = gameState;
  }
  if (!gs) return;
  if (!gs.events) gs.events = [];
  gs.events.push(eventPayload);
}

// Helper to replace all old UI flash calls
const flash = (msg, team, gs = gameState) =>
  emit(gs, { type: "FLASH", message: msg, team });

// ============================================================================
// LOGIC HELPERS
// ============================================================================
export function checkTerritoryThresholds(gs = gameState) {
  if (!gs || !gs.factionPassives) return;
  const snowSize = gs.snowTerritory ? (typeof gs.snowTerritory.size === 'number' ? gs.snowTerritory.size : gs.snowTerritory.length) : 0;
  const ashSize = gs.ashTerritory ? (typeof gs.ashTerritory.size === 'number' ? gs.ashTerritory.size : gs.ashTerritory.length) : 0;
  gs.factionPassives.snow.territory.IcyHighways =
    snowSize >= C.TERRITORY_UNLOCK_THRESHOLD;
  gs.factionPassives.ash.territory.ScorchedEarth =
    ashSize >= C.TERRITORY_UNLOCK_THRESHOLD;
}

const isLeader = (piece) =>
  piece && (piece.key.includes("Lord") || piece.key.includes("Tyrant"));
const inBounds = (r, c) => r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS;

export function checkSpecialTerrains(p, r, c, gs = gameState) {
  const trapIndex = gs.specialTerrains.findIndex(
    (t) => Math.round(t.row) === Math.round(r) && Math.round(t.col) === Math.round(c)
  );
  if (trapIndex !== -1) {
    const trap = gs.specialTerrains[trapIndex];
    if (trap.type === "snare" && trap.team !== p.team) {
      p.stuck = C.ABILITY_VALUES.SetSnare.duration || 2;
      flash(
        `${C.PIECE_TYPES[p.key].name} is caught in a Snare!`,
        "neutral",
        gs
      );
      gs.specialTerrains.splice(trapIndex, 1);
      emit(gs, { type: "ANIMATION", name: "TrapTrigger", r: Math.round(r), c: Math.round(c), pieceId: p.id });
    } else if (trap.type === "icyGround" && p.team !== "snow") {
      p.isDazed = true;
      p.dazedFor = Math.max(p.dazedFor || 0, 3);
      flash(`${C.PIECE_TYPES[p.key].name} slipped on Ice!`, "neutral", gs);
      gs.specialTerrains.splice(trapIndex, 1);
    } else if (trap.type === "beacon" && p.team !== "snow") {
      p.isDazed = true;
      p.dazedFor = Math.max(p.dazedFor || 0, 2);
      flash(`${C.PIECE_TYPES[p.key].name} triggered a Glacial Beacon and is Dazed!`, "neutral", gs);
      gs.specialTerrains.splice(trapIndex, 1);
      emit(gs, { type: "ANIMATION", name: "TrapTrigger", r: Math.round(r), c: Math.round(c), pieceId: p.id });
    } else if (trap.type === "magmaShards" && p.team === "snow") {
      const dmg = 1;
      p.power = Math.max(0, p.power - dmg);
      if (typeof p.currentHp === "number") {
        if (!(p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) && !(p.key === 'ashAshTyrant' && p.hasDeathMeteorInvincibility)) {
          p.currentHp = Math.max(0, Math.round((p.currentHp - dmg) * 10) / 10);
        }
      }
      flash(`${C.PIECE_TYPES[p.key].name} stepped on Magma Shards and took 1 damage!`, "neutral", gs);
      gs.specialTerrains.splice(trapIndex, 1);
      emit(gs, { type: "ANIMATION", name: "TrapTrigger", r: Math.round(r), c: Math.round(c), pieceId: p.id });
    }
  }
}

// Internal helper for state normalization
function ensureSets(gs = gameState) {
  if (Array.isArray(gs.snowTerritory)) gs.snowTerritory = new Set(gs.snowTerritory);
  if (Array.isArray(gs.ashTerritory)) gs.ashTerritory = new Set(gs.ashTerritory);
  if (!gs.territoryTrails) gs.territoryTrails = [];
}

export function resolveDeaths(gs = gameState, defaultAttacker = null) {
  let deathResolved = true;
  let anyDied = false;
  while (deathResolved) {
    deathResolved = false;
    const dyingPiece = gs.pieces.find(p => typeof p.currentHp === "number" && p.currentHp <= 0);
    if (dyingPiece) {
      handlePieceCapture(dyingPiece, defaultAttacker, gs);
      deathResolved = true;
      anyDied = true;
    }
  }
  if (anyDied) {
    updateVoronoiState(gs);
  }
}

/**
 * Bug 1.1 & 1.3 fix: Checks and applies lethal-strike passives (HelpFromAbove, Death Meteor)
 * before an AoE source removes a piece. Returns true if the passive intercepted the kill.
 * Call this in AoE upkeep loops instead of directly invoking handlePieceCapture when HP <= 0.
 */
export function applyAoeLethalPassives(piece, gs = gameState) {
  if (!piece || typeof piece.currentHp !== "number" || piece.currentHp > 0) return false;

  // Frost Lord – Help From Above
  if (piece.key === 'snowFrostLord') {
    if (piece.hasHelpFromAboveActive) {
      piece.currentHp = 1;
      return true; // Intercept death: Frost Lord is immune to death/damage during his active state
    }
    if ((piece.helpFromAboveCooldown || 0) <= 0) {
      piece.currentHp = 1;
      piece.helpFromAboveCooldown = C.ABILITY_VALUES.HelpFromAbove?.cooldown || 15;
      piece.hasHelpFromAboveActive = true;
      piece.helpFromAboveActiveTurns = C.ABILITY_VALUES.HelpFromAbove?.activeDuration || 3;

      // Grant nearby allies (Rad 1.5) +1 Strength for 3 turns
      const rad = C.ABILITY_VALUES.HelpFromAbove?.radius || 1.5;
      const strBoost = C.ABILITY_VALUES.HelpFromAbove?.strengthBoost || 1;
      const duration = C.ABILITY_VALUES.HelpFromAbove?.activeDuration || 3;
      if (gs.pieces) {
        gs.temporaryBoosts = gs.temporaryBoosts || [];
        gs.pieces.forEach(p => {
          if (p.team === piece.team && p.id !== piece.id && Math.hypot(p.row - piece.row, p.col - piece.col) <= rad) {
            gs.temporaryBoosts.push({
              pieceId: p.id,
              duration: duration,
              amount: strBoost,
              name: 'HelpFromAboveStr'
            });
          }
        });
      }

      flash(`Help From Above! Frost Lord is shielded and bolsters nearby allies.`, piece.team, gs);

      // Emit the animation trigger for the client
      if (typeof window === 'undefined' || gs.isLocalSimulation !== true) {
        if (!gs.events) gs.events = [];
        gs.events.push({
          type: "ANIMATION",
          name: "GuardianSave",
          pieceId: piece.id,
          r: piece.row,
          c: piece.col
        });
      }

      return true; // intercept: do NOT capture
    }
  }

  // Ash Tyrant – Death Meteor
  if (piece.key === "ashAshTyrant") {
    if (piece.hasDeathMeteorInvincibility) {
      piece.currentHp = 1;
      return true; // Intercept death: Tyrant is immune to death/damage during his active invincibility state
    }
    if ((piece.deathMeteorCooldown || 0) <= 0) {
      piece.currentHp = 1;
      piece.deathMeteorCooldown = 15;
      piece.hasDeathMeteorInvincibility = true;
      piece.deathMeteorInvincibilityTurns = 2;
      piece.hasTriggeredDeathMeteor = true;

      const currentR = piece.row;
      const currentC = piece.col;

      // 1. AoE Damage to all units within Radius 2 (enemies take 4 dmg, allies take 2 dmg)
      let aoeHits = 0;
      if (gs.pieces) {
        gs.pieces.forEach(p => {
          if (C.cellIntersectsCircle(p.row, p.col, currentR, currentC, 2) && p.id !== piece.id) {
            if (p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) {
              return; // Skip damage due to active Help From Above protective state
            }
            if (p.key === 'ashAshTyrant' && p.hasDeathMeteorInvincibility) {
              return;
            }
            const maxHp = p.maxHp || C.PIECE_TYPES[p.key]?.stats?.hp || 5;
            const curHp = typeof p.currentHp === 'number' ? p.currentHp : maxHp;
            const dmg = p.team !== piece.team ? 4 : 2;
            p.currentHp = Math.max(0, Math.round((curHp - dmg) * 10) / 10);
            aoeHits++;
          }
        });
      }

      flash(`Death Meteor strikes! 4 AoE damage dealt to nearby enemies.`, piece.team, gs);

      // 2. Create the permanent crater and scorched ground at original position
      gs.deathMeteors = gs.deathMeteors || [];
      gs.deathMeteors.push({ r: currentR, c: currentC, duration: 6 });

      gs.specialTerrains = gs.specialTerrains || [];
      gs.specialTerrains.push({
        row: currentR,
        col: currentC,
        type: "crater",
        duration: 99999
      });

      // Secondary explosive payload logic: spawn Unstable Ground with isBurningGround on center position
      gs.unstableGrounds = gs.unstableGrounds || [];
      if (!gs.unstableGrounds.some(g => Math.hypot(g.row - currentR, g.col - currentC) < 0.4)) {
        gs.unstableGrounds.push({
          row: currentR,
          col: currentC,
          duration: 3,
          isBurningGround: true,
          creator: piece
        });
      }

      // 3. Find a safe adjacent point to move the Tyrant to
      const isCandidateValid = cand => {
        if (cand.r < 0 || cand.r >= C.ROWS || cand.c < 0 || cand.c >= C.COLS) return false;
        if ((gs.voidSquares || []).some(v => Math.hypot(v.row - cand.r, v.col - cand.c) < 0.6)) return false;
        if ((gs.glacialWalls || []).some(w => Math.hypot(w.row - cand.r, w.col - cand.c) < 0.6)) return false;
        if ((gs.specialTerrains || []).some(t => t.type === 'crater' && Math.hypot(t.row - cand.r, t.col - cand.c) < 0.6 && !(Math.hypot(t.row - currentR, t.col - currentC) < 0.2))) return false;
        if ((gs.pieces || []).some(p => p.id !== piece.id && Math.hypot(p.row - cand.r, p.col - cand.c) < 0.7)) return false;
        return true;
      };

      const candidates = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          candidates.push({ r: currentR + dr, c: currentC + dc });
        }
      }
      let validCandidates = candidates.filter(isCandidateValid);

      // Fallback to radius 2 if all adjacent cells are blocked
      if (validCandidates.length === 0) {
        const radius2Candidates = [];
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue;
            radius2Candidates.push({ r: currentR + dr, c: currentC + dc });
          }
        }
        radius2Candidates.sort((a, b) => Math.hypot(a.r - currentR, a.c - currentC) - Math.hypot(b.r - currentR, b.c - currentC));
        validCandidates = radius2Candidates.filter(isCandidateValid);
      }

      const choice = validCandidates.length > 0 ? validCandidates[0] : null;

      // Emit DeathMeteor animation with explicit origin and destination
      emit(gs, {
        type: 'ANIMATION',
        name: 'DeathMeteor',
        pieceId: piece.id,
        originR: currentR,
        originC: currentC,
        targetR: choice ? choice.r : currentR,
        targetC: choice ? choice.c : currentC
      });

      if (choice) {
        piece.deathMeteorOrigin = { row: currentR, col: currentC };
        updatePiecePosition(piece, choice.r, choice.c, gs);
      }

      // Resolve collateral deaths caused by the explosion
      resolveDeaths(gs, piece);

      return true; // intercept: do NOT capture
    }
  }

  return false;
}

// Unified handler for unit destruction (reverts tethers, triggers passives)
export function handlePieceCapture(capturedPiece, attacker = null, gs = gameState) {
  if (!capturedPiece) return false;

  // 0. Intercept deaths via passives (e.g. Ash Tyrant's Death Meteor)
  if (applyAoeLethalPassives(capturedPiece, gs)) {
    return false; // Intercepted, piece survives
  }


  // 1b. Revert magma grips involving this piece
  if (gs.TheReapersTolls) {
    gs.TheReapersTolls = gs.TheReapersTolls.filter(mg => {
      if (mg.harvesterId === capturedPiece.id) {
        const target = gs.pieces.find(p => p.id === mg.targetId);
        if (target) {
          target.def = (target.def || 0) + (mg.defStolen || 0);
          target.agility = (target.agility || 1) + (mg.agiStolen || 0);
        }
        return false;
      }
      if (mg.targetId === capturedPiece.id) {
        const harvester = gs.pieces.find(p => p.id === mg.harvesterId);
        if (harvester) {
          harvester.def = Math.max(0, (harvester.def || 0) - (mg.defStolen || 0));
          harvester.agility = Math.max(0.1, (harvester.agility || 1) - (mg.agiStolen || 0));
        }
        return false;
      }
      return true;
    });
  }

  // 2. Martyrdom / Vengeance
  if (
    gs.factionPassives[capturedPiece.team]?.ascension?.Martyrdom &&
    attacker &&
    !attacker.isSteadfast
  ) {
    attacker.isDazed = true;
    attacker.dazedFor = 2;
  }
  if (gs.factionPassives[capturedPiece.team]?.ascension?.Vengeance && attacker) {
    gs.markedPieces.push({ targetId: attacker.id, duration: 2 });
  }

  // 3. Cold Snap: if this piece was a FateLink target, heal the Soul Linker
  if (gs.fateLinks) {
    const link = gs.fateLinks.find(fl => fl.targetId === capturedPiece.id);
    if (link) {
      const soulLinker = gs.pieces.find(p => p.id === link.sourceId);
      if (soulLinker) {
        const maxHp = soulLinker.maxHp || C.PIECE_TYPES[soulLinker.key]?.stats?.hp || 8;
        const missingHp = maxHp - soulLinker.currentHp;
        if (missingHp >= 2) {
          soulLinker.currentHp = Math.min(maxHp, soulLinker.currentHp + 2);
          flash(`Cold Snap! Soul Linker healed for 2 HP.`, soulLinker.team, gs);
        } else {
          // At full HP or missing 1 — crystallise into Frost Shield
          gs.shields = gs.shields || [];
          gs.shields.push({ pieceId: soulLinker.id, duration: 999, name: 'FrostShield' });
          flash(`Cold Snap! Frost Shield formed on Soul Linker.`, soulLinker.team, gs);
        }
      }
      gs.fateLinks = gs.fateLinks.filter(fl => fl.targetId !== capturedPiece.id);
    }
  }

  // 3b. A Cold Farewell (Ice Wisp death passive)
  if (capturedPiece.key === "snowIceWisp") {
    const rad = C.ABILITY_VALUES.AColdFarewell?.radius || 1.5;
    gs.temporaryBoosts = gs.temporaryBoosts || [];
    gs.debuffs = gs.debuffs || [];

    gs.pieces.forEach(p => {
      if (p.id !== capturedPiece.id && p.currentHp > 0) {
        if (Math.hypot(p.row - capturedPiece.row, p.col - capturedPiece.col) <= rad) {
          if (p.team !== capturedPiece.team) {
            p.currentHp = Math.max(0, Math.round((p.currentHp - (C.ABILITY_VALUES.AColdFarewell?.damage || 2)) * 10) / 10);
            gs.debuffs.push({ pieceId: p.id, duration: C.ABILITY_VALUES.AColdFarewell?.duration || 4, amount: C.ABILITY_VALUES.AColdFarewell?.agilityDebuff || 0.4, name: "ColdFarewellAgi" });
            gs.debuffs.push({ pieceId: p.id, duration: 2, amount: 0, name: "ColdFarewellControlLock" }); // 2 turns = "their next move"
          } else {
            gs.temporaryBoosts.push({ pieceId: p.id, duration: C.ABILITY_VALUES.AColdFarewell?.duration || 4, amount: C.ABILITY_VALUES.AColdFarewell?.strengthBoost || 1, name: "ColdFarewellStr" });
          }
        }
      }
    });

    gs.blizzardStorms = gs.blizzardStorms || [];
    gs.blizzardStorms.push({
      r: capturedPiece.row,
      c: capturedPiece.col,
      duration: C.ABILITY_VALUES.AColdFarewell?.duration || 4,
      radius: rad,
      team: capturedPiece.team
    });

    emit(gs, { type: "ANIMATION", name: "AColdFarewell", r: capturedPiece.row, c: capturedPiece.col });
  }

  // Drop Magma Shards if captured unit has ObsidianPillarShield
  const activeShield = gs.shields && gs.shields.find(s => s.pieceId === capturedPiece.id && s.name === 'ObsidianPillarShield');
  if (activeShield) {
    gs.specialTerrains = gs.specialTerrains || [];
    gs.specialTerrains.push({
      row: capturedPiece.row,
      col: capturedPiece.col,
      type: 'magmaShards',
      duration: 2,
      age: 0
    });
    gs.shields = gs.shields.filter(s => s !== activeShield);
  }

  // 4. Remove piece
  gs.pieces = gs.pieces.filter((p) => p.id !== capturedPiece.id);

  // 5. End game if leader
  if (capturedPiece.key.includes("Lord") || capturedPiece.key.includes("Tyrant")) {
    endGame(attacker ? attacker.team : (capturedPiece.team === "snow" ? "ash" : "snow"), gs);
  }

  flash(`${C.PIECE_TYPES[capturedPiece.key]?.name || 'Unit'} was captured!`, attacker ? attacker.team : 'neutral', gs);
  return true;
}

// ============================================================================
// ABILITY ACTIVATION & EXECUTION
// ============================================================================
export function activateAbility(piece, unleashCostOrKey = 0, gs = gameState) {
  if (!piece) return false;
  if ((piece.stuck || 0) > 0 || piece.isDazed) {
    flash(
      "This unit cannot use abilities while stuck or dazed.",
      piece.team,
      gs
    );
    return false;
  }
  let abilityKeyToUse;

  if (typeof unleashCostOrKey === "string" && C.ABILITIES[unleashCostOrKey]) {
    const isSecondary = piece.secondaryAbilityKey === unleashCostOrKey;
    if (isSecondary) {
      if (piece.secondaryAbilityCooldown > 0) return false;
      abilityKeyToUse = unleashCostOrKey;
    } else {
      const cost = C.ABILITIES[unleashCostOrKey]?.cost || 0;
      if ((piece.charges || 0) < cost) return false;
      abilityKeyToUse = unleashCostOrKey;
    }
  } else if (
    piece.ability &&
    piece.ability.key &&
    piece.ability.cooldown <= 0
  ) {
    abilityKeyToUse = piece.ability.key;
  } else return false;

  const ability = C.ABILITIES[abilityKeyToUse];
  if (!ability) return false;

  emit(gs, { type: "HIDE_ABILITY_PANEL" });

  if (abilityKeyToUse === "GlacialWall" || (piece.ability?.isVeteranFortress && abilityKeyToUse === "GlacialFortress")) {
    setCurrentState(GameState.WALL_PLACEMENT_FIRST, gs);
    gs.abilityContext = { piece, abilityKey: "GlacialWall" };
    flash("Select a location for the first wall.", piece.team, gs);
    return false;
  }

  if (abilityKeyToUse === "FateLink") {
    ensureSets(gs);
    gs.abilityContext = { piece, abilityKey: abilityKeyToUse, step: 1 };
    setCurrentState(GameState.ABILITY_TARGETING, gs);
    flash("Select a friendly target for Fate Link.", piece.team, gs);
    return false;
  }

  if (!ability.requiresTargeting)
    return executeAbility(piece, null, abilityKeyToUse, gs);

  ensureSets(gs);
  gs.abilityContext = { piece, abilityKey: abilityKeyToUse };
  setCurrentState(GameState.ABILITY_TARGETING, gs);
  flash(`Select a target for ${ability.name}.`, piece.team, gs);
  return false;
}

export function executeAbility(
  piece,
  target = null,
  abilityKey = null,
  gameStateLocal = gameState,
  isAiTurn = false
) {
  const ability = C.ABILITIES[abilityKey];
  if (!ability) {
    // Defensive: unknown ability key received (possibly UI sent an incomplete payload)
    flash(
      `Internal error: unknown ability '${abilityKey}'.`,
      piece?.team || "neutral",
      gameStateLocal
    );
    return false;
  }

  if (
    ability.requiresTargeting &&
    !isTargetValid(piece, target, ability, gameStateLocal)
  ) {
    if (!isAiTurn) {
      flash("Invalid target.", piece.team, gameStateLocal);
      deselectPiece(gameStateLocal);
    }
    return false;
  }
  ensureSets(gameStateLocal);

  if (abilityKey === "IcyShift" || abilityKey === "TacticalSwapAsh") {
    if (!target) return false;
    const targetPiece = C.getPieceAt(
      target.r,
      target.c,
      gameStateLocal.pieces
    );
    if (!targetPiece) return false;
    const pieceRow = piece.row,
      pieceCol = piece.col;
    updatePiecePosition(piece, targetPiece.row, targetPiece.col, gameStateLocal);
    updatePiecePosition(targetPiece, pieceRow, pieceCol, gameStateLocal);
    piece.isDazed = true;
    piece.dazedFor = C.ABILITY_VALUES[abilityKey].duration;
    targetPiece.isDazed = true;
    targetPiece.dazedFor = C.ABILITY_VALUES[abilityKey].duration;
    piece.secondaryAbilityCooldown = C.ABILITY_VALUES[abilityKey].cooldown;
    flash(
      `${C.PIECE_TYPES[piece.key].name} swaps with ${C.PIECE_TYPES[targetPiece.key].name
      }!`,
      piece.team,
      gameStateLocal
    );
    if (!isAiTurn) deselectPiece(gameStateLocal);
    updateBoardMap(gameStateLocal);
    checkTerritoryThresholds(gameStateLocal);
    return true;
  }

  const oldPositions = gameStateLocal.pieces.map((p) => ({
    id: p.id,
    r: p.row,
    c: p.col
  }));

  const targetPiece = target ? C.getPieceAt(target.r, target.c, gameStateLocal.pieces) : null;
  let blocked = false;

  // 1. DEFENSIVE CHECKS
  if (targetPiece?.hasPriestsWard && ability.canBeBlocked) {
    targetPiece.hasPriestsWard = false;
    flash(`${C.PIECE_TYPES[targetPiece.key].name}'s Ward blocked ${ability.name}!`, targetPiece.team, gameStateLocal);
    blocked = true;
  } else if (targetPiece?.hasPermanentAegis && ability.canBeBlocked) {
    flash(`${C.PIECE_TYPES[targetPiece.key].name}'s Aegis blocked ${ability.name}!`, targetPiece.team, gameStateLocal);
    blocked = true;
  }

  // 2. EFFECT EXECUTION
  if (!blocked) {
    if (piece.isVeteranSiphonCharge && abilityKey === "SiphonCharge") {
      const mainAbilityKey = C.PIECE_TYPES[piece.key].ability.key;
      piece.power = Math.max(0, piece.power - (C.ABILITY_VALUES?.SiphonCharge?.permDamageCost || 1));
      if (piece.ability?.key === mainAbilityKey) {
        piece.ability.cooldown = 0;
      }
      piece.secondaryAbilityCooldown = 0;
      flash(`${C.PIECE_TYPES[piece.key].name} recharges ${C.ABILITIES[mainAbilityKey]?.name || 'ability'}!`, piece.team, gameStateLocal);
      if (!isAiTurn) deselectPiece(gameStateLocal);
      updateBoardMap(gameStateLocal);
      return true;
    }

    const oldRow = piece.row, oldCol = piece.col;

    // Execute standard or special effects
    if (abilityKey === "Siphon") {
      const success = handleSiphon(piece, gameStateLocal);
      if (!success) {
        if (!isAiTurn) deselectPiece(gameStateLocal);
        return false; // Invalid siphon context
      }
    } else if (abilityKey === "Pummel" && targetPiece) {
      const tgtOldR = targetPiece.row, tgtOldC = targetPiece.col;
      ability.effect(piece, target, gameStateLocal, (r, c, k, t) => createPiece(r, c, k, t, gameStateLocal));
      if (targetPiece.row !== tgtOldR || targetPiece.col !== tgtOldC) {
        emit(gameStateLocal, { type: "ANIMATION", name: "PummelKnockback", targetPieceId: targetPiece.id, attackerR: oldRow, attackerC: oldCol, oldRow: tgtOldR, oldCol: tgtOldC, newRow: targetPiece.row, newCol: targetPiece.col });
      }
    } else if (ability.effect) {
      ability.effect(piece, target, gameStateLocal, (r, c, k, t) => createPiece(r, c, k, t, gameStateLocal));
    }

    // Attach specific animations
    if (abilityKey === "FrenziedDash") {
      emit(gameStateLocal, { type: "ANIMATION", name: "FrenziedDash", pieceId: piece.id, oldRow, oldCol, targetR: target.r, targetC: target.c });
    } else if (abilityKey === "GlacialFracture") {
      // 1. Damage enemies within continuous radius
      let enemiesCaught = [];
      const rad = C.ABILITY_VALUES.GlacialFracture.radius;
      (gameStateLocal.pieces || []).forEach(p => {
        if (p.team !== piece.team && p.currentHp > 0) {
          if (Math.hypot(p.row - target.r, p.col - target.c) <= rad + 0.45) {
            enemiesCaught.push(p);
            p.currentHp = Math.max(0, Math.round((p.currentHp - C.ABILITY_VALUES.GlacialFracture.damage) * 10) / 10);
          }
        }
      });

      // Convert nearby ground to snow territory
      for (let r = -Math.floor(rad + 0.5); r <= Math.ceil(rad + 0.5); r++) {
        for (let c = -Math.floor(rad + 0.5); c <= Math.ceil(rad + 0.5); c++) {
          if (Math.hypot(r, c) <= rad + 0.5) {
            const tr = Math.round(target.r + r);
            const tc = Math.round(target.c + c);
            if (inBounds(tr, tc)) {
              gameStateLocal.snowTerritory.add(`${tr},${tc}`);
              gameStateLocal.ashTerritory.delete(`${tr},${tc}`);
            }
          }
        }
      }

      // 3. Check wisp resonance limit
      const currentWisps = gameStateLocal.pieces.filter(p => p.key === "snowIceWisp" && p.team === piece.team && p.currentHp > 0);
      if (currentWisps.length >= C.ABILITY_VALUES.GlacialFracture.wispCap) {
        flash("Glacial Mage Resonance Maxed: No further Wisps can be sustained", "snow", gameStateLocal);
        return false; // Preserves turn action
      }

      // 4. Spawn Ice Wisp logic at optimal open continuous location
      let bestTile = null;
      let maxDistSum = -1;
      let closestToMage = Infinity;

      for (let r = -Math.floor(rad); r <= Math.ceil(rad); r++) {
        for (let c = -Math.floor(rad); c <= Math.ceil(rad); c++) {
          if (Math.hypot(r, c) <= rad) {
            const tr = Math.round((target.r + r) * 10) / 10;
            const tc = Math.round((target.c + c) * 10) / 10;
            const isBlocked = (gameStateLocal.pieces || []).some(p => Math.hypot(p.row - tr, p.col - tc) < 0.7) ||
                              (gameStateLocal.glacialWalls || []).some(w => Math.hypot(w.row - tr, w.col - tc) < 0.6) ||
                              (gameStateLocal.voidSquares || []).some(v => Math.hypot(v.row - tr, v.col - tc) < 0.6);
            if (inBounds(Math.round(tr), Math.round(tc)) && !isBlocked) {
              if (enemiesCaught.length > 0) {
                let distSum = 0;
                enemiesCaught.forEach(ep => {
                  distSum += Math.hypot(ep.row - tr, ep.col - tc);
                });
                if (distSum > maxDistSum) {
                  maxDistSum = distSum;
                  bestTile = { r: tr, c: tc };
                }
              } else {
                let distToMage = Math.hypot(piece.row - tr, piece.col - tc);
                if (distToMage < closestToMage) {
                  closestToMage = distToMage;
                  bestTile = { r: tr, c: tc };
                }
              }
            }
          }
        }
      }

      if (bestTile && createPiece) {
        let isPower1 = false;
        if (piece.isVeteran && C.PIECE_TYPES[piece.key]?.veteranAbility?.key === "WispEnhancement") {
          isPower1 = true;
        } else if (gameStateLocal.factionPassives?.[piece.team]?.ascension?.PrimalPower) {
          isPower1 = true;
        }
        const newWisp = createPiece(bestTile.r, bestTile.c, "snowIceWisp", piece.team, gameStateLocal);
        newWisp.power = isPower1 ? 1 : 0;
        gameStateLocal.pieces.push(newWisp);
        emit(gameStateLocal, { type: "ANIMATION", name: "GlacialFracture", targetR: target.r, targetC: target.c, wispId: newWisp.id });
      } else {
        emit(gameStateLocal, { type: "ANIMATION", name: "GlacialFracture", targetR: target.r, targetC: target.c });
      }
    } else {
      if (abilityKey === "LavaGlob") {
        emit(gameStateLocal, { type: "ANIMATION", name: "LavaGlob", oldRow, oldCol, targetR: target.r, targetC: target.c });
      } else if (abilityKey === "SetSnare") {
        emit(gameStateLocal, { type: "ANIMATION", name: "TrapDeployment", oldRow, oldCol, targetR: target.r, targetC: target.c });
      } else if (abilityKey === "FrigidPath") {
        emit(gameStateLocal, { type: "ANIMATION", name: "FrigidPath", oldRow, oldCol, targetR: target.r, targetC: target.c });
      } else if (abilityKey === "FateLink") {
        emit(gameStateLocal, { type: "ANIMATION", name: "FateLink", targetR: target.r, targetC: target.c });
      } else if (abilityKey === "FrostfallBlessing") {
        emit(gameStateLocal, { type: "ANIMATION", name: "FrostfallBlessing", targetR: target.r, targetC: target.c });
      } else if (abilityKey === "ReignOfFire") {
        emit(gameStateLocal, { type: "ANIMATION", name: "ReignOfFire", pieceId: piece.id, targetR: target.r, targetC: target.c });
      } else if (abilityKey === "DeathMeteor") {
        emit(gameStateLocal, { type: "ANIMATION", name: "DeathMeteor", targetR: target.r, targetC: target.c });
      }
    }
  }

  // 3. RESOLVE TRAPS AND BOARD STATE (Runs even if blocked!)
  gameStateLocal.pieces.forEach((p) => {
    const oldPos = oldPositions.find((op) => op.id === p.id);
    if (oldPos && (oldPos.r !== p.row || oldPos.c !== p.col)) {
      checkSpecialTerrains(p, p.row, p.col, gameStateLocal);
      const isShrine = C.SHAPES.shrineArea.some(([sr, sc]) => sr === p.row && sc === p.col);
      if (isShrine && gameStateLocal.shrineIsOverloaded && !gameStateLocal.trappedPiece && !p.isTrapped) {
        p.isTrapped = true;
        gameStateLocal.trappedPiece = p.id;
      }
    }
  });

  // 4. APPLY COOLDOWNS & CONSUME CHARGES
  if (piece.ability?.key === abilityKey) {
    const baseCd = ability.cooldown || 0;
    piece.ability.cooldown = baseCd > 0 ? Math.max(1, baseCd - (piece.cooldownReduction || 0)) : 0;
  } else if (piece.secondaryAbilityKey === abilityKey) {
    const baseCd = ability.cooldown || 0;
    piece.secondaryAbilityCooldown = baseCd > 0 ? Math.max(1, baseCd - (piece.cooldownReduction || 0)) : 0;
  } else if (typeof ability.cost === "number") {
    piece.charges = Math.max(0, (piece.charges || 0) - ability.cost);
  }

  if (gameStateLocal.pieces.some((p) => p.id === piece.id)) {
    consumeCore(piece, piece.row, piece.col, gameStateLocal);
  }

  // 5. FINALIZE TURN
  resolveDeaths(gameStateLocal, piece);
  if (!isAiTurn) deselectPiece(gameStateLocal);
  updateBoardMap(gameStateLocal);
  updateConduitLink(gameStateLocal);
  checkTerritoryThresholds(gameStateLocal);
  return true;
}

export function handleAbilityClick(row, col, gs = gameState) {
  if (
    isState(GameState.WALL_PLACEMENT_FIRST, gs) ||
    isState(GameState.WALL_PLACEMENT_SECOND, gs)
  )
    return handleGlacialWall(row, col, gs);

  if (isState(GameState.TETHER_TARGETING, gs)) {
    const { siphoner, mode, allyTarget } = gs.abilityContext;
    const targetPiece = C.getPieceAt(row, col, gs.pieces);

    if (mode === "resonance") {
      if (!allyTarget) {
        if (targetPiece && targetPiece.team === siphoner.team) {
          if (targetPiece.id === siphoner.id) {
            flash(
              "Cannot select yourself for Resonance.",
              siphoner.team,
              gs
            );
            return false;
          }
          gs.abilityContext.allyTarget = targetPiece;
          flash(
            "Select an ENEMY target for Resonance.",
            siphoner.team,
            gs
          );
        } else {
          flash("Invalid target. Select an ALLY.", siphoner.team, gs);
        }
        return false;
      } else {
        if (targetPiece && targetPiece.team !== siphoner.team) {
          handleTether(siphoner, mode, allyTarget, targetPiece, gs);
          deselectPiece(gs);
          return true;
        } else {
          flash("Invalid target. Select an ENEMY.", siphoner.team, gs);
          return false;
        }
      }
    } else if (mode === "benevolent" || mode === "parasitic") {
      if (targetPiece && targetPiece.team === siphoner.team) {
        const ok = handleTether(siphoner, mode, targetPiece, null, gs);
        if (ok) {
          deselectPiece(gs);
          return true;
        }
        flash("Cannot siphon: target has no power.", siphoner.team, gs);
        return false;
      }
    } else if (mode === "hostile") {
      if (targetPiece && targetPiece.team !== siphoner.team) {
        const ok = handleTether(siphoner, mode, null, targetPiece, gs);
        if (ok) {
          deselectPiece(gs);
          return true;
        }
        flash("Cannot siphon: target has no power.", siphoner.team, gs);
        return false;
      }
    }
    flash("Invalid target.", siphoner.team, gs);
    return false;
  }

  if (isState(GameState.ABILITY_TARGETING, gs)) {
    const { piece, abilityKey, step, target1 } = gs.abilityContext;
    if (abilityKey === "FateLink") {
      const tp = C.getPieceAt(row, col, gs.pieces);
      if (step === 1) {
        if (tp && tp.team === piece.team && Math.hypot(tp.col - piece.col, tp.row - piece.row) <= C.ABILITIES.FateLink.range) {
          gs.abilityContext.step = 2;
          gs.abilityContext.target1 = { r: tp.row, c: tp.col, id: tp.id };
          flash("Select an enemy target for Fate Link.", piece.team, gs);
        } else {
          flash("Invalid friendly target.", piece.team, gs);
          deselectPiece(gs);
        }
        return false;
      } else if (step === 2) {
        if (tp && tp.team !== piece.team && Math.hypot(tp.col - piece.col, tp.row - piece.row) <= C.ABILITIES.FateLink.range) {
          return executeAbility(piece, { r: tp.row, c: tp.col, target1 }, abilityKey, gs);
        } else {
          flash("Invalid enemy target.", piece.team, gs);
          deselectPiece(gs);
          return false;
        }
      }
    }
    return executeAbility(piece, { r: row, c: col }, abilityKey, gs);
  }
  return false;
}

function handleGlacialWall(row, col, gs = gameState) {
  const piece = gs.selectedPiece;
  const targetPiece = C.getPieceAt(row, col, gs.pieces);
  const isVeteranFortress = piece.ability?.isVeteranFortress;

  if (isState(GameState.WALL_PLACEMENT_FIRST, gs)) {
    const isVoid = (gs.voidSquares || []).some(
      (v) => v.row === row && v.col === col
    );
    const hasWall = (gs.glacialWalls || []).some(
      (w) => w.row === row && w.col === col
    );
    if (
      !targetPiece &&
      !isVoid &&
      !hasWall &&
      Math.abs(piece.row - row) <= 1 &&
      Math.abs(piece.col - col) <= 1 &&
      !(piece.row === row && piece.col === col)
    ) {
      gs.firstWallCoords = { row, col };
      setCurrentState(GameState.WALL_PLACEMENT_SECOND, gs);
      flash("Select location for the second wall.", piece.team, gs);
    } else deselectPiece(gs);
    return false;
  }

  const { firstWallCoords } = gs;
  const isSecondVoid = (gs.voidSquares || []).some(
    (v) => v.row === row && v.col === col
  );
  const isSecondWall = (gs.glacialWalls || []).some(
    (w) => w.row === row && w.col === col
  );

  if (
    !targetPiece &&
    !isSecondVoid &&
    !isSecondWall &&
    Math.abs(firstWallCoords.row - row) <= 1 &&
    Math.abs(firstWallCoords.col - col) <= 1
  ) {
    gs.glacialWalls.push({
      row: firstWallCoords.row,
      col: firstWallCoords.col,
      duration: C.ABILITY_VALUES.GlacialWall.duration
    });
    emit(gs, {
      type: "ANIMATION",
      name: "GlacialWall",
      r: firstWallCoords.row,
      c: firstWallCoords.col
    });

    gs.glacialWalls.push({
      row,
      col,
      duration: C.ABILITY_VALUES.GlacialWall.duration
    });
    emit(gs, { type: "ANIMATION", name: "GlacialWall", r: row, c: col });

    if (isVeteranFortress) {
      const walls = [
        { r: firstWallCoords.row, c: firstWallCoords.col },
        { r: row, c: col }
      ];
      let placedThird = false;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          for (const wall of walls) {
            const r3 = wall.r + dr,
              c3 = wall.c + dc;
            if (
              r3 >= 0 &&
              r3 < C.ROWS &&
              c3 >= 0 &&
              c3 < C.COLS &&
              !C.getPieceAt(r3, c3, gs.pieces) &&
              !gs.glacialWalls.some(
                (w) => w.row === r3 && w.col === c3
              ) &&
              !(gs.voidSquares || []).some(
                (v) => v.row === r3 && v.col === c3
              )
            ) {
              gs.glacialWalls.push({
                row: r3,
                col: c3,
                duration: C.ABILITY_VALUES.GlacialWall.duration
              });
              emit(gs, {
                type: "ANIMATION",
                name: "GlacialWall",
                r: r3,
                c: c3
              });
              placedThird = true;
              break;
            }
          }
          if (placedThird) break;
        }
      piece.ability.cooldown = placedThird
        ? C.ABILITY_VALUES.GlacialFortress.cooldown
        : C.ABILITIES.GlacialWall.cooldown;
    } else piece.ability.cooldown = C.ABILITIES.GlacialWall.cooldown;
  }
  deselectPiece(gs);
  gs.firstWallCoords = null;
  updateBoardMap(gs);
  return true;
}

function isTargetValid(piece, target, ability, gameStateLocal = gameState) {
  if (!target) return !ability?.requiresTargeting;
  const { r, c } = target;
  const targetPiece = C.getPieceAt(r, c, gameStateLocal.pieces);
  let distance;
  if (ability.circularRange) {
    distance = Math.hypot(piece.row - r, piece.col - c);
  } else {
    distance = Math.max(Math.abs(piece.row - r), Math.abs(piece.col - c));
  }
  let abilityRange = ability.range;
  if (gameStateLocal?.testMode && (['ashMagmaShaper', 'snowFrostLord', 'ashAshTyrant', 'snowGlacialMage', 'snowSoulLinker', 'ashAshReaper', 'snowIceWisp'].includes(piece.key))) {
    abilityRange = 10;
  }
  if (abilityRange > 0 && distance > abilityRange) return false;
  if (targetPiece?.hasDefensiveWard && ability.canBeBlocked) return false;

  // Vision / Line of Sight Check:
  // Abilities that can be blocked require an unobstructed line of sight from the caster to target
  if (ability.canBeBlocked && !['FrostfallBlessing', 'ReignOfFire', 'GlacialFracture'].includes(ability.key || ability.name)) {
    const los = C.hasLineOfSight(piece.row, piece.col, r, c, gameStateLocal, {
      ignoredPieceId: piece.id,
      targetPieceId: targetPiece?.id || null
    });
    if (!los.hasLos) return false;
  }

  switch (ability.targetType) {
    case "enemy":
      return targetPiece && targetPiece.team !== piece.team;
    case "friendly":
      return targetPiece && targetPiece.team === piece.team;
    case "empty":
      return (
        !targetPiece &&
        !(gameStateLocal.glacialWalls || []).some(
          (w) => w.row === r && w.col === c
        ) &&
        !(gameStateLocal.voidSquares || []).some(
          (v) => v.row === r && v.col === c
        ) &&
        !(gameStateLocal.specialTerrains || []).some(
          (t) => t.type === 'crater' && Math.round(t.row) === r && Math.round(t.col) === c
        )
      );
    case "any":
      if (ability.name === "Obsidian Pillar" || ability?.key === "ObsidianPillar") {
        if (targetPiece) return true;
        const isWall = (gameStateLocal.glacialWalls || []).some(w => w.row === r && w.col === c);
        const isVoid = (gameStateLocal.voidSquares || []).some(v => v.row === r && v.col === c);
        const isCrater = (gameStateLocal.specialTerrains || []).some(t => t.type === 'crater' && Math.round(t.row) === r && Math.round(t.col) === c);
        return !isWall && !isVoid && !isCrater;
      }
      return true;
    case "special":
      return ability.specialTargeting(piece, target, gameStateLocal);
    default:
      return false;
  }
}

// ============================================================================
// MOVEMENT & COMBAT
// ============================================================================
export function movePiece(piece, targetRow, targetCol, isHighwayMove = false, gs = gameState) {
  if (!gs.gameStarted) return false;
  if (
    gs.gameOver ||
    !piece ||
    piece.isDazed ||
    (piece.stuck || 0) > 0 ||
    piece.isTrapped ||
    piece.team !== gs.currentTurn
  )
    return false;

  ensureSets(gs);

  const startRow = piece.row;
  const startCol = piece.col;

  // 1. Exact grid check for any other piece at destination
  const occupyingPiece = (gs.pieces || []).find(
    (p) => p.id !== piece.id && Math.hypot(p.col - targetCol, p.row - targetRow) < 0.7
  );

  // Pieces can NEVER land on or overlap an allied unit
  if (occupyingPiece && occupyingPiece.team === piece.team) {
    return false;
  }

  const defender = occupyingPiece;

  let finalTargetCol = targetCol;
  let finalTargetRow = targetRow;

  if (defender) {
    finalTargetCol = defender.col;
    finalTargetRow = defender.row;
  }

  // Assign back to targetRow/targetCol so all subsequent logic behaves perfectly!
  targetRow = finalTargetRow;
  targetCol = finalTargetCol;

  const isActualHighway = isHighwayMove;
  let addedBoost = false;

  const actionTaken = () => {
    gs.lastMoveIndicator = { row: piece.row, col: piece.col, life: 1.0 };
    deselectPiece(gs);
    updateBoardMap(gs);
    updateConduitLink(gs);
    checkTerritoryThresholds(gs);
  };

  if (isActualHighway) {
    gs.temporaryBoosts.push({
      pieceId: piece.id,
      amount: C.ANCHOR_AURA_POWER,
      duration: C.CONDUIT_HIGHWAY_BUFF_DURATION,
      name: "ConduitHighwayBuff"
    });
    addedBoost = true;
  }

  const isMovingToShrine = C.SHAPES.shrineArea.some(
    ([r, c]) => Math.hypot(c - targetCol, r - targetRow) <= 0.5
  );

  if (isMovingToShrine && gs.shrineIsOverloaded) {
    const trapped = gs.pieces.find(
      (p) => p.id === gs.trappedPiece
    );
    if (
      defender &&
      trapped &&
      trapped.team !== piece.team &&
      defender.id === trapped.id
    ) {
      applySacrificeBuff(piece.team, gs);
      gs.pieces = gs.pieces.filter((p) => p.id !== trapped.id);
      resetShrine(gs);
      updatePiecePosition(piece, targetRow, targetCol, gs);
      checkSpecialTerrains(piece, targetRow, targetCol, gs);
      actionTaken();
      return true;
    } else if (!defender && !trapped) {
      updatePiecePosition(piece, targetRow, targetCol, gs);
      piece.isTrapped = true;
      gs.trappedPiece = piece.id;
      actionTaken();
      return true;
    }
  }

  // Inside movePiece, replace the capture block
  if (defender && defender.team !== piece.team) {
    if (isCaptureSuccessful(piece, defender, gs)) {
      const actuallyCaptured = handlePieceCapture(defender, piece, gs);

      if (!actuallyCaptured) {
        // Intercepted by lethal passives (e.g. Death Meteor)
        if (piece.readyForVeteranPromotion) {
          piece.readyForVeteranPromotion = false;
          promoteToVeteran(piece, gs);
        }
      } else {
        const color = defender.team === "ash" ? "#ff4400" : "#00ccff";
        emit(gs, {
          type: "ANIMATION",
          name: "ShatterCapture",
          r: defender.row,
          c: defender.col,
          color
        });

        if (gs.factionPassives[piece.team].ascension.HitAndRun)
          piece.isEntrenched = true;

        if (piece.readyForVeteranPromotion) {
          piece.readyForVeteranPromotion = false;
          promoteToVeteran(piece, gs);
        }
        if (isMovingToShrine) handleShrineCapture(piece, defender, gs);

        updatePiecePosition(piece, targetRow, targetCol, gs);
        if (
          isMovingToShrine &&
          gs.shrineIsOverloaded &&
          !gs.trappedPiece
        ) {
          piece.isTrapped = true;
          gs.trappedPiece = piece.id;
        }
      }
    } else {
      if (piece.readyForVeteranPromotion) {
        piece.readyForVeteranPromotion = false;
        promoteToVeteran(piece, gs);
      }
    }
  } else {
    // Empty ground move: ensure target position is not blocked by an impassable obstacle
    const isBlocked = (gs.voidSquares || []).some(v => Math.hypot(v.row - targetRow, v.col - targetCol) < 0.6) ||
                      (gs.glacialWalls || []).some(w => Math.hypot(w.row - targetRow, w.col - targetCol) < 0.6) ||
                      (gs.specialTerrains || []).some(t => t.type === 'crater' && Math.hypot(t.row - targetRow, t.col - targetCol) < 0.65);
    if (isBlocked) return false;

    if (!gs.movePulses) gs.movePulses = [];
    gs.movePulses.push({ startRow, startCol, targetRow, targetCol, team: piece.team, life: 1.0 });
    updatePiecePosition(piece, targetRow, targetCol, gs);
  }

  checkSpecialTerrains(piece, piece.row, piece.col, gs);
  consumeCore(piece, piece.row, piece.col, gs);
  actionTaken();
  return true;
}

function paintTerritoryPath(piece, startRow, startCol, endRow, endCol, gs = gameState) {
  if (!gs.territoryTrails) gs.territoryTrails = [];
  if (!gs.territoryCaptureTurn) gs.territoryCaptureTurn = {};

  const dist = Math.hypot(endCol - startCol, endRow - startRow);
  const radius = piece ? getEffectiveControl(piece, gs) : 1;
  const team = piece ? piece.team : 'snow';
  const steps = dist === 0 ? 0 : Math.max(1, Math.ceil(dist / 0.5));
  const newPoints = [];

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const r = startRow + (endRow - startRow) * t;
    const c = startCol + (endCol - startCol) * t;

    const isRedundant = gs.territoryTrails.some(oldT => {
      if (oldT.team !== team || oldT.radius < radius) return false;
      const dx = oldT.col - c;
      const dy = oldT.row - r;
      return (dx * dx + dy * dy) < 0.04;
    });

    if (!isRedundant) {
      newPoints.push({
        row: r,
        col: c,
        radius: radius,
        team: team,
        time: Date.now()
      });
    }

    const minR = Math.max(0, Math.floor(r - radius));
    const maxR = Math.min(9, Math.ceil(r + radius));
    const minC = Math.max(0, Math.floor(c - radius));
    const maxC = Math.min(9, Math.ceil(c + radius));

    for (let gr = minR; gr <= maxR; gr++) {
      for (let gc = minC; gc <= maxC; gc++) {
        const dx = gr - r;
        const dy = gc - c;
        if ((dx * dx + dy * dy) <= radius * radius) {
          const pos = `${gr},${gc}`;
          if (team === 'snow') {
            gs.snowTerritory.add(pos);
            gs.ashTerritory.delete(pos);
          } else {
            gs.ashTerritory.add(pos);
            gs.snowTerritory.delete(pos);
          }
          gs.territoryCaptureTurn[pos] = gs.turnCount;
        }
      }
    }
  }

  // Prune overlapping same-team and other-team trail circles for incredible performance!
  if (newPoints.length > 0) {
    const radiusSqOther = radius * radius;
    const radiusSqSame = (radius * 0.5) * (radius * 0.5);
    gs.territoryTrails = gs.territoryTrails.filter(oldT => {
      const radiusSq = oldT.team !== team ? radiusSqOther : radiusSqSame;
      for (let i = 0; i < newPoints.length; i++) {
        const np = newPoints[i];
        const dx = oldT.col - np.col;
        const dy = oldT.row - np.row;
        if ((dx * dx + dy * dy) <= radiusSq) {
          return false;
        }
      }
      return true;
    });
  }

  // Push new points to trails AFTER pruning so they don't self-prune
  gs.territoryTrails.push(...newPoints);

  // Hard cap to prevent runaway array growth causing massive network and render lag
  if (gs.territoryTrails.length > 500) {
    gs.territoryTrails = gs.territoryTrails.slice(-500);
  }
}

function updatePiecePosition(p, r, c, gs = gameState) {
  const startR = p.row;
  const startC = p.col;
  p.row = r;
  p.col = c;
  paintTerritoryPath(p, startR, startC, r, c, gs);
  updateVoronoiState(gs);
}

// ============================================================================
// SYSTEM UTILITIES (Selection, Creation, Turn Management)
// ============================================================================
export function selectPiece(piece, gs = gameState) {
  if (!gs.gameStarted) return false;
  if (
    (!gs.testMode && piece.team !== gs.currentTurn) ||
    isState(GameState.ASCENSION_CHOICE, gs)
  )
    return;
  if (gs.testMode && piece.team !== gs.currentTurn) {
    gs.currentTurn = piece.team;
  }
  gs.selectedPiece = piece;
  setCurrentState(GameState.PIECE_SELECTED, gs);
  emit(gs, { type: "SHOW_ABILITY_PANEL", pieceId: piece.id });
}

export function deselectPiece(gs = gameState) {
  if (gs.selectedPiece) emit(gs, { type: "HIDE_ABILITY_PANEL" });
  gs.selectedPiece = null;
  gs.abilityContext = null;
  setCurrentState(GameState.AWAITING_PIECE_SELECTION, gs);
}

export function createPiece(r, c, key, team, gs = gameState) {
  const properties = C.PIECE_TYPES[key] || {};
  const stats = properties.stats || { hp: 5, def: 1, strength: 2, range: 1, agility: 2 };
  let ability;
  if (properties.ability?.name) {
    const abilityKey = properties.ability.key || properties.ability.name;
    if (abilityKey === "Siphon")
      ability = { ...properties.ability, key: abilityKey, cooldown: 0 };
    else {
      const baseAbility = C.ABILITIES[abilityKey] || {};
      ability = {
        ...properties.ability,
        ...baseAbility,
        key: abilityKey,
        cooldown: 0
      };
    }
  }
  const veteranAbility = properties.veteranAbility || {};
  const pieceId = (gs && gs.pieceIdCounter !== undefined) ? gs.pieceIdCounter++ : (gameState.pieceIdCounter !== undefined ? gameState.pieceIdCounter++ : 0);
  const piece = {
    id: pieceId,
    team,
    name: properties.name || key,
    row: r,
    col: c,
    key,
    power: properties.power ?? stats.strength,
    maxHp: stats.hp,
    currentHp: stats.hp,
    def: stats.def,
    strength: stats.strength,
    range: stats.range,
    agility: stats.agility,
    control: stats.control || 0.1,
    ability,
    veteranAbility: { ...veteranAbility },
    boosts: properties.boosts || {},
    shrineBoost: 0,
    anchorBoost: 0,
    isPhasing: false,
    isTrapped: false,
    isSteadfast: false,
    hasPriestsWard: false,
    isRampaging: false,
    isAcrobat: false,
    isElementalHarmony: false,
    isConduitTier1: false,
    isVeteran: false,
    vanquishes: 0,
    secondaryAbilityKey: veteranAbility.key || null,
    secondaryAbilityCooldown: 0,
    isVeteranWispEnhancement: false,
    isVeteranSiphonCharge: false,
    ability: { ...ability },
    canRiftPulse: false,
    hasUsedRiftPulse: false
  };
  return piece;
}


export function despawnPiece(piece, gs = gameState) {
  if (!piece || piece.key !== "snowIceWisp") return;
  handlePieceCapture(piece, null, gs);
  flash("The Ice Wisp dissipates.", "snow", gs);
  deselectPiece(gs);
  updateBoardMap(gs);
  updateConduitLink(gs);
  checkTerritoryThresholds(gs);
}

export function promoteToVeteran(piece, gs = gameState) {
  if (
    piece.isVeteran ||
    piece.key.includes("Tyrant") ||
    piece.key.includes("Lord") ||
    piece.key.includes("Wisp")
  )
    return false;
  piece.isVeteran = true;
  const vetAb = C.PIECE_TYPES[piece.key]?.veteranAbility;
  if (vetAb?.isPermanentUpgrade) {
    switch (vetAb.key) {
      case "WispEnhancement":
        piece.isVeteranWispEnhancement = true;
        break;
      case "GlacialFortress":
        piece.ability.isVeteranFortress = true;
        break;
      case "VolatileForge":
        piece.ability.isVeteranForge = true;
        break;
      case "SiphonCharge":
        piece.isVeteranSiphonCharge = true;
        break;
    }
  }
  if (piece.secondaryAbilityKey && vetAb && vetAb.cooldown)
    piece.secondaryAbilityCooldown = vetAb.cooldown;
  flash(
    `${C.PIECE_TYPES[piece.key].name} becomes a Veteran!`,
    piece.team,
    gs
  );
  return true;
}

// (Ultimate functions removed — leaders use standard ability system)

// ============================================================================
// SIPHONER, TETHER & OVERLOAD LOGIC
// ============================================================================
export function handleSiphon(piece, gs = gameState) {
  if (!piece || piece.charges >= piece.ability.maxCharges) return false;
  const rift = C.SHAPES.riftAreas.find((r) =>
    r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col)
  );
  const isOnFriendlyTerritory =
    gs.factionPassives[piece.team].ascension.ArcaneAttunement &&
    (piece.team === "snow"
      ? gs.snowTerritory
      : gs.ashTerritory
    ).has(`${piece.row},${piece.col}`);

  if (
    rift ||
    C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col) ||
    isOnFriendlyTerritory
  ) {
    piece.charges++;
    emit(gs, {
      type: "ANIMATION",
      name: "SiphonParticles",
      pieceId: piece.id,
      source: rift ? "rift" : "shrine"
    });
    flash(
      `${C.PIECE_TYPES[piece.key].name} siphons energy.`,
      piece.team,
      gs
    );
    deselectPiece(gs);
    return true;
  }
  return false;
}

export function handleTether(
  siphoner,
  mode,
  allyPiece = null,
  enemyPiece = null,
  gs = gameState
) {
  if (!siphoner || siphoner.ability?.key !== "Siphon") return false;
  const onRift = C.SHAPES.riftAreas.some((r) =>
    r.cells.some(([rr, cc]) => rr === siphoner.row && cc === siphoner.col)
  );
  const maxRange = onRift ? 4 : 3;
  const canReach = (target) =>
    target &&
    Math.max(
      Math.abs(siphoner.row - target.row),
      Math.abs(siphoner.col - target.col)
    ) <= maxRange;

  if (Array.isArray(siphoner.tethers) && siphoner.tethers.length > 0) {
    for (let i = siphoner.tethers.length - 1; i >= 0; i--) {
      const t = siphoner.tethers[i];
      const ally =
        t.allyId !== null
          ? gs.pieces.find((p) => p.id === t.allyId)
          : null;
      const enemy =
        t.enemyId !== null
          ? gs.pieces.find((p) => p.id === t.enemyId)
          : null;
      if (t.mode === "benevolent") {
        siphoner.power += 1;
        if (ally) ally.power = Math.max(0, ally.power - 1);
      } else if (t.mode === "hostile") {
        siphoner.power = Math.max(0, siphoner.power - 1);
        if (enemy) enemy.power += 1;
      } else if (t.mode === "parasitic") {
        siphoner.power = Math.max(0, siphoner.power - 1);
        if (ally) ally.power += 1;
      } else if (t.mode === "resonance") {
        if (ally) ally.power = Math.max(0, ally.power - 1);
        if (enemy) enemy.power += 1;
      }
    }
    siphoner.tethers = [];
  }

  if (mode === "benevolent") {
    if (!allyPiece || allyPiece.team !== siphoner.team || !canReach(allyPiece))
      return false;
    siphoner.power = Math.max(0, siphoner.power - 1);
    allyPiece.power = (allyPiece.power || 0) + 1;
    siphoner.overloadPoints = (siphoner.overloadPoints || 0) + 1;
    siphoner.tethers.push({
      siphonerId: siphoner.id,
      allyId: allyPiece.id,
      enemyId: null,
      mode: "benevolent"
    });
    flash(
      `${C.PIECE_TYPES[siphoner.key].name} forms a Benevolent Link with ${C.PIECE_TYPES[allyPiece.key].name
      }.`,
      siphoner.team,
      gs
    );
    deselectPiece(gs);
    return true;
  } else if (mode === "hostile") {
    if (
      !enemyPiece ||
      enemyPiece.team === siphoner.team ||
      !canReach(enemyPiece) ||
      (enemyPiece.power || 0) <= 0
    )
      return false;
    enemyPiece.power = Math.max(0, enemyPiece.power - 1);
    siphoner.power = (siphoner.power || 0) + 1;
    siphoner.overloadPoints = (siphoner.overloadPoints || 0) + 1;
    siphoner.tethers.push({
      siphonerId: siphoner.id,
      allyId: null,
      enemyId: enemyPiece.id,
      mode: "hostile"
    });
    flash(
      `${C.PIECE_TYPES[siphoner.key].name} drains ${C.PIECE_TYPES[enemyPiece.key].name
      }.`,
      siphoner.team,
      gs
    );
    deselectPiece(gs);
    return true;
  } else if (mode === "parasitic") {
    if (
      !allyPiece ||
      allyPiece.team !== siphoner.team ||
      !canReach(allyPiece) ||
      (allyPiece.power || 0) <= 0
    )
      return false;
    allyPiece.power = Math.max(0, allyPiece.power - 1);
    siphoner.power = (siphoner.power || 0) + 1;
    siphoner.overloadPoints = (siphoner.overloadPoints || 0) + 1;
    siphoner.tethers.push({
      siphonerId: siphoner.id,
      allyId: allyPiece.id,
      enemyId: null,
      mode: "parasitic"
    });
    flash(
      `${C.PIECE_TYPES[siphoner.key].name} parasitically siphons from ${C.PIECE_TYPES[allyPiece.key].name
      }.`,
      siphoner.team,
      gs
    );
    deselectPiece(gs);
    return true;
  } else if (mode === "resonance") {
    if (
      !allyPiece ||
      !enemyPiece ||
      allyPiece.team !== siphoner.team ||
      enemyPiece.team === siphoner.team ||
      allyPiece.id === siphoner.id ||
      !canReach(allyPiece) ||
      !canReach(enemyPiece) ||
      (enemyPiece.power || 0) <= 0
    )
      return false;
    enemyPiece.power = Math.max(0, enemyPiece.power - 1);
    allyPiece.power = (allyPiece.power || 0) + 1;
    siphoner.overloadPoints = (siphoner.overloadPoints || 0) + 2;
    siphoner.tethers.push({
      siphonerId: siphoner.id,
      allyId: allyPiece.id,
      enemyId: enemyPiece.id,
      mode: "resonance"
    });
    flash(
      `${C.PIECE_TYPES[siphoner.key].name} weaves a Resonance Link between ${C.PIECE_TYPES[allyPiece.key].name
      } and ${C.PIECE_TYPES[enemyPiece.key].name}.`,
      siphoner.team,
      gs
    );
    deselectPiece(gs);
    return true;
  } else return false;

  if ((siphoner.overloadPoints || 0) >= 4) {
    siphoner.tethers.forEach((t) => {
      const ally =
        t.allyId !== null
          ? gs.pieces.find((p) => p.id === t.allyId)
          : null;
      const enemy =
        t.enemyId !== null
          ? gs.pieces.find((p) => p.id === t.enemyId)
          : null;
      if (t.mode === "benevolent" && ally)
        ally.power = Math.max(0, ally.power - 1);
      else if (t.mode === "hostile" && enemy) enemy.power += 1;
      else if (t.mode === "parasitic" && ally) ally.power += 1;
      else if (t.mode === "resonance") {
        if (ally) ally.power = Math.max(0, ally.power - 1);
        if (enemy) enemy.power += 1;
      }
    });
    gs.pieces = gs.pieces.filter((p) => p.id !== siphoner.id);
    flash(
      `${C.PIECE_TYPES[siphoner.key].name
      } overloads and is destroyed by feedback!`,
      siphoner.team,
      gs
    );
    updateBoardMap(gs);
    updateConduitLink(gs);
  }

  updateBoardMap(gs);
  return true;
}

export function ventOverload(siphoner, gs = gameState) {
  if (
    !siphoner ||
    siphoner.ability?.key !== "Siphon" ||
    !siphoner.overloadPoints ||
    siphoner.overloadPoints <= 0
  )
    return false;
  const onRift = C.SHAPES.riftAreas.some((r) =>
    r.cells.some(([rr, cc]) => rr === siphoner.row && cc === siphoner.col)
  );
  const onShrine = C.SHAPES.shrineArea.some(
    ([r, c]) => r === siphoner.row && c === siphoner.col
  );
  let vented = false;

  if (onRift) {
    triggerAbyssalForge(gs);
    flash(
      `${C.PIECE_TYPES[siphoner.key].name
      } vents Overload into the Rift, triggering the Abyssal Forge!`,
      siphoner.team,
      gs
    );
    vented = true;
  } else if (onShrine) {
    gs.shrineChargeLevel = (gs.shrineChargeLevel || 0) + 1;
    emit(gs, {
      type: "ANIMATION",
      name: "UpdateShrine",
      level: gs.shrineChargeLevel
    });
    if (
      gs.shrineChargeLevel >= C.ABILITY_VALUES.Shrine.overloadCharges
    ) {
      gs.shrineIsOverloaded = true;
      flash(`The Shrine becomes Overloaded!`, "neutral", gs);
    } else {
      flash(
        `The Shrine gains an Overload charge. (${gs.shrineChargeLevel}/${C.ABILITY_VALUES.Shrine.overloadCharges})`,
        siphoner.team,
        gs
      );
    }
    vented = true;
  }

  if (!vented) return false;
  emit(gs, {
    type: "ANIMATION",
    name: "VentEffect",
    r: siphoner.row,
    c: siphoner.col,
    team: siphoner.team
  });
  siphoner.overloadPoints = 0;
  updateBoardMap(gs);
  return true;
}

function revertTetherPower(t, gs = gameState) {
  const siphoner = gs.pieces ? gs.pieces.find(p => p.id === t.siphonerId) : null;
  const ally = t.allyId !== null && gs.pieces ? gs.pieces.find((p) => p.id === t.allyId) : null;
  const enemy = t.enemyId !== null && gs.pieces ? gs.pieces.find((p) => p.id === t.enemyId) : null;
  if (t.mode === "benevolent") {
    if (siphoner) siphoner.power += 1;
    if (ally) ally.power = Math.max(0, ally.power - 1);
  } else if (t.mode === "hostile") {
    if (siphoner) siphoner.power = Math.max(0, siphoner.power - 1);
    if (enemy) enemy.power += 1;
  } else if (t.mode === "parasitic") {
    if (siphoner) siphoner.power = Math.max(0, siphoner.power - 1);
    if (ally) ally.power += 1;
  } else if (t.mode === "resonance") {
    if (ally) ally.power = Math.max(0, ally.power - 1);
    if (enemy) enemy.power += 1;
  }
}

export function checkTetherSnaps(gs = gameState) {
  gs.pieces.forEach((siphoner) => {
    if (
      siphoner.ability?.key !== "Siphon" ||
      !siphoner.tethers ||
      siphoner.tethers.length === 0
    )
      return;
    const onRift = C.SHAPES.riftAreas.some((r) =>
      r.cells.some(([rr, cc]) => rr === siphoner.row && cc === siphoner.col)
    );
    const maxRange = onRift ? 4 : 3;

    for (let i = siphoner.tethers.length - 1; i >= 0; i--) {
      const t = siphoner.tethers[i];
      const ally =
        t.allyId !== null ? gs.pieces.find((p) => p.id === t.allyId) : null;
      const enemy =
        t.enemyId !== null ? gs.pieces.find((p) => p.id === t.enemyId) : null;

      let snap = false;
      if (t.allyId !== null && !ally) snap = true;
      if (t.enemyId !== null && !enemy) snap = true;
      if (
        ally &&
        Math.max(
          Math.abs(siphoner.row - ally.row),
          Math.abs(siphoner.col - ally.col)
        ) > maxRange
      )
        snap = true;
      if (
        enemy &&
        Math.max(
          Math.abs(siphoner.row - enemy.row),
          Math.abs(siphoner.col - enemy.col)
        ) > maxRange
      )
        snap = true;

      if (snap) {
        revertTetherPower(t, gs);
        siphoner.tethers.splice(i, 1);
        flash(
          `A tether from ${C.PIECE_TYPES[siphoner.key].name} snapped!`,
          "neutral",
          gs
        );
      }
    }
  });
}

// ============================================================================
// SHRINE, ASCENSION & SACRIFICE
// ============================================================================
function handleShrineCapture(piece, defender, gs = gameState) {
  if (defender.key === "snowIceWisp") return;
  if (piece.shrineBoost === 0)
    piece.shrineBoost = C.ABILITY_VALUES.Shrine.powerBoost;
  if (!gs.shrineIsOverloaded) {
    if (
      ++gs.shrineChargeLevel >= C.ABILITY_VALUES.Shrine.overloadCharges
    ) {
      gs.shrineIsOverloaded = true;
      emit(gs, { type: "ANIMATION", name: "ShrineOverload" });
    }
  }
}

export function checkAscensionReady(gs = gameState) {
  if (!gs || !gs.pendingAscension) return false;

  // Return true ONLY if an ascension is pending and hasn't been chosen yet
  const isChosen = gs.factionPassives[gs.pendingAscension.team].ascension.isChosen;
  return !isChosen;
}

export function executeSacrifice(piece, gs = gameState) {
  if (
    !piece ||
    !piece.isTrapped ||
    gs.factionPassives[piece.team].ascension.isChosen
  )
    return false;
  const roles = {
    snowIceWeaver: "Shaper",
    ashRiftForger: "Shaper",
    snowRampagingYeti: "Brawler",
    ashBlazeboundBeast: "Brawler",
    snowArcticTrapper: "Skirmisher",
    ashAshStrider: "Skirmisher",
    snowHoarfrostMystic: "Mystic",
    ashMagmaShaper: "Mystic",
    // Bug 1.4 fix: Updated from deprecated snowVoidChanter/ashRiftWarden
    snowSoulLinker: "Siphoner",
    ashAshReaper: "Siphoner",
    snowGlacialMage: "Mage",
    ashMagmaSpitter: "Mage",
    snowSoulFreeze: "Priest",
    ashScorchPriest: "Priest",
    snowFrostbiteStalker: "Striker",
    ashCinderScout: "Striker",
    snowGlacialBrute: "Warrior",
    ashMagmaProwler: "Warrior"
  };
  const role = roles[piece.key] || "Other";
  if (role === "Other") return false;
  flash(
    `Sacrificing ${C.PIECE_TYPES[piece.key].name} for Ascension!`,
    piece.team,
    gs
  );
  piece.isTrapped = false;
  deselectPiece(gs);
  gs.shrineIsOverloaded = false;
  gs.pendingAscension = {
    team: piece.team,
    role,
    sacrificedPieceId: piece.id,
    sacrificedPieceKey: piece.key
  };
  setCurrentState(GameState.ASCENSION_CHOICE, gs);
  emit(gs, { type: "SHOW_ASCENSION_POPUP" });
  return true;
}

export function executeAscensionChoice(choice, gs = gameState) {
  if (
    !gs.pendingAscension ||
    gs.factionPassives[gs.pendingAscension.team].ascension
      .isChosen
  )
    return false;
  const { team, sacrificedPieceId } = gs.pendingAscension;
  const result = _executeAscensionLogic(gs, choice);
  if (result) {
    const p = gs.pieces.find(x => x.id === sacrificedPieceId);
    handlePieceCapture(p, null, gs);
    resetShrine(gs);
    flash(
      `The ${team.toUpperCase()} faction gains Ascension!`,
      team,
      gs
    );
    updateBoardMap(gs);
    setCurrentState(GameState.AWAITING_PIECE_SELECTION, gs);
    emit(gs, { type: "HIDE_ABILITY_PANEL" });
    emit(gs, { type: "HIDE_ASCENSION_POPUP" });
    return true;
  }
  return false;
}

export function cancelAscensionChoice(gs = gameState) {
  if (!isState(GameState.ASCENSION_CHOICE, gs) || !gs.pendingAscension)
    return false;
  const pending = gs.pendingAscension;
  const piece = gs.pieces.find(
    (p) => p.id === pending.sacrificedPieceId
  );
  if (piece) {
    piece.isTrapped = true;
    gs.trappedPiece = piece.id;
    gs.shrineIsOverloaded = true;
    flash(
      `Ascension canceled. ${C.PIECE_TYPES[piece.key].name} remains trapped.`,
      pending.team,
      gs
    );
  }
  gs.pendingAscension = null;
  setCurrentState(GameState.AWAITING_PIECE_SELECTION, gs);
  emit(gs, { type: "HIDE_ABILITY_PANEL" });
  emit(gs, { type: "HIDE_ASCENSION_POPUP" });
  return true;
}

export function executeRelease(piece, gs = gameState) {
  if (!piece || !piece.isTrapped) return false;
  flash(
    `The ${C.PIECE_TYPES[piece.key].name} is released!`,
    piece.team,
    gs
  );
  piece.power = Math.max(0, piece.power - 1);
  piece.isDazed = true;
  piece.dazedFor = 3;
  piece.isTrapped = false;
  resetShrine(gs);
  deselectPiece(gs);
  updateBoardMap(gs);
  return true;
}

function applySacrificeBuff(team, gs = gameState) {
  const buffKey = team === "snow" ? "HoarfrostArmaments" : "InnerFurnace";
  const buff = C.ABILITY_VALUES[buffKey];
  gs.pieces.forEach((fp) => {
    if (fp.team === team)
      gs.temporaryBoosts.push({
        pieceId: fp.id,
        amount: buff.powerBoost,
        duration: buff.duration,
        name: buffKey
      });
  });
  flash(
    `The ${team === "snow" ? "Frost" : "Ash"
    } faction is empowered by ${buffKey}!`,
    team,
    gs
  );
}

function resetShrine(gs = gameState) {
  gs.shrineChargeLevel = 0;
  gs.shrineIsOverloaded = false;
  gs.trappedPiece = null;
  emit(gs, { type: "ANIMATION", name: "UpdateShrine", level: 0 });
}

// ============================================================================
// CONDUIT & RIFT DYNAMICS
// ============================================================================
export function updateConduitLink(gs = gameState) {
  if (!gs.dynamicRifts || gs.dynamicRifts.length < 2) {
    gs.conduitLinkActive = false;
    gs.conduitTeam = null;
    gs.riftAnchors = { topLeft: null, bottomRight: null };
    return;
  }
  const [rift1, rift2] = gs.dynamicRifts;
  gs.pieces.forEach((p) => {
    p.isAnchor = false;
    p.hasDefensiveWard = false;
    p.anchorBoost = 0;
    p.canRiftPulse = false;
  });
  gs.conduitLinkActive = false;
  const piecesOnTL = gs.pieces.filter((p) =>
    rift1.cells.some(([r, c]) => r === p.row && c === p.col)
  );
  const piecesOnBR = gs.pieces.filter((p) =>
    rift2.cells.some(([r, c]) => r === p.row && c === p.col)
  );
  const snowAnchor = piecesOnTL.find((p) => p.team === "snow") && piecesOnBR.find((p) => p.team === "snow");
  const ashAnchor = piecesOnTL.find((p) => p.team === "ash") && piecesOnBR.find((p) => p.team === "ash");
  let linkTeam = null;
  if (snowAnchor && !ashAnchor) linkTeam = "snow";
  else if (ashAnchor && !snowAnchor) linkTeam = "ash";

  if (linkTeam) {
    gs.conduitLinkActive = true;
    gs.conduitTeam = linkTeam;
    const anchors = {
      TL: piecesOnTL.find((p) => p.team === linkTeam),
      BR: piecesOnBR.find((p) => p.team === linkTeam)
    };
    gs.riftAnchors = { topLeft: anchors.TL, bottomRight: anchors.BR };
    gs.conduitIsContested =
      piecesOnTL.some((p) => p.team !== linkTeam) ||
      piecesOnBR.some((p) => p.team !== linkTeam);
    const boost =
      gs.conduitIsContested &&
        !gs.factionPassives[linkTeam].ascension.RiftReinforcement
        ? 1
        : 2;

    anchors.TL.isAnchor = true;
    anchors.TL.hasDefensiveWard = true;
    anchors.TL.anchorBoost = boost;
    if (
      (anchors.TL.key.includes("Warden") ||
        anchors.TL.key.includes("Chanter") ||
        anchors.TL.key.includes("Linker") ||
        anchors.TL.key.includes("Reaper") ||
        anchors.TL.key.includes("Harvester")) &&
      !anchors.TL.hasUsedRiftPulse
    )
      anchors.TL.canRiftPulse = true;
    anchors.BR.isAnchor = true;
    anchors.BR.hasDefensiveWard = true;
    anchors.BR.anchorBoost = boost;
    if (
      (anchors.BR.key.includes("Warden") ||
        anchors.BR.key.includes("Chanter") ||
        anchors.BR.key.includes("Linker") ||
        anchors.BR.key.includes("Reaper") ||
        anchors.BR.key.includes("Harvester")) &&
      !anchors.BR.hasUsedRiftPulse
    )
      anchors.BR.canRiftPulse = true;
  }
}

export function executeRiftPulse(piece, gs = gameState) {
  // Bug 1.4 fix: Updated from deprecated ashRiftWarden/snowVoidChanter
  if (piece.key !== "ashAshReaper" && piece.key !== "snowSoulLinker")
    return false;
  if (!piece.canRiftPulse || piece.hasUsedRiftPulse) return false;
  flash("The Anchor unleashes a Rift Pulse!", piece.team, gs);
  piece.canRiftPulse = false;
  piece.hasUsedRiftPulse = true;

  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const adjacentPiece = C.getPieceAt(
        piece.row + dr,
        piece.col + dc,
        gs.pieces
      );
      if (!adjacentPiece) continue;
      if (!adjacentPiece.isSteadfast) {
        adjacentPiece.isDazed = true;
        adjacentPiece.dazedFor = 2;
      }
      const newRow = adjacentPiece.row + dr,
        newCol = adjacentPiece.col + dc;
      if (
        !adjacentPiece.isSteadfast &&
        newRow >= 0 &&
        newRow < C.ROWS &&
        newCol >= 0 &&
        newCol < C.COLS &&
        !C.getPieceAt(newRow, newCol, gs.pieces) &&
        !gs.glacialWalls.some(
          (w) => w.row === newRow && w.col === newCol
        )
      ) {
        updatePiecePosition(adjacentPiece, newRow, newCol, gs);
        checkSpecialTerrains(adjacentPiece, newRow, newCol, gs);
        const isShrine = C.SHAPES.shrineArea.some(
          ([sr, sc]) => sr === newRow && sc === newCol
        );
        if (
          isShrine &&
          gs.shrineIsOverloaded &&
          !gs.trappedPiece &&
          !adjacentPiece.isTrapped
        ) {
          adjacentPiece.isTrapped = true;
          gs.trappedPiece = adjacentPiece.id;
        }
      }
    }
  deselectPiece(gs);
  updateBoardMap(gs);
  updateConduitLink(gs);
  checkTerritoryThresholds(gs);
  return true;
}

export function processAbyssalForgeTurn(gs = gameState) {
  if (!gs || !gs.dynamicRifts || gs.dynamicRifts.length === 0) return;
  let snowPresence = false;
  let ashPresence = false;
  const riftCells = [];
  gs.dynamicRifts.forEach((rift) => {
    rift.cells.forEach((cell) => riftCells.push(cell));
  });

  gs.pieces.forEach((p) => {
    if (riftCells.some(([r, c]) => r === p.row && c === p.col)) {
      if (p.team === "snow") snowPresence = true;
      if (p.team === "ash") ashPresence = true;
    }
  });

  let currentTurnOwner = null;
  if (snowPresence && !ashPresence) currentTurnOwner = "snow";
  else if (ashPresence && !snowPresence) currentTurnOwner = "ash";
  const conduit = gs.conduit;
  if (!conduit) return;

  if (!currentTurnOwner) {
    conduit.consecutiveTurnsContested++;
    if (conduit.consecutiveTurnsContested >= 4) {
      if (conduit.hasBeenHighlyCharged) executeVoidSnap(gs);
      else if (conduit.owner !== null) {
        const territory =
          conduit.owner === "snow"
            ? gs.snowTerritory
            : gs.ashTerritory;
        riftCells.forEach(([r, c]) => {
          territory.delete(`${r},${c}`);
          if (gs.territoryCaptureTurn) delete gs.territoryCaptureTurn[`${r},${c}`];
        });
        flash(
          "The Conduit destabilizes! Territory lost.",
          "neutral",
          gs
        );
        conduit.owner = null;
        conduit.consecutiveTurnsHeld = 0;
      }
    }
  } else {
    if (conduit.owner === currentTurnOwner) {
      conduit.consecutiveTurnsHeld++;
      conduit.consecutiveTurnsContested = 0;
      if (conduit.consecutiveTurnsHeld >= 6)
        conduit.hasBeenHighlyCharged = true;
      if (
        conduit.consecutiveTurnsHeld > 0 &&
        conduit.consecutiveTurnsHeld % 4 === 0
      )
        triggerAbyssalForge(gs);
    } else {
      conduit.owner = currentTurnOwner;
      conduit.consecutiveTurnsHeld = 1;
      conduit.consecutiveTurnsContested = 0;
    }
    if (conduit.consecutiveTurnsHeld === 6) {
      const territory =
        conduit.owner === "snow"
          ? gs.snowTerritory
          : gs.ashTerritory;
      riftCells.forEach(([r, c]) => {
        territory.add(`${r},${c}`);
        if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[`${r},${c}`] = gs.turnCount;
      });
      flash(
        `The ${conduit.owner.toUpperCase()} faction claims the Conduit!`,
        conduit.owner,
        gs
      );
    }
  }
}

function executeVoidSnap(gs = gameState) {
  flash("THE VOID SNAPS! The Conduit collapses!", "neutral", gs);
  const riftCells = [];
  gs.dynamicRifts.forEach((rift) => {
    rift.cells.forEach(([r, c]) => {
      riftCells.push({ row: r, col: c });
      const posStr = `${r},${c}`;
      if (gs.snowTerritory) gs.snowTerritory.delete(posStr);
      if (gs.ashTerritory) gs.ashTerritory.delete(posStr);
      const pieceOnVoid = C.getPieceAt(r, c, gs.pieces);
      if (pieceOnVoid)
        gs.pieces = gs.pieces.filter((p) => p.id !== pieceOnVoid.id);
    });
  });
  if (!gs.voidSquares) gs.voidSquares = [];
  gs.voidSquares.push(...riftCells);
  gs.dynamicRifts = [];
  if (gs.conduit) {
    gs.conduit.owner = null;
    gs.conduit.hasBeenHighlyCharged = false;
    gs.conduit.consecutiveTurnsContested = 0;
  }
  gs.conduitLinkActive = false;
  gs.riftAnchors = { topLeft: null, bottomRight: null };
  updateBoardMap(gs);
}

function triggerAbyssalForge(gs = gameState) {
  const currentRiftCells = new Set();
  gs.dynamicRifts.forEach((rift) =>
    rift.cells.forEach(([r, c]) => currentRiftCells.add(`${r},${c}`))
  );
  const adjacentEmptyCells = new Set();
  const dirs = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1]
  ];

  currentRiftCells.forEach((cellStr) => {
    const [r, c] = cellStr.split(",").map(Number);
    for (const [dr, dc] of dirs) {
      const nr = r + dr,
        nc = c + dc;
      if (nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS) {
        const nStr = `${nr},${nc}`;
        if (
          !currentRiftCells.has(nStr) &&
          !C.getPieceAt(nr, nc, gs.pieces) &&
          !(gs.glacialWalls || []).some((w) => w.row === nr && w.col === nc) &&
          !(gs.voidSquares || []).some((v) => v.row === nr && v.col === nc) &&
          !(gs.elementalCores || []).some((ec) => ec.row === nr && ec.col === nc)
        ) {
          adjacentEmptyCells.add(nStr);
        }
      }
    }
  });

  const possibleTargets = Array.from(adjacentEmptyCells).map((str) => {
    const [r, c] = str.split(",").map(Number);
    return { r, c };
  });
  if (possibleTargets.length === 0) return;

  const targetCell =
    possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
  if (Math.random() < 0.5) {
    let attached = false;
    for (let rift of gs.dynamicRifts) {
      if (
        rift.cells.some(
          ([rr, cc]) =>
            Math.abs(rr - targetCell.r) <= 1 && Math.abs(cc - targetCell.c) <= 1
        )
      ) {
        rift.cells.push([targetCell.r, targetCell.c]);
        attached = true;
        break;
      }
    }
    if (!attached && gs.dynamicRifts.length > 0) gs.dynamicRifts[0].cells.push([targetCell.r, targetCell.c]);
    if (gs.conduit && gs.conduit.consecutiveTurnsHeld >= 6) {
      const territory =
        gs.conduit.owner === "snow" ? gs.snowTerritory : gs.ashTerritory;
      if (territory) {
        territory.add(`${targetCell.r},${targetCell.c}`);
        if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[`${targetCell.r},${targetCell.c}`] = gs.turnCount;
      }
    }
    flash(`The Abyssal Forge expands the Rift!`, gs.conduit ? gs.conduit.owner : null, gs);
  } else {
    const coreTypes = ["ruby", "topaz", "emerald", "sapphire"];
    const randomType = coreTypes[Math.floor(Math.random() * coreTypes.length)];
    if (!gs.elementalCores) gs.elementalCores = [];
    gs.elementalCores.push({
      row: targetCell.r,
      col: targetCell.c,
      type: randomType
    });
    flash(
      `The Forge spawns a ${randomType.toUpperCase()} Core!`,
      gs.conduit ? gs.conduit.owner : null,
      gs
    );
  }
}

export function consumeCore(piece, r, c, gs = gameState) {
  if (!gs || !gs.elementalCores) return;
  const coreIndex = gs.elementalCores.findIndex(
    (ec) => ec.row === r && ec.col === c
  );
  if (coreIndex === -1) return;
  const core = gs.elementalCores[coreIndex];
  gs.elementalCores.splice(coreIndex, 1);
  let msg = "";

  if (core.type === "ruby") {
    piece.rubyCores = piece.rubyCores || 0;
    if (piece.rubyCores < 2) {
      piece.power += 1;
      piece.rubyCores++;
      msg = `${C.PIECE_TYPES[piece.key].name} gained +1 Permanent Power!`;
    } else {
      if (!gs.temporaryBoosts) gs.temporaryBoosts = [];
      gs.temporaryBoosts.push({
        pieceId: piece.id,
        amount: 1,
        duration: 2,
        name: "RubySurge"
      });
      msg = `${C.PIECE_TYPES[piece.key].name} gained +1 Power for 2 turns!`;
    }
  } else if (core.type === "topaz") {
    if (!piece.isVeteran && !isLeader(piece)) {
      promoteToVeteran(piece, gs);
      msg = `${C.PIECE_TYPES[piece.key].name} awakened as a Veteran!`;
    } else {
      const territory =
        piece.team === "snow" ? gs.snowTerritory : gs.ashTerritory;
      const oppTerritory =
        piece.team === "snow" ? gs.ashTerritory : gs.snowTerritory;
      const dirs = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1]
      ];
      dirs.forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (
          nr >= 0 &&
          nr < C.ROWS &&
          nc >= 0 &&
          nc < C.COLS &&
          !(gs.voidSquares || []).some((v) => v.row === nr && v.col === nc)
        ) {
          if (territory) territory.add(`${nr},${nc}`);
          if (oppTerritory) oppTerritory.delete(`${nr},${nc}`);
          if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[`${nr},${nc}`] = gs.turnCount;
        }
      });
      msg = `${C.PIECE_TYPES[piece.key].name} triggers a Territorial Burst!`;
    }
  } else if (core.type === "emerald") {
    if (!piece.hasPermanentAegis) {
      piece.hasPermanentAegis = true;
      msg = `${C.PIECE_TYPES[piece.key].name} gains Permanent Aegis!`;
    } else {
      if (!gs.temporaryBoosts) gs.temporaryBoosts = [];
      gs.temporaryBoosts.push({
        pieceId: piece.id,
        amount: 1,
        duration: 3,
        name: "AegisDefense",
        defensiveOnly: true
      });
      msg = `${C.PIECE_TYPES[piece.key].name} gains +1 Defense for 3 turns!`;
    }
  } else if (core.type === "sapphire") {
    piece.cooldownReduction = piece.cooldownReduction || 0;
    if (piece.cooldownReduction === 0) {
      piece.cooldownReduction = 1;
      if (piece.ability && piece.ability.cooldown > 0)
        piece.ability.cooldown = 0;
      if (piece.secondaryAbilityCooldown > 0)
        piece.secondaryAbilityCooldown = 0;
      msg = `${C.PIECE_TYPES[piece.key].name} is Overclocked!`;
    } else {
      (gs.pieces || []).forEach((p) => {
        if (p.team === piece.team) {
          if (p.ability && p.ability.cooldown > 0) p.ability.cooldown--;
          if (p.secondaryAbilityCooldown > 0) p.secondaryAbilityCooldown--;
        }
      });
      msg = `Global Sync! Faction cooldowns reduced!`;
    }
  }
  flash(msg, piece.team, gs);
}

// ============================================================================
// TURN MANAGEMENT & GAME LOOP
// ============================================================================
function startOfTurnUpkeep(team, gs = gameState) {
  if (!gs || !gs.pieces) return;
  gs.pieces.forEach((p) => {
    p.hasUsedRiftPulse = false;
    if (p.isSteadfast) {
      const hardenedIce = (gs.debuffs || []).find(
        (d) => d.pieceId === p.id && d.name === "HardenedIce"
      );
      if (!hardenedIce || hardenedIce.duration <= 0) p.isSteadfast = false;
    }
    if (p.team === team) {
      p.isEntrenched = false;
    }
  });
}

function endOfTurnUpkeep(gs = gameState) {
  if (!gs || !gs.pieces) return;
  gs.pieces.forEach((p) => {
    // Clear transient visual flags every end-of-turn
    p.isPhasing = false;
    if (p.team === gs.currentTurn) {
      if (p.stuck > 0) p.stuck--;
      if (p.overloadBoost?.duration > 0) p.overloadBoost.duration--;
      if (p.dazedFor > 0) p.dazedFor--;
      // Active duration is tracked separately from the cooldown timer.
      if (p.helpFromAboveActiveTurns > 0) {
        p.helpFromAboveActiveTurns--;
        if (p.helpFromAboveActiveTurns <= 0) {
          p.hasHelpFromAboveActive = false;
          emit(gs, {
            type: 'ANIMATION',
            name: 'ShieldBreak',
            pieceId: p.id,
            r: p.row,
            c: p.col,
            faction: 'snow'
          });
        }
      }
      if (p.deathMeteorInvincibilityTurns > 0) {
        p.deathMeteorInvincibilityTurns--;
        if (p.deathMeteorInvincibilityTurns <= 0) {
          p.hasDeathMeteorInvincibility = false;
          emit(gs, {
            type: 'ANIMATION',
            name: 'ShieldBreak',
            pieceId: p.id,
            r: p.row,
            c: p.col,
            faction: 'ash'
          });
        }
      }
      // Ability cooldowns and durations decrement only on the piece's team's turn
      if (p.deathMeteorCooldown > 0) p.deathMeteorCooldown--;
      if (p.helpFromAboveCooldown > 0) p.helpFromAboveCooldown--;
      if (p.ability && p.ability.cooldown > 0) p.ability.cooldown--;
      if (p.ability && p.ability.active && p.ability.duration > 0) {
        p.ability.duration--;
        if (p.ability.duration <= 0) p.ability.active = false;
      }
    }
  });

  // Synchronize boolean state to the numeric duration for all pieces. This avoids
  // cases where UI/logic disagree about whether a piece is dazed after a turn flip.
  gs.pieces.forEach((p) => {
    p.isDazed = (p.dazedFor && p.dazedFor > 0) || false;
  });

  const aliveIds = new Set(gs.pieces.map((p) => p.id));

  // Spawn magma shards when ObsidianPillarShield expires
  if (gs.shields) {
    gs.shields.forEach((s) => {
      if (s.name === 'ObsidianPillarShield') {
        const pId = s.pieceId;
        const p = gs.pieces.find((piece) => piece.id === pId);
        if (p && p.team === gs.currentTurn) {
          if (s.duration - 1 <= 0) {
            gs.specialTerrains = gs.specialTerrains || [];
            gs.specialTerrains.push({
              row: p.row,
              col: p.col,
              type: 'magmaShards',
              duration: 2,
              age: 0
            });
          }
        }
      }
    });
  }

  const filterByTurn = (arr) =>
    (arr || []).filter((item) => {
      const pId = item.pieceId !== undefined ? item.pieceId : item.targetId;
      const p = gs.pieces.find((piece) => piece.id === pId);
      if (p && p.team === gs.currentTurn) item.duration--;
      return item.duration > 0 && aliveIds.has(pId);
    });

  gs.temporaryBoosts = filterByTurn(gs.temporaryBoosts);
  gs.debuffs = filterByTurn(gs.debuffs);
  gs.markedPieces = filterByTurn(gs.markedPieces);
  gs.shields = filterByTurn(gs.shields);

  if (gs.glacialWalls) {
    gs.glacialWalls = gs.glacialWalls.filter((w) => {
      w.duration -= 1;
      if (w.duration <= 0) {
        emit(gs, {
          type: "ANIMATION",
          name: "WallShatter",
          r: w.row,
          c: w.col,
          wallType: w.type
        });
        if (w.type === 'obsidianPillar') {
          gs.specialTerrains = gs.specialTerrains || [];
          gs.specialTerrains.push({
            row: w.row,
            col: w.col,
            type: 'magmaShards',
            duration: 2,
            age: 0
          });
        }
        return false;
      }
      return true;
    });
  }
  if (gs.unstableGrounds) {
    gs.unstableGrounds = gs.unstableGrounds.filter((g) => {
      g.duration -= 1;
      return g.duration > 0;
    });
  }
  if (gs.specialTerrains) {
    gs.specialTerrains = gs.specialTerrains.filter((t) => {
      if (t.age !== undefined) t.age += 1;
      if (t.type === 'crater') return true; // Impassable crater stays forever!
      if (t.duration === 99) return true;
      t.duration -= 1;
      return t.duration > 0;
    });
  }
  if (gs.deathMeteors) {
    gs.deathMeteors = gs.deathMeteors.filter((m) => {
      m.duration = (m.duration === undefined) ? 6 : m.duration - 1;
      return m.duration > 0;
    });
  }
  if (gs.blizzardStorms) {
    gs.blizzardStorms = gs.blizzardStorms.filter((s) => {
      s.duration -= 1;
      // Apply healing only on the caster's turn
      if (s.duration > 0 && gs.currentTurn === s.team) {
        gs.pieces.forEach(p => {
          if (p.team === s.team && p.currentHp > 0) {
            const dist = Math.hypot(p.row - s.r, p.col - s.c);
            if (dist <= s.radius + 0.5) {
              p.currentHp = Math.min(p.maxHp || C.PIECE_TYPES[p.key]?.stats?.hp || 5, Math.round((p.currentHp + (C.ABILITY_VALUES.AColdFarewell?.heal || 1)) * 10) / 10);
              flash(`${C.PIECE_TYPES[p.key]?.name} healed by Blizzard Storm!`, p.team, gs);
            }
          }
        });
      }
      return s.duration > 0;
    });
  }

  if (gs.spikeRains) {
    gs.spikeRains = gs.spikeRains.filter((s) => {
      if (gs.currentTurn === s.team) {
        s.duration -= 1;
        if (s.duration > 0) {
          const creator = gs.pieces.find(c => c.id === s.creatorId) || { id: 'spike', team: s.team };
          gs.pieces.forEach(p => {
            if (C.cellIntersectsCircle(p.row, p.col, s.r, s.c, s.radius)) {
              if (p.team !== s.team) {
                if (p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) {
                  return; // Immune
                }
                if (p.key === 'ashAshTyrant' && p.hasDeathMeteorInvincibility) {
                  return; // Immune
                }
                const prevHp = p.currentHp;
                p.currentHp = Math.max(0, Math.round((p.currentHp - s.damage) * 10) / 10);
                if (creator.id !== 'spike') {
                  creator.damageDealt = (creator.damageDealt || 0) + (prevHp - p.currentHp);
                  if (!creator.isVeteran && creator.damageDealt >= (creator.maxHp || 5)) creator.readyForVeteranPromotion = true;
                }
              } else {
                p.currentHp = Math.min(p.maxHp || 5, Math.round((p.currentHp + s.heal) * 10) / 10);
              }
            }
          });
          resolveDeaths(gs, creator);
        }
      }
      return s.duration > 0;
    });
  }

  if (gs.reignOfFires) {
    gs.reignOfFires = gs.reignOfFires.filter((r) => {
      r.duration -= 1;
      return r.duration > 0;
    });
  }

  if (gs.frostfallBlessings) {
    gs.frostfallBlessings = gs.frostfallBlessings.filter((s) => {
      if (gs.currentTurn === s.team) {
        s.duration -= 1;
        if (s.duration > 0) {
          const creator = gs.pieces.find(c => c.id === s.creatorId) || { id: 'frost', team: s.team };
          gs.pieces.forEach(p => {
            if (C.cellIntersectsCircle(p.row, p.col, s.r, s.c, s.radius)) {
              if (p.team !== s.team) {
                if (p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) {
                  return; // Immune
                }
                if (p.key === 'ashAshTyrant' && p.hasDeathMeteorInvincibility) {
                  return; // Immune
                }
                const prevHp = p.currentHp;
                p.currentHp = Math.max(0, Math.round((p.currentHp - s.damage) * 10) / 10);
                if (creator.id !== 'frost') {
                  creator.damageDealt = (creator.damageDealt || 0) + (prevHp - p.currentHp);
                  if (!creator.isVeteran && creator.damageDealt >= (creator.maxHp || 5)) creator.readyForVeteranPromotion = true;
                }
              } else {
                // Tyrants cannot heal from Frostfall Blessing
                if (p.key !== 'ashAshTyrant' && p.key !== 'snowFrostLord') {
                  p.currentHp = Math.min(p.maxHp || 5, Math.round((p.currentHp + s.heal) * 10) / 10);
                }
              }
            }
          });
          resolveDeaths(gs, creator);
        }
      }
      return s.duration > 0;
    });
  }

  if (gs.fateLinks) {
    gs.fateLinks = gs.fateLinks.filter((fl) => {
      fl.duration -= 1;
      return fl.duration > 0;
    });
  }

  if (gs.TheReapersTolls) {
    gs.TheReapersTolls = gs.TheReapersTolls.filter((mg) => {
      mg.duration -= 1;
      if (mg.duration <= 0) {
        // AshesToAshes passive: revert stats, then 50% chance to shatter for 1 damage
        const target = gs.pieces.find(p => p.id === mg.targetId);
        const harvester = gs.pieces.find(p => p.id === mg.harvesterId);
        // Revert stat steal
        if (target) {
          target.def = (target.def || 0) + (mg.defStolen || 0);
          target.agility = (target.agility || 1) + (mg.agiStolen || 0);
        }
        if (harvester) {
          harvester.def = Math.max(0, (harvester.def || 0) - (mg.defStolen || 0));
          harvester.agility = Math.max(0.1, (harvester.agility || 1) - (mg.agiStolen || 0));
        }
        // 50% AshesToAshes shatter
        if (target && Math.random() < 0.5) {
          target.currentHp = Math.max(0, target.currentHp - 1);
          flash(`AshesToAshes! ${C.PIECE_TYPES[target.key]?.name || 'Unit'} shatters for 1 damage!`, 'ash', gs);
          resolveDeaths(gs, harvester);
        }
        return false; // expire
      }
      return true;
    });
  }

  // Process any ability-triggered deaths queued this turn (e.g. ReignOfFire)
  if (gs.pendingCaptures && gs.pendingCaptures.length > 0) {
    gs.pendingCaptures.forEach(({ capturedId, attackerId }) => {
      const captured = gs.pieces.find(p => p.id === capturedId);
      const attacker = gs.pieces.find(p => p.id === attackerId);
      if (captured) {
        captured.currentHp = 0;
        resolveDeaths(gs, attacker);
      }
    });
    gs.pendingCaptures = [];
  }
}

export function switchTurn(gs = gameState) {
  endOfTurnUpkeep(gs);
  processAbyssalForgeTurn(gs);

  if (gs.conduitLinkActive && !gs.conduitIsContested) {
    const progress = gs.conduitOverchargeProgress[gs.conduitTeam];
    if (progress && ++progress.turnsUncontested === C.CONDUIT_OVERCHARGE_TIER2_TURNS) {
      const { topLeft, bottomRight } = gs.riftAnchors || {};
      if (topLeft) topLeft.power++;
      if (bottomRight) bottomRight.power++;
      progress.turnsUncontested = 0;
    }
  }

  if (gs && gs.gameOver) return;

  const nextTurn = gs.currentTurn === "snow" ? "ash" : "snow";
  startOfTurnUpkeep(nextTurn, gs);
  gs.currentTurn = nextTurn;
  if (nextTurn === "snow") gs.turnCount++;
  checkTerritoryThresholds(gs);

  // Clear active selections and reset state so UI doesn't ghost during the next turn
  deselectPiece(gs);
  gs.firstWallCoords = null;
  setCurrentState(GameState.AWAITING_PIECE_SELECTION, gs);
}

export function endGame(winningTeam, gs = gameState) {
  if (!gs) return;
  gs.gameOver = true;
  gs.winner = winningTeam;
  setCurrentState(GameState.GAME_OVER, gs);
  emit(gs, { type: "GAME_OVER", winningTeam });
}

export function resetGame(gs = gameState) {
  initGame(gs);
  try {
    resetShrine(gs);
  } catch (e) { }
  emit(gs, { type: "RESET_GAME" });
}

export function initGameState(initialState) {
  gameState = initialState;
  if (gameState) {
    ensureSets(gameState);
    updateVoronoiState(gameState);
  }
}

export function withGameState(gs, fn) {
  const prev = gameState;
  try {
    gameState = gs;
    if (gameState) {
      ensureSets(gameState);
      updateVoronoiState(gameState);
    }
    return fn();
  } finally {
    gameState = prev;
  }
}

export function initGame(gs = gameState) {
  if (!gs || typeof gs !== "object") {
    if (gs === gameState) {
      gameState = {};
      gs = gameState;
    } else {
      gs = {};
    }
  }
  const isTestMode = gs ? gs.testMode : false;
  // Ensure gameState object exists and required collections are initialized
  gs.pieceIdCounter = 0;
  gs.currentState = GameState.AWAITING_PIECE_SELECTION;
  gs.testMode = isTestMode;
  gs.events = [];
  gs.pieces = [];
  if (!gs.snowTerritory) gs.snowTerritory = new Set();
  else gs.snowTerritory.clear();
  if (!gs.ashTerritory) gs.ashTerritory = new Set();
  else gs.ashTerritory.clear();
  gs.territoryTrails = [];
  gs.gameStarted = false;
  gs.shrineChargeLevel = 0;
  gs.shrineIsOverloaded = false;
  gs.trappedPiece = null;
  gs.messageHistory = [];
  gs.territoryCaptureTurn = {};
  gs.glacialWalls = [];
  gs.markedPieces = [];
  gs.unstableGrounds = [];
  gs.specialTerrains = [];
  gs.shields = [];
  // Particle and transient visual arrays used by the client renderer
  gs.attackTexts = [];
  gs.markOfCinderSparks = [];
  gs.snowParticles = [];
  gs.ashParticles = [];
  gs.battleParticles = [];
  gs.projectiles = [];
  gs.shockwaves = [];
  gs.frostfallBlessings = [];
  gs.knownFrostfallBlessings = [];
  gs.dyingFrostfallBlessings = [];
  gs.frostfallShards = [];
  gs.frostVignette = null;
  gs.farewellVignette = null;
  gs.glacialRemnants = [];
  gs.knownGlacialRemnants = [];
  gs.dyingGlacialRemnants = [];
  gs.blizzardStorms = [];
  gs.glacialFractureAnimations = [];
  gs.aColdFarewellAnimations = [];
  gs.deathMeteorAnimations = [];
  gs.trapDeployments = [];
  gs.trapTriggers = [];
  gs.deathMeteors = []; // Scorched-earth markers from Ash Tyrant's Death Meteor passive
  gs.selectedPiece = null;
  gs.currentTurn = "snow";
  gs.turnCount = 1;
  gs.gameOver = false;
  gs.winner = null;
  gs.temporaryBoosts = [];
  gs.debuffs = [];
  gs.abilityContext = null;
  gs.conduitLinkActive = false;
  gs.conduitIsContested = false;
  gs.voidScarSquares = [];
  gs.flashEffects = [];
  gs.conduitTeam = null;
  gs.riftAnchors = { topLeft: null, bottomRight: null };
  gs.factionPassives = {
    snow: { ascension: {}, territory: {} },
    ash: { ascension: {}, territory: {} }
  };
  gs.pendingAscension = null;
  gs.conduitOverchargeProgress = {
    snow: { turnsUncontested: 0 },
    ash: { turnsUncontested: 0 }
  };

  gs.conduit = {
    owner: null,
    consecutiveTurnsHeld: 0,
    consecutiveTurnsContested: 0,
    hasBeenHighlyCharged: false
  };
  gs.dynamicRifts = JSON.parse(JSON.stringify(C.SHAPES.riftAreas));
  gs.voidSquares = [];
  gs.elementalCores = [];
  gs.groundEffectParticles = [];
  gs.conduitParticles = [];
  gs.siphonParticles = [];
  gs.shrineParticles = [];

  setCurrentState(GameState.AWAITING_PIECE_SELECTION, gs);

  const snowSetup = C.SHAPES.bottomLayout;
  const ashSetup = C.SHAPES.topLayout;

  snowSetup.forEach(([r, c, pieceType]) =>
    gs.pieces.push(
      createPiece(r, c, C.TEAM_PIECES.snow[pieceType], "snow", gs)
    )
  );
  ashSetup.forEach(([r, c, pieceType]) =>
    gs.pieces.push(
      createPiece(r, c, C.TEAM_PIECES.ash[pieceType], "ash", gs)
    )
  );
  // Base territories are seeded entirely by the pieces' starting positions

  if (isTestMode) {
    const testKeys = ['snowFrostLord', 'snowGlacialMage', 'snowSoulLinker', 'ashAshTyrant', 'ashMagmaShaper', 'ashAshReaper'];
    gs.pieces = gs.pieces.filter(p => testKeys.includes(p.key));
  }

  gs.pieces.forEach((p) => {
    paintTerritoryPath(p, p.row, p.col, p.row, p.col, gs);
  });

  updateVoronoiState(gs);

  emit(gs, { type: "INIT_BOARD" });
  updateBoardMap(gs);
  return gs;
}