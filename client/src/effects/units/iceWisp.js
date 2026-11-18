import * as C from '@shared/constants.js';

export function spawnSummonWispEffect(targetRow, targetCol, wispPiece, gameState) {
  gameState.wispAnimations = gameState.wispAnimations || [];
  wispPiece.isSummoning = true;

  const targetX = targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  const vortexParticles = [];
  for (let i = 0; i < 35; i++) {
    vortexParticles.push({
      angle: Math.random() * Math.PI * 2,
      radius: C.CELL_SIZE * 0.8,
      speed: Math.random() * 0.1 + 0.05,
      size: Math.random() * 2 + 1,
      yOffset: (Math.random() - 0.5) * C.CELL_SIZE
    });
  }

  gameState.wispAnimations.push({ piece: wispPiece, x: targetX, y: targetY, ticks: 0, vortexParticles, shards: [], shattered: false });
}

export function drawSummonWispAnimations(ctx, gameState) {
  if (!gameState.wispAnimations) return;

  for (let i = gameState.wispAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.wispAnimations[i];
    anim.ticks = (anim.ticks || 0) + 1;

    if (!anim.shattered) {
      const progress = Math.min(anim.ticks / 45, 1);
      const maxRadius = C.CELL_SIZE * 0.45;

      ctx.save();
      ctx.translate(anim.x, anim.y);
      ctx.rotate(anim.ticks * 0.05);
      ctx.strokeStyle = `rgba(120,200,255,${0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, maxRadius * (0.5 + progress * 0.5), 0, Math.PI * 2 * (0.4 + progress * 0.6));
      ctx.stroke();
      ctx.restore();

      (anim.vortexParticles || []).forEach(p => {
        p.angle += p.speed + progress * 0.15;
        p.radius = Math.max(0, p.radius - 0.7);
        const px = anim.x + Math.cos(p.angle) * p.radius;
        const py = anim.y + Math.sin(p.angle) * p.radius + (p.yOffset || 0);

        ctx.fillStyle = `rgba(200, 240, 255, ${1 - progress * 0.5})`;
        ctx.shadowColor = '#00BFFF';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      if (anim.ticks >= 45) {
        anim.shattered = true;
        if (anim.piece) anim.piece.isSummoning = false;

        anim.shards = anim.shards || [];
        for (let k = 0; k < 25; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 3;
          anim.shards.push({ x: anim.x, y: anim.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, alpha: 1, size: Math.random() * 5 + 2, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.5 });
        }

        gameState.shockwaves = gameState.shockwaves || [];
        gameState.shockwaves.push({ x: anim.x, y: anim.y, radius: 5, life: 1, color: '0, 191, 255' });
      }
    } else {
      for (let k = anim.shards.length - 1; k >= 0; k--) {
        const shard = anim.shards[k];
        shard.x += shard.vx; shard.y += shard.vy; shard.vy += 0.3; shard.rot += shard.vrot; shard.alpha -= 0.04;
        if (shard.alpha <= 0) { anim.shards.splice(k, 1); continue; }

        ctx.save(); ctx.translate(shard.x, shard.y); ctx.rotate(shard.rot);
        ctx.fillStyle = `rgba(150, 230, 255, ${shard.alpha})`;
        ctx.beginPath(); ctx.moveTo(0, -shard.size); ctx.lineTo(shard.size / 2, shard.size); ctx.lineTo(-shard.size / 2, shard.size); ctx.fill(); ctx.restore();
      }

      if (anim.shards.length === 0) {
        gameState.wispAnimations.splice(i, 1);
      }
    }
  }
}

export function spawnAColdFarewellEffect(row, col, gameState) {
  gameState.aColdFarewellAnimations = gameState.aColdFarewellAnimations || [];
  const targetX = col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const radiusPx = (C.ABILITY_VALUES.AColdFarewell?.radius || 1.5) * C.CELL_SIZE;

  // 1. Inward collapsing motes for anticipation implosion (ticks 0-14)
  const implosionMotes = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const startDist = radiusPx * (0.8 + Math.random() * 0.35);
    implosionMotes.push({
      startX: Math.cos(angle) * startDist,
      startY: Math.sin(angle) * startDist,
      x: Math.cos(angle) * startDist,
      y: Math.sin(angle) * startDist,
      size: Math.random() * 2.8 + 1.8
    });
  }

  // 2. Slow, sorrowful cryo nova shards drifting outward (depth to loss and grief)
  const blastParticles = [];
  for (let i = 0; i < 48; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.8 + 1.2; // Slow, drifting float
    blastParticles.push({
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      size: Math.random() * 4.5 + 2.2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.1
    });
  }

  // 3. Ethereal spirit wisps rising slowly to the heavens (graceful, solemn ascent)
  const spiritWisps = [];
  for (let i = 0; i < 7; i++) {
    spiritWisps.push({
      x: (Math.random() - 0.5) * (radiusPx * 0.5),
      y: (Math.random() - 0.5) * (radiusPx * 0.3),
      vy: -(Math.random() * 0.45 + 0.95), // Graceful ascent motion
      swaySpeed: Math.random() * 0.035 + 0.02,
      swayAmp: Math.random() * 8 + 4,
      seed: Math.random() * 100,
      alpha: 1,
      size: Math.random() * 4.5 + 3.5,
      weepingSparks: []
    });
  }

  gameState.aColdFarewellAnimations.push({
    x: targetX,
    y: targetY,
    radiusPx,
    ticks: 0,
    maxTicks: 140, // Extended duration to let the spirits soar and dissolve smoothly
    implosionMotes,
    blastParticles,
    spiritWisps
  });

  // Delicate sorrowful screen vignette with subtle perimeter needles
  const vignetteSpikes = [];
  for (let i = 0; i < 20; i++) {
    vignetteSpikes.push({
      angle: (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.15,
      length: Math.random() * 65 + 30,
      thickness: Math.random() * 2.2 + 1.2
    });
  }
  gameState.farewellVignette = {
    life: 0,
    maxLife: 140,
    spikes: vignetteSpikes
  };

  // Global shockwave
  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: targetX, y: targetY, radius: 8, life: 0.9, color: '110, 231, 183' });
}

export function drawAColdFarewellAnimations(ctx, gameState) {
  // 0. Draw Sorrowful Board Vignette (delicate peripheral mist, needles, and icy border)
  if (gameState.farewellVignette && gameState.farewellVignette.life < gameState.farewellVignette.maxLife) {
    gameState.farewellVignette.life++;
    const vProg = gameState.farewellVignette.life / gameState.farewellVignette.maxLife;

    // Gentle fade in over 25 frames, hold softly, then peaceful fade out
    let vAlpha = 1.0;
    if (vProg < 0.2) {
      vAlpha = vProg / 0.2;
    } else if (vProg > 0.6) {
      vAlpha = 1 - (vProg - 0.6) / 0.4;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const w = C.CANVAS_SIZE;
    const h = C.CANVAS_SIZE;

    // Soft peripheral mist: center of screen remains completely playable & clear
    const vGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.38, w / 2, h / 2, w * 0.72);
    vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0)');
    vGrad.addColorStop(0.82, `rgba(14, 116, 144, ${vAlpha * 0.32})`);
    vGrad.addColorStop(1, `rgba(6, 182, 212, ${vAlpha * 0.45})`);

    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle creeping frost needles along the perimeter
    if (gameState.farewellVignette.spikes) {
      const centerX = w / 2;
      const centerY = h / 2;
      const baseRadius = Math.min(w, h) * 0.65;
      ctx.strokeStyle = `rgba(186, 230, 253, ${vAlpha * 0.45})`;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      gameState.farewellVignette.spikes.forEach(s => {
        const startX = centerX + Math.cos(s.angle) * baseRadius;
        const startY = centerY + Math.sin(s.angle) * baseRadius;
        const inwardLen = s.length * Math.min(1, vProg * 3.5);
        const endX = centerX + Math.cos(s.angle) * (baseRadius - inwardLen);
        const endY = centerY + Math.sin(s.angle) * (baseRadius - inwardLen);
        ctx.lineWidth = s.thickness;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });
    }

    // Delicate cyan border at viewport edge
    ctx.strokeStyle = `rgba(186, 230, 253, ${vAlpha * 0.4})`;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(0, 0, w, h);

    ctx.restore();
  } else if (gameState.farewellVignette) {
    gameState.farewellVignette = null;
  }

  if (!gameState.aColdFarewellAnimations) return;

  for (let i = gameState.aColdFarewellAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.aColdFarewellAnimations[i];
    anim.ticks++;

    ctx.save();
    ctx.translate(anim.x, anim.y);

    const R = anim.radiusPx;

    // Phase 1: Core Implosion Flare (Ticks 0-14)
    if (anim.ticks <= 14) {
      const impProg = anim.ticks / 14;
      const easeIn = impProg * impProg;

      // Inward collapsing motes
      ctx.fillStyle = '#6ee7b7';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      anim.implosionMotes.forEach(m => {
        m.x = m.startX * (1 - easeIn);
        m.y = m.startY * (1 - easeIn);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * (1 - impProg * 0.35), 0, Math.PI * 2);
        ctx.fill();
      });

      // Contracting bright star core
      const coreR = Math.max(2, (1 - easeIn) * 16);
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      coreGrad.addColorStop(0.5, 'rgba(110, 231, 183, 0.9)');
      coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase 2: Gentle Cryo Supernova (Ticks 12-100)
    if (anim.ticks > 12) {
      const blastTicks = anim.ticks - 12;

      // Central Flash
      if (blastTicks < 20) {
        const flashAlpha = (1 - blastTicks / 20) * 0.85;
        const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.85);
        flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGrad.addColorStop(0.35, `rgba(110, 231, 183, ${flashAlpha * 0.65})`);
        flashGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      // Expanding Cryo Nova Rings (0 -> R)
      if (blastTicks <= 45) {
        const ringProg = blastTicks / 45;
        const curRingR = R * Math.sin((ringProg * Math.PI) / 2);
        const ringAlpha = (1 - ringProg) * 0.85;

        ctx.save();
        ctx.strokeStyle = `rgba(110, 231, 183, ${ringAlpha})`;
        ctx.lineWidth = 3.5 * (1 - ringProg * 0.4);
        ctx.shadowColor = '#6ee7b7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, curRingR, 0, Math.PI * 2);
        ctx.stroke();

        // Secondary outer crystalline rune ring
        ctx.strokeStyle = `rgba(186, 230, 253, ${ringAlpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0, curRingR - 8), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Flying Diamond Shards (Slow, floating aerodynamic glide with gentle gravity)
      anim.blastParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012; // Gentle weeping gravity
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.rot += p.vrot;
        p.alpha = Math.max(0, p.alpha - 0.0085);
        if (p.alpha <= 0) return;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(110, 231, 183, ${p.alpha * 0.9})`;
        ctx.strokeStyle = `rgba(224, 242, 254, ${p.alpha * 0.8})`;
        ctx.lineWidth = 0.6;
        ctx.shadowColor = '#6ee7b7';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.55, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    // Phase 3: Ascending Spirit Wisps (Graceful, solemn flight with smooth dissolving exit transition)
    if (anim.ticks > 14) {
      const exitProg = Math.max(0, Math.min(1, (anim.ticks - 75) / 55));
      const exitScale = Math.max(0, 1 - exitProg);

      anim.spiritWisps.forEach(w => {
        w.y += w.vy;
        w.x += Math.sin(anim.ticks * w.swaySpeed + w.seed) * 0.35; // Languid sway
        w.alpha = Math.max(0, w.alpha - 0.007);
        if (w.alpha <= 0 || exitScale <= 0) return;

        // Occasionally spawn weeping sparks, and dissolution sparkle motes during exit
        if (anim.ticks % 6 === 0) {
          w.weepingSparks.push({
            x: w.x + (Math.random() - 0.5) * 4,
            y: w.y + (exitProg > 0 ? (Math.random() - 0.5) * 6 : 4),
            vy: exitProg > 0 ? -(Math.random() * 0.35 + 0.15) : (Math.random() * 0.25 + 0.15),
            alpha: w.alpha * (exitProg > 0 ? 0.9 : 0.8)
          });
        }

        // Draw weeping sparks
        for (let sp = w.weepingSparks.length - 1; sp >= 0; sp--) {
          const s = w.weepingSparks[sp];
          s.y += s.vy;
          s.alpha -= 0.02;
          if (s.alpha <= 0) {
            w.weepingSparks.splice(sp, 1);
            continue;
          }
          ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha * exitScale})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        const headSize = w.size * Math.max(0.15, exitScale);
        const curAlpha = w.alpha * exitScale;

        ctx.save();
        ctx.translate(w.x, w.y);

        // Luminous spirit head with soft glow
        const spiritGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, headSize * 1.2);
        spiritGrad.addColorStop(0, `rgba(255, 255, 255, ${curAlpha})`);
        spiritGrad.addColorStop(0.35, `rgba(110, 231, 183, ${curAlpha * 0.85})`);
        spiritGrad.addColorStop(0.7, `rgba(56, 189, 248, ${curAlpha * 0.4})`);
        spiritGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = spiritGrad;
        ctx.shadowColor = '#6ee7b7';
        ctx.shadowBlur = 8 * exitScale;
        ctx.beginPath();
        ctx.arc(0, 0, headSize, 0, Math.PI * 2);
        ctx.fill();

        // Gossamer ethereal tail trailing downward
        ctx.strokeStyle = `rgba(186, 230, 253, ${curAlpha * 0.55})`;
        ctx.lineWidth = 1.8 * exitScale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          -Math.sin(anim.ticks * w.swaySpeed) * 3,
          headSize * 1.8,
          0,
          headSize * 4.2
        );
        ctx.stroke();

        ctx.restore();
      });
    }

    // Phase 4: Ground Frost Blessing Aura (seamless transition into Blizzard Storm)
    if (anim.ticks > 20) {
      const auraProg = Math.min((anim.ticks - 20) / 45, 1);
      const auraAlpha = Math.sin(auraProg * Math.PI) * 0.5;

      const groundGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      groundGrad.addColorStop(0, `rgba(110, 231, 183, ${auraAlpha * 0.3})`);
      groundGrad.addColorStop(0.7, `rgba(56, 189, 248, ${auraAlpha * 0.15})`);
      groundGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = groundGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (anim.ticks >= anim.maxTicks) {
      gameState.aColdFarewellAnimations.splice(i, 1);
    }
  }
}
