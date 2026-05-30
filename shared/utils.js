/* ==========================================================================
   SECTION 1: POWER CALCULATION (LEGACY)
   Determines a unit's true combat power by aggregating base stats, boosts,
   debuffs, terrain modifiers, and faction passives.
   Kept for badge rendering, AI scoring, and backwards-compatibility.
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
        gameState.pieces
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
   SECTION 1b: NEW RPG STAT FUNCTIONS
   getEffectiveStrength / getEffectiveDefense build on the same modifier stack
   but use the piece's dedicated strength/def stats instead of the legacy power.
   dealDamage() is the single authoritative combat resolver (no RNG).
   ========================================================================== */

/**
 * Returns the effective Strength of a piece after all modifiers.
 * Applies temporary boosts, debuffs, and faction passives.
 */
export function getEffectiveStrength(piece, gameState, opponent = null) {
  if (!piece || piece.stuck > 0 || piece.isTrapped) return 0;

  // Base from RPG stat (fall back to legacy power for old-format pieces)
  let str = safe(piece.strength, safe(piece.power, 1));

  // Shrine and anchor boosts apply to all combat stats
  str += safe(piece.shrineBoost) + safe(piece.anchorBoost);
  if (piece.isConduitTier1) str += C.ANCHOR_AURA_POWER;

  // Temporary boosts
  (gameState.temporaryBoosts || [])
    .filter((b) => b.pieceId === piece.id)
    .forEach((b) => {
      if (b.name === "ConduitHighwayBuff") str += C.ANCHOR_AURA_POWER;
      else if (
        b.name === "FrostArmor" ||
        b.name === "KindleArmor" ||
        b.name === "AegisDefense"
      )
        return; // DEF-only boosts don't affect STR
      else if (b.name === "HuntersRage") str += safe(b.amount); // always adds to STR
      else str += safe(b.amount);
    });

  // Help From Above aura
  gameState.pieces.forEach(p => {
    if (p.team === piece.team && p.isVeteran && C.PIECE_TYPES[p.key]?.veteranAbility?.key === "HelpFromAbove") {
      if (Math.hypot(p.row - piece.row, p.col - piece.col) <= (C.ABILITY_VALUES.HelpFromAbove?.radius || 1.5)) {
        str += C.ABILITY_VALUES.HelpFromAbove?.strengthBoost || 1;
      }
    }
  });

  // Debuffs reduce strength
  (gameState.debuffs || [])
    .filter((x) => x.pieceId === piece.id)
    .forEach((d) => { if (d.amount > 0) str -= safe(d.amount); });

  if ((gameState.markedPieces || []).some((m) => m.targetId === piece.id))
    str -= C.ABILITY_VALUES.MarkOfCinder?.powerDebuff || 0;

  // Chilling Aura debuff from adjacent enemies
  const oppTeam = piece.team === "snow" ? "ash" : "snow";
  for (let r = -1; r <= 1; r++)
    for (let c = -1; c <= 1; c++) {
      if (r === 0 && c === 0) continue;
      const adj = C.getPieceAt(piece.row + r, piece.col + c, gameState.pieces);
      if (
        adj?.team === oppTeam &&
        adj.ability?.name === "Chilling Aura" &&
        adj.ability.active
      )
        str -= C.ABILITY_VALUES.ChillingAura?.powerDebuff || 0;
    }

  // TargetedWeakness faction passive — bonus STR when attacking debuffed targets
  if (
    gameState.factionPassives[piece.team]?.ascension?.TargetedWeakness &&
    opponent?.id
  ) {
    if (
      (gameState.debuffs || []).some((d) => d.pieceId === opponent.id) ||
      (gameState.markedPieces || []).some((m) => m.targetId === opponent.id) ||
      opponent.stuck > 0 ||
      opponent.isDazed
    )
      str += C.ANCHOR_AURA_POWER;
  }

  return Math.max(0, str);
}

/**
 * Returns the effective Defense of a piece after all modifiers.
 */
export function getEffectiveDefense(piece, gameState) {
  if (!piece || piece.isTrapped) return 0;

  let def = safe(piece.def, 0);

  // Shrine and anchor boosts also apply to defense
  def += safe(piece.shrineBoost) + safe(piece.anchorBoost);

  // FrostArmor / KindleArmor / AegisDefense specifically boost defense
  (gameState.temporaryBoosts || [])
    .filter((b) => b.pieceId === piece.id)
    .forEach((b) => {
      if (
        b.name === "FrostArmor" ||
        b.name === "KindleArmor" ||
        b.name === "AegisDefense"
      )
        def += safe(b.amount);
      else if (b.name === "ConduitHighwayBuff") def += C.ANCHOR_AURA_POWER;
    });

  // Unstable Ground on own tile reduces effective defense
  if (
    (gameState.unstableGrounds || []).some(
      (g) =>
        g.row === Math.round(piece.row) &&
        g.col === Math.round(piece.col) &&
        g.creator?.team !== piece.team
    )
  )
    def -= C.ABILITY_VALUES.UnstableGround?.damage || 0;

  // HomeFieldAdvantage adds bonus defense on starting squares
  if (gameState.factionPassives[piece.team]?.ascension?.HomeFieldAdvantage) {
    if (
      (piece.team === "snow"
        ? C.SHAPES.topLayout
        : C.SHAPES.bottomLayout
      ).some(([r, c]) => Math.round(r) === Math.round(piece.row) && Math.round(c) === Math.round(piece.col))
    )
      def += 1;
  }

  return Math.max(0, def);
}

