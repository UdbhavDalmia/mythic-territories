/* ==========================================================================
   SECTION 1: CORE ENGINE METRICS
   Defines the fundamental grid math, tile types, and rendering dimensions 
   shared by both the logic engine and the client renderer.
   ========================================================================== */
import { UNIT_REGISTRY } from './units/registry.js';

export const CANVAS_SIZE = 920;
export const COLS = 10;
export const ROWS = 10;
export const CELL_SIZE = CANVAS_SIZE / COLS;
export const TILE_TYPES = {
  EMPTY: "empty",
  RIFT: "rift",
  VOID: "void",
  ELEMENTAL_CORE: "core"
};
export const Teams = { ASH: "ash", SNOW: "snow" };
export const BOOST_NAMES = {};

/* ==========================================================================
   SECTION 2: ASSET REGISTRIES
   Dictionaries mapping unit keys to their visual assets and color palettes. 
   The server ignores this, but the client reads it to render the board.
   ========================================================================== */
export const RIFT_COLORS = { VOID: "#11001C", SNOW: "#00BFFF", ASH: "#FF4500" };
export const BOARD_IMAGE_KEYS = ["gameBackgroundSnow", "gameBackgroundAsh"];
export const IMAGES = {
  ashAshStrider: "units/blaze-runner.webp",
  ashAshTyrant: UNIT_REGISTRY.ashAshTyrant.image,
  ashBlazeboundBeast: "units/hell-hound.webp",
  ashCinderScout: "units/cinder-scout.webp",
  ashMagmaProwler: "units/magma-prowler.webp",
  ashMagmaSpitter: "units/magma-spitter.webp",
  ashMagmaShaper: UNIT_REGISTRY.ashMagmaShaper.image,
  ashRiftForger: "units/rift-forger.webp",
  ashAshReaper: UNIT_REGISTRY.ashAshReaper.image,
  ashScorchPriest: "units/scorch-priest.webp",
  gameBackgroundAsh: "images/bg-game2.webp",
  gameBackgroundSnow: "images/bg-game.webp",
  obsidianPillar: "images/obsidian-pillar.webp",
  snowArcticTrapper: "units/arctic-trapper.webp",
  snowGlacialMage: UNIT_REGISTRY.snowGlacialMage.image,
  snowFrostLord: UNIT_REGISTRY.snowFrostLord.image,
  snowFrostbiteStalker: "units/snow-wolf.webp",
  snowGlacialBrute: "units/glacial-brute.webp",
  snowHoarfrostMystic: "units/hoarfrost-mystic.webp",
  snowIceWeaver: "units/ice-weaver.webp",
  snowIceWisp: UNIT_REGISTRY.snowIceWisp.image,
  snowRampagingYeti: "units/yeti.webp",
  snowSoulFreeze: "units/soul-freeze.webp",
  snowSoulLinker: UNIT_REGISTRY.snowSoulLinker.image
};

/* ==========================================================================
   SECTION 3: GAMEPLAY TUNING & BALANCE METRICS
   Centralized numerical values for abilities, thresholds, and timers. 
   Tweak these to balance the game without hunting through logic functions.
   ========================================================================== */
export const TERRITORY_UNLOCK_THRESHOLD = 30;
export const TERRITORY_PASSIVES = {
  ICY_HIGHWAYS: "IcyHighways",
  VOLATILE_CLAIM: "ScorchedEarth",
  DEBUFF_AMOUNT: 1
};
export const CONDUIT_OVERCHARGE_TIER1_TURNS = 4;
export const CONDUIT_OVERCHARGE_TIER2_TURNS = 7;
export const ANCHOR_AURA_POWER = 1;
export const CONDUIT_HIGHWAY_BUFF_DURATION = 2;
export const ULTIMATE_MIN_TURN = 5;
export const CONDUIT_VALUES = {
  VENTING_TEMP_DAMAGE: 1,
  OVERCHARGE_RADIUS: 2,
  SCAR_DURATION: 99,
  GRAVITY_WELL_RANGE: 1,
  STABILIZE_COST: 1,
  PHASE_SPARKING: 1,
  PHASE_CRITICAL: 2,
  PHASE_COLLAPSE: 3
};

