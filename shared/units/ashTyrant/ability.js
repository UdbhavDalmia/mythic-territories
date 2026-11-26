/**
 * Ash Tyrant Abilities & Passive Logic
 * - Active: Reign of Fire
 * - Passive: Death Meteor (Lethal blow save & counter-eruption)
 */

export const REIGN_OF_FIRE_VALUES = {
  cooldown: 11,
  duration: 3,
  range: 2.5,
  radius: 2,
  damage: 2,
  allyDamage: 1,
  strengthBoost: 2
};

export const DEATH_METEOR_VALUES = {
  cooldown: 15,
  radius: 2,
  enemyDamage: 4,
  allyDamage: 2
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
 * Active Ability: Reign of Fire
 */
export const ReignOfFireAbility = {
  name: "Reign of Fire",
  cooldown: REIGN_OF_FIRE_VALUES.cooldown,
  requiresTargeting: true,
  circularRange: true,
  range: REIGN_OF_FIRE_VALUES.range,
  radius: REIGN_OF_FIRE_VALUES.radius,
  targetType: "any",
  effect: (p, t, gs) => {
    const dmg = REIGN_OF_FIRE_VALUES.damage;
    const allyDmg = REIGN_OF_FIRE_VALUES.allyDamage;
    const radius = REIGN_OF_FIRE_VALUES.radius;
    const strBoost = REIGN_OF_FIRE_VALUES.strengthBoost;
    const duration = REIGN_OF_FIRE_VALUES.duration;

    const toRemove = [];
    gs.pieces.forEach(target => {
      if (cellIntersectsCircle(target.row, target.col, t.r, t.c, radius)) {
        if (target.key === 'snowFrostLord' && target.hasHelpFromAboveActive) {
          return; // Immune to damage
        }
        if (target.key === 'ashAshTyrant' && target.hasDeathMeteorInvincibility) {
          return; // Immune to damage
        }
        if (target.team !== p.team) {
          target.currentHp = Math.max(0, Math.round(((target.currentHp || target.stats?.hp || 5) - dmg) * 10) / 10);
          if (target.currentHp <= 0) toRemove.push({ piece: target });
        } else {
          // Deals 1 damage to allies caught in the radius
          target.currentHp = Math.max(0, Math.round(((target.currentHp || target.stats?.hp || 5) - allyDmg) * 10) / 10);
          if (target.currentHp <= 0) toRemove.push({ piece: target });

          // Grants +2 Strength for 3 turns
          gs.temporaryBoosts = gs.temporaryBoosts || [];
          gs.temporaryBoosts = gs.temporaryBoosts.filter(b => !(b.pieceId === target.id && b.name === "ReignOfFireStr"));
          gs.temporaryBoosts.push({
            pieceId: target.id,
            duration: duration,
            amount: strBoost,
            name: "ReignOfFireStr"
          });
        }
      }
    });

    // Handle deaths AFTER iterating to avoid mutating array during loop
    toRemove.forEach(({ piece }) => {
      gs.pendingCaptures = gs.pendingCaptures || [];
      gs.pendingCaptures.push({ capturedId: piece.id, attackerId: p.id });
    });
    gs.reignOfFires = gs.reignOfFires || [];
    gs.reignOfFires.push({ r: t.r, c: t.c, duration: duration, radius: radius });
  }
};

/**
 * Passive Trigger: Death Meteor (intercepts lethal damage)
 * Intercepts lethal damage, triggers an eruption AoE, creates a crater, and relocates Ash Tyrant.
 */
export function handleDeathMeteorLethal(piece, gs, flashOrContext, optContext) {
  if (piece.key !== 'ashAshTyrant') return false;
  const context = (optContext && optContext.emit) ? optContext : (typeof flashOrContext === 'object' && flashOrContext !== null ? flashOrContext : {});
  const flash = typeof flashOrContext === 'function' ? flashOrContext : context.flash;

  if (piece.hasDeathMeteorInvincibility) {
    piece.currentHp = 1;
    return true; // Intercept death: Tyrant is immune to death/damage during his active invincibility state
  }

  if ((piece.deathMeteorCooldown || 0) <= 0) {
    piece.currentHp = 1;
    piece.deathMeteorCooldown = DEATH_METEOR_VALUES.cooldown;
    piece.hasDeathMeteorInvincibility = true;
    piece.deathMeteorInvincibilityTurns = 2;
    piece.hasTriggeredDeathMeteor = true;

    const currentR = piece.row;
    const currentC = piece.col;

    // 1. AoE Damage to all units within Radius 2 (enemies take 4 dmg, allies take 2 dmg)
    if (gs.pieces) {
      gs.pieces.forEach(p => {
        if (cellIntersectsCircle(p.row, p.col, currentR, currentC, DEATH_METEOR_VALUES.radius) && p.id !== piece.id) {
          if (p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) {
            return; // Skip damage due to active Help From Above protective state
          }
          if (p.key === 'ashAshTyrant' && p.hasDeathMeteorInvincibility) {
            return;
          }
          const maxHp = p.maxHp || p.stats?.hp || 5;
          const curHp = typeof p.currentHp === 'number' ? p.currentHp : maxHp;
          const dmg = p.team !== piece.team ? DEATH_METEOR_VALUES.enemyDamage : DEATH_METEOR_VALUES.allyDamage;
          p.currentHp = Math.max(0, Math.round((curHp - dmg) * 10) / 10);
        }
      });
    }

    if (flash) {
      flash(`Death Meteor strikes! 4 AoE damage dealt to nearby enemies.`, piece.team, gs);
    }

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
    const rows = context.ROWS || 8;
    const cols = context.COLS || 8;
    const isCandidateValid = cand => {
      if (cand.r < 0 || cand.r >= rows || cand.c < 0 || cand.c >= cols) return false;
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

    if (context.emit) {
      context.emit(gs, {
        type: 'ANIMATION',
        name: 'DeathMeteor',
        pieceId: piece.id,
        originR: currentR,
        originC: currentC,
        targetR: choice ? choice.r : currentR,
        targetC: choice ? choice.c : currentC
      });
    }

    if (choice) {
      piece.deathMeteorOrigin = { row: currentR, col: currentC };
      if (context.updatePiecePosition) {
        context.updatePiecePosition(piece, choice.r, choice.c, gs);
      } else {
        piece.row = choice.r;
        piece.col = choice.c;
      }
    }

    // Resolve collateral deaths caused by the explosion
    if (context.resolveDeaths) {
      context.resolveDeaths(gs, piece);
    }

    return true; // intercept: do NOT capture
  }

  return false;
}
