import * as C from '@shared/constants.js';

export function spawnPummelKnockbackEffect(piece, attackerRow, attackerCol, oldRow, oldCol, newRow, newCol, gameState) {
  gameState.knockbackAnimations = gameState.knockbackAnimations || [];
  piece.isAnimating = true; // Tell the UI to hide the static piece

  const startX = oldCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = oldRow * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetX = newCol * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = newRow * C.CELL_SIZE + C.CELL_SIZE / 2;

  // Spawn a massive shockwave exactly between the Yeti's fist and the target
  const impactX = (attackerCol * C.CELL_SIZE + C.CELL_SIZE / 2 + startX) / 2;
  const impactY = (attackerRow * C.CELL_SIZE + C.CELL_SIZE / 2 + startY) / 2;

  gameState.shockwaves = gameState.shockwaves || [];
  gameState.shockwaves.push({ x: impactX, y: impactY, radius: 25, life: 1, color: '255, 255, 255' });

  gameState.knockbackAnimations.push({
    piece,
    // store the piece key separately so we can still draw the image
    // even after we null out `piece` during cleanup
    pieceKey: piece && piece.key,
    x: startX, y: startY,
    targetX, targetY,
    progress: 0,
    dust: []
  });

}

export function drawPummelKnockbackAnimations(ctx, gameState) {
  if (!gameState.knockbackAnimations) return;

  for (let i = gameState.knockbackAnimations.length - 1; i >= 0; i--) {
    const anim = gameState.knockbackAnimations[i];
    anim.progress += 0.1; // Fast push! (10 frames)

    const currentX = anim.x + (anim.targetX - anim.x) * anim.progress;
    const currentY = anim.y + (anim.targetY - anim.y) * anim.progress;

    // 1. Spawn friction dust trailing from their feet
    if (anim.progress < 1) {
      anim.dust.push({
        x: currentX + (Math.random() - 0.5) * 20,
        y: currentY + C.CELL_SIZE / 3, // Ground level
        vx: (anim.x - anim.targetX) * 0.05 + (Math.random() - 0.5) * 2, // Blow dust backward
        vy: (anim.y - anim.targetY) * 0.05 + (Math.random() - 0.5) * 2,
        alpha: 1,
        size: Math.random() * 5 + 2
      });
    }

    // 2. Draw the dust
    anim.dust.forEach((d, dIdx) => {
      d.x += d.vx; d.y += d.vy; d.alpha -= 0.05;
      if (d.alpha > 0) {
        ctx.fillStyle = `rgba(200, 200, 200, ${d.alpha})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
      } else {
        anim.dust.splice(dIdx, 1);
      }
    });

    // 3. Draw the sliding piece (with a helpless tilt!)
    // Draw the piece both while it's sliding (progress < 1) and continue drawing it at
    // the final location after impact until the dust clears. This prevents a brief
    // disappearance where the UI hides the static piece during the animation.
    if (anim.progress < 1) {
      // Find the image source safely. Use stored pieceKey as a fallback because
      // we may null out `anim.piece` during the impact cleanup while dust lingers.
      const imgKey = (anim.piece && anim.piece.key) || anim.pieceKey;
      // Depending on how your images are stored globally:
      const img = imgKey && (document.getElementById(imgKey) || (gameState.images && gameState.images[imgKey]));
      if (img) {
        ctx.save();
        ctx.translate(currentX, currentY);
        // Tilt away from the direction of travel
        const dx = anim.targetX - anim.x;
        const tilt = (dx > 0) ? -0.2 : (dx < 0) ? 0.2 : 0;
        ctx.rotate(tilt);
        ctx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        ctx.restore();
      }
    } else {
      // Impact phase: still draw the piece at the final location while dust/particles exist
      const imgKey = (anim.piece && anim.piece.key) || anim.pieceKey;
      const img = imgKey && (document.getElementById(imgKey) || (gameState.images && gameState.images[imgKey]));
      if (img) {
        ctx.save();
        ctx.translate(anim.targetX, anim.targetY);
        ctx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        ctx.restore();
      }

      // 4. Clean up once the dust settles
      if (anim.dust.length === 0) {
        if (anim.piece) anim.piece.isAnimating = false; // Backup release
        gameState.knockbackAnimations.splice(i, 1);
      } else if (anim.progress >= 1 && anim.piece) {
        // FIX: Re-enable the static UI rendering immediately upon impact 
        // while the dust particles continue to fade out.
        anim.piece.isAnimating = false;
        anim.piece = null; // Unlink the piece so we don't modify it again
      }
    }
  }
}


