import React, { useEffect, useRef } from 'react';
import Piece from './Piece.jsx';
import * as C from '../../../shared/constants.js';
import * as Effects from '../../js/effects.js';
import { getValidMoves, getPieceMoveRadius } from '../../../shared/utils.js';
import { computePowerDiagram, isPointInPolygon } from '../../../shared/voronoi.js';

function isPointInTeamTerritory(px, py, cells, CS) {
  if (!cells || cells.length === 0) return false;
  const gx = px / CS;
  const gy = py / CS;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const dx = gx - cell.center.x;
    const dy = gy - cell.center.y;
    const maxR = (cell.radius || 2.5) * 1.05;
    if (dx * dx + dy * dy > maxR * maxR) continue;
    if (cell.polygon && cell.polygon.length >= 3 && isPointInPolygon(gx, gy, cell.polygon)) {
      return true;
    }
  }
  return false;
}

export default function Board({ 
  gameState, 
  myTeam, 
  onCellClick, 
  onPieceClick,
  onBoardClick,
  onMouseEnterPiece,
  onMouseLeavePiece,
  onMouseMovePiece
}) {
  const canvasRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastAnimTime = useRef(performance.now());
  const effectsCanvasRef = useRef(null);
  const terrCacheCanvasRef = useRef(null);
  const terrCacheKeyRef = useRef('');
  const gradCacheRef = useRef(new Map());

  const playerTeam = gameState?.playerTeam || myTeam || 'snow';
  const isAsh = playerTeam === 'ash';

  const mousePosRef = useRef({ r: -1, c: -1, visualCol: -1, visualRow: -1, active: false });
  const ambientSnowRef = useRef([]);
  const ambientEmbersRef = useRef([]);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // 1. Particle Canvas Overlay Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bgCanvas = bgCanvasRef.current;
    const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;

    // Create memory buffer canvas for effects.js rifts/particles if not created
    if (!effectsCanvasRef.current) {
      const eCanvas = document.createElement('canvas');
      eCanvas.width = C.CANVAS_SIZE;
      eCanvas.height = C.CANVAS_SIZE;
      effectsCanvasRef.current = eCanvas;
    }

    const effectsCtx = effectsCanvasRef.current.getContext('2d');

    // Initialize the effects context
    Effects.initEffects(ctx, effectsCtx);
    if (gameStateRef.current) {
      Effects.initParticles(gameStateRef.current);
    }

    // Background canvas context (territory + shrine, drawn BEHIND pieces)
    // Territory is now rendered via CSS in renderCells() — no bgCanvas needed.

    const animationLoop = (time) => {
      const currentGs = gameStateRef.current;
      if (!currentGs) {
        requestRef.current = requestAnimationFrame(animationLoop);
        return;
      }

      let dt = time - lastAnimTime.current;
      if (dt > 100) dt = 16.67; // Cap dt for smooth animations
      lastAnimTime.current = time;

      // Clear main canvas and background canvas
      ctx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
      if (bgCtx) bgCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

      // Determine orientation once for the whole frame
      const isAshLocal = (currentGs.playerTeam || myTeam || 'snow') === 'ash';
      const CS = C.CANVAS_SIZE / 10;

      // --- Background canvas: Territory Trails (renders UNDER pieces at z-5) ---
      if (bgCtx) {
        bgCtx.save();
        if (isAshLocal) {
          bgCtx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
          bgCtx.rotate(Math.PI);
        }

        const pieces = currentGs.pieces || [];
        const piecesKey = pieces
          .map(p => `${p.id}:${Number(p.col).toFixed(2)},${Number(p.row).toFixed(2)},${p.currentHp},${p.power}`)
          .join('|');
        const newKey = `${piecesKey}_${currentGs.gameStarted ? 1 : 0}_${currentGs.turnCount || 1}`;

        if (newKey !== terrCacheKeyRef.current || !terrCacheCanvasRef.current) {
          terrCacheKeyRef.current = newKey;
          if (!terrCacheCanvasRef.current) {
            terrCacheCanvasRef.current = document.createElement('canvas');
            terrCacheCanvasRef.current.width = C.CANVAS_SIZE;
            terrCacheCanvasRef.current.height = C.CANVAS_SIZE;
          }
          const tCtx = terrCacheCanvasRef.current.getContext('2d');
          tCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

          const voronoi = currentGs.voronoiData || computePowerDiagram(pieces);

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
            const grad = tCtx.createRadialGradient(cx, cy, CS * 0.1, cx, cy, radiusPx);

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

            tCtx.fillStyle = grad;
            tCtx.fill();
            // No strokes on individual friendly cells: allied territory merges seamlessly into one unified domain
          });
        }

        if (terrCacheCanvasRef.current) {
          bgCtx.drawImage(terrCacheCanvasRef.current, 0, 0);
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
              bgCtx.save();
              const seed = (Math.round(t.row) * 73 + Math.round(t.col) * 179);
              // Deterministic PRNG helper so blocks remain rock-solid and stable each frame
              const rnd = (i) => {
                const s = Math.sin(seed * 9.1 + i * 13.37) * 43758.5453;
                return s - Math.floor(s);
              };

              // 1. Base Scorched Earth (Irregular dark charcoal rectangular & square blast slabs)
              const numDebris = 14;
              for (let d = 0; d < numDebris; d++) {
                const dw = CS * (0.28 + rnd(d * 2) * 0.38);
                const dh = CS * (0.28 + rnd(d * 2 + 1) * 0.38);
                const ox = (rnd(d * 3) - 0.5) * CS * 0.88;
                const oy = (rnd(d * 3 + 1) - 0.5) * CS * 0.88;
                const shade = Math.floor(10 + rnd(d) * 15);
                bgCtx.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.38)}, ${Math.floor(shade * 0.18)}, 0.88)`;
                bgCtx.fillRect(cx + ox - dw / 2, cy + oy - dh / 2, dw, dh);
              }

              // 2. Fractured Basalt Rim Blocks (Solid Random Rectangles and Squares, NO orange borders)
              const numBlocks = 14;
              for (let b = 0; b < numBlocks; b++) {
                const angle = (b / numBlocks) * Math.PI * 2 + (rnd(b) - 0.5) * 0.28;
                const dist = CS * (0.20 + rnd(b * 4) * 0.20);
                const bx = cx + Math.cos(angle) * dist;
                const by = cy + Math.sin(angle) * dist;
                const bw = CS * (0.26 + rnd(b * 5) * 0.22);
                const bh = CS * (0.24 + rnd(b * 5 + 1) * 0.22);

                // Deep obsidian rock slab - completely seamless solid dark blocks
                const tone = Math.floor(4 + rnd(b * 3) * 8);
                bgCtx.fillStyle = `rgb(${tone}, ${Math.floor(tone * 0.5)}, ${Math.floor(tone * 0.3)})`;
                bgCtx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);

                // Subtle dark bevel shadow (bottom/right only, NO colored border)
                bgCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                bgCtx.fillRect(bx - bw / 2, by + bh / 2 - 2, bw, 2);
                bgCtx.fillRect(bx + bw / 2 - 2, by - bh / 2, 2, bh);
              }

              // 3. Sunken Central Pit (Deep Abyss Rectangles)
              const pitW = CS * 0.52;
              const pitH = CS * 0.48;
              bgCtx.fillStyle = '#050201';
              bgCtx.fillRect(cx - pitW / 2, cy - pitH / 2, pitW, pitH);

              const innerPitW = CS * 0.36;
              const innerPitH = CS * 0.32;
              bgCtx.fillStyle = '#010000';
              bgCtx.fillRect(cx - innerPitW / 2, cy - innerPitH / 2, innerPitW, innerPitH);

              // 4. Molten Magma Core (Deep glowing core without any line borders)
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
              bgCtx.restore();

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

      // --- Main (foreground) canvas: particles + effects (renders ABOVE pieces) ---
      ctx.save();
      
      // Apply screenshake if active
      if (currentGs.screenshake && currentGs.screenshake.duration > 0) {
        const intensity = currentGs.screenshake.intensity || 5;
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        ctx.translate(dx, dy);
        currentGs.screenshake.duration -= dt;
      }

      // Rotate canvas 180 degrees if playing as Ash
      let didTransform = false;
      if (isAshLocal) {
        ctx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
        ctx.rotate(Math.PI);
        didTransform = true;
      }

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
      if (currentGs.selectedPiece && currentGs.currentState !== 'ABILITY_TARGETING' && currentGs.currentState !== 'TETHER_TARGETING' && currentGs.currentState !== 'WALL_PLACEMENT_FIRST' && currentGs.currentState !== 'WALL_PLACEMENT_SECOND') {
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
        if (mousePosRef.current.active) {
          const mouseR = mousePosRef.current.r;
          const mouseC = mousePosRef.current.c;
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

      // Continuous Vector Ability Reticles for Reworked Units (Phase 4)
      if (currentGs.currentState === 'ABILITY_TARGETING' && currentGs.selectedPiece) {
        const caster = currentGs.selectedPiece;
        const abilityKey = currentGs.abilityContext?.abilityKey || caster.ability?.key;
        const ability = C.ABILITIES[abilityKey];

        if (ability && ['FrostfallBlessing', 'ReignOfFire', 'GlacialFracture', 'ObsidianPillar'].includes(abilityKey)) {
          const casterCenterC = caster.col + 0.5;
          const casterCenterR = caster.row + 0.5;
          const cCx = casterCenterC * CS;
          const cCy = casterCenterR * CS;
          const rangePx = (ability.range || 2.5) * CS;
          const radiusPx = (ability.radius || (abilityKey === 'ObsidianPillar' ? 1.0 : 2.0)) * CS;

          ctx.save();
          // 1. Faint, subtle max range boundary ring
          ctx.strokeStyle = caster.team === 'snow' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)';
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cCx, cCy, rangePx, 0, Math.PI * 2);
          ctx.stroke();

          // 2. Continuous Vector Reticle at Mouse Position
          if (mousePosRef.current.active) {
            const mR = mousePosRef.current.r;
            const mC = mousePosRef.current.c;
            const distFromCaster = Math.hypot(mC - casterCenterC, mR - casterCenterR);

            if (distFromCaster <= (ability.range || 2.5) + 0.15) {
              const mCx = mC * CS;
              const mCy = mR * CS;

              ctx.setLineDash([]);
              if (abilityKey === 'FrostfallBlessing') {
                // Frosted Glacial Reticle (Frost Lord)
                const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                grad.addColorStop(0, 'rgba(186, 230, 253, 0.35)');
                grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
                grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
                ctx.shadowBlur = 12;
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
                // Molten Magma Reticle (Ash Tyrant)
                const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                grad.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
                grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.18)');
                grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
                ctx.shadowBlur = 12;
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
                // Crystalline Fracture Reticle (Glacial Mage)
                const grad = ctx.createRadialGradient(mCx, mCy, 0, mCx, mCy, radiusPx);
                grad.addColorStop(0, 'rgba(165, 243, 252, 0.35)');
                grad.addColorStop(0.8, 'rgba(6, 182, 212, 0.12)');
                grad.addColorStop(1, 'rgba(8, 145, 178, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(165, 243, 252, 0.9)';
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
                ctx.shadowBlur = 10;
                ctx.stroke();
              } else if (abilityKey === 'ObsidianPillar') {
                // Volcanic Placement Disk (Magma Shaper)
                ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
                ctx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = 'rgba(147, 51, 234, 0.8)';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(mCx, mCy, radiusPx, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }
      }

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

      // --- Ambient Elemental Territory Effects & Contested Frontline Particle Tension ---
      const isReducedMotion = typeof window !== 'undefined' && (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('reduced-motion')
      );

      if (!isReducedMotion && currentGs.voronoiData) {
        const voronoi = currentGs.voronoiData;
        const now = performance.now();

        // 1. Ambient Snow across Map (Full intensity in Frost territory, lessened intensity in rest of map)
        const snowCells = (voronoi.cells || []).filter(c => c.team === 'snow' && c.polygon && c.polygon.length >= 3);
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

          ctx.shadowBlur = inFrost ? 3 : 1;
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
        const ashCells = (voronoi.cells || []).filter(c => c.team === 'ash' && c.polygon && c.polygon.length >= 3);
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
          ctx.shadowBlur = inAsh ? 4 : 1.5;
          ctx.beginPath();
          ctx.arc(ember.x, ember.y, ember.size * (inAsh ? 1.0 : 0.85), 0, Math.PI * 2);
          ctx.fill();

          if (ember.life <= 0 || ember.y < 0 || ember.x < 0 || ember.x > C.CANVAS_SIZE) {
            ambientEmbersRef.current.splice(i, 1);
          }
        }
        ctx.restore();
      }

      if (didTransform) ctx.restore();
      ctx.restore();

      requestRef.current = requestAnimationFrame(animationLoop);
    };

    requestRef.current = requestAnimationFrame(animationLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Helper to map visual index to logical grid coordinates
  const getCellCoords = (index) => {
    const visualRow = Math.floor(index / 10);
    const visualCol = index % 10;
    
    if (isAsh) {
      return { r: 9 - visualRow, c: 9 - visualCol };
    }
    return { r: visualRow, c: visualCol };
  };

  // Check if cell is in a Rift zone
  const isRiftCell = (r, c) => {
    // Top-Left Rift
    if (r <= 2 && c <= 2) return 'snow';
    // Bottom-Right Rift
    if (r >= 7 && c >= 7) return 'ash';
    return null;
  };

  // Render grid cells
  const renderCells = () => {
    if (!gameState) return null;
    const cells = [];
    const snowSet = gameState?.snowTerritory instanceof Set
      ? gameState.snowTerritory
      : new Set(Array.isArray(gameState?.snowTerritory) ? gameState.snowTerritory : []);
    const ashSet = gameState?.ashTerritory instanceof Set
      ? gameState.ashTerritory
      : new Set(Array.isArray(gameState?.ashTerritory) ? gameState.ashTerritory : []);
    const voidSet = new Set((gameState?.voidSquares || []).map(v => `${v.row},${v.col}`));
    const wallSet = new Set((gameState?.glacialWalls || []).map(w => `${w.row},${w.col}`));
    const craterSet = new Set((gameState?.specialTerrains || []).filter(st => st.type === 'crater').map(st => `${Math.round(st.row)},${Math.round(st.col)}`));

    // Ability targeting highlights
    const isAbilityTargeting = gameState?.currentState === 'ABILITY_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_FIRST' || gameState?.currentState === 'TETHER_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_SECOND';
    const pieceByCoord = isAbilityTargeting && gameState?.pieces
      ? new Map(gameState.pieces.map(p => [`${p.row},${p.col}`, p]))
      : null;

    for (let i = 0; i < 100; i++) {
      const { r, c } = getCellCoords(i);
      const posKey = `${r},${c}`;

      const hasSnowTerritory = snowSet.has(posKey);
      const hasAshTerritory = ashSet.has(posKey);
      const isVoid = voidSet.has(posKey);
      const isWall = wallSet.has(posKey);
      const hasCrater = craterSet.has(posKey);
      
      const riftOwner = isRiftCell(r, c);

      // Check if cell is valid for ability target
      let isAbilityTarget = false;
      if (isAbilityTargeting && gameState?.selectedPiece) {
        const piece = gameState.selectedPiece;
        const abilityKey = gameState.abilityContext?.abilityKey || piece.ability?.key;
        const ability = C.ABILITIES[abilityKey];

        if (gameState.currentState === 'WALL_PLACEMENT_SECOND' && gameState.firstWallCoords) {
          const { row: fR, col: fC } = gameState.firstWallCoords;
          const isNeighbor = Math.max(Math.abs(fR - r), Math.abs(fC - c)) === 1;
          const hasUnit = pieceByCoord ? pieceByCoord.has(posKey) : (gameState.pieces || []).some(p => p.row === r && p.col === c);
          isAbilityTarget = isNeighbor && !hasUnit;
        } else if (gameState.currentState === 'TETHER_TARGETING' && gameState.abilityContext) {
          const { siphoner, mode, allyTarget } = gameState.abilityContext;
          const siphonerOnRift = isRiftCell(siphoner.row, siphoner.col);
          const maxRange = siphonerOnRift ? 4 : 3;
          const distance = Math.max(Math.abs(siphoner.row - r), Math.abs(siphoner.col - c));
          
          if (distance <= maxRange) {
            const targetPiece = pieceByCoord ? pieceByCoord.get(posKey) : (gameState.pieces || []).find(p => p.row === r && p.col === c);
            if (mode === 'resonance') {
              if (!allyTarget) isAbilityTarget = targetPiece && targetPiece.team === siphoner.team && targetPiece.id !== siphoner.id;
              else isAbilityTarget = targetPiece && targetPiece.team !== siphoner.team && (targetPiece.power || 0) > 0;
            } else if (mode === 'benevolent' || mode === 'parasitic') {
              if (mode === 'parasitic') isAbilityTarget = targetPiece && targetPiece.team === siphoner.team && (targetPiece.power || 0) > 0;
              else isAbilityTarget = targetPiece && targetPiece.team === siphoner.team;
            } else if (mode === 'hostile') {
              isAbilityTarget = targetPiece && targetPiece.team !== siphoner.team && (targetPiece.power || 0) > 0;
            }
          }
        } else if (ability) {
          let abilityRange = ability.range;
          if (gameState.testMode && ['ashMagmaShaper', 'snowFrostLord', 'ashAshTyrant'].includes(piece.key)) {
            abilityRange = 10;
          }
          const distance = Math.max(Math.abs(piece.row - r), Math.abs(piece.col - c));
          if (abilityRange < 0 || distance <= abilityRange) {
            if (ability.specialTargeting) {
              isAbilityTarget = ability.specialTargeting(piece, { r, c }, gameState);
            } else {
              const targetPiece = pieceByCoord ? pieceByCoord.get(posKey) : (gameState.pieces || []).find(p => p.row === r && p.col === c);
              switch (ability.targetType) {
                case 'enemy': isAbilityTarget = targetPiece && targetPiece.team !== piece.team && !targetPiece.hasDefensiveWard; break;
                case 'friendly': isAbilityTarget = targetPiece && targetPiece.team === piece.team; break;
                case 'empty': isAbilityTarget = !targetPiece && !isWall && !isVoid; break;
                case 'any': {
                  if (abilityKey === 'ObsidianPillar') {
                    isAbilityTarget = !targetPiece && !isWall && !isVoid && !hasCrater;
                  } else {
                    isAbilityTarget = true;
                  }
                  break;
                }
              }
            }
          }
        }
      }

      // Boundless continuous board styling (no rigid box boundaries)
      let cellStyle = { border: 'none' };
      let cellClass = '';
      if (hasCrater) {
        cellStyle = { border: 'none', outline: 'none' };
      } else if (isVoid) {
        cellStyle = { backgroundColor: 'rgba(15, 10, 25, 0.95)', border: '1.5px solid rgba(147, 51, 234, 0.2)' };
      } else if (isWall) {
        cellStyle = { backgroundColor: 'rgba(14, 165, 233, 0.25)', border: '2px solid rgba(125, 211, 252, 0.5)' };
        cellClass = 'animate-pulse';
      }

      cells.push(
        <div 
          key={i}
          style={cellStyle}
          className={`relative w-full aspect-square flex items-center justify-center pointer-events-none ${cellClass}`}
        >
          {/* Faction-tuned ethereal ability target rune */}
          {isAbilityTarget && !['FrostfallBlessing', 'ReignOfFire', 'GlacialFracture', 'ObsidianPillar'].includes(gameState?.abilityContext?.abilityKey || gameState?.selectedPiece?.ability?.key) && (
            <div 
              className="absolute inset-1 pointer-events-none rounded-full flex items-center justify-center"
              style={{
                background: gameState?.selectedPiece?.team === 'snow'
                  ? 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.08) 65%, transparent 100%)'
                  : 'radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(239, 68, 68, 0.08) 65%, transparent 100%)',
                border: gameState?.selectedPiece?.team === 'snow'
                  ? '1.5px solid rgba(186, 230, 253, 0.75)'
                  : '1.5px solid rgba(254, 215, 170, 0.75)',
                boxShadow: gameState?.selectedPiece?.team === 'snow'
                  ? '0 0 10px rgba(56, 189, 248, 0.5), inset 0 0 6px rgba(56, 189, 248, 0.2)'
                  : '0 0 10px rgba(249, 115, 22, 0.5), inset 0 0 6px rgba(249, 115, 22, 0.2)',
              }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: gameState?.selectedPiece?.team === 'snow' ? '#e0f2fe' : '#fef3c7',
                  boxShadow: '0 0 6px #ffffff'
                }}
              />
            </div>
          )}
        </div>
      );
    }
    return cells;
  };

  // Render SVG Paths representing active tethers and energy links
  const renderSVGOverlays = () => {
    if (!gameState || !gameState.pieces) return null;

    const lines = [];

    // 1. Siphon Tethers
    gameState.pieces.forEach(siphoner => {
      if (siphoner.ability?.key !== 'Siphon' || !Array.isArray(siphoner.tethers)) return;

      siphoner.tethers.forEach((t, tIdx) => {
        const ally = t.allyId !== null ? gameState.pieces.find(p => p.id === t.allyId) : null;
        const enemy = t.enemyId !== null ? gameState.pieces.find(p => p.id === t.enemyId) : null;
        
        const targets = [];
        if (ally) targets.push(ally);
        if (enemy) targets.push(enemy);

        targets.forEach((target, targetIdx) => {
          // Visual percentages
          let x1 = siphoner.col * 10 + 5;
          let y1 = siphoner.row * 10 + 5;
          let x2 = target.col * 10 + 5;
          let y2 = target.row * 10 + 5;

          if (isAsh) {
            x1 = (9 - siphoner.col) * 10 + 5;
            y1 = (9 - siphoner.row) * 10 + 5;
            x2 = (9 - target.col) * 10 + 5;
            y2 = (9 - target.row) * 10 + 5;
          }

          const strokeColor = siphoner.team === 'snow' ? 'rgba(34,211,238,0.8)' : 'rgba(249,115,22,0.8)';
          const id = `tether-${siphoner.id}-${target.id}-${tIdx}`;

          lines.push(
            <g key={id}>
              {/* Pulsing energy glow line */}
              <line 
                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                stroke={strokeColor} 
                strokeWidth={3} 
                strokeDasharray="4 4"
                className="animate-[dash_2s_linear_infinite]"
                style={{
                  filter: `drop-shadow(0 0 4px ${strokeColor})`
                }}
              />
            </g>
          );
        });
      });
    });

    // 2. Conduit Link Active (line connecting rifts)
    if (gameState?.conduitLinkActive && gameState.dynamicRifts?.length >= 2) {
      const [r1, r2] = gameState.dynamicRifts;
      const cell1 = r1.cells[4];
      const cell2 = r2.cells[4];

      let x1 = cell1[1] * 10 + 5;
      let y1 = cell1[0] * 10 + 5;
      let x2 = cell2[1] * 10 + 5;
      let y2 = cell2[0] * 10 + 5;

      if (isAsh) {
        x1 = (9 - cell1[1]) * 10 + 5;
        y1 = (9 - cell1[0]) * 10 + 5;
        x2 = (9 - cell2[1]) * 10 + 5;
        y2 = (9 - cell2[0]) * 10 + 5;
      }

      const conduitColor = gameState?.conduitTeam === 'snow' ? 'rgba(56,189,248,0.85)' : 'rgba(239,68,68,0.85)';

      lines.push(
        <line 
          key="conduit-line"
          x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
          stroke={conduitColor} 
          strokeWidth={4} 
          strokeDasharray="6 3"
          className="animate-[dash_1s_linear_infinite]"
          style={{
            filter: `drop-shadow(0 0 6px ${conduitColor})`
          }}
        />
      );
    }

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {lines}
      </svg>
    );
  };

  const handleBoardContainerClick = (e) => {
    if (!onBoardClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const visualCol = Math.max(0, Math.min(10, (clickX / rect.width) * 10));
    const visualRow = Math.max(0, Math.min(10, (clickY / rect.height) * 10));
    const rawR = isAsh ? 10 - visualRow : visualRow;
    const rawC = isAsh ? 10 - visualCol : visualCol;
    const r = Number(rawR.toFixed(2));
    const c = Number(rawC.toFixed(2));
    onBoardClick(r, c);
  };

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const visualCol = Math.max(0, Math.min(10, (clickX / rect.width) * 10));
    const visualRow = Math.max(0, Math.min(10, (clickY / rect.height) * 10));
    const rawR = isAsh ? 10 - visualRow : visualRow;
    const rawC = isAsh ? 10 - visualCol : visualCol;
    mousePosRef.current = {
      r: Number(rawR.toFixed(2)),
      c: Number(rawC.toFixed(2)),
      visualCol,
      visualRow,
      active: true
    };
  };

  const handlePointerLeave = () => {
    mousePosRef.current.active = false;
  };

  return (
    <div 
      id="gameBoard"
      className="relative select-none"
      onClick={handleBoardContainerClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        backgroundImage: isAsh ? "url('/images/bg-game2.webp')" : "url('/images/bg-game.webp')",
        backgroundSize: '100% 100%'
      }}
    >
      {/* 1. Grid Cells Layer */}
      <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 z-0">
        {renderCells()}
      </div>

      {/* 1b. Background Canvas Layer for territory trails (renders UNDER pieces) */}
      <canvas 
        ref={bgCanvasRef} 
        width={C.CANVAS_SIZE} 
        height={C.CANVAS_SIZE} 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 5 }}
      />

      {/* 2. SVG Tether & Ley Line Connections Overlay */}
      {renderSVGOverlays()}

      {/* 3. Canvas Layer for high-performance particle animation effects (above pieces) */}
      <canvas 
        ref={canvasRef} 
        width={C.CANVAS_SIZE} 
        height={C.CANVAS_SIZE} 
        className="absolute inset-0 w-full h-full pointer-events-none z-30" 
      />

      {/* 4. Piece Component Tokens absolute overlay */}
      {gameState?.pieces && gameState.pieces.map(piece => {
        // Don't render if trapped (drawn differently)
        if (piece.id === gameState.trappedPiece) return null;
        
        return (
          <Piece 
            key={piece.id}
            piece={piece}
            gameState={gameState}
            isAsh={isAsh}
            isSelected={gameState.selectedPiece?.id === piece.id}
            onClick={onPieceClick}
            onMouseEnter={onMouseEnterPiece}
            onMouseMove={onMouseMovePiece}
            onMouseLeave={onMouseLeavePiece}
          />
        );
      })}
    </div>
  );
}
