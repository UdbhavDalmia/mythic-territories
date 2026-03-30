import * as C from './constants.js';
import { getValidMoves, getEffectivePower } from './utils.js';
import {
  activateAbility,
  despawnPiece,
  handleSiphon,
  executeRiftPulse,
  isState,
  GameState,
  getCurrentState,
  executeAscensionChoice,
  cancelAscensionChoice,
  executeSacrifice,
  executeRelease
} from './game.js';
import {
  updateConduitParticles,
  drawSiphonRunes,
  drawStatusIcons,
  updateEffects,
  renderEffects
} from './effects.js';

let boardCtx;
let ctx;

// Badge images (small corner icons for unit power tiers)
const badgeImgs = {
  // ice: indexed by power level (1..7)
  ice: Array.from({ length: 8 }, (_, i) => {
    if (i === 0) return null;
    const im = new Image();
    im.src = `badges/ice-p${i}.png`;
    return im;
  })
};

// ash: same layout as ice, separate assets (ash-p1..ash-p7)
badgeImgs.ash = Array.from({ length: 8 }, (_, i) => {
  if (i === 0) return null;
  const im = new Image();
  im.src = `badges/ash-p${i}.png`;
  return im;
});

// -------------------- Helpers --------------------
const $ = id => document.getElementById(id);
const safeHtml = (el, html) => { if (el) el.innerHTML = html; };

export function initUI(mainCtx, boardContext) {
  ctx = mainCtx;
  boardCtx = boardContext;
}

// Format seconds -> M:SS
const formatTime = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// -------------------- Timers --------------------
export function startTimer(gameState) {
  if (gameState.timerInterval) return;

  gameState.timerInterval = setInterval(() => {
    if (gameState.gameOver || !gameState.gameStarted) return;
    const currentTeam = gameState.currentTurn;
    if (gameState.timers[currentTeam] > 0) {
      gameState.timers[currentTeam]--;
      updateTimerDisplay(gameState);
    } else {
      // lazy import to avoid circular dependency at module load
      import('./game.js').then(m => m.endGame(currentTeam === 'snow' ? 'ash' : 'snow', 'timeout'));
    }
  }, 1000);
}

export function resetTimers(gameState) {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  gameState.timerInterval = null;
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

// -------------------- Messages --------------------
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

// -------------------- Ascension UI --------------------
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
      btn.onclick = () => executeAscensionChoice(pathArg);
      if (btnGroup) btnGroup.appendChild(btn);
    });
  }

  const cancelBtn = $('ascensionCancelBtn-popup');
  if (cancelBtn) cancelBtn.onclick = () => cancelAscensionChoice();
}

export function hideAscensionPopup() {
  const screen = $('ascensionScreen');
  if (!screen) return;
  screen.style.display = 'none';
  screen.classList.remove('active');
  const popupContent = screen.querySelector('.ascension-content');
  if (popupContent) popupContent.classList.remove('shatter-in');
}

