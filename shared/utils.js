/* ==========================================================================
   SECTION 1: POWER CALCULATION
   Determines a unit's true combat power by aggregating base stats, boosts,
   debuffs, terrain modifiers, and faction passives.
   ========================================================================== */
import * as C from "./constants.js";

const safe = (v, d = 0) => (typeof v === "number" ? v : d);

export function getEffectivePower(
  piece,
  gameState,
  opponent = null,
  combatRole = null
) {
  if (
    !piece ||
    piece.stuck > 0 ||
    piece.key === "snowIceWisp" ||
    piece.isTrapped
  )
    return 0;

  let base =
    safe(piece.power) + safe(piece.shrineBoost) + safe(piece.anchorBoost);
  if (piece.isConduitTier1) base += C.ANCHOR_AURA_POWER;

  (gameState.temporaryBoosts || [])
    .filter((b) => b.pieceId === piece.id)
    .forEach((b) => {
      if (b.name === "ConduitHighwayBuff") base += C.ANCHOR_AURA_POWER;
      else if (
        ["FrostArmor", "KindleArmor", "AegisDefense"].includes(b.name) &&
        combatRole !== "defending"
      )
        return;
      else if (b.name === "HuntersRage" && combatRole !== "attacking") return;
      else base += safe(b.amount);
    });

  if ((gameState.markedPieces || []).some((m) => m.targetId === piece.id))
    base -= C.ABILITY_VALUES.MarkOfCinder?.powerDebuff || 0;
  (gameState.debuffs || [])
    .filter((x) => x.pieceId === piece.id)
    .forEach((d) => {
      if (d.amount > 0) base -= safe(d.amount);
    });

  if (
    (gameState.unstableGrounds || []).some(
      (g) =>
        g.row === piece.row &&
        g.col === piece.col &&
        g.creator?.team !== piece.team
    )
  )
    base -= C.ABILITY_VALUES.UnstableGround?.damage || 0;
  if (
    piece.team !== "ash" &&
    gameState.factionPassives?.ash?.territory?.ScorchedEarth &&
    gameState.ashTerritory.has(`${piece.row},${piece.col}`)
  )
    base -= C.TERRITORY_PASSIVES.DEBUFF_AMOUNT;

  const oppTeam = piece.team === "snow" ? "ash" : "snow";
  for (let r = -1; r <= 1; r++)
    for (let c = -1; c <= 1; c++) {
      if (r === 0 && c === 0) continue;
      const adj = C.getPieceAt(
        piece.row + r,
        piece.col + c,
        gameState.boardMap
      );
      if (
        adj?.team === oppTeam &&
        adj.ability?.name === "Chilling Aura" &&
        adj.ability.active
      )
        base -= C.ABILITY_VALUES.ChillingAura?.powerDebuff || 0;
    }

  if (
    combatRole === "defending" &&
    gameState.factionPassives[piece.team]?.ascension?.HomeFieldAdvantage
  ) {
    if (
      (piece.team === "snow" ? C.SHAPES.topLayout : C.SHAPES.bottomLayout).some(
        ([r, c]) => r === piece.row && c === piece.col
      )
    )
      base += 1;
  }

  if (
    combatRole === "attacking" &&
    gameState.factionPassives[piece.team]?.ascension?.TargetedWeakness &&
    opponent?.id
  ) {
    if (
      (gameState.debuffs || []).some((d) => d.pieceId === opponent.id) ||
      (gameState.markedPieces || []).some((m) => m.targetId === opponent.id) ||
      opponent.stuck > 0 ||
      opponent.isDazed
    )
      base += C.ANCHOR_AURA_POWER;
  }

  return Math.max(0, base);
}

/* ==========================================================================
   SECTION 2: MOVEMENT & COMBAT VALIDATION
   Calculates all legal moves for a given piece and resolves combat outcomes.
   ========================================================================== */
export function isCaptureSuccessful(attacker, defender, gameState) {
  const aPower = getEffectivePower(attacker, gameState, defender, "attacking");
  let dPower = getEffectivePower(defender, gameState, attacker, "defending");

  if (aPower > dPower) return true;
  if (aPower === dPower) {
    if (attacker.isEntrenched && attacker.team === gameState.currentTurn)
      return true;
    if (defender.isEntrenched && defender.team !== gameState.currentTurn)
      return false;
    return (
      (attacker.team === "snow"
        ? gameState.snowTerritory.size
        : gameState.ashTerritory.size) >
      (defender.team === "snow"
        ? gameState.snowTerritory.size
        : gameState.ashTerritory.size)
    );
  }
  return false;
}