export function cellIntersectsCircle(r, c, targetR, targetC, radius) {
  // Support both continuous float unit coordinates and legacy grid tiles
  const cx = targetC + 0.5;
  const cy = targetR + 0.5;
  const unitCx = c + 0.5;
  const unitCy = r + 0.5;
  const dist = Math.hypot(unitCx - cx, unitCy - cy);
  // Unit body radius is ~0.45; if body overlaps the circle, it intersects
  return dist <= radius + 0.45;
}

export function cellIntersectsSector(r, c, sourceR, sourceC, targetR, targetC, range, sectorAngleWidth = Math.PI / 3) {
  const cx = sourceC + 0.5;
  const cy = sourceR + 0.5;
  const tx = targetC + 0.5;
  const ty = targetR + 0.5;
  const unitX = c + 0.5;
  const unitY = r + 0.5;

  const dx = unitX - cx;
  const dy = unitY - cy;
  const dist = Math.hypot(dx, dy);

  if (dist > range + 0.45) return false;

  const theta = Math.atan2(ty - cy, tx - cx);
  let angle = Math.atan2(dy, dx);
  let diff = angle - theta;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff) <= sectorAngleWidth / 2 + 0.2;
}

/* ==========================================================================
   SECTION 4: ENGINE HELPERS & TARGETING LOGIC
   Pure functions used heavily by abilities to validate board state.
   ========================================================================== */
export const getPieceAt = (r, c, pieces) => {
  if (!pieces) return null;
  const len = pieces.length;
  for (let i = 0; i < len; i++) {
    const p = pieces[i];
    if (!p) continue;
    const dr = p.row - r;
    if (dr > 0.7 || dr < -0.7) continue;
    const dc = p.col - c;
    if (dc > 0.7 || dc < -0.7) continue;
    if (dr * dr + dc * dc < 0.49) return p;
  }
  return null;
};
export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/**
 * Determines whether there is an unobstructed continuous line of sight between
 * a source position and a target position.
 * Obstacles include: other live pieces, glacial walls / obsidian pillars,
 * void squares, and craters.
 * 
 * @param {number} fromR - Source row
 * @param {number} fromC - Source col
 * @param {number} toR - Target row
 * @param {number} toC - Target col
 * @param {Object} gameState - Current game state
 * @param {Object} [options] - Optional settings
 * @param {number} [options.ignoredPieceId] - ID of piece that should not block (e.g. caster)
 * @param {number} [options.targetPieceId] - ID of piece being targeted (should not block itself)
 * @param {boolean} [options.ignoreTargetPiece=true] - If true, any entity within 0.45 of target does not block
 * @returns {{ hasLos: boolean, blocker: Object|null, hitDistance: number|null, hitRow: number|null, hitCol: number|null }}
 */
