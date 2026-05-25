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

export function drawParticles(ctx, gameState) {
  const low = !!gameState.lowDetail;

  const drawSet = (arr, color, territory) => {
    arr = arr || [];
    const entries = (territory && territory.size > 0) ? Array.from(territory) : [];
    // When low-detail is active, sample fewer particles to reduce draw work
    if (low && arr.length > 0) {
      for (let i = 0; i < arr.length; i += 3) {
        const p = arr[i];
        if (!p) continue;
        p.x += p.vx;
        p.y += p.vy;
        const currentTerritory = `${Math.floor(p.y / C.CELL_SIZE)},${Math.floor(p.x / C.CELL_SIZE)}`;
        // territory fallback handled below
        if (!territory || !territory.has || !territory.has(currentTerritory)) {
          let r, c;
          if (entries.length === 0) {
            r = Math.floor(Math.random() * C.ROWS);
            c = Math.floor(Math.random() * C.COLS);
          } else {
            const entry = entries[Math.floor(Math.random() * entries.length)];
            if (typeof entry === 'string') {
              const parts = entry.split(',').map(Number);
              r = parts[0]; c = parts[1];
            } else if (Array.isArray(entry) && entry.length >= 2) {
              r = Number(entry[0]); c = Number(entry[1]);
            } else if (entry && typeof entry === 'object') {
              const k = Object.keys(entry)[0];
              if (typeof k === 'string' && k.includes(',')) {
                const parts = k.split(',').map(Number);
                r = parts[0]; c = parts[1];
              } else {
                r = Math.floor(Math.random() * C.ROWS);
                c = Math.floor(Math.random() * C.COLS);
              }
            } else {
              r = Math.floor(Math.random() * C.ROWS);
              c = Math.floor(Math.random() * C.COLS);
            }
          }
          p.x = c * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
          p.y = r * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
        }

        if (p.x < 0) p.x = C.CANVAS_SIZE;
        if (p.x > C.CANVAS_SIZE) p.x = 0;
        if (p.y < 0) p.y = C.CANVAS_SIZE;
        if (p.y > C.CANVAS_SIZE) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.fill();
      }
      return;
    }

    arr.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      const currentTerritory = `${Math.floor(p.y / C.CELL_SIZE)},${Math.floor(p.x / C.CELL_SIZE)}`;
      // If territory is missing or doesn't contain the current cell, pick a fallback location
      if (!territory || !territory.has || !territory.has(currentTerritory)) {
        let r, c;
        if (entries.length === 0) {
          // No territory yet: random cell
          r = Math.floor(Math.random() * C.ROWS);
          c = Math.floor(Math.random() * C.COLS);
        } else {
          const entry = entries[Math.floor(Math.random() * entries.length)];
          if (typeof entry === 'string') {
            const parts = entry.split(',').map(Number);
            r = parts[0]; c = parts[1];
          } else if (Array.isArray(entry) && entry.length >= 2) {
            r = Number(entry[0]); c = Number(entry[1]);
          } else if (entry && typeof entry === 'object') {
            // plain object with keys
            const k = Object.keys(entry)[0];
            if (typeof k === 'string' && k.includes(',')) {
              const parts = k.split(',').map(Number);
              r = parts[0]; c = parts[1];
            } else {
              r = Math.floor(Math.random() * C.ROWS);
              c = Math.floor(Math.random() * C.COLS);
            }
          } else {
            r = Math.floor(Math.random() * C.ROWS);
            c = Math.floor(Math.random() * C.COLS);
          }
        }
        p.x = c * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
        p.y = r * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
      }

      if (p.x < 0) p.x = C.CANVAS_SIZE;
      if (p.x > C.CANVAS_SIZE) p.x = 0;
      if (p.y < 0) p.y = C.CANVAS_SIZE;
      if (p.y > C.CANVAS_SIZE) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},${p.alpha})`;
      ctx.fill();
    });
  };

  // Ensure particle arrays exist so drawing doesn't crash if initParticles wasn't called yet
  gameState.snowParticles = gameState.snowParticles || [];
  gameState.ashParticles = gameState.ashParticles || [];
  gameState.battleParticles = gameState.battleParticles || [];
  drawSet(gameState.snowParticles, '150,200,255', gameState.snowTerritory);
  drawSet(gameState.ashParticles, '250,100,80', gameState.ashTerritory);

  for (let i = gameState.battleParticles.length - 1; i >= 0; i--) {
    // Under low detail, only draw a bounded recent subset and speed up decay
    const drawIndexStart = gameState.lowDetail ? Math.max(0, gameState.battleParticles.length - 60) : 0;
    if (i < drawIndexStart) { continue; }
    const p = gameState.battleParticles[i];
    p.alpha -= 0.03;
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
    // Reduce blur in low-detail to save expensive shadow rendering
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
    // Faster fade under low-detail so arrays clean up faster
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
  const createSet = (count, territory, team) => {
    const entries = (territory && territory.size > 0) ? Array.from(territory) : [];
    return Array.from({ length: count }, () => {
      // If territory is empty, fall back to random board positions to avoid undefined split()
      let r, c;
      if (entries.length === 0) {
        r = Math.floor(Math.random() * C.ROWS);
        c = Math.floor(Math.random() * C.COLS);
      } else {
        const entry = entries[Math.floor(Math.random() * entries.length)];
        if (typeof entry === 'string') {
          [r, c] = entry.split(',').map(Number);
        } else if (Array.isArray(entry)) {
          // Some code paths might store as [r,c] arrays; handle defensively
          [r, c] = entry.map(Number);
        } else {
          r = Math.floor(Math.random() * C.ROWS);
          c = Math.floor(Math.random() * C.COLS);
        }
      }

      return {
        x: c * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        y: r * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (team === 'snow' ? 1 : -1) * (Math.random() * 0.5 + 0.2),
        team
      };
    });
  };

  gameState.snowParticles = createSet(35, gameState.snowTerritory, 'snow');
  gameState.ashParticles = createSet(35, gameState.ashTerritory, 'ash');
  gameState.battleParticles = [];
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