import * as C from '@shared/constants.js';
import { spawnBurningGroundParticle } from '../terrain.js';

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


