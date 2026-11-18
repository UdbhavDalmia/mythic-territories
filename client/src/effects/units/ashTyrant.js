import * as C from '@shared/constants.js';
import { getPieceVisualState, triggerScreenshake } from './helpers.js';

export function spawnReignOfFireEffect(tyrantPiece, targetR, targetC, gameState) {
  if (!gameState || !tyrantPiece) return;
  gameState.reignOfFireAnimations = gameState.reignOfFireAnimations || [];

  const srcX = tyrantPiece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const srcY = tyrantPiece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dstX = targetC * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dstY = targetR * C.CELL_SIZE + C.CELL_SIZE / 2;

  const range = (C.ABILITY_VALUES && C.ABILITY_VALUES.ReignOfFire && C.ABILITY_VALUES.ReignOfFire.range) || 2.5;
  const R = range * C.CELL_SIZE;
  const theta = Math.atan2(dstY - srcY, dstX - srcX);
  const angleWidth = Math.PI / 3; // 60 degrees

  const NUM_STREAMS = 15;
  const streams = [];
  for (let i = 0; i < NUM_STREAMS; i++) {
    // Sample random endpoints within the 60-degree sector
    const angle = theta + (Math.random() - 0.5) * angleWidth;
    const dist = Math.random() * R;
    const targetFlareX = srcX + Math.cos(angle) * dist;
    const targetFlareY = srcY + Math.sin(angle) * dist;

    const streamDx = targetFlareX - srcX;
    const streamDy = targetFlareY - srcY;
    const streamAngle = Math.atan2(streamDy, streamDx);
    const speed = 18 + Math.random() * 6;
    streams.push({
      x: srcX, y: srcY,
      vx: Math.cos(streamAngle) * speed,
      vy: Math.sin(streamAngle) * speed,
      targetX: targetFlareX,
      targetY: targetFlareY,
      trail: [], impacted: false,
      size: 5 + Math.random() * 4,
      delay: i * 2, ticks: 0
    });
  }
  const impactPieces = (gameState.pieces || []).map(p => {
    if (C.cellIntersectsSector(p.row, p.col, tyrantPiece.row, tyrantPiece.col, targetR, targetC, range, angleWidth)) {
      return { id: p.id, team: p.team, col: p.col, row: p.row };
    }
    return null;
  }).filter(Boolean);

  gameState.reignOfFireAnimations.push({
    srcX, srcY, dstX, dstY, streams, impactPieces,
    ticks: 0, impactTriggered: false, impactParticles: [], allyGlows: []
  });
}

