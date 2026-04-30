import * as C from '../../../shared/constants.js';
import { spawnBurningGroundParticle } from './terrain.js';

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
      ctx.fillRect(anim.x - C.CELL_SIZE*0.5, anim.y - C.CELL_SIZE/2, C.CELL_SIZE, C.CELL_SIZE);
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
      for (let k = anim.shards.length - 1; k >= 0; k--) { const s = anim.shards[k]; s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.05; if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; } ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = `rgba(150, 240, 255, ${s.alpha})`; ctx.fillRect(-s.size/2, -s.size/2, s.size, s.size); ctx.restore(); }
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
      ctx.fillStyle = `rgba(120, 210, 255, ${fade * 0.45})`; ctx.fillRect(anim.targetX - spreadDist, anim.targetY - C.CELL_SIZE/2, spreadDist * 2, C.CELL_SIZE);
      if (anim.spreadProgress < 1 && anim.ticks % 3 === 0) {
        // fewer, slower particles
        if (anim.particles.length < 40) {
          anim.particles.push({ x: anim.targetX - spreadDist * 0.6, y: anim.targetY + (Math.random() - 0.5) * C.CELL_SIZE, vx: -1.6, vy: (Math.random() - 0.5) * 1.0, alpha: 1, size: Math.random() * 3 + 1 });
          anim.particles.push({ x: anim.targetX + spreadDist * 0.6, y: anim.targetY + (Math.random() - 0.5) * C.CELL_SIZE, vx: 1.6, vy: (Math.random() - 0.5) * 1.0, alpha: 1, size: Math.random() * 3 + 1 });
        }
        if (anim.ticks === 13) { gameState.shockwaves = gameState.shockwaves || []; gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 20, life: 1, color: '0, 255, 255' }); }
      }
    }
    for (let k = anim.particles.length - 1; k >= 0; k--) { const p = anim.particles[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.alpha -= 0.05; if (p.alpha <= 0) { anim.particles.splice(k, 1); continue; } ctx.fillStyle = `rgba(200, 255, 255, ${p.alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
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
        ctx.save(); ctx.translate(anim.x, anim.y); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
      if (anim.ticks >= anim.maxTicks) {
        anim.impacted = true;
        for (let k = 0; k < 12; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 3; anim.shards.push({ x: anim.targetX, y: anim.targetY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.4, size: Math.random() * 6 + 3, alpha: 1 }); }
        for (let k = 0; k < 10; k++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 3 + 1; anim.splatters.push({ x: anim.targetX, y: anim.targetY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 8 + 4, alpha: 1 }); }
        gameState.shockwaves = gameState.shockwaves || []; gameState.shockwaves.push({ x: anim.targetX, y: anim.targetY, radius: 15, life: 1, color: '255, 69, 0' });
      }
    } else {
      for (let k = anim.shards.length - 1; k >= 0; k--) { const s = anim.shards[k]; s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.03; if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; } ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = `rgba(30, 30, 30, ${s.alpha})`; ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size/2, s.size); ctx.lineTo(-s.size/2, s.size); ctx.fill(); ctx.restore(); }
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
        if (img) ctx.drawImage(img, g.x - C.CELL_SIZE/2, g.y - C.CELL_SIZE/2, C.CELL_SIZE, C.CELL_SIZE); 
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