export function getValidMoves(piece, gameState) {
  if (!piece || piece.stuck > 0 || piece.isDazed || piece.isTrapped) return [];
  const moves = [],
    boardMap = gameState.boardMap || [],
    debuffs = gameState.debuffs || [];
  const isRestricted = debuffs.some(
    (d) => d.pieceId === piece.id && ["Edict", "Hamstrung"].includes(d.name)
  );
  const isIcyHighways =
    piece.team === "snow" &&
    gameState.factionPassives?.snow?.territory?.IcyHighways;
  const isLinkOwned =
    gameState.conduitLinkActive &&
    gameState.conduitTeam === piece.team &&
    !gameState.conduitIsContested;
  const voids = gameState.voidSquares || [],
    walls = gameState.glacialWalls || [];

  const isFree = (r, c) =>
    !walls.some((w) => w.row === r && w.col === c) &&
    !voids.some((v) => v.row === r && v.col === c);

  if (isLinkOwned) {
    const anchors = Object.values(gameState.riftAnchors || {});
    const adj = anchors.find(
      (a) =>
        a &&
        Math.max(Math.abs(piece.row - a.row), Math.abs(piece.col - a.col)) <= 1
    );
    if (
      adj &&
      (!isRestricted ||
        Math.abs(piece.row - adj.row) !== 1 ||
        Math.abs(piece.col - adj.col) !== 1)
    ) {
      const targetAnchor = anchors.find((a) => a && a !== adj);
      if (targetAnchor) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (
              (dr === 0 && dc === 0) ||
              (isRestricted && dr !== 0 && dc !== 0)
            )
              continue;
            const r = targetAnchor.row + dr,
              c = targetAnchor.col + dc;
            if (r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS) {
              const target = C.getPieceAt(r, c, boardMap);
              if (
                !target ||
                (target.team !== piece.team &&
                  isCaptureSuccessful(piece, target, gameState))
              )
                moves.push({ row: r, col: c, isHighway: true });
            }
          }
      }
    }
  }

  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r1 = piece.row + dr,
        c1 = piece.col + dc,
        r2 = r1 + dr,
        c2 = c1 + dc;

      if (
        isIcyHighways &&
        !isRestricted &&
        Math.abs(dr) + Math.abs(dc) === 1 &&
        r2 >= 0 &&
        r2 < C.ROWS &&
        c2 >= 0 &&
        c2 < C.COLS
      ) {
        if (
          gameState.snowTerritory.has(`${piece.row},${piece.col}`) &&
          gameState.snowTerritory.has(`${r1},${c1}`) &&
          gameState.snowTerritory.has(`${r2},${c2}`) &&
          !C.getPieceAt(r1, c1, boardMap) &&
          isFree(r1, c1) &&
          isFree(r2, c2)
        ) {
          const target = C.getPieceAt(r2, c2, boardMap);
          // FIX: Removed the duplicate `isIcyHighways: true` flag inside the push
          if (
            !target ||
            (target.team !== piece.team &&
              isCaptureSuccessful(piece, target, gameState))
          )
            moves.push({ row: r2, col: c2, isIcyHighway: true });
        }
      }

      if (
        piece.isAcrobat &&
        !isRestricted &&
        (Math.abs(dr) + Math.abs(dc) === 1 || Math.abs(dr) === Math.abs(dc)) &&
        r2 >= 0 &&
        r2 < C.ROWS &&
        c2 >= 0 &&
        c2 < C.COLS
      ) {
        const intP = C.getPieceAt(r1, c1, boardMap);
        if (intP?.team === piece.team && isFree(r1, c1) && isFree(r2, c2)) {
          const target = C.getPieceAt(r2, c2, boardMap);
          if (
            !target ||
            (target.team !== piece.team &&
              isCaptureSuccessful(piece, target, gameState))
          )
            moves.push({ row: r2, col: c2, isAcrobatJump: true });
        }
      }

      if (isRestricted && dr !== 0 && dc !== 0) continue;
      if (r1 < 0 || r1 >= C.ROWS || c1 < 0 || c1 >= C.COLS || !isFree(r1, c1))
        continue;
      if (
        dr !== 0 &&
        dc !== 0 &&
        (walls.some((w) => w.row === r1 && w.col === piece.col) ||
          walls.some((w) => w.row === piece.row && w.col === c1))
      )
        continue;

      const target = C.getPieceAt(r1, c1, boardMap);
      if (
        !target ||
        (target.team !== piece.team &&
          isCaptureSuccessful(piece, target, gameState))
      )
        moves.push({ row: r1, col: c1 });
    }
  return moves;
}

/* ==========================================================================
   SECTION 3: STATE UTILITIES
   Helper functions for map management and asset loading.
   ========================================================================== */
export function updateBoardMap(gameState) {
  // 1. Completely clear the map first
  gameState.boardMap = Array(10)
    .fill(null)
    .map(() => Array(10).fill(null));

  // 2. Repopulate with active pieces
  for (const piece of gameState.pieces) {
    if (piece.row >= 0 && piece.col >= 0) {
      gameState.boardMap[piece.row][piece.col] = piece;
    }
  }
}

export function preloadImages(sources, callback) {
  const imgs = {},
    keys = Object.keys(sources || {});
  if (!keys.length) return callback(imgs);
  let loaded = 0;
  keys.forEach((k) => {
    const img = new Image();
    img.src = sources[k];
    img.onload = img.onerror = () => {
      imgs[k] = img;
      if (++loaded === keys.length) callback(imgs);
    };
  });
}
