import * as C from '@shared/constants.js';

export function spawnShieldBreakEffect(r, c, faction, gameState) {
  if (!gameState) return;
  gameState.shieldBreakAnimations = gameState.shieldBreakAnimations || [];
  const cx = c * C.CELL_SIZE + C.CELL_SIZE / 2;
  const cy = r * C.CELL_SIZE + C.CELL_SIZE / 2;
  const isSnow = faction === 'snow';

  const shards = [];
  const NUM_SHARDS = 20;
  for (let s = 0; s < NUM_SHARDS; s++) {
    const angle = (s / NUM_SHARDS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = Math.random() * 8 + 4;
    shards.push({
      x: cx + Math.cos(angle) * (C.CELL_SIZE * 0.45),
      y: cy + Math.sin(angle) * (C.CELL_SIZE * 0.45),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 5 + 3,
      alpha: 1.0
    });
  }

  gameState.shieldBreakAnimations.push({
    cx, cy,
    shards,
    ringRadius: C.CELL_SIZE * 0.5,
    ringAlpha: 1.0,
    faction: isSnow ? 'snow' : 'ash',
    ticks: 0
  });
}

export function drawShieldBreakAnimations(ctx, gameState) {
  if (!gameState || !gameState.shieldBreakAnimations) return;

  for (let i = gameState.shieldBreakAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.shieldBreakAnimations[i];
    anim.ticks++;
    anim.ringRadius += 2.8;
    anim.ringAlpha -= 0.045;

    const isSnow = anim.faction === 'snow';
    const mainColor = isSnow ? '56, 189, 248' : '250, 204, 21';
    const coreColor = isSnow ? '224, 242, 254' : '255, 245, 160';

    ctx.save();

    // 1. Expanding shockwave ring
    if (anim.ringAlpha > 0) {
      ctx.beginPath();
      ctx.arc(anim.cx, anim.cy, anim.ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${mainColor}, ${anim.ringAlpha * 0.85})`;
      ctx.lineWidth = 3.0 * anim.ringAlpha;
      ctx.shadowColor = `rgb(${mainColor})`;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // 2. Flying shattered crystalline shards
    let activeShards = 0;
    for (let s = 0; s < anim.shards.length; s++) {
      const sh = anim.shards[s];
      sh.x += sh.vx;
      sh.y += sh.vy;
      sh.vx *= 0.94;
      sh.vy *= 0.94;
      sh.rotation += sh.rotSpeed;
      sh.alpha -= 0.038;

      if (sh.alpha > 0) {
        activeShards++;
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rotation);
        ctx.fillStyle = `rgba(${s % 2 === 0 ? coreColor : mainColor}, ${sh.alpha})`;
        ctx.shadowColor = `rgb(${mainColor})`;
        ctx.shadowBlur = 8;
        ctx.fillRect(-sh.size / 2, -sh.size / 2, sh.size, sh.size);
        ctx.restore();
      }
    }

    ctx.restore();

    if (anim.ringAlpha <= 0 && activeShards === 0) {
      gameState.shieldBreakAnimations.splice(i, 1);
    }
  }
}

