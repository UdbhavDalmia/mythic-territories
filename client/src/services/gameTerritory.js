import { computePowerDiagram } from '@shared/voronoi.js';

export const INITIAL_SNOW_KEYS = [
  'snowFrostLord',
  'snowSoulLinker',
  'snowRampagingYeti',
  'snowIceWeaver',
  'snowGlacialMage',
  'snowSoulFreeze',
  'snowArcticTrapper',
  'snowGlacialBrute',
  'snowFrostbiteStalker',
  'snowHoarfrostMystic'
];

export const INITIAL_ASH_KEYS = [
  'ashAshTyrant',
  'ashAshReaper',
  'ashBlazeboundBeast',
  'ashRiftForger',
  'ashMagmaSpitter',
  'ashScorchPriest',
  'ashAshStrider',
  'ashMagmaProwler',
  'ashCinderScout',
  'ashMagmaShaper'
];

let lastTerritoryCache = {
  piecesKey: '',
  scores: { snow: 50.0, ash: 50.0 }
};

export function calculateDynamicTerritoryAreas(gs) {
  if (!gs || !gs.pieces || gs.pieces.length === 0) return { snow: 50.0, ash: 50.0, neutral: 0.0 };
  
  // Fast cache check: piece id, coordinates, hp, power
  const piecesKey = gs.pieces
    .map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`)
    .join('|');

  if (lastTerritoryCache.piecesKey === piecesKey && lastTerritoryCache.scores) {
    return lastTerritoryCache.scores;
  }

  const voronoi = computePowerDiagram(gs.pieces);
  gs.voronoiData = voronoi;

  const frost = parseFloat((voronoi.frostShare ?? 0).toFixed(1));
  const ash = parseFloat((voronoi.ashShare ?? 0).toFixed(1));
  const neutral = parseFloat(Math.max(0, 100 - (frost + ash)).toFixed(1));

  const result = {
    snow: frost,
    ash: ash,
    neutral: neutral
  };

  lastTerritoryCache = {
    piecesKey,
    scores: result
  };

  return result;
}

let lastPiecesRef = null;
let lastFallenCache = {
  fallenSnow: [],
  fallenAsh: []
};

export function getFallenUnits(pieces) {
  if (pieces === lastPiecesRef && lastPiecesRef !== null) {
    return lastFallenCache;
  }
  const aliveSnowKeys = new Set(pieces ? pieces.filter(p => p.team === 'snow').map(p => p.key) : []);
  const aliveAshKeys = new Set(pieces ? pieces.filter(p => p.team === 'ash').map(p => p.key) : []);
  const fallenSnow = INITIAL_SNOW_KEYS.filter(k => !aliveSnowKeys.has(k));
  const fallenAsh = INITIAL_ASH_KEYS.filter(k => !aliveAshKeys.has(k));
  lastPiecesRef = pieces;
  lastFallenCache = { fallenSnow, fallenAsh };
  return lastFallenCache;
}

export function resetTerritoryCache() {
  lastTerritoryCache = {
    piecesKey: '',
    scores: { snow: 13.3, ash: 13.3 }
  };
  lastPiecesRef = null;
  lastFallenCache = {
    fallenSnow: [],
    fallenAsh: []
  };
}
