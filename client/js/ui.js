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
  drawIcyGroundBlock
} from './effects.js';

let boardCtx;
let ctx;
let offCanvas = null;

let _terrCacheCanvas = null;      // cached offscreen canvas with fluid fill
let _terrCacheKey    = '';        // serialized key of last rendered state
let _terrFrameSkip   = 0;        // allow a max of 1 rebuild every N frames
const TERR_SKIP_FRAMES = 2;       // rebuild at most every 3rd frame (≈20fps)

const badgeImgs = {
  ice: Array.from({ length: 8 }, (_, i) => {
    const im = new Image();
    im.src = (i === 0) ? `badges/ice-p0.svg` : `badges/ice-p${i}.png`;
    return im;
  })
};

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

badgeImgs.ash = Array.from({ length: 8 }, (_, i) => {
  const im = new Image();
  im.src = (i === 0) ? `badges/ash-p0.svg` : `badges/ash-p${i}.png`;
  return im;
});

const $ = id => document.getElementById(id);
const safeHtml = (el, html) => { if (el) el.innerHTML = html; };

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
  if (globalTimerInterval) return; // Prevent multiple intervals

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
          ctx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
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
          ctx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
    }
    return;
  }

  if (!piece || (currentState !== GameState.ABILITY_TARGETING && currentState !== GameState.WALL_PLACEMENT_FIRST)) return;

  const abilityKey = gameState.abilityContext?.abilityKey || piece.ability?.key;
  const ability = C.ABILITIES[abilityKey];
  if (!ability) return;

  for (let r = 0; r < C.ROWS; r++) {
    for (let c = 0; c < C.COLS; c++) {
      const distance = Math.max(Math.abs(piece.row - r), Math.abs(piece.col - c));
      if (ability.range >= 0 && distance > ability.range) continue;

      let isValid = false;
      if (ability.specialTargeting) {
        isValid = ability.specialTargeting(piece, { r, c }, gameState);
      } else {
        const targetPiece = C.getPieceAt(r, c, gameState.pieces);
        switch (ability.targetType) {
          case 'enemy': isValid = targetPiece && targetPiece.team !== piece.team && !targetPiece.hasDefensiveWard; break;
          case 'friendly': isValid = targetPiece && targetPiece.team === piece.team; break;
          case 'empty': isValid = !targetPiece; break;
          case 'any': isValid = true; break;
        }
      }

      if (isValid) {
        ctx.fillStyle = 'rgba(0,255,0,0.4)';
        ctx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      }
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
    boardCtx.fillRect(e.c * C.CELL_SIZE, e.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
  }
}

export function calculateDynamicTerritoryAreas(gameState) {
  if (!gameState) return { snow: 0, ash: 0 };

  const N = 6; // 6x6 = 36 subdivision points per cell (3600 total points for 10x10)
  const totalSubcells = 10 * 10 * N * N;

  let snowCoveredCount = 0;
  let ashCoveredCount = 0;

  const radius = 1.0;

  const snowSet = gameState.snowTerritory || new Set();
  const ashSet = gameState.ashTerritory || new Set();
  const trails = gameState.territoryTrails || [];

  const trailsByCell = {};
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      trailsByCell[`${r},${c}`] = [];
    }
  }

  trails.forEach(t => {
    const minR = Math.max(0, Math.floor(t.row - 1.0));
    const maxR = Math.min(9, Math.ceil(t.row + 1.0));
    const minC = Math.max(0, Math.floor(t.col - 1.0));
    const maxC = Math.min(9, Math.ceil(t.col + 1.0));

    for (let gr = minR; gr <= maxR; gr++) {
      for (let gc = minC; gc <= maxC; gc++) {
        trailsByCell[`${gr},${gc}`].push(t);
      }
    }
  });

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const pos = `${r},${c}`;
      const isSnow = snowSet.has(pos);
      const isAsh = ashSet.has(pos);

      const cellTrails = trailsByCell[pos] || [];
      const nearbySnowBases = [];
      const nearbyAshBases = [];

      for (let nr = Math.max(0, r - 1); nr <= Math.min(9, r + 1); nr++) {
        for (let nc = Math.max(0, c - 1); nc <= Math.min(9, c + 1); nc++) {
          const npos = `${nr},${nc}`;
          if (snowSet.has(npos)) {
            nearbySnowBases.push({ cx: nc + 0.5, cy: nr + 0.5 });
          }
          if (ashSet.has(npos)) {
            nearbyAshBases.push({ cx: nc + 0.5, cy: nr + 0.5 });
          }
        }
      }

      for (let sr = 0; sr < N; sr++) {
        const y = r + (sr + 0.5) / N;
        for (let sc = 0; sc < N; sc++) {
          const x = c + (sc + 0.5) / N;

          if (!isAsh) {
            let isCovered = false;
            for (let k = 0; k < nearbySnowBases.length; k++) {
              const base = nearbySnowBases[k];
              if (Math.hypot(x - base.cx, y - base.cy) <= radius) {
                isCovered = true;
                break;
              }
            }
            if (!isCovered) {
              for (let k = 0; k < cellTrails.length; k++) {
                const trail = cellTrails[k];
                if (trail.team === 'snow') {
                  if (Math.hypot(x - (trail.col + 0.5), y - (trail.row + 0.5)) <= radius) {
                    isCovered = true;
                    break;
                  }
                }
              }
            }
            if (isCovered) {
              snowCoveredCount++;
              continue; // A point cannot belong to both territories simultaneously
            }
          }

          if (!isSnow) {
            let isCovered = false;
            for (let k = 0; k < nearbyAshBases.length; k++) {
              const base = nearbyAshBases[k];
              if (Math.hypot(x - base.cx, y - base.cy) <= radius) {
                isCovered = true;
                break;
              }
            }
            if (!isCovered) {
              for (let k = 0; k < cellTrails.length; k++) {
                const trail = cellTrails[k];
                if (trail.team === 'ash') {
                  if (Math.hypot(x - (trail.col + 0.5), y - (trail.row + 0.5)) <= radius) {
                    isCovered = true;
                    break;
                  }
                }
              }
            }
            if (isCovered) {
              ashCoveredCount++;
            }
          }
        }
      }
    }
  }

  const snowArea = (snowCoveredCount / totalSubcells) * 100;
  const ashArea = (ashCoveredCount / totalSubcells) * 100;

  return {
    snow: parseFloat(snowArea.toFixed(1)),
    ash: parseFloat(ashArea.toFixed(1))
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
    ctx.arc(
      i.col * C.CELL_SIZE + C.CELL_SIZE / 2,
      i.row * C.CELL_SIZE + C.CELL_SIZE / 2,
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
    const cx = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const cy = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
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
    const pulseRadius = moveRadiusPx + Math.sin(performance.now() * 0.005) * 3;

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
    ctx.arc(cx, cy, pulseRadius + 6, -time * 0.5, -time * 0.5 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTerritoryBorders(team, gameState) {
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
  if ((gameState.shields || []).some(s => s.pieceId === piece.id)) statuses.push('Magma Shield');
  if (piece.isSteadfast) statuses.push('Steadfast');
  if (piece.hasPriestsWard) statuses.push("Priest's Ward");
  if (statuses.length > 0) info += `<i>${statuses.join(', ')}</i><br>`;

  if ((piece.overloadPoints || 0) > 0) {
    info += `<br><span class="overload-text">Overload: ${piece.overloadPoints}</span>`;
  }

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
    info += `<div style="margin-top:3px;font-size:11px;"><span style="color:#aaffaa">Passive:</span> ${passiveInfo}</div>`;
  }

  return info;
}

function getAbilityDescription(abilityKey) {
    const descriptions = {
        'FrostfallBlessing': 'AOE (Range 2.5, Rad 2) deals 2 damage to enemies and heals allies for 1 HP for 5 turns.',
        'ReignOfFire': 'AOE (Range 2.5, Rad 2) deals 2 damage to enemies; deals 1 damage to allies but grants them +2 Strength for 3 turns.',
        'FateLink': 'Binds an ally and enemy (Range 3) for 4 turns; any damage taken by the ally is mirrored exactly to the enemy.',
        "TheReapersToll": 'Steals 1 Defence and 0.4 Agility from an enemy (Range 3) for 4 turns, transferring the stats to self.',
        'GlacialFracture': 'AOE (Range 2.5, Rad 2) deals 2 damage, creates Snow territory, and summons 1 Ice Wisp furthest from caught enemies (Max 2).'
    };
    return descriptions[abilityKey] || '';
}

function getPassiveAbilityInfo(piece) {
  const key = piece.key;
  if (key === 'snowFrostLord') {
    const cd = piece.helpFromAboveCooldown || 0;
    const active = piece.hasHelpFromAboveActive ? ' [ACTIVE]' : '';
    const desc = "Lethal damage is negated; becomes invulnerable for 5 turns and grants nearby allies (Rad 1.5) +1 Strength.";
    if (cd > 0) return `Help From Above — CD: ${cd} turns${active}<br><span style="color:#ccc">${desc}</span>`;
    return `Help From Above — Ready${active}<br><span style="color:#ccc">${desc}</span>`;
  }
  if (key === 'ashAshTyrant') {
    const cd = piece.deathMeteorCooldown || 0;
    const desc = "Lethal damage is negated; survives at 1 HP and triggers an explosion (Rad 2) dealing 4 damage to enemies and 2 damage to allies.";
    if (cd > 0) return `Death Meteor — CD: ${cd} turns<br><span style="color:#ccc">${desc}</span>`;
    return `Death Meteor — Ready<br><span style="color:#ccc">${desc}</span>`;
  }
  if (key === 'snowSoulLinker') {
    const desc = "If the bound enemy dies, the Soul Linker heals 2 HP; excess healing is converted into a 1-damage absorb shield.";
    return `Cold Snap<br><span style="color:#ccc">${desc}</span>`;
  }
  if (key === 'ashAshReaper') {
    const desc = "When The Reaper's Toll expires, the stolen stats return and the enemy has a 50% chance to take 1 unavoidable damage.";
    return `Ashes To Ashes<br><span style="color:#ccc">${desc}</span>`;
  }
  if (key === 'snowGlacialMage') {
    const desc = "Gains +0.2 Control and +0.2 Agility per active Ice Wisp; gains an additional +1 Strength if both Wisps are active.";
    return `Frost Duo<br><span style="color:#ccc">${desc}</span>`;
  }
  if (key === 'snowIceWisp') {
    const desc = "On death, explodes (Rad 1.5) for 4 turns; allies heal 1 HP/turn and get +1 Strength; enemies lose 0.4 Agility and have Control reduced to 0.";
    return `A Cold Farewell<br><span style="color:#ccc">${desc}</span>`;
  }
  return null;
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

export function placePieces(pieces, gameState) {
  const time = performance.now() * 0.001;
  pieces.forEach(p => {
    if (p.isPhasing) return;
    if (p.isSummoning) return;
    if (p.isAnimating) return;

    const img = (gameState.images || {})[p.key];
    if (img && img.complete !== false) {
      ctx.save();
      if (p.isFading) ctx.globalAlpha = p.fadeAlpha;
      const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;

      if (gameState.playerTeam === 'ash') {
        ctx.translate(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + yOffset + C.CELL_SIZE / 2);
        ctx.rotate(Math.PI);
        if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
          ctx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        }
      } else {
        if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
          ctx.drawImage(img, p.col * C.CELL_SIZE, p.row * C.CELL_SIZE + yOffset, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
      ctx.restore();
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
          const bx = p.col * C.CELL_SIZE + C.CELL_SIZE - badgeSize - pad;
          const by = p.row * C.CELL_SIZE + pad;

          if (gameState.playerTeam === 'ash') {
            ctx.save();
            ctx.translate(bx + badgeSize / 2, by + badgeSize / 2);
            ctx.rotate(Math.PI);
            ctx.drawImage(badge, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize);
            ctx.restore();
          } else {
            ctx.drawImage(badge, bx, by, badgeSize, badgeSize);
          }
        }
      }
    } catch (e) { }

    try {
      if ((p.overloadPoints || 0) > 0) {
        const overlaySize = Math.floor(C.CELL_SIZE * 0.22);
        const ox = p.col * C.CELL_SIZE + 4;
        const oy = p.row * C.CELL_SIZE + 4;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = p.team === 'snow' ? 'rgba(0,204,255,0.95)' : 'rgba(255,80,20,0.95)';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.arc(ox + overlaySize / 2, oy + overlaySize / 2, overlaySize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(10, Math.floor(overlaySize * 0.9))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (gameState.playerTeam === 'ash') {
          ctx.translate(ox + overlaySize / 2, oy + overlaySize / 2);
          ctx.rotate(Math.PI);
          ctx.fillText(String(p.overloadPoints), 0, 1);
        } else {
          ctx.fillText(String(p.overloadPoints), ox + overlaySize / 2, oy + overlaySize / 2 + 1);
        }
        ctx.restore();
      }
    } catch (e) { }

    if (p.isAnchor) {
      const auraRadius = C.CELL_SIZE * 0.4 + Math.sin(time * 4) * 3;
      ctx.strokeStyle = p.team === 'snow' ? 'rgba(100,200,255,0.5)' : 'rgba(255,100,80,0.5)';
      ctx.lineWidth = 4 + Math.sin(time * 4) * 1.5;
      ctx.beginPath();
      ctx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, auraRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    if (p.hasDefensiveWard) {
      ctx.strokeStyle = `rgba(200,200,255,${0.7 + 0.3 * Math.sin(performance.now() * 0.008)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, C.CELL_SIZE * 0.4, 0, 2 * Math.PI);
      ctx.stroke();
    }

    drawSiphonRunes(p, gameState);

    p.powerBoosted = (gameState.temporaryBoosts || []).some(b => b.pieceId === p.id && b.amount > 0) || p.shrineBoost > 0 || p.anchorBoost > 0;
    p.isChilled = (gameState.debuffs || []).some(d => d.pieceId === p.id && d.amount > 0) || (gameState.markedPieces || []).some(m => m.targetId === p.id);
    drawStatusIcons(ctx, p, p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2);
  });

  updateEffects();
  renderEffects(ctx);
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
      lungeProgress: 1.0, // 1.0 = inactive/finished
      pulseProgress: 1.0, // 1.0 = inactive/finished
      opacity: 1.0,
      isDead: false,
      deathProgress: 0.0,
      team: p.team,
      key: p.key
    };
    visualStates.set(p.id, vis);
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
            vy: Math.sin(angle) * speed - (Math.random() * 1.5 + 0.5), // Float upwards
            alpha: 1.0,
            radius: Math.random() * 3 + 1.5,
            color
          });
        }
      }

      vis.deathProgress += 0.05 * (deltaTime / 16.67); // 20 frames transition
      if (vis.deathProgress >= 1.0) {
        visualStates.delete(id);
        continue;
      }

      vis.y -= 1.2 * (deltaTime / 16.67); // Drift upward
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
      vis.lungeProgress += 0.08 * (deltaTime / 16.67); // Snappy lunge execution
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

/**
 * Immediately starts the visual death dissolve on a piece without waiting
 * for it to be removed from gameState.pieces. Useful for triggering on
 * lethal-hit captures before the state mutation propagates.
 */
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
          const f = (gameState.playerTeam === 'ash') ? -1 : 1;
          const attackAngle = Math.atan2(vis.lungeDy * f, vis.lungeDx * f);
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

      const isLeader = p.key.includes('Lord') || p.key.includes('Tyrant');
      const drawSize = isLeader ? C.CELL_SIZE * 1.4 : C.CELL_SIZE;
      
      const centerX = 5 * C.CELL_SIZE;
      const flipX = cx > centerX ? -1 : 1;

      const pieceRotation = vis.rotation; // Usually 0

      drawCtx.translate(cx, cy);
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

      if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
        drawCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      }
      
      drawSlashLocal();
      drawCtx.restore();
    }

    const vis = getPieceVisualState(p);

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
          const bx = vis.x + C.CELL_SIZE - badgeSize - pad + vis.offsetX;
          const by = vis.y + pad + vis.offsetY;

          if (gameState.playerTeam === 'ash') {
            drawCtx.save();
            drawCtx.translate(bx + badgeSize / 2, by + badgeSize / 2);
            drawCtx.rotate(Math.PI);
            drawCtx.drawImage(badge, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize);
            drawCtx.restore();
          } else {
            drawCtx.drawImage(badge, bx, by, badgeSize, badgeSize);
          }

          if ((gameState.debuffs || []).some(d => d.pieceId === p.id && d.name === "ColdFarewellControlLock")) {
            drawCtx.save();
            if (gameState.playerTeam === 'ash') {
              drawCtx.translate(bx + badgeSize / 2, by + badgeSize / 2);
              drawCtx.rotate(Math.PI);
              drawCtx.translate(-(bx + badgeSize / 2), -(by + badgeSize / 2));
            }
            drawCtx.strokeStyle = 'rgba(150, 240, 255, 0.9)';
            drawCtx.lineWidth = 2;
            drawCtx.fillStyle = 'rgba(100, 200, 255, 0.4)';
            drawCtx.shadowColor = '#00ffff';
            drawCtx.shadowBlur = 8;
            drawCtx.beginPath();
            const cx = bx + badgeSize / 2;
            const cy = by + badgeSize / 2;
            const br = badgeSize / 1.5;
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI) / 4;
              const rad = br + (Math.random() - 0.5) * 6;
              if (i === 0) drawCtx.moveTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
              else drawCtx.lineTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
            }
            drawCtx.closePath();
            drawCtx.fill();
            drawCtx.stroke();
            drawCtx.restore();
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
      const barX = vis.x + (C.CELL_SIZE - barW) / 2 + vis.offsetX;
      const barY = vis.y + C.CELL_SIZE - barH - 4 + vis.offsetY;
      
      drawCtx.save();
      if (gameState.playerTeam === 'ash') {
        drawCtx.translate(barX + barW / 2, barY + barH / 2);
        drawCtx.rotate(Math.PI);
        drawCtx.translate(-(barX + barW / 2), -(barY + barH / 2));
      }
      drawCtx.fillStyle = 'rgba(0,0,0,0.7)';
      drawCtx.fillRect(barX, barY, barW, barH);
      let hpColor = '#00ff00';
      if (p.hasHelpFromAboveActive) {
        hpColor = '#ffffff';
      } else if (hpPct <= 0.25) {
        hpColor = '#ff0000';
      } else if (hpPct <= 0.5) {
        hpColor = '#ffff00';
      }
      drawCtx.fillStyle = hpColor;
      if (p.hasHelpFromAboveActive) {
        drawCtx.shadowColor = '#aaeeff';
        drawCtx.shadowBlur = 8;
      }
      drawCtx.fillRect(barX, barY, barW * hpPct, barH);
      drawCtx.shadowBlur = 0;

      if (p.key === 'snowFrostLord') {
        const gemR = barH * 1.0;
        const gemX = barX + barW + gemR + 2;
        const gemY = barY + barH / 2;
        const isReady = (p.helpFromAboveCooldown || 0) <= 0;
        const gemColor = isReady ? '#00eeff' : 'rgba(0,150,180,0.5)';
        drawCtx.beginPath();
        drawCtx.arc(gemX, gemY, gemR, 0, Math.PI * 2);
        drawCtx.fillStyle = gemColor;
        if (isReady) {
          drawCtx.shadowColor = '#00eeff';
          drawCtx.shadowBlur = 8 + 4 * Math.sin(performance.now() * 0.006);
        }
        drawCtx.fill();
        drawCtx.shadowBlur = 0;
      }
      drawCtx.restore();

      const defVal = p.def || C.PIECE_TYPES[p.key]?.stats?.def || 0;
      const defSize = C.CELL_SIZE * 0.22;
      const defX = vis.x + 4 + vis.offsetX; // Top left
      const defY = vis.y + 4 + vis.offsetY;
      
      drawCtx.save();
      if (gameState.playerTeam === 'ash') {
        drawCtx.translate(defX + defSize / 2, defY + defSize / 2);
        drawCtx.rotate(Math.PI);
        drawCtx.translate(-(defX + defSize / 2), -(defY + defSize / 2));
      }
      drawCtx.beginPath();
      drawCtx.moveTo(defX + defSize / 2, defY);
      drawCtx.lineTo(defX + defSize, defY + defSize * 0.3);
      drawCtx.lineTo(defX + defSize * 0.8, defY + defSize);
      drawCtx.lineTo(defX + defSize * 0.2, defY + defSize);
      drawCtx.lineTo(defX, defY + defSize * 0.3);
      drawCtx.closePath();
      drawCtx.fillStyle = 'rgba(70, 130, 180, 0.9)'; // Steel blue shield
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
        drawCtx.strokeStyle = 'rgba(150, 240, 255, 0.9)';
        drawCtx.lineWidth = 2;
        drawCtx.fillStyle = 'rgba(100, 200, 255, 0.4)';
        drawCtx.shadowColor = '#00ffff';
        drawCtx.shadowBlur = 8;
        drawCtx.beginPath();
        const cx = defX + defSize / 2;
        const cy = defY + defSize / 2;
        const br = defSize / 1.2;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const rad = br + (Math.random() - 0.5) * 6;
          if (i === 0) drawCtx.moveTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
          else drawCtx.lineTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
        }
        drawCtx.closePath();
        drawCtx.fill();
        drawCtx.stroke();
      }

      drawCtx.restore();
    } catch (e) { }

    try {
      if ((p.overloadPoints || 0) > 0) {
        const overlaySize = Math.floor(C.CELL_SIZE * 0.22);
        const ox = vis.x + 4 + vis.offsetX;
        const oy = vis.y + 4 + vis.offsetY;
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

        if (gameState.playerTeam === 'ash') {
          drawCtx.translate(ox + overlaySize / 2, oy + overlaySize / 2);
          drawCtx.rotate(Math.PI);
          drawCtx.fillText(String(p.overloadPoints), 0, 1);
        } else {
          drawCtx.fillText(String(p.overloadPoints), ox + overlaySize / 2, oy + overlaySize / 2 + 1);
        }
        drawCtx.restore();
      }
    } catch (e) { }

    if (p.isAnchor) {
      const auraRadius = C.CELL_SIZE * 0.4 + Math.sin(time * 4) * 3;
      drawCtx.strokeStyle = p.team === 'snow' ? 'rgba(100,200,255,0.5)' : 'rgba(255,100,80,0.5)';
      drawCtx.lineWidth = 4 + Math.sin(time * 4) * 1.5;
      drawCtx.beginPath();
      drawCtx.arc(vis.x + C.CELL_SIZE / 2 + vis.offsetX, vis.y + C.CELL_SIZE / 2 + vis.offsetY, auraRadius, 0, 2 * Math.PI);
      drawCtx.stroke();
    }

    if (p.hasDefensiveWard) {
      drawCtx.strokeStyle = `rgba(200,200,255,${0.7 + 0.3 * Math.sin(performance.now() * 0.008)})`;
      drawCtx.lineWidth = 3;
      drawCtx.beginPath();
      drawCtx.arc(vis.x + C.CELL_SIZE / 2 + vis.offsetX, vis.y + C.CELL_SIZE / 2 + vis.offsetY, C.CELL_SIZE * 0.4, 0, 2 * Math.PI);
      drawCtx.stroke();
    }

    if (p.key === 'snowFrostLord' && p.hasHelpFromAboveActive) {
      const pulseFactor = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
      const ringRadius = C.CELL_SIZE * 0.48 + pulseFactor * 4;
      const pcx = vis.x + C.CELL_SIZE / 2 + vis.offsetX;
      const pcy = vis.y + C.CELL_SIZE / 2 + vis.offsetY;
      drawCtx.save();
      drawCtx.strokeStyle = `rgba(0, 230, 255, ${0.6 + 0.4 * pulseFactor})`;
      drawCtx.lineWidth = 3;
      drawCtx.shadowColor = '#00eeff';
      drawCtx.shadowBlur = 14;
      drawCtx.setLineDash([6, 5]);
      drawCtx.lineDashOffset = -performance.now() * 0.05;
      drawCtx.beginPath();
      drawCtx.arc(pcx, pcy, ringRadius, 0, Math.PI * 2);
      drawCtx.stroke();
      drawCtx.setLineDash([]);
      drawCtx.lineWidth = 1.5;
      drawCtx.strokeStyle = `rgba(180, 255, 255, ${0.5 + 0.3 * pulseFactor})`;
      drawCtx.beginPath();
      drawCtx.arc(pcx, pcy, ringRadius * 0.78, 0, Math.PI * 2);
      drawCtx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + performance.now() * 0.001;
        const sx = pcx + Math.cos(angle) * ringRadius * 0.78;
        const sy = pcy + Math.sin(angle) * ringRadius * 0.78;
        const ex = pcx + Math.cos(angle) * ringRadius * 1.1;
        const ey = pcy + Math.sin(angle) * ringRadius * 1.1;
        drawCtx.beginPath();
        drawCtx.moveTo(sx, sy);
        drawCtx.lineTo(ex, ey);
        drawCtx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        drawCtx.lineWidth = 2;
        drawCtx.shadowBlur = 6;
        drawCtx.stroke();
      }
      drawCtx.restore();
    }

    drawSiphonRunes(p, gameState);

    p.powerBoosted = (gameState.temporaryBoosts || []).some(b => b.pieceId === p.id && b.amount > 0) || p.shrineBoost > 0 || p.anchorBoost > 0;
    p.isChilled = (gameState.debuffs || []).some(d => d.pieceId === p.id && d.amount > 0) || (gameState.markedPieces || []).some(m => m.targetId === p.id);
    drawStatusIcons(drawCtx, p, vis.x + C.CELL_SIZE / 2 + vis.offsetX, vis.y + C.CELL_SIZE / 2 + vis.offsetY);
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

        if (gameState.playerTeam === 'ash') {
          drawCtx.translate(cx, cy);
          drawCtx.rotate(Math.PI + vis.rotation);
          drawCtx.scale(vis.scale, vis.scale);
          drawCtx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        } else {
          drawCtx.translate(cx, cy);
          drawCtx.rotate(vis.rotation);
          drawCtx.scale(vis.scale, vis.scale);
          drawCtx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        }
        drawCtx.restore();
      }
    }
  }
}

export function renderBoard(gameState) {
  boardCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  const bgKey = gameState.playerTeam === 'snow' ? 'gameBackgroundSnow' : 'gameBackgroundAsh';
  const backgroundImg = gameState.boardImgs?.[bgKey];

  if (backgroundImg?.complete) {
    boardCtx.drawImage(backgroundImg, 0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  } else {
    const bgGrad = boardCtx.createRadialGradient(
      C.CANVAS_SIZE / 2, C.CANVAS_SIZE / 2, 50,
      C.CANVAS_SIZE / 2, C.CANVAS_SIZE / 2, C.CANVAS_SIZE * 0.75
    );
    if (gameState.playerTeam === 'snow') {
      bgGrad.addColorStop(0, '#0a1226');
      bgGrad.addColorStop(1, '#020308');
    } else {
      bgGrad.addColorStop(0, '#220c04');
      bgGrad.addColorStop(1, '#060201');
    }
    boardCtx.fillStyle = bgGrad;
    boardCtx.fillRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  }

  if (gameState.voidSquares && gameState.voidSquares.length > 0) {
    boardCtx.fillStyle = '#05000a';
    gameState.voidSquares.forEach(v => {
      boardCtx.fillRect(v.col * C.CELL_SIZE, v.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
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
    const startX = (rift1.cells[4][1] + 0.5) * C.CELL_SIZE;
    const startY = (rift1.cells[4][0] + 0.5) * C.CELL_SIZE;
    const endX = (rift2.cells[4][1] + 0.5) * C.CELL_SIZE;
    const endY = (rift2.cells[4][0] + 0.5) * C.CELL_SIZE;
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
      const cx = s.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const cy = s.r * C.CELL_SIZE + C.CELL_SIZE / 2;
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

  const snowSet  = gameState.snowTerritory  || new Set();
  const ashSet   = gameState.ashTerritory   || new Set();
  const trailLen = (gameState.territoryTrails || []).length;
  
  if (trailLen === 0 && snowSet.size === 0 && ashSet.size === 0) {
    _terrCacheKey = "";
    _terrCacheCanvas = null;
  }
  
  let hash = trailLen;
  snowSet.forEach(v => { hash += v.charCodeAt(0) * 10 + v.charCodeAt(2); });
  ashSet.forEach(v => { hash -= v.charCodeAt(0) * 10 + v.charCodeAt(2); });
  const newKey   = snowSet.size + '/' + ashSet.size + '/' + hash;

  const needRebuild = (newKey !== _terrCacheKey) || !_terrCacheCanvas;

  if (needRebuild) {
    _terrCacheKey  = newKey;

    if (!_terrCacheCanvas) {
      _terrCacheCanvas = document.createElement('canvas');
      _terrCacheCanvas.width  = C.CANVAS_SIZE;
      _terrCacheCanvas.height = C.CANVAS_SIZE;
    }
    const tCtx = _terrCacheCanvas.getContext('2d');
    tCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

    const CS = C.CELL_SIZE;

    if (gameState.territoryTrails) {
      if (!window._gradCache) window._gradCache = {};
      
      gameState.territoryTrails.forEach(t => {
        const cx = t.col * CS + CS / 2;
        const cy = t.row * CS + CS / 2;
        const rPx = Math.max(0.1, (t.radius || 0.6)) * CS;
        const rPxRound = Math.round(rPx);
        
        const cacheKey = `${t.team}-${rPxRound}`;
        if (!window._gradCache[cacheKey]) {
          const tempCanvas = document.createElement('canvas');
          const d = rPxRound * 2;
          tempCanvas.width = d;
          tempCanvas.height = d;
          const tempCtx = tempCanvas.getContext('2d');
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
          window._gradCache[cacheKey] = tempCanvas;
        }
        
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.drawImage(window._gradCache[cacheKey], cx - rPxRound, cy - rPxRound);
      });
    }
  }

  if (_terrCacheCanvas) {
    boardCtx.save();
    boardCtx.globalAlpha = 0.6; // Apply transparency to the entire flattened territory layer
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
      if (isBurning) {
        drawBurningGroundBlock(boardCtx, g.row, g.col, C.CELL_SIZE, g.duration, 2);
      } else {
        boardCtx.fillStyle = `rgba(205, 92, 92, 0.4)`;
        boardCtx.fillRect(g.col * C.CELL_SIZE, g.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      }
    });
  }

  if (gameState.blizzardStorms) {
    gameState.blizzardStorms.forEach(s => {
      const cx = s.c * C.CELL_SIZE + C.CELL_SIZE / 2;
      const cy = s.r * C.CELL_SIZE + C.CELL_SIZE / 2;
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
      drawGlacialWallBlock(boardCtx, wall.row, wall.col, C.CELL_SIZE, gameState, wall.duration);
    });
  }

  if (gameState.specialTerrains) {
    gameState.specialTerrains.forEach(t => {
      const x = t.col * C.CELL_SIZE;
      const y = t.row * C.CELL_SIZE;
      if (t.type === 'snare') {
        drawSnareTrapBlock(boardCtx, t.row, t.col, C.CELL_SIZE, t.age, t.team, gameState.playerTeam);
      } else if (t.type === 'icyGround') {
        drawIcyGroundBlock(boardCtx, t.row, t.col, C.CELL_SIZE);
      } else if (t.type === 'beacon') {
        boardCtx.fillStyle = `rgba(135, 206, 250, ${0.3 + Math.sin(performance.now() * 0.005) * 0.2})`;
        boardCtx.fillRect(x, y, C.CELL_SIZE, C.CELL_SIZE);
        boardCtx.strokeStyle = 'rgba(135, 206, 250, 0.8)';
        boardCtx.beginPath();
        boardCtx.arc(x + C.CELL_SIZE / 2, y + C.CELL_SIZE / 2, C.CELL_SIZE / 3, 0, Math.PI * 2);
        boardCtx.stroke();
      }
    });
  }

  if (gameState.voidScarSquares) {
    gameState.voidScarSquares.forEach(([r, c]) => {
      boardCtx.fillStyle = `rgba(75, 0, 130, ${0.4 + Math.sin(performance.now() * 0.01) * 0.2})`;
      boardCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }

  drawElementalCores(gameState);
  drawTethers(gameState);
  drawFlashEffects(gameState);

  if (gameState.deathMeteors && gameState.deathMeteors.length > 0) {
    gameState.deathMeteors.forEach(m => {
      const radius = 2; // matches the explosion radius
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const dist = Math.hypot(dr, dc);
          if (dist > radius) continue;
          const tr = m.r + dr, tc = m.c + dc;
          if (tr < 0 || tr >= 10 || tc < 0 || tc >= 10) continue;
          const alpha = Math.max(0.15, 0.55 - dist * 0.12);
          boardCtx.save();
          boardCtx.fillStyle = `rgba(20,8,0,${alpha})`;
          boardCtx.fillRect(tc * C.CELL_SIZE, tr * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
          boardCtx.strokeStyle = `rgba(180,50,0,${alpha * 0.7})`;
          boardCtx.lineWidth = 1.5;
          const cx = tc * C.CELL_SIZE + C.CELL_SIZE / 2;
          const cy = tr * C.CELL_SIZE + C.CELL_SIZE / 2;
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
        const cx = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const cy = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
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
    const sx = siphoner.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const sy = siphoner.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    siphoner.tethers.forEach(t => {
      const ally = t.allyId !== null ? gameState.pieces.find(p => p.id === t.allyId) : null;
      const enemy = t.enemyId !== null ? gameState.pieces.find(p => p.id === t.enemyId) : null;
      const targets = [];
      if (ally) targets.push({ p: ally, mode: t.mode });
      if (enemy) targets.push({ p: enemy, mode: t.mode });

      targets.forEach(({ p: target, mode }) => {
        const tx = target.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const ty = target.row * C.CELL_SIZE + C.CELL_SIZE / 2;
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

export function showAbilityPanel(piece, gameState) {
  const panel = $('ability-info-panel');
  if (!panel) return;

  const abilityBtn = $('abilityBtn');
  const siphonBtn = $('siphonBtn');
  const riftPulseBtn = $('riftPulseBtn');
  const despawnBtn = $('despawnBtn');
  const sacrificeBtn = $('sacrificeBtn');
  const releaseBtn = $('releaseBtn');

  panel.querySelectorAll('[data-dynamic-tether="true"]').forEach(btn => btn.remove());

  resetMobileAbilityBar();
  if (!piece || gameState.gameOver) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
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
    btn.onclick = onClick;
    btn.disabled = disabled;
    btn.style.display = 'block';
    mobileBtnIndex++;
  };

  if (sacrificeBtn) sacrificeBtn.style.display = 'none';
  if (releaseBtn) releaseBtn.style.display = 'none';

  if (piece.isTrapped) {
    if (abilityBtn) abilityBtn.style.display = 'none';
    if (siphonBtn) siphonBtn.style.display = 'none';
    if (unleashAbilities) unleashAbilities.style.display = 'none';
    if (riftPulseBtn) riftPulseBtn.style.display = 'none';
    if (despawnBtn) despawnBtn.style.display = 'none';
    if (sacrificeBtn && piece.team === gameState.currentTurn) {
      sacrificeBtn.style.display = 'block';
      sacrificeBtn.disabled = gameState.factionPassives[piece.team].ascension.isChosen;
      sacrificeBtn.onclick = () => window.sendAction('SACRIFICE', { pieceId: piece.id });
      addMobileBtn('Sacrifice', () => window.sendAction('SACRIFICE', { pieceId: piece.id }), sacrificeBtn.disabled);
    }
    if (releaseBtn && piece.team === gameState.currentTurn) {
      releaseBtn.style.display = 'block';
      releaseBtn.onclick = () => window.sendAction('RELEASE', { pieceId: piece.id });
      addMobileBtn('Release', () => window.sendAction('RELEASE', { pieceId: piece.id }), false);
    }
    return;
  }

  const isLeader = piece.key.includes('Lord') || piece.key.includes('Tyrant');
  const isSiphoner = piece.ability?.key === 'Siphon';
  const hasActiveAbility = piece.ability && piece.ability.name && piece.ability.key !== 'Siphon';

  if (abilityBtn) {
    const onCooldown = (piece.ability?.cooldown || 0) > 0;
    abilityBtn.style.display = hasActiveAbility ? 'block' : 'none';
    if (hasActiveAbility) {
      abilityBtn.textContent = piece.ability.name;
      abilityBtn.disabled = onCooldown;
      addMobileBtn(piece.ability.name, () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key }), onCooldown);
      abilityBtn.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key });
    }
  }

  if (isSiphoner) {
    const onRift = C.SHAPES.riftAreas.some(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
    const maxRange = onRift ? 4 : 3;

    let hasAlly = false, hasEnemy = false;
    let hasAllyWithPower = false, hasEnemyWithPower = false;
    gameState.pieces.forEach(p => {
      if (p.id === piece.id) return;
      if (Math.max(Math.abs(piece.row - p.row), Math.abs(piece.col - p.col)) <= maxRange) {
        if (p.team === piece.team) hasAlly = true;
        else hasEnemy = true;
        if (p.power && p.power > 0) {
          if (p.team === piece.team) hasAllyWithPower = true;
          else hasEnemyWithPower = true;
        }
      }
    });

    const canVent = (piece.overloadPoints > 0) && (onRift || C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col));

    if (canVent) {
      if (abilityBtn) {
        abilityBtn.style.display = 'block';
        abilityBtn.textContent = 'Vent Overload';
        abilityBtn.disabled = false;
        abilityBtn.onclick = () => window.sendAction('VENT_OVERLOAD', { pieceId: piece.id });
      }
      addMobileBtn('Vent Overload', () => window.sendAction('VENT_OVERLOAD', { pieceId: piece.id }));
    } else {
      if (abilityBtn) abilityBtn.style.display = 'none';
    }

    const tethers = [
      { mode: 'benevolent', name: 'Benevolent Link', valid: hasAlly && piece.power > 0 },
      { mode: 'hostile', name: 'Hostile Drain', valid: hasEnemyWithPower },
      { mode: 'parasitic', name: 'Parasitic Siphon', valid: hasAllyWithPower },
      { mode: 'resonance', name: 'Resonance Weave', valid: hasAlly && hasEnemyWithPower }
    ];

    if (siphonBtn) siphonBtn.style.display = 'none';

    tethers.forEach(t => {
      if (t.valid) {
        const tetherBtn = document.createElement('button');
        const templateBtn = document.getElementById('abilityBtn');
        tetherBtn.className = templateBtn ? (templateBtn.className + ' action-btn').trim() : 'action-btn';
        tetherBtn.setAttribute('data-dynamic-tether', 'true');
        tetherBtn.style.marginTop = '5px';
        tetherBtn.textContent = t.name;
        tetherBtn.onclick = () => window.sendAction('START_TETHER', { pieceId: piece.id, mode: t.mode });
        tetherBtn.style.display = 'block';
        tetherBtn.style.margin = '6px 0';
        const panel = $('ability-info-panel');
        if (panel) panel.appendChild(tetherBtn);
        addMobileBtn(t.name, () => window.sendAction('START_TETHER', { pieceId: piece.id, mode: t.mode }));
      }
    });
  } else {
    if (siphonBtn) siphonBtn.style.display = 'none';
  }

  if (riftPulseBtn) {
    riftPulseBtn.style.display = piece.canRiftPulse ? 'block' : 'none';
    if (piece.canRiftPulse) {
      riftPulseBtn.onclick = () => window.sendAction('RIFT_PULSE', { pieceId: piece.id });
      addMobileBtn('Rift Pulse', () => window.sendAction('RIFT_PULSE', { pieceId: piece.id }));
    }
  }

  if (despawnBtn) {
    despawnBtn.style.display = piece.key === 'snowIceWisp' ? 'block' : 'none';
    if (piece.key === 'snowIceWisp') {
      despawnBtn.onclick = () => window.sendAction('DESPAWN', { pieceId: piece.id });
      addMobileBtn('Despawn', () => window.sendAction('DESPAWN', { pieceId: piece.id }));
    }
  }

  try {
    const MORE_SLOT = MAX_VISIBLE + 1;
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
        moreBtn.style.display = 'block';
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
    const cx = core.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const cy = core.row * C.CELL_SIZE + C.CELL_SIZE / 2 + Math.sin(time + core.col) * 5;
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