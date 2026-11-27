import * as C from '@shared/constants.js';
import { computePowerDiagram, isPointInPolygon } from '@shared/voronoi.js';
import { getValidMoves, getPieceMoveRadius } from '@shared/utils.js';
import * as Effects from '@/effects';
import { drawCastAnimations } from '../services/spriteAnimator.js';

export function isPointInTeamTerritory(px, py, cells, CS) {
  if (!cells || cells.length === 0) return false;
  const gx = px / CS;
  const gy = py / CS;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const dx = gx - cell.center.x;
    const dy = gy - cell.center.y;
    const maxR = (cell.radius || 2.5) * 1.05;
    if (dx * dx + dy * dy > maxR * maxR) continue;

    // Cache polygon bounding box on cell for fast rejection (Optimization 7)
    if (!cell._bbox && cell.polygon && cell.polygon.length >= 3) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let p = 0; p < cell.polygon.length; p++) {
        const pt = cell.polygon[p];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      cell._bbox = { minX, maxX, minY, maxY };
    }
    if (cell._bbox) {
      if (gx < cell._bbox.minX || gx > cell._bbox.maxX || gy < cell._bbox.minY || gy > cell._bbox.maxY) {
        continue;
      }
    }

    if (cell.polygon && cell.polygon.length >= 3 && isPointInPolygon(gx, gy, cell.polygon)) {
      return true;
    }
  }
  return false;
}

export const craterCache = new Map();
let lastRecordedCS = null;

export function clearCraterCache() {
  craterCache.clear();
}

