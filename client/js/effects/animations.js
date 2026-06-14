import * as C from '../../../shared/constants.js';
import { spawnBurningGroundParticle } from './terrain.js';
import * as UI from '../ui.js';

export function spawnFrenziedDashEffect(piece, oldRow, oldCol, newRow, newCol, gameState) {
  gameState.dashAnimations = gameState.dashAnimations || [];
  piece.isDashing = true;

  const startX = oldCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = oldRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endX = newCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endY = newRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.dashAnimations.push({
    piece,
    x: startX,
    y: startY,
    targetX: endX,
    targetY: endY,
    speed: 18,
    trailParticles: [],
    impacted: false
  });
}

export function drawFrenziedDashAnimations(ctx, gameState) {
  if (!gameState.dashAnimations) return;

  for (let i = gameState.dashAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.dashAnimations[i];
    const dx = anim.targetX - anim.x;
    const dy = anim.targetY - anim.y;
    const dist = Math.hypot(dx, dy);

    for (let j = anim.trailParticles.length - 1; j >= 0; j--) {
      const p = anim.trailParticles[j];
      p.y += p.vy;
      p.alpha -= 0.05;
      if (p.alpha <= 0) {
        anim.trailParticles.splice(j, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 100, 0, ${p.alpha})`;
      ctx.shadowColor = 'rgba(255, 50, 0, 1)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (dist < anim.speed && !anim.impacted) {
      anim.impacted = true;
      anim.piece.isDashing = false;

      gameState.shockwaves = gameState.shockwaves || [];
      gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 10, life: 1, color: '255, 69, 0' });

      for (let k = 0; k < 20; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        gameState.battleParticles.push({
          x: anim.targetX,
          y: anim.targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          radius: Math.random() * 3 + 2,
          color: '255, 100, 0'
        });
      }

      spawnBurningGroundParticle(anim.piece.row, anim.piece.col, gameState);
    }

    if (!anim.impacted) {
      anim.x += (dx / dist) * anim.speed;
      anim.y += (dy / dist) * anim.speed;

      for (let k = 0; k < 4; k++) {
        anim.trailParticles.push({
          x: anim.x + (Math.random() - 0.5) * 15,
          y: anim.y + (Math.random() - 0.5) * 15,
          vy: -(Math.random() * 1.5 + 0.5),
          alpha: 1,
          radius: Math.random() * 2 + 1
        });
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FF4500';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (anim.trailParticles.length === 0) {
      gameState.dashAnimations.splice(i, 1);
    }
  }
}

export function spawnSummonWispEffect(targetRow, targetCol, wispPiece, gameState) {
  gameState.wispAnimations = gameState.wispAnimations || [];
  wispPiece.isSummoning = true;

  const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  const vortexParticles = [];
  for (let i = 0; i < 35; i++) {
    vortexParticles.push({
      angle: Math.random() * Math.PI * 2,
      radius: C.CELL_SIZE * 0.8,
      speed: Math.random() * 0.1 + 0.05,
      size: Math.random() * 2 + 1,
      yOffset: (Math.random() - 0.5) * C.CELL_SIZE
    });
  }

  gameState.wispAnimations.push({ piece: wispPiece, x: targetX, y: targetY, ticks: 0, vortexParticles, shards: [], shattered: false });
}

export function drawSummonWispAnimations(ctx, gameState) {
  if (!gameState.wispAnimations) return;

  for (let i = gameState.wispAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.wispAnimations[i];
    anim.ticks = (anim.ticks || 0) + 1;

    if (!anim.shattered) {
      const progress = Math.min(anim.ticks / 45, 1);
      const maxRadius = C.CELL_SIZE * 0.45;

      ctx.save();
      ctx.translate(anim.x, anim.y);
      ctx.rotate(anim.ticks * 0.05);
      ctx.strokeStyle = `rgba(120,200,255,${0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, maxRadius * (0.5 + progress * 0.5), 0, Math.PI * 2 * (0.4 + progress * 0.6));
      ctx.stroke();
      ctx.restore();

      (anim.vortexParticles || []).forEach(p => {
        p.angle += p.speed + progress * 0.15;
        p.radius = Math.max(0, p.radius - 0.7);
        const px = anim.x + Math.cos(p.angle) * p.radius;
        const py = anim.y + Math.sin(p.angle) * p.radius + (p.yOffset || 0);

        ctx.fillStyle = `rgba(200, 240, 255, ${1 - progress * 0.5})`;
        ctx.shadowColor = '#00BFFF';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      if (anim.ticks >= 45) {
        anim.shattered = true;
        if (anim.piece) anim.piece.isSummoning = false;

        anim.shards = anim.shards || [];
        for (let k = 0; k < 25; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 3;
          anim.shards.push({ x: anim.x, y: anim.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, alpha: 1, size: Math.random() * 5 + 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.5 });
        }

        gameState.shockwaves = gameState.shockwaves || [];
        gameState.shockwaves.push({ x: anim.x, y: anim.y, radius: 5, life: 1, color: '0, 191, 255' });
      }
    } else {
      for (let k = anim.shards.length - 1; k >= 0; k--) {
        const shard = anim.shards[k];
        shard.x += shard.vx; shard.y += shard.vy; shard.vy += 0.3; shard.rot += shard.vrot; shard.alpha -= 0.04;
        if (shard.alpha <= 0) { anim.shards.splice(k, 1); continue; }

        ctx.save(); ctx.translate(shard.x, shard.y); ctx.rotate(shard.rot);
        ctx.fillStyle = `rgba(150, 230, 255, ${shard.alpha})`;
        ctx.beginPath(); ctx.moveTo(0, -shard.size); ctx.lineTo(shard.size / 2, shard.size); ctx.lineTo(-shard.size / 2, shard.size); ctx.fill(); ctx.restore();
      }

      if (anim.shards.length === 0) {
        gameState.wispAnimations.splice(i, 1);
      }
    }
  }
}

export function spawnGlacialWallEffect(targetRow, targetCol, gameState) {
  gameState.wallAnimations = gameState.wallAnimations || [];
  const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  const spikes = [];
  const numSpikes = Math.floor(Math.random() * 2) + 3;
  for (let i = 0; i < numSpikes; i++) {
    spikes.push({ height: C.CELL_SIZE * (0.6 + Math.random() * 0.4), width: C.CELL_SIZE * (0.3 + Math.random() * 0.2), offsetX: (Math.random() - 0.5) * (C.CELL_SIZE * 0.6), tilt: (Math.random() - 0.5) * 0.3 });
  }

  const mist = [];
  for (let i = 0; i < 20; i++) {
    mist.push({ x: targetX, y: targetY + C.CELL_SIZE / 2, vx: (Math.random() - 0.5) * 8, vy: -(Math.random() * 2 + 1), alpha: 1, size: Math.random() * 4 + 2 });
  }

  gameState.wallAnimations.push({ x: targetX, y: targetY, ticks: 0, spikes, mist });
}

export function drawGlacialWallAnimations(ctx, gameState) {
  if (!gameState.wallAnimations) return;

  for (let i = gameState.wallAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.wallAnimations[i];

    // Low-detail: simplify wall visuals to reduce per-frame work
    if (gameState.lowDetail && !anim.isShatter) {
      anim.ticks++;
      // draw a simple translucent rectangle representing the wall
      ctx.fillStyle = `rgba(180, 230, 255, ${Math.min(0.6, anim.ticks / 40)})`;
      ctx.fillRect(anim.x - C.CELL_SIZE * 0.5, anim.y - C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
      if (anim.ticks > 60) gameState.wallAnimations.splice(i, 1);
      continue;
    }

    if (anim.isShatter) {
      for (let k = anim.shards.length - 1; k >= 0; k--) {
        const s = anim.shards[k];
        s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.04;
        if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; }

        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.fillStyle = `rgba(150, 230, 255, ${s.alpha})`;
        ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size / 2, s.size); ctx.lineTo(-s.size / 2, s.size); ctx.fill(); ctx.restore();
      }

      if (anim.shards.length === 0) gameState.wallAnimations.splice(i, 1);
    } else {
      anim.ticks++; const eruptDuration = 15; const mistDuration = 40;
      if (anim.ticks <= mistDuration) {
        const progress = Math.min(anim.ticks / eruptDuration, 1);
        const easeOutBounce = 1 - Math.pow(1 - progress, 3);
        ctx.save(); ctx.translate(anim.x, anim.y);
        anim.spikes.forEach(spike => {
          ctx.save(); ctx.translate(spike.offsetX, C.CELL_SIZE / 2); ctx.rotate(spike.tilt);
          ctx.fillStyle = `rgba(150, 220, 255, ${progress})`;
          ctx.strokeStyle = `rgba(200, 255, 255, ${progress})`; ctx.lineWidth = 2; ctx.shadowColor = '#00BFFF'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(-spike.width / 2, 0); ctx.lineTo(0, -spike.height * easeOutBounce); ctx.lineTo(spike.width / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        });
        ctx.restore();
      }

      if (anim.ticks <= mistDuration) {
        anim.mist.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.alpha -= 0.025; if (p.alpha > 0) { ctx.fillStyle = `rgba(200, 240, 255, ${Math.max(0, p.alpha)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } });
      } else {
        gameState.wallAnimations.splice(i, 1);
      }
    }
  }
}

export function spawnWallShatterEffect(row, col, gameState) {
  gameState.wallAnimations = gameState.wallAnimations || [];
  const shards = [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    shards.push({ x: targetX, y: targetY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, alpha: 1, size: Math.random() * 6 + 3, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.5 });
  }
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: 15, life: 1, color: '0, 191, 255' });
  gameState.wallAnimations.push({ isShatter: true, shards });
}

export function spawnTrapDeploymentEffect(sourceRow, sourceCol, targetRow, targetCol, gameState) {
  gameState.trapDeployments = gameState.trapDeployments || [];
  const startX = sourceCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = sourceRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  gameState.trapDeployments.push({ x: startX, y: startY, targetX: endX, targetY: endY, progress: 0, fissures: [], impacted: false });
}

export function drawTrapDeployments(ctx, gameState) {
  if (!gameState.trapDeployments) return;
  for (let i = gameState.trapDeployments.length - 1; i >= 0; i--) {
    const anim = gameState.trapDeployments[i]; anim.progress += 0.05;
    if (!anim.impacted) anim.fissures.push({ x: anim.x, y: anim.y, alpha: 1 });
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'; ctx.lineWidth = 2; ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10; ctx.beginPath();
    for (let j = 0; j < anim.fissures.length; j++) {
      const f = anim.fissures[j]; f.alpha -= 0.05; if (f.alpha > 0) { if (j === 0) ctx.moveTo(f.x, f.y); else ctx.lineTo(f.x + (Math.random() - 0.5) * 5, f.y + (Math.random() - 0.5) * 5); }
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    if (anim.progress >= 1 && !anim.impacted) {
      anim.impacted = true; gameState.shockwaves = gameState.shockwaves || []; gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 10, life: 1, color: '0, 255, 255' });
      for (let k = 0; k < 15; k++) gameState.battleParticles.push({ x: anim.targetX, y: anim.targetY, vx: (Math.random() - 0.5) * 4, vy: -(Math.random() * 3), alpha: 1, radius: Math.random() * 3 + 2, color: '200, 255, 255' });
    }
    if (!anim.impacted) {
      anim.x += (anim.targetX - anim.x) * 0.15; anim.y += (anim.targetY - anim.y) * 0.15;
      ctx.save(); ctx.translate(anim.x, anim.y); ctx.rotate(anim.progress * 20); ctx.fillStyle = '#00FFFF'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 0); ctx.lineTo(0, 10); ctx.lineTo(-10, 0); ctx.fill(); ctx.restore();
    } else if (anim.fissures.every(f => f.alpha <= 0)) { gameState.trapDeployments.splice(i, 1); }
  }
}

export function spawnTrapTriggerEffect(row, col, piece, gameState) {
  gameState.trapTriggers = gameState.trapTriggers || [];
  gameState.trapTriggers.push({ piece, pieceId: piece?.id, lastRow: row, lastCol: col, ticks: 0, shattering: false, shards: [] });
}

export function drawTrapTriggerAnimations(ctx, gameState) {
  if (!gameState.trapTriggers) return;
  for (let i = gameState.trapTriggers.length - 1; i >= 0; i--) {
    const anim = gameState.trapTriggers[i]; anim.ticks++;
    const alivePiece = gameState.pieces.find(p => p.id === anim.pieceId);
    let px, py;
    if (alivePiece) { px = alivePiece.col * C.CELL_SIZE + C.CELL_SIZE / 2; py = alivePiece.row * C.CELL_SIZE + C.CELL_SIZE / 2; anim.lastRow = alivePiece.row; anim.lastCol = alivePiece.col; }
    else { px = anim.lastCol * C.CELL_SIZE + C.CELL_SIZE / 2; py = anim.lastRow * C.CELL_SIZE + C.CELL_SIZE / 2; if (!anim.shattering) { anim.shattering = true; for (let k = 0; k < 12; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 5 + 2; anim.shards.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, alpha: 1, size: Math.random() * 4 + 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.5 }); } } }

    if (!anim.shattering && (!anim.piece.stuck || anim.piece.stuck <= 0)) {
      anim.shattering = true;
      for (let k = 0; k < 12; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 5 + 2; anim.shards.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, alpha: 1, size: Math.random() * 4 + 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.5 }); }
    }

    if (anim.shattering) {
      for (let k = anim.shards.length - 1; k >= 0; k--) { const s = anim.shards[k]; s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.05; if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; } ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = `rgba(150, 240, 255, ${s.alpha})`; ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size); ctx.restore(); }
      if (anim.shards.length === 0) gameState.trapTriggers.splice(i, 1);
    } else {
      const progress = Math.min(anim.ticks / 15, 1);
      ctx.save(); ctx.translate(px, py);
      ctx.strokeStyle = `rgba(150, 240, 255, 1)`; ctx.fillStyle = `rgba(200, 255, 255, 1)`; ctx.lineWidth = 2; ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10;
      for (let j = 0; j < 6; j++) { const angle = (j * Math.PI) / 3 + (anim.ticks * 0.01); const dist = C.CELL_SIZE * 0.8 - (C.CELL_SIZE * 0.5 * progress); ctx.save(); ctx.rotate(angle); ctx.translate(dist, 0); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-20, 0); ctx.lineTo(0, 5); ctx.fill(); ctx.stroke(); ctx.restore(); }
      if (progress === 1) { ctx.strokeStyle = `rgba(0, 200, 220, 0.6)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, C.CELL_SIZE * 0.35, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  }
}

export function spawnFrigidPathEffect(sourceRow, sourceCol, targetRow, targetCol, gameState) {
  gameState.iceBeamAnimations = gameState.iceBeamAnimations || [];
  const startX = sourceCol * C.CELL_SIZE + C.CELL_SIZE / 2; const startY = sourceRow * C.CELL_SIZE + C.CELL_SIZE / 2; const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2; const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  // Keep the beam animation reasonably short to avoid lingering visual load
  // cap max ticks sensibly and pre-allocate a small particles array. Keep maxTicks tunable.
  gameState.iceBeamAnimations.push({ startX, startY, targetX, targetY, ticks: 0, maxTicks: 24, beamProgress: 0, spreadProgress: 0, particles: [] });
}

export function drawFrigidPathAnimations(ctx, gameState) {
  if (!gameState.iceBeamAnimations) return;
  for (let i = gameState.iceBeamAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.iceBeamAnimations[i]; anim.ticks++;
    // Low-detail: draw a thin, cheap line and fast-forward ticks to expire sooner
    if (gameState.lowDetail) {
      const fade = 1 - Math.min((anim.ticks - 1) / anim.maxTicks, 1);
      ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(180, 220, 255, ${0.5 * fade})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(anim.startX, anim.startY); ctx.lineTo(anim.targetX, anim.targetY); ctx.stroke();
      anim.ticks += 2; // speed up lifecycle under low detail
      if (anim.ticks >= anim.maxTicks) gameState.iceBeamAnimations.splice(i, 1);
      continue;
    }
    if (anim.ticks <= 10) {
      anim.beamProgress = anim.ticks / 12;
      const currentX = anim.startX + (anim.targetX - anim.startX) * anim.beamProgress;
      const currentY = anim.startY + (anim.targetY - anim.startY) * anim.beamProgress;
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0, 220, 255, 0.6)'; ctx.lineWidth = 10; ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(anim.startX, anim.startY); ctx.lineTo(currentX, currentY); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(anim.startX, anim.startY); ctx.lineTo(currentX, currentY); ctx.stroke(); ctx.shadowBlur = 0;
      // fewer particles for performance, cap particle buffer
      if (Math.random() < 0.45 && anim.particles.length < 28) anim.particles.push({ x: currentX + (Math.random() - 0.5) * 16, y: currentY + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, alpha: 1, size: Math.random() * 2 + 1 });
    } else {
      anim.spreadProgress = Math.min((anim.ticks - 10) / 14, 1); const fade = 1 - Math.min((anim.ticks - 10) / 20, 1);
      ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(150, 220, 255, ${fade * 0.7})`; ctx.lineWidth = 8 * fade; ctx.beginPath(); ctx.moveTo(anim.startX, anim.startY); ctx.lineTo(anim.targetX, anim.targetY); ctx.stroke();
      const spreadDist = (C.CELL_SIZE * 1.2) * anim.spreadProgress;
      // lighter fill rectangle with less shadow work
      ctx.fillStyle = `rgba(120, 210, 255, ${fade * 0.45})`; ctx.fillRect(anim.targetX - spreadDist, anim.targetY - C.CELL_SIZE / 2, spreadDist * 2, C.CELL_SIZE);
      if (anim.spreadProgress < 1 && anim.ticks % 3 === 0) {
        // fewer, slower particles
        if (anim.particles.length < 40) {
          anim.particles.push({ x: anim.targetX - spreadDist * 0.6, y: anim.targetY + (Math.random() - 0.5) * C.CELL_SIZE, vx: -1.6, vy: (Math.random() - 0.5) * 1.0, alpha: 1, size: Math.random() * 3 + 1 });
          anim.particles.push({ x: anim.targetX + spreadDist * 0.6, y: anim.targetY + (Math.random() - 0.5) * C.CELL_SIZE, vx: 1.6, vy: (Math.random() - 0.5) * 1.0, alpha: 1, size: Math.random() * 3 + 1 });
        }
        if (anim.ticks === 13) { gameState.shockwaves = gameState.shockwaves || []; gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 20, life: 1, color: '0, 255, 255' }); }
      }
    }
    for (let k = anim.particles.length - 1; k >= 0; k--) { const p = anim.particles[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.alpha -= 0.05; if (p.alpha <= 0) { anim.particles.splice(k, 1); continue; } ctx.fillStyle = `rgba(200, 255, 255, ${p.alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    if (anim.ticks >= anim.maxTicks && anim.particles.length === 0) gameState.iceBeamAnimations.splice(i, 1);
  }
}

export function spawnLavaGlobEffect(sourceRow, sourceCol, targetRow, targetCol, gameState) {
  gameState.lavaAnimations = gameState.lavaAnimations || [];
  const startX = sourceCol * C.CELL_SIZE + C.CELL_SIZE / 2; const startY = sourceRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2; const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.lavaAnimations.push({ startX, startY, targetX, targetY, x: startX, y: startY, ticks: 0, maxTicks: 30, trail: [], shards: [], splatters: [], impacted: false });
}

export function drawLavaGlobAnimations(ctx, gameState) {
  if (!gameState.lavaAnimations) return;
  for (let i = gameState.lavaAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.lavaAnimations[i]; anim.ticks++;
    if (!anim.impacted) {
      const progress = anim.ticks / anim.maxTicks; const arcHeight = 60; const zOffset = Math.sin(progress * Math.PI) * arcHeight;
      anim.x = anim.startX + (anim.targetX - anim.startX) * progress; anim.y = anim.startY + (anim.targetY - anim.startY) * progress - zOffset;
      // In low-detail mode avoid trail particles and heavy shadow drawing
      if (!gameState.lowDetail) {
        if (anim.ticks % 2 === 0) anim.trail.push({ x: anim.x + (Math.random() - 0.5) * 10, y: anim.y + (Math.random() - 0.5) * 10, size: Math.random() * 4 + 2, alpha: 1 });
        anim.trail.forEach(t => { t.alpha -= 0.05; t.y += 0.5; if (t.alpha > 0) { ctx.fillStyle = `rgba(255, 80, 0, ${t.alpha})`; ctx.shadowColor = 'rgba(255, 0, 0, 0.8)'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2); ctx.fill(); } }); ctx.shadowBlur = 0;
        ctx.save(); ctx.translate(anim.x, anim.y); ctx.rotate(anim.ticks * 0.2); ctx.fillStyle = '#222222'; ctx.strokeStyle = '#FF4500'; ctx.lineWidth = 3; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(6, -12); ctx.lineTo(12, 0); ctx.lineTo(8, 10); ctx.lineTo(-6, 12); ctx.lineTo(-12, 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      } else {
        // light representation in low detail
        ctx.save(); ctx.translate(anim.x, anim.y); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (anim.ticks >= anim.maxTicks) {
        anim.impacted = true;
        for (let k = 0; k < 12; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 3; anim.shards.push({ x: anim.targetX, y: anim.targetY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.4, size: Math.random() * 6 + 3, alpha: 1 }); }
        for (let k = 0; k < 10; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 3 + 1; anim.splatters.push({ x: anim.targetX, y: anim.targetY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 8 + 4, alpha: 1 }); }
        gameState.shockwaves = gameState.shockwaves || []; gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 15, life: 1, color: '255, 69, 0' });
      }
    } else {
      for (let k = anim.shards.length - 1; k >= 0; k--) { const s = anim.shards[k]; s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.03; if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; } ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = `rgba(30, 30, 30, ${s.alpha})`; ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size / 2, s.size); ctx.lineTo(-s.size / 2, s.size); ctx.fill(); ctx.restore(); }
      for (let k = anim.splatters.length - 1; k >= 0; k--) { const splat = anim.splatters[k]; splat.x += splat.vx; splat.y += splat.vy; splat.vx *= 0.85; splat.vy *= 0.85; splat.size += 0.2; splat.alpha -= 0.02; if (splat.alpha <= 0) { anim.splatters.splice(k, 1); continue; } ctx.fillStyle = `rgba(255, 69, 0, ${splat.alpha})`; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 10 * splat.alpha; ctx.beginPath(); ctx.arc(splat.x, splat.y, splat.size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
      if (anim.shards.length === 0 && anim.splatters.length === 0) { gameState.lavaAnimations.splice(i, 1); }
    }
  }
}

export function spawnScorchedRetreatEffect(piece, oldRow, oldCol, newRow, newCol, gameState) {
  gameState.retreatAnimations = gameState.retreatAnimations || [];
  piece.isRetreating = true;
  const startX = oldCol * C.CELL_SIZE + C.CELL_SIZE / 2; const startY = oldRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endX = newCol * C.CELL_SIZE + C.CELL_SIZE / 2; const endY = newRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  gameState.retreatAnimations.push({ piece, x: startX, y: startY, targetX: endX, targetY: endY, progress: 0, ghosts: [], particles: [] });
}

export function drawScorchedRetreatAnimations(ctx, gameState, images) {
  if (!gameState.retreatAnimations) return;
  for (let i = gameState.retreatAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.retreatAnimations[i];
    anim.progress += 0.05;

    const jumpHeight = 40;
    const currentX = anim.x + (anim.targetX - anim.x) * anim.progress;
    const arcY = Math.sin(anim.progress * Math.PI) * jumpHeight;
    const currentY = anim.y + (anim.targetY - anim.y) * anim.progress - arcY;

    if (anim.progress < 1 && anim.ghosts.length < 4 && anim.progress * 10 % 2 < 0.1) {
      anim.ghosts.push({ x: currentX, y: currentY, alpha: 0.6 });
    }

    anim.ghosts.forEach((g, idx) => {
      g.alpha -= 0.02;
      if (g.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = g.alpha * 0.6; // Simpler, faster alpha instead of heavy filter

        // FIX: Use .key instead of .type, and CELL_SIZE instead of undefined PIECE_SIZE
        const img = images[anim.piece.key];
        if (img) ctx.drawImage(img, g.x - C.CELL_SIZE / 2, g.y - C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        ctx.restore();
      }
    });

    if (anim.progress < 1) {
      for (let j = 0; j < 3; j++) {
        const angle = (anim.progress * 10) + (j * Math.PI * 0.6);
        anim.particles.push({ x: currentX + Math.cos(angle) * 15, y: currentY + Math.sin(angle) * 15, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, alpha: 1, size: Math.random() * 3 + 1 });
      }
    }

    anim.particles.forEach((p, pIdx) => {
      p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
      if (p.alpha > 0) {
        ctx.fillStyle = `rgba(255, 120, 0, ${p.alpha})`;
        ctx.shadowColor = 'orange';
        ctx.shadowBlur = gameState.lowDetail ? 0 : 5; // Disable shadows on low-detail
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        anim.particles.splice(pIdx, 1);
      }
    });

    if (anim.progress >= 1) {
      anim.piece.isRetreating = false;
      if (anim.ghosts.every(g => g.alpha <= 0) && anim.particles.length === 0) {
        gameState.retreatAnimations.splice(i, 1);
      }
    }
  }
}
export function spawnPummelKnockbackEffect(piece, attackerRow, attackerCol, oldRow, oldCol, newRow, newCol, gameState) {
  gameState.knockbackAnimations = gameState.knockbackAnimations || [];
  piece.isAnimating = true; // Tell the UI to hide the static piece

  const startX = oldCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = oldRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetX = newCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = newRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  // Spawn a massive shockwave exactly between the Yeti's fist and the target
  const impactX = (attackerCol * C.CELL_SIZE + C.CELL_SIZE / 2 + startX) / 2;
  const impactY = (attackerRow * C.CELL_SIZE + C.CELL_SIZE / 2 + startY) / 2;

  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: impactX, y: impactY, radius: 25, life: 1, color: '255, 255, 255' });

  gameState.knockbackAnimations.push({
    piece,
    // store the piece key separately so we can still draw the image
    // even after we null out `piece` during cleanup
    pieceKey: piece && piece.key,
    x: startX, y: startY,
    targetX, targetY,
    progress: 0,
    dust: []
  });

}

export function drawPummelKnockbackAnimations(ctx, gameState) {
  if (!gameState.knockbackAnimations) return;

  for (let i = gameState.knockbackAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.knockbackAnimations[i];
    anim.progress += 0.1; // Fast push! (10 frames)

    const currentX = anim.x + (anim.targetX - anim.x) * anim.progress;
    const currentY = anim.y + (anim.targetY - anim.y) * anim.progress;

    // 1. Spawn friction dust trailing from their feet
    if (anim.progress < 1) {
      anim.dust.push({
        x: currentX + (Math.random() - 0.5) * 20,
        y: currentY + C.CELL_SIZE / 3, // Ground level
        vx: (anim.x - anim.targetX) * 0.05 + (Math.random() - 0.5) * 2, // Blow dust backward
        vy: (anim.y - anim.targetY) * 0.05 + (Math.random() - 0.5) * 2,
        alpha: 1,
        size: Math.random() * 5 + 2
      });
    }

    // 2. Draw the dust
    anim.dust.forEach((d, dIdx) => {
      d.x += d.vx; d.y += d.vy; d.alpha -= 0.05;
      if (d.alpha > 0) {
        ctx.fillStyle = `rgba(200, 200, 200, ${d.alpha})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
      } else {
        anim.dust.splice(dIdx, 1);
      }
    });

    // 3. Draw the sliding piece (with a helpless tilt!)
    // Draw the piece both while it's sliding (progress < 1) and continue drawing it at
    // the final location after impact until the dust clears. This prevents a brief
    // disappearance where the UI hides the static piece during the animation.
    if (anim.progress < 1) {
      // Find the image source safely. Use stored pieceKey as a fallback because
      // we may null out `anim.piece` during the impact cleanup while dust lingers.
      const imgKey = (anim.piece && anim.piece.key) || anim.pieceKey;
      // Depending on how your images are stored globally:
      const img = imgKey && (document.getElementById(imgKey) || (gameState.images && gameState.images[imgKey]));
      if (img) {
        ctx.save();
        ctx.translate(currentX, currentY);
        // Tilt away from the direction of travel
        const dx = anim.targetX - anim.x;
        const tilt = (dx > 0) ? -0.2 : (dx < 0) ? 0.2 : 0;
        ctx.rotate(tilt);
        ctx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        ctx.restore();
      }
    } else {
      // Impact phase: still draw the piece at the final location while dust/particles exist
      const imgKey = (anim.piece && anim.piece.key) || anim.pieceKey;
      const img = imgKey && (document.getElementById(imgKey) || (gameState.images && gameState.images[imgKey]));
      if (img) {
        ctx.save();
        ctx.translate(anim.targetX, anim.targetY);
        ctx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        ctx.restore();
      }

      // 4. Clean up once the dust settles
      if (anim.dust.length === 0) {
        if (anim.piece) anim.piece.isAnimating = false; // Backup release
        gameState.knockbackAnimations.splice(i, 1);
      } else if (anim.progress >= 1 && anim.piece) {
        // FIX: Re-enable the static UI rendering immediately upon impact 
        // while the dust particles continue to fade out.
        anim.piece.isAnimating = false;
        anim.piece = null; // Unlink the piece so we don't modify it again
      }
    }
  }
}

export function spawnVentEffect(row, col, team, gameState) {
  gameState.ventAnimations = gameState.ventAnimations || [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.ventAnimations.push({
    x: targetX,
    y: targetY,
    ticks: 0,
    color: team === 'snow' ? '0, 204, 255' : '255, 80, 20',
    particles: []
  });
}

export function drawVentAnimations(ctx, gameState) {
  if (!gameState.ventAnimations) return;
  for (let i = gameState.ventAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.ventAnimations[i];
    anim.ticks++;

    // Energy Pillar
    const alpha = Math.max(0, 1 - anim.ticks / 30);
    ctx.fillStyle = `rgba(${anim.color}, ${alpha * 0.5})`;
    ctx.fillRect(anim.x - 10, anim.y - (anim.ticks * 5), 20, anim.ticks * 5);

    // Rising Sparks
    if (anim.ticks < 20) {
      anim.particles.push({
        x: anim.x + (Math.random() - 0.5) * 30,
        y: anim.y,
        vy: -Math.random() * 8 - 2,
        life: 1.0
      });
    }

    anim.particles.forEach((p, idx) => {
      p.y += p.vy; p.life -= 0.04;
      if (p.life > 0) {
        ctx.fillStyle = `rgba(${anim.color}, ${p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      } else { anim.particles.splice(idx, 1); }
    });

    if (anim.ticks > 30 && anim.particles.length === 0) gameState.ventAnimations.splice(i, 1);
  }
}

export function spawnGlacialFractureEffect(row, col, gameState) {
  gameState.glacialFractureAnimations = gameState.glacialFractureAnimations || [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;

  const shards = [];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4;
    shards.push({
      x: targetX,
      y: targetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      size: Math.random() * 8 + 4,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4
    });
  }
  
  gameState.glacialFractureAnimations.push({
    x: targetX,
    y: targetY,
    ticks: 0,
    maxTicks: 45,
    shards
  });

  // Also add a shockwave
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: C.CELL_SIZE * 2, life: 1, color: '0, 255, 255' });
}

export function drawGlacialFractureAnimations(ctx, gameState) {
  if (!gameState.glacialFractureAnimations) return;

  for (let i = gameState.glacialFractureAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.glacialFractureAnimations[i];
    anim.ticks++;

    // Draw the "frosted glass territory overlay" blooming effect
    const progress = Math.min(anim.ticks / 20, 1);
    ctx.save();
    ctx.translate(anim.x, anim.y);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, C.CELL_SIZE * 2);
    grad.addColorStop(0, `rgba(180, 240, 255, ${0.4 * (1 - progress)})`);
    grad.addColorStop(1, 'rgba(180, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, C.CELL_SIZE * 2, 0, Math.PI * 2);
    ctx.fill();

    // Cyan step-flickering borders
    if (progress < 1) {
      ctx.strokeStyle = `rgba(0, 255, 255, ${Math.random() * 0.8 + 0.2})`;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.strokeRect(-C.CELL_SIZE * 2, -C.CELL_SIZE * 2, C.CELL_SIZE * 4, C.CELL_SIZE * 4);
    }
    ctx.restore();

    // Flying shards
    for (let k = anim.shards.length - 1; k >= 0; k--) {
      const s = anim.shards[k];
      s.x += s.vx; s.y += s.vy; s.vx *= 0.9; s.vy *= 0.9; s.rot += s.vrot; s.alpha -= 0.03;
      if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; }
      
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = `rgba(100, 220, 255, ${s.alpha})`;
      ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size / 2, s.size); ctx.lineTo(-s.size / 2, s.size); ctx.fill();
      ctx.restore();
    }

    if (anim.ticks >= anim.maxTicks && anim.shards.length === 0) {
      gameState.glacialFractureAnimations.splice(i, 1);
    }
  }
}

export function spawnAColdFarewellEffect(row, col, gameState) {
  gameState.aColdFarewellAnimations = gameState.aColdFarewellAnimations || [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;

  const blastParticles = [];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 10 + 2;
    blastParticles.push({
      x: targetX, y: targetY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      alpha: 1,
      size: Math.random() * 5 + 2
    });
  }

  gameState.aColdFarewellAnimations.push({
    x: targetX,
    y: targetY,
    ticks: 0,
    maxTicks: 50,
    blastParticles
  });

  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: C.CELL_SIZE * 1.5, life: 1, color: '150, 255, 200' });
}

export function drawAColdFarewellAnimations(ctx, gameState) {
  if (!gameState.aColdFarewellAnimations) return;

  for (let i = gameState.aColdFarewellAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.aColdFarewellAnimations[i];
    anim.ticks++;

    // Initial blast mist
    const mistProgress = Math.min(anim.ticks / 15, 1);
    if (mistProgress < 1) {
      ctx.save();
      ctx.translate(anim.x, anim.y);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, C.CELL_SIZE * 1.5);
      grad.addColorStop(0, `rgba(150, 255, 200, ${0.8 * (1 - mistProgress)})`);
      grad.addColorStop(1, 'rgba(150, 255, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, C.CELL_SIZE * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Blast particles
    for (let k = anim.blastParticles.length - 1; k >= 0; k--) {
      const p = anim.blastParticles[k];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.85; p.vy *= 0.85; p.alpha -= 0.02;
      if (p.alpha <= 0) { anim.blastParticles.splice(k, 1); continue; }
      
      ctx.fillStyle = `rgba(150, 255, 200, ${p.alpha})`;
      ctx.shadowColor = '#96ffc8';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (anim.ticks >= anim.maxTicks && anim.blastParticles.length === 0) {
      gameState.aColdFarewellAnimations.splice(i, 1);
    }
  }
}

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
      gameState.frostVignette.life += 1;
      const progress = gameState.frostVignette.life / gameState.frostVignette.maxLife;
      
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
      const grad = ctx.createRadialGradient(w/2, h/2, w * innerRadiusMod * 0.5, w/2, h/2, w * 0.8);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.3, `rgba(220, 250, 255, ${alpha * 0.3})`); // Bright mist creeping close to center
      grad.addColorStop(0.6, `rgba(100, 180, 240, ${alpha * 0.65})`); // Rich frosty blue
      grad.addColorStop(0.85, `rgba(20, 40, 70, ${alpha * 0.85})`);   // Deep cold shadows
      grad.addColorStop(1, `rgba(5, 10, 15, ${alpha * 1.0})`);        // Absolute black frost at edges
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Draw procedural frost spikes creeping in (Optimized for performance)
      ctx.save();
      ctx.translate(w/2, h/2);
      
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
                  ctx.lineTo(branchStart - Math.cos(ba)*currentLength*0.4, -Math.sin(ba)*currentLength*0.4);
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
          for(let j=0; j<25; j++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 8 + 4;
              gameState.battleParticles.push({
                  x: targetX + Math.cos(angle) * (radiusPx * 0.8),
                  y: targetY + Math.sin(angle) * (radiusPx * 0.8), 
                  vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, 
                  alpha: 1, radius: Math.random()*3+2, color: '150,220,255'
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
        switch(j % 4) {
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
        switch(i % 4) {
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

      // Spawn 1-2 flakes per frame per active blessing
      const numToSpawn = Math.floor(Math.random() * 2) + 1;
      
      for (let i = 0; i < numToSpawn; i++) {
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
              s.shatterOffsets = Array.from({length: 4}, () => ({
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
                // Rotating star shines for allies
                // Lower baseline alpha for subtler effect
                const starAlpha = s.alpha * 0.5;
                ctx.fillStyle = `rgba(${s.hitColor}, ${starAlpha})`;
                ctx.save();
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
        // Falling snow
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; // Pure white
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8; // More glow
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    ctx.restore();
  }
}

export function spawnFateLinkCast(src, dst, gameState) {
  if (!gameState.fateLinkAnimations) gameState.fateLinkAnimations = [];
  if (!src || !dst) return;
  
  const sx = src.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const sy = src.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dx = dst.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dy = dst.row * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.fateLinkAnimations.push({ sx, sy, dx, dy, ticks: 0, maxTicks: 40 });
}

export function drawFateLinkAnimations(ctx, gameState) {
  if (!gameState.fateLinkAnimations) return;
  for (let i = gameState.fateLinkAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.fateLinkAnimations[i];
    anim.ticks++;

    const progress = Math.min(anim.ticks / 15, 1);
    const alpha = (anim.maxTicks - anim.ticks) / 25;
    if (alpha <= 0) {
      gameState.fateLinkAnimations.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.strokeStyle = `rgba(211, 211, 211, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -anim.ticks;
    
    ctx.beginPath();
    ctx.moveTo(anim.sx, anim.sy);
    ctx.lineTo(anim.sx + (anim.dx - anim.sx) * progress, anim.sy + (anim.dy - anim.sy) * progress);
    ctx.stroke();
    ctx.restore();
  }
}
// === HELP FROM ABOVE VISUALS ===

export function spawnGuardianSaveEffect(piece, gameState) {
  if (!piece) return;
  gameState.guardianAnimations = gameState.guardianAnimations || [];
  gameState.guardianAnimations.push({
      x: piece.col * C.CELL_SIZE + C.CELL_SIZE / 2,
      y: piece.row * C.CELL_SIZE + C.CELL_SIZE / 2,
      life: 1.0,
      scale: 0.5,
      shards: []
  });
}

const WOLF_PATH = new Path2D(
  "M-16.7,-38.3 C-15.3,-26.7 -10,-18.3 -5,-13.3 C-3.3,-15 -1.7,-25 3.3,-35 C6.7,-26.7 10,-20 13.3,-16.7 C23.3,-13.3 35,-6.7 45,5 C43.3,10 40,11.7 35,11.7 C30,11.7 26.7,10 21.7,8.3 C23.3,13.3 25,18.3 21.7,21.7 C16.7,25 10,23.3 5,26.7 C1.7,31.7 -1.7,36.7 -8.3,40 C-18.3,38.3 -26.7,33.3 -33.3,25 C-38.3,15 -41.7,5 -40,-5 C-38.3,-15 -35,-23.3 -28.3,-30 C-25,-33.3 -21.7,-36.7 -16.7,-38.3 Z"
);

export function drawGuardianSaveAnimations(ctx, gameState) {
  if (!gameState.guardianAnimations) return;
  for (let i = gameState.guardianAnimations.length - 1; i >= 0; i--) {
      const anim = gameState.guardianAnimations[i];
      anim.life -= 0.015;
      
      // Expand quickly, then hold, then shatter
      if (anim.life > 0.8) {
          anim.scale += 0.15;
      }
      
      if (anim.life <= 0 && anim.shards.length === 0) {
          // Shatter
          for(let k=0; k<25; k++) {
              anim.shards.push({
                  x: anim.x + (Math.random()-0.5)*100,
                  y: anim.y + (Math.random()-0.5)*100,
                  vx: (Math.random()-0.5)*4,
                  vy: (Math.random()-0.5)*4,
                  life: 1.0,
                  size: Math.random()*4 + 2
              });
          }
      }
      
      if (anim.shards.length === 0) {
          // Draw Wolf Spirit
          ctx.save();
          ctx.translate(anim.x, anim.y);
          ctx.scale(anim.scale, anim.scale);
          ctx.globalAlpha = Math.min(1.0, anim.life * 1.5);
          
          // Ethereal glow
          ctx.shadowColor = 'rgba(150, 220, 255, 0.8)';
          ctx.shadowBlur = 20;
          ctx.fillStyle = 'rgba(40, 100, 150, 0.6)';
          ctx.fill(WOLF_PATH);
          
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(200, 240, 255, 0.9)';
          ctx.stroke(WOLF_PATH);
          ctx.restore();
      } else {
          // Draw shards
          let allDead = true;
          anim.shards.forEach(s => {
              s.x += s.vx;
              s.y += s.vy;
              s.life -= 0.05;
              if (s.life > 0) {
                  allDead = false;
                  ctx.fillStyle = `rgba(150, 220, 255, ${s.life})`;
                  ctx.fillRect(s.x, s.y, s.size, s.size);
              }
          });
          if (allDead) {
              gameState.guardianAnimations.splice(i, 1);
          }
      }
  }
}

let _darkFogCache = null;

export function drawHelpFromAboveFog(ctx, gameState) {
  if (!gameState.pieces) return;
  const frostLords = gameState.pieces.filter(p => p.hasHelpFromAboveActive);
  if (frostLords.length === 0) return;

  if (!_darkFogCache) {
      _darkFogCache = document.createElement('canvas');
      const size = C.CELL_SIZE * 6;
      _darkFogCache.width = size;
      _darkFogCache.height = size;
      const fctx = _darkFogCache.getContext('2d');
      const cx = size / 2;
      const cy = size / 2;
      
      // Icy cold smoke base
      const grad = fctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
      grad.addColorStop(0, 'rgba(180, 230, 255, 0.05)');
      grad.addColorStop(0.4, 'rgba(100, 160, 220, 0.15)');
      grad.addColorStop(0.7, 'rgba(40, 80, 130, 0.4)');
      grad.addColorStop(1, 'rgba(10, 20, 40, 0)');
      fctx.fillStyle = grad;
      fctx.fillRect(0, 0, size, size);

      // Create dense, fluffy smoke clouds
      for(let i=0; i<15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * cx * 0.7;
          const offsetX = cx + Math.cos(angle) * dist;
          const offsetY = cy + Math.sin(angle) * dist;
          const cloudRadius = Math.random() * cx * 0.5 + cx * 0.2;
          
          const rGrad = fctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, cloudRadius);
          // Light, dense icy mist
          rGrad.addColorStop(0, `rgba(220, 240, 255, ${Math.random() * 0.15 + 0.1})`);
          rGrad.addColorStop(0.5, `rgba(120, 180, 230, ${Math.random() * 0.2 + 0.05})`);
          rGrad.addColorStop(1, 'rgba(60, 100, 150, 0)');
          fctx.fillStyle = rGrad;
          fctx.beginPath();
          fctx.arc(offsetX, offsetY, cloudRadius, 0, Math.PI * 2);
          fctx.fill();
      }
  }

  const time = performance.now() * 0.0004;
  frostLords.forEach(p => {
      const px = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
      const py = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
      
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      
      // Draw 4 layers of slowly rotating, shifting icy smoke
      for(let i=0; i<4; i++) {
          const driftAngle = time * 0.5 + i * (Math.PI / 2);
          const driftX = Math.cos(driftAngle) * (C.CELL_SIZE * 0.4);
          const driftY = Math.sin(driftAngle) * (C.CELL_SIZE * 0.4);
          
          ctx.save();
          ctx.translate(px + driftX, py + driftY);
          // Alternating slow rotations to make it look like swirling smoke
          ctx.rotate(time * (i % 2 === 0 ? 0.3 : -0.2) + i * 1.2);
          
          // Modulate opacity so it gently pulses and shifts
          ctx.globalAlpha = 0.4 + 0.2 * Math.sin(time * 1.5 + i);
          ctx.drawImage(_darkFogCache, -_darkFogCache.width/2, -_darkFogCache.height/2);
          ctx.restore();
      }
      ctx.restore();
  });
}

export function drawHelpFromAboveVapors(ctx, gameState) {
  if (!gameState.temporaryBoosts) return;
  const buffedAllies = gameState.temporaryBoosts.filter(b => b.name === "HelpFromAboveAura");
  if (buffedAllies.length === 0) return;

  gameState.vaporParticles = gameState.vaporParticles || [];
  
  if (Math.random() < 0.25) {
      buffedAllies.forEach(b => {
          const ally = gameState.pieces.find(p => p.id === b.pieceId);
          if (ally && ally.currentHp > 0) {
              const ax = ally.col * C.CELL_SIZE + C.CELL_SIZE / 2;
              const ay = ally.row * C.CELL_SIZE + C.CELL_SIZE / 2;
              gameState.vaporParticles.push({
                  y: ay + C.CELL_SIZE * 0.4, // start near feet
                  baseX: ax,
                  life: 1.0,
                  speedY: -(Math.random() * 0.8 + 0.4),
                  phase: Math.random() * Math.PI * 2,
                  phaseSpeed: (Math.random() * 0.05 + 0.05) * (Math.random() > 0.5 ? 1 : -1)
              });
          }
      });
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = gameState.vaporParticles.length - 1; i >= 0; i--) {
      const v = gameState.vaporParticles[i];
      v.life -= 0.015;
      v.phase += v.phaseSpeed;
      v.y += v.speedY;
      
      // Swirl around the unit up to their head
      const radius = C.CELL_SIZE * 0.35 * (0.5 + v.life * 0.5); // swirl tighter as it goes up
      v.x = v.baseX + Math.sin(v.phase) * radius;
      
      if (v.life <= 0) {
          gameState.vaporParticles.splice(i, 1);
          continue;
      }
      
      ctx.fillStyle = `rgba(180, 230, 255, ${v.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 2 + v.life * 3, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}