export function hasLineOfSight(fromR, fromC, toR, toC, gameState, options = {}) {
  const { ignoredPieceId = null, targetPieceId = null, ignoreTargetPiece = true } = options;
  const dr = toR - fromR;
  const dc = toC - fromC;
  const totalDist = Math.hypot(dr, dc);

  // If source and target are essentially the same point, line of sight is clear
  if (totalDist < 0.15) {
    return { hasLos: true, blocker: null, hitDistance: null, hitRow: null, hitCol: null };
  }

  const uR = dr / totalDist;
  const uC = dc / totalDist;

  let closestBlocker = null;
  let minHitDist = Infinity;
  let hitR = null;
  let hitC = null;

  // 1. Check pieces as obstacles
  if (gameState && Array.isArray(gameState.pieces)) {
    const pLen = gameState.pieces.length;
    for (let i = 0; i < pLen; i++) {
      const p = gameState.pieces[i];
      if (!p || (typeof p.currentHp === 'number' && p.currentHp <= 0)) continue;
      if (ignoredPieceId !== null && p.id === ignoredPieceId) continue;
      if (targetPieceId !== null && p.id === targetPieceId) continue;

      const distToTarget = Math.hypot(p.row - toR, p.col - toC);
      if (ignoreTargetPiece && distToTarget < 0.45) continue;

      const wR = p.row - fromR;
      const wC = p.col - fromC;
      const t = wR * uR + wC * uC;
      if (t <= 0.25 || t >= totalDist - 0.25) continue;

      const perpDistSq = (wR * wR + wC * wC) - (t * t);
      const pieceRadius = 0.38;
      if (perpDistSq < pieceRadius * pieceRadius) {
        if (t < minHitDist) {
          minHitDist = t;
          hitR = fromR + uR * t;
          hitC = fromC + uC * t;
          closestBlocker = { type: 'piece', piece: p, row: p.row, col: p.col };
        }
      }
    }
  }

  // 2. Check Glacial Walls / Obsidian Pillars
  if (gameState && Array.isArray(gameState.glacialWalls)) {
    const wLen = gameState.glacialWalls.length;
    for (let i = 0; i < wLen; i++) {
      const w = gameState.glacialWalls[i];
      if (!w || (w.duration !== undefined && w.duration <= 0)) continue;

      const distToTarget = Math.hypot(w.row - toR, w.col - toC);
      if (ignoreTargetPiece && distToTarget < 0.45) continue;

      const wR = w.row - fromR;
      const wC = w.col - fromC;
      const t = wR * uR + wC * uC;
      if (t <= 0.25 || t >= totalDist - 0.25) continue;

      const perpDistSq = (wR * wR + wC * wC) - (t * t);
      const wallRadius = 0.44;
      if (perpDistSq < wallRadius * wallRadius) {
        if (t < minHitDist) {
          minHitDist = t;
          hitR = fromR + uR * t;
          hitC = fromC + uC * t;
          closestBlocker = { type: 'wall', wall: w, row: w.row, col: w.col };
        }
      }
    }
  }

  // 3. Check Void Squares
  if (gameState && Array.isArray(gameState.voidSquares)) {
    const vLen = gameState.voidSquares.length;
    for (let i = 0; i < vLen; i++) {
      const v = gameState.voidSquares[i];
      if (!v) continue;

      const distToTarget = Math.hypot(v.row - toR, v.col - toC);
      if (ignoreTargetPiece && distToTarget < 0.45) continue;

      const wR = v.row - fromR;
      const wC = v.col - fromC;
      const t = wR * uR + wC * uC;
      if (t <= 0.25 || t >= totalDist - 0.25) continue;

      const perpDistSq = (wR * wR + wC * wC) - (t * t);
      const voidRadius = 0.44;
      if (perpDistSq < voidRadius * voidRadius) {
        if (t < minHitDist) {
          minHitDist = t;
          hitR = fromR + uR * t;
          hitC = fromC + uC * t;
          closestBlocker = { type: 'void', void: v, row: v.row, col: v.col };
        }
      }
    }
  }

  // 4. Check Craters (Special Terrains)
  if (gameState && Array.isArray(gameState.specialTerrains)) {
    const stLen = gameState.specialTerrains.length;
    for (let i = 0; i < stLen; i++) {
      const st = gameState.specialTerrains[i];
      if (!st || st.type !== 'crater') continue;

      const distToTarget = Math.hypot(st.row - toR, st.col - toC);
      if (ignoreTargetPiece && distToTarget < 0.45) continue;

      const wR = st.row - fromR;
      const wC = st.col - fromC;
      const t = wR * uR + wC * uC;
      if (t <= 0.25 || t >= totalDist - 0.25) continue;

      const perpDistSq = (wR * wR + wC * wC) - (t * t);
      const craterRadius = 0.44;
      if (perpDistSq < craterRadius * craterRadius) {
        if (t < minHitDist) {
          minHitDist = t;
          hitR = fromR + uR * t;
          hitC = fromC + uC * t;
          closestBlocker = { type: 'crater', terrain: st, row: st.row, col: st.col };
        }
      }
    }
  }

  if (closestBlocker) {
    return { hasLos: false, blocker: closestBlocker, hitDistance: minHitDist, hitRow: hitR, hitCol: hitC };
  }

  return { hasLos: true, blocker: null, hitDistance: null, hitRow: null, hitCol: null };
}

