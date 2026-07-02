import * as C from '../../shared/constants.js';
import { getValidMoves, getEffectivePower, getPieceMoveRadius } from '../../shared/utils.js';
import { GameState, getCurrentState, isState } from '../../shared/logic.js';
import {
  updateConduitParticles,
  drawSiphonRunes,
  drawStatusIcons,
  updateEffects,
  renderEffects,
  drawGlacialWallBlock,
  drawBurningGroundBlock,
  drawSnareTrapBlock,
  drawIcyGroundBlock,
  drawDeathMeteorShield,
  drawMagmaShardsBlock
} from './effects.js';
import * as Effects from './effects.js';
let boardCtx;
let ctx;
let offCanvas = null;
let _terrCacheCanvas = null;
let _terrCacheKey = '';
let _terrFrameSkip = 0;
const TERR_SKIP_FRAMES = 2;

const buildBadges = team => Array.from({ length: 8 }, (_, i) => {
  const im = new Image();
  im.src = i === 0 ? `badges/${team}-p0.svg` : `badges/${team}-p${i}.png`;
  return im;
});

let currentGameState = null;

export function getDrawCoords(r, c, gameState) {
  return { r, c };
}

const badgeImgs = {
  ice: buildBadges('ice'),
  ash: buildBadges('ash')
};

const gradCache = new Map();

const $ = id => document.getElementById(id);
const safeHtml = (el, html) => { if (el) el.innerHTML = html; };
const toggleEl = (el, show) => { if (el) el.style.display = show ? 'block' : 'none'; };

function drawIceRing(drawCtx, cx, cy, br, rotate = false) {
  drawCtx.save();
  if (rotate) {
    drawCtx.translate(cx, cy);
    drawCtx.rotate(Math.PI);
    drawCtx.translate(-cx, -cy);
  }
  drawCtx.strokeStyle = 'rgba(150, 240, 255, 0.9)';
  drawCtx.lineWidth = 2;
  drawCtx.fillStyle = 'rgba(100, 200, 255, 0.4)';
  drawCtx.shadowColor = '#00ffff';
  drawCtx.shadowBlur = 8;
  drawCtx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const rad = br + (Math.random() - 0.5) * 6;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) drawCtx.moveTo(px, py);
    else drawCtx.lineTo(px, py);
  }
  drawCtx.closePath();
  drawCtx.fill();
  drawCtx.stroke();
  drawCtx.restore();
}

