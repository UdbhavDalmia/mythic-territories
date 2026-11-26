/**
 * spriteAnimator.js
 * Procedural frame-based animation system for unit movement and ability casts.
 *
 * Since units are single static .webp images (no sprite sheets), we synthesise
 * animation "frames" by driving CSS/GSAP transforms on the existing DOM elements
 * and canvas overlays that the board renderer already owns.
 *
 * Movement  – 5 frames:  anticipation → lean-out → glide peak → land squash → settle
 * Ability   – 7-8 frames per ability type (see ABILITY_FRAME_SEQUENCES below)
 *
 * The canvas-layer ability animations are tick-driven objects pushed into
 * gameState.castAnimations[], which boardRenderer picks up each frame.
 */

import { loadGsap } from './gsap.js';

// ─── FRAME SEQUENCES ─────────────────────────────────────────────────────────
// Each frame: { scaleX, scaleY, translateY, opacity, blurPx, rotateDeg, duration }
// duration in seconds (for GSAP); for canvas ticks, 1 tick ≈ 16 ms at 60 fps.

const MOVE_FRAMES = [
  // F0 – anticipation: very slight squat + backward lean
  { scaleX: 1.08, scaleY: 0.92, translateY: 3,  opacity: 1,    duration: 0.06 },
  // F1 – liftoff lean: stretch tall, slight forward tilt
  { scaleX: 0.88, scaleY: 1.14, translateY: -6, opacity: 1,    duration: 0.08 },
  // F2 – glide peak: compressed wide mid-air
  { scaleX: 1.05, scaleY: 0.95, translateY: -3, opacity: 0.90, duration: 0.10 },
  // F3 – land squash: wide flat impact
  { scaleX: 1.12, scaleY: 0.85, translateY: 5,  opacity: 1,    duration: 0.07 },
  // F4 – settle: back to neutral
  { scaleX: 1.0,  scaleY: 1.0,  translateY: 0,  opacity: 1,    duration: 0.09 },
];