export function emit(gs, eventPayload) {
  if (!gs.events) gs.events = [];
  gs.events.push(eventPayload);
}

export function applyDebuff(gs, debuff) {
  if (!gs) return;
  if (typeof gs.tryInterceptDebuff === "function")
    return gs.tryInterceptDebuff(debuff);
  gs.debuffs = gs.debuffs || [];
  gs.debuffs.push(debuff);
}

/* ==========================================================================
   SECTION 5: ABILITY REGISTRY & VALUES
   Imported and re-exported from dedicated ./abilities.js module.
   ========================================================================== */
import { ABILITIES, ABILITY_VALUES } from './abilities.js';
export { ABILITIES, ABILITY_VALUES };


/* ==========================================================================
   SECTION 6: UNIT & FACTION REGISTRY
   Base power values, ability assignments, and cost/value metrics.
   ========================================================================== */
export const PIECE_TYPES = {
  ashAshStrider: {
    name: "Ash Strider",
    power: 1,
    stats: { hp: 6, def: 1, strength: 2, range: 1, agility: 4, control: 0.1 },
    ability: { name: "Scorched Retreat", key: "ScorchedRetreat" },
    veteranAbility: {
      key: "TacticalSwapAsh",
      cooldown: ABILITY_VALUES.TacticalSwapAsh.cooldown
    }
  },
  ashAshTyrant: UNIT_REGISTRY.ashAshTyrant.stats,
  ashBlazeboundBeast: {
    name: "Blazebound Beast",
    power: 3,
    stats: { hp: 10, def: 3, strength: 3, range: 1, agility: 3, control: 0.1 },
    ability: { name: "Hunter's Rage", key: "HuntersRage" },
    veteranAbility: {
      key: "BlazeLunge",
      cooldown: ABILITY_VALUES.BlazeLunge.cooldown
    }
  },
  ashCinderScout: {
    name: "Cinder Scout",
    power: 2,
    stats: { hp: 6, def: 1, strength: 2, range: 1, agility: 4, control: 0.1 },
    ability: { name: "Kindle Armor", key: "KindleArmor" },
    veteranAbility: {
      key: "CinderSurge",
      cooldown: ABILITY_VALUES.CinderSurge.cooldown
    }
  },
  ashMagmaProwler: {
    name: "Magma Prowler",
    power: 3,
    stats: { hp: 8, def: 2, strength: 3, range: 1, agility: 3, control: 0.1 },
    ability: { name: "Frenzied Dash", key: "FrenziedDash" },
    veteranAbility: { key: "SiphonCharge", isPermanentUpgrade: true }
  },
  ashMagmaSpitter: {
    name: "Magma Spitter",
    power: 5,
    stats: { hp: 6, def: 0, strength: 5, range: 4, agility: 2, control: 0.1 },
    ability: { name: "Lava Glob", key: "LavaGlob" },
    veteranAbility: {
      key: "VolatileCinder",
      cooldown: ABILITY_VALUES.VolatileCinder.cooldown
    }
  },
  ashMagmaShaper: UNIT_REGISTRY.ashMagmaShaper.stats,
  ashRiftForger: {
    name: "Rift Forger",
    power: 2,
    stats: { hp: 7, def: 1, strength: 2, range: 2, agility: 2, control: 0.1 },
    ability: { name: "Unstable Ground", key: "UnstableGround" },
    veteranAbility: {
      key: "VolatileForge",
      isPermanentUpgrade: true,
      isPassive: true
    }
  },
  ashAshReaper: UNIT_REGISTRY.ashAshReaper.stats,
  ashScorchPriest: {
    name: "Scorch Priest",
    power: 2,
    stats: { hp: 7, def: 1, strength: 2, range: 2, agility: 2, control: 0.1 },
    ability: { name: "Mark of Cinder", key: "MarkOfCinder" },
    veteranAbility: {
      key: "SoulfireBurst",
      cooldown: ABILITY_VALUES.SoulfireBurst.cooldown
    }
  },
  snowArcticTrapper: {
    name: "Arctic Trapper",
    power: 2,
    stats: { hp: 6, def: 1, strength: 2, range: 1, agility: 4, control: 0.1 },
    ability: { name: "Set Snare", key: "SetSnare" },
    veteranAbility: {
      key: "DistractingRoar",
      cooldown: ABILITY_VALUES.DistractingRoar.cooldown
    }
  },
  snowGlacialMage: UNIT_REGISTRY.snowGlacialMage.stats,
  snowFrostbiteStalker: {
    name: "Frostbite Stalker",
    power: 2,
    stats: { hp: 6, def: 1, strength: 2, range: 1, agility: 4, control: 0.1 },
    ability: { name: "Hamstring", key: "Hamstring" },
    veteranAbility: {
      key: "IcyShift",
      cooldown: ABILITY_VALUES.IcyShift.cooldown
    }
  },
  snowFrostLord: UNIT_REGISTRY.snowFrostLord.stats,
  snowGlacialBrute: {
    name: "Glacial Brute",
    power: 3,
    stats: { hp: 10, def: 3, strength: 3, range: 1, agility: 3, control: 0.1 },
    ability: { name: "Frost Armor", key: "FrostArmor" },
    veteranAbility: {
      key: "FrostStomp",
      cooldown: ABILITY_VALUES.FrostStomp.cooldown
    }
  },
  snowHoarfrostMystic: {
    name: "Hoarfrost Mystic",
    power: 2,
    stats: { hp: 7, def: 1, strength: 2, range: 2, agility: 2, control: 0.1 },
    ability: { name: "Frigid Path", key: "FrigidPath" },
    veteranAbility: {
      key: "GlacialBeacon",
      cooldown: ABILITY_VALUES.GlacialBeacon.cooldown
    }
  },
  snowIceWeaver: {
    name: "Ice Weaver",
    power: 2,
    stats: { hp: 7, def: 1, strength: 2, range: 2, agility: 2, control: 0.1 },
    ability: { name: "Glacial Wall", key: "GlacialWall" },
    veteranAbility: {
      key: "GlacialFortress",
      isPermanentUpgrade: true,
      isPassive: true
    }
  },
  snowIceWisp: UNIT_REGISTRY.snowIceWisp.stats,
  snowRampagingYeti: {
    name: "Rampaging Yeti",
    power: 3,
    stats: { hp: 10, def: 3, strength: 3, range: 1, agility: 3, control: 0.1 },
    ability: { name: "Pummel", key: "Pummel" },
    veteranAbility: {
      key: "HardenedIce",
      cooldown: ABILITY_VALUES.HardenedIce.cooldown
    }
  },
  snowSoulFreeze: {
    name: "Soul Freeze",
    power: 2,
    stats: { hp: 8, def: 2, strength: 3, range: 3, agility: 2, control: 0.1 },
    ability: { name: "Chilling Aura", key: "ChillingAura" },
    veteranAbility: {
      key: "FrostbiteCurse",
      cooldown: ABILITY_VALUES.FrostbiteCurse.cooldown
    }
  },
  snowSoulLinker: UNIT_REGISTRY.snowSoulLinker.stats
};

