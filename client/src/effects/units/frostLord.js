import * as C from '@shared/constants.js';
import { getPieceVisualState } from './helpers.js';

export function spawnFrostfallBlessingEffect(r, c, gameState) {
  // Just add a shockwave when cast
  const targetX = c * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = r * C.CELL_SIZE + C.CELL_SIZE / 2;
  const radiusPx = 2.0 * C.CELL_SIZE; // True radius from constants
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: radiusPx, life: 1, color: '135, 206, 250' });

  // Deep Freeze Vignette
  const spikes = [];
  for (let i = 0; i < 45; i++) {
    spikes.push({
      angle: Math.random() * Math.PI * 2,
      length: Math.random() * 200 + 80,
      thickness: Math.random() * 5 + 2,
      branchAngles: [Math.random() * 0.6 + 0.2, -Math.random() * 0.6 - 0.2],
      branchPos: Math.random() * 0.6 + 0.2
    });
  }
  gameState.frostVignette = { life: 0, maxLife: 180, spikes }; // Fades in and inwards, holds, then fades out over ~3 seconds
}

export function drawFrostfallBlessingAnimations(ctx, gameState) {
  if (!gameState.frostfallShards) gameState.frostfallShards = [];
  if (!gameState.dyingFrostfallBlessings) gameState.dyingFrostfallBlessings = [];
  if (!gameState.knownFrostfallBlessings) gameState.knownFrostfallBlessings = [];

  // Detect terminated blessings and trigger shatter sequence
  const currentIds = (gameState.frostfallBlessings || []).map(b => `${b.r},${b.c}`);
  gameState.knownFrostfallBlessings.forEach(known => {
    if (!currentIds.includes(`${known.r},${known.c}`)) {
      gameState.dyingFrostfallBlessings.push({ ...known, shatterLife: 1.0 });
    }
  });
  gameState.knownFrostfallBlessings = (gameState.frostfallBlessings || []).map(b => ({ ...b }));

  // Draw Deep Freeze Vignette
  if (gameState.frostVignette && gameState.frostVignette.life < gameState.frostVignette.maxLife) {
    const currentProgress = gameState.frostVignette.life / gameState.frostVignette.maxLife;
    if (currentProgress >= 0.75) {
      gameState.frostVignette.life += 3; // Fade out 3x faster
    } else {
      gameState.frostVignette.life += 1;
    }
    const progress = Math.min(1.0, gameState.frostVignette.life / gameState.frostVignette.maxLife);

    let alpha = 1.0;
    let innerRadiusMod = 0.8;

    if (progress < 0.25) {
      // Phase 1: Fade in and creep inwards dramatically
      alpha = progress / 0.25;
      innerRadiusMod = 0.9 - (progress / 0.25) * 0.7; // Transparent center shrinks drastically from 0.9 to 0.2!
    } else if (progress < 0.75) {
      // Phase 2: Hold the deep freeze
      alpha = 1.0;
      innerRadiusMod = 0.2;
    } else {
      // Phase 3: Slowly fade out
      alpha = 1 - ((progress - 0.75) / 0.25);
      innerRadiusMod = 0.2;
    }

    ctx.save();
    // Use source-over instead of lighter to allow the blackish shadows to render correctly
    ctx.globalCompositeOperation = 'source-over';
    const w = C.CANVAS_SIZE;
    const h = C.CANVAS_SIZE;

    // Much more intense gradient
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * innerRadiusMod * 0.5, w / 2, h / 2, w * 0.8);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.3, `rgba(220, 250, 255, ${alpha * 0.3})`); // Bright mist creeping close to center
    grad.addColorStop(0.6, `rgba(100, 180, 240, ${alpha * 0.65})`); // Rich frosty blue
    grad.addColorStop(0.85, `rgba(20, 40, 70, ${alpha * 0.85})`);   // Deep cold shadows
    grad.addColorStop(1, `rgba(5, 10, 15, ${alpha * 1.0})`);        // Absolute black frost at edges

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw procedural frost spikes creeping in (Optimized for performance)
    ctx.save();
    ctx.translate(w / 2, h / 2);

    const maxSpikeGrowth = 1.0 - innerRadiusMod; // Grows as the vignette pushes inward

    // Draw a faster simulated glow by drawing the spikes twice: once thick/faint, once thin/bright
    // This is massively faster than using ctx.shadowBlur = 12 on 45 complex branching paths
    [
      { width: 8, color: `rgba(150, 220, 255, ${alpha * 0.2})` },
      { width: 1, color: `rgba(220, 250, 255, ${alpha * 0.9})` }
    ].forEach(pass => {
      ctx.strokeStyle = pass.color;
      gameState.frostVignette.spikes.forEach(spike => {
        ctx.save();
        ctx.rotate(spike.angle);

        const edgeDist = w * 0.7; // Start drawing just outside the viewable circle
        const currentLength = spike.length * maxSpikeGrowth * 1.5;

        ctx.lineWidth = spike.thickness * pass.width;
        ctx.beginPath();
        ctx.moveTo(edgeDist, 0);
        ctx.lineTo(edgeDist - currentLength, 0);

        // Draw little frost branches coming off the main spike
        const branchStart = edgeDist - currentLength * spike.branchPos;
        spike.branchAngles.forEach(ba => {
          ctx.moveTo(branchStart, 0);
          ctx.lineTo(branchStart - Math.cos(ba) * currentLength * 0.4, -Math.sin(ba) * currentLength * 0.4);
        });

        ctx.stroke();
        ctx.restore();
      });
    });
    ctx.restore();

    // Icy screen border (Reduced blur radius for performance)
    ctx.strokeStyle = `rgba(180, 240, 255, ${alpha * 0.4})`;
    ctx.lineWidth = 25;
    ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
    ctx.shadowBlur = 25; // Halved from 60 to significantly improve GPU fill-rate
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  } else if (gameState.frostVignette) {
    gameState.frostVignette = null;
  }

  // Draw Shatter End Sequence
  for (let i = gameState.dyingFrostfallBlessings.length - 1; i >= 0; i--) {
    const dying = gameState.dyingFrostfallBlessings[i];
    dying.shatterLife -= 0.03;

    const targetX = dying.c * C.CELL_SIZE + C.CELL_SIZE / 2;
    const targetY = dying.r * C.CELL_SIZE + C.CELL_SIZE / 2;
    const radiusPx = dying.radius * C.CELL_SIZE;

    if (dying.shatterLife <= 0) {
      gameState.dyingFrostfallBlessings.splice(i, 1);
      // Final Burst
      for (let j = 0; j < 25; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 4;
        gameState.battleParticles.push({
          x: targetX + Math.cos(angle) * (radiusPx * 0.8),
          y: targetY + Math.sin(angle) * (radiusPx * 0.8),
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          alpha: 1, radius: Math.random() * 3 + 2, color: '150,220,255'
        });
      }
      continue;
    }

    // Draw dying aura - expands, fades, spins fast
    ctx.save();
    const expandRadius = radiusPx * (1 + (1 - dying.shatterLife) * 0.3);

    ctx.beginPath();
    ctx.arc(targetX, targetY, expandRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(100, 200, 255, ${dying.shatterLife})`;
    ctx.shadowColor = 'rgba(100, 200, 255, 1.0)';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 6 * dying.shatterLife;
    ctx.stroke();

    // Dying runes spin extremely fast
    ctx.translate(targetX, targetY);
    const timeOffset = performance.now() * 0.005; // Fast spin
    ctx.rotate(timeOffset);

    const numRunes = 8;
    const runeRadius = expandRadius * 0.89;

    ctx.fillStyle = `rgba(100, 220, 255, ${dying.shatterLife})`;
    ctx.strokeStyle = `rgba(100, 220, 255, ${dying.shatterLife})`;
    ctx.lineWidth = 2.5 * dying.shatterLife;

    for (let j = 0; j < numRunes; j++) {
      ctx.save();
      ctx.rotate((j / numRunes) * Math.PI * 2);
      ctx.translate(runeRadius, 0);
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      switch (j % 4) {
        case 0: ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke(); break;
        case 1: ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.moveTo(0, -1); ctx.lineTo(0, 8); ctx.moveTo(-5, 2); ctx.lineTo(5, 2); ctx.stroke(); break;
        case 2: ctx.moveTo(-7, 4); ctx.lineTo(7, 4); ctx.moveTo(-7, -2); ctx.bezierCurveTo(-3, -7, 3, 3, 7, -2); ctx.stroke(); break;
        case 3: ctx.moveTo(0, -6); ctx.lineTo(0, 5); ctx.arc(0, 5, 5, 0, Math.PI); ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.stroke(); break;
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Continuously spawn new shards for active abilities
  if (gameState.frostfallBlessings && gameState.frostfallBlessings.length > 0) {
    gameState.frostfallBlessings.forEach(blessing => {
      const targetX = blessing.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const targetY = blessing.r * C.CELL_SIZE + C.CELL_SIZE / 2;
      const radiusPx = blessing.radius * C.CELL_SIZE;

      // Draw the magical aura boundary
      ctx.save();

      // Faint frosted inner area
      ctx.beginPath();
      ctx.arc(targetX, targetY, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 200, 255, 0.05)';
      ctx.fill();

      // Outer thick glow ring
      ctx.beginPath();
      ctx.arc(targetX, targetY, radiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
      ctx.shadowColor = 'rgba(100, 200, 255, 1.0)';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 6;
      ctx.stroke();

      // Inner thin ring
      const innerRadius = radiusPx * 0.78;
      ctx.beginPath();
      ctx.arc(targetX, targetY, innerRadius, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Runes between inner and outer ring
      ctx.translate(targetX, targetY);
      const timeOffset = performance.now() * 0.0004;
      ctx.rotate(timeOffset);

      const numRunes = 8;
      const runeRadius = radiusPx * 0.89;

      ctx.fillStyle = 'rgba(100, 220, 255, 0.9)';
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.9)';
      ctx.lineWidth = 2.5;

      for (let i = 0; i < numRunes; i++) {
        ctx.save();
        ctx.rotate((i / numRunes) * Math.PI * 2);
        ctx.translate(runeRadius, 0);
        ctx.rotate(Math.PI / 2); // Orient symbols tangentially

        ctx.beginPath();
        switch (i % 4) {
          case 0: // Circle with line (Phi)
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.moveTo(0, -10); ctx.lineTo(0, 10);
            ctx.stroke();
            break;
          case 1: // Ankh-like
            ctx.arc(0, -5, 4, 0, Math.PI * 2);
            ctx.moveTo(0, -1); ctx.lineTo(0, 8);
            ctx.moveTo(-5, 2); ctx.lineTo(5, 2);
            ctx.stroke();
            break;
          case 2: // Wave with line
            ctx.moveTo(-7, 4); ctx.lineTo(7, 4);
            ctx.moveTo(-7, -2);
            ctx.bezierCurveTo(-3, -7, 3, 3, 7, -2);
            ctx.stroke();
            break;
          case 3: // Hook / anchor
            ctx.moveTo(0, -6); ctx.lineTo(0, 5);
            ctx.arc(0, 5, 5, 0, Math.PI);
            ctx.moveTo(-5, -3); ctx.lineTo(5, -3);
            ctx.stroke();
            break;
        }
        ctx.restore();
      }

      ctx.restore();

      // Spawn 1 flake every few frames (40% chance per frame) to lessen density
      if (Math.random() < 0.4) {
        const angle = Math.random() * Math.PI * 2;
        // Concentrate more towards the center using sqrt, and slightly confine the max radius
        const distance = Math.sqrt(Math.random()) * (radiusPx - C.CELL_SIZE * 0.3);

        gameState.frostfallShards.push({
          cx: targetX,
          cy: targetY,
          maxRadius: radiusPx,
          x: targetX + Math.cos(angle) * distance,
          y: targetY - C.CELL_SIZE * 1.2 - Math.random() * C.CELL_SIZE * 1.0, // Start just above the ability area
          targetY: targetY + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 1.5 + 2.5,
          alpha: Math.random() * 0.3 + 0.7, // brighter
          size: Math.random() * 3 + 3, // slightly bigger
          hitProcessed: false
        });
      }
    });
  }

  // Animate existing shards
  for (let k = gameState.frostfallShards.length - 1; k >= 0; k--) {
    const s = gameState.frostfallShards[k];
    s.x += s.vx;
    s.y += s.vy;

    // Constrain snow to not drift outside the boundary circle
    if (s.vy > 0 && Math.hypot(s.x - s.cx, s.targetY - s.cy) > s.maxRadius - s.size) {
      s.vx *= -1; // Bounce back horizontally if drifting outside
      s.x += s.vx;
    }

    if (!s.hitProcessed && s.y >= s.targetY) {
      s.hitProcessed = true;

      let col = Math.floor(s.x / C.CELL_SIZE);
      let row = Math.floor(s.targetY / C.CELL_SIZE);
      const hitPiece = C.getPieceAt(row, col, gameState.pieces);

      // Strict check to ensure the piece is formally within the true radius
      const isInsideRadius = hitPiece ? Math.hypot(hitPiece.row - Math.floor(s.cy / C.CELL_SIZE), hitPiece.col - Math.floor(s.cx / C.CELL_SIZE)) <= s.maxRadius / C.CELL_SIZE : false;

      if (hitPiece && isInsideRadius) {
        s.vy = 0;
        s.vx = 0;
        s.isPieceHit = true;
        // Randomly position the dot slightly higher to look like it stuck to the unit
        s.y -= Math.random() * C.CELL_SIZE * 0.6;
        if (hitPiece.team !== 'snow') {
          s.hitColor = '255, 255, 255'; // Enemy hit: white dot
          s.hitType = 'enemy';
          s.shatterOffsets = Array.from({ length: 4 }, () => ({
            dx: (Math.random() - 0.5) * 15,
            dy: (Math.random() - 0.5) * 15,
            flickerSpeed: Math.random() * 0.015 + 0.01
          }));
        } else {
          s.hitColor = '100, 255, 100'; // Ally hit: green dot
          s.hitType = 'ally';
          s.starRotation = Math.random() * Math.PI;
        }
      } else {
        // Hit empty ground: stick to the floor
        s.vy = 0;
        s.vx = 0;
      }
    }

    if (s.alpha <= 0) {
      gameState.frostfallShards.splice(k, 1);
      continue;
    }

    ctx.save();
    if (s.vy === 0) {
      if (s.isPieceHit) {
        // Dot stuck to a piece
        s.alpha -= 0.04; // Fade out relatively quickly
        if (s.hitType === 'enemy') {
          // Flickering particles for enemies
          ctx.shadowColor = `rgba(${s.hitColor}, 1.0)`;
          ctx.shadowBlur = 12; // Add strong glow for visibility
          s.shatterOffsets.forEach(off => {
            off.dy -= 0.3; // Drift upward slightly faster
            // Higher baseline alpha for more visibility
            const flickerAlpha = Math.max(0, s.alpha * (0.7 + 0.5 * Math.sin(performance.now() * off.flickerSpeed)));
            ctx.fillStyle = `rgba(${s.hitColor}, ${flickerAlpha})`;
            ctx.beginPath();
            // Increased particle size
            ctx.arc(s.x + off.dx, s.y + off.dy, s.size / 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          // Rotating star shines for allies with green glow
          const starAlpha = s.alpha * 0.7;
          ctx.save();
          ctx.shadowColor = `rgba(${s.hitColor}, 1.0)`;
          ctx.shadowBlur = 10;
          ctx.fillStyle = `rgba(${s.hitColor}, ${starAlpha})`;
          ctx.translate(s.x, s.y);
          ctx.rotate(s.starRotation + performance.now() * 0.001);
          const spikes = 4;
          // Reduced star size
          const outerRadius = s.size * 1.5;
          const innerRadius = s.size * 0.4;
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes;
            if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Baked snow on the floor
        s.alpha -= 0.0015; // Fade out very slowly to stay longer
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Falling snow - rendered as a beautiful rotating crystal snowflake
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(performance.now() * 0.003 + s.size); // gentle spin
      ctx.fillStyle = `rgba(220, 245, 255, ${s.alpha})`;
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      // 8-point crystalline star shape
      ctx.moveTo(0, -s.size * 1.4);
      ctx.lineTo(s.size * 0.35, -s.size * 0.35);
      ctx.lineTo(s.size * 1.4, 0);
      ctx.lineTo(s.size * 0.35, s.size * 0.35);
      ctx.lineTo(0, s.size * 1.4);
      ctx.lineTo(-s.size * 0.35, s.size * 0.35);
      ctx.lineTo(-s.size * 1.4, 0);
      ctx.lineTo(-s.size * 0.35, -s.size * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}


export function drawHelpFromAboveFog(ctx, gameState) {
  // Emptied: legacy fog removed
}

export function drawHelpFromAboveVapors(ctx, gameState) {
  // Emptied: legacy vapors removed
}

// ============================================================
// REIGN OF FIRE — Fire streams from Ash Tyrant to target zone
// ============================================================

export function drawFrostLordShield(ctx, piece, gameState) {
  if (!piece || piece.key !== 'snowFrostLord') return;
  if (!piece.hasHelpFromAboveActive) return;

  const life = Math.min(1, ((piece.helpFromAboveActiveTurns || 1) / 3));
  const vis = getPieceVisualState ? getPieceVisualState(piece) : null;
  const cx = vis ? (vis.x + C.CELL_SIZE / 2 + vis.offsetX) : (piece.col * C.CELL_SIZE + C.CELL_SIZE / 2);
  const cy = vis ? (vis.y + C.CELL_SIZE / 2 + vis.offsetY) : (piece.row * C.CELL_SIZE + C.CELL_SIZE / 2);
  const sphereRadius = C.CELL_SIZE * 0.54;

  ctx.save();

  // 1. Translucent Diamond Ice Spherical Core Fill (Lightened gentle tint)
  const sphereGrad = ctx.createRadialGradient(
    cx - sphereRadius * 0.32, cy - sphereRadius * 0.32, 0,
    cx, cy, sphereRadius
  );
  sphereGrad.addColorStop(0, `rgba(240, 249, 255, ${life * 0.18})`);
  sphereGrad.addColorStop(0.35, `rgba(186, 230, 253, ${life * 0.09})`);
  sphereGrad.addColorStop(0.7, `rgba(56, 189, 248, ${life * 0.03})`);
  sphereGrad.addColorStop(0.92, `rgba(14, 165, 233, ${life * 0.16})`);
  sphereGrad.addColorStop(1, `rgba(56, 189, 248, ${life * 0.55})`);
  ctx.fillStyle = sphereGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Luminous Cyan Outer Spherical Boundary Shell (Clean, no swirls)
  ctx.beginPath();
  ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(56, 189, 248, ${life * 0.88})`;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2.4 * life;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ============================================================
// SHIELD BREAK — Shattering crystal shards & energy shockwave
// ============================================================

export function spawnGuardianSaveEffect(piece, gameState) {
  if (!piece) return;

  // Reset visual active flags and glow multipliers on all pieces
  if (gameState.pieces) {
    gameState.pieces.forEach(p => {
      p.helpFromAboveVisualActive = false;
      p.helpFromAboveGlowMultiplier = 0.0;
    });
  }

  gameState.guardianAnimations = gameState.guardianAnimations || [];
  gameState.guardianAnimations.push({
    x: piece.col * C.CELL_SIZE + C.CELL_SIZE / 2,
    y: piece.row * C.CELL_SIZE + C.CELL_SIZE / 2,
    pieceId: piece.id,
    life: 1.0,
    rays: [],
    raysSpawned: false
  });
}

export function drawGuardianSaveAnimations(ctx, gameState) {
  if (!gameState.guardianAnimations) return;
  for (let i = gameState.guardianAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.guardianAnimations[i];
    anim.life -= 0.006; // Slower decay (was 0.012) for a more epic feel

    const cx = anim.x;
    const cy = anim.y;

    // Phase 1: Divine Light Column (life between 1.0 and 0.4)
    if (anim.life > 0.4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Draw vertical beams of light descending from top
      const beamWidth = C.CELL_SIZE * 1.5;
      const beamAlpha = Math.min(1.0, (anim.life - 0.4) / 0.6);

      // 1. Center intense white-gold core
      const coreGrad = ctx.createLinearGradient(cx - beamWidth / 2, 0, cx + beamWidth / 2, 0);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      coreGrad.addColorStop(0.5, `rgba(255, 245, 200, ${0.8 * beamAlpha})`);
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = coreGrad;
      ctx.fillRect(cx - beamWidth, 0, beamWidth * 2, cy);

      // 2. Wide glowing cyan/blue shroud
      const outerGrad = ctx.createLinearGradient(cx - beamWidth, 0, cx + beamWidth, 0);
      outerGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      outerGrad.addColorStop(0.5, `rgba(0, 220, 255, ${0.4 * beamAlpha})`);
      outerGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = outerGrad;
      ctx.fillRect(cx - beamWidth * 2, 0, beamWidth * 4, cy);

      // 3. Ground energy flare around the Frost Lord
      const radialGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, C.CELL_SIZE * 1.8);
      radialGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * beamAlpha})`);
      radialGrad.addColorStop(0.3, `rgba(0, 230, 255, ${0.6 * beamAlpha})`);
      radialGrad.addColorStop(0.7, `rgba(0, 150, 255, ${0.25 * beamAlpha})`);
      radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = radialGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, C.CELL_SIZE * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 4. Floating sparks/particles rising inside the light
      if (Math.random() < 0.4) {
        anim.rays.push({
          type: 'spark',
          x: cx + (Math.random() - 0.5) * C.CELL_SIZE * 1.2,
          y: cy,
          vy: -(Math.random() * 1.5 + 1.0), // Slower sparks (was random * 3 + 2)
          alpha: 1.0,
          size: Math.random() * 3 + 2
        });
      }

      ctx.restore();
    }

    // Phase 2: Ray Breakdown Trigger
    // When life drops to 0.4, trigger the rays shooting towards nearby pieces
    if (anim.life <= 0.4 && !anim.raysSpawned) {
      anim.raysSpawned = true;
    }

    // Update and draw spark and projectile particles
    let activeParticles = 0;
    anim.rays.forEach(r => {
      if (r.type === 'spark') {
        r.y += r.vy;
        r.alpha -= 0.02;
        if (r.alpha > 0) {
          activeParticles++;
          ctx.fillStyle = `rgba(255, 235, 150, ${r.alpha})`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (r.type === 'projectile') {
        const targetPiece = gameState.pieces.find(p => p.id === r.targetPieceId);
        if (targetPiece) {
          if (!r.arrived) {
            r.progress += r.speed;
            if (r.progress < 1.0) {
              activeParticles++;
              const vis = getPieceVisualState(targetPiece);
              const tx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
              const ty = vis.y + C.CELL_SIZE / 2 + vis.offsetY;

              const rx = cx + (tx - cx) * r.progress;
              const ry = cy + (ty - cy) * r.progress;

              // Record trail
              r.trail.push({ x: rx, y: ry });
              if (r.trail.length > 8) r.trail.shift();

              ctx.save();
              ctx.globalCompositeOperation = 'lighter';

              // Draw trail line
              ctx.beginPath();
              if (r.trail.length > 0) {
                ctx.moveTo(r.trail[0].x, r.trail[0].y);
                for (let ti = 1; ti < r.trail.length; ti++) {
                  ctx.lineTo(r.trail[ti].x, r.trail[ti].y);
                }
              }
              ctx.strokeStyle = 'rgba(255, 220, 100, 0.6)';
              ctx.lineWidth = 3;
              ctx.stroke();

              // Draw glowing projectile head
              ctx.shadowColor = '#ffd700';
              ctx.shadowBlur = 12;
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(rx, ry, 6, 0, Math.PI * 2);
              ctx.fill();

              ctx.restore();
            } else {
              // Ray arrived!
              r.arrived = true;
              targetPiece.helpFromAboveVisualActive = true;
              targetPiece.helpFromAboveGlowMultiplier = 0.0; // trigger fade-in

              // Draw a flash impact spark
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              const vis = getPieceVisualState(targetPiece);
              const tx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
              const ty = vis.y + C.CELL_SIZE / 2 + vis.offsetY;

              const radialGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, C.CELL_SIZE * 0.8);
              radialGrad.addColorStop(0, 'rgba(255, 240, 150, 0.9)');
              radialGrad.addColorStop(0.5, 'rgba(255, 200, 50, 0.4)');
              radialGrad.addColorStop(1, 'rgba(255, 200, 50, 0)');
              ctx.fillStyle = radialGrad;
              ctx.beginPath();
              ctx.arc(tx, ty, C.CELL_SIZE * 0.8, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        }
      }
    });

    // Remove the entire animation if life is over and all particles are dead
    if (anim.life <= 0 && activeParticles === 0) {
      gameState.guardianAnimations.splice(i, 1);
    }
  }
}