// -------------------- Ability Highlights --------------------
export function drawAbilityHighlights(gameState) {
  const currentState = getCurrentState();
  const piece = gameState.selectedPiece;

  // wall placement secondary shows 3x3 minus center
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
          case 'enemy':
            isValid = targetPiece && targetPiece.team !== piece.team && !targetPiece.hasDefensiveWard;
            break;
          case 'friendly':
            isValid = targetPiece && targetPiece.team === piece.team;
            break;
          case 'empty':
            isValid = !targetPiece;
            break;
          case 'any':
            isValid = true;
            break;
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
  for (let i = gameState.flashEffects.length - 1; i >= 0; i--) {
    const e = gameState.flashEffects[i];
    e.life -= 0.04;
    if (e.life <= 0) { gameState.flashEffects.splice(i, 1); continue; }
    boardCtx.fillStyle = `rgba(${e.color},${Math.max(0, e.life * 0.7)})`;
    boardCtx.fillRect(e.c * C.CELL_SIZE, e.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
  }
}

// -------------------- Labels / HUD --------------------
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
  if (isState(GameState.ASCENSION_CHOICE)) return;

  if (gameState.selectedPiece && !isState(GameState.ABILITY_TARGETING)) {
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

// -------------------- Piece Info --------------------
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
    else if (piece.ability.key === 'Siphon') info += `Ability: ${piece.ability.name} (${piece.charges || 0}/${piece.ability.maxCharges} Charges)`;
    else info += `Ability: ${piece.ability.name} (${piece.ability.cooldown > 0 ? 'CD: ' + piece.ability.cooldown : 'Ready'})`;
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

// -------------------- Rendering pieces & board --------------------
export function placePieces(gameState) {
  const time = performance.now() * 0.001;
  gameState.pieces.forEach(p => {
    if (p.isPhasing) return;
    const img = (gameState.images || {})[p.key];
    if (img?.complete) {
      ctx.save();
      if (p.isFading) ctx.globalAlpha = p.fadeAlpha;
      const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;
      ctx.drawImage(img, p.col * C.CELL_SIZE, p.row * C.CELL_SIZE + yOffset, C.CELL_SIZE, C.CELL_SIZE);
      ctx.restore();
    }

    // Draw small power badge for Snow and Ash units according to their effective power (1..7)
    try {
      // map team to badgeImgs key
      const teamBadgeKey = p.team === 'snow' ? 'ice' : (p.team === 'ash' ? 'ash' : null);
      if (teamBadgeKey) {
        const eff = Math.floor(getEffectivePower(p, gameState) || p.power || 0);
        const maxIdx = (badgeImgs[teamBadgeKey] || []).length - 1;
        const idx = Math.max(1, Math.min(maxIdx, eff));
        const badge = badgeImgs[teamBadgeKey]?.[idx];
        if (badge && badge.complete) {
          // dynamic scaling: base + per-tier, clamped to a max
          const baseScale = 0.20; // ~20% of cell for power 1
          const perTier = 0.06; // +6% per additional power
          const maxScale = 0.5; // don't exceed 50% of cell
          const scale = Math.min(maxScale, baseScale + perTier * (idx - 1));
          const badgeSize = Math.floor(C.CELL_SIZE * scale);
          const pad = Math.max(2, Math.floor(C.CELL_SIZE * 0.02));
          const bx = p.col * C.CELL_SIZE + C.CELL_SIZE - badgeSize - pad; // top-right corner
          const by = p.row * C.CELL_SIZE + pad; // small top padding
          ctx.drawImage(badge, bx, by, badgeSize, badgeSize);
        }
      }
    } catch (e) {}

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

    // Bridge game engine flags -> visual effect flags
    p.powerBoosted = (gameState.temporaryBoosts || []).some(b => b.pieceId === p.id && b.amount > 0) || p.shrineBoost > 0 || p.anchorBoost > 0;
    p.isChilled = (gameState.debuffs || []).some(d => d.pieceId === p.id && d.amount > 0) || (gameState.markedPieces || []).some(m => m.targetId === p.id) || p.stuck > 0 || p.isDazed;

    drawStatusIcons(ctx, p, p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2);
  });

  updateEffects();
  renderEffects(ctx);
}

export function renderBoard(gameState) {
  boardCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
  const bgKey = gameState.playerTeam === 'snow' ? 'gameBackgroundSnow' : 'gameBackgroundAsh';
  const backgroundImg = gameState.boardImgs?.[bgKey];
  if (backgroundImg?.complete) boardCtx.drawImage(backgroundImg, 0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

  // Draw void squares
  if (gameState.voidSquares && gameState.voidSquares.length > 0) {
    boardCtx.fillStyle = '#05000a';
    gameState.voidSquares.forEach(v => {
      boardCtx.fillRect(v.col * C.CELL_SIZE, v.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      boardCtx.strokeStyle = '#1a002a';
      boardCtx.lineWidth = 2;
      boardCtx.strokeRect(v.col * C.CELL_SIZE, v.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }

  // Dynamic rifts
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

  // Conduit link
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

  // Grid & territory overlays
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

  // Shrine
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

  // Unstable grounds
  if (gameState.unstableGrounds) {
    gameState.unstableGrounds.forEach(g => {
      const isBurning = g.isBurningGround;
      boardCtx.fillStyle = isBurning ? `rgba(255, 69, 0, ${0.3 + Math.sin(performance.now() * 0.008) * 0.2})` : `rgba(205, 92, 92, 0.4)`;
      boardCtx.fillRect(g.col * C.CELL_SIZE, g.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
      boardCtx.strokeStyle = isBurning ? 'rgba(255, 69, 0, 0.8)' : 'rgba(205, 92, 92, 0.8)';
      boardCtx.lineWidth = 2;
      boardCtx.strokeRect(g.col * C.CELL_SIZE, g.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }

  // Special terrains
  if (gameState.specialTerrains) {
    gameState.specialTerrains.forEach(t => {
      const x = t.col * C.CELL_SIZE;
      const y = t.row * C.CELL_SIZE;
      if (t.type === 'snare') {
        boardCtx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        boardCtx.fillRect(x, y, C.CELL_SIZE, C.CELL_SIZE);
        boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        boardCtx.lineWidth = 2;
        boardCtx.beginPath();
        boardCtx.moveTo(x + 10, y + 10);
        boardCtx.lineTo(x + C.CELL_SIZE - 10, y + C.CELL_SIZE - 10);
        boardCtx.moveTo(x + C.CELL_SIZE - 10, y + 10);
        boardCtx.lineTo(x + 10, y + C.CELL_SIZE - 10);
        boardCtx.stroke();
      } else if (t.type === 'icyGround') {
        boardCtx.fillStyle = 'rgba(224, 255, 255, 0.4)';
        boardCtx.fillRect(x, y, C.CELL_SIZE, C.CELL_SIZE);
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

  // Void scar squares
  if (gameState.voidScarSquares) {
    gameState.voidScarSquares.forEach(([r, c]) => {
      boardCtx.fillStyle = `rgba(75, 0, 130, ${0.4 + Math.sin(performance.now() * 0.01) * 0.2})`;
      boardCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    });
  }

  // Glacial walls
  gameState.glacialWalls.forEach(w => {
    boardCtx.fillStyle = `rgba(173,216,230,${0.7 + (w.duration || 0) * 0.05})`;
    boardCtx.fillRect(w.col * C.CELL_SIZE, w.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
  });

  drawElementalCores(gameState);
  drawFlashEffects(gameState);
}

function resetMobileAbilityBar() {
  const nameEl = $('mobile-ability-name');
  const descEl = $('mobile-ability-description');
  if (nameEl) nameEl.textContent = 'No Unit Selected';
  if (descEl) descEl.innerHTML = 'Select a unit to see its actions.';
  for (let i = 1; i <= 4; i++) {
    const btn = $(`action-btn-${i}`);
    if (btn) { btn.textContent = ''; btn.onclick = null; btn.style.display = 'none'; }
  }
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
  safeHtml($('ability-description'), infoString);

  const mobileName = $('mobile-ability-name');
  const mobileDesc = $('mobile-ability-description');
  if (mobileName) mobileName.textContent = C.PIECE_TYPES[piece.key]?.name || 'Unit';
  if (mobileDesc) mobileDesc.innerHTML = infoString;

  let mobileBtnIndex = 1;
  const addMobileBtn = (text, onClick, disabled = false) => {
    const btn = $(`action-btn-${mobileBtnIndex}`);
    if (!btn || mobileBtnIndex > 4) return;
    btn.textContent = text;
    btn.onclick = onClick;
    btn.disabled = disabled;
    btn.style.display = 'block';
    mobileBtnIndex++;
  };

  if (sacrificeBtn) sacrificeBtn.style.display = 'none';
  if (releaseBtn) releaseBtn.style.display = 'none';

  if (piece.isTrapped) {
    // When trapped, many actions are unavailable
    if (abilityBtn) abilityBtn.style.display = 'none';
    if (siphonBtn) siphonBtn.style.display = 'none';
    if (unleashAbilities) unleashAbilities.style.display = 'none';
    if (riftPulseBtn) riftPulseBtn.style.display = 'none';
    if (despawnBtn) despawnBtn.style.display = 'none';

    if (sacrificeBtn && piece.team === gameState.currentTurn) {
      sacrificeBtn.style.display = 'block';
      sacrificeBtn.disabled = gameState.factionPassives[piece.team].ascension.isChosen;
      sacrificeBtn.onclick = () => executeSacrifice(piece);
      addMobileBtn('Sacrifice', () => executeSacrifice(piece), sacrificeBtn.disabled);
    }

    if (releaseBtn && piece.team === gameState.currentTurn) {
      releaseBtn.style.display = 'block';
      releaseBtn.onclick = () => executeRelease(piece);
      addMobileBtn('Release', () => executeRelease(piece), false);
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
        addMobileBtn(abilityBtn.textContent, () => activateAbility(piece), piece.ultimateCharges === 0);
      } else {
        abilityBtn.textContent = 'Start Channeling';
        abilityBtn.disabled = gameState.turnCount <= C.ULTIMATE_MIN_TURN;
        addMobileBtn(abilityBtn.textContent, () => activateAbility(piece), gameState.turnCount <= C.ULTIMATE_MIN_TURN);
      }
    } else if (!isSiphoner && hasActiveAbility) {
      abilityBtn.textContent = piece.ability.name;
      abilityBtn.disabled = piece.ability.cooldown > 0;
      addMobileBtn(abilityBtn.textContent, () => activateAbility(piece), piece.ability.cooldown > 0);
    }
  }

  if (siphonBtn) {
    siphonBtn.style.display = isSiphoner ? 'block' : 'none';
    if (isSiphoner) addMobileBtn('Siphon', () => handleSiphon(piece), piece.charges >= piece.ability.maxCharges);
  }

  const hasActiveVetAb = piece.isVeteran && piece.secondaryAbilityKey && !C.PIECE_TYPES[piece.key]?.veteranAbility?.isPassive;
  if (unleashAbilities) unleashAbilities.style.display = (isSiphoner || hasActiveVetAb) ? 'flex' : 'none';

  if (isSiphoner) {
    if (btn1) {
      btn1.style.display = 'block';
      btn1.textContent = C.ABILITIES[piece.ability.unleash[0]]?.name || 'Unleash 1';
      addMobileBtn(btn1.textContent, () => activateAbility(piece, piece.ability.unleash[0]), (piece.charges || 0) < 1);
    }
    if (btn2) {
      btn2.style.display = 'block';
      btn2.textContent = C.ABILITIES[piece.ability.unleash[1]]?.name || 'Unleash 2';
      addMobileBtn(btn2.textContent, () => activateAbility(piece, piece.ability.unleash[1]), (piece.charges || 0) < 2);
    }
    if (unleash3Btn) {
      unleash3Btn.style.display = 'block';
      unleash3Btn.textContent = C.ABILITIES[piece.ability.unleash[2]]?.name || 'Unleash 3';
      addMobileBtn(unleash3Btn.textContent, () => activateAbility(piece, piece.ability.unleash[2]), (piece.charges || 0) < 3);
    }
  } else {
    if (btn1) btn1.style.display = 'none';
    if (btn2) btn2.style.display = 'none';

    if (piece.isVeteran && piece.secondaryAbilityKey) {
      const vetAb = C.PIECE_TYPES[piece.key]?.veteranAbility;
      if (!vetAb?.isPassive) {
        if (unleash3Btn) {
          unleash3Btn.style.display = 'block';
          unleash3Btn.textContent = C.ABILITIES[piece.secondaryAbilityKey]?.name || 'Veteran Ability';
          unleash3Btn.disabled = piece.secondaryAbilityCooldown > 0;
          addMobileBtn(unleash3Btn.textContent, () => activateAbility(piece, piece.secondaryAbilityKey), piece.secondaryAbilityCooldown > 0);
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
    if (piece.canRiftPulse) addMobileBtn('Rift Pulse', () => executeRiftPulse(piece));
  }

  if (despawnBtn) {
    despawnBtn.style.display = piece.key === 'snowIceWisp' ? 'block' : 'none';
    if (piece.key === 'snowIceWisp') addMobileBtn('Despawn', () => despawnPiece(piece));
  }
}

function drawElementalCores(gameState) {
  if (!gameState.elementalCores || gameState.elementalCores.length === 0) return;

  const coreColors = {
    ruby: '#9B111E',
    topaz: '#EFBF04',
    emerald: '#39FF14',
    sapphire: '#0F52BA'
  };

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