export const PIECE_VALUES = {
  ashAshStrider: 150,
  ashAshTyrant: UNIT_REGISTRY.ashAshTyrant.value,
  ashBlazeboundBeast: 300,
  ashCinderScout: 150,
  ashMagmaProwler: 300,
  ashMagmaSpitter: 500,
  ashMagmaShaper: UNIT_REGISTRY.ashMagmaShaper.value,
  ashRiftForger: 250,
  ashAshReaper: UNIT_REGISTRY.ashAshReaper.value,
  ashScorchPriest: 450,
  snowArcticTrapper: 150,
  snowGlacialMage: UNIT_REGISTRY.snowGlacialMage.value,
  snowFrostbiteStalker: 150,
  snowFrostLord: UNIT_REGISTRY.snowFrostLord.value,
  snowGlacialBrute: 300,
  snowHoarfrostMystic: 250,
  snowIceWeaver: 250,
  snowIceWisp: UNIT_REGISTRY.snowIceWisp.value,
  snowRampagingYeti: 300,
  snowSoulFreeze: 450,
  snowSoulLinker: UNIT_REGISTRY.snowSoulLinker.value
};

export const TEAM_PIECES = {
  ash: {
    Brawler: "ashBlazeboundBeast",
    Mage: "ashMagmaSpitter",
    Mystic: UNIT_REGISTRY.ashMagmaShaper.key,
    Priest: "ashScorchPriest",
    Shaper: "ashRiftForger",
    Siphoner: UNIT_REGISTRY.ashAshReaper.key,
    Skirmisher: "ashAshStrider",
    Striker: "ashCinderScout",
    Tyrant: UNIT_REGISTRY.ashAshTyrant.key,
    Warrior: "ashMagmaProwler"
  },
  snow: {
    Brawler: "snowRampagingYeti",
    Mage: UNIT_REGISTRY.snowGlacialMage.key,
    Mystic: "snowHoarfrostMystic",
    Priest: "snowSoulFreeze",
    Shaper: "snowIceWeaver",
    Siphoner: UNIT_REGISTRY.snowSoulLinker.key,
    Skirmisher: "snowArcticTrapper",
    Striker: "snowFrostbiteStalker",
    Tyrant: UNIT_REGISTRY.snowFrostLord.key,
    Warrior: "snowGlacialBrute"
  }
};

