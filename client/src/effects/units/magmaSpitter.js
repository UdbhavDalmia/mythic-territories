import * as C from '@shared/constants.js';

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