export function renderTerritoryLayer(bgCtx, currentGs, isAshLocal, arg4, arg5, arg6, arg7) {
      let CS, terrCacheRef, terrKeyRef, gradCache;
      if (typeof arg4 === 'number') {
        CS = arg4;
        terrCacheRef = arg5;
        terrKeyRef = arg6;
        gradCache = arg7;
      } else {
        terrKeyRef = arg4;
        terrCacheRef = arg5;
        CS = typeof arg7 === 'number' ? arg7 : (typeof arg6 === 'number' ? arg6 : 70);
        gradCache = null;
      }
      if (!terrKeyRef) terrKeyRef = { current: null };
      if (!terrCacheRef) terrCacheRef = { current: null };
      if (!CS) CS = 70;

      // Invalidate craterCache if cell size (CS) changed upon window resize (Optimization 9)
      if (lastRecordedCS !== null && lastRecordedCS !== CS) {
        craterCache.clear();
      }
      lastRecordedCS = CS;

      // --- Background canvas: Territory Trails (renders UNDER pieces at z-5) ---
      if (bgCtx) {
        bgCtx.save();
        if (isAshLocal) {
          bgCtx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
          bgCtx.rotate(Math.PI);
        }

        const pieces = currentGs?.pieces || [];
        const piecesKey = currentGs?._piecesKey || (currentGs ? (currentGs._piecesKey = pieces
          .map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`)
          .join('|')) : '');
        // Cache key tracks piece configuration and game start without forcing cache invalidation on idle turn switches
        const newKey = `${piecesKey}_${currentGs?.gameStarted ? 1 : 0}`;

        if (newKey !== terrKeyRef.current || !terrCacheRef.current) {
          terrKeyRef.current = newKey;
          if (!terrCacheRef.current && typeof document !== 'undefined') {
            terrCacheRef.current = document.createElement('canvas');
            terrCacheRef.current.width = C.CANVAS_SIZE;
            terrCacheRef.current.height = C.CANVAS_SIZE;
          }
          if (terrCacheRef.current) {
            const tCtx = terrCacheRef.current.getContext('2d');
            tCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

            const voronoi = currentGs?.voronoiData || computePowerDiagram(pieces);
            if (currentGs) currentGs.voronoiData = voronoi;

            // 1. Draw each unit's bounded territorial influence with seamless organic elemental blending
            (voronoi.cells || []).forEach(cell => {
              if (!cell.polygon || cell.polygon.length < 3) return;

              tCtx.beginPath();
              tCtx.moveTo(cell.polygon[0].x * CS, cell.polygon[0].y * CS);
              for (let k = 1; k < cell.polygon.length; k++) {
                tCtx.lineTo(cell.polygon[k].x * CS, cell.polygon[k].y * CS);
              }
              tCtx.closePath();

              const cx = cell.center.x * CS;
              const cy = cell.center.y * CS;
              const radiusPx = (cell.radius || 2.0) * CS;
              
              // Reuse cached gradient if available (Optimization 10)
              const gradKey = `${cell.team}_${Math.round(cx)}_${Math.round(cy)}_${Math.round(radiusPx)}`;
              let grad = gradCache && typeof gradCache.get === 'function' ? gradCache.get(gradKey) : null;
              if (!grad) {
                grad = tCtx.createRadialGradient(cx, cy, CS * 0.1, cx, cy, radiusPx);
                if (cell.team === 'snow') {
                  // Deep Glacial Permafrost (Darkened, Rich Cold Ice)
                  grad.addColorStop(0, 'rgba(8, 47, 73, 0.72)');
                  grad.addColorStop(0.3, 'rgba(3, 105, 161, 0.42)');
                  grad.addColorStop(0.65, 'rgba(14, 165, 233, 0.18)');
                  grad.addColorStop(0.85, 'rgba(56, 189, 248, 0.06)');
                  grad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
                } else {
                  // Deep Volcanic Scorched Magma (Darkened, Basalt Obsidian)
                  grad.addColorStop(0, 'rgba(50, 10, 8, 0.76)');
                  grad.addColorStop(0.3, 'rgba(153, 27, 27, 0.44)');
                  grad.addColorStop(0.65, 'rgba(220, 38, 38, 0.18)');
                  grad.addColorStop(0.85, 'rgba(239, 68, 68, 0.06)');
                  grad.addColorStop(1, 'rgba(185, 28, 28, 0.0)');
                }
                if (gradCache && typeof gradCache.set === 'function') {
                  gradCache.set(gradKey, grad);
                }
              }

              tCtx.fillStyle = grad;
              tCtx.fill();
            });
          }
        }

        if (terrCacheRef.current) {
          bgCtx.drawImage(terrCacheRef.current, 0, 0);
        }

        // --- Ground Layer: Death Meteor Scorched Blast Radius ---
        if (currentGs.deathMeteors && currentGs.deathMeteors.length > 0) {
          currentGs.deathMeteors.forEach(m => {
            const radius = 2;
            const dur = m.duration !== undefined ? m.duration : 6;
            const decay = Math.max(0.2, dur / 6);
            for (let dr = -radius; dr <= radius; dr++) {
              for (let dc = -radius; dc <= radius; dc++) {
                const dist = Math.hypot(dr, dc);
                if (dist > radius) continue;
                const tr = m.r + dr, tc = m.c + dc;
                if (tr < 0 || tr >= 10 || tc < 0 || tc >= 10) continue;
                const alpha = Math.max(0.08, (0.65 - dist * 0.16) * decay);
                bgCtx.save();
                bgCtx.fillStyle = `rgba(30, 8, 2, ${alpha * 0.85})`;
                bgCtx.fillRect(tc * CS, tr * CS, CS, CS);
                bgCtx.strokeStyle = `rgba(255, 60, 0, ${alpha * 0.7})`;
                bgCtx.lineWidth = 1.5;
                const cx = (tc + 0.5) * CS;
                const cy = (tr + 0.5) * CS;
                for (let si = 0; si < 3; si++) {
                  const ang = (si / 3) * Math.PI * 2 + (tc * 1.3 + tr * 0.7);
                  bgCtx.beginPath();
                  bgCtx.moveTo(cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4);
                  bgCtx.lineTo(cx + Math.cos(ang) * (CS * 0.42), cy + Math.sin(ang) * (CS * 0.42));
                  bgCtx.stroke();
                }
                bgCtx.restore();
              }
            }
          });
        }

        // --- Ground Layer: Special Terrains (Permanent Crater Black Mass, Magma Shards, Icy Ground) ---
        if (currentGs.specialTerrains && currentGs.specialTerrains.length > 0) {
          currentGs.specialTerrains.forEach(t => {
            const cx = (t.col + 0.5) * CS;
            const cy = (t.row + 0.5) * CS;
            const x = t.col * CS;
            const y = t.row * CS;

            if (t.type === 'crater') {
              const seed = (Math.round(t.row) * 73 + Math.round(t.col) * 179);
              const craterKey = `${t.row},${t.col}_${CS}`;
              let offscreenCrater = craterCache.get(craterKey);

              // 1-3. Pre-render static crater components (debris, basalt blocks, pit layers) to offscreen canvas
              if (!offscreenCrater && typeof document !== 'undefined') {
                offscreenCrater = document.createElement('canvas');
                offscreenCrater.width = CS * 2;
                offscreenCrater.height = CS * 2;
                const cCtx = offscreenCrater.getContext('2d');
                const ocx = CS;
                const ocy = CS;

                const rnd = (i) => {
                  const s = Math.sin(seed * 9.1 + i * 13.37) * 43758.5453;
                  return s - Math.floor(s);
                };

                // Base Scorched Earth (Irregular dark charcoal rectangular & square blast slabs)
                const numDebris = 14;
                for (let d = 0; d < numDebris; d++) {
                  const dw = CS * (0.28 + rnd(d * 2) * 0.38);
                  const dh = CS * (0.28 + rnd(d * 2 + 1) * 0.38);
                  const ox = (rnd(d * 3) - 0.5) * CS * 0.88;
                  const oy = (rnd(d * 3 + 1) - 0.5) * CS * 0.88;
                  const shade = Math.floor(10 + rnd(d) * 15);
                  cCtx.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.38)}, ${Math.floor(shade * 0.18)}, 0.88)`;
                  cCtx.fillRect(ocx + ox - dw / 2, ocy + oy - dh / 2, dw, dh);
                }

                // Fractured Basalt Rim Blocks (Solid Random Rectangles and Squares)
                const numBlocks = 14;
                for (let b = 0; b < numBlocks; b++) {
                  const angle = (b / numBlocks) * Math.PI * 2 + (rnd(b) - 0.5) * 0.28;
                  const dist = CS * (0.20 + rnd(b * 4) * 0.20);
                  const bx = ocx + Math.cos(angle) * dist;
                  const by = ocy + Math.sin(angle) * dist;
                  const bw = CS * (0.26 + rnd(b * 5) * 0.22);
                  const bh = CS * (0.24 + rnd(b * 5 + 1) * 0.22);

                  const tone = Math.floor(4 + rnd(b * 3) * 8);
                  cCtx.fillStyle = `rgb(${tone}, ${Math.floor(tone * 0.5)}, ${Math.floor(tone * 0.3)})`;
                  cCtx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);

                  cCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  cCtx.fillRect(bx - bw / 2, by + bh / 2 - 2, bw, 2);
                  cCtx.fillRect(bx + bw / 2 - 2, by - bh / 2, 2, bh);
                }

                // Sunken Central Pit (Deep Abyss Rectangles)
                const pitW = CS * 0.52;
                const pitH = CS * 0.48;
                cCtx.fillStyle = '#050201';
                cCtx.fillRect(ocx - pitW / 2, ocy - pitH / 2, pitW, pitH);

                const innerPitW = CS * 0.36;
                const innerPitH = CS * 0.32;
                cCtx.fillStyle = '#010000';
                cCtx.fillRect(ocx - innerPitW / 2, ocy - innerPitH / 2, innerPitW, innerPitH);

                craterCache.set(craterKey, offscreenCrater);
              }

              bgCtx.save();
              if (offscreenCrater) {
                bgCtx.drawImage(offscreenCrater, cx - CS, cy - CS);
              }

              // 4. Molten Magma Core (Deep glowing core rendered live on main canvas)
              const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.003 + seed);
              const magmaW = CS * 0.22;
              const magmaH = CS * 0.20;

              bgCtx.save();
              bgCtx.shadowColor = 'rgba(255, 60, 0, 0.8)';
              bgCtx.shadowBlur = 12 * pulse;
              bgCtx.fillStyle = `rgba(220, 50, 0, ${pulse * 0.9})`;
              bgCtx.fillRect(cx - magmaW / 2, cy - magmaH / 2, magmaW, magmaH);

              // Hot inner molten core
              bgCtx.fillStyle = `rgba(255, 160, 30, ${pulse * 0.95})`;
              bgCtx.fillRect(cx - magmaW * 0.3, cy - magmaH * 0.3, magmaW * 0.6, magmaH * 0.6);

              // Molten gold center sliver
              bgCtx.fillStyle = `rgba(255, 240, 180, ${pulse})`;
              bgCtx.fillRect(cx - magmaW * 0.12, cy - magmaH * 0.12, magmaW * 0.24, magmaH * 0.24);
              bgCtx.shadowBlur = 0;
              bgCtx.shadowColor = 'transparent';
              bgCtx.restore();

              bgCtx.shadowBlur = 0;
              bgCtx.shadowColor = 'transparent';
              bgCtx.restore();
            } else if (t.type === 'magmaShards') {
              bgCtx.save();
              bgCtx.fillStyle = 'rgba(255, 60, 0, 0.25)';
              bgCtx.fillRect(x, y, CS, CS);
              bgCtx.strokeStyle = 'rgba(255, 120, 0, 0.7)';
              bgCtx.lineWidth = 1.5;
              bgCtx.strokeRect(x + 2, y + 2, CS - 4, CS - 4);
              bgCtx.restore();
            } else if (t.type === 'icyGround') {
              bgCtx.save();
              bgCtx.fillStyle = 'rgba(0, 200, 255, 0.2)';
              bgCtx.fillRect(x, y, CS, CS);
              bgCtx.strokeStyle = 'rgba(100, 220, 255, 0.6)';
              bgCtx.lineWidth = 1.5;
              bgCtx.strokeRect(x + 2, y + 2, CS - 4, CS - 4);
              bgCtx.restore();
            }
          });
        }
        bgCtx.restore();
      }


}

