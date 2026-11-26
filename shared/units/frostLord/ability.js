/**
 * Frost Lord Abilities & Passive Logic
 * - Active: Frostfall Blessing
 * - Passive: Help From Above (Guardian Angel on lethal blow)
 */

export const FROSTFALL_BLESSING_VALUES = {
  cooldown: 11,
  duration: 5,
  range: 2.5,
  radius: 2,
  damage: 2,
  heal: 1
};

export const HELP_FROM_ABOVE_VALUES = {
  cooldown: 10,
  activeDuration: 3,
  radius: 1.5,
  strengthBoost: 1
};

/**
 * Checks circle-cell geometric intersection for radius AoE
 */
export function cellIntersectsCircle(cellR, cellC, circleR, circleC, radius) {
  const closestX = Math.max(cellC, Math.min(circleC, cellC + 1));
  const closestY = Math.max(cellR, Math.min(circleR, cellR + 1));
  const distanceX = circleC - closestX;
  const distanceY = circleR - closestY;
  return (distanceX * distanceX + distanceY * distanceY) <= (radius * radius);
}

/**
 * Active Ability Definition: Frostfall Blessing
 */
export const FrostfallBlessingAbility = {
  name: "Frostfall Blessing",
  cooldown: FROSTFALL_BLESSING_VALUES.cooldown,
  requiresTargeting: true,
  circularRange: true,
  range: FROSTFALL_BLESSING_VALUES.range,
  radius: FROSTFALL_BLESSING_VALUES.radius,
  targetType: "any",
  effect: (p, t, gs) => {
    if (!gs.frostfallBlessings) gs.frostfallBlessings = [];
    const radius = FROSTFALL_BLESSING_VALUES.radius;
    gs.frostfallBlessings.push({
      creatorId: p.id,
      team: p.team,
      r: t.r,
      c: t.c,
      duration: FROSTFALL_BLESSING_VALUES.duration,
      radius: radius,
      damage: FROSTFALL_BLESSING_VALUES.damage,
      heal: FROSTFALL_BLESSING_VALUES.heal
    });

    // Glacial Shrouding: friendly units inside the circle receive a Frost Shield
    gs.shields = gs.shields || [];
    if (gs.pieces) {
      gs.pieces.forEach(ally => {
        if (ally.team === p.team && cellIntersectsCircle(ally.row, ally.col, t.r, t.c, radius)) {
          if (!gs.shields.some(s => s.pieceId === ally.id)) {
            gs.shields.push({
              pieceId: ally.id,
              duration: 2,
              name: 'FrostShield'
            });
          }
        }
      });
    }
  }
};

/**
 * Passive Trigger: Help From Above (intercepts lethal damage)
 * Returns true if death was intercepted/negated.
 */
export function handleHelpFromAboveLethal(piece, gs, flashOrContext) {
  if (piece.key !== 'snowFrostLord') return false;
  const flash = typeof flashOrContext === 'function' ? flashOrContext : flashOrContext?.flash;

  if (piece.hasHelpFromAboveActive) {
    piece.currentHp = 1;
    return true; // Intercept death: immune to death while active
  }

  if ((piece.helpFromAboveCooldown || 0) <= 0) {
    piece.currentHp = 1;
    piece.helpFromAboveCooldown = HELP_FROM_ABOVE_VALUES.cooldown;
    piece.hasHelpFromAboveActive = true;
    piece.helpFromAboveActiveTurns = HELP_FROM_ABOVE_VALUES.activeDuration;

    // Grant nearby allies (Rad 1.5) +1 Strength for 3 turns
    const rad = HELP_FROM_ABOVE_VALUES.radius;
    const strBoost = HELP_FROM_ABOVE_VALUES.strengthBoost;
    const duration = HELP_FROM_ABOVE_VALUES.activeDuration;

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

    if (flash) {
      flash(`Help From Above! Frost Lord is shielded and bolsters nearby allies.`, piece.team, gs);
    }

    // Emit animation trigger
    if (typeof window === 'undefined' || gs.isLocalSimulation !== true) {
      if (!gs.events) gs.events = [];
      gs.events.push({
        type: 'ability',
        abilityKey: 'HelpFromAbove',
        casterId: piece.id,
        targetRow: piece.row,
        targetCol: piece.col
      });
    }
    return true;
  }

  return false;
}

/**
 * Returns true if Frost Lord is immune to death/damage due to active Help From Above
 */
export function isHelpFromAboveInvulnerable(piece) {
  return !!(piece && piece.hasHelpFromAboveActive);
}

/**
 * Dynamic stats for Frost Lord
 */
export function getFrostLordDynamicStats(piece, gameState) {
  if (piece && piece.hasHelpFromAboveActive) {
    return { strengthOverride: 3 };
  }
  return null;
}