/**
 * Core combat resolver — deterministic, zero RNG (complies with shared-logic constraint).
 * Computes: damage = Math.max(1, attacker_STR - defender_DEF)
 * Deducts damage from defender.currentHp.
 * Returns damage dealt. Piece is NOT removed here — caller checks currentHp <= 0.
 */
export function dealDamage(attacker, defender, gameState) {
  if (!attacker || !defender) return 0;

  const str = getEffectiveStrength(attacker, gameState, defender);
  const def = getEffectiveDefense(defender, gameState);
  const dmg = Math.max(1, str - def);

  // Guard against missing stat (pieces from old serialized states)
  if (typeof defender.currentHp !== "number") {
    const fallbackHp = C.PIECE_TYPES[defender.key]?.stats?.hp || 5;
    defender.maxHp = fallbackHp;
    defender.currentHp = fallbackHp;
  }

  let actualDmg = Math.min(defender.currentHp, dmg);
  
  // Passives triggering on Lethal Strike are now handled centrally in handlePieceCapture 
  // via applyAoeLethalPassives so they trigger identically across movement and AoE.
  
  // Check if defender has Magma Shield (blocks 1 damage)
  const shieldIdx = (gameState.shields || []).findIndex(s => s.pieceId === defender.id);
  if (shieldIdx !== -1 && actualDmg > 0) {
    actualDmg = Math.max(0, actualDmg - 1);
    gameState.shields.splice(shieldIdx, 1); // consume the shield
  }

  defender.currentHp = Math.max(0, defender.currentHp - actualDmg);

  // Fate Link: When the friendly (source) takes damage, mirror to the bound enemy
  if (gameState.fateLinks && actualDmg > 0) {
    gameState.fateLinks.forEach(fl => {
      if (fl.sourceId === defender.id) {
        const boundEnemy = gameState.pieces.find(p => p.id === fl.targetId);
        if (boundEnemy) {
          boundEnemy.currentHp = Math.max(0, boundEnemy.currentHp - actualDmg);
          // Note: if boundEnemy.currentHp <= 0, handlePieceCapture will fire
          // from isCaptureSuccessful's caller and Cold Snap will trigger there.
        }
      }
    });
  }
  
  attacker.damageDealt = (attacker.damageDealt || 0) + actualDmg;

  return dmg;
}

/**
 * Bug 1.1 & 1.3 fix: Checks and applies lethal-strike passives (HelpFromAbove, Death Meteor)
 * before an AoE source removes a piece. Returns true if the passive intercepted the kill.
 * Call this in AoE upkeep loops instead of directly invoking handlePieceCapture when HP <= 0.
 */
export function applyAoeLethalPassives(piece, gameState) {
  if (!piece || typeof piece.currentHp !== "number" || piece.currentHp > 0) return false;

  // Frost Lord – Help From Above
  if (
    C.PIECE_TYPES[piece.key]?.veteranAbility?.key === "HelpFromAbove" ||
    C.PIECE_TYPES[piece.key]?.ability?.key === "HelpFromAbove"
  ) {
    if ((piece.helpFromAboveCooldown || 0) <= 0) {
      piece.currentHp = 1;
      piece.helpFromAboveCooldown = C.ABILITY_VALUES.HelpFromAbove?.cooldown || 15;
      piece.hasHelpFromAboveActive = true;
      piece.helpFromAboveActiveTurns = C.ABILITY_VALUES.HelpFromAbove?.activeDuration || 5;
      const radius = C.ABILITY_VALUES.HelpFromAbove?.radius || 1.5;
      if (gameState.pieces && gameState.temporaryBoosts) {
        gameState.pieces.forEach(ally => {
          if (ally.team === piece.team && ally.id !== piece.id) {
            const dist = Math.hypot(ally.row - piece.row, ally.col - piece.col);
            if (dist <= radius) {
              gameState.temporaryBoosts.push({
                pieceId: ally.id,
                amount: C.ABILITY_VALUES.HelpFromAbove?.strengthBoost || 1,
                duration: 5,
                name: "HelpFromAboveAura"
              });
            }
          }
        });
      }
      return true; // intercept: do NOT capture
    }
  }

  // Ash Tyrant – Death Meteor
  if (piece.key === "ashAshTyrant") {
    if ((piece.deathMeteorCooldown || 0) <= 0) {
      piece.currentHp = 1;
      piece.deathMeteorCooldown = 15;
      if (gameState.pieces) {
        gameState.pieces.forEach(p => {
          const dist = Math.hypot(p.row - piece.row, p.col - piece.col);
          if (dist <= 2 && p.id !== piece.id) {
            if (p.team !== piece.team) {
              p.currentHp = Math.max(0, (p.currentHp || 5) - 4);
            } else {
              p.currentHp = Math.max(0, (p.currentHp || 5) - 2);
            }
          }
        });
      }
      gameState.deathMeteors = gameState.deathMeteors || [];
      gameState.deathMeteors.push({ r: piece.row, c: piece.col });
      return true; // intercept: do NOT capture
    }
  }

  return false;
}