// Canvas-layer ability cast frame sequence descriptors.
// Each entry defines how to draw a "charge flash" on the canvas at the caster's position.
// The board's renderEnvironmentalEffects loop draws castAnimations[] each tick.
const ABILITY_FRAME_SEQUENCES = {
  // ── SNOW ──
  default_snow: [
    { phase: 'charge',  ticks: 4, ring: { color: '56,189,248', r: 0.30, alpha: 0.4 } },
    { phase: 'charge',  ticks: 4, ring: { color: '56,189,248', r: 0.40, alpha: 0.6 } },
    { phase: 'burst',   ticks: 3, ring: { color: '224,242,254', r: 0.55, alpha: 0.9 } },
    { phase: 'burst',   ticks: 3, ring: { color: '56,189,248', r: 0.70, alpha: 0.75 }, spike: 6 },
    { phase: 'release', ticks: 3, ring: { color: '56,189,248', r: 0.90, alpha: 0.55 }, spike: 8 },
    { phase: 'release', ticks: 3, ring: { color: '56,189,248', r: 1.10, alpha: 0.35 } },
    { phase: 'fade',    ticks: 5, ring: { color: '56,189,248', r: 1.30, alpha: 0.15 } },
  ],

  // ── ASH ──
  default_ash: [
    { phase: 'charge',  ticks: 4, ring: { color: '239,68,68',  r: 0.30, alpha: 0.4 } },
    { phase: 'charge',  ticks: 4, ring: { color: '245,158,11', r: 0.42, alpha: 0.65 } },
    { phase: 'burst',   ticks: 3, ring: { color: '254,240,138',r: 0.58, alpha: 0.9 } },
    { phase: 'burst',   ticks: 3, ring: { color: '239,68,68',  r: 0.72, alpha: 0.75 }, spike: 4 },
    { phase: 'release', ticks: 3, ring: { color: '239,68,68',  r: 0.92, alpha: 0.55 }, spike: 6 },
    { phase: 'release', ticks: 3, ring: { color: '245,158,11', r: 1.12, alpha: 0.35 } },
    { phase: 'fade',    ticks: 5, ring: { color: '239,68,68',  r: 1.35, alpha: 0.15 } },
    { phase: 'fade',    ticks: 4, ring: { color: '239,68,68',  r: 1.55, alpha: 0.05 } },
  ],

  // Heavy: Death Meteor / Reign of Fire / Glacial Fracture → more frames, larger bursts
  heavy_ash: [
    { phase: 'windup',  ticks: 5, ring: { color: '239,68,68',  r: 0.20, alpha: 0.3 } },
    { phase: 'windup',  ticks: 5, ring: { color: '245,158,11', r: 0.35, alpha: 0.5 } },
    { phase: 'charge',  ticks: 4, ring: { color: '239,68,68',  r: 0.50, alpha: 0.7 }, spike: 4 },
    { phase: 'charge',  ticks: 4, ring: { color: '254,240,138',r: 0.65, alpha: 0.9 }, spike: 6 },
    { phase: 'burst',   ticks: 3, ring: { color: '255,255,255',r: 0.82, alpha: 1.0 }, spike: 8 },
    { phase: 'release', ticks: 3, ring: { color: '239,68,68',  r: 1.05, alpha: 0.75 }, spike: 6 },
    { phase: 'release', ticks: 3, ring: { color: '245,158,11', r: 1.30, alpha: 0.50 } },
    { phase: 'fade',    ticks: 5, ring: { color: '239,68,68',  r: 1.60, alpha: 0.20 } },
  ],

  heavy_snow: [
    { phase: 'windup',  ticks: 5, ring: { color: '56,189,248', r: 0.20, alpha: 0.3 } },
    { phase: 'windup',  ticks: 5, ring: { color: '186,230,253',r: 0.35, alpha: 0.5 } },
    { phase: 'charge',  ticks: 4, ring: { color: '56,189,248', r: 0.50, alpha: 0.7 }, spike: 4 },
    { phase: 'charge',  ticks: 4, ring: { color: '224,242,254',r: 0.65, alpha: 0.9 }, spike: 6 },
    { phase: 'burst',   ticks: 3, ring: { color: '255,255,255',r: 0.82, alpha: 1.0 }, spike: 8 },
    { phase: 'release', ticks: 3, ring: { color: '56,189,248', r: 1.05, alpha: 0.75 }, spike: 6 },
    { phase: 'release', ticks: 3, ring: { color: '56,189,248', r: 1.30, alpha: 0.50 } },
    { phase: 'fade',    ticks: 5, ring: { color: '56,189,248', r: 1.60, alpha: 0.20 } },
  ],
};

// Map ability keys → sequence type
const ABILITY_SEQUENCE_MAP = {
  // Heavy ash
  ReignOfFire:        'heavy_ash',
  DeathMeteor:        'heavy_ash',
  ObsidianPillar:     'heavy_ash',
  LavaGlob:           'heavy_ash',
  // Heavy snow
  GlacialFracture:    'heavy_snow',
  FrostfallBlessing:  'heavy_snow',
  AColdFarewell:      'heavy_snow',
  HelpFromAbove:      'heavy_snow',
  // Defaults picked by team
};

// ─── MOVEMENT ANIMATION (GSAP – applied to the innerRef DOM element) ──────────

/**
 * Play the 5-frame movement animation on a piece's inner element.
 * Called from Piece.jsx instead of the plain gsap.to(...) on movement.
 *
 * @param {HTMLElement} innerEl  – the piece's inner div (innerRef.current)
 * @param {function} gsap        – the loaded GSAP instance
 */
export function playMoveFrames(innerEl, gsap) {
  if (!innerEl || !gsap) return;

  const tl = gsap.timeline();
  for (const frame of MOVE_FRAMES) {
    tl.to(innerEl, {
      scaleX:    frame.scaleX,
      scaleY:    frame.scaleY,
      y:         frame.translateY,
      opacity:   frame.opacity,
      duration:  frame.duration,
      ease:      'power1.inOut',
      overwrite: 'auto',
    });
  }
  return tl;
}

// ─── ABILITY CAST ANIMATION (canvas-layer, tick-based) ───────────────────────

let _castAnimations = null; // shared ref to gameState.castAnimations

