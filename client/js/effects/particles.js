import * as C from '../../../shared/constants.js';

export function drawAttackTexts(ctx, gameState) {
  for (let i = gameState.attackTexts.length - 1; i >= 0; i--) {
    const t = gameState.attackTexts[i];
    t.alpha -= 0.03;
    if (t.alpha <= 0) {
      gameState.attackTexts.splice(i, 1);
      continue;
    }
    t.y += t.vy;
    ctx.font = `bold ${C.CELL_SIZE * 0.25}px Arial`;
    ctx.fillStyle = `rgba(255, 255, 255, ${t.alpha})`;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
}
export function drawMarkOfCinderSparks(ctx, gameState) {
  gameState.markedPieces.forEach(m => {
    const piece = gameState.pieces.find(p => p.id === m.targetId);

    if (piece && Math.random() > 0.6) {
      gameState.markOfCinderSparks.push({
        x: piece.col * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        y: piece.row * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        vy: -(Math.random() * 0.5 + 0.3),
        life: 1,
        radius: Math.random() * 2 + 1
      });
    }
  });

  for (let i = gameState.markOfCinderSparks.length - 1; i >= 0; i--) {
    const p = gameState.markOfCinderSparks[i];
    p.y += p.vy;
    p.life -= 0.04;
    if (p.life <= 0) {
      gameState.markOfCinderSparks.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(255, 100, 0, ${p.life * 0.9})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Module-scoped persistent pools to maintain smooth animation across React renders
let snowParticlesPool = [];
let ashParticlesPool = [];

// Helper to extract clean array of { r, c, key: 'r,c' } from any territory data shape or trails
function extractTerritoryCells(territory, territoryTrails, team) {
  const result = [];
  const visited = new Set();

  if (territory) {
    let rawList = [];
    if (typeof territory.size === 'number') {
      rawList = Array.from(territory);
    } else if (Array.isArray(territory)) {
      rawList = territory;
    } else if (typeof territory === 'object') {
      rawList = Object.keys(territory);
    }

    for (const item of rawList) {
      let r, c;
      if (typeof item === 'string') {
        const parts = item.split(',').map(Number);
        r = parts[0]; c = parts[1];
      } else if (Array.isArray(item) && item.length >= 2) {
        r = Number(item[0]); c = Number(item[1]);
      }
      if (!isNaN(r) && !isNaN(c) && r >= 0 && r < 10 && c >= 0 && c < 10) {
        const key = `${r},${c}`;
        if (!visited.has(key)) {
          visited.add(key);
          result.push({ r, c, key });
        }
      }
    }
  }

  if (Array.isArray(territoryTrails)) {
    for (const t of territoryTrails) {
      if (t.team === team) {
        const r = Math.round(t.row);
        const c = Math.round(t.col);
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
          const key = `${r},${c}`;
          if (!visited.has(key)) {
            visited.add(key);
            result.push({ r, c, key });
          }
        }
      }
    }
  }

  return result;
}

export function drawParticles(ctx, gameState) {
  if (!gameState || !ctx) return;

  const snowCells = extractTerritoryCells(gameState.snowTerritory, gameState.territoryTrails, 'snow');
  const ashCells = extractTerritoryCells(gameState.ashTerritory, gameState.territoryTrails, 'ash');

  const snowSet = new Set(snowCells.map(c => c.key));
  const ashSet = new Set(ashCells.map(c => c.key));

  const targetSnowCount = snowCells.length > 0 ? Math.min(Math.max(snowCells.length * 3, 8), 50) : 0;
  const targetAshCount = ashCells.length > 0 ? Math.min(Math.max(ashCells.length * 3, 8), 50) : 0;

  // 1. Snow Particles Update & Draw (strictly inside captured territory)
  if (snowCells.length === 0) {
    snowParticlesPool = [];
  } else {
    // Fill pool up to target count
    while (snowParticlesPool.length < targetSnowCount) {
      const cell = snowCells[Math.floor(Math.random() * snowCells.length)];
      snowParticlesPool.push({
        x: cell.c * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        y: cell.r * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 0.35 + 0.25, // Gentle snow drift down
        radius: Math.random() * 1.5 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.45,
        alpha: 0,
        fadeIn: true,
        life: Math.floor(Math.random() * 80 + 80),
        maxLife: 160,
        swayOffset: Math.random() * Math.PI * 2
      });
    }
    // Trim if territory shrank
    if (snowParticlesPool.length > targetSnowCount) {
      snowParticlesPool.length = targetSnowCount;
    }
  }

  for (let i = snowParticlesPool.length - 1; i >= 0; i--) {
    const p = snowParticlesPool[i];
    p.swayOffset += 0.04;
    p.x += p.vx + Math.sin(p.swayOffset) * 0.25;
    p.y += p.vy;
    p.life--;

    // Fade in / out
    if (p.fadeIn) {
      p.alpha = Math.min(p.baseAlpha, p.alpha + 0.04);
      if (p.alpha >= p.baseAlpha) p.fadeIn = false;
    } else if (p.life < 20) {
      p.alpha = Math.max(0, p.alpha - 0.03);
    }

    const cellR = Math.floor(p.y / C.CELL_SIZE);
    const cellC = Math.floor(p.x / C.CELL_SIZE);
    const inTerritory = snowSet.has(`${cellR},${cellC}`);

    if (!inTerritory || p.life <= 0 || p.alpha <= 0) {
      if (snowCells.length > 0) {
        const cell = snowCells[Math.floor(Math.random() * snowCells.length)];
        p.x = cell.c * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
        p.y = cell.r * C.CELL_SIZE + Math.random() * 6; // Respawn at top of cell
        p.life = Math.floor(Math.random() * 80 + 80);
        p.alpha = 0;
        p.fadeIn = true;
      } else {
        snowParticlesPool.splice(i, 1);
        continue;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 230, 255, ${p.alpha})`;
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.restore();
  }

  // 2. Ash Particles Update & Draw (strictly inside captured territory)
  if (ashCells.length === 0) {
    ashParticlesPool = [];
  } else {
    // Fill pool up to target count
    while (ashParticlesPool.length < targetAshCount) {
      const cell = ashCells[Math.floor(Math.random() * ashCells.length)];
      ashParticlesPool.push({
        x: cell.c * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        y: cell.r * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.4 + 0.25), // Floating molten ember up
        radius: Math.random() * 1.5 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.45,
        alpha: 0,
        fadeIn: true,
        life: Math.floor(Math.random() * 80 + 80),
        maxLife: 160,
        wobbleOffset: Math.random() * Math.PI * 2
      });
    }
    // Trim if territory shrank
    if (ashParticlesPool.length > targetAshCount) {
      ashParticlesPool.length = targetAshCount;
    }
  }

  for (let i = ashParticlesPool.length - 1; i >= 0; i--) {
    const p = ashParticlesPool[i];
    p.wobbleOffset += 0.05;
    p.x += p.vx + Math.cos(p.wobbleOffset) * 0.25;
    p.y += p.vy;
    p.life--;

    // Fade in / out
    if (p.fadeIn) {
      p.alpha = Math.min(p.baseAlpha, p.alpha + 0.04);
      if (p.alpha >= p.baseAlpha) p.fadeIn = false;
    } else if (p.life < 20) {
      p.alpha = Math.max(0, p.alpha - 0.03);
    }

    const cellR = Math.floor(p.y / C.CELL_SIZE);
    const cellC = Math.floor(p.x / C.CELL_SIZE);
    const inTerritory = ashSet.has(`${cellR},${cellC}`);

    if (!inTerritory || p.life <= 0 || p.alpha <= 0) {
      if (ashCells.length > 0) {
        const cell = ashCells[Math.floor(Math.random() * ashCells.length)];
        p.x = cell.c * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
        p.y = (cell.r + 1) * C.CELL_SIZE - Math.random() * 6; // Respawn at bottom of cell
        p.life = Math.floor(Math.random() * 80 + 80);
        p.alpha = 0;
        p.fadeIn = true;
      } else {
        ashParticlesPool.splice(i, 1);
        continue;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 120, 50, ${p.alpha})`;
    ctx.shadowColor = '#ff6622';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.restore();
  }

  // Sync with gameState arrays for backwards-compatibility
  gameState.snowParticles = snowParticlesPool;
  gameState.ashParticles = ashParticlesPool;
  gameState.battleParticles = gameState.battleParticles || [];

  // 3. Battle Particles
  for (let i = gameState.battleParticles.length - 1; i >= 0; i--) {
    const p = gameState.battleParticles[i];
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      gameState.battleParticles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
    ctx.fill();
  }
}

export function drawProjectiles(ctx, gameState) {
  for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
    const proj = gameState.projectiles[i];
    const targetX = proj.targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
    const targetY = proj.targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;
    const dx = targetX - proj.x;
    const dy = targetY - proj.y;
    const dist = Math.hypot(dx, dy);

    if (dist < proj.speed) {
      proj.onHit(proj.target);
      gameState.projectiles.splice(i, 1);
      continue;
    }

    proj.x += (dx / dist) * proj.speed;
    proj.y += (dy / dist) * proj.speed;

    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = gameState.lowDetail ? 4 : 15;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function drawShockwaves(ctx, gameState) {
  for (let i = gameState.shockwaves.length - 1; i >= 0; i--) {
    const wave = gameState.shockwaves[i];
    wave.radius += 3;
    wave.life -= (gameState.lowDetail ? 0.05 : 0.025);
    if (wave.life <= 0) {
      gameState.shockwaves.splice(i, 1);
      continue;
    }
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${wave.color}, ${wave.life})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

// Keep small helper spawners in particles core
export function initParticles(gameState) {
  snowParticlesPool = [];
  ashParticlesPool = [];
  if (gameState) {
    gameState.snowParticles = snowParticlesPool;
    gameState.ashParticles = ashParticlesPool;
    gameState.battleParticles = [];
    gameState.frostfallShards = [];
  }
}

export function spawnBattleParticles(attacker, defender, gameState) {
  const color = attacker.team === 'snow' ? '150,200,255' : '255,100,80';
  const startX = attacker.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = attacker.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endX = defender.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const endY = defender.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const angle = Math.atan2(endY - startY, endX - startX);

  for (let i = 0; i < 15; i++) {
    const speed = Math.random() * 2 + 1;
    gameState.battleParticles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5),
      vy: Math.sin(angle) * speed + (Math.random() - 0.5),
      alpha: 1,
      radius: Math.random() * 3 + 2,
      color
    });
  }
}

export function spawnMarkHitParticles(hitTarget, gameState) {
  const x = hitTarget.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const y = hitTarget.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    gameState.battleParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      radius: Math.random() * 2 + 1,
      color: '255, 100, 0'
    });
  }
}