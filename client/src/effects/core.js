import * as C from '@shared/constants.js';
import * as Particles from './particles.js';
import * as Shrine from './shrine.js';
import * as Conduit from './conduit.js';
import * as Terrain from './terrain.js';
import { spawnCastAnimation } from '../services/spriteAnimator.js';

let ctx, effectsCtx;
const legacyParticles = [];

export function initEffects(mCtx, eCtx) {
  ctx = mCtx;
  effectsCtx = eCtx;
}

export function getCtx() {
  return ctx;
}

export function getEffectsCtx() {
  return effectsCtx;
}

export const drawAttackTexts = gs => Particles.drawAttackTexts(ctx, gs);
export const drawConduitParticles = gs => Conduit.drawConduitParticles(ctx, gs);
export const drawGroundEffectParticles = gs => Terrain.drawGroundEffectParticles(ctx, gs);
export const drawMarkOfCinderSparks = gs => Particles.drawMarkOfCinderSparks(ctx, gs);
export const drawParticles = gs => Particles.drawParticles(ctx, gs);
export const drawProjectiles = gs => Particles.drawProjectiles(ctx, gs);

export function drawRifts(gs) {
  const targetCtx = ctx || effectsCtx;
  if (!targetCtx) return;
  
  C.SHAPES.riftAreas.forEach(r => {
    r.pulsePhase += 0.06;
    const p = 0.25 + 0.08 * Math.sin(r.pulsePhase);
    targetCtx.fillStyle = `rgba(190,120,255,${p * 0.5})`;
    r.cells.forEach(([rr, cc]) => {
      targetCtx.fillRect(cc * C.CELL_SIZE, rr * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  });
}

export const drawShockwaves = gs => Particles.drawShockwaves(ctx, gs);
export const drawShrineEffects = gs => Shrine.drawShrineEffects(ctx, gs);
export const drawShrineOverloadEffects = gs => Shrine.drawShrineOverloadEffects(ctx, gs);
export const drawSiphonParticles = gs => Conduit.drawSiphonParticles(ctx, gs);
export const drawSiphonRunes = (piece, gs) => Conduit.drawSiphonRunes(ctx, piece, gs);

export const initParticles = gs => Particles.initParticles(gs);
export const spawnBattleParticles = (a, d, gs) => Particles.spawnBattleParticles(a, d, gs);
export const spawnBurningGroundParticle = (r, c, gs) => Terrain.spawnBurningGroundParticle(r, c, gs);
export const spawnMarkHitParticles = (t, gs) => Particles.spawnMarkHitParticles(t, gs);
export const spawnSiphonParticles = (p, src, gs) => Conduit.spawnSiphonParticles(p, src, gs);
export const triggerShrineOverloadEffects = (gs, isNova = false) => Shrine.triggerShrineOverloadEffects(gs, isNova);
export const updateConduitParticles = (gs, sx, sy, ex, ey) => Conduit.updateConduitParticles(gs, sx, sy, ex, ey);
export const updateShrineParticles = (charge, gs) => Shrine.updateShrineParticles(charge, gs);

export function triggerShatterCapture(x, y, color) {
  for (let i = 0; i < 20; i++) {
    legacyParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      life: 1,
      color,
      size: Math.random() * 6 + 2,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2
    });
  }
}

export function drawStatusIcons(ctxParam, piece, x, y) {
  const s = C.CELL_SIZE * 0.15;
  const cctx = ctxParam || ctx;
  if (!cctx) return;
  if (piece.isChilled || piece.frozen) {
    cctx.strokeStyle = '#00f2ff';
    cctx.lineWidth = 2;
    const cx = x - C.CELL_SIZE * 0.3, cy = y - C.CELL_SIZE * 0.2;
    for (let i = 0; i < 6; i++) {
      cctx.beginPath();
      cctx.moveTo(cx, cy);
      cctx.lineTo(cx + Math.cos(i * Math.PI / 3) * s, cy + Math.sin(i * Math.PI / 3) * s);
      cctx.stroke();
    }
  }
}

export function updateEffects() {
  for (let i = legacyParticles.length - 1; i >= 0; i--) {
    const p = legacyParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
    p.rotation += p.vr;
    if (p.life <= 0) legacyParticles.splice(i, 1);
  }
}

export function renderEffects(ctxParam) {
  const c = ctxParam || ctx;
  if (!c || legacyParticles.length === 0) return;
  c.save();
  for (let i = 0; i < legacyParticles.length; i++) {
    const p = legacyParticles[i];
    c.globalAlpha = p.life;
    const cos = Math.cos(p.rotation);
    const sin = Math.sin(p.rotation);
    c.setTransform(cos, sin, -sin, cos, p.x, p.y);
    c.fillStyle = p.color;
    const half = p.size * 0.5;
    c.fillRect(-half, -half, p.size, p.size);
  }
  c.restore();
}

export const drawGlacialWallBlock = (...a) => Terrain.drawGlacialWallBlock(...a);
export const drawBurningGroundBlock = (...a) => Terrain.drawBurningGroundBlock(...a);
export const drawSnareTrapBlock = (...a) => Terrain.drawSnareTrapBlock(...a);
export const drawIcyGroundBlock = (...a) => Terrain.drawIcyGroundBlock(...a);
export const drawMagmaShardsBlock = (...a) => Terrain.drawMagmaShardsBlock(...a);

// ── Ability cast-frame animations ──
export { spawnCastAnimation };
