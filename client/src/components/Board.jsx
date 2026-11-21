import React, { useEffect, useRef } from 'react';
import Piece from './Piece.jsx';
import * as C from '@shared/constants.js';
import * as Effects from '@/effects';
import { getValidMoves, getPieceMoveRadius } from '@shared/utils.js';
import { computePowerDiagram, isPointInPolygon } from '@shared/voronoi.js';
import {
  isPointInTeamTerritory,
  renderTerritoryLayer,
  renderInteractiveReticles,
  renderEnvironmentalEffects
} from '../rendering/boardRenderer.js';

function Board({ 
  gameState, 
  myTeam, 
  onCellClick, 
  onPieceClick,
  onBoardClick,
  onMouseEnterPiece,
  onMouseLeavePiece,
  onMouseMovePiece,
  hoveredAbilityKey
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

  const hoveredAbilityKeyRef = useRef(hoveredAbilityKey);
  hoveredAbilityKeyRef.current = hoveredAbilityKey;

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

      // Render background territory & terrain layers
      renderTerritoryLayer(bgCtx, currentGs, isAshLocal, CS, terrCacheCanvasRef, terrCacheKeyRef, gradCacheRef.current);

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
      if (isAshLocal) {
        ctx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
        ctx.rotate(Math.PI);
      }

      // Render interactive reticles, selected ranges, ability targeting
      renderInteractiveReticles(ctx, currentGs, isAshLocal, CS, mousePosRef.current, hoveredAbilityKeyRef.current);

      // Render environmental particle systems, remnants, clash sparks
      renderEnvironmentalEffects(ctx, currentGs, isAshLocal, CS, dt, ambientSnowRef, ambientEmbersRef);

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
          if (gameState.testMode && ['ashMagmaShaper', 'snowFrostLord', 'ashAshTyrant', 'snowGlacialMage', 'snowIceWisp'].includes(piece.key)) {
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
      className="relative select-none overflow-hidden"
      onClick={handleBoardContainerClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        backgroundImage: isAsh ? "url('/images/bg-game2.webp')" : "url('/images/bg-game.webp')",
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center center'
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

export default React.memo(Board);
