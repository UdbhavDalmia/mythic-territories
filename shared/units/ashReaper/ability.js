/**
 * Ash Reaper Abilities
 * - Active: The Reaper's Toll (Stat Steal)
 */

export const THE_REAPERS_TOLL_VALUES = {
  cooldown: 7,
  range: 3,
  duration: 4
};

function getPieceAt(r, c, pieces = []) {
  return pieces.find(p => p.row === r && p.col === c) || null;
}

/**
 * Active Ability: The Reaper's Toll
 */
export const TheReapersTollAbility = {
  name: "The Reaper's Toll",
  cooldown: THE_REAPERS_TOLL_VALUES.cooldown,
  requiresTargeting: true,
  range: THE_REAPERS_TOLL_VALUES.range,
  targetType: "enemy",
  canBeBlocked: true,
  effect: (p, t, gs) => {
    const tp = getPieceAt(t.r, t.c, gs.pieces);
    if (tp) {
      const defSteal = 1;
      const agiSteal = 0.4;
      gs.TheReapersTolls = gs.TheReapersTolls || [];
      gs.TheReapersTolls.push({
        harvesterId: p.id,
        targetId: tp.id,
        duration: THE_REAPERS_TOLL_VALUES.duration,
        defStolen: defSteal,
        agiStolen: agiSteal
      });
      // Immediately steal stats
      tp.def = Math.max(0, (tp.def || 0) - defSteal);
      tp.agility = Math.max(0.1, (tp.agility || 1) - agiSteal);
      p.def = (p.def || 0) + defSteal;
      p.agility = (p.agility || 1) + agiSteal;
    }
  }
};
