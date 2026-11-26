/**
 * Glacial Mage Abilities & Passive Logic
 * - Active: Glacial Fracture
 * - Passive: Frost Duo (Wisps boost Strength, Agility, and Control)
 */

export const GLACIAL_FRACTURE_VALUES = {
  cooldown: 9,
  range: 2.5,
  radius: 2,
  damage: 2,
  wispCap: 2,
  remnantDuration: 3
};

export const WISP_ENHANCEMENT_VALUES = {
  powerBoost: 1
};

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function emit(gs, event) {
  if (!gs.events) gs.events = [];
  gs.events.push(event);
}

/**
 * Executes Glacial Fracture ability effect
 */
export function executeGlacialFracture(piece, target, gameStateLocal, createPiece, helpers = {}) {
  const flash = helpers.flash || (() => {});
  const emitFn = helpers.emit || emit;
  const inBoundsFn = helpers.inBounds || inBounds;

  // 1. Damage enemies within continuous radius
  let enemiesCaught = [];
  const rad = GLACIAL_FRACTURE_VALUES.radius;
  (gameStateLocal.pieces || []).forEach(p => {
    if (p.team !== piece.team && p.currentHp > 0) {
      if (Math.hypot(p.row - target.r, p.col - target.c) <= rad + 0.45) {
        enemiesCaught.push(p);
        p.currentHp = Math.max(0, Math.round((p.currentHp - GLACIAL_FRACTURE_VALUES.damage) * 10) / 10);
      }
    }
  });

  // 2. Convert nearby ground to snow territory
  for (let r = -Math.floor(rad + 0.5); r <= Math.ceil(rad + 0.5); r++) {
    for (let c = -Math.floor(rad + 0.5); c <= Math.ceil(rad + 0.5); c++) {
      if (Math.hypot(r, c) <= rad + 0.5) {
        const tr = Math.round(target.r + r);
        const tc = Math.round(target.c + c);
        if (inBoundsFn(tr, tc)) {
          if (gameStateLocal.snowTerritory) gameStateLocal.snowTerritory.add(`${tr},${tc}`);
          if (gameStateLocal.ashTerritory) gameStateLocal.ashTerritory.delete(`${tr},${tc}`);
        }
      }
    }
  }

  // 3. Check wisp resonance limit
  const currentWisps = (gameStateLocal.pieces || []).filter(p => p.key === "snowIceWisp" && p.team === piece.team && p.currentHp > 0);
  if (currentWisps.length >= GLACIAL_FRACTURE_VALUES.wispCap) {
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
        if (inBoundsFn(Math.round(tr), Math.round(tc)) && !isBlocked) {
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
    if (piece.isVeteran && piece.veteranAbility?.key === "WispEnhancement") {
      isPower1 = true;
    } else if (gameStateLocal.factionPassives?.[piece.team]?.ascension?.PrimalPower) {
      isPower1 = true;
    }
    const newWisp = createPiece(bestTile.r, bestTile.c, "snowIceWisp", piece.team, gameStateLocal);
    newWisp.power = isPower1 ? 1 : 0;
    gameStateLocal.pieces.push(newWisp);
    emitFn(gameStateLocal, { type: "ANIMATION", name: "GlacialFracture", targetR: target.r, targetC: target.c, wispId: newWisp.id });
  } else {
    emitFn(gameStateLocal, { type: "ANIMATION", name: "GlacialFracture", targetR: target.r, targetC: target.c });
  }
  return true;
}

/**
 * Active Ability: Glacial Fracture
 */
export const GlacialFractureAbility = {
  name: "Glacial Fracture",
  cooldown: GLACIAL_FRACTURE_VALUES.cooldown,
  requiresTargeting: true,
  circularRange: true,
  range: GLACIAL_FRACTURE_VALUES.range,
  radius: GLACIAL_FRACTURE_VALUES.radius,
  targetType: "any",
  effect: (piece, target, gameState, createPiece) => {
    return executeGlacialFracture(piece, target, gameState, createPiece);
  }
};

/**
 * Passive Trigger: Frost Duo dynamic stats calculation
 * Returns stat adjustments based on active allied Wisps.
 */
export function getGlacialMageDynamicStats(piece, gameState) {
  if (!piece || !gameState) return null;
  const wisps = (gameState.pieces || []).filter(p => p.key === "snowIceWisp" && p.team === piece.team && p.currentHp > 0);
  return {
    strengthBonus: wisps.length >= 2 ? 1 : 0,
    controlBonus: 0.2 * wisps.length,
    agilityBonus: 0.2 * wisps.length
  };
}
