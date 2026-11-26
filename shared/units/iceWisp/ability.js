/**
 * Ice Wisp Abilities & Passive Logic
 * - Passive: A Cold Farewell (Explosion upon capture/death)
 * - Active: Summon Ice Wisp (Summoning mechanic for Spawners)
 */

export const A_COLD_FAREWELL_VALUES = {
  radius: 1.5,
  duration: 4,
  damage: 2,
  heal: 1,
  strengthBoost: 1,
  agilityDebuff: 0.4
};

export const SUMMON_ICE_WISP_VALUES = {
  cooldown: 4,
  range: 4
};

function emit(gs, event) {
  if (!gs.events) gs.events = [];
  gs.events.push(event);
}

/**
 * Passive Trigger: A Cold Farewell
 * Executes when Ice Wisp is captured/destroyed
 */
export function handleColdFarewellDeath(capturedPiece, attacker, gs, helpers = {}) {
  const rad = A_COLD_FAREWELL_VALUES.radius;
  gs.temporaryBoosts = gs.temporaryBoosts || [];
  gs.debuffs = gs.debuffs || [];

  if (gs.pieces) {
    gs.pieces.forEach(p => {
      if (p.id !== capturedPiece.id && p.currentHp > 0) {
        if (Math.hypot(p.row - capturedPiece.row, p.col - capturedPiece.col) <= rad) {
          if (p.team !== capturedPiece.team) {
            p.currentHp = Math.max(0, Math.round((p.currentHp - A_COLD_FAREWELL_VALUES.damage) * 10) / 10);
            gs.debuffs.push({
              pieceId: p.id,
              duration: A_COLD_FAREWELL_VALUES.duration,
              amount: A_COLD_FAREWELL_VALUES.agilityDebuff,
              name: "ColdFarewellAgi"
            });
            gs.debuffs.push({
              pieceId: p.id,
              duration: 2,
              amount: 0,
              name: "ColdFarewellControlLock"
            }); // 2 turns = "their next move"
          } else {
            gs.temporaryBoosts.push({
              pieceId: p.id,
              duration: A_COLD_FAREWELL_VALUES.duration,
              amount: A_COLD_FAREWELL_VALUES.strengthBoost,
              name: "ColdFarewellStr"
            });
          }
        }
      }
    });
  }

  gs.blizzardStorms = gs.blizzardStorms || [];
  gs.blizzardStorms.push({
    r: capturedPiece.row,
    c: capturedPiece.col,
    duration: A_COLD_FAREWELL_VALUES.duration,
    radius: rad,
    team: capturedPiece.team
  });

  const emitFn = helpers.emit || emit;
  emitFn(gs, {
    type: "ANIMATION",
    name: "AColdFarewell",
    r: capturedPiece.row,
    c: capturedPiece.col
  });
}

/**
 * Active Ability: A Cold Farewell (manual detonation if invoked)
 */
export const AColdFarewellAbility = {
  name: "A Cold Farewell",
  cooldown: 0,
  requiresTargeting: false,
  effect: (p, t, gs) => {
    handleColdFarewellDeath(p, null, gs);
  }
};

/**
 * Ability: Summon Ice Wisp
 */
export const SummonIceWispAbility = {
  name: "Summon Ice Wisp",
  cooldown: SUMMON_ICE_WISP_VALUES.cooldown,
  range: SUMMON_ICE_WISP_VALUES.range,
  targetType: "empty",
  canBeBlocked: false,
  requiresTargeting: true,
  effect: (p, t, gs, createPiece) => {
    if (!createPiece) return;
    const wisp = createPiece(t.r, t.c, "snowIceWisp", "snow");
    wisp.power = Math.max(
      gs.factionPassives?.snow?.ascension?.wispPower || 0,
      p.isVeteranWispEnhancement ? 1 : 0
    );
    gs.pieces.push(wisp);
    const pos = `${t.r},${t.c}`;
    if (gs.snowTerritory) gs.snowTerritory.add(pos);
    if (gs.ashTerritory) gs.ashTerritory.delete(pos);
    if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[pos] = gs.turnCount;
  }
};
