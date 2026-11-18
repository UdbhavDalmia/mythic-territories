import * as C from '@shared/constants.js';

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

