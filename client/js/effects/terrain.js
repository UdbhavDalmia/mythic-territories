import * as C from '../../../shared/constants.js';

export function drawGroundEffectParticles(ctx, gameState) {
  for (let i = gameState.groundEffectParticles.length - 1; i >= 0; i--) {
    const p = gameState.groundEffectParticles[i];
    p.y += p.vy;
    p.alpha -= 0.04;
    if (p.alpha <= 0) {
      gameState.groundEffectParticles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
    ctx.shadowColor = `rgba(${p.color}, 1)`;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function spawnBurningGroundParticle(row, col, gameState) {
  if (Math.random() > 0.3) return;
  const x = col * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
  const y = row * C.CELL_SIZE + C.CELL_SIZE - 5;
  gameState.groundEffectParticles.push({
    x,
    y,
    vy: -(Math.random() * 1.5 + 0.5),
    alpha: 1,
    radius: Math.random() * 2.5 + 1,
    color: '255, 100, 0'
  });
}

export function drawBurningGroundBlock(ctx, row, col, cellSize, duration, maxDuration = 2) {
  const x = col * cellSize;
  const y = row * cellSize;

  // Progress goes from 1.0 (hot) to 0.5 (fading/cooling)
  const progress = Math.max(0.3, duration / maxDuration);
  const pulse = (Math.sin(performance.now() * 0.005) + 1) / 2; // 0 to 1

  function getSeededRandom(r, c, index) {
    let seed = ((r + 1) * 2000) + ((c + 1) * 300) + index;
    let val = Math.sin(seed) * 10000;
    return val - Math.floor(val);
  }

  // 1. Dark Charcoal Base
  ctx.fillStyle = `rgba(30, 20, 20, ${0.9 * progress})`;
  ctx.fillRect(x, y, cellSize, cellSize);

  // 2. Magma Fissures
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#FF4500';
  ctx.shadowBlur = 15 * progress * pulse;

  let seedIndex = 50;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    let cx = x + (getSeededRandom(row, col, seedIndex++) * cellSize);
    let cy = y + (getSeededRandom(row, col, seedIndex++) * cellSize);
    ctx.moveTo(cx, cy);

    const segments = Math.floor(getSeededRandom(row, col, seedIndex++) * 3) + 2;
    for (let j = 0; j < segments; j++) {
      cx += (getSeededRandom(row, col, seedIndex++) - 0.5) * (cellSize * 0.8);
      cy += (getSeededRandom(row, col, seedIndex++) - 0.5) * (cellSize * 0.8);
      cx = Math.max(x + 2, Math.min(x + cellSize - 2, cx));
      cy = Math.max(y + 2, Math.min(y + cellSize - 2, cy));
      ctx.lineTo(cx, cy);
    }

    const green = Math.floor((100 + 100 * pulse) * progress);
    ctx.strokeStyle = `rgba(255, ${green}, 0, ${0.8 * progress})`;
    ctx.lineWidth = 3 * progress; // Cracks literally "fill in" and get thinner
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 3. Smoldering Coals (Dark geometric rocks floating on the magma)
  for (let i = 0; i < 5; i++) {
    const coalX = x + (getSeededRandom(row, col, seedIndex++) * cellSize);
    const coalY = y + (getSeededRandom(row, col, seedIndex++) * cellSize);
    const coalSize = (getSeededRandom(row, col, seedIndex++) * 8) + 4;

    ctx.fillStyle = `rgba(15, 10, 10, ${0.95 * progress})`;
    ctx.beginPath();
    ctx.moveTo(coalX, coalY - coalSize);
    ctx.lineTo(coalX + coalSize, coalY);
    ctx.lineTo(coalX, coalY + coalSize);
    ctx.lineTo(coalX - coalSize, coalY);
    ctx.fill();
  }
}

const transparentCache = new Map();

function getTransparentImage(img) {
  if (!img) return null;
  if (transparentCache.has(img)) return transparentCache.get(img);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.naturalWidth || img.width || 512;
  tempCanvas.height = img.naturalHeight || img.height || 512;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);

  try {
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      if (r < 12 && g < 12 && b < 12) {
        data[i+3] = 0;
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    transparentCache.set(img, tempCanvas);
    return tempCanvas;
  } catch (e) {
    console.warn("Failed to apply transparency key to image:", e);
    return img;
  }
}

export function drawGlacialWallBlock(ctx, row, col, cellSize, gameState, duration = 3) {
  const x = col * cellSize;
  const y = row * cellSize;

  const wallObj = (gameState && gameState.glacialWalls) ? gameState.glacialWalls.find(w => w.row === row && w.col === col) : null;
  const isObsidian = wallObj && wallObj.type === 'obsidianPillar';

  if (isObsidian) {
    const rawImg = gameState && gameState.images ? gameState.images.obsidianPillar : null;
    if (rawImg && rawImg.complete && rawImg.naturalWidth > 0) {
      const img = getTransparentImage(rawImg);
      if (img) {
        ctx.drawImage(img, x, y, cellSize, cellSize);
        return;
      }
    }
  }

  const hasNeighbor = (r, c) => {
    if (!gameState || !gameState.glacialWalls) return false;
    return gameState.glacialWalls.some(w => w.row === r && w.col === c && (w.type === 'obsidianPillar') === isObsidian);
  };

  let minRow = row, maxRow = row;
  if (gameState && gameState.glacialWalls) {
    const visited = new Set();
    const stack = [{ r: row, c: col }];
    visited.add(`${row},${col}`);
    while (stack.length) {
      const curr = stack.pop();
      minRow = Math.min(minRow, curr.r);
      maxRow = Math.max(maxRow, curr.r);
      const neighbors = [{ r: curr.r - 1, c: curr.c }, { r: curr.r + 1, c: curr.c }, { r: curr.r, c: curr.c - 1 }, { r: curr.r, c: curr.c + 1 }];
      neighbors.forEach(n => {
        const key = `${n.r},${n.c}`;
        if (!visited.has(key) && hasNeighbor(n.r, n.c)) { visited.add(key); stack.push(n); }
      });
    }
  }

  const startY = minRow * cellSize;
  const endY = (maxRow + 1) * cellSize;
  const gradient = ctx.createLinearGradient(0, startY, 0, endY);
  if (isObsidian) {
    gradient.addColorStop(0, 'rgba(60, 20, 95, 0.95)');
    gradient.addColorStop(0.5, 'rgba(40, 10, 65, 0.9)');
    gradient.addColorStop(1, 'rgba(20, 5, 35, 0.95)');
  } else {
    gradient.addColorStop(0, 'rgba(200, 255, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.7)');
    gradient.addColorStop(1, 'rgba(20, 100, 180, 0.8)');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, cellSize, cellSize);

  function getSeededRandom(r, c, index) { let seed = ((r + 1) * 1000) + ((c + 1) * 100) + index; let val = Math.sin(seed) * 10000; return val - Math.floor(val); }

  ctx.strokeStyle = isObsidian ? 'rgba(180, 60, 255, 0.55)' : 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const age = 3 - duration; const numCracks = 4 + (age * 6);
  let seedIndex = 1;
  for (let i = 0; i < numCracks; i++) {
    ctx.beginPath();
    let cx = x + (getSeededRandom(row, col, seedIndex++) * cellSize);
    let cy = y + (getSeededRandom(row, col, seedIndex++) * (cellSize * 0.4));
    ctx.moveTo(cx, cy);
    const segments = Math.floor(getSeededRandom(row, col, seedIndex++) * 2) + 2;
    for (let j = 0; j < segments; j++) {
      cx += (getSeededRandom(row, col, seedIndex++) - 0.5) * (cellSize * 0.6);
      cy += getSeededRandom(row, col, seedIndex++) * (cellSize * 0.4);
      cx = Math.max(x + 2, Math.min(x + cellSize - 2, cx));
      cy = Math.max(y + 2, Math.min(y + cellSize - 2, cy));
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const up = hasNeighbor(row - 1, col);
  const down = hasNeighbor(row + 1, col);
  const left = hasNeighbor(row, col - 1);
  const right = hasNeighbor(row, col + 1);

  ctx.strokeStyle = isObsidian ? 'rgba(130, 20, 200, 0.7)' : 'rgba(200, 255, 255, 0.6)'; ctx.lineWidth = 2; ctx.beginPath();
  if (!up) ctx.moveTo(x, y), ctx.lineTo(x + cellSize, y);
  if (!right) ctx.moveTo(x + cellSize, y), ctx.lineTo(x + cellSize, y + cellSize);
  if (!down) ctx.moveTo(x + cellSize, y + cellSize), ctx.lineTo(x, y + cellSize);
  if (!left) ctx.moveTo(x, y + cellSize), ctx.lineTo(x, y);
  ctx.stroke();
}

export function drawIcyGroundBlock(ctx, row, col, cellSize) {
  const x = col * cellSize; const y = row * cellSize; const time = performance.now();
  // Simplified icy tile rendering to reduce CPU when many tiles are active.
  ctx.save(); ctx.translate(x, y);
  const bgGradient = ctx.createLinearGradient(0, 0, cellSize, cellSize);
  bgGradient.addColorStop(0, 'rgba(110, 210, 255, 0.28)');
  bgGradient.addColorStop(1, 'rgba(30, 120, 200, 0.6)');
  ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, cellSize, cellSize);

  // Light crack accents (reduced complexity)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(cellSize * 0.2, cellSize * 0.2);
  ctx.lineTo(cellSize * 0.8, cellSize * 0.35);
  ctx.lineTo(cellSize * 0.3, cellSize * 0.7);
  ctx.stroke();

  // Subtle sheen without expensive composite operations
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(cellSize * 0.05, cellSize * 0.05, cellSize * 0.25, cellSize * 0.6);

  ctx.restore();
}

export function drawSnareTrapBlock(ctx, row, col, cellSize, age, team, playerTeam) {
  const isOwnTrap = team === playerTeam;
  if (!isOwnTrap && age >= 2) return;
  const x = col * cellSize + cellSize / 2; const y = row * cellSize + cellSize / 2;
  let alpha = 1; if (age >= 2) alpha = isOwnTrap ? 0.2 : 0; else if (age > 1) alpha = 1 - (age - 1);
  if (alpha <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  if (age <= 1) {
    ctx.fillStyle = 'rgba(10, 20, 30, 0.5)'; ctx.beginPath(); ctx.arc(0, 0, cellSize * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00FFFF'; ctx.fillStyle = 'rgba(150, 240, 255, 0.8)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const angle = (i * Math.PI) / 3; const px = Math.cos(angle) * (cellSize * 0.25); const py = Math.sin(angle) * (cellSize * 0.25); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); ctx.lineTo(0, 0); }
    ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`; ctx.lineWidth = 2; ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, cellSize * 0.3, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke();
  }
  ctx.restore();
}

export function drawMagmaShardsBlock(ctx, row, col, cellSize, duration, maxDuration = 2) {
  const x = col * cellSize;
  const y = row * cellSize;
  const progress = Math.max(0.3, duration / maxDuration);
  const pulse = (Math.sin(performance.now() * 0.005) + 1) / 2; // 0 to 1

  function getSeededRandom(r, c, index) {
    let seed = ((r + 1) * 3000) + ((c + 1) * 400) + index;
    let val = Math.sin(seed) * 10000;
    return val - Math.floor(val);
  }

  // 1. Dark volcanic floor base (dark violetish-charcoal)
  ctx.fillStyle = `rgba(20, 10, 25, ${0.85 * progress})`;
  ctx.fillRect(x, y, cellSize, cellSize);

  // 2. Glowing purple/orange cracks underneath
  ctx.save();
  ctx.shadowColor = 'rgba(180, 20, 220, 0.7)';
  ctx.shadowBlur = 10 * progress * pulse;
  ctx.strokeStyle = `rgba(230, 60, 20, ${0.65 * progress * pulse})`;
  ctx.lineWidth = 2 * progress;
  let seedIndex = 120;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let cx = x + (getSeededRandom(row, col, seedIndex++) * cellSize);
    let cy = y + (getSeededRandom(row, col, seedIndex++) * cellSize);
    ctx.moveTo(cx, cy);
    const segments = Math.floor(getSeededRandom(row, col, seedIndex++) * 2) + 2;
    for (let j = 0; j < segments; j++) {
      cx += (getSeededRandom(row, col, seedIndex++) - 0.5) * (cellSize * 0.5);
      cy += (getSeededRandom(row, col, seedIndex++) - 0.5) * (cellSize * 0.5);
      cx = Math.max(x + 4, Math.min(x + cellSize - 4, cx));
      cy = Math.max(y + 4, Math.min(y + cellSize - 4, cy));
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 3. Jagged obsidian / magma shards pointing upwards
  const numShards = 4;
  for (let i = 0; i < numShards; i++) {
    const shardX = x + cellSize * (0.2 + 0.6 * getSeededRandom(row, col, seedIndex++));
    const shardY = y + cellSize * (0.2 + 0.6 * getSeededRandom(row, col, seedIndex++));
    const shardWidth = 6 + getSeededRandom(row, col, seedIndex++) * 8;
    const shardHeight = 12 + getSeededRandom(row, col, seedIndex++) * 14;
    const angle = (getSeededRandom(row, col, seedIndex++) - 0.5) * 0.6; // tilt angle

    ctx.save();
    ctx.translate(shardX, shardY);
    ctx.rotate(angle);

    // Glow outline for the crystal
    ctx.shadowColor = 'rgba(150, 10, 220, 0.8)';
    ctx.shadowBlur = (6 + pulse * 4) * progress;

    // Dark obsidian purple crystal core
    ctx.fillStyle = `rgba(25, 10, 45, ${0.95 * progress})`;
    ctx.strokeStyle = `rgba(200, 50, 255, ${0.85 * progress})`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Jagged crystal shape
    ctx.moveTo(0, -shardHeight / 2); // tip
    ctx.lineTo(shardWidth / 2, 0); // right corner
    ctx.lineTo(shardWidth * 0.3, shardHeight / 2); // bottom right
    ctx.lineTo(-shardWidth * 0.3, shardHeight / 2); // bottom left
    ctx.lineTo(-shardWidth / 2, 0); // left corner
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hot magma core line inside the crystal
    ctx.strokeStyle = `rgba(255, 100, 0, ${0.9 * progress * pulse})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, -shardHeight * 0.35);
    ctx.lineTo(0, shardHeight * 0.35);
    ctx.stroke();

    ctx.restore();
  }
}