/* ==========================================================================
   SECTION 7: MAP GENERATION & ASCENSION LOGIC
   Default starting layouts, territory parsing, and the dynamic buffs 
   granted by the Shrine Ascension system.
   ========================================================================== */
const generateRift = (startRow, startCol, size) => {
  const cells = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) cells.push([startRow + r, startCol + c]);
  return {
    id: startRow === 0 ? "topLeft" : "bottomRight",
    cells,
    name: "Power Rift",
    pulsePhase: 0,
    particles: []
  };
};

export const SHAPES = {
  bottomLayout: [
    [9, 0, "Tyrant"],
    [9, 1, "Siphoner"],
    [9, 2, "Brawler"],
    [9, 3, "Shaper"],
    [8, 0, "Mage"],
    [8, 1, "Priest"],
    [8, 2, "Skirmisher"],
    [7, 0, "Warrior"],
    [7, 1, "Striker"],
    [6, 0, "Mystic"]
  ],
  riftAreas: [generateRift(0, 0, 3), generateRift(ROWS - 3, COLS - 3, 3)],
  shrineArea: [
    [4, 4],
    [4, 5],
    [5, 4],
    [5, 5]
  ],
  topLayout: [
    [0, 9, "Tyrant"],
    [0, 8, "Siphoner"],
    [0, 7, "Brawler"],
    [0, 6, "Shaper"],
    [1, 9, "Mage"],
    [1, 8, "Priest"],
    [1, 7, "Skirmisher"],
    [2, 9, "Warrior"],
    [2, 8, "Striker"],
    [3, 9, "Mystic"]
  ]
};

export function getVoidScarCells(rift1, rift2) {
  const cells = new Set();
  [rift1, rift2].forEach((rift) => {
    rift.cells.forEach(([r, c]) => {
      cells.add(`${r},${c}`);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          cells.add(`${nr},${nc}`);
          if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
            if (inBounds(nr + dr, nc + dc)) cells.add(`${nr + dr},${nc + dc}`);
          }
        }
    });
  });
  return Array.from(cells).map((pos) => pos.split(",").map(Number));
}

