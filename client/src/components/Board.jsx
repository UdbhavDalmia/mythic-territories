import React, { useEffect, useRef } from 'react';
import Piece from './Piece.jsx';
import * as C from '../../../shared/constants.js';
import * as Effects from '../../js/effects.js';
import { getValidMoves, getPieceMoveRadius } from '../../../shared/utils.js';

export default function Board({ 
  gameState, 
  myTeam, 
  onCellClick, 
  onPieceClick,
  onBoardClick,
  onMouseEnterPiece,
  onMouseLeavePiece
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

        const trails = currentGs.territoryTrails || [];
        const snowTerr = currentGs.snowTerritory || [];
        const ashTerr = currentGs.ashTerritory || [];
        const snowCount = typeof snowTerr.size === 'number' ? snowTerr.size : snowTerr.length || 0;
        const ashCount = typeof ashTerr.size === 'number' ? ashTerr.size : ashTerr.length || 0;
        const newKey = `${snowCount}/${ashCount}/${trails.length}`;

        if (newKey !== terrCacheKeyRef.current || !terrCacheCanvasRef.current) {
          terrCacheKeyRef.current = newKey;
          if (!terrCacheCanvasRef.current) {
            terrCacheCanvasRef.current = document.createElement('canvas');
            terrCacheCanvasRef.current.width = C.CANVAS_SIZE;
            terrCacheCanvasRef.current.height = C.CANVAS_SIZE;
          }
          const tCtx = terrCacheCanvasRef.current.getContext('2d');
          tCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

          // 1. Draw base captured territory tiles with soft glowing aura
          const drawTerrCells = (terrData, isSnow) => {
            let list = [];
            if (typeof terrData.size === 'number') list = Array.from(terrData);
            else if (Array.isArray(terrData)) list = terrData;
            list.forEach(posStr => {
              if (typeof posStr !== 'string') return;
              const [r, c] = posStr.split(',').map(Number);
              if (isNaN(r) || isNaN(c)) return;
              const cx = (c + 0.5) * CS;
              const cy = (r + 0.5) * CS;
              const rad = CS * 0.7;
              const g = tCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
              if (isSnow) {
                g.addColorStop(0, 'rgba(0, 190, 255, 0.42)');
                g.addColorStop(0.6, 'rgba(0, 150, 255, 0.22)');
                g.addColorStop(1, 'rgba(0, 120, 255, 0.0)');
              } else {
                g.addColorStop(0, 'rgba(255, 95, 20, 0.42)');
                g.addColorStop(0.6, 'rgba(235, 65, 0, 0.22)');
                g.addColorStop(1, 'rgba(200, 40, 0, 0.0)');
              }
              tCtx.fillStyle = g;
              tCtx.beginPath();
              tCtx.arc(cx, cy, rad, 0, Math.PI * 2);
              tCtx.fill();
            });
          };
          drawTerrCells(snowTerr, true);
          drawTerrCells(ashTerr, false);

          // 2. Draw dynamic movement trails
          trails.forEach(t => {
            const cx = (t.col + 0.5) * CS;
            const cy = (t.row + 0.5) * CS;
            const rPxRound = Math.round(Math.max(0.1, t.radius || 0.6) * CS * 1.15);
            const cacheKey = `${t.team}-${rPxRound}`;
            let cachedGrad = gradCacheRef.current.get(cacheKey);
            if (!cachedGrad) {
              cachedGrad = document.createElement('canvas');
              cachedGrad.width = cachedGrad.height = rPxRound * 2;
              const tempCtx = cachedGrad.getContext('2d');
              const g = tempCtx.createRadialGradient(rPxRound, rPxRound, 0, rPxRound, rPxRound, rPxRound);
              if (t.team === 'snow') {
                g.addColorStop(0, 'rgba(0, 190, 255, 0.48)');
                g.addColorStop(0.55, 'rgba(0, 150, 255, 0.25)');
                g.addColorStop(0.85, 'rgba(0, 100, 255, 0.08)');
                g.addColorStop(1, 'rgba(0, 100, 255, 0.0)');
              } else {
                g.addColorStop(0, 'rgba(255, 95, 20, 0.48)');
                g.addColorStop(0.55, 'rgba(235, 65, 0, 0.25)');
                g.addColorStop(0.85, 'rgba(200, 40, 0, 0.08)');
                g.addColorStop(1, 'rgba(200, 40, 0, 0.0)');
              }
              tempCtx.fillStyle = g;
              tempCtx.beginPath();
              tempCtx.arc(rPxRound, rPxRound, rPxRound, 0, Math.PI * 2);
              tempCtx.fill();
              gradCacheRef.current.set(cacheKey, cachedGrad);
            }
            tCtx.drawImage(cachedGrad, cx - rPxRound, cy - rPxRound);
          });
        }

        if (terrCacheCanvasRef.current) {
          bgCtx.drawImage(terrCacheCanvasRef.current, 0, 0);
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
        ctx.strokeStyle = 'rgba(218, 165, 32, 0.5)';
        ctx.lineWidth = 2.5;
      }
      ctx.beginPath();
      ctx.arc(shrineCx, shrineCy, shrineRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw Selected Piece Movement Radius Circle
      if (currentGs.selectedPiece && currentGs.currentState !== 'ABILITY_TARGETING' && currentGs.currentState !== 'TETHER_TARGETING' && currentGs.currentState !== 'WALL_PLACEMENT_FIRST' && currentGs.currentState !== 'WALL_PLACEMENT_SECOND') {
        const selP = currentGs.selectedPiece;
        const selCx = selP.col * CS + CS / 2;
        const selCy = selP.row * CS + CS / 2;
        const maxRadius = (typeof getPieceMoveRadius === 'function') ? getPieceMoveRadius(selP, currentGs) : (selP.agility || 2);
        const moveRadiusPx = maxRadius * CS;
        const animTime = performance.now() * 0.003;
        const pulseRadius = Math.max(0.1, moveRadiusPx + Math.sin(performance.now() * 0.005) * 4);

        ctx.save();
        // Inner fill
        ctx.fillStyle = selP.team === 'snow' ? 'rgba(0, 180, 255, 0.08)' : 'rgba(255, 70, 0, 0.08)';
        ctx.beginPath();
        ctx.arc(selCx, selCy, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing outer boundary circle
        ctx.strokeStyle = selP.team === 'snow' ? 'rgba(0, 220, 255, 0.85)' : 'rgba(255, 90, 30, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Dashed rotating halo
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(selCx, selCy, Math.max(0.1, pulseRadius + 5), -animTime * 0.5, -animTime * 0.5 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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
      if (Effects.drawShrineEffects) Effects.drawShrineEffects(currentGs);

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
    const cells = [];
    const snowTerr = Array.isArray(gameState?.snowTerritory) 
      ? gameState.snowTerritory 
      : (gameState?.snowTerritory instanceof Set ? Array.from(gameState.snowTerritory) : []);
    const ashTerr = Array.isArray(gameState?.ashTerritory) 
      ? gameState.ashTerritory 
      : (gameState?.ashTerritory instanceof Set ? Array.from(gameState.ashTerritory) : []);
    const voidSquares = gameState?.voidSquares || [];
    const glacialWalls = gameState?.glacialWalls || [];

    // Ability targeting highlights
    const isAbilityTargeting = gameState?.currentState === 'ABILITY_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_FIRST' || gameState?.currentState === 'TETHER_TARGETING' || gameState?.currentState === 'WALL_PLACEMENT_SECOND';

    for (let i = 0; i < 100; i++) {
      const { r, c } = getCellCoords(i);

      const hasSnowTerritory = snowTerr.includes(`${r},${c}`);
      const hasAshTerritory = ashTerr.includes(`${r},${c}`);
      const isVoid = voidSquares.some(v => v.row === r && v.col === c);
      const isWall = glacialWalls.some(w => w.row === r && w.col === c);
      
      const riftOwner = isRiftCell(r, c);

      // Check if cell is valid for ability target
      let isAbilityTarget = false;
      if (isAbilityTargeting && gameState.selectedPiece) {
        const piece = gameState.selectedPiece;
        const abilityKey = gameState.abilityContext?.abilityKey || piece.ability?.key;
        const ability = C.ABILITIES[abilityKey];

        if (gameState.currentState === 'WALL_PLACEMENT_SECOND' && gameState.firstWallCoords) {
          const { row: fR, col: fC } = gameState.firstWallCoords;
          const isNeighbor = Math.max(Math.abs(fR - r), Math.abs(fC - c)) === 1;
          const hasUnit = gameState.pieces.some(p => p.row === r && p.col === c);
          isAbilityTarget = isNeighbor && !hasUnit;
        } else if (gameState.currentState === 'TETHER_TARGETING' && gameState.abilityContext) {
          const { siphoner, mode, allyTarget } = gameState.abilityContext;
          const siphonerOnRift = isRiftCell(siphoner.row, siphoner.col);
          const maxRange = siphonerOnRift ? 4 : 3;
          const distance = Math.max(Math.abs(siphoner.row - r), Math.abs(siphoner.col - c));
          
          if (distance <= maxRange) {
            const targetPiece = gameState.pieces.find(p => p.row === r && p.col === c);
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
              const targetPiece = gameState.pieces.find(p => p.row === r && p.col === c);
              switch (ability.targetType) {
                case 'enemy': isAbilityTarget = targetPiece && targetPiece.team !== piece.team && !targetPiece.hasDefensiveWard; break;
                case 'friendly': isAbilityTarget = targetPiece && targetPiece.team === piece.team; break;
                case 'empty': isAbilityTarget = !targetPiece && !isWall && !isVoid; break;
                case 'any': {
                  if (abilityKey === 'ObsidianPillar') {
                    const hasCrater = (gameState.specialTerrains || []).some(st => st.type === 'crater' && Math.round(st.row) === r && Math.round(st.col) === c);
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

      // Base cell borders and state indicators
      let cellStyle = { border: '1px solid rgba(255, 255, 255, 0.03)' };
      let cellClass = 'hover:bg-white/5';
      if (isVoid) {
        cellStyle = { backgroundColor: 'rgba(15, 10, 25, 0.95)', border: '1.5px solid rgba(147, 51, 234, 0.2)' };
      } else if (isWall) {
        cellStyle = { backgroundColor: 'rgba(14, 165, 233, 0.25)', border: '2px solid rgba(125, 211, 252, 0.5)' };
        cellClass = 'animate-pulse';
      }

      cells.push(
        <div 
          key={i}
          style={cellStyle}
          className={`relative w-full aspect-square flex items-center justify-center transition-all cursor-pointer ${cellClass}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onBoardClick) {
              onBoardClick(r, c);
            } else if (onCellClick) {
              onCellClick(r, c);
            }
          }}
        >
          {/* Valid Ability Target Highlights */}
          {isAbilityTarget && (
            <div className="absolute inset-0 bg-emerald-500/20 border border-emerald-400/80 target-cell-indicator pointer-events-none rounded-[2px] shadow-[inset_0_0_12px_rgba(52,211,153,0.35)] flex items-center justify-center">
              <span className="text-[9px] text-emerald-300 font-bold opacity-75">✦</span>
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
    if (gameState.conduitLinkActive && gameState.dynamicRifts?.length >= 2) {
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

      const conduitColor = gameState.conduitTeam === 'snow' ? 'rgba(56,189,248,0.85)' : 'rgba(239,68,68,0.85)';

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
    let visualCol = Math.floor((clickX / rect.width) * 10);
    let visualRow = Math.floor((clickY / rect.height) * 10);
    visualCol = Math.max(0, Math.min(9, visualCol));
    visualRow = Math.max(0, Math.min(9, visualRow));
    const r = isAsh ? 9 - visualRow : visualRow;
    const c = isAsh ? 9 - visualCol : visualCol;
    onBoardClick(r, c);
  };

  return (
    <div 
      id="gameBoard"
      className="relative select-none"
      onClick={handleBoardContainerClick}
      style={{
        backgroundImage: isAsh ? "url('/images/bg-game2.png')" : "url('/images/bg-game.png')",
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
            isSelected={gameState.selectedPiece?.id === piece.id}
            onClick={onPieceClick}
            onMouseEnter={onMouseEnterPiece}
            onMouseLeave={onMouseLeavePiece}
          />
        );
      })}
    </div>
  );
}
