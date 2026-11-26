import { computePowerDiagram } from '@shared/voronoi.js';
import { TEAM_PIECES } from '@shared/constants.js';

export const INITIAL_SNOW_KEYS = TEAM_PIECES?.snow ? Object.values(TEAM_PIECES.snow) : [
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

export const INITIAL_ASH_KEYS = TEAM_PIECES?.ash ? Object.values(TEAM_PIECES.ash) : [
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
  voronoiData: null,
  scores: { snow: 50.0, ash: 50.0 }
};

export function calculateDynamicTerritoryAreas(gs) {
  if (!gs || !gs.pieces || gs.pieces.length === 0) return { snow: 50.0, ash: 50.0, neutral: 0.0 };
  
  // Fast cache check: piece id, coordinates, hp, power
  const piecesKey = gs._piecesKey || gs.pieces
    .map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`)
    .join('|');
  gs._piecesKey = piecesKey;

  // Ensure gs.voronoiData is populated
  if (!gs.voronoiData) {
    gs.voronoiData = computePowerDiagram(gs.pieces);
  }

  // Fast return if cached pieces and cached voronoiData match
  if (lastTerritoryCache.piecesKey === piecesKey && lastTerritoryCache.scores && lastTerritoryCache.voronoiData === gs.voronoiData) {
    return lastTerritoryCache.scores;
  }

  const voronoi = gs.voronoiData;
  const rawFrost = Number(voronoi?.frostShare);
  const rawAsh = Number(voronoi?.ashShare);
  const frostVal = Number.isFinite(rawFrost) ? rawFrost : 0;
  const ashVal = Number.isFinite(rawAsh) ? rawAsh : 0;
  const frost = parseFloat(frostVal.toFixed(1));
  const ash = parseFloat(ashVal.toFixed(1));
  const neutral = parseFloat(Math.max(0, 100 - (frost + ash)).toFixed(1));

  const result = {
    snow: frost,
    ash: ash,
    neutral: neutral
  };

  lastTerritoryCache = {
    piecesKey,
    voronoiData: voronoi,
    scores: result
  };

  return result;
}

let lastPiecesRef = null;
let lastPiecesCount = -1;
let lastFallenCache = {
  fallenSnow: [],
  fallenAsh: []
};

export function getFallenUnits(pieces) {
  const count = pieces ? pieces.length : 0;
  if (pieces === lastPiecesRef && lastPiecesRef !== null && count === lastPiecesCount) {
    return lastFallenCache;
  }
  const aliveSnowKeys = new Set(pieces ? pieces.filter(p => p.team === 'snow').map(p => p.key) : []);
  const aliveAshKeys = new Set(pieces ? pieces.filter(p => p.team === 'ash').map(p => p.key) : []);
  const fallenSnow = INITIAL_SNOW_KEYS.filter(k => !aliveSnowKeys.has(k));
  const fallenAsh = INITIAL_ASH_KEYS.filter(k => !aliveAshKeys.has(k));
  lastPiecesRef = pieces;
  lastPiecesCount = count;
  lastFallenCache = { fallenSnow, fallenAsh };
  return lastFallenCache;
}

export function resetTerritoryCache() {
  lastTerritoryCache = {
    piecesKey: '',
    voronoiData: null,
    scores: { snow: 50.0, ash: 50.0, neutral: 0.0 }
  };
  lastPiecesRef = null;
  lastPiecesCount = -1;
  lastFallenCache = {
    fallenSnow: [],
    fallenAsh: []
  };
}
