import * as C from '@shared/constants.js';

export function spawnObsidianPillarCastEffect(anim, gameState) {
  gameState.obsidianPillarAnimations = gameState.obsidianPillarAnimations || [];
  const targetR = anim.targetR !== undefined ? anim.targetR : anim.pillarR;
  const targetC = anim.targetC !== undefined ? anim.targetC : anim.pillarC;
  const targetX = targetC * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetR * C.CELL_SIZE + C.CELL_SIZE / 2;

  const casterX = anim.casterC !== undefined ? anim.casterC * C.CELL_SIZE + C.CELL_SIZE / 2 : targetX;
  const casterY = anim.casterR !== undefined ? anim.casterR * C.CELL_SIZE + C.CELL_SIZE / 2 : targetY;

  const subType = anim.subType || 'wall';

  // Generate faceted realistic basalt & obsidian shards erupting from ground
  const shards = [];
  const numShards = subType === 'knockback' || subType === 'slam' ? 18 : 14;
  for (let i = 0; i < numShards; i++) {
    const angle = (i / numShards) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const speed = Math.random() * 5 + 2.5;
    shards.push({
      x: targetX,
      y: targetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 2.5 + 1),
      size: Math.random() * 5 + 2.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
      alpha: 1.0,
      color: Math.random() > 0.3 ? '#151922' : '#2A3344' // Realistic jet-black vitric glass & basalt
    });
  }

  // Volcanic dust & fine embers
  const embers = [];
  for (let i = 0; i < 15; i++) {
    embers.push({
      x: targetX + (Math.random() - 0.5) * 20,
      y: targetY + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -(Math.random() * 3 + 1.5),
      size: Math.random() * 2 + 1,
      alpha: 1.0
    });
  }

  // Subterranean tectonic seismic ring
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({
    x: targetX,
    y: targetY,
    radius: 12,
    life: 1,
    color: '200, 215, 230' // Realistic cold white/slate mineral shockwave
  });

  gameState.obsidianPillarAnimations.push({
    targetX,
    targetY,
    casterX,
    casterY,
    subType,
    ticks: 0,
    maxTicks: 75,
    shards,
    embers
  });
}

export function drawObsidianPillarAnimations(ctx, gameState) {
  if (!gameState.obsidianPillarAnimations || gameState.obsidianPillarAnimations.length === 0) return;

  for (let i = gameState.obsidianPillarAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.obsidianPillarAnimations[i];
    anim.ticks++;
    const progress = Math.min(anim.ticks / anim.maxTicks, 1.0);

    if (anim.subType === 'shield') {
      // Protective Geological Basalt Barrier Aura
      const shieldProgress = Math.min(anim.ticks / 18, 1.0);
      const radius = C.CELL_SIZE * (0.58 - shieldProgress * 0.12);
      const alpha = 1.0 - progress * 0.7;

      ctx.save();
      ctx.translate(anim.targetX, anim.targetY);

      // Realistic hexagonal basalt shield ring
      ctx.strokeStyle = `rgba(226, 232, 240, ${alpha * 0.85})`;
      ctx.lineWidth = 2.0;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(15, 20, 28, ${alpha * 0.35})`;

      // Hexagonal basalt outline
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ang = (h * Math.PI) / 3;
        const hx = Math.cos(ang) * radius;
        const hy = Math.sin(ang) * radius;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 2. Animate Flying Shards
    for (let k = anim.shards.length - 1; k >= 0; k--) {
      const s = anim.shards[k];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.22; // gravity
      s.rot += s.vrot;
      s.alpha -= 0.015;

      if (s.alpha <= 0) {
        anim.shards.splice(k, 1);
        continue;
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = `rgba(45, 15, 75, ${s.alpha})`;
      ctx.strokeStyle = `rgba(192, 132, 252, ${s.alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -s.size);
      ctx.lineTo(s.size * 0.6, s.size * 0.6);
      ctx.lineTo(-s.size * 0.6, s.size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Animate Rising Molten Embers
    for (let k = anim.embers.length - 1; k >= 0; k--) {
      const em = anim.embers[k];
      em.x += em.vx;
      em.y += em.vy;
      em.alpha -= 0.016;

      if (em.alpha <= 0) {
        anim.embers.splice(k, 1);
        continue;
      }

      ctx.fillStyle = `rgba(249, 115, 22, ${em.alpha})`;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (anim.ticks >= anim.maxTicks) {
      gameState.obsidianPillarAnimations.splice(i, 1);
    }
  }
}
