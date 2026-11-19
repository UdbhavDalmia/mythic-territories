import * as C from '@shared/constants.js';

export function createBaseGameState() {
  const pieces = [
    // Snow Team (Rows 0-1)
    {
      id: 1,
      key: 'snowFrostLord',
      name: 'Frost Lord',
      team: 'snow',
      row: 0,
      col: 4,
      maxHp: 100,
      currentHp: 100,
      power: 24,
      control: 18,
      defense: 12,
      isLeader: true,
      isVeteran: false,
      ability: { name: 'Frostfall Blessing', key: 'FrostfallBlessing', cooldown: 0 }
    },
    {
      id: 2,
      key: 'snowIceWeaver',
      name: 'Ice Weaver',
      team: 'snow',
      row: 1,
      col: 2,
      maxHp: 60,
      currentHp: 60,
      power: 14,
      control: 15,
      defense: 8,
      isLeader: false,
      isVeteran: false,
      ability: { name: 'Frigid Path', key: 'FrigidPath', cooldown: 0 }
    },
    {
      id: 3,
      key: 'snowArcticTrapper',
      name: 'Arctic Trapper',
      team: 'snow',
      row: 1,
      col: 6,
      maxHp: 70,
      currentHp: 70,
      power: 16,
      control: 12,
      defense: 10,
      isLeader: false,
      isVeteran: false,
      ability: { name: 'Set Snare', key: 'SetSnare', cooldown: 0 }
    },
    {
      id: 4,
      key: 'snowGlacialBrute',
      name: 'Glacial Brute',
      team: 'snow',
      row: 1,
      col: 4,
      maxHp: 90,
      currentHp: 90,
      power: 18,
      control: 10,
      defense: 14,
      isLeader: false,
      isVeteran: false,
      ability: { name: 'Glacial Fracture', key: 'GlacialFracture', cooldown: 0 }
    },

    // Ash Team (Rows 8-9)
    {
      id: 11,
      key: 'ashAshTyrant',
      name: 'Ash Tyrant',
      team: 'ash',
      row: 9,
      col: 4,
      maxHp: 100,
      currentHp: 100,
      power: 24,
      control: 18,
      defense: 12,
      isLeader: true,
      isVeteran: false,
      ability: { name: 'Reign of Fire', key: 'ReignOfFire', cooldown: 0 }
    },
    {
      id: 12,
      key: 'ashRiftForger',
      name: 'Rift Forger',
      team: 'ash',
      row: 8,
      col: 2,
      maxHp: 65,
      currentHp: 65,
      power: 15,
      control: 14,
      defense: 9,
      isLeader: false,
      isVeteran: false,
      ability: { name: 'Volatile Forge', key: 'VolatileForge', cooldown: 0 }
    },
    {
      id: 13,
      key: 'ashAshReaper',
      name: 'Ash Reaper',
      team: 'ash',
      row: 8,
      col: 6,
      maxHp: 75,
      currentHp: 75,
      power: 20,
      control: 10,
      defense: 8,
      isLeader: false,
      isVeteran: false,
      ability: { name: "The Reaper's Toll", key: 'TheReapersToll', cooldown: 0 }
    },
    {
      id: 14,
      key: 'ashBlazeboundBeast',
      name: 'Blazebound Beast',
      team: 'ash',
      row: 8,
      col: 4,
      maxHp: 85,
      currentHp: 85,
      power: 17,
      control: 11,
      defense: 11,
      isLeader: false,
      isVeteran: false,
      ability: { name: 'Frenzied Dash', key: 'FrenziedDash', cooldown: 0 }
    }
  ];

  return {
    pieces,
    turnCount: 1,
    currentTurn: 'snow',
    currentState: 'AWAITING_PIECE_SELECTION',
    selectedPiece: null,
    events: [],
    snowTerritory: new Set(['0,4', '1,2', '1,6', '1,4']),
    ashTerritory: new Set(['9,4', '8,2', '8,6', '8,4']),
    territoryTrails: [],
    timers: { snow: 600, ash: 600 },
    gameOver: false,
    winner: null,
    shrineChargeLevel: 0,
    shrineIsOverloaded: false,
    glacialWalls: [],
    markedPieces: [],
    unstableGrounds: [],
    specialTerrains: [],
    shields: [],
    temporaryBoosts: [],
    debuffs: [],
    abilityContext: null,
    conduit: null,
    conduitLinkActive: false,
    conduitIsContested: false,
    conduitTeam: null,
    conduitOverchargeProgress: null,
    factionPassives: null,
    pendingAscension: null,
    voidScarSquares: [],
    deathMeteors: [],
    groundEffectParticles: [],
    siphonParticles: [],
    conduitParticles: [],
    shrineParticles: [],
    battleParticles: [],
    projectiles: [],
    shockwaves: [],
    attackTexts: [],
    cinderSparks: [],
    trappedPiece: null,
    gameStarted: true,
    battleStartTime: Date.now()
  };
}