let _mobileOverflowMenu = [];
export function showMobileOverflow(items) {
  removeMobileOverflow();
  if (!items || items.length === 0) return;
  const container = document.createElement('div');
  container.id = 'mobile-overflow';
  container.style.position = 'fixed';
  container.style.right = '8px';
  container.style.bottom = '72px';
  container.style.zIndex = 9999;
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '6px';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'mobile-overflow-btn action-btn';
    b.textContent = it.text;
    b.disabled = !!it.disabled;
    b.onclick = () => { try { it.onClick(); } finally { removeMobileOverflow(); hideAbilityPanel(); } };
    container.appendChild(b);
  });
  document.body.appendChild(container);
}
export function removeMobileOverflow() {
  const existing = document.getElementById('mobile-overflow');
  if (existing) existing.remove();
  _mobileOverflowMenu = [];
}
export function initUI(mainCtx, boardContext) {
  ctx = mainCtx;
  boardCtx = boardContext;
}
export function getBoardCanvas() {
  return boardCtx && boardCtx.canvas ? boardCtx.canvas : null;
}
const formatTime = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
let globalTimerInterval = null;
export function startTimer(gameState) {
  if (globalTimerInterval) return;
  globalTimerInterval = setInterval(() => {
    if (gameState.gameOver || !gameState.gameStarted) return;
    const currentTeam = gameState.currentTurn || 'snow';
    if (!gameState.timers) gameState.timers = { snow: 600, ash: 600 };
    if (gameState.timers[currentTeam] > 0) {
      gameState.timers[currentTeam] -= 1;
      updateTimerDisplay(gameState);
    } else {
      window.sendAction('TIMEOUT', { team: currentTeam });
      stopTimer();
    }
  }, 1000);
}
export function stopTimer() {
  if (globalTimerInterval) {
    clearInterval(globalTimerInterval);
    globalTimerInterval = null;
  }
}
export function resetTimers(gameState) {
  stopTimer();
  gameState.timers = gameState.timers || {};
  gameState.timers.snow = gameState.timers.ash = 10 * 60;
  updateTimerDisplay(gameState);
  gameState.gameStarted = false;
  const startBtn = $('startResetBtn');
  const startBtnMobile = $('startResetBtn-mobile');
  if (startBtn) startBtn.textContent = 'Start';
  if (startBtnMobile) startBtnMobile.textContent = 'Start';
}
export function updateTimerDisplay(gameState) {
  const snowTimer = $('snowTimer');
  const ashTimer = $('ashTimer');
  const snowTimerMobile = $('snowTimer-mobile');
  const ashTimerMobile = $('ashTimer-mobile');
  const snowTimeStr = formatTime(gameState.timers.snow);
  const ashTimeStr = formatTime(gameState.timers.ash);
  if (snowTimer) snowTimer.textContent = snowTimeStr;
  if (ashTimer) ashTimer.textContent = ashTimeStr;
  if (snowTimerMobile) snowTimerMobile.textContent = snowTimeStr;
  if (ashTimerMobile) ashTimerMobile.textContent = ashTimeStr;
}
export function showFlashMessage(message, type = 'neutral', gameState) {
  const flashEl = $('flashMessage');
  if (!flashEl) return;
  flashEl.textContent = message;
  flashEl.className = `visible ${type}`;
  if (gameState.flashTimeout) clearTimeout(gameState.flashTimeout);
  gameState.flashTimeout = setTimeout(() => { flashEl.className = ''; }, 1000);
  if (type !== 'error') updateMessageLog(message, type, gameState);
}
export function clearMessageLog() {
  ['messageLog', 'messageLog-mobile'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
  const flashEl = $('flashMessage');
  if (flashEl) { flashEl.className = ''; flashEl.textContent = ''; }
}
export function updateMessageLog(message, type, gameState) {
  if (!message || !gameState) return;
  gameState.messageHistory = gameState.messageHistory || [];
  gameState.messageHistory.unshift({ text: message, type, turn: gameState.turnCount });
  if (gameState.messageHistory.length > 50) gameState.messageHistory.pop();
  ['messageLog', 'messageLog-mobile'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const li = document.createElement('li');
    li.innerHTML = `<span class="turn-number">[T${gameState.turnCount}]</span> <span class="${type}-message">${message}</span>`;
    el.prepend(li);
    while (el.children.length > 20) el.removeChild(el.lastChild);
  });
}
export function showAscensionPopup(gameState) {
  const pending = gameState.pendingAscension;
  if (!pending) return;
  const screen = $('ascensionScreen');
  const title = $('ascension-role-title');
  const container = $('ascension-description-content');
  if (screen) {
    screen.style.display = 'flex';
    screen.className = `ascension-overlay primal-${pending.team} active`;
    const popupContent = screen.querySelector('.ascension-content');
    if (popupContent) popupContent.classList.add('shatter-in');
  }
  if (title) title.textContent = `${pending.role.toUpperCase()} ASCENSION`;
  if (container) {
    container.innerHTML = '';
    const roleChoices = C.ASCENSION_CHOICES[pending.role];
    const choices = roleChoices ? [roleChoices.A, roleChoices.B] : [];
    const btnGroup = document.querySelector('.ascension-button-group');
    if (btnGroup) btnGroup.innerHTML = '';
    choices.forEach((choice, index) => {
      const descDiv = document.createElement('div');
      descDiv.className = 'path-option';
      const descText = choice.passive || (choice.team && choice.team[pending.team]) || '';
      descDiv.innerHTML = `<b>${choice.name}</b><br>${descText}`;
      container.appendChild(descDiv);
      const btn = document.createElement('button');
      btn.className = 'ascension-btn';
      btn.textContent = `Choose ${choice.name}`;
      const pathArg = index === 0 ? 'PathA' : 'PathB';
      btn.onclick = () => window.sendAction('ASCENSION_CHOICE', { choice: pathArg });
      if (btnGroup) btnGroup.appendChild(btn);
    });
  }
  const cancelBtn = $('ascensionCancelBtn-popup');
  if (cancelBtn) cancelBtn.onclick = () => window.sendAction('CANCEL_ASCENSION', {});
}
export function hideAscensionPopup() {
  const screen = $('ascensionScreen');
  if (!screen) return;
  screen.style.display = 'none';
  screen.classList.remove('active');
  const popupContent = screen.querySelector('.ascension-content');
  if (popupContent) popupContent.classList.remove('shatter-in');
}
export function drawAbilityHighlights(gameState) {
  const currentState = gameState.currentState || GameState.AWAITING_PIECE_SELECTION;
  const piece = gameState.selectedPiece;
  if (currentState === GameState.WALL_PLACEMENT_SECOND && gameState.firstWallCoords) {
    const { row: firstRow, col: firstCol } = gameState.firstWallCoords;
    for (let r = firstRow - 1; r <= firstRow + 1; r++) {
      for (let c = firstCol - 1; c <= firstCol + 1; c++) {
        if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) continue;
        if (r === firstRow && c === firstCol) continue;
        if (!C.getPieceAt(r, c, gameState.pieces)) {
          ctx.fillStyle = 'rgba(0,255,0,0.4)';
          const draw = getDrawCoords(r, c, gameState);
          ctx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
    }
    return;
  }
  if (currentState === GameState.TETHER_TARGETING) {
    const { siphoner, mode, allyTarget } = gameState.abilityContext;
    const onRift = C.SHAPES.riftAreas.some(r => r.cells.some(([rr, cc]) => rr === siphoner.row && cc === siphoner.col));
    const maxRange = onRift ? 4 : 3;
    for (let r = 0; r < C.ROWS; r++) {
      for (let c = 0; c < C.COLS; c++) {
        const distance = Math.max(Math.abs(siphoner.row - r), Math.abs(siphoner.col - c));
        if (distance > maxRange) continue;
        const targetPiece = C.getPieceAt(r, c, gameState.pieces);
        let isValid = false;
        if (mode === 'resonance') {
          if (!allyTarget) isValid = targetPiece && targetPiece.team === siphoner.team && targetPiece.id !== siphoner.id;
          else isValid = targetPiece && targetPiece.team !== siphoner.team && (targetPiece.power || 0) > 0;
        } else if (mode === 'benevolent' || mode === 'parasitic') {
          if (mode === 'parasitic') isValid = targetPiece && targetPiece.team === siphoner.team && (targetPiece.power || 0) > 0;
          else isValid = targetPiece && targetPiece.team === siphoner.team;
        } else if (mode === 'hostile') {
          isValid = targetPiece && targetPiece.team !== siphoner.team && (targetPiece.power || 0) > 0;
        }
        if (isValid) {
          ctx.fillStyle = 'rgba(0,255,0,0.4)';
          const draw = getDrawCoords(r, c, gameState);
          ctx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
    }
    return;
  }
  if (!piece || (currentState !== GameState.ABILITY_TARGETING && currentState !== GameState.WALL_PLACEMENT_FIRST)) return;
  const abilityKey = gameState.abilityContext?.abilityKey || piece.ability?.key;
  const ability = C.ABILITIES[abilityKey];
  if (!ability) return;
  ctx.save();
  let abilityRange = ability.range;
  if (gameState.testMode && (piece.key === 'ashMagmaShaper' || piece.key === 'snowFrostLord' || piece.key === 'ashAshTyrant')) {
    abilityRange = 10;
  }
  if (ability.circularRange) {
    ctx.beginPath();
    const draw = getDrawCoords(piece.row, piece.col, gameState);
    ctx.arc(draw.c * C.CELL_SIZE + C.CELL_SIZE / 2, draw.r * C.CELL_SIZE + C.CELL_SIZE / 2, abilityRange * C.CELL_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    ctx.stroke();
  } else {
    for (let r = 0; r < C.ROWS; r++) {
      for (let c = 0; c < C.COLS; c++) {
        let distance = Math.max(Math.abs(piece.row - r), Math.abs(piece.col - c));
        if (abilityRange >= 0 && distance > abilityRange) continue;
        let isValid = false;
        if (ability.specialTargeting) {
          isValid = ability.specialTargeting(piece, { r, c }, gameState);
        } else {
          const targetPiece = C.getPieceAt(r, c, gameState.pieces);
          switch (ability.targetType) {
            case 'enemy': isValid = targetPiece && targetPiece.team !== piece.team && !targetPiece.hasDefensiveWard; break;
            case 'friendly': isValid = targetPiece && targetPiece.team === piece.team; break;
            case 'empty': isValid = !targetPiece; break;
            case 'any': {
              if (abilityKey === 'ObsidianPillar' && !targetPiece) {
                const hasWall = (gameState.glacialWalls || []).some(w => w.row === r && w.col === c);
                const hasVoid = (gameState.voidSquares || []).some(v => v.row === r && v.col === c);
                const hasCrater = (gameState.specialTerrains || []).some(st => st.type === 'crater' && Math.round(st.row) === r && Math.round(st.col) === c);
                isValid = !hasWall && !hasVoid && !hasCrater;
              } else {
                isValid = true;
              }
              break;
            }
          }
        }
        if (isValid) {
          ctx.fillStyle = 'rgba(0,255,0,0.3)';
          const draw = getDrawCoords(r, c, gameState);
          ctx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
    }
  }
  ctx.restore();
  if (ability.radius && gameState.hoverRow !== undefined && gameState.hoverCol !== undefined) {
    let isValidTarget = false;
    const distance = ability.circularRange
      ? Math.hypot(piece.row - gameState.hoverRow, piece.col - gameState.hoverCol)
      : Math.max(Math.abs(piece.row - gameState.hoverRow), Math.abs(piece.col - gameState.hoverCol));
    if (abilityRange < 0 || distance <= abilityRange) {
      if (ability.specialTargeting) {
        isValidTarget = ability.specialTargeting(piece, { r: gameState.hoverRow, c: gameState.hoverCol }, gameState);
      } else {
        const hoverP = C.getPieceAt(gameState.hoverRow, gameState.hoverCol, gameState.pieces);
        switch (ability.targetType) {
          case 'enemy': isValidTarget = hoverP && hoverP.team !== piece.team && !hoverP.hasDefensiveWard; break;
          case 'friendly': isValidTarget = hoverP && hoverP.team === piece.team; break;
          case 'empty': isValidTarget = !hoverP; break;
          case 'any': {
            if (abilityKey === 'ObsidianPillar' && !hoverP) {
              const hasWall = (gameState.glacialWalls || []).some(w => w.row === gameState.hoverRow && w.col === gameState.hoverCol);
              const hasVoid = (gameState.voidSquares || []).some(v => v.row === gameState.hoverRow && v.col === gameState.hoverCol);
              const hasCrater = (gameState.specialTerrains || []).some(st => st.type === 'crater' && Math.round(st.row) === gameState.hoverRow && Math.round(st.col) === gameState.hoverCol);
              isValidTarget = !hasWall && !hasVoid && !hasCrater;
            } else {
              isValidTarget = true;
            }
            break;
          }
        }
      }
    }
    if (isValidTarget) {
      const hx = gameState.hoverCol * C.CELL_SIZE + C.CELL_SIZE / 2;
      const hy = gameState.hoverRow * C.CELL_SIZE + C.CELL_SIZE / 2;
      ctx.save();

      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = performance.now() * 0.01;

      if (abilityKey === 'ReignOfFire') {
        const draw = getDrawCoords(piece.row, piece.col, gameState);
        const px = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
        const py = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
        const theta = Math.atan2(hy - py, hx - px);
        const angleWidth = Math.PI / 3; // 60 degrees
        const startAngle = theta - angleWidth / 2;
        const endAngle = theta + angleWidth / 2;
        const R = ability.range * C.CELL_SIZE;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, R, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        const R = (ability.radius || 2) * C.CELL_SIZE;
        ctx.beginPath();
        ctx.arc(hx, hy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
function drawFlashEffects(gameState) {
  if (!gameState.flashEffects) return;
  for (let i = gameState.flashEffects.length - 1; i >= 0; i--) {
    const e = gameState.flashEffects[i];
    e.life -= 0.04;
    if (e.life <= 0) { gameState.flashEffects.splice(i, 1); continue; }
    boardCtx.fillStyle = `rgba(${e.color},${Math.max(0, e.life * 0.7)})`;
    const draw = getDrawCoords(e.r, e.c, gameState);
    boardCtx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
  }
}
export function calculateDynamicTerritoryAreas(gameState) {
  if (!gameState) return { snow: 0, ash: 0 };
  const N = 6, totalSubcells = 100 * N * N, radius = 1.0;
  let snowCovered = 0, ashCovered = 0;
  const snowSet = gameState.snowTerritory || new Set();
  const ashSet = gameState.ashTerritory || new Set();
  const trailsByCell = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => []));
  (gameState.territoryTrails || []).forEach(t => {
    const minR = Math.max(0, Math.floor(t.row - 1)), maxR = Math.min(9, Math.ceil(t.row + 1));
    const minC = Math.max(0, Math.floor(t.col - 1)), maxC = Math.min(9, Math.ceil(t.col + 1));
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        trailsByCell[r][c].push(t);
      }
    }
  });
  const checkCover = (x, y, bases, trails, team) =>
    bases.some(b => Math.hypot(x - b.cx, y - b.cy) <= radius) ||
    trails.some(t => t.team === team && Math.hypot(x - (t.col + 0.5), y - (t.row + 0.5)) <= radius);
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const pos = `${r},${c}`;
      const isSnow = snowSet.has(pos), isAsh = ashSet.has(pos);
      const cellTrails = trailsByCell[r][c];
      const nearbyBases = { snow: [], ash: [] };
      for (let nr = Math.max(0, r - 1); nr <= Math.min(9, r + 1); nr++) {
        for (let nc = Math.max(0, c - 1); nc <= Math.min(9, c + 1); nc++) {
          const npos = `${nr},${nc}`;
          if (snowSet.has(npos)) nearbyBases.snow.push({ cx: nc + 0.5, cy: nr + 0.5 });
          if (ashSet.has(npos)) nearbyBases.ash.push({ cx: nc + 0.5, cy: nr + 0.5 });
        }
      }
      for (let sr = 0; sr < N; sr++) {
        const y = r + (sr + 0.5) / N;
        for (let sc = 0; sc < N; sc++) {
          const x = c + (sc + 0.5) / N;
          if (!isAsh && checkCover(x, y, nearbyBases.snow, cellTrails, 'snow')) {
            snowCovered++;
          } else if (!isSnow && checkCover(x, y, nearbyBases.ash, cellTrails, 'ash')) {
            ashCovered++;
          }
        }
      }
    }
  }
  return {
    snow: parseFloat(((snowCovered / totalSubcells) * 100).toFixed(1)),
    ash: parseFloat(((ashCovered / totalSubcells) * 100).toFixed(1))
  };
}
export function drawLabels(gameState) {
  const snowLabel = $('snowLabel');
  const ashLabel = $('ashLabel');
  const turnLabel = $('turnLabel');
  const areas = calculateDynamicTerritoryAreas(gameState);
  if (snowLabel) snowLabel.textContent = `Snow: ${areas.snow}`;
  if (ashLabel) ashLabel.textContent = `Ash: ${areas.ash}`;
  if (turnLabel) {
    turnLabel.textContent = `TURN ${gameState.turnCount}: ${(gameState.currentTurn || '').toUpperCase()}`;
    turnLabel.className = 'label turn ' + (gameState.currentTurn || '');
  }
  if (gameState.playerTeam === 'ash') {
    if (snowLabel) {
      snowLabel.textContent = `Ash: ${areas.ash}`;
      snowLabel.className = 'label ash';
    }
    if (ashLabel) {
      ashLabel.textContent = `Snow: ${areas.snow}`;
      ashLabel.className = 'label snow';
    }
  } else {
    if (snowLabel) snowLabel.className = 'label snow';
    if (ashLabel) ashLabel.className = 'label ash';
  }
}
export function drawLastMoveIndicator(gameState) {
  if (gameState.lastMoveIndicator && gameState.lastMoveIndicator.life > 0) {
    const i = gameState.lastMoveIndicator;
    ctx.save();
    ctx.globalAlpha = Math.max(0, i.life);
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const draw = getDrawCoords(i.row, i.col, gameState);
    ctx.arc(
      draw.c * C.CELL_SIZE + C.CELL_SIZE / 2,
      draw.r * C.CELL_SIZE + C.CELL_SIZE / 2,
      C.CELL_SIZE / 2 * (1.0 - i.life),
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
    i.life -= 0.02;
  } else if (gameState.lastMoveIndicator) {
    gameState.lastMoveIndicator = null;
  }
}
export function drawSelection(gameState) {
  const currentState = gameState.currentState || GameState.AWAITING_PIECE_SELECTION;
  if (currentState === GameState.ASCENSION_CHOICE) return;
  if (gameState.selectedPiece && !isState(GameState.ABILITY_TARGETING) && !isState(GameState.TETHER_TARGETING)) {
    const p = gameState.selectedPiece;
    const draw = getDrawCoords(p.row, p.col, gameState);
    const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
    const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
    const time = performance.now() * 0.003;
    ctx.save();
    ctx.strokeStyle = p.team === 'snow' ? 'rgba(0, 191, 255, 0.85)' : 'rgba(255, 69, 0, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12 + Math.sin(time * 3) * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, C.CELL_SIZE * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([8, 12]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, C.CELL_SIZE * 0.43, time, time + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    const maxRadius = (typeof getPieceMoveRadius === 'function') ? getPieceMoveRadius(p, gameState) : (p.agility || 2);
    const moveRadiusPx = maxRadius * C.CELL_SIZE;
    const pulseRadius = Math.max(0.1, moveRadiusPx + Math.sin(performance.now() * 0.005) * 3);
    ctx.strokeStyle = p.team === 'snow' ? 'rgba(0, 220, 255, 0.75)' : 'rgba(255, 90, 30, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.team === 'snow' ? 'rgba(0, 180, 255, 0.06)' : 'rgba(255, 70, 0, 0.06)';
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, pulseRadius + 6), -time * 0.5, -time * 0.5 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function generatePieceInfoString(piece, gameState) {
  if (!piece) return 'Select a unit to see its actions.';
  const typeInfo = C.PIECE_TYPES[piece.key] || {};
  const effectivePower = getEffectivePower(piece, gameState, null, null);
  let info = `<b>${typeInfo.name || 'Unit'}</b> (${piece.team?.charAt(0).toUpperCase() + piece.team?.slice(1)})<br>`;
  const hp = typeof piece.currentHp === 'number' ? piece.currentHp : (piece.maxHp || effectivePower);
  const maxHp = piece.maxHp || hp;
  const hpPct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 100;
  const hpColor = hpPct > 60 ? '#44dd88' : hpPct > 30 ? '#ffcc44' : '#ff4444';
  info += `<div style="margin:3px 0 4px;">`;
  info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>HP</span><span style="color:${hpColor}">${hp}/${maxHp}</span></div>`;
  info += `<div style="height:5px;background:rgba(255,255,255,0.12);border-radius:3px;"><div style="width:${hpPct}%;height:100%;background:${hpColor};border-radius:3px;transition:width 0.3s;"></div></div>`;
  info += `</div>`;
  if (!piece.isVeteran && maxHp > 0) {
    const dmgDealt = piece.damageDealt || 0;
    const vetPct = Math.min(100, Math.round((dmgDealt / maxHp) * 100));
    info += `<div style="margin:3px 0 4px;">`;
    info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#aaccff"><span>Veteran Progress</span><span>${dmgDealt}/${maxHp}</span></div>`;
    info += `<div style="height:4px;background:rgba(255,255,255,0.12);border-radius:2px;"><div style="width:${vetPct}%;height:100%;background:#00aaff;border-radius:2px;transition:width 0.3s;box-shadow:0 0 4px #00aaff;"></div></div>`;
    info += `</div>`;
  } else if (piece.isVeteran) {
    info += `<div style="font-size:11px;color:#00aaff;font-weight:bold;text-shadow:0 0 4px #00aaff;margin-bottom:4px;">★ VETERAN</div>`;
  }
  const s = piece.stats || C.PIECE_TYPES[piece.key]?.stats;
  if (s || typeof piece.strength === 'number') {
    const curHp = typeof piece.currentHp === 'number' ? piece.currentHp : (s?.hp || 5);
    const maxHp = s?.hp || 5;
    const str = Math.round(piece.strength ?? s?.str ?? piece.power ?? 0);
    const def = Math.round(piece.def ?? s?.def ?? 0);
    const rng = Number((piece.range ?? s?.rng ?? 1).toFixed(1));
    const agi = Number((piece.agility ?? s?.agi ?? 2).toFixed(1));
    info += `<div style="font-size:11px;color:#aac;margin-bottom:4px;display:flex;gap:6px;flex-wrap:wrap;">`;
    info += `<span title="Strength">⚔${str}</span>`;
    info += `<span title="Defense">🛡${def}</span>`;
    info += `<span title="Range">🎯${rng}</span>`;
    info += `<span title="Agility">💨${agi}</span>`;
    info += `</div>`;
  } else {
    info += `Power: ${effectivePower} (Base: ${typeInfo.power || 0})<br>`;
  }
  const boosts = [];
  if (piece.shrineBoost > 0) boosts.push(`Shrine (+${piece.shrineBoost})`);
  if (piece.anchorBoost > 0) boosts.push(`Anchor (+${piece.anchorBoost})`);
  if (piece.overloadBoost?.duration > 0) boosts.push(`Infusion (+${piece.overloadBoost.amount}, ${piece.overloadBoost.duration} turns)`);
  (gameState.temporaryBoosts || []).filter(b => b.pieceId === piece.id).forEach(boost => {
    const boostName = C.ABILITIES[boost.name]?.name || boost.name;
    boosts.push(`${boostName} (+${boost.amount}, ${boost.duration} turns)`);
  });
  if (boosts.length > 0) info += `<span class="buff-text">${boosts.join('<br>')}</span><br>`;
  const debuffs = [];
  if ((gameState.markedPieces || []).some(m => m.targetId === piece.id)) debuffs.push(`Marked (-${C.ABILITY_VALUES.MarkOfCinder.powerDebuff})`);
  (gameState.debuffs || []).filter(d => d.pieceId === piece.id).forEach(debuff => {
    if (debuff.amount < 0) debuffs.push(`${C.ABILITIES[debuff.name]?.name || debuff.name} (${debuff.amount}, ${debuff.duration} turns)`);
  });
  if (debuffs.length > 0) info += `<span class="debuff-text">${debuffs.join('<br>')}</span><br>`;
  const statuses = [];
  if (piece.stuck > 0) statuses.push(`Stuck (${piece.stuck} turns)`);
  if (piece.isDazed) statuses.push('Dazed');
  if (piece.hasDefensiveWard) statuses.push('Ward (Immune)');
  if (piece.canRiftPulse) statuses.push('Rift Pulse Ready');
  if (piece.isTrapped) statuses.push('Trapped by Shrine');
  const activeShield = (gameState.shields || []).find(s => s.pieceId === piece.id);
  if (activeShield) {
    if (activeShield.name === 'ObsidianPillarShield') {
      statuses.push(`Obsidian Pillar Shield (${activeShield.hp} HP)`);
    } else if (activeShield.name === 'FrostShield') {
      statuses.push('Frost Shield');
    } else {
      statuses.push('Shield');
    }
  }
  if (piece.isSteadfast) statuses.push('Steadfast');
  if (piece.hasPriestsWard) statuses.push("Priest's Ward");
  if (statuses.length > 0) info += `<i>${statuses.join(', ')}</i><br>`;
  if ((piece.overloadPoints || 0) > 0) {
    info += `<br><span class="overload-text">Overload: ${piece.overloadPoints}</span>`;
  }
  info += generateAbilitiesInfoString(piece);
  return info;
}
export function generateAbilitiesInfoString(piece) {
  let info = '';
  if (piece.ability?.key && piece.ability.key !== 'Siphon') {
    const cdText = (piece.ability.cooldown || 0) > 0 ? `CD: ${piece.ability.cooldown}` : 'Ready';
    info += `<div style="margin-top:5px;font-size:11px;line-height:1.3;"><span style="color:#88ccff">Active:</span> <span style="color:#ffcc00">${piece.ability.name}</span> (${cdText})`;
    const desc = getAbilityDescription(piece.ability.key);
    if (desc) {
      info += `<br><span style="color:#ddd">${desc}</span>`;
    }
    info += `</div>`;
  }
  const passiveInfo = getPassiveAbilityInfo(piece);
  if (passiveInfo) {
    info += `<div style="margin-top:3px;font-size:11px;line-height:1.3;"><span style="color:#aaffaa">Passive:</span> ${passiveInfo}</div>`;
  }
  return info;
  return info;
}
function getAbilityDescription(abilityKey) {
  const descriptions = {
    'SetSnare': 'Create a trap on an adjacent empty square. The first enemy to enter is Stuck for 2 turns.',
    'ScorchedRetreat': 'Move 1 square backward and create an Unstable Ground hazard on the square you left.',
    'HuntersRage': 'Gain +1 Power (attacking only) for 2 rounds.',
    'KindleArmor': 'Grants an adjacent ally +1 Power (defending only) for 2 rounds.',
    'SummonIceWisp': 'Summons a Power 0 wisp to an empty square within 4 squares.',
    'Hamstring': 'An adjacent enemy cannot move diagonally for 1 round.',
    'FrostArmor': 'Gain +2 Power (defending only) for 2 rounds.',
    'FrigidPath': 'Creates a 1x3 line of IcyGround. First enemy to enter is Dazed.',
    'GlacialWall': 'Creates two impassable walls on adjacent empty squares. Lasts 3 turns.',
    'FrenziedDash': 'Move 2 squares in a straight line to an empty square. Cannot capture.',
    'LavaGlob': 'Deals 1 permanent damage to an enemy with base power 1 or 2, within 4 squares.',
    'ObsidianPillar': 'Spawns an Obsidian Pillar: deals damage and pushback to enemies, works as cover, and forms an Obsidian Shield when targeting allies.',
    'Pummel': 'Pushes an adjacent enemy back 1 square. Deals no damage.',
    'UnstableGround': 'Make an empty square within 4 squares hazardous.',
    'MarkOfCinder': 'Mark an enemy within 2 squares, reducing its power by 1. Lasts 3 turns.',
    'ChillingAura': 'Activates an aura that reduces the power of adjacent enemies by 1. Lasts 3 turns.',
    'DistractingRoar': 'Reduce effective power of an adjacent enemy by 1 for 1 round.',
    'BlazeLunge': 'Move up to 2 squares in a straight line to an empty square adjacent to an enemy.',
    'CinderSurge': 'Removes all debuffs from an adjacent friendly unit.',
    'IcyShift': 'Swap positions with any unit within 2 squares; both are Dazed for 1 turn.',
    'FrostStomp': 'Daze any adjacent enemy unit for 1 turn.',
    'GlacialBeacon': 'Target empty square within 3; next enemy there is Dazed 1 turn.',
    'VolatileCinder': 'Deals 1 permanent damage to an enemy within 3 squares Marked by Cinder.',
    'HardenedIce': 'Grants an adjacent ally Steadfast for 2 full rounds.',
    'SoulfireBurst': 'Detonates a nearby Unstable Ground, dealing 1 damage to adjacent units.',
    'Siphon': 'Link units to transfer power or absorb debuffs.',
    'FrostfallBlessing': 'AOE (Range 2.5, Rad 2) deals 2 damage to enemies and heals allies for 1 HP for 5 turns.',
    'ReignOfFire': 'CONE (Range 2.5, Arc 60°) deals 2 damage to enemies; deals 1 damage to allies but grants them +2 Strength for 3 turns.',
    'FateLink': 'Binds an ally and enemy (Range 3) for 4 turns; any damage taken by the ally is mirrored exactly to the enemy.',
    'TheReapersToll': 'Steals 1 Defence and 0.4 Agility from an enemy (Range 3) for 4 turns, transferring the stats to self.',
    'GlacialFracture': 'AOE (Range 2.5, Rad 2) deals 2 damage, creates Snow territory, and summons 1 Ice Wisp furthest from caught enemies (Max 2).'
  };
  return descriptions[abilityKey] || '';
}
const PASSIVE_INFO = {
  snowFrostLord: p => {
    const cd = p.helpFromAboveCooldown || 0;
    const active = p.hasHelpFromAboveActive ? ' [ACTIVE]' : '';
    const desc = "Lethal damage is negated; becomes invulnerable for 5 turns and grants nearby allies (Rad 1.5) +1 Strength.";
    return `Help From Above — ${cd > 0 ? `CD: ${cd} turns` : 'Ready'}${active}<br><span style="color:#ccc">${desc}</span>`;
  },
  ashAshTyrant: p => {
    const cd = p.deathMeteorCooldown || 0;
    const desc = "Lethal damage is negated; survives at 1 HP and triggers an explosion (Rad 2) dealing 4 damage to enemies and 2 damage to allies.";
    return `Death Meteor — ${cd > 0 ? `CD: ${cd} turns` : 'Ready'}<br><span style="color:#ccc">${desc}</span>`;
  },
  snowSoulLinker: () => `Cold Snap<br><span style="color:#ccc">If the bound enemy dies, the Soul Linker heals 2 HP; excess healing is converted into a 1-damage absorb shield.</span>`,
  ashAshReaper: () => `Ashes To Ashes<br><span style="color:#ccc">When The Reaper's Toll expires, the stolen stats return and the enemy has a 50% chance to take 1 unavoidable damage.</span>`,
  snowGlacialMage: () => `Frost Duo<br><span style="color:#ccc">Gains +0.2 Control and +0.2 Agility per active Ice Wisp; gains an additional +1 Strength if both Wisps are active.</span>`,
  snowIceWisp: () => `A Cold Farewell<br><span style="color:#ccc">On death, explodes (Rad 1.5) for 4 turns; allies heal 1 HP/turn and get +1 Strength; enemies lose 0.4 Agility and have Control reduced to 0.</span>`
};

function getPassiveAbilityInfo(piece) {
  const handler = PASSIVE_INFO[piece.key];
  return handler ? handler(piece) : null;
}
export function hideAbilityPanel() {
  const panel = $('ability-info-panel');
  if (panel) panel.style.display = 'none';
  resetMobileAbilityBar();
}
export function showVictoryScreen(winningTeam) {
  const banner = $('victoryScreen');
  const title = $('victory-title');
  const art = $('victory-character-art');
  if (!banner || !title) return;
  banner.style.display = 'flex';
  title.textContent = `${winningTeam.toUpperCase()} WINS!`;
  title.className = winningTeam === 'snow' ? 'snow-message' : 'ash-message';
  if (art) { art.src = winningTeam === 'snow' ? 'units/frost-lord.png' : 'units/ash-tyrant.png'; art.style.display = 'block'; }
}

const visualStates = new Map();
export function clearVisualStates() {
  visualStates.clear();
}
export function getPieceVisualState(p) {
  let vis = visualStates.get(p.id);
  const targetX = p.col * C.CELL_SIZE;
  const targetY = p.row * C.CELL_SIZE;
  if (!vis) {
    vis = {
      id: p.id,
      x: targetX,
      y: targetY,
      scale: 1.0,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      lungeDx: 0,
      lungeDy: 0,
      lungeProgress: 1.0,
      pulseProgress: 1.0,
      opacity: 1.0,
      isDead: false,
      deathProgress: 0.0,
      team: p.team,
      key: p.key
    };
    visualStates.set(p.id, vis);
  }
  if (vis && !vis.ambientParticles && (p.key === 'snowFrostLord' || p.key === 'ashAshTyrant')) {
    vis.ambientParticles = Array.from({ length: 12 }, () => ({
      x: (Math.random() - 0.5) * C.CELL_SIZE * 0.7,
      y: (Math.random() - 0.5) * C.CELL_SIZE * 0.7,
      vy: -(Math.random() * 0.35 + 0.15),
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.3
    }));
  }
  return vis;
}
export function updateVisualStates(gameState, deltaTime = 16.67) {
  if (!gameState || !gameState.pieces) return;
  const currentIds = new Set(gameState.pieces.map(p => p.id));
  for (const [id, vis] of visualStates.entries()) {
    const p = gameState.pieces.find(piece => piece.id === id);
    if (!p) {
      if (!vis.isDead) {
        vis.isDead = true;
        vis.deathProgress = 0.0;
        const color = vis.team === 'ash' ? '255,100,80' : '150,200,255';
        const startX = vis.x + C.CELL_SIZE / 2;
        const startY = vis.y + C.CELL_SIZE / 2;
        for (let i = 0; i < 18; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3.5 + 1.2;
          gameState.battleParticles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (Math.random() * 1.5 + 0.5),
            alpha: 1.0,
            radius: Math.random() * 3 + 1.5,
            color
          });
        }
      }
      vis.deathProgress += 0.05 * (deltaTime / 16.67);
      if (vis.deathProgress >= 1.0) {
        visualStates.delete(id);
        continue;
      }
      vis.y -= 1.2 * (deltaTime / 16.67);
      vis.scale = 1.0 - vis.deathProgress;
      vis.opacity = 1.0 - vis.deathProgress;
      continue;
    }
    vis.team = p.team;
    const targetX = p.col * C.CELL_SIZE;
    const targetY = p.row * C.CELL_SIZE;
    const dx = targetX - vis.x;
    const dy = targetY - vis.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.2) {
      const factor = 1.0 - Math.exp(-0.015 * deltaTime);
      vis.x += dx * factor;
      vis.y += dy * factor;
      const lift = Math.sin(Math.min(1.0, dist / (C.CELL_SIZE * 1.5)) * Math.PI) * 0.14;
      vis.scale = 1.0 + lift;
      vis.rotation = Math.sin(Math.min(1.0, dist / (C.CELL_SIZE * 1.5)) * Math.PI * 2) * 0.06;
    } else {
      vis.x = targetX;
      vis.y = targetY;
      vis.rotation = 0;
      if (vis.scale > 1.0) {
        vis.scale -= 0.018 * (deltaTime / 16.67);
        if (vis.scale < 1.0) vis.scale = 1.0;
      } else if (vis.scale < 1.0) {
        vis.scale += 0.018 * (deltaTime / 16.67);
        if (vis.scale > 1.0) vis.scale = 1.0;
      }
    }
    if (vis.lungeProgress < 1.0) {
      vis.lungeProgress += 0.08 * (deltaTime / 16.67);
      if (vis.lungeProgress >= 1.0) {
        vis.lungeProgress = 1.0;
        vis.offsetX = 0;
        vis.offsetY = 0;
      } else {
        if (vis.lungeProgress < 0.25) {
          const pNorm = vis.lungeProgress / 0.25;
          vis.offsetX = vis.lungeDx * pNorm;
          vis.offsetY = vis.lungeDy * pNorm;
        } else {
          const pNorm = (vis.lungeProgress - 0.25) / 0.75;
          const spring = Math.cos(pNorm * Math.PI * 2.5) * Math.exp(-pNorm * 3.8);
          vis.offsetX = vis.lungeDx * spring;
          vis.offsetY = vis.lungeDy * spring;
        }
      }
    }
    if (vis.pulseProgress < 1.0) {
      vis.pulseProgress += 0.06 * (deltaTime / 16.67);
      if (vis.pulseProgress >= 1.0) {
        vis.pulseProgress = 1.0;
        vis.scale = 1.0;
        vis.rotation = 0;
      } else {
        vis.scale = 1.0 + Math.sin(vis.pulseProgress * Math.PI) * 0.24;
        vis.rotation = Math.sin(vis.pulseProgress * Math.PI * 2) * 0.12;
      }
    }
  }
}
export function triggerLunge(pieceId, targetR, targetC) {
  const vis = visualStates.get(pieceId);
  if (!vis) return;
  const targetX = targetC * C.CELL_SIZE;
  const targetY = targetR * C.CELL_SIZE;
  const dx = targetX - vis.x;
  const dy = targetY - vis.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0) {
    vis.lungeDx = (dx / dist) * C.CELL_SIZE * 0.40;
    vis.lungeDy = (dy / dist) * C.CELL_SIZE * 0.40;
    vis.lungeProgress = 0.0;
  }
}
export function triggerObsidianProjectile(pieceId, targetR, targetC, gameState) {
  const p = gameState.pieces.find(pc => pc.id === pieceId);
  if (!p) return;
  const startX = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
  const startY = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetX = targetC * C.CELL_SIZE + C.CELL_SIZE / 2;
  const targetY = targetR * C.CELL_SIZE + C.CELL_SIZE / 2;

  gameState.projectiles = gameState.projectiles || [];
  gameState.projectiles.push({
    x: startX,
    y: startY,
    targetCol: targetC,
    targetRow: targetR,
    speed: 9,
    size: 5,
    color: '#3d1d4d',
    target: null,
    onHit: () => {
      gameState.battleParticles = gameState.battleParticles || [];
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.5 + 1.0;
        const radius = Math.random() * 4 + 2;
        gameState.battleParticles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1.0,
          radius,
          color: Math.random() > 0.4 ? '60, 20, 95' : '25, 10, 40'
        });
      }
    }
  });
}
export function triggerPulse(pieceId) {
  const vis = visualStates.get(pieceId);
  if (vis) vis.pulseProgress = 0.0;
}
let shakeIntensity = 0;
let shakeDuration = 0;
export function triggerScreenshake(intensity, duration = 150) {
  shakeIntensity = intensity;
  shakeDuration = duration;
}
export function triggerPieceDissolve(piece) {
  if (!piece) return;
  const vis = visualStates.get(piece.id) || getPieceVisualState(piece);
  if (vis && !vis.isDead) {
    vis.isDead = true;
    vis.deathProgress = 0.0;
  }
}
export function applyScreenshake(drawCtx) {
  if (shakeDuration > 0) {
    shakeDuration -= 16.67;
    const intensity = (shakeDuration / 150) * shakeIntensity;
    const dx = (Math.random() - 0.5) * intensity;
    const dy = (Math.random() - 0.5) * intensity;
    drawCtx.translate(dx, dy);
  } else {
    shakeIntensity = 0;
    shakeDuration = 0;
  }
}
export function drawPiece(p, targetCtx, gameState) {
  const drawCtx = targetCtx || ctx;
  if (!p || !drawCtx) return;
  try {
    const time = performance.now() * 0.001;
    if (p.isPhasing || p.isSummoning || p.isAnimating) return;
    const img = (gameState.images || {})[p.key];
    if (img && img.complete !== false) {
      const vis = getPieceVisualState(p);
      drawCtx.save();
      let alpha = vis.opacity;
      if (p.isFading) alpha *= p.fadeAlpha;
      drawCtx.globalAlpha = alpha;
      const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;
      const cx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
      const cy = vis.y + yOffset + C.CELL_SIZE / 2 + vis.offsetY;
      const drawSlashLocal = () => {
        if (vis.lungeProgress < 0.6) {
          const attackAngle = Math.atan2(vis.lungeDy, vis.lungeDx);
          const arcRadius = C.CELL_SIZE * 0.65;
          const slashProgress = vis.lungeProgress / 0.6;
          drawCtx.save();
          drawCtx.beginPath();
          drawCtx.strokeStyle = p.team === 'snow' ? 'rgba(100, 220, 255, 0.9)' : 'rgba(255, 110, 40, 0.9)';
          drawCtx.lineWidth = Math.max(3.5, 7.5 * (1 - slashProgress));
          drawCtx.shadowColor = drawCtx.strokeStyle;
          drawCtx.shadowBlur = 10;
          const startSweep = attackAngle - Math.PI / 3.5 + (slashProgress * Math.PI * 2 / 3.5);
          const endSweep = startSweep + Math.PI / 3;
          drawCtx.arc(0, 0, arcRadius, startSweep, endSweep);
          drawCtx.stroke();
          drawCtx.restore();
        }
      };
      const drawSize = C.CELL_SIZE;
      const centerX = 5 * C.CELL_SIZE;
      const flipX = cx > centerX ? -1 : 1;
      const pieceRotation = vis.rotation;
      drawCtx.translate(cx, cy);
      if (gameState.playerTeam === 'ash') {
        drawCtx.rotate(Math.PI);
      }
      drawCtx.rotate(pieceRotation);
      drawCtx.scale(vis.scale * flipX, vis.scale);
      let hasAura = false;
      if (p.isVeteran) hasAura = true;
      if (p.hasHelpFromAbove) hasAura = true;
      if (gameState.temporaryBoosts && gameState.temporaryBoosts.some(b => b.pieceId === p.id)) hasAura = true;
      if (gameState.conduit && gameState.conduit.owner === p.team && gameState.conduit.ownerId === p.id) hasAura = true;
      if (hasAura) {
        drawCtx.save();
        const auraPulse = 0.5 + 0.5 * Math.sin(time * 3);
        const auraRadius = drawSize / 2 + 5 + 8 * auraPulse;
        const auraColorStr = p.team === 'snow' ? '100, 220, 255' : '255, 110, 40';
        const grad = drawCtx.createRadialGradient(0, 0, drawSize / 4, 0, 0, auraRadius);
        grad.addColorStop(0, `rgba(${auraColorStr}, ${0.4 + 0.2 * auraPulse})`);
        grad.addColorStop(1, `rgba(${auraColorStr}, 0)`);
        drawCtx.globalCompositeOperation = 'lighter';
        drawCtx.fillStyle = grad;
        drawCtx.beginPath();
        drawCtx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.restore();
      }

      // Draw shield visual ring around the token if unit has a shield (pale yellow, or obsidian purple)
      const activeShield = (gameState.shields || []).find(s => s.pieceId === p.id);
      if (activeShield) {
        drawCtx.save();
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        drawCtx.globalCompositeOperation = 'lighter';

        if (activeShield.name === 'ObsidianPillarShield') {
          const hp = typeof activeShield.hp === 'number' ? activeShield.hp : 2;
          const shieldOpacity = hp === 1 ? 0.35 : 0.75;
          drawCtx.strokeStyle = `rgba(130, 20, 200, ${shieldOpacity})`;
          drawCtx.lineWidth = 4.5 + pulse * 1.5;
          drawCtx.shadowColor = 'rgba(100, 10, 150, 0.9)';
          drawCtx.shadowBlur = (hp === 1 ? 6 : 14) + pulse * 4;
        } else {
          drawCtx.strokeStyle = 'rgba(255, 255, 180, 0.85)';
          drawCtx.lineWidth = 3.5 + pulse * 1.5;
          drawCtx.shadowColor = 'rgba(255, 255, 150, 0.7)';
          drawCtx.shadowBlur = 10 + pulse * 5;
        }

        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.52, 0, Math.PI * 2);
        drawCtx.stroke();
        drawCtx.restore();
      }

      // Leader/King visual enhancements: premium rotating sigils behind leaders
      if (p.key === 'snowFrostLord') {
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'lighter';
        const rot = time * 0.3;
        drawCtx.rotate(rot);
        drawCtx.strokeStyle = 'rgba(0, 200, 255, 0.45)';
        drawCtx.lineWidth = 1.8;
        drawCtx.setLineDash([4, 12]);
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.58, 0, Math.PI * 2);
        drawCtx.stroke();

        drawCtx.rotate(-rot * 2);
        drawCtx.strokeStyle = `rgba(100, 240, 255, ${0.5 + 0.2 * Math.sin(time * 3.5)})`;
        drawCtx.lineWidth = 2.2;
        drawCtx.setLineDash([8, 8]);
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.46, 0, Math.PI * 2);
        drawCtx.stroke();

        const pulseGlow = 0.5 + 0.3 * Math.sin(time * 3.5);
        const grad = drawCtx.createRadialGradient(0, 0, drawSize * 0.1, 0, 0, drawSize * 0.6);
        grad.addColorStop(0, `rgba(0, 180, 255, ${0.25 * pulseGlow})`);
        grad.addColorStop(1, 'rgba(0, 180, 255, 0)');
        drawCtx.fillStyle = grad;
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.6, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.restore();
      } else if (p.key === 'ashAshTyrant') {
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'lighter';
        const rot = time * 0.25;
        drawCtx.rotate(rot);
        drawCtx.strokeStyle = 'rgba(255, 90, 0, 0.45)';
        drawCtx.lineWidth = 2.2;
        drawCtx.setLineDash([15, 6]);
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.58, 0, Math.PI * 2);
        drawCtx.stroke();

        drawCtx.rotate(-rot * 1.8);
        drawCtx.strokeStyle = `rgba(255, 140, 0, ${0.5 + 0.2 * Math.cos(time * 4.0)})`;
        drawCtx.lineWidth = 1.8;
        drawCtx.setLineDash([4, 18]);
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.48, 0, Math.PI * 2);
        drawCtx.stroke();

        const pulseGlow = 0.5 + 0.3 * Math.cos(time * 4.0);
        const grad = drawCtx.createRadialGradient(0, 0, drawSize * 0.1, 0, 0, drawSize * 0.6);
        grad.addColorStop(0, `rgba(230, 60, 0, ${0.28 * pulseGlow})`);
        grad.addColorStop(1, 'rgba(230, 60, 0, 0)');
        drawCtx.fillStyle = grad;
        drawCtx.beginPath();
        drawCtx.arc(0, 0, drawSize * 0.6, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.restore();
      }

      const frostLord = gameState.pieces?.find(fl => fl.key === 'snowFrostLord');
      const isIntroAnimating = frostLord && gameState.guardianAnimations?.some(a => a.pieceId === frostLord.id);
      let isFrostLordActive = false, isBuffed = false;
      if (isIntroAnimating) {
        if (p.id === frostLord.id) {
          const anim = gameState.guardianAnimations.find(a => a.pieceId === frostLord.id);
          p.helpFromAboveGlowMultiplier = anim ? Math.min(1, Math.max(0, (1 - anim.life) / 0.6)) : 1;
          isFrostLordActive = true;
        } else {
          isBuffed = !!p.helpFromAboveVisualActive;
        }
      } else {
        isFrostLordActive = p.key === 'snowFrostLord' && p.hasHelpFromAboveActive;
        isBuffed = false;
      }
      if ((isBuffed || isFrostLordActive) && (!isIntroAnimating || p.id !== frostLord?.id)) {
        p.helpFromAboveGlowMultiplier = Math.min(1.0, (p.helpFromAboveGlowMultiplier || 0.0) + 0.08);
      }
      if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
        const isReignOfFireBuffed = gameState.temporaryBoosts?.some(b => b.pieceId === p.id && b.name === "ReignOfFireStr");
        if (isBuffed || isFrostLordActive || isReignOfFireBuffed) {
          drawCtx.save();
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
          if (isReignOfFireBuffed) {
            drawCtx.shadowColor = 'rgba(255, 60, 0, 0.95)';
            drawCtx.shadowBlur = 15 + 10 * pulse;
          } else {
            const mult = p.helpFromAboveGlowMultiplier ?? 1.0;
            drawCtx.shadowColor = isFrostLordActive ? `rgba(0, 240, 255, ${0.95 * mult})` : `rgba(255, 215, 0, ${0.95 * mult})`;
            drawCtx.shadowBlur = (isFrostLordActive ? 18 + 12 * pulse : 12 + 8 * pulse) * mult;
          }
          drawCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

          if (isReignOfFireBuffed) {
            // Draw floating magmatic ember particles rising from the piece
            drawCtx.save();
            drawCtx.globalCompositeOperation = 'lighter';
            for (let j = 0; j < 4; j++) {
              const seed = (p.id * 13 + j * 37) % 100;
              const speedY = 0.5 + (seed % 10) * 0.05;
              const rangeX = 15 + (seed % 15);
              const phaseOffset = seed * 0.1;
              const tCycle = (performance.now() * 0.001 * speedY + phaseOffset) % 1.0;

              const px = Math.sin(tCycle * Math.PI * 2 + seed) * rangeX;
              const py = drawSize * 0.5 - tCycle * drawSize * 1.1;
              const size = (1.5 + (seed % 3) * 0.8) * (1.0 - tCycle);
              const alpha = (1.0 - tCycle) * 0.8;

              drawCtx.fillStyle = `rgba(255, ${100 + (seed % 10) * 12}, 10, ${alpha})`;
              drawCtx.shadowColor = 'rgba(255, 100, 0, 0.8)';
              drawCtx.shadowBlur = 6;
              drawCtx.beginPath();
              drawCtx.arc(px, py, size, 0, Math.PI * 2);
              drawCtx.fill();
            }
            drawCtx.restore();
          }

          if (isFrostLordActive) {
            // Draw floating ice crystal particles rising/drifting from the piece
            drawCtx.save();
            drawCtx.globalCompositeOperation = 'lighter';
            for (let j = 0; j < 5; j++) {
              const seed = (p.id * 17 + j * 43) % 100;
              const speedY = 0.4 + (seed % 10) * 0.04;
              const rangeX = 12 + (seed % 12);
              const phaseOffset = seed * 0.15;
              const tCycle = (performance.now() * 0.001 * speedY + phaseOffset) % 1.0;

              const px = Math.sin(tCycle * Math.PI * 2 + seed) * rangeX;
              const py = drawSize * 0.5 - tCycle * drawSize * 1.1;
              const size = (1.2 + (seed % 3) * 0.6) * (1.0 - tCycle);
              const alpha = (1.0 - tCycle) * 0.85;

              drawCtx.fillStyle = `rgba(${135 + (seed % 5) * 20}, 235, 255, ${alpha})`;
              drawCtx.shadowColor = 'rgba(0, 200, 255, 0.8)';
              drawCtx.shadowBlur = 5;

              // Draw small diamond/crystal shape
              drawCtx.beginPath();
              drawCtx.moveTo(px, py - size * 1.5);
              drawCtx.lineTo(px + size, py);
              drawCtx.lineTo(px, py + size * 1.5);
              drawCtx.lineTo(px - size, py);
              drawCtx.closePath();
              drawCtx.fill();
            }
            drawCtx.restore();
          }

          drawCtx.restore();
        } else {
          drawCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        }
      }
      if (vis.ambientParticles) {
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'lighter';
        vis.ambientParticles.forEach(part => {
          part.y += part.vy;
          // Loop back if drift goes out of bounds
          if (part.y < -C.CELL_SIZE * 0.6) {
            part.y = C.CELL_SIZE * 0.5;
            part.x = (Math.random() - 0.5) * C.CELL_SIZE * 0.7;
          }
          drawCtx.fillStyle = p.team === 'snow' ? `rgba(135, 206, 255, ${part.alpha * vis.opacity})` : `rgba(255, 100, 20, ${part.alpha * vis.opacity})`;
          drawCtx.beginPath();
          drawCtx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
          drawCtx.fill();
        });
        drawCtx.restore();
      }
      drawSlashLocal();
      drawCtx.restore();
    }
    const vis = getPieceVisualState(p);
    
    // Counter-rotated overlay block
    drawCtx.save();
    const cellCx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
    const cellCy = vis.y + C.CELL_SIZE / 2 + vis.offsetY;
    drawCtx.translate(cellCx, cellCy);
    if (gameState.playerTeam === 'ash') {
        drawCtx.rotate(Math.PI);
    }

    try {
      const teamBadgeKey = p.team === 'snow' ? 'ice' : (p.team === 'ash' ? 'ash' : null);
      if (teamBadgeKey) {
        const eff = Math.floor((getEffectivePower(p, gameState) ?? p.power ?? 0));
        const maxIdx = (badgeImgs[teamBadgeKey] || []).length - 1;
        const idx = Math.max(0, Math.min(maxIdx, eff));
        const badge = badgeImgs[teamBadgeKey]?.[idx];
        if (badge && badge.complete) {
          const baseScale = 0.20; const perTier = 0.06; const maxScale = 0.5;
          const baseScaleZero = Math.min(maxScale, baseScale + 0.08);
          const scale = (idx === 0) ? baseScaleZero : Math.min(maxScale, baseScale + perTier * (idx - 1));
          const badgeSize = Math.floor(C.CELL_SIZE * scale);
          const pad = Math.max(2, Math.floor(C.CELL_SIZE * 0.02));
          const bx = C.CELL_SIZE / 2 - badgeSize - pad;
          const by = -C.CELL_SIZE / 2 + pad;
          drawCtx.drawImage(badge, bx, by, badgeSize, badgeSize);
          if ((gameState.debuffs || []).some(d => d.pieceId === p.id && d.name === "ColdFarewellControlLock")) {
            drawIceRing(drawCtx, bx + badgeSize / 2, by + badgeSize / 2, badgeSize / 1.5, false);
          }
        }
      }
    } catch (e) { }

    try {
      const maxHp = C.PIECE_TYPES[p.key]?.stats?.hp || 5;
      const curHp = typeof p.currentHp === 'number' ? p.currentHp : maxHp;
      const hpPct = Math.max(0, Math.min(1, curHp / maxHp));
      const barW = C.CELL_SIZE * 0.7;
      const barH = 5;
      const barX = -barW / 2;
      const barY = C.CELL_SIZE / 2 - barH - 4;
      drawCtx.save();
      drawCtx.fillStyle = 'rgba(0,0,0,0.7)';
      drawCtx.beginPath();
      if (drawCtx.roundRect) {
        drawCtx.roundRect(barX, barY, barW, barH, 2.5);
      } else {
        drawCtx.rect(barX, barY, barW, barH);
      }
      drawCtx.fill();
      let hpColor = hpPct > 0.6 ? '#44dd88' : hpPct > 0.3 ? '#ffcc44' : '#ff4444';
      if (p.hasHelpFromAboveActive) {
        hpColor = '#ffffff';
      }
      drawCtx.fillStyle = hpColor;
      if (p.hasHelpFromAboveActive) {
        drawCtx.shadowColor = '#aaeeff';
        drawCtx.shadowBlur = 8;
      }
      drawCtx.beginPath();
      if (drawCtx.roundRect) {
        drawCtx.roundRect(barX, barY, barW * hpPct, barH, 2.5);
      } else {
        drawCtx.rect(barX, barY, barW * hpPct, barH);
      }
      drawCtx.fill();
      drawCtx.shadowBlur = 0;
      if (p.key === 'snowFrostLord') {
        const gemR = barH * 1.0;
        const gemX = barX + barW + gemR + 2;
        const gemY = barY + barH / 2;
        const isReady = (p.helpFromAboveCooldown || 0) <= 0;
        const gemColor = isReady ? '#00eeff' : 'rgba(0,150,180,0.5)';
        drawCtx.beginPath();
        drawCtx.moveTo(gemX, gemY - gemR);
        drawCtx.lineTo(gemX + gemR, gemY);
        drawCtx.lineTo(gemX, gemY + gemR);
        drawCtx.lineTo(gemX - gemR, gemY);
        drawCtx.closePath();
        drawCtx.fillStyle = gemColor;
        if (isReady) {
          drawCtx.shadowColor = '#00eeff';
          drawCtx.shadowBlur = 8 + 4 * Math.sin(performance.now() * 0.006);
        }
        drawCtx.fill();
        drawCtx.shadowBlur = 0;
      }
      drawCtx.restore();
    } catch (e) { }

    try {
      const defVal = p.def || C.PIECE_TYPES[p.key]?.stats?.def || 0;
      const defSize = C.CELL_SIZE * 0.22;
      const defX = -C.CELL_SIZE / 2 + 4;
      const defY = -C.CELL_SIZE / 2 + 4;
      drawCtx.save();
      drawCtx.beginPath();
      drawCtx.moveTo(defX + defSize / 2, defY);
      drawCtx.lineTo(defX + defSize, defY + defSize * 0.3);
      drawCtx.lineTo(defX + defSize * 0.8, defY + defSize);
      drawCtx.lineTo(defX + defSize * 0.2, defY + defSize);
      drawCtx.lineTo(defX, defY + defSize * 0.3);
      drawCtx.closePath();
      drawCtx.fillStyle = 'rgba(70, 130, 180, 0.9)';
      drawCtx.fill();
      drawCtx.lineWidth = 1.5;
      drawCtx.strokeStyle = '#ffffff';
      drawCtx.stroke();
      drawCtx.fillStyle = '#ffffff';
      drawCtx.font = `bold ${Math.floor(defSize * 0.6)}px sans-serif`;
      drawCtx.textAlign = 'center';
      drawCtx.textBaseline = 'middle';
      drawCtx.fillText(String(defVal), defX + defSize / 2, defY + defSize / 2 + 1);
      if ((gameState.debuffs || []).some(d => d.pieceId === p.id && d.name === "ColdFarewellControlLock")) {
        drawIceRing(drawCtx, defX + defSize / 2, defY + defSize / 2, defSize / 1.2, false);
      }
      drawCtx.restore();
    } catch (e) { }

    try {
      if ((p.overloadPoints || 0) > 0) {
        const overlaySize = Math.floor(C.CELL_SIZE * 0.22);
        const ox = -C.CELL_SIZE / 2 + 4;
        const oy = -C.CELL_SIZE / 2 + 4;
        drawCtx.save();
        drawCtx.beginPath();
        drawCtx.fillStyle = p.team === 'snow' ? 'rgba(0,204,255,0.95)' : 'rgba(255,80,20,0.95)';
        drawCtx.shadowColor = drawCtx.fillStyle;
        drawCtx.shadowBlur = 6;
        drawCtx.arc(ox + overlaySize / 2, oy + overlaySize / 2, overlaySize / 2, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.fillStyle = '#ffffff';
        drawCtx.font = `${Math.max(10, Math.floor(overlaySize * 0.9))}px sans-serif`;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(String(p.overloadPoints), ox + overlaySize / 2, oy + overlaySize / 2 + 1);
        drawCtx.restore();
      }
    } catch (e) { }

    if (p.isAnchor) {
      const auraRadius = C.CELL_SIZE * 0.4 + Math.sin(time * 4) * 3;
      drawCtx.strokeStyle = p.team === 'snow' ? 'rgba(100,200,255,0.5)' : 'rgba(255,100,80,0.5)';
      drawCtx.lineWidth = 4 + Math.sin(time * 4) * 1.5;
      drawCtx.beginPath();
      drawCtx.arc(0, 0, auraRadius, 0, 2 * Math.PI);
      drawCtx.stroke();
    }
    if (p.hasDefensiveWard) {
      drawCtx.strokeStyle = `rgba(200,200,255,${0.7 + 0.3 * Math.sin(performance.now() * 0.008)})`;
      drawCtx.lineWidth = 3;
      drawCtx.beginPath();
      drawCtx.arc(0, 0, C.CELL_SIZE * 0.4, 0, 2 * Math.PI);
      drawCtx.stroke();
    }

    p.powerBoosted = (gameState.temporaryBoosts || []).some(b => b.pieceId === p.id && b.amount > 0) || p.shrineBoost > 0 || p.anchorBoost > 0;
    p.isChilled = (gameState.debuffs || []).some(d => d.pieceId === p.id && d.amount > 0) || (gameState.markedPieces || []).some(m => m.targetId === p.id);
    drawStatusIcons(drawCtx, p, 0, 0);

    drawCtx.restore(); // end of counter-rotated overlay block

    drawSiphonRunes(p, gameState);
    // Ash Tyrant reddish revival shield (Death Meteor passive)
    if (p.key === 'ashAshTyrant' && drawDeathMeteorShield) {
      drawDeathMeteorShield(drawCtx, p, gameState);
    }
  } catch (err) { }
}
export function drawDyingPieces(targetCtx, gameState) {
  const drawCtx = targetCtx || ctx;
  if (!drawCtx) return;
  for (const vis of visualStates.values()) {
    if (vis.isDead) {
      const img = (gameState.images || {})[vis.key];
      if (img && img.complete !== false) {
        drawCtx.save();
        drawCtx.globalAlpha = vis.opacity;
        const cx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
        const cy = vis.y + C.CELL_SIZE / 2 + vis.offsetY;
        drawCtx.translate(cx, cy);
        if (gameState.playerTeam === 'ash') {
          drawCtx.rotate(Math.PI);
        }
        drawCtx.rotate(vis.rotation);
        drawCtx.scale(vis.scale, vis.scale);
        drawCtx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        drawCtx.restore();
      }
    }
  }
}
export function renderBoard(gameState) {
  currentGameState = gameState;
  boardCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  if (gameState.voidSquares && gameState.voidSquares.length > 0) {
    boardCtx.fillStyle = '#05000a';
    gameState.voidSquares.forEach(v => {
      const draw = getDrawCoords(v.row, v.col, gameState);
      boardCtx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }
  let riftColor = C.RIFT_COLORS.VOID;
  if (gameState.conduit?.owner === 'snow') riftColor = C.RIFT_COLORS.SNOW;
  if (gameState.conduit?.owner === 'ash') riftColor = C.RIFT_COLORS.ASH;
  let riftPulse = 0;
  if (gameState.conduit?.consecutiveTurnsHeld >= 2) riftPulse = Math.sin(performance.now() * 0.005) * 0.3;
  const riftRadius = C.CELL_SIZE * 1.35;
  const riftCenters = [
    [1.5 * C.CELL_SIZE, 1.5 * C.CELL_SIZE],
    [8.5 * C.CELL_SIZE, 8.5 * C.CELL_SIZE]
  ];
  riftCenters.forEach(([rx, ry]) => {
    boardCtx.save();
    boardCtx.strokeStyle = riftColor === C.RIFT_COLORS.VOID ? 'rgba(148, 0, 211, 0.25)' : riftColor;
    boardCtx.lineWidth = 3.5;
    boardCtx.beginPath();
    boardCtx.arc(rx, ry, riftRadius, 0, Math.PI * 2);
    boardCtx.stroke();
    if (riftColor !== C.RIFT_COLORS.VOID) {
      boardCtx.setLineDash([6, 15]);
      boardCtx.lineWidth = 2;
      boardCtx.beginPath();
      boardCtx.arc(rx, ry, riftRadius + 8, performance.now() * 0.001, performance.now() * 0.001 + Math.PI * 2);
      boardCtx.stroke();
    }
    boardCtx.restore();
  });
  if (gameState.conduitLinkActive && gameState.dynamicRifts && gameState.dynamicRifts.length >= 2) {
    const [rift1, rift2] = gameState.dynamicRifts;
    const draw1 = getDrawCoords(rift1.cells[4][0], rift1.cells[4][1], gameState);
    const startX = (draw1.c + 0.5) * C.CELL_SIZE;
    const startY = (draw1.r + 0.5) * C.CELL_SIZE;
    const draw2 = getDrawCoords(rift2.cells[4][0], rift2.cells[4][1], gameState);
    const endX = (draw2.c + 0.5) * C.CELL_SIZE;
    const endY = (draw2.r + 0.5) * C.CELL_SIZE;
    updateConduitParticles(gameState, startX, startY, endX, endY);
    boardCtx.strokeStyle = gameState.conduitTeam === 'snow' ? 'rgba(100,200,255,0.7)' : 'rgba(255,100,80,0.7)';
    boardCtx.lineWidth = 2 + 1.5 * Math.sin(performance.now() * 0.005);
    boardCtx.beginPath();
    boardCtx.moveTo(startX, startY);
    boardCtx.lineTo(endX, endY);
    boardCtx.stroke();
  }
  if (gameState.spikeRains && gameState.spikeRains.length > 0) {
    gameState.spikeRains.forEach(s => {
      boardCtx.save();
      const draw = getDrawCoords(s.r, s.c, gameState);
      const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
      const centerX = s.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const centerY = s.r * C.CELL_SIZE + C.CELL_SIZE / 2;
      const rPx = s.radius * C.CELL_SIZE;
      boardCtx.globalCompositeOperation = 'lighter';
      boardCtx.fillStyle = s.team === 'snow' ? 'rgba(0,200,255,0.12)' : 'rgba(255,100,50,0.12)';
      boardCtx.beginPath();
      boardCtx.arc(centerX, centerY, rPx, 0, Math.PI * 2);
      boardCtx.fill();
      boardCtx.strokeStyle = s.team === 'snow' ? 'rgba(0,255,255,0.7)' : 'rgba(255,100,50,0.7)';
      boardCtx.lineWidth = 2;
      boardCtx.setLineDash([4, 6]);
      boardCtx.beginPath();
      boardCtx.arc(centerX, centerY, rPx, performance.now() * 0.002, performance.now() * 0.002 + Math.PI * 2);
      boardCtx.stroke();
      boardCtx.restore();
    });
  }
  const snowSet = gameState.snowTerritory || new Set();
  const ashSet = gameState.ashTerritory || new Set();
  const trailLen = (gameState.territoryTrails || []).length;
  let hash = trailLen;
  snowSet.forEach(v => { hash += v.charCodeAt(0) * 10 + v.charCodeAt(2); });
  ashSet.forEach(v => { hash -= v.charCodeAt(0) * 10 + v.charCodeAt(2); });
  const newKey = snowSet.size + '/' + ashSet.size + '/' + hash;
  if ((newKey !== _terrCacheKey) || !_terrCacheCanvas) {
    _terrCacheKey = newKey;
    if (!_terrCacheCanvas) {
      _terrCacheCanvas = document.createElement('canvas');
      _terrCacheCanvas.width = C.CANVAS_SIZE;
      _terrCacheCanvas.height = C.CANVAS_SIZE;
    }
    const tCtx = _terrCacheCanvas.getContext('2d');
    tCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    const CS = C.CELL_SIZE;
    (gameState.territoryTrails || []).forEach(t => {
      const cx = t.col * CS + CS / 2;
      const cy = t.row * CS + CS / 2;
      const rPxRound = Math.round(Math.max(0.1, t.radius || 0.6) * CS);
      const cacheKey = `${t.team}-${rPxRound}`;
      let cachedGrad = gradCache.get(cacheKey);
      if (!cachedGrad) {
        cachedGrad = document.createElement('canvas');
        cachedGrad.width = cachedGrad.height = rPxRound * 2;
        const tempCtx = cachedGrad.getContext('2d');
        const g = tempCtx.createRadialGradient(rPxRound, rPxRound, 0, rPxRound, rPxRound, rPxRound);
        if (t.team === 'snow') {
          g.addColorStop(0, 'rgba(20, 80, 200, 1.0)');
          g.addColorStop(0.5, 'rgba(20, 80, 200, 0.8)');
          g.addColorStop(1, 'rgba(10, 50, 150, 0.0)');
        } else {
          g.addColorStop(0, 'rgba(200, 40, 10, 1.0)');
          g.addColorStop(0.5, 'rgba(200, 40, 10, 0.8)');
          g.addColorStop(1, 'rgba(120, 15, 0, 0.0)');
        }
        tempCtx.fillStyle = g;
        tempCtx.beginPath();
        tempCtx.arc(rPxRound, rPxRound, rPxRound, 0, Math.PI * 2);
        tempCtx.fill();
        gradCache.set(cacheKey, cachedGrad);
      }
      tCtx.globalCompositeOperation = 'source-over';
      tCtx.drawImage(cachedGrad, cx - rPxRound, cy - rPxRound);
    });
  }
  if (_terrCacheCanvas) {
    boardCtx.save();
    boardCtx.globalAlpha = 0.6;
    boardCtx.globalCompositeOperation = 'source-over';
    boardCtx.drawImage(_terrCacheCanvas, 0, 0);
    boardCtx.restore();
  }
  const shrineCx = 5 * C.CELL_SIZE;
  const shrineCy = 5 * C.CELL_SIZE;
  const shrineRadius = C.CELL_SIZE * 1.0;
  boardCtx.save();
  if (gameState.shrineIsOverloaded) {
    boardCtx.strokeStyle = `rgba(255, 30, 30, ${0.7 + 0.3 * Math.sin(performance.now() * 0.01)})`;
    boardCtx.lineWidth = 4;
    boardCtx.shadowColor = 'red';
    boardCtx.shadowBlur = 15;
  } else if (gameState.shrineChargeLevel > 0) {
    boardCtx.strokeStyle = `rgba(186, 85, 211, ${0.7 + 0.3 * Math.sin(performance.now() * 0.005)})`;
    boardCtx.lineWidth = 4;
    boardCtx.shadowColor = 'mediumpurple';
    boardCtx.shadowBlur = 12;
  } else {
    boardCtx.strokeStyle = 'rgba(218, 165, 32, 0.45)';
    boardCtx.lineWidth = 2.5;
  }
  boardCtx.beginPath();
  boardCtx.arc(shrineCx, shrineCy, shrineRadius, 0, Math.PI * 2);
  boardCtx.stroke();
  boardCtx.restore();
  if (gameState.unstableGrounds) {
    gameState.unstableGrounds.forEach(g => {
      const isBurning = g.isBurningGround;
      const draw = getDrawCoords(g.row, g.col, gameState);
      if (isBurning) {
        drawBurningGroundBlock(boardCtx, draw.r, draw.c, C.CELL_SIZE, g.duration, 2);
      } else {
        boardCtx.fillStyle = `rgba(205, 92, 92, 0.4)`;
        boardCtx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      }
    });
  }
  if (gameState.blizzardStorms) {
    gameState.blizzardStorms.forEach(s => {
      const draw = getDrawCoords(s.r, s.c, gameState);
      const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
      const radiusPx = s.radius * C.CELL_SIZE;
      boardCtx.save();
      boardCtx.fillStyle = 'rgba(10, 20, 30, 0.5)';
      boardCtx.beginPath();
      boardCtx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      boardCtx.fill();
      const time = performance.now() * 0.001;
      const grad = boardCtx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
      grad.addColorStop(0, `rgba(200, 255, 255, ${0.4 + 0.1 * Math.sin(time * 2)})`);
      grad.addColorStop(0.7, `rgba(150, 255, 200, ${0.2 + 0.05 * Math.cos(time * 3)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      boardCtx.fillStyle = grad;
      boardCtx.beginPath();
      boardCtx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      boardCtx.fill();
      boardCtx.restore();
    });
  }
  if (gameState.glacialWalls) {
    gameState.glacialWalls.forEach(wall => {
      const draw = getDrawCoords(wall.row, wall.col, gameState);
      drawGlacialWallBlock(boardCtx, draw.r, draw.c, C.CELL_SIZE, gameState, wall.duration);
    });
  }
  if (gameState.specialTerrains) {
    gameState.specialTerrains.forEach(t => {
      const draw = getDrawCoords(t.row, t.col, gameState);
      const x = draw.c * C.CELL_SIZE;
      const y = draw.r * C.CELL_SIZE;
      if (t.type === 'snare') {
        drawSnareTrapBlock(boardCtx, draw.r, draw.c, C.CELL_SIZE, t.age, t.team, gameState.playerTeam);
      } else if (t.type === 'icyGround') {
        drawIcyGroundBlock(boardCtx, draw.r, draw.c, C.CELL_SIZE);
      } else if (t.type === 'magmaShards') {
        drawMagmaShardsBlock(boardCtx, draw.r, draw.c, C.CELL_SIZE, t.duration);
      } else if (t.type === 'beacon') {
        boardCtx.fillStyle = `rgba(135, 206, 250, ${0.3 + Math.sin(performance.now() * 0.005) * 0.2})`;
        boardCtx.fillRect(x, y, C.CELL_SIZE, C.CELL_SIZE);
        boardCtx.strokeStyle = 'rgba(135, 206, 250, 0.8)';
        boardCtx.beginPath();
        boardCtx.arc(x + C.CELL_SIZE / 2, y + C.CELL_SIZE / 2, C.CELL_SIZE / 3, 0, Math.PI * 2);
        boardCtx.stroke();
      } else if (t.type === 'crater') {
        // Permanent impassable crater block
        boardCtx.save();
        const cx = x + C.CELL_SIZE / 2;
        const cy = y + C.CELL_SIZE / 2;
        const rOuter = C.CELL_SIZE * 0.45;
        const rInner = C.CELL_SIZE * 0.28;
        const rHole = C.CELL_SIZE * 0.16;

        // 1. Scorched earth underlay / debris radius (large, low-opacity dark/ashy gradient)
        const ashGrad = boardCtx.createRadialGradient(cx, cy, rInner, cx, cy, C.CELL_SIZE * 0.6);
        ashGrad.addColorStop(0, 'rgba(10, 5, 2, 0.9)');
        ashGrad.addColorStop(0.5, 'rgba(30, 15, 5, 0.6)');
        ashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        boardCtx.fillStyle = ashGrad;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, C.CELL_SIZE * 0.6, 0, Math.PI * 2);
        boardCtx.fill();

        // 2. Draw radial cracks extending from the center
        boardCtx.strokeStyle = 'rgba(210, 70, 0, 0.6)';
        boardCtx.lineWidth = 1.5;
        const numCracks = 6;
        const seed = (Math.round(t.row) * 13 + Math.round(t.col) * 37); // stable seed for each crater cell
        for (let j = 0; j < numCracks; j++) {
          const angle = (j / numCracks) * Math.PI * 2 + (seed * 0.1);
          const dist1 = rInner + (Math.abs((seed + j) % 5) / 5) * 5;
          const dist2 = C.CELL_SIZE * (0.45 + (Math.abs((seed * j) % 4) / 10));

          boardCtx.beginPath();
          boardCtx.moveTo(cx + Math.cos(angle) * dist1, cy + Math.sin(angle) * dist1);
          // Add a jagged vertex to make it look cracked
          const midAngle = angle + (j % 2 === 0 ? 0.1 : -0.1);
          const midDist = (dist1 + dist2) / 2;
          boardCtx.lineTo(cx + Math.cos(midAngle) * midDist, cy + Math.sin(midAngle) * midDist);
          boardCtx.lineTo(cx + Math.cos(angle) * dist2, cy + Math.sin(angle) * dist2);
          boardCtx.stroke();
        }

        // 3. Crater Outer Rim (textured ridge)
        boardCtx.shadowColor = 'rgba(230, 60, 0, 0.4)';
        boardCtx.shadowBlur = 8;
        boardCtx.fillStyle = 'rgba(25, 12, 5, 0.95)';
        boardCtx.strokeStyle = 'rgba(230, 80, 0, 0.85)';
        boardCtx.lineWidth = 3.5;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rOuter, 0, Math.PI * 2);
        boardCtx.fill();
        boardCtx.stroke();
        boardCtx.shadowBlur = 0; // reset shadow

        // 4. Highlight on top-left of the rim to give a 3D look
        boardCtx.strokeStyle = 'rgba(255, 160, 80, 0.35)';
        boardCtx.lineWidth = 2.0;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rOuter, Math.PI * 0.75, Math.PI * 1.75);
        boardCtx.stroke();

        // 5. Shadow on bottom-right of the rim
        boardCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        boardCtx.lineWidth = 2.5;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rOuter, Math.PI * 1.75, Math.PI * 2.75);
        boardCtx.stroke();

        // 6. Slope gradient towards the deep center hole
        const slopeGrad = boardCtx.createRadialGradient(cx, cy, rHole, cx, cy, rOuter);
        slopeGrad.addColorStop(0, '#0a0301');
        slopeGrad.addColorStop(0.3, '#1f0d05');
        slopeGrad.addColorStop(0.8, '#30180c');
        slopeGrad.addColorStop(1, '#251205');
        boardCtx.fillStyle = slopeGrad;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rOuter - 1.5, 0, Math.PI * 2);
        boardCtx.fill();

        // 7. Glowing magma core at the bottom of the crater
        const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.003 + seed);
        const glowGrad = boardCtx.createRadialGradient(cx, cy, 0, cx, cy, rHole * 1.2);
        glowGrad.addColorStop(0, `rgba(255, 200, 50, ${pulse})`);
        glowGrad.addColorStop(0.4, `rgba(255, 90, 0, ${pulse * 0.9})`);
        glowGrad.addColorStop(0.8, `rgba(120, 20, 0, ${pulse * 0.6})`);
        glowGrad.addColorStop(1, 'rgba(10, 3, 0, 0.8)');

        boardCtx.save();
        boardCtx.shadowColor = 'rgba(255, 90, 0, 0.7)';
        boardCtx.shadowBlur = 12 * pulse;
        boardCtx.fillStyle = glowGrad;
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rHole * 1.1, 0, Math.PI * 2);
        boardCtx.fill();
        boardCtx.restore();

        // 8. Dark center depth overlay (the absolute abyss at the bottom)
        boardCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, rHole * 0.55, 0, Math.PI * 2);
        boardCtx.fill();

        boardCtx.restore();
      }
    });
  }
  if (gameState.voidScarSquares) {
    gameState.voidScarSquares.forEach(([r, c]) => {
      boardCtx.fillStyle = `rgba(75, 0, 130, ${0.4 + Math.sin(performance.now() * 0.01) * 0.2})`;
      const draw = getDrawCoords(r, c, gameState);
      boardCtx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }
  drawElementalCores(gameState);
  drawTethers(gameState);
  drawFlashEffects(gameState);
  if (gameState.deathMeteors && gameState.deathMeteors.length > 0) {
    gameState.deathMeteors.forEach(m => {
      const radius = 2;
      const dur = m.duration !== undefined ? m.duration : 6;
      const decay = dur / 6;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const dist = Math.hypot(dr, dc);
          if (dist > radius) continue;
          const tr = m.r + dr, tc = m.c + dc;
          if (tr < 0 || tr >= 10 || tc < 0 || tc >= 10) continue;
          const alpha = Math.max(0.05, (0.55 - dist * 0.12) * decay);
          boardCtx.save();
          boardCtx.fillStyle = `rgba(20,8,0,${alpha})`;
          const draw = getDrawCoords(tr, tc, gameState);
          boardCtx.fillRect(draw.c * C.CELL_SIZE, draw.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
          boardCtx.strokeStyle = `rgba(180,50,0,${alpha * 0.7})`;
          boardCtx.lineWidth = 1.5;
          const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
          const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
          for (let si = 0; si < 3; si++) {
            const ang = (si / 3) * Math.PI * 2 + (tc * 1.3 + tr * 0.7);
            boardCtx.beginPath();
            boardCtx.moveTo(cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4);
            boardCtx.lineTo(cx + Math.cos(ang) * C.CELL_SIZE * 0.28, cy + Math.sin(ang) * C.CELL_SIZE * 0.28);
            boardCtx.stroke();
          }
          boardCtx.restore();
        }
      }
    });
  }
  if (gameState.fateLinks && gameState.fateLinks.length > 0 && gameState.pieces) {
    gameState.fateLinks.forEach(fl => {
      const source = gameState.pieces.find(p => p.id === fl.sourceId);
      const target = gameState.pieces.find(p => p.id === fl.targetId);
      if (!source || !target) return;
      const t = performance.now() * 0.003;
      [source, target].forEach(p => {
        const draw = getDrawCoords(p.row, p.col, gameState);
        const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
        const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2;
        boardCtx.save();
        boardCtx.globalAlpha = 0.75 + 0.2 * Math.sin(t * 2);
        boardCtx.strokeStyle = '#88ddff';
        boardCtx.shadowColor = '#00ccff';
        boardCtx.shadowBlur = 10;
        boardCtx.lineWidth = 1.8;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + t * 0.5;
          const arm = C.CELL_SIZE * 0.32;
          boardCtx.beginPath();
          boardCtx.moveTo(cx, cy);
          boardCtx.lineTo(cx + Math.cos(angle) * arm, cy + Math.sin(angle) * arm);
          const bx = cx + Math.cos(angle) * arm * 0.55;
          const by = cy + Math.sin(angle) * arm * 0.55;
          const bArm = arm * 0.22;
          boardCtx.moveTo(bx + Math.cos(angle + Math.PI / 4) * bArm, by + Math.sin(angle + Math.PI / 4) * bArm);
          boardCtx.lineTo(bx, by);
          boardCtx.lineTo(bx + Math.cos(angle - Math.PI / 4) * bArm, by + Math.sin(angle - Math.PI / 4) * bArm);
          boardCtx.stroke();
        }
        boardCtx.restore();
      });
      boardCtx.save();
      boardCtx.globalAlpha = 0.38 + 0.15 * Math.sin(t);
      boardCtx.fillStyle = 'rgba(160, 230, 255, 0.45)';
      boardCtx.shadowColor = '#00ccff';
      boardCtx.shadowBlur = 16;
      const ex = target.col * C.CELL_SIZE;
      const ey = target.row * C.CELL_SIZE;
      boardCtx.fillRect(ex, ey, C.CELL_SIZE, C.CELL_SIZE);
      boardCtx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
      boardCtx.lineWidth = 2;
      boardCtx.strokeRect(ex + 2, ey + 2, C.CELL_SIZE - 4, C.CELL_SIZE - 4);
      boardCtx.restore();
    });
  }
}
export function drawTethers(gameState) {
  if (!gameState || !gameState.pieces) return;
  boardCtx.save();
  boardCtx.lineCap = 'round';
  gameState.pieces.forEach(siphoner => {
    if (siphoner.ability?.key !== 'Siphon' || !Array.isArray(siphoner.tethers) || siphoner.tethers.length === 0) return;
    const drawS = getDrawCoords(siphoner.row, siphoner.col, gameState);
    const sx = drawS.c * C.CELL_SIZE + C.CELL_SIZE / 2;
    const sy = drawS.r * C.CELL_SIZE + C.CELL_SIZE / 2;
    siphoner.tethers.forEach(t => {
      const ally = t.allyId !== null ? gameState.pieces.find(p => p.id === t.allyId) : null;
      const enemy = t.enemyId !== null ? gameState.pieces.find(p => p.id === t.enemyId) : null;
      const targets = [];
      if (ally) targets.push({ p: ally, mode: t.mode });
      if (enemy) targets.push({ p: enemy, mode: t.mode });
      targets.forEach(({ p: target, mode }) => {
        const drawT = getDrawCoords(target.row, target.col, gameState);
        const tx = drawT.c * C.CELL_SIZE + C.CELL_SIZE / 2;
        const ty = drawT.r * C.CELL_SIZE + C.CELL_SIZE / 2;
        const color = siphoner.team === 'snow' ? 'rgba(0,204,255,0.85)' : 'rgba(255,80,20,0.85)';
        boardCtx.strokeStyle = color;
        boardCtx.lineWidth = 2.5 + ((siphoner.overloadPoints || 0) * 0.4);
        boardCtx.shadowColor = color;
        boardCtx.shadowBlur = 8;
        boardCtx.beginPath();
        boardCtx.moveTo(sx, sy);
        boardCtx.lineTo(tx, ty);
        boardCtx.stroke();
        boardCtx.beginPath();
        boardCtx.fillStyle = color;
        boardCtx.arc(tx, ty, 4 + ((t.mode === 'resonance') ? 2 : 0), 0, Math.PI * 2);
        boardCtx.fill();
      });
    });
  });
  boardCtx.restore();
}
export function resetMobileAbilityBar() {
  const nameEl = $('mobile-ability-name');
  const descEl = $('mobile-ability-description');
  if (nameEl) nameEl.textContent = 'No Unit Selected';
  if (descEl) descEl.innerHTML = 'Select a unit to see its actions.';
  let i = 1;
  let btn = $(`action-btn-${i}`);
  while (btn) {
    btn.textContent = ''; btn.onclick = null; btn.style.display = 'none';
    i++;
    btn = $(`action-btn-${i}`);
  }
  removeMobileOverflow();
}
const visualTestTriggers = {
  snowFrostLord: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnFrostfallBlessingEffect) Effects.spawnFrostfallBlessingEffect(p.row, p.col, gs); } },
    { text: 'Test Passive', action: (p, gs) => { p.hasHelpFromAboveActive = true; p.helpFromAboveActiveTurns = 5; if (Effects.spawnGuardianSaveEffect) Effects.spawnGuardianSaveEffect(p, gs); } }
  ],
  ashAshTyrant: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnReignOfFireEffect) Effects.spawnReignOfFireEffect(p, p.row, Math.min(9, p.col + 2), gs); } },
    { text: 'Test Passive', action: (p, gs) => { p.deathMeteorCooldown = 15; p.hasTriggeredDeathMeteor = true; if (Effects.spawnDeathMeteorEffect) Effects.spawnDeathMeteorEffect(p, gs); } }
  ],
  ashAshStrider: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnScorchedRetreatEffect) Effects.spawnScorchedRetreatEffect(p, p.row, p.col, p.row, Math.min(9, p.col + 1), gs); } }
  ],
  ashMagmaProwler: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnFrenziedDashEffect) Effects.spawnFrenziedDashEffect(p, p.row, p.col, p.row, Math.min(9, p.col + 2), gs); } }
  ],
  ashMagmaSpitter: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnLavaGlobEffect) Effects.spawnLavaGlobEffect(p.row, p.col, p.row, Math.min(9, p.col + 2), gs); } }
  ],
  snowArcticTrapper: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnTrapDeploymentEffect) Effects.spawnTrapDeploymentEffect(p.row, p.col, p.row, Math.min(9, p.col + 1), gs); } }
  ],
  snowGlacialMage: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnGlacialFractureEffect) Effects.spawnGlacialFractureEffect(p.row, p.col, gs); } }
  ],
  snowHoarfrostMystic: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnFrigidPathEffect) Effects.spawnFrigidPathEffect(p.row, p.col, p.row, Math.min(9, p.col + 2), gs); } }
  ],
  snowIceWeaver: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnGlacialWallEffect) Effects.spawnGlacialWallEffect(p.row, Math.min(9, p.col + 1), gs); } }
  ],
  snowRampagingYeti: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnPummelKnockbackEffect) Effects.spawnPummelKnockbackEffect(p, p.row, p.col, p.row, p.col, p.row, Math.min(9, p.col + 1), gs); } }
  ],
  snowSoulLinker: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnFateLinkCast) Effects.spawnFateLinkCast(p, { row: p.row, col: Math.min(9, p.col + 2) }, gs); } }
  ],
  snowIceWisp: [
    { text: 'Test Active', action: (p, gs) => { if (Effects.spawnAColdFarewellEffect) Effects.spawnAColdFarewellEffect(p.row, p.col, gs); } }
  ],
  ashMagmaShaper: [
    { text: 'Test Active', action: (p, gs) => { triggerObsidianProjectile(p.id, p.row, Math.min(9, p.col + 2), gs); } },
    {
      text: 'Test Shield',
      action: (p, gs) => {
        gs.shields = gs.shields || [];
        const existing = gs.shields.find(s => s.pieceId === p.id);
        if (existing) {
          existing.hp = existing.hp === 2 ? 1 : 2;
        } else {
          gs.shields.push({
            pieceId: p.id,
            duration: 2,
            hp: 2,
            maxHp: 2,
            name: "ObsidianPillarShield"
          });
        }
      }
    }
  ]
};

export function showAbilityPanel(piece, gameState) {
  const panel = $('ability-info-panel');
  if (!panel) return;
  const btns = {
    ability: $('abilityBtn'),
    siphon: $('siphonBtn'),
    riftPulse: $('riftPulseBtn'),
    despawn: $('despawnBtn'),
    sacrifice: $('sacrificeBtn'),
    release: $('releaseBtn'),
    unleash: $('unleashAbilities')
  };
  panel.querySelectorAll('[data-dynamic-tether="true"]').forEach(btn => btn.remove());
  resetMobileAbilityBar();
  if (!piece || gameState.gameOver) { toggleEl(panel, false); return; }
  toggleEl(panel, true);
  const infoString = generatePieceInfoString(piece, gameState);
  if ($('ability-description')) $('ability-description').innerHTML = infoString;
  const mobileName = $('mobile-ability-name');
  const mobileDesc = $('mobile-ability-description');
  if (mobileName) mobileName.textContent = C.PIECE_TYPES[piece.key]?.name || 'Unit';
  if (mobileDesc) mobileDesc.innerHTML = infoString;
  let mobileBtnIndex = 1;
  const MAX_VISIBLE = 3;
  _mobileOverflowMenu = [];
  const addMobileBtn = (text, onClick, disabled = false) => {
    if (mobileBtnIndex > MAX_VISIBLE) {
      _mobileOverflowMenu.push({ text, onClick, disabled });
      mobileBtnIndex++;
      return;
    }
    let btn = $(`action-btn-${mobileBtnIndex}`);
    if (!btn) {
      const btn1 = $('action-btn-1');
      if (btn1 && btn1.parentNode) {
        btn = document.createElement('button');
        btn.id = `action-btn-${mobileBtnIndex}`;
        btn.className = btn1.className;
        btn1.parentNode.appendChild(btn);
      } else return;
    }
    btn.textContent = text;
    btn.onclick = () => {
      onClick();
      const drawer = document.getElementById('mobileDrawer');
      if (drawer) drawer.classList.remove('expanded');
    };
    btn.disabled = disabled;
    toggleEl(btn, true);
    mobileBtnIndex++;
  };
  Object.values(btns).forEach(b => toggleEl(b, false));
  if (piece.isTrapped) {
    if (piece.team === gameState.currentTurn) {
      if (btns.sacrifice) {
        toggleEl(btns.sacrifice, true);
        btns.sacrifice.disabled = gameState.factionPassives[piece.team].ascension.isChosen;
        btns.sacrifice.onclick = () => window.sendAction('SACRIFICE', { pieceId: piece.id });
        addMobileBtn('Sacrifice', () => window.sendAction('SACRIFICE', { pieceId: piece.id }), btns.sacrifice.disabled);
      }
      if (btns.release) {
        toggleEl(btns.release, true);
        btns.release.onclick = () => window.sendAction('RELEASE', { pieceId: piece.id });
        addMobileBtn('Release', () => window.sendAction('RELEASE', { pieceId: piece.id }), false);
      }
    }
    return;
  }
  const hasActiveAbility = piece.ability && piece.ability.name;
  if (btns.ability) {
    const onCooldown = (piece.ability?.cooldown || 0) > 0;
    toggleEl(btns.ability, hasActiveAbility);
    if (hasActiveAbility) {
      btns.ability.textContent = piece.ability.name;
      btns.ability.disabled = onCooldown;
      addMobileBtn(piece.ability.name, () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key }), onCooldown);
      btns.ability.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key });
    }
  }
  if (btns.riftPulse) {
    toggleEl(btns.riftPulse, piece.canRiftPulse);
    if (piece.canRiftPulse) {
      btns.riftPulse.onclick = () => window.sendAction('RIFT_PULSE', { pieceId: piece.id });
      addMobileBtn('Rift Pulse', () => window.sendAction('RIFT_PULSE', { pieceId: piece.id }));
    }
  }
  if (btns.despawn) {
    toggleEl(btns.despawn, piece.key === 'snowIceWisp');
    if (piece.key === 'snowIceWisp') {
      btns.despawn.onclick = () => window.sendAction('DESPAWN', { pieceId: piece.id });
      addMobileBtn('Despawn', () => window.sendAction('DESPAWN', { pieceId: piece.id }));
    }
  }
  if (gameState.testMode && visualTestTriggers[piece.key]) {
    visualTestTriggers[piece.key].forEach(test => {
      addMobileBtn(test.text, () => {
        test.action(piece, gameState);
      });
    });
  }
  try {
    if (_mobileOverflowMenu && _mobileOverflowMenu.length > 0) {
      const moreBtnId = `action-btn-${MAX_VISIBLE + 1}`;
      let moreBtn = document.getElementById(moreBtnId);
      if (!moreBtn) {
        const btn1 = document.getElementById('action-btn-1');
        if (btn1 && btn1.parentNode) {
          moreBtn = document.createElement('button');
          moreBtn.id = moreBtnId;
          moreBtn.className = btn1.className;
          btn1.parentNode.appendChild(moreBtn);
        }
      }
      if (moreBtn) {
        moreBtn.textContent = 'More';
        moreBtn.onclick = () => showMobileOverflow(_mobileOverflowMenu.slice());
        toggleEl(moreBtn, true);
        moreBtn.disabled = false;
      }
    }
  } catch (e) { }
}
export function drawElementalCores(gameState) {
  if (!gameState.elementalCores || gameState.elementalCores.length === 0) return;
  const coreColors = { ruby: '#9B111E', topaz: '#EFBF04', emerald: '#39FF14', sapphire: '#0F52BA' };
  const time = performance.now() * 0.003;
  const pulse = 0.8 + 0.2 * Math.sin(time);
  gameState.elementalCores.forEach(core => {
    const draw = getDrawCoords(core.row, core.col, gameState);
    const cx = draw.c * C.CELL_SIZE + C.CELL_SIZE / 2;
    const cy = draw.r * C.CELL_SIZE + C.CELL_SIZE / 2 + Math.sin(time + core.col) * 5;
    const size = C.CELL_SIZE * 0.35;
    const color = coreColors[core.type] || '#ffffff';
    boardCtx.save();
    boardCtx.translate(cx, cy);
    boardCtx.rotate(Math.PI / 4);
    boardCtx.shadowColor = color;
    boardCtx.shadowBlur = 20 * pulse;
    boardCtx.fillStyle = color;
    boardCtx.strokeStyle = 'white';
    boardCtx.lineWidth = 2;
    boardCtx.beginPath();
    boardCtx.rect(-size / 2 * pulse, -size / 2 * pulse, size * pulse, size * pulse);
    boardCtx.fill();
    boardCtx.stroke();
    boardCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    boardCtx.shadowBlur = 0;
    boardCtx.beginPath();
    boardCtx.rect(-size / 5 * pulse, -size / 5 * pulse, size / 2.5 * pulse, size / 2.5 * pulse);
    boardCtx.fill();
    boardCtx.restore();
  });
}
