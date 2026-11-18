import * as C from '@shared/constants.js';

export function spawnFateLinkCast(src, dst, gameState) {
  if (!gameState.fateLinkAnimations) gameState.fateLinkAnimations = [];
  if (!src || !dst) return;

  const sx = src.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const sy = src.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dx = dst.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const dy = dst.row * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.fateLinkAnimations.push({ sx, sy, dx, dy, ticks: 0, maxTicks: 40 });
}

export function drawFateLinkAnimations(ctx, gameState) {
  if (!gameState.fateLinkAnimations) return;
  for (let i = gameState.fateLinkAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.fateLinkAnimations[i];
    anim.ticks++;

    const progress = Math.min(anim.ticks / 15, 1);
    const alpha = (anim.maxTicks - anim.ticks) / 25;
    if (alpha <= 0) {
      gameState.fateLinkAnimations.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.strokeStyle = `rgba(211, 211, 211, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -anim.ticks;

    ctx.beginPath();
    ctx.moveTo(anim.sx, anim.sy);
    ctx.lineTo(anim.sx + (anim.dx - anim.sx) * progress, anim.sy + (anim.dy - anim.sy) * progress);
    ctx.stroke();
    ctx.restore();
  }
}
// === HELP FROM ABOVE VISUALS ===


