import * as C from '@shared/constants.js';

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


