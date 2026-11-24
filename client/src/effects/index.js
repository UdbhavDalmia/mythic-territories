import * as Core from './core.js';

// Re-export all core systems
export * from './core.js';

let unitEffectsModule = null;
let unitEffectsPromise = null;

export async function loadUnitEffects() {
  if (unitEffectsModule) return unitEffectsModule;
  if (!unitEffectsPromise) {
    unitEffectsPromise = import('./unitEffects.js').then(m => {
      unitEffectsModule = m;
      return m;
    });
  }
  return unitEffectsPromise;
}

// Preload unit effects if active units on board have custom abilities
export function checkAndPreloadUnitEffects(gs) {
  if (unitEffectsModule || !gs?.pieces) return;
  const hasAnimatedUnits = gs.pieces.some(p => {
    const k = p?.key || '';
    return k.includes('Lord') || k.includes('Tyrant') || k.includes('Glacial') ||
           k.includes('Prowler') || k.includes('Wisp') || k.includes('Trapper') ||
           k.includes('Spitter') || k.includes('Yeti') || k.includes('Mystic') ||
           k.includes('Strider') || k.includes('Weaver');
  });
  if (hasAnimatedUnits) {
    loadUnitEffects();
  }
}

// Intercept initParticles to trigger checkAndPreload
export const initParticles = gs => {
  Core.initParticles(gs);
  checkAndPreloadUnitEffects(gs);
};

// Generic proxy creators for transparent lazy invocation
const makeSpawnProxy = (fnName) => (...args) => {
  if (unitEffectsModule && unitEffectsModule[fnName]) {
    return unitEffectsModule[fnName](...args);
  }
  loadUnitEffects().then(m => {
    if (m[fnName]) m[fnName](...args);
  });
};

const makeDrawProxy = (fnName) => (first, second) => {
  let c, gs;
  if (second !== undefined) {
    c = first;
    gs = second;
  } else {
    c = Core.getCtx();
    gs = first;
  }
  if (unitEffectsModule && unitEffectsModule[fnName]) {
    return unitEffectsModule[fnName](c, gs);
  }
  loadUnitEffects();
};

export const spawnFrenziedDashEffect = makeSpawnProxy('spawnFrenziedDashEffect');
export const drawFrenziedDashAnimations = makeDrawProxy('drawFrenziedDashAnimations');
export const spawnSummonWispEffect = makeSpawnProxy('spawnSummonWispEffect');
export const drawSummonWispAnimations = makeDrawProxy('drawSummonWispAnimations');
export const spawnGlacialWallEffect = makeSpawnProxy('spawnGlacialWallEffect');
export const drawGlacialWallAnimations = makeDrawProxy('drawGlacialWallAnimations');
export const spawnWallShatterEffect = makeSpawnProxy('spawnWallShatterEffect');
export const spawnLavaGlobEffect = makeSpawnProxy('spawnLavaGlobEffect');
export const drawLavaGlobAnimations = makeDrawProxy('drawLavaGlobAnimations');
export const spawnScorchedRetreatEffect = makeSpawnProxy('spawnScorchedRetreatEffect');
export const drawScorchedRetreatAnimations = makeDrawProxy('drawScorchedRetreatAnimations');

export const spawnTrapDeploymentEffect = makeSpawnProxy('spawnTrapDeploymentEffect');
export const drawTrapDeployments = makeDrawProxy('drawTrapDeployments');
export const spawnTrapTriggerEffect = makeSpawnProxy('spawnTrapTriggerEffect');
export const drawTrapTriggerAnimations = makeDrawProxy('drawTrapTriggerAnimations');

export const spawnFrigidPathEffect = makeSpawnProxy('spawnFrigidPathEffect');
export const drawFrigidPathAnimations = makeDrawProxy('drawFrigidPathAnimations');
export const spawnFrostfallBlessingEffect = makeSpawnProxy('spawnFrostfallBlessingEffect');
export const drawFrostfallBlessingAnimations = makeDrawProxy('drawFrostfallBlessingAnimations');

export const spawnPummelKnockbackEffect = makeSpawnProxy('spawnPummelKnockbackEffect');
export const drawPummelKnockbackAnimations = makeDrawProxy('drawPummelKnockbackAnimations');
export const spawnVentEffect = makeSpawnProxy('spawnVentEffect');
export const drawVentAnimations = makeDrawProxy('drawVentAnimations');

export const spawnGlacialFractureEffect = makeSpawnProxy('spawnGlacialFractureEffect');
export const drawGlacialFractureAnimations = makeDrawProxy('drawGlacialFractureAnimations');
export const spawnAColdFarewellEffect = makeSpawnProxy('spawnAColdFarewellEffect');
export const drawAColdFarewellAnimations = makeDrawProxy('drawAColdFarewellAnimations');

export const spawnGuardianSaveEffect = makeSpawnProxy('spawnGuardianSaveEffect');
export const drawGuardianSaveAnimations = makeDrawProxy('drawGuardianSaveAnimations');
export const drawHelpFromAboveFog = makeDrawProxy('drawHelpFromAboveFog');

export const spawnObsidianPillarCastEffect = makeSpawnProxy('spawnObsidianPillarCastEffect');
export const drawObsidianPillarAnimations = makeDrawProxy('drawObsidianPillarAnimations');
export const drawHelpFromAboveVapors = makeDrawProxy('drawHelpFromAboveVapors');
export const spawnReignOfFireEffect = makeSpawnProxy('spawnReignOfFireEffect');
export const drawReignOfFireAnimations = makeDrawProxy('drawReignOfFireAnimations');
export const spawnDeathMeteorEffect = makeSpawnProxy('spawnDeathMeteorEffect');
export const drawDeathMeteorAnimations = makeDrawProxy('drawDeathMeteorAnimations');
export const drawDeathMeteorShield = (ctxParam, piece, gs) => {
  if (unitEffectsModule?.drawDeathMeteorShield) return unitEffectsModule.drawDeathMeteorShield(ctxParam, piece, gs);
  loadUnitEffects();
};
export const drawFrostLordShield = (ctxParam, piece, gs) => {
  if (unitEffectsModule?.drawFrostLordShield) return unitEffectsModule.drawFrostLordShield(ctxParam, piece, gs);
  loadUnitEffects();
};
export const spawnShieldBreakEffect = makeSpawnProxy('spawnShieldBreakEffect');
export const drawShieldBreakAnimations = makeDrawProxy('drawShieldBreakAnimations');
export const spawnFateLinkCast = makeSpawnProxy('spawnFateLinkCast');
export const drawFateLinkAnimations = makeDrawProxy('drawFateLinkAnimations');