/**
 * Initialise the castAnimations array on gameState (called from initParticles).
 */
export function initCastAnimations(gameState) {
  if (!gameState) return;
  gameState.castAnimations = gameState.castAnimations || [];
  _castAnimations = gameState.castAnimations;
}

/**
 * Spawn a cast animation for a given ability use.
 * Push an entry into gameState.castAnimations[]; the renderer draws it.
 *
 * @param {object} caster     – piece object
 * @param {string} abilityKey – e.g. 'ReignOfFire'
 * @param {object} gameState
 */
export function spawnCastAnimation(caster, abilityKey, gameState) {
  if (!gameState || !caster) return;
  if (!gameState.castAnimations) gameState.castAnimations = [];

  const sequenceKey =
    ABILITY_SEQUENCE_MAP[abilityKey] ||
    (caster.team === 'snow' ? 'default_snow' : 'default_ash');

  const sequence = ABILITY_FRAME_SEQUENCES[sequenceKey];
  if (!sequence) return;

  gameState.castAnimations.push({
    casterCol: caster.col,
    casterRow: caster.row,
    sequence,
    frameIndex: 0,
    frameTick:  0,
    done: false,
    team: caster.team,
    abilityKey,
    id: `cast_${caster.id}_${Date.now()}`,
  });
}

/**
 * Draw all active cast animations. Called once per frame from renderEnvironmentalEffects.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} gameState
 * @param {number} CS – cell size in pixels
 */
export function drawCastAnimations(ctx, gameState, CS) {
  if (!ctx || !gameState || !gameState.castAnimations) return;

  const now = performance.now();

  for (let i = gameState.castAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.castAnimations[i];
    if (anim.done) {
      gameState.castAnimations.splice(i, 1);
      continue;
    }

    const frame = anim.sequence[anim.frameIndex];
    if (!frame) {
      anim.done = true;
      continue;
    }

    // Advance tick
    anim.frameTick++;
    if (anim.frameTick >= frame.ticks) {
      anim.frameTick = 0;
      anim.frameIndex++;
      if (anim.frameIndex >= anim.sequence.length) {
        anim.done = true;
        continue;
      }
    }

    // Interpolation within frame: 0..1
    const t = frame.ticks > 1 ? anim.frameTick / (frame.ticks - 1) : 1;

    const cx = (anim.casterCol + 0.5) * CS;
    const cy = (anim.casterRow + 0.5) * CS;
    const { ring, spike } = frame;

    if (!ring) continue;

    const radiusPx = ring.r * CS;
    const alpha    = ring.alpha * (1 - t * 0.25); // slight fade within frame

    ctx.save();
    ctx.translate(cx, cy);

    // ── Ring ──
    ctx.beginPath();
    ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${ring.color}, ${alpha})`;
    ctx.lineWidth   = frame.phase === 'burst' ? 3.5 : 2;
    ctx.shadowColor = `rgba(${ring.color}, ${Math.min(1, alpha * 1.4)})`;
    ctx.shadowBlur  = frame.phase === 'burst' ? 18 : 10;
    ctx.stroke();

    // ── Fill flash on burst frame ──
    if (frame.phase === 'burst') {
      const fillGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusPx);
      fillGrad.addColorStop(0,   `rgba(${ring.color}, ${alpha * 0.35})`);
      fillGrad.addColorStop(0.6, `rgba(${ring.color}, ${alpha * 0.12})`);
      fillGrad.addColorStop(1,   `rgba(${ring.color}, 0)`);
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Spikes / cardinal rays on frames that specify them ──
    if (spike && spike > 0) {
      const spikeLen = CS * 0.22;
      const inR   = radiusPx - 4;
      const outR  = radiusPx + spikeLen;
      const angleOffset = now * 0.001;
      const step = (Math.PI * 2) / spike;

      ctx.strokeStyle = `rgba(${ring.color}, ${alpha * 0.85})`;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      for (let s = 0; s < spike; s++) {
        const angle = s * step + angleOffset;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.moveTo(cos * inR,  sin * inR);
        ctx.lineTo(cos * outR, sin * outR);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
