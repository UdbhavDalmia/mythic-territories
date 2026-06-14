import * as C from '../../../shared/constants.js';

export function updateShrineParticles(chargeLevel, gameState) {
  gameState.shrineParticles = [];
  const numParticles = chargeLevel * 75;
  const radius = C.CELL_SIZE * 1.0 + chargeLevel * 0.15 * C.CELL_SIZE;
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / (numParticles * 0.7)) * Math.PI * 2;
    gameState.shrineParticles.push({
      angle,
      radius: radius + (Math.random() - 0.5) * 20,
      size: Math.random() * 3 + 1.5,
      speed: (0.005 + Math.random() * 0.005) * (1 + chargeLevel * 0.5)
    });
  }
}

export function triggerShrineOverloadEffects(gameState, isNova = false) {
  updateShrineParticles(3, gameState);
  if (!isNova) return;

  for (let i = 0; i < 300; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 10;
    gameState.battleParticles.push({
      x: 5 * C.CELL_SIZE,
      y: 5 * C.CELL_SIZE,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      radius: Math.random() * 4 + 2,
      color: '220,20,60'
    });
  }
}

export function drawShrineEffects(ctx, gameState) {
  const centerX = 5 * C.CELL_SIZE;
  const centerY = 5 * C.CELL_SIZE;
  // Ensure the shrineParticles array exists so drawing can safely run
  gameState.shrineParticles = gameState.shrineParticles || [];

  if (!gameState.infusionTarget) {
    for (let i = gameState.shrineParticles.length - 1; i >= 0; i--) {
      const p = gameState.shrineParticles[i];
      let currentX = centerX + Math.cos(p.angle) * p.radius;
      let currentY = centerY + Math.sin(p.angle) * p.radius;

      if (gameState.shrineIsOverloaded) {
        p.angle += p.speed * 4;
        p.radius += Math.sin(performance.now() * 0.008 + p.angle * 5) * 1.0;
      } else {
        p.angle += p.speed;
      }

      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 20, 60, 0.85)';
      ctx.fill();
    }
  } else {
    // Infusion phase drawing
    for (let i = gameState.shrineParticles.length - 1; i >= 0; i--) {
      const p = gameState.shrineParticles[i];
      let currentX = centerX + Math.cos(p.angle) * p.radius;
      let currentY = centerY + Math.sin(p.angle) * p.radius;
      const target = gameState.infusionTarget;
      const targetX = target.col * C.CELL_SIZE + C.CELL_SIZE / 2;
      const targetY = target.row * C.CELL_SIZE + C.CELL_SIZE / 2;
      if (Math.hypot(targetX - currentX, targetY - currentY) < 10) {
        gameState.shrineParticles.splice(i, 1);
        continue;
      }
      p.angle += p.speed * 8;
      p.radius -= 5;
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 20, 60, 0.85)';
      ctx.fill();
    }
  }
}

export function drawShrineOverloadEffects(ctx, gameState) {
  if (!gameState?.shrineIsOverloaded) return;

  const shrineCoords = C.SHAPES.shrineArea;
  const shrineCenterX = 5 * C.CELL_SIZE;
  const shrineCenterY = 5 * C.CELL_SIZE;

  const flicker = 0.5 + Math.sin(performance.now() * 0.01) * 0.2;
  ctx.strokeStyle = `rgba(255, 0, 0, ${flicker})`;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(shrineCoords[0][1] * C.CELL_SIZE + 10, shrineCoords[0][0] * C.CELL_SIZE + 15);
  ctx.lineTo(shrineCoords[3][1] * C.CELL_SIZE + C.CELL_SIZE - 15, shrineCoords[3][0] * C.CELL_SIZE + C.CELL_SIZE - 20);
  ctx.moveTo(shrineCoords[1][1] * C.CELL_SIZE + C.CELL_SIZE - 10, shrineCoords[1][0] * C.CELL_SIZE + 10);
  ctx.lineTo(shrineCoords[2][1] * C.CELL_SIZE + 20, shrineCoords[2][0] * C.CELL_SIZE + C.CELL_SIZE - 10);
  ctx.stroke();

  if (Math.random() > 0.85) {
    const startIdx = Math.floor(Math.random() * 4);
    let endIdx = Math.floor(Math.random() * 4);
    while (endIdx === startIdx) endIdx = Math.floor(Math.random() * 4);

    const [startR, startC] = shrineCoords[startIdx];
    const [endR, endC] = shrineCoords[endIdx];

    gameState.shrineArcs = gameState.shrineArcs || [];
    gameState.shrineArcs.push({
      startX: startC * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
      startY: startR * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
      endX: endC * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
      endY: endR * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
      life: 0.25
    });
  }

  ctx.strokeStyle = 'rgba(255, 50, 100, 0.8)';
  ctx.lineWidth = 1.0;
  ctx.shadowColor = 'red';
  ctx.shadowBlur = 5;

  gameState.shrineArcs = gameState.shrineArcs || [];
  for (let i = gameState.shrineArcs.length - 1; i >= 0; i--) {
    const arc = gameState.shrineArcs[i];
    arc.life -= 0.016;
    if (arc.life <= 0) { gameState.shrineArcs.splice(i, 1); continue; }
    ctx.globalAlpha = arc.life / 0.25;
    ctx.beginPath();
    ctx.moveTo(arc.startX, arc.startY);
    ctx.quadraticCurveTo(
      shrineCenterX + (Math.random() - 0.5) * 15,
      shrineCenterY + (Math.random() - 0.5) * 15,
      arc.endX,
      arc.endY
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
}
