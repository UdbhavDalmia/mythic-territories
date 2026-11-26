/**
 * Soul Linker Abilities
 * - Active: Fate Link (Two-target soul tether)
 */

export const FATE_LINK_VALUES = {
  cooldown: 7,
  range: 3,
  duration: 4
};

function getPieceAt(r, c, pieces = []) {
  return pieces.find(p => p.row === r && p.col === c) || null;
}

function emit(gs, event) {
  if (!gs.events) gs.events = [];
  gs.events.push(event);
}

/**
 * Active Ability: Fate Link
 */
export const FateLinkAbility = {
  name: "Fate Link",
  cooldown: FATE_LINK_VALUES.cooldown,
  requiresTargeting: true,
  range: FATE_LINK_VALUES.range,
  targetType: "special",
  specialTargeting: (p, t, gs) => {
    const tp = getPieceAt(t.r, t.c, gs.pieces);
    if (gs.abilityContext && gs.abilityContext.abilityKey === 'FateLink' && gs.abilityContext.step === 1) {
      return tp && tp.team === p.team;
    }
    return tp && tp.team !== p.team;
  },
  effect: (p, t, gs) => {
    const target2 = getPieceAt(t.r, t.c, gs.pieces);
    const target1 = t.target1 ? gs.pieces.find(pc => pc.id === t.target1.id) : null;
    if (target1 && target2) {
      gs.fateLinks = gs.fateLinks || [];
      gs.fateLinks.push({
        sourceId: target1.id,
        targetId: target2.id,
        duration: FATE_LINK_VALUES.duration
      });
      emit(gs, { type: "ANIMATION", name: "FateLinkCast", sourceId: target1.id, targetId: target2.id });
    }
  }
};
