import * as C from '@shared/constants.js';

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


