import * as C from '@shared/constants.js';

export function spawnGlacialFractureEffect(row, col, gameState) {
  gameState.glacialFractureAnimations = gameState.glacialFractureAnimations || [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const maxRadiusPx = (C.ABILITY_VALUES.GlacialFracture?.radius || 2) * C.CELL_SIZE;

  // 1. Organic branching fracture fissures radiating from epicenter (lessened to 5 clean cracks)
  const cracks = [];
  const numCracks = 5;
  for (let i = 0; i < numCracks; i++) {
    const baseAngle = (i / numCracks) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const crackLength = maxRadiusPx * (0.8 + Math.random() * 0.25);
    const points = [{ x: 0, y: 0 }];
    const segments = 4;
    let curDist = 0;
    let curAngle = baseAngle;
    for (let s = 1; s <= segments; s++) {
      curDist += crackLength / segments;
      curAngle += (Math.random() - 0.5) * 0.35;
      points.push({
        x: Math.cos(curAngle) * curDist,
        y: Math.sin(curAngle) * curDist
      });
    }

    // Secondary sub-branch
    const branches = [];
    if (Math.random() > 0.35 && points.length >= 3) {
      const bIdx = 2;
      const bOrigin = points[bIdx];
      const bAngle = curAngle + (Math.random() > 0.5 ? 0.6 : -0.6);
      const bLen = maxRadiusPx * 0.3;
      branches.push({
        x1: bOrigin.x,
        y1: bOrigin.y,
        x2: bOrigin.x + Math.cos(bAngle) * bLen,
        y2: bOrigin.y + Math.sin(bAngle) * bLen
      });
    }

    cracks.push({ points, branches, width: Math.random() * 1.5 + 2.5 });
  }

  // 2. Faceted Glacial Ice Spikes erupting from the ground (lessened to 5 prominent spires)
  const spikes = [];
  const numSpikes = 5;
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const dist = (0.25 + Math.random() * 0.6) * maxRadiusPx;
    spikes.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      height: (0.55 + Math.random() * 0.45) * C.CELL_SIZE,
      width: (0.22 + Math.random() * 0.15) * C.CELL_SIZE,
      rot: angle + Math.PI / 2 + (Math.random() - 0.5) * 0.25,
      delay: Math.floor(Math.random() * 6)
    });
  }

  // 3. Faceted diamond ice shards bursting outward
  const shards = [];
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2.5;
    const startDist = Math.random() * maxRadiusPx * 0.5;
    shards.push({
      x: Math.cos(angle) * startDist,
      y: Math.sin(angle) * startDist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 1.5),
      alpha: 1,
      size: Math.random() * 5 + 3,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      delay: 12 + Math.floor(Math.random() * 8)
    });
  }

  // 4. Soft volumetric frost mist
  const mist = [];
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * maxRadiusPx * 0.85;
    mist.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: Math.random() * 24 + 14,
      alpha: 0.6
    });
  }

  gameState.glacialFractureAnimations.push({
    x: targetX,
    y: targetY,
    maxRadiusPx,
    ticks: 0,
    maxTicks: 65,
    cracks,
    spikes,
    shards,
    mist
  });

  // Circular shockwave in global pool
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: 10, life: 1, color: '56, 189, 248' });
}

