import * as C from '@shared/constants.js';

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


