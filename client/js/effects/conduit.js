import * as C from '../../../shared/constants.js';

export function drawConduitParticles(ctx, gameState) {
  for (let i = gameState.conduitParticles.length - 1; i >= 0; i--) {
    const p = gameState.conduitParticles[i];
    p.x += p.vx;
    p.y += p.vy;

    if (Math.hypot(p.targetX - p.x, p.targetY - p.y) < 20) {
      gameState.conduitParticles.splice(i, 1);
      continue;
    }

    p.alpha -= 0.01;
    if (p.alpha <= 0) {
      gameState.conduitParticles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.8})`;
    ctx.shadowColor = `rgba(${p.color}, 1)`;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function updateConduitParticles(gameState, startX, startY, endX, endY) {
  const color = gameState.conduitTeam === 'snow' ? '100, 200, 255' : '255, 100, 80';
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  const speed = 4;

  if (Math.random() > 0.5) {
    gameState.conduitParticles.push({
      x: startX + (Math.random() - 0.5) * 10,
      y: startY + (Math.random() - 0.5) * 10,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      alpha: 1,
      radius: Math.random() * 2 + 2,
      color,
      targetX: endX,
      targetY: endY
    });
  }

  if (Math.random() > 0.5) {
    gameState.conduitParticles.push({
      x: endX + (Math.random() - 0.5) * 10,
      y: endY + (Math.random() - 0.5) * 10,
      vx: -(dx / dist) * speed,
      vy: -(dy / dist) * speed,
      alpha: 1,
      radius: Math.random() * 2 + 2,
      color,
      targetX: startX,
      targetY: startY
    });
  }
}

export function spawnSiphonParticles(piece, sourceType, gameState) {
  const targetX = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  let startX;
  let startY;
  let color;

  if (sourceType === 'rift') {
    const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
    const [riftR, riftC] = rift.cells[4];
    startX = riftC * C.CELL_SIZE + C.CELL_SIZE / 2;
    startY = riftR * C.CELL_SIZE + C.CELL_SIZE / 2;
    color = '190, 120, 255';
  } else {
    startX = 5 * C.CELL_SIZE;
    startY = 5 * C.CELL_SIZE;
    color = '220, 20, 60';
  }

  for (let i = 0; i < 30; i++) {
    const spawnX = startX + (Math.random() - 0.5) * C.CELL_SIZE * 1.5;
    const spawnY = startY + (Math.random() - 0.5) * C.CELL_SIZE * 1.5;
    gameState.siphonParticles.push({
      x: spawnX,
      y: spawnY,
      targetX,
      targetY,
      alpha: 1,
      radius: Math.random() * 2 + 1.5,
      color,
      speed: Math.random() * 3 + 2
    });
  }
}

export function drawSiphonParticles(ctx, gameState) {
  for (let i = gameState.siphonParticles.length - 1; i >= 0; i--) {
    const p = gameState.siphonParticles[i];
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < p.speed) {
      gameState.siphonParticles.splice(i, 1);
      continue;
    }

    p.x += (dx / dist) * p.speed;
    p.y += (dy / dist) * p.speed;
    p.alpha -= 0.01;
    if (p.alpha <= 0) {
      gameState.siphonParticles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
    ctx.shadowColor = `rgba(${p.color}, 1)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function drawSiphonRunes(ctx, piece, gameState) {
  if (!piece || piece.ability?.name !== 'Siphon' || !piece.charges || piece.charges <= 0) return;

  const centerX = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const centerY = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const time = performance.now() * 0.002;
  const pulse = 0.8 + 0.2 * Math.sin(time * 2);
  const color = piece.team === 'snow' ? `rgba(100, 200, 255, ${pulse})` : `rgba(255, 100, 80, ${pulse})`;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  const radius = C.CELL_SIZE * 0.35;

  if (piece.charges === 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * 1.2 + time * 0.5, Math.PI * 1.8 + time * 0.5);
    ctx.stroke();
  } else if (piece.charges === 2) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * 0.2 + time * 0.5, Math.PI * 0.8 + time * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * 1.2 + time * 0.5, Math.PI * 1.8 + time * 0.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const angle = time + (i * Math.PI * 2) / 3;
      const startX = centerX + Math.cos(angle) * (radius - 5);
      const startY = centerY + Math.sin(angle) * (radius - 5);
      const endX = centerX + Math.cos(angle) * (radius + 5);
      const endY = centerY + Math.sin(angle) * (radius + 5);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}
