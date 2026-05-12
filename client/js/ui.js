import * as C from '../../shared/constants.js';
import { getValidMoves, getEffectivePower } from '../../shared/utils.js';
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

// Expose the offscreen board canvas so the main render loop can blit it to the visible canvas
export function getBoardCanvas() {
  return boardCtx && boardCtx.canvas ? boardCtx.canvas : null;
}

const formatTime = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Move this to the top of the file to persist across state changes
let globalTimerInterval = null;

export function startTimer(gameState) {
  if (globalTimerInterval) return; // Prevent multiple intervals

  globalTimerInterval = setInterval(() => {
    if (gameState.gameOver || !gameState.gameStarted) return;
    const currentTeam = gameState.currentTurn || 'snow';

    // Ensure timers object exists
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
  // CRITICAL FIX: Use the exposed stopTimer method to clear the global interval
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

  if (type !== 'error' && type !== 'neutral') updateMessageLog(message, type, gameState);
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
        if (!C.getPieceAt(r, c, gameState.boardMap)) {
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

        const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
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
        const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
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

export function drawLabels(gameState) {
  const snowLabel = $('snowLabel');
  const ashLabel = $('ashLabel');
  const turnLabel = $('turnLabel');
  if (snowLabel) snowLabel.textContent = `Snow: ${gameState.snowTerritory.size}`;
  if (ashLabel) ashLabel.textContent = `Ash: ${gameState.ashTerritory.size}`;
  if (turnLabel) {
    turnLabel.textContent = `TURN ${gameState.turnCount}: ${(gameState.currentTurn || '').toUpperCase()}`;
    turnLabel.className = 'label turn ' + (gameState.currentTurn || '');
  }

  // For Ash player, swap the labels since the board is rotated 180 degrees
  if (gameState.playerTeam === 'ash') {
    if (snowLabel) {
      snowLabel.textContent = `Ash: ${gameState.ashTerritory.size}`;
      snowLabel.className = 'label ash';
    }
    if (ashLabel) {
      ashLabel.textContent = `Snow: ${gameState.snowTerritory.size}`;
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
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      gameState.selectedPiece.col * C.CELL_SIZE + 2,
      gameState.selectedPiece.row * C.CELL_SIZE + 2,
      C.CELL_SIZE - 4,
      C.CELL_SIZE - 4
    );

    getValidMoves(gameState.selectedPiece, gameState).forEach(m => {
      ctx.fillStyle = (m.isHighway || m.isIcyHighway) ? 'cyan' : (m.isAcrobatJump ? 'magenta' : 'lime');
      ctx.beginPath();
      ctx.arc(
        m.col * C.CELL_SIZE + C.CELL_SIZE / 2,
        m.row * C.CELL_SIZE + C.CELL_SIZE / 2,
        C.CELL_SIZE * 0.1,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }
}

function drawTerritoryBorders(team, gameState) {
  const territorySet = team === 'snow' ? gameState.snowTerritory : gameState.ashTerritory;
  const color = team === 'snow' ? 'rgb(150,200,255)' : 'rgb(255,100,80)';
  boardCtx.strokeStyle = color;
  boardCtx.lineWidth = 3;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.005);

  territorySet.forEach(pos => {
    const [r, c] = pos.split(',').map(Number);
    const x = c * C.CELL_SIZE;
    const y = r * C.CELL_SIZE;
    const captureTurn = gameState.territoryCaptureTurn[pos] || 0;
    boardCtx.shadowColor = color;
    boardCtx.shadowBlur = (gameState.turnCount - captureTurn < 2) ? 8 * pulse : 0;

    const borders = [
      !territorySet.has(`${r - 1},${c}`),
      !territorySet.has(`${r},${c + 1}`),
      !territorySet.has(`${r + 1},${c}`),
      !territorySet.has(`${r},${c - 1}`)
    ];

    const offset = boardCtx.lineWidth / 2;
    boardCtx.beginPath();
    if (borders[0]) { boardCtx.moveTo(x + offset, y); boardCtx.lineTo(x + C.CELL_SIZE - offset, y); }
    if (borders[1]) { boardCtx.moveTo(x + C.CELL_SIZE, y + offset); boardCtx.lineTo(x + C.CELL_SIZE, y + C.CELL_SIZE - offset); }
    if (borders[2]) { boardCtx.moveTo(x + C.CELL_SIZE - offset, y + C.CELL_SIZE); boardCtx.lineTo(x + offset, y + C.CELL_SIZE); }
    if (borders[3]) { boardCtx.moveTo(x, y + C.CELL_SIZE - offset); boardCtx.lineTo(x, y + offset); }
    boardCtx.stroke();
  });

  boardCtx.shadowBlur = 0;
}

export function generatePieceInfoString(piece, gameState) {
  if (!piece) return 'Select a unit to see its actions.';
  const typeInfo = C.PIECE_TYPES[piece.key] || {};
  const effectivePower = getEffectivePower(piece, gameState, null, null);

  let info = `<b>${typeInfo.name || 'Unit'}</b> (${piece.team?.charAt(0).toUpperCase() + piece.team?.slice(1)})<br>`;
  info += `Power: ${effectivePower} (Base: ${typeInfo.power || 0})<br>`;

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

  if (piece.key.includes('Lord') || piece.key.includes('Tyrant')) {
    if (piece.isChannelingUltimate) info += `Ultimate: Channeling (${piece.ultimateCharges} Charges)`;
    else if (piece.isUltimateActive) info += `Ultimate: Active (${piece.ultimateDurationLeft} turns left)`;
    else if (gameState.turnCount <= C.ULTIMATE_MIN_TURN) info += `Ultimate: Locked (T${C.ULTIMATE_MIN_TURN + 1})`;
    else info += `Ultimate: Ready (${piece.ultimateCharges} Charges)`;
  } else if (piece.ability?.key) {
    if (C.ABILITIES[piece.ability.key]?.isUltimate) info += `Ultimate: ${piece.ability.name} (${piece.hasUsedUltimate ? 'Used' : 'Ready'})`;
    else if (piece.ability.key === 'Siphon') info += `Ability: ${piece.ability.name}`;
    else info += `Ability: ${piece.ability.name} (${piece.ability.cooldown > 0 ? 'CD: ' + piece.ability.cooldown : 'Ready'})`;
  }

  if ((piece.overloadPoints || 0) > 0) {
    info += `<br><span class="overload-text">Overload: ${piece.overloadPoints}</span>`;
  }

  if (piece.isVeteran && piece.secondaryAbilityKey) {
    const vetAb = C.ABILITIES[piece.secondaryAbilityKey] || C.PIECE_TYPES[piece.key]?.veteranAbility;
    if (vetAb) info += `<br>Veteran Ability: ${vetAb.name} (${piece.secondaryAbilityCooldown > 0 ? `CD: ${piece.secondaryAbilityCooldown}` : 'Ready'})`;
  }

  return info;
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
    if (img?.complete) {
      ctx.save();
      if (p.isFading) ctx.globalAlpha = p.fadeAlpha;
      const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;

      // CRITICAL FIX: Counter-rotate pieces for Ash
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

          // CRITICAL FIX: Counter-rotate badges for Ash
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

        // CRITICAL FIX: Counter-rotate text for Ash
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

export function drawPiece(p, targetCtx, gameState) {
  const drawCtx = targetCtx || ctx;
  if (!p || !drawCtx) return;
  try {
    const time = performance.now() * 0.001;
    if (p.isPhasing || p.isSummoning || p.isAnimating) return;

    const img = (gameState.images || {})[p.key];
    if (img?.complete) {
      drawCtx.save();
      if (p.isFading) drawCtx.globalAlpha = p.fadeAlpha;
      const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;

      // CRITICAL FIX: Counter-rotate pieces for Ash
      if (gameState.playerTeam === 'ash') {
        drawCtx.translate(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + yOffset + C.CELL_SIZE / 2);
        drawCtx.rotate(Math.PI);
        if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
          drawCtx.drawImage(img, -C.CELL_SIZE / 2, -C.CELL_SIZE / 2, C.CELL_SIZE, C.CELL_SIZE);
        }
      } else {
        if (!(p.isDashing && (p.key === 'ashMagmaProwler' || p.key.includes('MagmaProwler')))) {
          drawCtx.drawImage(img, p.col * C.CELL_SIZE, p.row * C.CELL_SIZE + yOffset, C.CELL_SIZE, C.CELL_SIZE);
        }
      }
      drawCtx.restore();
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

          // CRITICAL FIX: Counter-rotate badges for Ash
          if (gameState.playerTeam === 'ash') {
            drawCtx.save();
            drawCtx.translate(bx + badgeSize / 2, by + badgeSize / 2);
            drawCtx.rotate(Math.PI);
            drawCtx.drawImage(badge, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize);
            drawCtx.restore();
          } else {
            drawCtx.drawImage(badge, bx, by, badgeSize, badgeSize);
          }
        }
      }
    } catch (e) { }

    try {
      if ((p.overloadPoints || 0) > 0) {
        const overlaySize = Math.floor(C.CELL_SIZE * 0.22);
        const ox = p.col * C.CELL_SIZE + 4;
        const oy = p.row * C.CELL_SIZE + 4;
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

        // CRITICAL FIX: Counter-rotate text for Ash
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
      drawCtx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, auraRadius, 0, 2 * Math.PI);
      drawCtx.stroke();
    }

    if (p.hasDefensiveWard) {
      drawCtx.strokeStyle = `rgba(200,200,255,${0.7 + 0.3 * Math.sin(performance.now() * 0.008)})`;
      drawCtx.lineWidth = 3;
      drawCtx.beginPath();
      drawCtx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, C.CELL_SIZE * 0.4, 0, 2 * Math.PI);
      drawCtx.stroke();
    }

    drawSiphonRunes(p, gameState);

    p.powerBoosted = (gameState.temporaryBoosts || []).some(b => b.pieceId === p.id && b.amount > 0) || p.shrineBoost > 0 || p.anchorBoost > 0;
    p.isChilled = (gameState.debuffs || []).some(d => d.pieceId === p.id && d.amount > 0) || (gameState.markedPieces || []).some(m => m.targetId === p.id);
    drawStatusIcons(drawCtx, p, p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2);
  } catch (err) { }
}

export function renderBoard(gameState) {
  boardCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  const bgKey = gameState.playerTeam === 'snow' ? 'gameBackgroundSnow' : 'gameBackgroundAsh';
  const backgroundImg = gameState.boardImgs?.[bgKey];

  // CRITICAL FIX: Counter-rotate background for Ash so it appears right-side up
  if (backgroundImg?.complete) {
    if (gameState.playerTeam === 'ash') {
      boardCtx.save();
      boardCtx.translate(C.CANVAS_SIZE / 2, C.CANVAS_SIZE / 2);
      boardCtx.rotate(Math.PI);
      boardCtx.drawImage(backgroundImg, -C.CANVAS_SIZE / 2, -C.CANVAS_SIZE / 2, C.CANVAS_SIZE, C.CANVAS_SIZE);
      boardCtx.restore();
    } else {
      boardCtx.drawImage(backgroundImg, 0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    }
  }

  if (gameState.voidSquares && gameState.voidSquares.length > 0) {
    boardCtx.fillStyle = '#05000a';
    gameState.voidSquares.forEach(v => {
      boardCtx.fillRect(v.col * C.CELL_SIZE, v.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      boardCtx.strokeStyle = '#1a002a';
      boardCtx.lineWidth = 2;
      boardCtx.strokeRect(v.col * C.CELL_SIZE, v.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }

  let riftColor = C.RIFT_COLORS.VOID;
  if (gameState.conduit?.owner === 'snow') riftColor = C.RIFT_COLORS.SNOW;
  if (gameState.conduit?.owner === 'ash') riftColor = C.RIFT_COLORS.ASH;

  let riftPulse = 0;
  if (gameState.conduit?.consecutiveTurnsHeld >= 2) riftPulse = Math.sin(performance.now() * 0.005) * 0.3;

  gameState.dynamicRifts.forEach(rift => {
    rift.cells.forEach(([r, c]) => {
      if (!gameState.voidSquares.some(v => v.row === r && v.col === c)) {
        boardCtx.fillStyle = riftColor;
        boardCtx.globalAlpha = 0.5 + Math.max(0, riftPulse);
        boardCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        boardCtx.lineWidth = 1;
        boardCtx.strokeRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      }
    });
  });
  boardCtx.globalAlpha = 1.0;

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

  for (let r = 0; r < C.ROWS; r++) {
    for (let c = 0; c < C.COLS; c++) {
      const pos = `${r},${c}`;
      boardCtx.fillStyle = gameState.snowTerritory.has(pos) ? 'rgba(100,150,255,0.25)' : gameState.ashTerritory.has(pos) ? 'rgba(255,100,80,0.25)' : 'transparent';
      boardCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      boardCtx.strokeStyle = 'rgba(255,255,255,0.2)';
      boardCtx.strokeRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    }
  }

  drawTerritoryBorders('snow', gameState);
  drawTerritoryBorders('ash', gameState);

  const shrineX = 4 * C.CELL_SIZE;
  const shrineY = 4 * C.CELL_SIZE;
  if (gameState.shrineIsOverloaded) {
    boardCtx.fillStyle = `rgba(255,0,0,${0.4 + 0.2 * Math.sin(performance.now() * 0.01)})`;
    boardCtx.fillRect(shrineX, shrineY, C.CELL_SIZE * 2, C.CELL_SIZE * 2);
  } else if (gameState.shrineChargeLevel > 0) {
    boardCtx.fillStyle = `rgba(148,0,211,${0.2 + 0.1 * Math.sin(performance.now() * 0.005)})`;
    boardCtx.fillRect(shrineX, shrineY, C.CELL_SIZE * 2, C.CELL_SIZE * 2);
  }
  boardCtx.strokeStyle = 'gold';
  boardCtx.lineWidth = 3;
  boardCtx.strokeRect(shrineX, shrineY, C.CELL_SIZE * 2, C.CELL_SIZE * 2);

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
  const unleashAbilities = $('unleash-abilities');
  const unleash3Btn = $('unleash3Btn');
  const btn1 = $('unleash1Btn');
  const btn2 = $('unleash2Btn');
  const riftPulseBtn = $('riftPulseBtn');
  const despawnBtn = $('despawnBtn');
  const sacrificeBtn = $('sacrificeBtn');
  const releaseBtn = $('releaseBtn');

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
  const hasActiveAbility = piece.ability && piece.ability.name;

  if (abilityBtn) {
    abilityBtn.style.display = (isLeader || (!isSiphoner && hasActiveAbility)) ? 'block' : 'none';
    if (isLeader) {
      if (piece.isChannelingUltimate) {
        abilityBtn.textContent = 'Unleash Ultimate';
        abilityBtn.disabled = piece.ultimateCharges === 0;
        addMobileBtn(abilityBtn.textContent, () => window.sendAction('ABILITY', { pieceId: piece.id }), piece.ultimateCharges === 0);
        abilityBtn.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id });
      } else {
        abilityBtn.textContent = 'Start Channeling';
        abilityBtn.disabled = gameState.turnCount <= C.ULTIMATE_MIN_TURN;
        addMobileBtn(abilityBtn.textContent, () => window.sendAction('ABILITY', { pieceId: piece.id }), gameState.turnCount <= C.ULTIMATE_MIN_TURN);
        abilityBtn.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id });
      }
    } else if (!isSiphoner && hasActiveAbility) {
      abilityBtn.textContent = piece.ability.name;
      abilityBtn.disabled = piece.ability.cooldown > 0;
      addMobileBtn(abilityBtn.textContent, () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key }), piece.ability.cooldown > 0);
      abilityBtn.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.ability?.key });
    }
  }

  const hasActiveVetAb = piece.isVeteran && piece.secondaryAbilityKey && !C.PIECE_TYPES[piece.key]?.veteranAbility?.isPassive;
  if (unleashAbilities) unleashAbilities.style.display = (isSiphoner || hasActiveVetAb) ? 'flex' : 'none';

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

    [siphonBtn, btn1, btn2, unleash3Btn].forEach(b => { if (b) b.style.display = 'none'; });

    if (unleashAbilities) {
      unleashAbilities.querySelectorAll('[data-dynamic-tether="true"]').forEach(btn => btn.remove());
    }

    tethers.forEach(t => {
      if (t.valid) {
        const tetherBtn = document.createElement('button');
        const templateBtn = document.getElementById('abilityBtn');
        tetherBtn.className = templateBtn ? (templateBtn.className + ' unleash-btn action-btn').trim() : 'unleash-btn action-btn';
        tetherBtn.setAttribute('data-dynamic-tether', 'true');
        tetherBtn.style.marginTop = '5px';
        tetherBtn.textContent = t.name;
        tetherBtn.onclick = () => window.sendAction('START_TETHER', { pieceId: piece.id, mode: t.mode });

        if (unleashAbilities) {
          tetherBtn.style.display = 'block';
          tetherBtn.style.margin = '6px 0';
          unleashAbilities.appendChild(tetherBtn);
        }

        addMobileBtn(t.name, () => window.sendAction('START_TETHER', { pieceId: piece.id, mode: t.mode }));
      }
    });
  } else {
    if (siphonBtn) siphonBtn.style.display = 'none';
    if (btn1) btn1.style.display = 'none';
    if (btn2) btn2.style.display = 'none';

    if (piece.isVeteran && piece.secondaryAbilityKey) {
      const vetAb = C.PIECE_TYPES[piece.key]?.veteranAbility;
      if (!vetAb?.isPassive) {
        if (unleash3Btn) {
          unleash3Btn.style.display = 'block';
          unleash3Btn.textContent = C.ABILITIES[piece.secondaryAbilityKey]?.name || 'Veteran Ability';
          unleash3Btn.disabled = piece.secondaryAbilityCooldown > 0;
          unleash3Btn.onclick = () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.secondaryAbilityKey });
          addMobileBtn(unleash3Btn.textContent, () => window.sendAction('ABILITY', { pieceId: piece.id, abilityKey: piece.secondaryAbilityKey }), piece.secondaryAbilityCooldown > 0);
        }
      } else {
        if (unleash3Btn) unleash3Btn.style.display = 'none';
      }
    } else {
      if (unleash3Btn) unleash3Btn.style.display = 'none';
    }
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