/* ==========================================================================
   SECTION 2: MOVEMENT & COMBAT VALIDATION
   Calculates all legal moves for a given piece and resolves combat outcomes.
   ========================================================================== */

/**
 * Determines if an attack attempt is successful.
 * With the HP system: applies dealDamage(), returns true only when HP <= 0.
 * Falls back to legacy power comparison for old serialized pieces.
 *
 * SIDE-EFFECT WARNING: Mutates defender.currentHp on every call.
 * Use previewDamage() for read-only UI predictions.
 */
export function isCaptureSuccessful(attacker, defender, gameState) {
  // Legacy fallback for pieces without strength/currentHp fields
  if (
    typeof defender.currentHp !== "number" ||
    typeof attacker.strength !== "number"
  ) {
    const aPower = getEffectivePower(attacker, gameState, defender, "attacking");
    const dPower = getEffectivePower(defender, gameState, attacker, "defending");
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

  // New HP-based path
  dealDamage(attacker, defender, gameState);
  return defender.currentHp <= 0;
}

/**
 * Read-only damage preview — does NOT mutate currentHp.
 * Used by the Tactical Predictor in the client mousemove handler.
 */
export function previewDamage(attacker, defender, gameState) {
  const str = getEffectiveStrength(attacker, gameState, defender);
  const def = getEffectiveDefense(defender, gameState);
  const dmg = Math.max(1, str - def);
  const defHp =
    typeof defender.currentHp === "number"
      ? defender.currentHp
      : C.PIECE_TYPES[defender.key]?.stats?.hp || 5;
  return { dmg, isFatal: dmg >= defHp };
}

/**
 * Returns a piece's BFS movement budget.
 * Now reads from the agility stat on the piece object (initialized by createPiece).
 * Falls back to the old key-pattern heuristic for backward-compat with old saves.
 */
export function getPieceMoveRadius(piece) {
  if (!piece) return 2;
  // New stat-based radius — agility IS the move budget
  if (typeof piece.agility === "number") return piece.agility;
  // Legacy fallback (pieces from old saves without agility stat)
  const key = piece.key || "";
  if (
    key.includes("Strider") ||
    key.includes("Trapper") ||
    key.includes("Stalker") ||
    key.includes("Scout") ||
    key.includes("Prowler") ||
    key.includes("Brute") ||
    key.includes("Yeti") ||
    key.includes("Beast")
  ) {
    return 3;
  }
  return 2;
}

export function getValidMoves(piece, gameState) {
  if (!piece || piece.stuck > 0 || piece.isDazed || piece.isTrapped) return [];
  const moves = [],
    boardMap = gameState.pieces || [],
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

  // Hostile traps that force a movement stop mid-BFS
  const snares = (gameState.specialTerrains || []).filter(
    (t) => t.type === "snare" && t.team !== piece.team
  );
  const hazards = gameState.unstableGrounds || [];

  const isFree = (r, c) => {
    const gridR = Math.round(r);
    const gridC = Math.round(c);
    return !walls.some((w) => w.row === gridR && w.col === gridC) &&
           !voids.some((v) => v.row === gridR && v.col === gridC);
  };

  // Returns true if landing here triggers an enemy trap (BFS halts expansion)
  const isHostileTrap = (r, c) => {
    const gridR = Math.round(r);
    const gridC = Math.round(c);
    return snares.some((t) => t.row === gridR && t.col === gridC) ||
      hazards.some(
        (g) => g.row === gridR && g.col === gridC && g.creator?.team !== piece.team
      );
  };

  // 1. Conduit Link Anchor Teleports
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
              const target = C.getPieceAt(r, c, gameState.pieces);
              if (
                !target ||
                (target.team !== piece.team &&
                  previewDamage(piece, target, gameState).dmg > 0)
              )
                moves.push({ row: r, col: c, isHighway: true });
            }
          }
      }
    }
  }

  // 2. BFS Pathfinding — budget driven by piece.agility stat
  const moveRadius = getPieceMoveRadius(piece);
  const queue = [{ r: piece.row, c: piece.col, d: 0 }];
  const visited = new Set([`${piece.row},${piece.col}`]);
  const normalMovesMap = new Map(); // posKey -> moveObject

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.d >= moveRadius) continue;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (isRestricted && dr !== 0 && dc !== 0) continue; // diagonal restricted

        const nr = curr.r + dr;
        const nc = curr.c + dc;
        const posKey = `${nr},${nc}`;

        if (nr < 0 || nr >= C.ROWS || nc < 0 || nc >= C.COLS) continue;
        if (visited.has(posKey)) continue;
        if (!isFree(nr, nc)) continue;

        // Diagonal movement wall corner check
        if (
          dr !== 0 &&
          dc !== 0 &&
          (walls.some((w) => w.row === nr && w.col === curr.c) ||
            walls.some((w) => w.row === curr.r && w.col === nc))
        )
          continue;

        visited.add(posKey);
        const target = C.getPieceAt(nr, nc, gameState.pieces);

        if (!target) {
          // Empty cell: always landable
          normalMovesMap.set(posKey, { row: nr, col: nc });

          // TRAP-STOP: hostile trap cells halt further BFS expansion from this tile.
          // The unit CAN land here but cannot continue moving through.
          if (!isHostileTrap(nr, nc)) {
            queue.push({ r: nr, c: nc, d: curr.d + 1 });
          }
        } else if (target.team !== piece.team) {
          // Enemy cell: landable only if attack deals damage. Not passable.
          const preview = previewDamage(piece, target, gameState);
          if (preview.dmg > 0) {
            normalMovesMap.set(posKey, { row: nr, col: nc });
          }
        } else {
          // Ally cell: passable but NOT landable
          queue.push({ r: nr, c: nc, d: curr.d + 1 });
        }
      }
    }
  }

  // Add the normal BFS moves
  moves.push(...normalMovesMap.values());

  // 3. Special movement passives (Acrobat, Icy Highways)
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r1 = piece.row + dr,
        c1 = piece.col + dc,
        r2 = r1 + dr,
        c2 = c1 + dc;

      // Acrobat leaps (jump over a friendly unit)
      if (
        piece.isAcrobat &&
        !isRestricted &&
        (Math.abs(dr) + Math.abs(dc) === 1 || Math.abs(dr) === Math.abs(dc)) &&
        r2 >= 0 &&
        r2 < C.ROWS &&
        c2 >= 0 &&
        c2 < C.COLS
      ) {
        const intP = C.getPieceAt(r1, c1, gameState.pieces);
        if (intP?.team === piece.team && isFree(r1, c1) && isFree(r2, c2)) {
          const tgt = C.getPieceAt(r2, c2, gameState.pieces);
          if (
            !tgt ||
            (tgt.team !== piece.team &&
              previewDamage(piece, tgt, gameState).dmg > 0)
          ) {
            const exists = moves.some((m) => m.row === r2 && m.col === c2);
            if (!exists) moves.push({ row: r2, col: c2, isAcrobatJump: true });
          }
        }
      }

      // Icy Highways (Snow faction passive — slide along owned territory)
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
          !C.getPieceAt(r1, c1, gameState.pieces) &&
          isFree(r1, c1) &&
          r2 >= 0 &&
          r2 < C.ROWS &&
          c2 >= 0 &&
          c2 < C.COLS &&
          isFree(r2, c2)
        ) {
          const tgt = C.getPieceAt(r2, c2, gameState.pieces);
          if (
            !tgt ||
            (tgt.team !== piece.team &&
              previewDamage(piece, tgt, gameState).dmg > 0)
          ) {
            const exists = moves.some((m) => m.row === r2 && m.col === c2);
            if (!exists) moves.push({ row: r2, col: c2, isIcyHighway: true });
          }
        }
      }
    }

  return moves;
}

/* ==========================================================================
   SECTION 3: STATE UTILITIES
   Helper functions for map management and asset loading.
   ========================================================================== */
export function updateBoardMap(gameState) {
  // OBSOLETE: We now use continuous floating-point coordinates.
  // Pieces are stored in the flat 1D array `gameState.pieces`.
  // Do not overwrite it with a 2D array!
}



export function preloadImages(sources, callback) {
  const imgs = {},
    keys = Object.keys(sources || {});
  if (!keys.length) return callback(imgs);
  let loaded = 0;
  keys.forEach((k) => {
    const img = new Image();
    img.src = sources[k];
    img.onload = () => {
      imgs[k] = img;
      if (++loaded === keys.length) callback(imgs);
    };
    img.onerror = () => {
      imgs[k] = img;
      if (++loaded === keys.length) callback(imgs);
    };
  });
}