export function drawReignOfFireAnimations(ctx, gameState) {
  if (!gameState.reignOfFireAnimations) return;

  for (let i = gameState.reignOfFireAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.reignOfFireAnimations[i];
    anim.ticks++;
    let allImpacted = true;

    for (let s = 0; s < anim.streams.length; s++) {
      const st = anim.streams[s];
      if (st.impacted) continue;
      if (anim.ticks < st.delay) { allImpacted = false; continue; }
      allImpacted = false;
      st.ticks++;

      const dx = st.targetX - st.x;
      const dy = st.targetY - st.y;
      const dist = Math.hypot(dx, dy);

      if (dist < Math.hypot(st.vx, st.vy) + 2) {
        st.impacted = true;

        // Localized impact visual at flare destination
        gameState.shockwaves = gameState.shockwaves || [];
        gameState.shockwaves.push({ x: st.targetX, y: st.targetY, radius: C.CELL_SIZE * 0.8, life: 0.8, color: '255, 100, 0' });

        for (let e = 0; e < 8; e++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          anim.impactParticles.push({
            x: st.targetX, y: st.targetY,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
            alpha: 1, size: Math.random() * 3 + 1.5,
            color: Math.random() > 0.5 ? '255, 80, 10' : '255, 200, 50'
          });
        }

        if (!anim.impactTriggered) {
          anim.impactTriggered = true;
          // Core shockwave at the main target cell
          gameState.shockwaves.push({ x: anim.dstX, y: anim.dstY, radius: C.CELL_SIZE * 2.0, life: 1.0, color: '255, 80, 0' });

          anim.impactPieces.forEach(ip => {
            const piece = (gameState.pieces || []).find(p => p.id === ip.id);
            if (!piece) return;
            const px = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const py = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
            if (ip.team !== 'ash') {
              for (let e = 0; e < 18; e++) {
                anim.impactParticles.push({
                  x: px + (Math.random() - 0.5) * C.CELL_SIZE,
                  y: py - C.CELL_SIZE * 0.5,
                  vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1,
                  alpha: 1, size: Math.random() * 3 + 1,
                  color: '255, 50, 0', isEnemyHit: true
                });
              }
            } else {
              anim.allyGlows.push({ px, py, life: 1.0 });
            }
          });
        }
        continue;
      }

      st.x += st.vx; st.y += st.vy;
      for (let e = 0; e < 3; e++) {
        st.trail.push({
          x: st.x + (Math.random() - 0.5) * 8, y: st.y + (Math.random() - 0.5) * 8,
          alpha: 0.9, size: Math.random() * st.size * 0.7 + 1
        });
      }

      // Draw trails (Additive composite operation without shadowBlur)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let t = st.trail.length - 1; t >= 0; t--) {
        const tp = st.trail[t];
        tp.alpha -= 0.07;
        if (tp.alpha <= 0) { st.trail.splice(t, 1); continue; }
        ctx.fillStyle = `rgba(${tp.alpha > 0.5 ? '255, 150, 20' : '230, 50, 0'}, ${tp.alpha})`;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Draw projectile head (High-performance gradient, shadowBlur removed)
      ctx.save(); ctx.translate(st.x, st.y);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, st.size);
      grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
      grad.addColorStop(0.3, 'rgba(255, 150, 0, 0.9)');
      grad.addColorStop(1, 'rgba(200, 30, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, st.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // High performance impact particles (One global save/restore, shadowBlur removed)
    if (anim.impactParticles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = anim.impactParticles.length - 1; k >= 0; k--) {
        const p = anim.impactParticles[k];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy += 0.25;
        p.alpha -= p.isEnemyHit ? 0.025 : 0.02;
        if (p.alpha <= 0) { anim.impactParticles.splice(k, 1); continue; }
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    for (let g = anim.allyGlows.length - 1; g >= 0; g--) {
      const gl = anim.allyGlows[g];
      gl.life -= 0.012;
      if (gl.life <= 0) { anim.allyGlows.splice(g, 1); continue; }
      const pulse = 0.5 + 0.5 * Math.sin(anim.ticks * 0.25);
      const innerAlpha = gl.life * (0.55 + 0.25 * pulse);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const innerGrad = ctx.createRadialGradient(gl.px, gl.py, 0, gl.px, gl.py, C.CELL_SIZE * 0.7);
      innerGrad.addColorStop(0, `rgba(255, 200, 60, ${innerAlpha})`);
      innerGrad.addColorStop(0.5, `rgba(220, 50, 0, ${innerAlpha * 0.6})`);
      innerGrad.addColorStop(1, 'rgba(180, 20, 0, 0)');
      ctx.fillStyle = innerGrad; ctx.beginPath(); ctx.arc(gl.px, gl.py, C.CELL_SIZE * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (anim.ticks < 10) {
        ctx.save(); ctx.strokeStyle = `rgba(255, 100, 0, ${gl.life * 0.7})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gl.px, gl.py, C.CELL_SIZE * 0.35 * (1 + (10 - anim.ticks) * 0.05), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }

    if (allImpacted && anim.impactTriggered && anim.impactParticles.length === 0 && anim.allyGlows.length === 0) {
      if (!anim.streams.some(s => s.trail.length > 0)) gameState.reignOfFireAnimations.splice(i, 1);
    }
  }
}

// ============================================================
// DEATH METEOR — Eclipse, meteor fall, screen shake, glow
// ============================================================

export function spawnDeathMeteorEffect(piece, gameState, originR, originC, targetR, targetC) {
  if (!piece || !gameState) return;
  gameState.deathMeteorAnimations = gameState.deathMeteorAnimations || [];
  const startR = (originR !== undefined) ? originR : (piece.deathMeteorOrigin?.row ?? piece.row);
  const startC = (originC !== undefined) ? originC : (piece.deathMeteorOrigin?.col ?? piece.col);
  const destR = (targetR !== undefined) ? targetR : (piece.row !== startR ? piece.row : startR);
  const destC = (targetC !== undefined) ? targetC : (piece.col !== startC ? piece.col : startC);

  const cx = startC * C.CELL_SIZE + C.CELL_SIZE / 2;
  const cy = startR * C.CELL_SIZE + C.CELL_SIZE / 2;
  const destX = destC * C.CELL_SIZE + C.CELL_SIZE / 2;
  const destY = destR * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.deathMeteorAnimations.push({
    pieceId: piece.id,
    cx, cy,
    destR, destC,
    destX, destY,
    hasDisplacement: (destR !== startR || destC !== startC),
    meteorX: cx + (Math.random() - 0.5) * C.CELL_SIZE * 0.5,
    meteorY: -C.CELL_SIZE * 3,
    targetX: cx, targetY: cy,
    ticks: 0, phase: 'eclipse', eclipseLife: 0,
    shakeTriggered: false, impactParticles: [], emberTrail: [],
    runeSparkles: []
  });
}

export function drawDeathMeteorAnimations(ctx, gameState) {
  if (!gameState.deathMeteorAnimations) return;
  const W = C.CANVAS_SIZE; const H = C.CANVAS_SIZE;

  for (let i = gameState.deathMeteorAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.deathMeteorAnimations[i];
    anim.ticks++;

    // --- DRAW ORANGE LANDING RUNE AT TYRANT'S DESTINATION (BEFOREHAND) ---
    if (anim.hasDisplacement && anim.destX !== undefined && anim.destY !== undefined) {
      const rx = anim.destX;
      const ry = anim.destY;
      const t = anim.ticks * 0.04;

      let runeAlpha = 1.0;
      if (anim.phase === 'eclipse') {
        runeAlpha = Math.min(1.0, anim.ticks / 10);
      } else if (anim.phase === 'impact') {
        runeAlpha = Math.max(0, 1.0 - (anim.impactTick || 0) / 28);
      }

      if (runeAlpha > 0.01) {
        ctx.save();
        ctx.translate(rx, ry);

        // 1. Subtle orange tile ground aura
        const auraGrad = ctx.createRadialGradient(0, 0, C.CELL_SIZE * 0.1, 0, 0, C.CELL_SIZE * 0.48);
        auraGrad.addColorStop(0, `rgba(255, 120, 0, ${runeAlpha * 0.4})`);
        auraGrad.addColorStop(0.6, `rgba(255, 60, 0, ${runeAlpha * 0.18})`);
        auraGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, C.CELL_SIZE * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // 2. Outer Rotating Runed Ring with Arcane Notches
        ctx.save();
        ctx.rotate(t * 0.7);
        ctx.strokeStyle = `rgba(255, 130, 10, ${runeAlpha * 0.85})`;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 12 * runeAlpha;
        const outR = C.CELL_SIZE * 0.42;
        ctx.beginPath();
        ctx.arc(0, 0, outR, 0, Math.PI * 2);
        ctx.stroke();

        // Runemark tick notches around outer ring
        const numNotches = 8;
        ctx.lineWidth = 1.5;
        for (let n = 0; n < numNotches; n++) {
          ctx.rotate((Math.PI * 2) / numNotches);
          ctx.beginPath();
          ctx.moveTo(outR - 4, 0);
          ctx.lineTo(outR + 4, 0);
          ctx.stroke();
        }
        ctx.restore();

        // 3. Inner Counter-Rotating Hex / Diamond Star Glyph
        ctx.save();
        ctx.rotate(-t * 1.1);
        ctx.strokeStyle = `rgba(255, 190, 40, ${runeAlpha * 0.9})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10 * runeAlpha;
        const inR = C.CELL_SIZE * 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, inR, 0, Math.PI * 2);
        ctx.stroke();

        // Inscribed rotating diamond star
        ctx.beginPath();
        for (let s = 0; s < 4; s++) {
          const ang = (s / 4) * Math.PI * 2;
          const px = Math.cos(ang) * inR;
          const py = Math.sin(ang) * inR;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        for (let s = 0; s < 4; s++) {
          const ang = (s / 4) * Math.PI * 2;
          const px = Math.cos(ang) * inR;
          const py = Math.sin(ang) * inR;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 4. Central Teleportation Hearth Glow
        const pulse = 0.8 + 0.2 * Math.sin(t * 3);
        ctx.fillStyle = `rgba(255, 230, 120, ${runeAlpha * pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, C.CELL_SIZE * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // 5. Rising Beacon Ember Sparks
        if (!anim.runeSparkles) anim.runeSparkles = [];
        if (anim.ticks % 3 === 0 && anim.runeSparkles.length < 12) {
          anim.runeSparkles.push({
            x: (Math.random() - 0.5) * C.CELL_SIZE * 0.6,
            y: (Math.random() - 0.5) * C.CELL_SIZE * 0.6,
            vy: -(Math.random() * 1.5 + 0.8),
            alpha: 1.0,
            size: Math.random() * 2.5 + 1.5
          });
        }
        for (let k = anim.runeSparkles.length - 1; k >= 0; k--) {
          const spk = anim.runeSparkles[k];
          spk.y += spk.vy;
          spk.alpha -= 0.04;
          if (spk.alpha <= 0) { anim.runeSparkles.splice(k, 1); continue; }
          ctx.fillStyle = `rgba(255, 170, 30, ${spk.alpha * runeAlpha})`;
          ctx.beginPath();
          ctx.arc(spk.x, spk.y, spk.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    if (anim.phase === 'eclipse') {
      anim.eclipseLife = Math.min(1, anim.ticks / 20);
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, `rgba(25, 0, 0, ${anim.eclipseLife * 0.45})`);
      g.addColorStop(0.5, `rgba(5, 0, 0, ${anim.eclipseLife * 0.72})`);
      g.addColorStop(1, `rgba(0, 0, 0, ${anim.eclipseLife * 0.88})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      if (anim.ticks >= 22) anim.phase = 'fall';

    } else if (anim.phase === 'fall') {
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(25, 0, 0, 0.45)'); g.addColorStop(0.5, 'rgba(5, 0, 0, 0.72)'); g.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();

      const dx = anim.targetX - anim.meteorX; const dy = anim.targetY - anim.meteorY;
      const dist = Math.hypot(dx, dy); const speed = 28;

      if (dist > speed + 2) {
        anim.meteorX += (dx / dist) * speed; anim.meteorY += (dy / dist) * speed;
        for (let e = 0; e < 5; e++) {
          anim.emberTrail.push({ x: anim.meteorX + (Math.random() - 0.5) * 18, y: anim.meteorY + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 3 - 0.5, alpha: 1, size: Math.random() * 8 + 4 });
        }
        ctx.save();
        // High performance ember trail (shadowBlur removed)
        for (let t = anim.emberTrail.length - 1; t >= 0; t--) {
          const tp = anim.emberTrail[t]; tp.x += tp.vx; tp.y += tp.vy; tp.alpha -= 0.05;
          if (tp.alpha <= 0) { anim.emberTrail.splice(t, 1); continue; }
          ctx.fillStyle = `rgba(${tp.alpha > 0.6 ? '255, 200, 50' : '255, 80, 0'}, ${tp.alpha})`;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.save(); ctx.translate(anim.meteorX, anim.meteorY);
        const mAngle = Math.atan2(dy, dx); ctx.rotate(mAngle + Math.PI / 4);
        const mS = C.CELL_SIZE * 0.7;
        const mg = ctx.createRadialGradient(0, 0, mS * 0.1, 0, 0, mS);
        mg.addColorStop(0, 'rgba(255,255,220,1)'); mg.addColorStop(0.3, 'rgba(255,140,0,0.9)'); mg.addColorStop(0.7, 'rgba(180,30,0,0.5)'); mg.addColorStop(1, 'rgba(80,0,0,0)');
        ctx.fillStyle = mg; ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 40;
        ctx.beginPath(); ctx.arc(0, 0, mS, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-mS * 0.4, -mS * 0.5); ctx.lineTo(mS * 0.3, -mS * 0.3); ctx.lineTo(mS * 0.5, mS * 0.2); ctx.lineTo(0, mS * 0.5); ctx.lineTo(-mS * 0.45, mS * 0.3); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        anim.phase = 'impact'; anim.impactTick = 0;
        if (!anim.shakeTriggered) {
          anim.shakeTriggered = true;
          gameState.screenshake = { intensity: 18, duration: 450 };
          triggerScreenshake(18, 450);
        }
        gameState.shockwaves = gameState.shockwaves || [];
        gameState.shockwaves.push({ x: anim.cx, y: anim.cy, radius: C.CELL_SIZE * 2.5, life: 1, color: '255, 120, 0' });
        gameState.shockwaves.push({ x: anim.cx, y: anim.cy, radius: C.CELL_SIZE * 4.0, life: 0.7, color: '220, 40, 0' });
        for (let e = 0; e < 60; e++) {
          const angle = Math.random() * Math.PI * 2; const sp = Math.random() * 15 + 5;
          anim.impactParticles.push({ x: anim.cx, y: anim.cy, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp - 4, alpha: 1, size: Math.random() * 7 + 3, color: Math.random() > 0.4 ? '255, 100, 10' : '255, 220, 80' });
        }
      }

    } else if (anim.phase === 'impact') {
      anim.impactTick = (anim.impactTick || 0) + 1;
      const fe = Math.max(0, 1 - anim.impactTick / 30);
      if (fe > 0) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${fe * 0.75})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (anim.impactTick < 20) {
        const ga = Math.max(0, 1 - anim.impactTick / 20);
        const ig = ctx.createRadialGradient(anim.cx, anim.cy, 0, anim.cx, anim.cy, C.CELL_SIZE * 3);
        ig.addColorStop(0, `rgba(255,240,100,${ga * 0.9})`); ig.addColorStop(0.3, `rgba(255,80,0,${ga * 0.7})`); ig.addColorStop(0.7, `rgba(180,20,0,${ga * 0.4})`); ig.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(anim.cx, anim.cy, C.CELL_SIZE * 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // High performance impact particles (shadowBlur removed)
      for (let k = anim.impactParticles.length - 1; k >= 0; k--) {
        const p = anim.impactParticles[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.90; p.vy += 0.3; p.alpha -= 0.018;
        if (p.alpha <= 0) { anim.impactParticles.splice(k, 1); continue; }
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (anim.impactTick > 40 && anim.impactParticles.length === 0) gameState.deathMeteorAnimations.splice(i, 1);
    }
  }
}

// ============================================================
// DEATH METEOR SHIELD — Yellow glowing spherical barrier on Ash Tyrant
// ============================================================
export function drawDeathMeteorShield(ctx, piece, gameState) {
  if (!piece || piece.key !== 'ashAshTyrant') return;
  if (!piece.hasDeathMeteorInvincibility) return;

  const life = Math.min(1, ((piece.deathMeteorInvincibilityTurns || 1) / 2));
  const vis = getPieceVisualState ? getPieceVisualState(piece) : null;
  const cx = vis ? (vis.x + C.CELL_SIZE / 2 + vis.offsetX) : (piece.col * C.CELL_SIZE + C.CELL_SIZE / 2);
  const cy = vis ? (vis.y + C.CELL_SIZE / 2 + vis.offsetY) : (piece.row * C.CELL_SIZE + C.CELL_SIZE / 2);
  const sphereRadius = C.CELL_SIZE * 0.54;

  ctx.save();

  // 1. Translucent Golden Spherical Core Fill (Lightened gentle tint)
  const sphereGrad = ctx.createRadialGradient(
    cx - sphereRadius * 0.32, cy - sphereRadius * 0.32, 0,
    cx, cy, sphereRadius
  );
  sphereGrad.addColorStop(0, `rgba(255, 255, 240, ${life * 0.16})`);
  sphereGrad.addColorStop(0.35, `rgba(255, 220, 40, ${life * 0.08})`);
  sphereGrad.addColorStop(0.7, `rgba(255, 180, 0, ${life * 0.03})`);
  sphereGrad.addColorStop(0.92, `rgba(250, 204, 21, ${life * 0.16})`);
  sphereGrad.addColorStop(1, `rgba(255, 235, 50, ${life * 0.55})`);
  ctx.fillStyle = sphereGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Luminous Yellow Outer Spherical Boundary Shell (Clean, no swirls)
  ctx.beginPath();
  ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 235, 50, ${life * 0.85})`;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.85)';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2.4 * life;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ============================================================
// FROST LORD SHIELD — Icy cyan glowing 3D spherical barrier on Frost Lord
// ============================================================