export function createActiveCombatGameState() {
  const gs = createBaseGameState();
  const targetSnowPiece = gs.pieces[1];
  const targetAshPiece = gs.pieces[5];

  gs.turnCount = 7;
  gs.currentTurn = 'ash';
  gs.shrineChargeLevel = 3;

  // Active temporary boosts with circular piece link
  gs.temporaryBoosts = [
    {
      id: 'boost-1',
      piece: gs.pieces[0],
      stat: 'power',
      amount: 4,
      duration: 2
    }
  ];

  // Active debuffs
  gs.debuffs = [
    {
      id: 'debuff-1',
      piece: targetSnowPiece,
      stat: 'control',
      amount: -3,
      duration: 1
    }
  ];

  // Marked pieces
  gs.markedPieces = [
    {
      id: 'mark-1',
      target: targetAshPiece,
      sourceTeam: 'snow',
      multiplier: 1.5
    }
  ];

  // Active shields
  gs.shields = [
    {
      id: 'shield-1',
      piece: gs.pieces[0],
      amount: 25,
      type: 'ice'
    }
  ];

  // Unstable grounds with piece object reference
  gs.unstableGrounds = [
    {
      row: 4,
      col: 5,
      creator: gs.pieces[2],
      damage: 15,
      duration: 2
    }
  ];

  // Special terrains including craters
  gs.specialTerrains = [
    {
      row: 5,
      col: 5,
      type: 'crater',
      duration: 5,
      magmaPulse: 0.8
    },
    {
      row: 3,
      col: 3,
      type: 'crater',
      duration: 4,
      magmaPulse: 0.4
    }
  ];

  // Death meteors
  gs.deathMeteors = [
    {
      targetRow: 5,
      targetCol: 5,
      delayTurns: 1,
      sourceId: 13
    }
  ];

  return gs;
}

export function createEndgameGameState() {
  const gs = createBaseGameState();
  // Filter down to only 1 leader piece per team
  gs.pieces = [
    { ...gs.pieces[0], currentHp: 40, isVeteran: true },
    { ...gs.pieces[4], currentHp: 35, isVeteran: true }
  ];
  gs.turnCount = 28;
  gs.currentTurn = 'snow';
  gs.shrineChargeLevel = 5;
  gs.shrineIsOverloaded = true;
  return gs;
}

export function createStressGameState(pieceCount = 50) {
  const gs = createBaseGameState();
  const pieces = [];
  const snowKeys = ['snowFrostLord', 'snowIceWeaver', 'snowArcticTrapper', 'snowGlacialBrute'];
  const ashKeys = ['ashAshTyrant', 'ashRiftForger', 'ashAshReaper', 'ashBlazeboundBeast'];

  for (let i = 0; i < pieceCount; i++) {
    const isSnow = i % 2 === 0;
    const team = isSnow ? 'snow' : 'ash';
    const keys = isSnow ? snowKeys : ashKeys;
    const key = keys[i % keys.length];
    const isLeader = key.includes('Lord') || key.includes('Tyrant');

    pieces.push({
      id: i + 1,
      key,
      name: key,
      team,
      row: (i * 2) % 10,
      col: (i * 3) % 10,
      maxHp: 80,
      currentHp: 80,
      power: isLeader ? 24 : 14,
      control: isLeader ? 18 : 12,
      defense: 10,
      isLeader,
      isVeteran: false,
      ability: { key: 'SampleAbility', cooldown: 0 }
    });
  }

  gs.pieces = pieces;
  return gs;
}