export function drawGlacialFractureAnimations(ctx, gameState) {
  if (!gameState.glacialFractureAnimations) return;

  for (let i = gameState.glacialFractureAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.glacialFractureAnimations[i];
    anim.ticks++;

    ctx.save();
    ctx.translate(anim.x, anim.y);

    const R = anim.maxRadiusPx;
    const overallProg = Math.min(anim.ticks / anim.maxTicks, 1);

    // 1. Frost territory ground bloom (organic radial gradient)
    const bloomAlpha = anim.ticks < 20 ? (anim.ticks / 20) * 0.45 : Math.max(0, (1 - (anim.ticks - 20) / (anim.maxTicks - 20)) * 0.45);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    grad.addColorStop(0, `rgba(224, 242, 254, ${bloomAlpha})`);
    grad.addColorStop(0.5, `rgba(56, 189, 248, ${bloomAlpha * 0.6})`);
    grad.addColorStop(0.85, `rgba(14, 116, 144, ${bloomAlpha * 0.3})`);
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();

    // 2. Expanding Cryo-Shockwave Rings (0 -> maxRadius)
    if (anim.ticks <= 32) {
      const ringProg = anim.ticks / 32;
      const currentRingR = R * Math.sin((ringProg * Math.PI) / 2);
      const ringAlpha = (1 - ringProg) * 0.85;

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, currentRingR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(186, 230, 253, ${ringAlpha})`;
      ctx.lineWidth = 3.5 * (1 - ringProg * 0.6);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Secondary decorative dashed ring
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, currentRingR - 10), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Jagged Ground Fracture Cracks
    const crackProg = Math.min(anim.ticks / 16, 1);
    const crackFade = anim.ticks > 40 ? Math.max(0, 1 - (anim.ticks - 40) / 25) : 1;
    if (crackFade > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(224, 242, 254, ${0.9 * crackFade})`;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      anim.cracks.forEach(c => {
        const segCount = Math.ceil(c.points.length * crackProg);
        if (segCount < 2) return;
        ctx.lineWidth = c.width * crackFade;
        ctx.beginPath();
        ctx.moveTo(c.points[0].x, c.points[0].y);
        for (let s = 1; s < segCount; s++) {
          ctx.lineTo(c.points[s].x, c.points[s].y);
        }
        ctx.stroke();

        // Sub-branches
        if (crackProg > 0.6 && c.branches.length > 0) {
          c.branches.forEach(b => {
            ctx.beginPath();
            ctx.moveTo(b.x1, b.y1);
            ctx.lineTo(b.x2, b.y2);
            ctx.stroke();
          });
        }
      });
      ctx.restore();
    }

    // 4. Erupting 3D Glacial Ice Spikes (Crystalline Facets)
    anim.spikes.forEach(sp => {
      if (anim.ticks < sp.delay) return;
      const spTicks = anim.ticks - sp.delay;
      const spProg = Math.min(spTicks / 10, 1);
      const spFade = anim.ticks > 36 ? Math.max(0, 1 - (anim.ticks - 36) / 20) : 1;
      if (spFade <= 0) return;

      const curH = sp.height * Math.sin((spProg * Math.PI) / 2) * spFade;
      const curW = sp.width * spFade;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.rot);

      // Left Facet (Light ice cyan)
      ctx.fillStyle = `rgba(224, 242, 254, ${0.85 * spFade})`;
      ctx.beginPath();
      ctx.moveTo(0, -curH);
      ctx.lineTo(-curW, 0);
      ctx.lineTo(0, curW * 0.3);
      ctx.closePath();
      ctx.fill();

      // Right Facet (Deep glacial blue)
      ctx.fillStyle = `rgba(56, 189, 248, ${0.75 * spFade})`;
      ctx.beginPath();
      ctx.moveTo(0, -curH);
      ctx.lineTo(curW, 0);
      ctx.lineTo(0, curW * 0.3);
      ctx.closePath();
      ctx.fill();

      // Specular Center Spine
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * spFade})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -curH);
      ctx.lineTo(0, curW * 0.3);
      ctx.stroke();

      ctx.restore();
    });

    // 5. Faceted Diamond Ice Shards flying outward
    anim.shards.forEach(sh => {
      if (anim.ticks < sh.delay) return;
      sh.x += sh.vx;
      sh.y += sh.vy;
      sh.vx *= 0.93;
      sh.vy *= 0.93;
      sh.rot += sh.vrot;
      sh.alpha = Math.max(0, sh.alpha - 0.024);
      if (sh.alpha <= 0) return;

      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.fillStyle = `rgba(186, 230, 253, ${sh.alpha})`;
      ctx.strokeStyle = `rgba(255, 255, 255, ${sh.alpha * 0.9})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -sh.size);
      ctx.lineTo(sh.size * 0.55, 0);
      ctx.lineTo(0, sh.size);
      ctx.lineTo(-sh.size * 0.55, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // 6. Volumetric Frost Mist
    anim.mist.forEach(m => {
      m.alpha = Math.max(0, m.alpha - 0.012);
      if (m.alpha <= 0) return;
      const mGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
      mGrad.addColorStop(0, `rgba(186, 230, 253, ${m.alpha * 0.35})`);
      mGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    if (anim.ticks >= anim.maxTicks) {
      gameState.glacialFractureAnimations.splice(i, 1);
    }
  }
}


