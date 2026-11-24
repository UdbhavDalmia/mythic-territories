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

  // Generate faceted obsidian shards erupting from ground
  const shards = [];
  const numShards = subType === 'knockback' || subType === 'slam' ? 16 : 12;
  for (let i = 0; i < numShards; i++) {
    const angle = (i / numShards) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const speed = Math.random() * 5 + 2;
    shards.push({
      x: targetX,
      y: targetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 2 + 1),
      size: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
      alpha: 1.0,
      color: Math.random() > 0.4 ? 'rgba(74, 222, 128, 0)' : 'rgba(249, 115, 22, 1)' // purple / orange sparks
    });
  }

  // Volcanic embers
  const embers = [];
  for (let i = 0; i < 15; i++) {
    embers.push({
      x: targetX + (Math.random() - 0.5) * 20,
      y: targetY + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 4,
      vy: -(Math.random() * 4 + 2),
      size: Math.random() * 3 + 1.5,
      alpha: 1.0
    });
  }

  // Shockwave ring
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({
    x: targetX,
    y: targetY,
    radius: 12,
    life: 1,
    color: '168, 85, 247' // Purple shockwave
  });

  gameState.obsidianPillarAnimations.push({
    targetX,
    targetY,
    casterX,
    casterY,
    subType,
    ticks: 0,
    maxTicks: 35,
    shards,
    embers,
    pillarHeight: 0,
    maxPillarHeight: C.CELL_SIZE * 0.8
  });
}

export function drawObsidianPillarAnimations(ctx, gameState) {
  if (!gameState.obsidianPillarAnimations || gameState.obsidianPillarAnimations.length === 0) return;

  for (let i = gameState.obsidianPillarAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.obsidianPillarAnimations[i];
    anim.ticks++;
    const progress = Math.min(anim.ticks / anim.maxTicks, 1.0);

    // 1. Rising Obsidian Spire Visual (for wall and knockback)
    if (anim.subType === 'wall' || anim.subType === 'knockback') {
      const riseProgress = Math.min(anim.ticks / 14, 1.0);
      const easeBounce = 1 - Math.pow(1 - riseProgress, 3);
      const curH = anim.maxPillarHeight * easeBounce;

      ctx.save();
      ctx.translate(anim.targetX, anim.targetY);

      // Monolithic faceted pillar silhouette
      const pW = C.CELL_SIZE * 0.36;
      ctx.fillStyle = 'rgba(30, 10, 50, 0.95)';
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.85)';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(-pW * 0.7, 0);
      ctx.lineTo(-pW, -curH * 0.6);
      ctx.lineTo(0, -curH);
      ctx.lineTo(pW, -curH * 0.6);
      ctx.lineTo(pW * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Vein of glowing molten magma through the center
      if (curH > 10) {
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.9)';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-pW * 0.2, -curH * 0.4);
        ctx.lineTo(pW * 0.15, -curH * 0.75);
        ctx.lineTo(0, -curH);
        ctx.stroke();
      }
      ctx.restore();
    } else if (anim.subType === 'shield') {
      // Protective Crystalline Shield Aura descending onto ally
      const shieldProgress = Math.min(anim.ticks / 18, 1.0);
      const radius = C.CELL_SIZE * (0.6 - shieldProgress * 0.15);
      const alpha = 1.0 - progress * 0.7;

      ctx.save();
      ctx.translate(anim.targetX, anim.targetY);
      ctx.rotate(anim.ticks * 0.08);

      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.9)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = `rgba(147, 51, 234, ${alpha * 0.25})`;

      // Hexagonal shield lattice
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
      s.vy += 0.35; // gravity
      s.rot += s.vrot;
      s.alpha -= 0.035;

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
      em.alpha -= 0.04;

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