export const ASCENSION_CHOICES = {
  Shaper: {
    A: {
      name: "Master of Creation",
      team: {
        snow: "Leader gains Mini-Glacial Wall.",
        ash: "Leader gains Mini-Unstable Ground."
      },
      key: "MasterOfCreation"
    },
    B: {
      name: "Territorial Claim",
      passive: "Faction Passive: Capture +2 adjacent squares on kill.",
      key: "TerritorialClaim"
    }
  },
  Brawler: {
    A: {
      name: "Rampage",
      team: {
        snow: "Glacial Brute: Frost Armor reflects 1 permanent damage.",
        ash: "Magma Prowler: Frenzied Dash jumps over allies."
      },
      key: "Rampage"
    },
    B: {
      name: "Vengeance",
      passive: "Faction Passive: Enemy is Marked for 2 turns on vanquish.",
      key: "Vengeance"
    }
  },
  Skirmisher: {
    A: {
      name: "Acrobatic Tactics",
      team: {
        snow: "Frostbite Stalker is Acrobat (jumps over ally).",
        ash: "Cinder Scout: Acrobat (jumps over ally)."
      },
      key: "AcrobaticTactics"
    },
    B: {
      name: "Hit and Run",
      passive:
        "Faction Passive: New capture grants Entrenched (wins combat tie).",
      key: "HitAndRun"
    }
  },
  Mystic: {
    A: {
      name: "Arcane Attunement",
      team: {
        snow: "Siphoners use Siphon on friendly territory.",
        ash: "Siphoners use Siphon on friendly territory."
      },
      key: "ArcaneAttunement"
    },
    B: {
      name: "Rift Reinforcement",
      passive:
        "Faction Passive: Conduit Contested state always gives full +2 Power.",
      key: "RiftReinforcement"
    }
  },
  Siphoner: {
    A: {
      name: "Primal Power",
      team: {
        snow: "Glacial Mage: Summoned Wisp is Power 1.",
        ash: "Magma Spitter: Lava Glob targets up to Power 3."
      },
      key: "PrimalPower"
    },
    B: {
      name: "Energy Siphon",
      passive:
        "Faction Passive: New capture adjacent to enemy Dazes enemy for 1 turn.",
      key: "EnergySiphon"
    }
  },
  Mage: {
    A: {
      name: "Elemental Harmony",
      team: {
        snow: "Soul Freeze: Chilling Aura also Hamstrings.",
        ash:
          "Scorch Priest: MarkOfCinder deals 1 permanent damage on application."
      },
      key: "ElementalHarmony"
    },
    B: {
      name: "Magical Supremacy",
      passive: "Faction Passive: Lose combat tie: Banished, -1 Power, Dazed.",
      key: "MagicalSupremacy"
    }
  },
  Striker: {
    A: {
      name: "Lethal Precision",
      team: {
        snow: "Arctic Trapper Base Power becomes 2.",
        ash: "Ash Strider Base Power becomes 2."
      },
      key: "LethalPrecision"
    },
    B: {
      name: "Targeted Weakness",
      passive:
        "Faction Passive: Attack debuffed enemy gains +1 Power (Attacking only).",
      key: "TargetedWeakness"
    }
  },
  Warrior: {
    A: {
      name: "Unstoppable Force",
      team: {
        snow:
          "Rampaging Yeti gains Steadfast (Immune to Daze, Stuck, Push/Pull).",
        ash:
          "Blazebound Beast gains Steadfast (Immune to Daze, Stuck, Push/Pull)."
      },
      key: "UnstoppableForce"
    },
    B: {
      name: "Home-Field Advantage",
      passive:
        "Faction Passive: Units defending on starting squares gain +1 Power.",
      key: "HomeFieldAdvantage"
    }
  },
  Priest: {
    A: {
      name: "Leader's Ward",
      team: {
        snow: "Frost Lord gains Priest's Ward (blocks first enemy ability).",
        ash: "Ash Tyrant gains Priest's Ward (blocks first enemy ability)."
      },
      key: "LeadersWard"
    },
    B: {
      name: "Martyrdom",
      passive:
        "Faction Passive: Vanquished unit Dazes the attacker for 2 turns.",
      key: "Martyrdom"
    }
  }
};