export function renderInteractiveReticles(ctx, currentGs, isAshLocal, CS, mousePos, hoveredAbilityKey) {

      // Draw Shrine Circle
      const shrineCx = 5 * CS;
      const shrineCy = 5 * CS;
      const shrineRadius = CS * 1.0;
      ctx.save();
      if (currentGs.shrineIsOverloaded) {
        ctx.strokeStyle = `rgba(255, 30, 30, ${0.7 + 0.3 * Math.sin(performance.now() * 0.01)})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 15;
      } else if (currentGs.shrineChargeLevel > 0) {
        ctx.strokeStyle = `rgba(186, 85, 211, ${0.7 + 0.3 * Math.sin(performance.now() * 0.005)})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = 'mediumpurple';
        ctx.shadowBlur = 12;
      } else {
        // Subtle ancient arcane resonance ring (blends smoothly into the stone dais art, NO raw yellow wire)
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(192, 132, 252, 0.4)';
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.arc(shrineCx, shrineCy, shrineRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw Selected Piece Movement: Highlight possible move region, and highlight final spot a bit
      if (currentGs.selectedPiece && currentGs.currentState !== 'ABILITY_TARGETING' && !hoveredAbilityKey && currentGs.currentState !== 'TETHER_TARGETING' && currentGs.currentState !== 'WALL_PLACEMENT_FIRST' && currentGs.currentState !== 'WALL_PLACEMENT_SECOND') {
        const selP = currentGs.selectedPiece;
        const selCenterC = selP.col + 0.5;
        const selCenterR = selP.row + 0.5;
        const selCx = selCenterC * CS;
        const selCy = selCenterR * CS;
        const maxRadius = (typeof getPieceMoveRadius === 'function') ? getPieceMoveRadius(selP, currentGs) : (selP.agility || 2);
        const moveRadiusPx = maxRadius * CS;
        const isSnow = selP.team === 'snow';
        const primaryColor = isSnow ? 'rgba(56, 189, 248, ' : 'rgba(249, 115, 22, ';
        const glowColor = isSnow ? 'rgba(56, 189, 248, 0.65)' : 'rgba(239, 68, 68, 0.65)';

        ctx.save();

        // 1. Highlight the possible move region
        const moveGrad = ctx.createRadialGradient(selCx, selCy, moveRadiusPx * 0.25, selCx, selCy, moveRadiusPx);
        moveGrad.addColorStop(0, `${primaryColor}0.0)`);
        moveGrad.addColorStop(0.7, `${primaryColor}0.05)`);
        moveGrad.addColorStop(1, `${primaryColor}0.13)`);

        ctx.fillStyle = moveGrad;
        ctx.beginPath();
        ctx.arc(selCx, selCy, moveRadiusPx, 0, Math.PI * 2);
        ctx.fill();

        // Elegant perimeter line defining the possible move boundary
        ctx.strokeStyle = `${primaryColor}0.55)`;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(selCx, selCy, moveRadiusPx, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Highlight the final destination spot under the mouse with exact pixel synchronization
        if (mousePos && mousePos.active) {
          const mouseR = mousePos.r;
          const mouseC = mousePos.c;
          const mouseDist = Math.hypot(mouseC - selCenterC, mouseR - selCenterR);

          if (mouseDist <= maxRadius + 0.15) {
            // Exact canvas coordinates matching mouse position directly (zero offset)
            const mCx = mouseC * CS;
            const mCy = mouseR * CS;

            // Check if hovering near an enemy piece to attack
            const nearbyEnemy = (currentGs.pieces || []).find(
              p => p.team !== selP.team && Math.hypot((p.row + 0.5) - mouseR, (p.col + 0.5) - mouseC) <= 0.65
            );

            if (nearbyEnemy) {
              const enCx = (nearbyEnemy.col + 0.5) * CS;
              const enCy = (nearbyEnemy.row + 0.5) * CS;
              
              // Tactical corner brackets framing the enemy
              const effR = CS * 0.44;
              const bracketLen = CS * 0.14;

              ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
              ctx.lineWidth = 1.6;
              ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
              ctx.shadowBlur = 6;

              // Top-Left
              ctx.beginPath();
              ctx.moveTo(enCx - effR, enCy - effR + bracketLen);
              ctx.lineTo(enCx - effR, enCy - effR);
              ctx.lineTo(enCx - effR + bracketLen, enCy - effR);
              ctx.stroke();

              // Top-Right
              ctx.beginPath();
              ctx.moveTo(enCx + effR - bracketLen, enCy - effR);
              ctx.lineTo(enCx + effR, enCy - effR);
              ctx.lineTo(enCx + effR, enCy - effR + bracketLen);
              ctx.stroke();

              // Bottom-Left
              ctx.beginPath();
              ctx.moveTo(enCx - effR, enCy + effR - bracketLen);
              ctx.lineTo(enCx - effR, enCy + effR);
              ctx.lineTo(enCx - effR + bracketLen, enCy + effR);
              ctx.stroke();

              // Bottom-Right
              ctx.beginPath();
              ctx.moveTo(enCx + effR - bracketLen, enCy + effR);
              ctx.lineTo(enCx + effR, enCy + effR);
              ctx.lineTo(enCx + effR, enCy + effR - bracketLen);
              ctx.stroke();
            } else {
              // Highlight the final spot a bit
              const spotRadius = CS * 0.38;

              // Soft radial destination ground glow
              const spotGrad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, spotRadius);
              if (isSnow) {
                spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.26)');
                spotGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.08)');
                spotGrad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
              } else {
                spotGrad.addColorStop(0, 'rgba(239, 68, 68, 0.26)');
                spotGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.08)');
                spotGrad.addColorStop(1, 'rgba(185, 28, 28, 0.0)');
              }

              ctx.fillStyle = spotGrad;
              ctx.beginPath();
              ctx.arc(mCx, mCy, spotRadius, 0, Math.PI * 2);
              ctx.fill();

              // Clean destination ring
              ctx.strokeStyle = isSnow ? 'rgba(186, 230, 253, 0.65)' : 'rgba(254, 215, 170, 0.65)';
              ctx.lineWidth = 1.3;
              ctx.shadowColor = isSnow ? 'rgba(56, 189, 248, 0.45)' : 'rgba(239, 68, 68, 0.45)';
              ctx.shadowBlur = 5;
              ctx.beginPath();
              ctx.arc(mCx, mCy, spotRadius, 0, Math.PI * 2);
              ctx.stroke();

              // Subtle center pip
              ctx.fillStyle = isSnow ? 'rgba(224, 242, 254, 0.85)' : 'rgba(254, 240, 138, 0.85)';
              ctx.shadowBlur = 3;
              ctx.beginPath();
              ctx.arc(mCx, mCy, 2.0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }

      // Valid Ability Usage Circle & Vector Targeting Reticles
      const activeHoveredAbility = hoveredAbilityKey;
      const isAbilityActive = (currentGs.currentState === 'ABILITY_TARGETING' || !!activeHoveredAbility) && currentGs.selectedPiece;

      if (isAbilityActive) {
        const caster = currentGs.selectedPiece;
        const abilityKey = currentGs.abilityContext?.abilityKey || activeHoveredAbility || caster.ability?.key;
        const ability = C.ABILITIES[abilityKey];

        if (ability) {
          const casterCenterC = caster.col + 0.5;
          const casterCenterR = caster.row + 0.5;
          const cCx = casterCenterC * CS;
          const cCy = casterCenterR * CS;
          const isTestCaster = currentGs.testMode && ['ashMagmaShaper', 'snowFrostLord', 'ashAshTyrant', 'snowGlacialMage', 'snowSoulLinker', 'ashAshReaper', 'snowIceWisp'].includes(caster.key);
          const maxEffectiveRange = isTestCaster ? 10 : (ability.range !== undefined ? ability.range : 2.5);
          const rangePx = maxEffectiveRange * CS;
          const radiusPx = (ability.radius || (abilityKey === 'ObsidianPillar' ? 1.0 : 2.0)) * CS;
          const isSnow = caster.team === 'snow';

          ctx.save();

          // 1. Valid Ability Usage Circle — Luminous radial aura fill
          const animTime = performance.now() * 0.002;
          const pulse = Math.sin(animTime * 2.5) * 0.03;

          const rangeGrad = ctx.createRadialGradient(cCx, cCy, rangePx * 0.2, cCx, cCy, rangePx);
          if (isSnow) {
            rangeGrad.addColorStop(0, `rgba(186, 230, 253, ${0.06 + pulse})`);
            rangeGrad.addColorStop(0.7, `rgba(56, 189, 248, ${0.12 + pulse})`);
            rangeGrad.addColorStop(1, `rgba(14, 165, 233, ${0.22 + pulse * 1.5})`);
          } else {
            rangeGrad.addColorStop(0, `rgba(254, 240, 138, ${0.06 + pulse})`);
            rangeGrad.addColorStop(0.7, `rgba(245, 158, 11, ${0.12 + pulse})`);
            rangeGrad.addColorStop(1, `rgba(239, 68, 68, ${0.22 + pulse * 1.5})`);
          }
          ctx.fillStyle = rangeGrad;
          ctx.beginPath();
          ctx.arc(cCx, cCy, rangePx, 0, Math.PI * 2);
          ctx.fill();

          // 1b. Dynamic Vision Blocking & Line-of-Sight Indicators (No heavy blackening cone overlays)
          // Line-of-sight checks are evaluated dynamically for the targeting reticle/guide line without casting dark shadow cones across the board.
          const isSkyAbility = ['FrostfallBlessing', 'ReignOfFire', 'GlacialFracture'].includes(abilityKey);

          // 2. High-Luminance Perimeter Boundary Ring (The crisp boundary of valid range)
          ctx.strokeStyle = isSnow ? 'rgba(186, 230, 253, 0.95)' : 'rgba(254, 240, 138, 0.95)';
          ctx.lineWidth = 2.4;
          ctx.shadowColor = isSnow ? '#38bdf8' : '#f59e0b';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cCx, cCy, rangePx, 0, Math.PI * 2);
          ctx.stroke();

          // 3. Counter-Rotating Outer Dashed Rune Arc
          ctx.save();
          ctx.translate(cCx, cCy);
          ctx.rotate(-animTime * 0.5);
          ctx.strokeStyle = isSnow ? 'rgba(56, 189, 248, 0.65)' : 'rgba(239, 68, 68, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([8, 10]);
          ctx.beginPath();
          ctx.arc(0, 0, rangePx + 4, 0, Math.PI * 2);
          ctx.stroke();

          // 4. Subtle Cardinal Runic Ticks at 0, 90, 180, 270 degrees
          for (let a = 0; a < 4; a++) {
            const tickAngle = (a * Math.PI) / 2;
            const inR = rangePx - 6;
            const outR = rangePx + 7;
            ctx.strokeStyle = isSnow ? '#ffffff' : '#fef08a';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(Math.cos(tickAngle) * inR, Math.sin(tickAngle) * inR);
            ctx.lineTo(Math.cos(tickAngle) * outR, Math.sin(tickAngle) * outR);
            ctx.stroke();
          }
          ctx.restore();

          // 5. Targeting Reticle / Cursor
          if (mousePos && mousePos.active) {
            const mR = mousePos.r;
            const mC = mousePos.c;
            const distFromCaster = Math.hypot(mC - casterCenterC, mR - casterCenterR);
            let isValidTarget = distFromCaster <= maxEffectiveRange + 0.15;
            const mCx = mC * CS;
            const mCy = mR * CS;

            // Line-of-sight obstruction check for mouse hover
            const targetPiece = C.getPieceAt(mR, mC, currentGs.pieces);
            let isVisionBlocked = false;
            let blockerInfo = null;
            if (isValidTarget && !isSkyAbility && ability.canBeBlocked !== false) {
              const targetTileR = Math.max(0, Math.min(9, Math.floor(mR)));
              const targetTileC = Math.max(0, Math.min(9, Math.floor(mC)));
              const targetR = targetPiece ? targetPiece.row : targetTileR;
              const targetC = targetPiece ? targetPiece.col : targetTileC;
              const losResult = C.hasLineOfSight(caster.row, caster.col, targetR, targetC, currentGs, {
                ignoredPieceId: caster.id,
                targetPieceId: targetPiece?.id || null
              });
              if (!losResult.hasLos) {
                isVisionBlocked = true;
                blockerInfo = losResult.blocker;
                isValidTarget = false;
              }
            }

            // Targeting guide line from caster to reticle
            ctx.save();
            ctx.lineWidth = 1.5;
            if (isValidTarget) {
              ctx.strokeStyle = isSnow ? 'rgba(186, 230, 253, 0.45)' : 'rgba(254, 240, 138, 0.45)';
              ctx.setLineDash([4, 6]);
              ctx.beginPath();
              ctx.moveTo(cCx, cCy);
              ctx.lineTo(mCx, mCy);
              ctx.stroke();
            } else if (isVisionBlocked) {
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.moveTo(cCx, cCy);
              if (blockerInfo) {
                const bX = (blockerInfo.col + 0.5) * CS;
                const bY = (blockerInfo.row + 0.5) * CS;
                ctx.lineTo(bX, bY);
                ctx.stroke();

                // Collision impact ring at blocker
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(bX, bY, 0.42 * CS, 0, Math.PI * 2);
                ctx.stroke();
              } else {
                ctx.lineTo(mCx, mCy);
                ctx.stroke();
              }
            } else {
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.moveTo(cCx, cCy);
              ctx.lineTo(mCx, mCy);
              ctx.stroke();
            }
            ctx.restore();

            if (isVisionBlocked) {
              ctx.save();
              ctx.translate(mCx, mCy);
              // Red obstruction ring
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
              ctx.beginPath();
              ctx.arc(0, 0, 14, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Diagonal slash
              ctx.beginPath();
              ctx.moveTo(-9, -9);
              ctx.lineTo(9, 9);
              ctx.stroke();

              // Badge text
              ctx.font = 'bold 10px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#fca5a5';
              ctx.shadowColor = 'rgba(0,0,0,0.9)';
              ctx.shadowBlur = 4;
              ctx.fillText('BLOCKED', 0, 22);
              ctx.restore();
            } else if (['FrostfallBlessing', 'ReignOfFire', 'GlacialFracture'].includes(abilityKey)) {
              if (isValidTarget) {
                ctx.setLineDash([]);
                if (abilityKey === 'FrostfallBlessing') {
                  const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                  grad.addColorStop(0, 'rgba(186, 230, 253, 0.38)');
                  grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.18)');
                  grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
                  ctx.lineWidth = 2.2;
                  ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
                  ctx.shadowBlur = 12;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.stroke();

                  // Diamond Frost Rune at center
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(mCx, mCy - 12);
                  ctx.lineTo(mCx + 12, mCy);
                  ctx.lineTo(mCx, mCy + 12);
                  ctx.lineTo(mCx - 12, mCy);
                  ctx.closePath();
                  ctx.stroke();
                } else if (abilityKey === 'ReignOfFire') {
                  const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                  grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
                  grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.2)');
                  grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
                  ctx.lineWidth = 2.2;
                  ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
                  ctx.shadowBlur = 12;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.stroke();

                  // Flaming Crosshair at center
                  ctx.strokeStyle = '#ffedd5';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(mCx - 14, mCy);
                  ctx.lineTo(mCx + 14, mCy);
                  ctx.moveTo(mCx, mCy - 14);
                  ctx.lineTo(mCx, mCy + 14);
                  ctx.stroke();
                } else if (abilityKey === 'GlacialFracture') {
                  const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                  grad.addColorStop(0, 'rgba(165, 243, 252, 0.4)');
                  grad.addColorStop(0.8, 'rgba(6, 182, 212, 0.18)');
                  grad.addColorStop(1, 'rgba(8, 145, 178, 0)');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = 'rgba(165, 243, 252, 0.95)';
                  ctx.lineWidth = 2.2;
                  ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
                  ctx.shadowBlur = 12;
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                  ctx.stroke();

                  // Crystalline crosshair
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 1.8;
                  ctx.beginPath();
                  ctx.moveTo(mCx - 8, mCy);
                  ctx.lineTo(mCx + 8, mCy);
                  ctx.moveTo(mCx, mCy - 8);
                  ctx.lineTo(mCx, mCy + 8);
                  ctx.stroke();
                }
              } else {
                // Out of range indicator at mouse position
                ctx.save();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(mCx - 6, mCy - 6);
                ctx.lineTo(mCx + 6, mCy + 6);
                ctx.moveTo(mCx + 6, mCy - 6);
                ctx.lineTo(mCx - 6, mCy + 6);
                ctx.stroke();
                ctx.restore();
              }
            } else if (abilityKey === 'ObsidianPillar') {
              if (isValidTarget) {
                const targetPiece = C.getPieceAt(mR, mC, currentGs.pieces);
                const isWall = (currentGs.glacialWalls || []).some(w => w.row === mR && w.col === mC);
                const isVoid = (currentGs.voidSquares || []).some(v => v.row === mR && v.col === mC);
                const isCrater = (currentGs.specialTerrains || []).some(t => t.type === 'crater' && Math.round(t.row) === mR && Math.round(t.col) === mC);

                if (targetPiece) {
                  if (targetPiece.team === caster.team) {
                    // MODE 1: Friendly Ally -> Protective Obsidian Shield Hexagon
                    ctx.save();
                    const shieldR = CS * 0.44;
                    ctx.strokeStyle = 'rgba(192, 132, 252, 0.95)';
                    ctx.lineWidth = 2.4;
                    ctx.shadowColor = 'rgba(168, 85, 247, 0.9)';
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = 'rgba(147, 51, 234, 0.22)';
                    ctx.beginPath();
                    for (let h = 0; h < 6; h++) {
                      const ang = (h * Math.PI) / 3 - Math.PI / 6;
                      const hx = mCx + Math.cos(ang) * shieldR;
                      const hy = mCy + Math.sin(ang) * shieldR;
                      if (h === 0) ctx.moveTo(hx, hy);
                      else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = '#f3e8ff';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur = 4;
                    ctx.fillText('+2 SHIELD', mCx, mCy - shieldR - 4);
                    ctx.restore();
                  } else {
                    // MODE 2: Enemy Unit -> Strike + Knockback + Pillar
                    ctx.save();
                    const tgtR = CS * 0.44;
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
                    ctx.lineWidth = 2.2;
                    ctx.shadowColor = 'rgba(239, 68, 68, 0.85)';
                    ctx.shadowBlur = 12;

                    // Corner brackets
                    const bLen = CS * 0.14;
                    ctx.beginPath();
                    ctx.moveTo(mCx - tgtR, mCy - tgtR + bLen);
                    ctx.lineTo(mCx - tgtR, mCy - tgtR);
                    ctx.lineTo(mCx - tgtR + bLen, mCy - tgtR);
                    ctx.moveTo(mCx + tgtR - bLen, mCy - tgtR);
                    ctx.lineTo(mCx + tgtR, mCy - tgtR);
                    ctx.lineTo(mCx + tgtR, mCy - tgtR + bLen);
                    ctx.moveTo(mCx - tgtR, mCy + tgtR - bLen);
                    ctx.lineTo(mCx - tgtR, mCy + tgtR);
                    ctx.lineTo(mCx - tgtR + bLen, mCy + tgtR);
                    ctx.moveTo(mCx + tgtR - bLen, mCy + tgtR);
                    ctx.lineTo(mCx + tgtR, mCy + tgtR);
                    ctx.lineTo(mCx + tgtR, mCy + tgtR - bLen);
                    ctx.stroke();

                    // Direction vector for knockback
                    const dr = targetPiece.row - caster.row;
                    const dc = targetPiece.col - caster.col;
                    const maxDist = Math.max(Math.abs(dr), Math.abs(dc));
                    const stepR = maxDist > 0 ? Math.round(dr / maxDist) : 0;
                    const stepC = maxDist > 0 ? Math.round(dc / maxDist) : 0;
                    const destR = targetPiece.row + stepR;
                    const destC = targetPiece.col + stepC;

                    const canMove = destR >= 0 && destR < 10 && destC >= 0 && destC < 10 &&
                      !C.getPieceAt(destR, destC, currentGs.pieces) &&
                      !(currentGs.glacialWalls || []).some(w => w.row === destR && w.col === destC) &&
                      !(currentGs.voidSquares || []).some(v => v.row === destR && v.col === destC);

                    const arrowDx = stepC * CS * 0.65;
                    const arrowDy = stepR * CS * 0.65;
                    ctx.strokeStyle = canMove ? 'rgba(249, 115, 22, 0.95)' : 'rgba(239, 68, 68, 0.95)';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(mCx, mCy);
                    ctx.lineTo(mCx + arrowDx, mCy + arrowDy);
                    ctx.stroke();

                    ctx.fillStyle = canMove ? '#fed7aa' : '#fecaca';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(canMove ? 'KNOCKBACK' : 'COLLISION (DAZE)', mCx, mCy + tgtR + 12);
                    ctx.restore();
                  }
                } else if (!isWall && !isVoid && !isCrater) {
                  // MODE 3: Empty Tile -> Minimal Obsidian Pillar Reticle Preview
                  ctx.save();
                  const pW = CS * 0.32;
                  const pH = CS * 0.32;
                  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
                  ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
                  ctx.lineWidth = 1.2;
                  ctx.strokeRect(mCx - pW, mCy - pH, pW * 2, pH * 2);

                  // Minimal corner tick accents
                  const cLen = CS * 0.08;
                  ctx.strokeStyle = '#f8fafc';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  // Top-left
                  ctx.moveTo(mCx - pW, mCy - pH + cLen);
                  ctx.lineTo(mCx - pW, mCy - pH);
                  ctx.lineTo(mCx - pW + cLen, mCy - pH);
                  // Top-right
                  ctx.moveTo(mCx + pW - cLen, mCy - pH);
                  ctx.lineTo(mCx + pW, mCy - pH);
                  ctx.lineTo(mCx + pW, mCy - pH + cLen);
                  // Bottom-left
                  ctx.moveTo(mCx - pW, mCy + pH - cLen);
                  ctx.lineTo(mCx - pW, mCy + pH);
                  ctx.lineTo(mCx - pW + cLen, mCy + pH);
                  // Bottom-right
                  ctx.moveTo(mCx + pW - cLen, mCy + pH);
                  ctx.lineTo(mCx + pW, mCy + pH);
                  ctx.lineTo(mCx + pW, mCy + pH - cLen);
                  ctx.stroke();

                  // Subtle center dot
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, 2, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
                } else {
                  // Blocked terrain
                  ctx.save();
                  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                  ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
                  ctx.lineWidth = 2;
                  ctx.setLineDash([4, 4]);
                  ctx.beginPath();
                  ctx.arc(mCx, mCy, CS * 0.4, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                  ctx.restore();
                }
              } else {
                ctx.save();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(mCx, mCy, CS * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              }
            } else {
              // Single target or other abilities
              const targetR = 0.5 * CS;
              ctx.save();
              ctx.strokeStyle = isValidTarget ? (isSnow ? 'rgba(56, 189, 248, 0.9)' : 'rgba(245, 158, 11, 0.9)') : 'rgba(239, 68, 68, 0.7)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(mCx, mCy, targetR, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          ctx.restore();
        }
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
}

export function renderEnvironmentalEffects(ctx, currentGs, isAshLocal, CS, dt, ambientSnowRef, ambientEmbersRef) {
      // Draw all particle systems from effects.js
      if (Effects.drawParticles) Effects.drawParticles(currentGs);
      if (Effects.drawGroundEffectParticles) Effects.drawGroundEffectParticles(currentGs);
      if (Effects.drawSiphonParticles) Effects.drawSiphonParticles(currentGs);
      if (Effects.drawProjectiles) Effects.drawProjectiles(currentGs);
      if (Effects.drawHelpFromAboveFog) Effects.drawHelpFromAboveFog(ctx, currentGs);
      if (Effects.drawHelpFromAboveVapors) Effects.drawHelpFromAboveVapors(ctx, currentGs);

      // Draw specific ability special animation ticks
      if (Effects.drawFrenziedDashAnimations) Effects.drawFrenziedDashAnimations(currentGs);
      if (Effects.drawSummonWispAnimations) Effects.drawSummonWispAnimations(currentGs);
      if (Effects.drawLavaGlobAnimations) Effects.drawLavaGlobAnimations(currentGs);
      if (Effects.drawTrapDeployments) Effects.drawTrapDeployments(currentGs);
      if (Effects.drawTrapTriggerAnimations) Effects.drawTrapTriggerAnimations(currentGs);
      if (Effects.drawFrigidPathAnimations) Effects.drawFrigidPathAnimations(currentGs);
      if (Effects.drawGlacialWallAnimations) Effects.drawGlacialWallAnimations(currentGs);
      if (Effects.drawPummelKnockbackAnimations) Effects.drawPummelKnockbackAnimations(currentGs);
      if (Effects.drawVentAnimations) Effects.drawVentAnimations(currentGs);
      if (Effects.drawGlacialFractureAnimations) Effects.drawGlacialFractureAnimations(currentGs);
      if (Effects.drawAColdFarewellAnimations) Effects.drawAColdFarewellAnimations(currentGs);
      if (Effects.drawObsidianPillarAnimations) Effects.drawObsidianPillarAnimations(currentGs);

      // Draw persistent Blizzard Storms (4-turn healing and swirling frost aura from A Cold Farewell)
      if (currentGs.blizzardStorms && currentGs.blizzardStorms.length > 0) {
        currentGs.blizzardStorms.forEach((storm, sIdx) => {
          const sCx = (storm.c + 0.5) * CS;
          const sCy = (storm.r + 0.5) * CS;
          const sRadiusPx = (storm.radius || 1.5) * CS;
          const animTime = performance.now() * 0.002;

          ctx.save();
          // Swirling frost mist radial gradient
          const stormGrad = ctx.createRadialGradient(sCx, sCy, 0, sCx, sCy, sRadiusPx);
          const pulse = Math.sin(animTime * 1.5 + sIdx) * 0.08;
          stormGrad.addColorStop(0, `rgba(186, 230, 253, ${0.28 + pulse})`);
          stormGrad.addColorStop(0.65, `rgba(56, 189, 248, ${0.12 + pulse * 0.5})`);
          stormGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = stormGrad;
          ctx.beginPath();
          ctx.arc(sCx, sCy, sRadiusPx, 0, Math.PI * 2);
          ctx.fill();

          // Rotating dashed crystalline border with cyan glow
          ctx.save();
          ctx.translate(sCx, sCy);
          ctx.rotate(animTime * 0.4);
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.7)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([8, 8]);
          ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, sRadiusPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Floating healing ice sparkles
          for (let sp = 0; sp < 6; sp++) {
            const spAngle = animTime * 0.8 + (sp * Math.PI / 3);
            const spDist = sRadiusPx * (0.3 + 0.45 * Math.sin(animTime + sp));
            const spX = sCx + Math.cos(spAngle) * spDist;
            const spY = sCy + Math.sin(spAngle) * spDist;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(spX, spY, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });
      }

      // Track known remnants to detect expiration and trigger smooth thawing exit transition
      if (!currentGs.gameStarted) {
        currentGs.knownGlacialRemnants = [];
        currentGs.dyingGlacialRemnants = [];
        currentGs.glacialRemnants = [];
        currentGs.blizzardStorms = [];
      } else {
        if (!currentGs.knownGlacialRemnants) currentGs.knownGlacialRemnants = [];
        if (!currentGs.dyingGlacialRemnants) currentGs.dyingGlacialRemnants = [];

        if (currentGs.glacialRemnants?.length || currentGs.knownGlacialRemnants.length) {
          const activeRemnantKeys = (currentGs.glacialRemnants || []).map(r => `${r.r},${r.c}`);
          currentGs.knownGlacialRemnants.forEach(known => {
            if (!activeRemnantKeys.includes(`${known.r},${known.c}`)) {
              currentGs.dyingGlacialRemnants.push({ ...known, thawLife: 1.0 });
            }
          });
          currentGs.knownGlacialRemnants = (currentGs.glacialRemnants || []).map(r => ({ ...r }));
        }
      }

      // Draw persistent Glacial Fracture Remnants (frost fissures, glassy ice glaze, protruding crystal shards)
      if (currentGs.glacialRemnants && currentGs.glacialRemnants.length > 0) {
        currentGs.glacialRemnants.forEach((remnant, rIdx) => {
          const rCx = (remnant.c + 0.5) * CS;
          const rCy = (remnant.r + 0.5) * CS;
          const rRadiusPx = (remnant.radius || 2) * CS;
          const animTime = performance.now() * 0.0015;
          const fadeRatio = Math.max(0.35, remnant.duration / (remnant.maxDuration || 3));

          ctx.save();

          // 1. Frosted permafrost ground glaze covering the fractured zone
          const glazeGrad = ctx.createRadialGradient(rCx, rCy, 0, rCx, rCy, rRadiusPx);
          const glazePulse = Math.sin(animTime * 1.2 + rIdx) * 0.03;
          glazeGrad.addColorStop(0, `rgba(224, 242, 254, ${(0.38 + glazePulse) * fadeRatio})`);
          glazeGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(0.22 + glazePulse * 0.5) * fadeRatio})`);
          glazeGrad.addColorStop(0.85, `rgba(14, 116, 144, ${(0.14 + glazePulse * 0.3) * fadeRatio})`);
          glazeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = glazeGrad;
          ctx.beginPath();
          ctx.arc(rCx, rCy, rRadiusPx, 0, Math.PI * 2);
          ctx.fill();

          // 2. Persistent Jagged Permafrost Fissures (Thick, glowing cyan cracks with white cores)
          if (remnant.crackPaths && remnant.crackPaths.length > 0) {
            ctx.save();
            ctx.translate(rCx, rCy);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Pass A: Glowing cyan outer halo
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 * fadeRatio})`;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 4 * fadeRatio;

            remnant.crackPaths.forEach(path => {
              if (path.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(path[0].c * CS, path[0].r * CS);
              for (let pt = 1; pt < path.length; pt++) {
                ctx.lineTo(path[pt].c * CS, path[pt].r * CS);
              }
              ctx.stroke();
            });

            // Pass B: Crisp white-hot crystalline core
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * fadeRatio})`;
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.8 * fadeRatio;

            remnant.crackPaths.forEach(path => {
              if (path.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(path[0].c * CS, path[0].r * CS);
              for (let pt = 1; pt < path.length; pt++) {
                ctx.lineTo(path[pt].c * CS, path[pt].r * CS);
              }
              ctx.stroke();
            });

            ctx.restore();
          }

          // 3. Protruding faceted Ice Crystals (Prominent crystalline spires with specular gleam)
          if (remnant.crystals && remnant.crystals.length > 0) {
            remnant.crystals.forEach((cryst, cIdx) => {
              const cX = rCx + cryst.relC * CS;
              const cY = rCy + cryst.relR * CS;
              const cSize = (cryst.size || 0.4) * CS * fadeRatio;
              const glint = (Math.sin(animTime * 2.2 + cIdx * 1.5) + 1) * 0.5;

              ctx.save();
              ctx.translate(cX, cY);
              ctx.rotate(cryst.angle || 0);

              // Crystal Shadow / Frost Base
              ctx.fillStyle = `rgba(14, 116, 144, ${0.4 * fadeRatio})`;
              ctx.beginPath();
              ctx.ellipse(0, cSize * 0.25, cSize * 0.6, cSize * 0.2, 0, 0, Math.PI * 2);
              ctx.fill();

              // Facet A: Brilliant Ice-Cyan highlight
              ctx.fillStyle = `rgba(224, 242, 254, ${(0.82 + glint * 0.18) * fadeRatio})`;
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(0, -cSize);
              ctx.lineTo(-cSize * 0.45, cSize * 0.3);
              ctx.lineTo(0, cSize * 0.15);
              ctx.closePath();
              ctx.fill();

              // Facet B: Deep Glacial Blue facet
              ctx.fillStyle = `rgba(56, 189, 248, ${(0.72 + glint * 0.15) * fadeRatio})`;
              ctx.beginPath();
              ctx.moveTo(0, -cSize);
              ctx.lineTo(cSize * 0.45, cSize * 0.3);
              ctx.lineTo(0, cSize * 0.15);
              ctx.closePath();
              ctx.fill();

              // Facet C: Specular spine and diamond facet border
              ctx.strokeStyle = `rgba(255, 255, 255, ${(0.92 + glint * 0.08) * fadeRatio})`;
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(0, -cSize);
              ctx.lineTo(0, cSize * 0.15);
              ctx.moveTo(-cSize * 0.45, cSize * 0.3);
              ctx.lineTo(0, -cSize);
              ctx.lineTo(cSize * 0.45, cSize * 0.3);
              ctx.stroke();

              ctx.restore();
            });
          }

          // 4. Floating Frost Motes / Glimmer
          for (let m = 0; m < 5; m++) {
            const mAngle = animTime * 0.6 + (m * Math.PI * 2 / 5);
            const mDist = rRadiusPx * (0.2 + 0.35 * Math.sin(animTime * 0.8 + m));
            const mX = rCx + Math.cos(mAngle) * mDist;
            const mY = rCy + Math.sin(mAngle) * mDist - (animTime * 10 % 18);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * fadeRatio})`;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(mX, mY, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });
      }

      // Draw dying / thawing Glacial Fracture Remnants (smooth melting exit transition)
      for (let dIdx = currentGs.dyingGlacialRemnants.length - 1; dIdx >= 0; dIdx--) {
        const dying = currentGs.dyingGlacialRemnants[dIdx];
        dying.thawLife -= 0.024; // ~40 frames smooth thaw
        if (dying.thawLife <= 0) {
          currentGs.dyingGlacialRemnants.splice(dIdx, 1);
          continue;
        }

        const rCx = (dying.c + 0.5) * CS;
        const rCy = (dying.r + 0.5) * CS;
        const rRadiusPx = (dying.radius || 2) * CS;
        const fadeRatio = dying.thawLife * 0.35;

        ctx.save();
        // Fading permafrost ground glaze
        const glazeGrad = ctx.createRadialGradient(rCx, rCy, 0, rCx, rCy, rRadiusPx);
        glazeGrad.addColorStop(0, `rgba(224, 242, 254, ${0.35 * fadeRatio})`);
        glazeGrad.addColorStop(0.6, `rgba(56, 189, 248, ${0.15 * fadeRatio})`);
        glazeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glazeGrad;
        ctx.beginPath();
        ctx.arc(rCx, rCy, rRadiusPx, 0, Math.PI * 2);
        ctx.fill();

        // Melting crystals evaporating
        if (dying.crystals) {
          dying.crystals.forEach(cryst => {
            const cX = rCx + cryst.relC * CS;
            const cY = rCy + cryst.relR * CS;
            const cSize = (cryst.size || 0.4) * CS * fadeRatio;
            ctx.save();
            ctx.translate(cX, cY);
            ctx.rotate(cryst.angle || 0);
            ctx.fillStyle = `rgba(224, 242, 254, ${0.7 * fadeRatio})`;
            ctx.beginPath();
            ctx.moveTo(0, -cSize);
            ctx.lineTo(-cSize * 0.4, cSize * 0.3);
            ctx.lineTo(cSize * 0.4, cSize * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          });
        }

        // Rising thaw steam vapor motes
        for (let s = 0; s < 4; s++) {
          const steamAngle = (s * Math.PI / 2) + dying.thawLife * 2;
          const steamDist = rRadiusPx * (0.25 + 0.25 * s);
          const sX = rCx + Math.cos(steamAngle) * steamDist;
          const sY = rCy + Math.sin(steamAngle) * steamDist - (1 - dying.thawLife) * 30;
          ctx.fillStyle = `rgba(224, 242, 254, ${dying.thawLife * 0.45})`;
          ctx.beginPath();
          ctx.arc(sX, sY, 2.2 * dying.thawLife, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
      if (Effects.drawFrostfallBlessingAnimations) Effects.drawFrostfallBlessingAnimations(currentGs);
      if (Effects.drawGuardianSaveAnimations) Effects.drawGuardianSaveAnimations(ctx, currentGs);
      if (Effects.drawFateLinkAnimations) Effects.drawFateLinkAnimations(ctx, currentGs);
      if (Effects.drawReignOfFireAnimations) Effects.drawReignOfFireAnimations(currentGs);
      if (Effects.drawDeathMeteorAnimations) Effects.drawDeathMeteorAnimations(currentGs);

      // Shield break shatter animations
      if (Effects.drawShieldBreakAnimations) {
        Effects.drawShieldBreakAnimations(ctx, currentGs);
      }

      if (Effects.drawShrineEffects) Effects.drawShrineEffects(currentGs);

      // ── Cast-frame ability animations (ring expand + spike rays per frame) ──
      drawCastAnimations(ctx, currentGs, CS);

      // --- Ambient Elemental Territory Effects & Contested Frontline Particle Tension ---
      const isReducedMotion = typeof window !== 'undefined' && (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('reduced-motion') ||
        document.body.classList.contains('reduced-motion')
      );

      if (!isReducedMotion && currentGs.voronoiData) {
        const voronoi = currentGs.voronoiData;
        const now = performance.now();

        // 1. Ambient Snow across Map (Full intensity in Frost territory, lessened intensity in rest of map)
        const snowCells = voronoi._snowCells || (voronoi._snowCells = (voronoi.cells || []).filter(c => c.team === 'snow' && c.polygon && c.polygon.length >= 3));
        ctx.save();
        while (ambientSnowRef.current.length < 28) {
          const inTerritorySpawn = snowCells.length > 0 && Math.random() < 0.65;
          let sx, sy;
          if (inTerritorySpawn) {
            const cell = snowCells[Math.floor(Math.random() * snowCells.length)];
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * ((cell.radius || 2) * CS * 0.95);
            sx = cell.center.x * CS + Math.cos(ang) * dist;
            sy = cell.center.y * CS + Math.sin(ang) * dist - Math.random() * 20;
          } else {
            sx = Math.random() * C.CANVAS_SIZE;
            sy = Math.random() * C.CANVAS_SIZE * 0.85 - 20;
          }
          ambientSnowRef.current.push({
            x: sx,
            y: sy,
            vy: Math.random() * 0.60 + 0.40,
            vx: (Math.random() - 0.5) * 0.35,
            size: Math.random() * 1.6 + 1.2,
            baseAlpha: Math.random() * 0.35 + 0.45,
            life: Math.floor(Math.random() * 140 + 90),
            maxLife: 230,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.025 + 0.015,
            intensity: inTerritorySpawn ? 1.0 : 0.25
          });
        }

        ctx.shadowColor = 'rgba(186, 230, 253, 0.6)';

        for (let i = ambientSnowRef.current.length - 1; i >= 0; i--) {
          const flake = ambientSnowRef.current[i];
          flake.y += flake.vy;
          flake.sway += flake.swaySpeed;
          flake.x += flake.vx + Math.sin(flake.sway) * 0.28;
          flake.life--;

          // Check if currently inside Frost occupied territory
          const inFrost = isPointInTeamTerritory(flake.x, flake.y, snowCells, CS);
          const targetIntensity = inFrost ? 1.0 : 0.25;
          flake.intensity = flake.intensity !== undefined ? flake.intensity + (targetIntensity - flake.intensity) * 0.12 : targetIntensity;

          const fadeIn = Math.min(1, (flake.maxLife - flake.life) / 25);
          const fadeOut = Math.min(1, flake.life / 25);
          const a = flake.baseAlpha * fadeIn * fadeOut * flake.intensity;

          // Only incur shadow blur compositing for prominent visible flakes in Frost territory (Optimization 8)
          ctx.shadowBlur = (inFrost && a >= 0.15) ? 3 : 0;
          ctx.fillStyle = `rgba(224, 242, 254, ${a})`;
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.size * (inFrost ? 1.0 : 0.85), 0, Math.PI * 2);
          ctx.fill();

          if (flake.life <= 0 || flake.y > C.CANVAS_SIZE || flake.x < 0 || flake.x > C.CANVAS_SIZE) {
            ambientSnowRef.current.splice(i, 1);
          }
        }
        ctx.restore();

        // 3. Ambient Flickering Embers across Map (Full intensity in Ash territory, lessened intensity in rest of map)
        const ashCells = voronoi._ashCells || (voronoi._ashCells = (voronoi.cells || []).filter(c => c.team === 'ash' && c.polygon && c.polygon.length >= 3));
        ctx.save();
        while (ambientEmbersRef.current.length < 28) {
          const inTerritorySpawn = ashCells.length > 0 && Math.random() < 0.65;
          let ex, ey;
          if (inTerritorySpawn) {
            const cell = ashCells[Math.floor(Math.random() * ashCells.length)];
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * ((cell.radius || 2) * CS * 0.95);
            ex = cell.center.x * CS + Math.cos(ang) * dist;
            ey = cell.center.y * CS + Math.sin(ang) * dist + Math.random() * 15;
          } else {
            ex = Math.random() * C.CANVAS_SIZE;
            ey = Math.random() * C.CANVAS_SIZE * 0.85 + 20;
          }
          ambientEmbersRef.current.push({
            x: ex,
            y: ey,
            vy: -(Math.random() * 0.55 + 0.30),
            vx: (Math.random() - 0.5) * 0.35,
            size: Math.random() * 1.8 + 1.1,
            baseAlpha: Math.random() * 0.40 + 0.50,
            life: Math.floor(Math.random() * 130 + 80),
            maxLife: 210,
            flickerSpeed: Math.random() * 0.08 + 0.05,
            seed: Math.random() * 10,
            color: Math.random() > 0.45 ? '255, 80, 20' : '255, 175, 35',
            intensity: inTerritorySpawn ? 1.0 : 0.25
          });
        }

        for (let i = ambientEmbersRef.current.length - 1; i >= 0; i--) {
          const ember = ambientEmbersRef.current[i];
          ember.y += ember.vy;
          ember.x += ember.vx;
          ember.life--;

          // Check if currently inside Ash occupied territory
          const inAsh = isPointInTeamTerritory(ember.x, ember.y, ashCells, CS);
          const targetIntensity = inAsh ? 1.0 : 0.25;
          ember.intensity = ember.intensity !== undefined ? ember.intensity + (targetIntensity - ember.intensity) * 0.12 : targetIntensity;

          const fadeIn = Math.min(1, (ember.maxLife - ember.life) / 20);
          const fadeOut = Math.min(1, ember.life / 20);
          const flick = 0.55 + 0.45 * Math.sin(now * ember.flickerSpeed + ember.seed);
          const a = ember.baseAlpha * fadeIn * fadeOut * Math.max(0.15, flick) * ember.intensity;

          ctx.fillStyle = `rgba(${ember.color}, ${a})`;
          ctx.shadowColor = `rgba(${ember.color}, ${inAsh ? 0.75 : 0.25})`;
          // Only incur shadow blur compositing for prominent visible embers in Ash territory (Optimization 8)
          ctx.shadowBlur = (inAsh && a >= 0.15) ? 4 : 0;
          ctx.beginPath();
          ctx.arc(ember.x, ember.y, ember.size * (inAsh ? 1.0 : 0.85), 0, Math.PI * 2);
          ctx.fill();

          if (ember.life <= 0 || ember.y < 0 || ember.x < 0 || ember.x > C.CANVAS_SIZE) {
            ambientEmbersRef.current.splice(i, 1);
          }
        }
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
}
