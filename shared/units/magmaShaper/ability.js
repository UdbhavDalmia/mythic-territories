/**
 * Magma Shaper Abilities
 * - Active: Obsidian Pillar (Wall creation, Ally shield, or Enemy knockback)
 */

export const OBSIDIAN_PILLAR_VALUES = {
  range: 2,
  duration: 2,
  wallDuration: 4,
  shieldDuration: 2,
  shieldHp: 2,
  cooldown: 5,
  damage: 1
};

/**
 * Checks if coordinates are within standard board bounds
 */
function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getPieceAt(r, c, pieces = []) {
  return pieces.find(p => p.row === r && p.col === c) || null;
}

function emit(gs, event) {
  if (!gs.events) gs.events = [];
  gs.events.push(event);
}

/**
 * Active Ability: Obsidian Pillar
 */
export const ObsidianPillarAbility = {
  name: "Obsidian Pillar",
  cooldown: OBSIDIAN_PILLAR_VALUES.cooldown,
  range: OBSIDIAN_PILLAR_VALUES.range,
  targetType: "any",
  canBeBlocked: true,
  requiresTargeting: true,
  effect: (p, t, gs) => {
    const tp = getPieceAt(t.r, t.c, gs.pieces);
    if (!tp) {
      const hasWall = (gs.glacialWalls || []).some(w => Math.hypot(w.row - t.r, w.col - t.c) < 0.6);
      const hasVoid = (gs.voidSquares || []).some(v => Math.hypot(v.row - t.r, v.col - t.c) < 0.6);
      const hasCrater = (gs.specialTerrains || []).some(st => st.type === 'crater' && Math.hypot(st.row - t.r, st.col - t.c) < 0.6);
      if (hasWall || hasVoid || hasCrater) return;

      gs.glacialWalls = gs.glacialWalls || [];
      gs.glacialWalls.push({
        row: t.r,
        col: t.c,
        duration: OBSIDIAN_PILLAR_VALUES.wallDuration || 4,
        type: 'obsidianPillar'
      });

      // Claim/reinforce Ash territory on the created pillar
      const pos = `${t.r},${t.c}`;
      if (gs.ashTerritory) gs.ashTerritory.add(pos);
      if (gs.snowTerritory) gs.snowTerritory.delete(pos);
      if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[pos] = gs.turnCount;

      emit(gs, {
        type: "ANIMATION",
        name: "ObsidianPillarCast",
        subType: "wall",
        targetR: t.r,
        targetC: t.c,
        casterR: p.row,
        casterC: p.col,
        casterId: p.id
      });
      return;
    }
    if (tp.team === p.team) {
      gs.shields = gs.shields || [];
      const existingIdx = gs.shields.findIndex((s) => s.pieceId === tp.id);
      const shieldData = {
        pieceId: tp.id,
        duration: OBSIDIAN_PILLAR_VALUES.shieldDuration || 2,
        hp: OBSIDIAN_PILLAR_VALUES.shieldHp || 2,
        maxHp: OBSIDIAN_PILLAR_VALUES.shieldHp || 2,
        name: "ObsidianPillarShield"
      };
      if (existingIdx !== -1) {
        gs.shields[existingIdx] = shieldData;
      } else {
        gs.shields.push(shieldData);
      }

      emit(gs, {
        type: "ANIMATION",
        name: "ObsidianPillarCast",
        subType: "shield",
        targetR: t.r,
        targetC: t.c,
        casterR: p.row,
        casterC: p.col,
        casterId: p.id,
        targetPieceId: tp.id
      });
    } else {
      const dmg = OBSIDIAN_PILLAR_VALUES.damage || 1;
      tp.power = Math.max(0, tp.power - dmg);
      if (typeof tp.currentHp === "number") {
        if (!(tp.key === 'snowFrostLord' && tp.hasHelpFromAboveActive)) {
          tp.currentHp = Math.max(0, Math.round((tp.currentHp - dmg) * 10) / 10);
        }
      }

      const dr = tp.row - p.row;
      const dc = tp.col - p.col;
      const maxDist = Math.max(Math.abs(dr), Math.abs(dc));
      const stepR = maxDist > 0 ? Math.round(dr / maxDist) : 0;
      const stepC = maxDist > 0 ? Math.round(dc / maxDist) : 0;

      const destR = tp.row + stepR;
      const destC = tp.col + stepC;

      const isValid = inBounds(destR, destC) &&
        !getPieceAt(destR, destC, gs.pieces) &&
        !gs.glacialWalls.some(w => w.row === destR && w.col === destC) &&
        !(gs.voidSquares || []).some(v => v.row === destR && v.col === destC) &&
        !(gs.specialTerrains || []).some(st => st.type === 'crater' && Math.round(st.row) === destR && Math.round(st.col) === destC);

      if (isValid) {
        emit(gs, {
          type: "ANIMATION",
          name: "ObsidianPillarCast",
          subType: "knockback",
          targetPieceId: tp.id,
          casterR: p.row,
          casterC: p.col,
          oldRow: tp.row,
          oldCol: tp.col,
          newRow: destR,
          newCol: destC,
          pillarR: t.r,
          pillarC: t.c
        });
        tp.row = destR;
        tp.col = destC;

        const pos = `${destR},${destC}`;
        (tp.team === "snow" ? gs.snowTerritory : gs.ashTerritory).add(pos);
        (tp.team === "snow" ? gs.ashTerritory : gs.snowTerritory).delete(pos);
        gs.territoryCaptureTurn[pos] = gs.turnCount;

        gs.glacialWalls = gs.glacialWalls || [];
        gs.glacialWalls.push({
          row: t.r,
          col: t.c,
          duration: OBSIDIAN_PILLAR_VALUES.wallDuration || 4,
          type: 'obsidianPillar'
        });
        const pillarPos = `${t.r},${t.c}`;
        if (gs.ashTerritory) gs.ashTerritory.add(pillarPos);
        if (gs.snowTerritory) gs.snowTerritory.delete(pillarPos);
        if (gs.territoryCaptureTurn) gs.territoryCaptureTurn[pillarPos] = gs.turnCount;
      } else {
        tp.isDazed = true;
        tp.dazedFor = Math.max(tp.dazedFor || 0, 2);

        const blocker = getPieceAt(destR, destC, gs.pieces);
        if (blocker && !blocker.isSteadfast) {
          blocker.isDazed = true;
          blocker.dazedFor = Math.max(blocker.dazedFor || 0, 2);
        }

        emit(gs, {
          type: "ANIMATION",
          name: "ObsidianPillarCast",
          subType: "slam",
          targetPieceId: tp.id,
          casterR: p.row,
          casterC: p.col,
          targetR: t.r,
          targetC: t.c
        });
      }
    }
  }
};
