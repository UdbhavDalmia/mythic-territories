import * as C from '@shared/constants.js';

export function spawnGlacialWallEffect(targetRow, targetCol, gameState) {
  gameState.wallAnimations = gameState.wallAnimations || [];
  const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  const spikes = [];
  const numSpikes = Math.floor(Math.random() * 2) + 3;
  for (let i = 0; i < numSpikes; i++) {
    spikes.push({ height: C.CELL_SIZE * (0.6 + Math.random() * 0.4), width: C.CELL_SIZE * (0.3 + Math.random() * 0.2), offsetX: (Math.random() - 0.5) * (C.CELL_SIZE * 0.6), tilt: (Math.random() - 0.5) * 0.3 });
  }

  const mist = [];
  for (let i = 0; i < 20; i++) {
    mist.push({ x: targetX, y: targetY + C.CELL_SIZE / 2, vx: (Math.random() - 0.5) * 8, vy: -(Math.random() * 2 + 1), alpha: 1, size: Math.random() * 4 + 2 });
  }

  gameState.wallAnimations.push({ x: targetX, y: targetY, ticks: 0, spikes, mist });
}

export function drawGlacialWallAnimations(ctx, gameState) {
  if (!gameState.wallAnimations) return;

  for (let i = gameState.wallAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.wallAnimations[i];

    // Low-detail: simplify wall visuals to reduce per-frame work
    if (gameState.lowDetail && !anim.isShatter) {
      anim.ticks++;
      // draw a simple translucent rectangle representing the wall
      ctx.fillStyle = `rgba(180, 230, 255, ${Math.min(0.6, anim.ticks / 40)})`;
      ctx.fillRect(anim.x - C.CELL_SIZE * 0.5, anim.y - C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
      if (anim.ticks > 60) gameState.wallAnimations.splice(i, 1);
      continue;
    }

    if (anim.isShatter) {
      for (let k = anim.shards.length - 1; k >= 0; k--) {
        const s = anim.shards[k];
        s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.rot += s.vrot; s.alpha -= 0.04;
        if (s.alpha <= 0) { anim.shards.splice(k, 1); continue; }

        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.fillStyle = s.color ? s.color.replace('ALPHA', Math.max(0, s.alpha)) : `rgba(150, 230, 255, ${s.alpha})`;
        ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size / 2, s.size); ctx.lineTo(-s.size / 2, s.size); ctx.fill(); ctx.restore();
      }

      if (anim.shards.length === 0) gameState.wallAnimations.splice(i, 1);
    } else {
      anim.ticks++; const eruptDuration = 15; const mistDuration = 40;
      if (anim.ticks <= mistDuration) {
        const progress = Math.min(anim.ticks / eruptDuration, 1);
        const easeOutBounce = 1 - Math.pow(1 - progress, 3);
        ctx.save(); ctx.translate(anim.x, anim.y);
        anim.spikes.forEach(spike => {
          ctx.save(); ctx.translate(spike.offsetX, C.CELL_SIZE / 2); ctx.rotate(spike.tilt);
          ctx.fillStyle = `rgba(150, 220, 255, ${progress})`;
          ctx.strokeStyle = `rgba(200, 255, 255, ${progress})`; ctx.lineWidth = 2; ctx.shadowColor = '#00BFFF'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(-spike.width / 2, 0); ctx.lineTo(0, -spike.height * easeOutBounce); ctx.lineTo(spike.width / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        });
        ctx.restore();
      }

      if (anim.ticks <= mistDuration) {
        anim.mist.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.alpha -= 0.025; if (p.alpha > 0) { ctx.fillStyle = `rgba(200, 240, 255, ${Math.max(0, p.alpha)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } });
      } else {
        gameState.wallAnimations.splice(i, 1);
      }
    }
  }
}

export function spawnWallShatterEffect(row, col, gameState, isObsidian = false) {
  gameState.wallAnimations = gameState.wallAnimations || [];
  const shards = [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const shardColor = isObsidian ? 'rgba(25, 30, 42, ALPHA)' : 'rgba(150, 230, 255, ALPHA)';
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2.5;
    shards.push({
      x: targetX,
      y: targetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,
      alpha: 1,
      size: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.5,
      color: shardColor
    });
  }
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({
    x: targetX,
    y: targetY,
    radius: 15,
    life: 1,
    color: isObsidian ? '210, 225, 240' : '0, 191, 255'
  });
  gameState.wallAnimations.push({ isShatter: true, shards });
}