export const ABILITY_DESCRIPTIONS = {
  SetSnare: 'Create a trap on an adjacent empty square. The first enemy to enter is Stuck for 2 turns.',
  ScorchedRetreat: 'Move 1 square backward and create an Unstable Ground hazard on the square you left.',
  HuntersRage: 'Gain +1 Power (attacking only) for 2 rounds.',
  KindleArmor: 'Grants an adjacent ally +1 Power (defending only) for 2 rounds.',
  SummonIceWisp: 'Summons a Power 0 wisp to an empty square within 4 squares.',
  Hamstring: 'An adjacent enemy cannot move diagonally for 1 round.',
  FrostArmor: 'Gain +2 Power (defending only) for 2 rounds.',
  FrigidPath: 'Creates a 1x3 line of IcyGround. First enemy to enter is Dazed.',
  GlacialWall: 'Creates two impassable walls on adjacent empty squares. Lasts 3 turns.',
  FrenziedDash: 'Move 2 squares in a straight line to an empty square. Cannot capture.',
  LavaGlob: 'Deals 1 permanent damage to an enemy with base power 1 or 2, within 4 squares.',
  ObsidianPillar: 'Spawns an Obsidian Pillar: deals damage and pushback to enemies, works as cover, and forms an Obsidian Shield when targeting allies.',
  Pummel: 'Pushes an adjacent enemy back 1 square. Deals no damage.',
  UnstableGround: 'Make an empty square within 4 squares hazardous.',
  MarkOfCinder: 'Mark an enemy within 2 squares, reducing its power by 1. Lasts 3 turns.',
  ChillingAura: 'Activates an aura that reduces the power of adjacent enemies by 1. Lasts 3 turns.',
  DistractingRoar: 'Reduce effective power of an adjacent enemy by 1 for 1 round.',
  BlazeLunge: 'Move up to 2 squares in a straight line to an empty square adjacent to an enemy.',
  CinderSurge: 'Removes all debuffs from an adjacent friendly unit.',
  IcyShift: 'Swap positions with any unit within 2 squares; both are Dazed for 1 turn.',
  FrostStomp: 'Daze any adjacent enemy unit for 1 turn.',
  GlacialBeacon: 'Target empty square within 3; next enemy there is Dazed 1 turn.',
  VolatileCinder: 'Deals 1 permanent damage to an enemy within 3 squares Marked by Cinder.',
  HardenedIce: 'Grants an adjacent ally Steadfast for 2 full rounds.',
  SoulfireBurst: 'Detonates a nearby Unstable Ground, dealing 1 damage to adjacent units.',
  Siphon: 'Link units to transfer power or absorb debuffs.',
  FrostfallBlessing: 'AOE (Range 2.5, Rad 2) deals 2 damage to enemies and heals allies for 1 HP for 5 turns.',
  ReignOfFire: 'AOE (Range 2.5, Rad 2) deals 2 damage to enemies; deals 1 damage to allies but grants them +2 Strength for 3 turns.',
  FateLink: 'Binds an ally and enemy (Range 3) for 4 turns; any damage taken by the ally is mirrored exactly to the enemy.',
  TheReapersToll: 'Steals 1 Defence and 0.4 Agility from an enemy (Range 3) for 4 turns, transferring the stats to self.',
  GlacialFracture: 'AOE (Range 2.5, Rad 2) deals 2 damage, creates Frost territory, and summons 1 Ice Wisp furthest from caught enemies (Max 2).'
};

export const PASSIVE_DESCRIPTIONS = {
  snowFrostLord: UNIT_REGISTRY.snowFrostLord.passiveDescription,
  ashAshTyrant: UNIT_REGISTRY.ashAshTyrant.passiveDescription,
  snowSoulLinker: UNIT_REGISTRY.snowSoulLinker.passiveDescription,
  ashAshReaper: UNIT_REGISTRY.ashAshReaper.passiveDescription,
  snowGlacialMage: UNIT_REGISTRY.snowGlacialMage.passiveDescription,
  snowIceWisp: UNIT_REGISTRY.snowIceWisp.passiveDescription
};

export { UNIT_REGISTRY, getUnit } from './units/registry.js';

