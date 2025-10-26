import * as C from './constants.js';
import { getValidMoves, getEffectivePower } from './utils.js';
import { spawnBurningGroundParticle, updateConduitParticles, drawShrineOverloadEffects, drawSiphonRunes } from './effects.js';
import { activateAbility, despawnPiece, handleSiphon, executeRiftPulse, isState, GameState, getCurrentState } from './game.js';

let boardCtx, ctx;

export function initUI(mainCtx, boardContext) {
    ctx = mainCtx;
    boardCtx = boardContext;
}

export function renderBoard(gameState) {
    boardCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    const bgKey = gameState.playerTeam === 'snow' ? 'gameBackgroundSnow' : 'gameBackgroundAsh';
    const backgroundImg = gameState.boardImgs?.[bgKey];
    if (backgroundImg?.complete) boardCtx.drawImage(backgroundImg, 0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

    if (gameState.conduitLinkActive) {
        const [rift1, rift2] = C.SHAPES.riftAreas;
        const startX = (rift1.cells[4][1] + 0.5) * C.CELL_SIZE;
        const startY = (rift1.cells[4][0] + 0.5) * C.CELL_SIZE;
        const endX = (rift2.cells[4][1] + 0.5) * C.CELL_SIZE;
        const endY = (rift2.cells[4][0] + 0.5) * C.CELL_SIZE;
        const color = gameState.conduitTeam === 'snow' ? 'rgba(100, 200, 255, 0.7)' : 'rgba(255, 100, 80, 0.7)';
        const pulse = 2 + 1.5 * Math.sin(performance.now() * 0.005);

        updateConduitParticles(gameState, startX, startY, endX, endY);

        boardCtx.strokeStyle = color;
        boardCtx.lineWidth = pulse;
        boardCtx.shadowColor = color;
        boardCtx.shadowBlur = 15;
        boardCtx.beginPath();
        boardCtx.moveTo(startX, startY);
        boardCtx.lineTo(endX, endY);
        boardCtx.stroke();
        boardCtx.shadowBlur = 0;
    }

    for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
            const pos = `${r},${c}`;
            if (gameState.snowTerritory.has(pos)) boardCtx.fillStyle = "rgba(100,150,255,0.25)";
            else if (gameState.ashTerritory.has(pos)) boardCtx.fillStyle = "rgba(255,100,80,0.25)";
            else boardCtx.fillStyle = "transparent";
            boardCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
            boardCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            boardCtx.strokeRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        }
    }

    drawTerritoryBorders("snow", gameState);
    drawTerritoryBorders("ash", gameState);

    gameState.pieces.forEach(p => {
        if (p.ability?.name === "Chilling Aura" && p.ability.active) {
            const pulse = 0.3 + 0.2 * Math.sin(performance.now() * 0.005);
            boardCtx.fillStyle = `rgba(100, 200, 255, ${pulse})`;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const rr = p.row + dr, cc = p.col + dc;
                    if (rr >= 0 && rr < C.ROWS && cc >= 0 && cc < C.COLS) {
                        boardCtx.fillRect(cc * C.CELL_SIZE, rr * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
                    }
                }
            }
        }
    });

    const shrineX = 4 * C.CELL_SIZE, shrineY = 4 * C.CELL_SIZE;
    const shrineW = C.CELL_SIZE * 2, shrineH = C.CELL_SIZE * 2;

    if (gameState.shrineIsOverloaded) {
        const pulse = 0.4 + 0.2 * Math.sin(performance.now() * 0.01);
        boardCtx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        boardCtx.fillRect(shrineX, shrineY, shrineW, shrineH);
    } else if (gameState.shrineChargeLevel > 0) {
        const pulse = 0.2 + 0.1 * Math.sin(performance.now() * 0.005);
        boardCtx.fillStyle = `rgba(148, 0, 211, ${pulse})`;
        boardCtx.fillRect(shrineX, shrineY, shrineW, shrineH);
    }

    boardCtx.strokeStyle = "gold";
    boardCtx.lineWidth = 3;
    boardCtx.strokeRect(shrineX, shrineY, shrineW, shrineH);

    gameState.glacialWalls.forEach(w => {
        const x = w.col * C.CELL_SIZE;
        const y = w.row * C.CELL_SIZE;
        boardCtx.fillStyle = `rgba(173, 216, 230, ${0.7 + (w.duration || 0) * 0.05})`;
        boardCtx.fillRect(x, y, C.CELL_SIZE, C.CELL_SIZE);
        boardCtx.strokeStyle = "lightblue";
        boardCtx.lineWidth = 3;
        boardCtx.strokeRect(x + 1, y + 1, C.CELL_SIZE - 2, C.CELL_SIZE - 2);
        boardCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        boardCtx.lineWidth = 2;
        boardCtx.strokeRect(x + 4, y + 4, C.CELL_SIZE - 8, C.CELL_SIZE - 8);
    });

    gameState.unstableGrounds.forEach(g => {
        let flicker;
        let color;
        if (g.isBurningGround) {
            flicker = 0.5 + Math.sin(performance.now() * 0.01 + g.row * 5) * 0.2;
            color = `rgba(255, 69, 0, ${flicker})`;
            spawnBurningGroundParticle(g.row, g.col, gameState);
        } else {
            flicker = 0.3 + Math.sin(performance.now() * 0.007 + g.row) * 0.15;
            color = `rgba(139, 0, 0, ${flicker})`;
        }
        boardCtx.fillStyle = color;
        boardCtx.fillRect(g.col * C.CELL_SIZE, g.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);

        boardCtx.strokeStyle = g.isBurningGround ? "rgba(255, 100, 0, 0.7)" : "rgba(255, 0, 0, 0.6)";
        boardCtx.lineWidth = 1;
        boardCtx.strokeRect(g.col * C.CELL_SIZE + 2, g.row * C.CELL_SIZE + 2, C.CELL_SIZE - 4, C.CELL_SIZE - 4);

        if (!g.isBurningGround) {
            boardCtx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            boardCtx.lineWidth = 2;
            const x = g.col * C.CELL_SIZE;
            const y = g.row * C.CELL_SIZE;
            boardCtx.beginPath();
            boardCtx.moveTo(x + 10, y + 15);
            boardCtx.lineTo(x + C.CELL_SIZE - 15, y + C.CELL_SIZE - 20);
            boardCtx.moveTo(x + 20, y + C.CELL_SIZE - 10);
            boardCtx.lineTo(x + C.CELL_SIZE - 10, y + 10);
            boardCtx.stroke();
        }
    });

    drawFlashEffects(gameState);
    // drawShrineOverloadEffects is intentionally drawn on main ctx in effects module
}

function drawFlashEffects(gameState) {
    for (let i = gameState.flashEffects.length - 1; i >= 0; i--) {
        const effect = gameState.flashEffects[i];
        effect.life -= 0.04;
        if (effect.life <= 0) {
            gameState.flashEffects.splice(i, 1);
            continue;
        }
        boardCtx.fillStyle = `rgba(${effect.color}, ${Math.max(0, effect.life * 0.7)})`;
        boardCtx.fillRect(effect.c * C.CELL_SIZE, effect.r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
    }
}

function drawTerritoryBorders(team, gameState) {
    const territorySet = team === "snow" ? gameState.snowTerritory : gameState.ashTerritory;
    const color = team === "snow" ? "rgb(150, 200, 255)" : "rgb(255, 100, 80)";
    boardCtx.strokeStyle = color;
    boardCtx.lineWidth = 3;
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.005);
    territorySet.forEach(pos => {
        const [r, c] = pos.split(',').map(Number);
        const x = c * C.CELL_SIZE, y = r * C.CELL_SIZE;
        const captureTurn = gameState.territoryCaptureTurn[pos] || 0;
        boardCtx.shadowColor = color;
        boardCtx.shadowBlur = (gameState.turnCount - captureTurn < 2) ? 8 * pulse : 0;
        const borders = [
            !territorySet.has(`${r - 1},${c}`),
            !territorySet.has(`${r},${c + 1}`),
            !territorySet.has(`${r + 1},${c}`),
            !territorySet.has(`${r},${c - 1}`)
        ];
        const borderOffset = boardCtx.lineWidth / 2;
        boardCtx.beginPath();
        if (borders[0]) { boardCtx.moveTo(x + borderOffset, y); boardCtx.lineTo(x + C.CELL_SIZE - borderOffset, y); }
        if (borders[1]) { boardCtx.moveTo(x + C.CELL_SIZE, y + borderOffset); boardCtx.lineTo(x + C.CELL_SIZE, y + C.CELL_SIZE - borderOffset); }
        if (borders[2]) { boardCtx.moveTo(x + C.CELL_SIZE - borderOffset, y + C.CELL_SIZE); boardCtx.lineTo(x + borderOffset, y + C.CELL_SIZE); }
        if (borders[3]) { boardCtx.moveTo(x, y + C.CELL_SIZE - borderOffset); boardCtx.lineTo(x, y + borderOffset); }
        boardCtx.stroke();
    });
    boardCtx.shadowBlur = 0;
}

export function placePieces(gameState) {
    const time = performance.now() * 0.001;
    gameState.pieces.forEach(p => {
        if (p.isPhasing) return;

        const img = (gameState.images || {})[p.key];
        if (img?.complete) {
            ctx.save();
            if (p.isFading) ctx.globalAlpha = p.fadeAlpha;
            if (p.stuck > 0) ctx.filter = 'saturate(0.3) brightness(1.5) contrast(1.2)';

            const yOffset = p === gameState.selectedPiece ? Math.sin(time * 2.5) * 2 : 0;
            ctx.drawImage(img, p.col * C.CELL_SIZE, p.row * C.CELL_SIZE + yOffset, C.CELL_SIZE, C.CELL_SIZE);
            ctx.restore();
        }

        if (p.stuck > 0) {
            const pulse = 0.5 + 0.2 * Math.sin(performance.now() * 0.003);
            ctx.fillStyle = `rgba(173, 216, 230, ${pulse})`;
            ctx.fillRect(p.col * C.CELL_SIZE, p.row * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(p.col * C.CELL_SIZE + 2, p.row * C.CELL_SIZE + 2, C.CELL_SIZE - 4, C.CELL_SIZE - 4);
        }

        if (gameState.markedPieces.some(m => m.target === p)) {
            const pulse = 0.8 + 0.2 * Math.sin(performance.now() * 0.01);
            ctx.strokeStyle = `rgba(255, 69, 0, ${pulse})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, C.CELL_SIZE * 0.45, 0, 2 * Math.PI);
            ctx.stroke();
        }

        const tempBoost = gameState.temporaryBoosts.find(b => b.piece === p);
        if (tempBoost) {
            const centerX = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const centerY = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
            for (let i = 0; i < 3; i++) {
                const angle = time * 3 + (i * (Math.PI * 2 / 3));
                const radius = C.CELL_SIZE * 0.35 + Math.sin(angle * 2) * 3;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        if (p.isDazed) {
            const centerX = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const y = p.row * C.CELL_SIZE + C.CELL_SIZE * 0.1;
            const angle = time * 5;
            ctx.font = "bold 20px sans-serif";
            ctx.fillStyle = "yellow";
            ctx.save();
            ctx.translate(centerX, y);
            ctx.rotate(Math.sin(angle) * 0.3);
            ctx.fillText("?", 0, 0);
            ctx.restore();
        }

        if (p.isAnchor) {
            const centerX = p.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const centerY = p.row * C.CELL_SIZE + C.CELL_SIZE / 2;
            const auraRadius = C.CELL_SIZE * 0.4 + Math.sin(time * 4) * 3;
            const color = p.team === 'snow' ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 100, 80, 0.5)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 4 + Math.sin(time * 4) * 1.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(centerX, centerY, auraRadius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (p.hasDefensiveWard) {
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.008);
            ctx.strokeStyle = `rgba(200, 200, 255, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.col * C.CELL_SIZE + C.CELL_SIZE / 2, p.row * C.CELL_SIZE + C.CELL_SIZE / 2, C.CELL_SIZE * 0.4, 0, 2 * Math.PI);
            ctx.stroke();
        }

        drawSiphonRunes(p, gameState);
    });
}

export function drawLastMoveIndicator(gameState) {
    if (gameState.lastMoveIndicator && gameState.lastMoveIndicator.life > 0) {
        const indicator = gameState.lastMoveIndicator;
        const x = indicator.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const y = indicator.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        ctx.save();
        ctx.globalAlpha = Math.max(0, indicator.life);
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        const radius = C.CELL_SIZE / 2 * (1.0 - indicator.life);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        indicator.life -= 0.02;
    } else if (gameState.lastMoveIndicator) {
        gameState.lastMoveIndicator = null;
    }
}

export function drawSelection(gameState) {
    if (gameState.selectedPiece && !isState(GameState.ABILITY_TARGETING)) {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 4;
        ctx.strokeRect(gameState.selectedPiece.col * C.CELL_SIZE + 2, gameState.selectedPiece.row * C.CELL_SIZE + 2, C.CELL_SIZE - 4, C.CELL_SIZE - 4);
        getValidMoves(gameState.selectedPiece, gameState).forEach(m => {
            ctx.fillStyle = m.isHighway ? "cyan" : "lime";
            ctx.beginPath();
            ctx.arc(m.col * C.CELL_SIZE + C.CELL_SIZE / 2, m.row * C.CELL_SIZE + C.CELL_SIZE / 2, C.CELL_SIZE * 0.1, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

export function drawAbilityHighlights(gameState) {
    const currentState = getCurrentState();
    const piece = gameState.selectedPiece;

    if (currentState === GameState.WALL_PLACEMENT_SECOND && gameState.firstWallCoords) {
        const { row: firstRow, col: firstCol } = gameState.firstWallCoords;
        for (let r = firstRow - 1; r <= firstRow + 1; r++) {
            for (let c = firstCol - 1; c <= firstCol + 1; c++) {
                if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) continue;
                if (r === firstRow && c === firstCol) continue;
                const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                if (!targetPiece) {
                    ctx.fillStyle = "rgba(0, 255, 0, 0.4)";
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
    const { range } = ability;
    const { row: pRow, col: pCol, team } = piece;

    for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
            const distance = Math.max(Math.abs(pRow - r), Math.abs(pCol - c));
            if (ability.range >= 0 && distance > range) continue;

            let isValid = false;
            if (ability.specialTargeting) {
                isValid = ability.specialTargeting(piece, { r, c }, gameState);
            } else {
                const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                switch (ability.targetType) {
                    case 'enemy':
                        isValid = targetPiece && targetPiece.team !== team && !targetPiece.hasDefensiveWard;
                        break;
                    case 'friendly':
                        isValid = targetPiece && targetPiece.team === team;
                        break;
                    case 'empty':
                        isValid = !targetPiece;
                        break;
                    default:
                        isValid = false;
                }
            }
            if (isValid) {
                ctx.fillStyle = "rgba(0, 255, 0, 0.4)";
                ctx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
            }
        }
    }
}

export function drawLabels(gameState) {
    const snowLabel = document.getElementById("snowLabel");
    const ashLabel = document.getElementById("ashLabel");
    const turnLabel = document.getElementById("turnLabel");
    if (snowLabel) snowLabel.textContent = `Snow: ${gameState.snowTerritory.size}`;
    if (ashLabel) ashLabel.textContent = `Ash: ${gameState.ashTerritory.size}`;
    if (turnLabel) {
        turnLabel.textContent = `${(gameState.currentTurn || '').toUpperCase()}'S TURN`;
        turnLabel.className = "label turn " + (gameState.currentTurn || '');
    }
}

export function showFlashMessage(msg, team, gameState) {
    gameState.messageHistory.unshift({ turn: gameState.turnCount, text: msg, team });
    if (gameState.messageHistory.length > 100) gameState.messageHistory.pop();
    updateMessageLog(gameState);
}

export function updateMessageLog(gameState) {
    const logEl = document.getElementById("messageLog");
    const mobileLogEl = document.getElementById("messageLog-mobile");
    const newHtml = (gameState.messageHistory || []).map(msg => {
        const teamClass = msg.team === 'neutral' ? 'neutral-message' : `${msg.team}-message`;
        return `<li><span class="turn-number">T${msg.turn}:</span> <span class="${teamClass}">${msg.text}</span></li>`;
    }).join('');

    if (logEl) logEl.innerHTML = newHtml;
    if (mobileLogEl) mobileLogEl.innerHTML = newHtml;
}

export function updateTotalTurnsCounter(gameState) {
    const text = `Round: ${gameState.turnCount}`;
    const el = document.getElementById("totalTurnsCounter");
    const elMobile = document.getElementById("totalTurnsCounter-mobile");
    if (el) el.textContent = text;
    if (elMobile) elMobile.textContent = text;
}

export function showVictoryScreen(team) {
    const screen = document.getElementById("victoryScreen");
    const titleEl = document.getElementById("victory-title");
    const quoteEl = document.getElementById("victory-quote");
    const charArtEl = document.getElementById("victory-character-art");
    const restartBtn = document.getElementById("restartBtn");
    if (!screen || !titleEl || !quoteEl || !restartBtn) return;

    restartBtn.classList.remove('btn-snow-victory', 'btn-ash-victory', 'btn-draw-victory');

    if (team === 'Draw') {
        titleEl.textContent = `Stalemate!`;
        quoteEl.textContent = "The battlefield claims both leaders. The war resets, but never ends.";
        screen.style.backgroundImage = `url('images/bg-menu.png')`;
        restartBtn.classList.add('btn-draw-victory');
    } else {
        const isSnow = team === 'snow';
        const quotes = isSnow ? [ "Winter's Reign is Absolute!", "The Storm Settles. Ice Endures." ] : [ "The World Burns in Triumph!", "Ashes to Ashes. Victory to Ash." ];
        titleEl.textContent = `${isSnow ? 'Snow' : 'Ash'} Faction Wins!`;
        quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
        screen.style.backgroundImage = `url('images/${isSnow ? 'snow' : 'ash'}-victory-bg.png')`;
        if (charArtEl) charArtEl.src = `images/${isSnow ? 'frost-lord' : 'ash-tyrant'}.png`;
        restartBtn.classList.add(isSnow ? 'btn-snow-victory' : 'btn-ash-victory');
    }
    screen.style.display = "flex";
}

export function updateTimerDisplay(gameState) {
    const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
    const ashTime = formatTime(gameState.timers?.ash || 0);
    const snowTime = formatTime(gameState.timers?.snow || 0);

    const ashEl = document.getElementById("ashTimer");
    const snowEl = document.getElementById("snowTimer");
    const ashElM = document.getElementById("ashTimer-mobile");
    const snowElM = document.getElementById("snowTimer-mobile");
    if (ashEl) ashEl.textContent = ashTime;
    if (snowEl) snowEl.textContent = snowTime;
    if (ashElM) ashElM.textContent = ashTime;
    if (snowElM) snowElM.textContent = snowTime;
}

export function resetTimers(gameState) {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
    gameState.timers = gameState.timers || {};
    gameState.timers.snow = gameState.timers.ash = 10 * 60;
    updateTimerDisplay(gameState);
    gameState.gameStarted = false;
    const startBtn = document.getElementById("startResetBtn");
    const startBtnMobile = document.getElementById("startResetBtn-mobile");
    if (startBtn) startBtn.textContent = "Start";
    if (startBtnMobile) startBtnMobile.textContent = "Start";
}

function resetMobileAbilityBar() {
    const nameEl = document.getElementById("mobile-ability-name");
    const descEl = document.getElementById("mobile-ability-description");
    if (nameEl) nameEl.textContent = "No Unit Selected";
    if (descEl) descEl.innerHTML = "Select a unit to see its actions.";
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`action-btn-${i}`);
        if (!btn) continue;
        btn.textContent = "";
        btn.onclick = null;
        btn.style.display = 'none';
        btn.disabled = false;
    }
}

function setActionButton(id, text, action, disabled = false) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = text;
    btn.onclick = action;
    btn.disabled = disabled;
    btn.style.display = 'block';
}

export function generatePieceInfoString(piece, gameState) {
    if (!piece) return "Select a unit to see its actions.";

    const typeInfo = C.PIECE_TYPES[piece.key] || {};
    const effectivePower = getEffectivePower(piece, gameState);
    let info = `<b>${typeInfo.name || 'Unit'}</b> (${piece.team?.charAt(0).toUpperCase() + piece.team?.slice(1)})<br>`;
    info += `Power: ${effectivePower} (Base: ${typeInfo.power || 0})<br>`;

    const boosts = [];
    if (piece.shrineBoost > 0) boosts.push(`Shrine (+${piece.shrineBoost})`);
    if (piece.isAnchor) boosts.push(`Anchor (+${C.ABILITY_VALUES.RiftAnchor.powerBoost})`);
    if (piece.overloadBoost?.duration > 0) boosts.push(`Infusion (+${piece.overloadBoost.amount}, ${piece.overloadBoost.duration} turns)`);
    const tempBoost = gameState.temporaryBoosts.find(b => b.piece === piece);
    if (tempBoost) boosts.push(`Stoked (+${tempBoost.amount}, ${tempBoost.duration} turns)`);
    if (boosts.length > 0) info += `<span class="buff-text">${boosts.join(', ')}</span><br>`;

    const debuffs = [];
    if (gameState.markedPieces.some(m => m.target === piece)) debuffs.push(`Marked (-${C.ABILITY_VALUES.MarkOfCinder.powerDebuff})`);
    const auraDebuffTarget = gameState.pieces.find(ap => ap.ability?.name === "Chilling Aura" && ap.ability.active && Math.max(Math.abs(piece.row - ap.row), Math.abs(piece.col - ap.col)) <= 1 && ap.team !== piece.team);
    if (auraDebuffTarget) debuffs.push(`Aura (-${C.ABILITY_VALUES.ChillingAura.powerDebuff})`);
    const whiteoutDebuff = gameState.debuffs.find(d => d.piece === piece && d.name === "Whiteout");
    if (whiteoutDebuff) debuffs.push(`Whiteout (-${whiteoutDebuff.amount}, ${whiteoutDebuff.duration} turns)`);
    if (debuffs.length > 0) info += `<span class="debuff-text">${debuffs.join(', ')}</span><br>`;

    const statuses = [];
    if (piece.stuck > 0) statuses.push(`Stuck (${piece.stuck} turns)`);
    if (piece.isDazed) statuses.push(`Dazed (${piece.dazedFor || 0} turns)`);
    if (piece.hasDefensiveWard) statuses.push(`Ward (Immune)`);
    if (piece.canRiftPulse) statuses.push(`Rift Pulse Ready`);
    if (statuses.length > 0) info += `<i>${statuses.join(', ')}</i><br>`;

    if (piece.ability?.key) {
        info += `Ability: ${piece.ability.name}`;
        if (piece.ability.key === 'Siphon') {
            info += ` (${piece.charges || 0}/${piece.ability.maxCharges} Charges)`;
        } else if (piece.ability.cooldown > 0) {
            info += ` (CD: ${piece.ability.cooldown})`;
        } else {
            info += ` (Ready)`;
        }
    }
    return info;
}

export function showAbilityPanel(piece, gameState) {
    if (window.innerWidth > 768) {
        const panel = document.getElementById("ability-info-panel");
        const abilityNameEl = document.getElementById("ability-name");
        const abilityDescEl = document.getElementById("ability-description");
        const abilityBtn = document.getElementById("abilityBtn");
        const cooldownContainer = document.getElementById("ability-cooldown-container");
        const chargeContainer = document.getElementById("charge-container");
        const siphonBtn = document.getElementById("siphonBtn");
        const unleashAbilities = document.getElementById("unleash-abilities");
        const riftPulseBtn = document.getElementById("riftPulseBtn");
        const despawnBtn = document.getElementById("despawnBtn");

        [chargeContainer, siphonBtn, unleashAbilities, abilityBtn, despawnBtn, cooldownContainer, riftPulseBtn].forEach(el => {
            if (el) el.style.display = 'none';
        });

        if (!panel) return;
        if (!piece) { panel.style.display = 'none'; return; }

        const infoHtml = generatePieceInfoString(piece, gameState);
        if (abilityNameEl) abilityNameEl.innerHTML = "";
        if (abilityDescEl) abilityDescEl.innerHTML = infoHtml;

        let shouldShowPanel = false;
        if (piece.key === 'snowIceWisp') {
            if (despawnBtn) despawnBtn.style.display = 'block';
            shouldShowPanel = true;
        } else if (piece.ability?.name === 'Siphon') {
            if (chargeContainer) chargeContainer.style.display = 'block';
            const countEl = document.getElementById('charge-count');
            if (countEl) countEl.textContent = `${piece.charges || 0}/${piece.ability.maxCharges}`;
            if (siphonBtn) siphonBtn.style.display = 'block';
            const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
            const isOnActiveRift = !!rift;
            const isOnShrine = C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col);
            if (siphonBtn) siphonBtn.disabled = (!isOnActiveRift && !isOnShrine) || (piece.charges >= piece.ability.maxCharges);
            if (unleashAbilities) unleashAbilities.style.display = 'flex';
            const [unleash1, unleash2, unleash3] = piece.ability.unleash || [];
            const u1El = document.getElementById('unleash1Name');
            const u2El = document.getElementById('unleash2Name');
            const u3El = document.getElementById('unleash3Name');
            if (u1El && unleash1) u1El.textContent = C.ABILITIES[unleash1].name;
            if (u2El && unleash2) u2El.textContent = C.ABILITIES[unleash2].name;
            if (u3El && unleash3) u3El.textContent = C.ABILITIES[unleash3].name;
            const btn1 = document.getElementById('unleash1Btn');
            const btn2 = document.getElementById('unleash2Btn');
            const btn3 = document.getElementById('unleash3Btn');
            if (btn1) btn1.disabled = (piece.charges || 0) < 1;
            if (btn2) btn2.disabled = (piece.charges || 0) < 2;
            if (btn3) btn3.disabled = (piece.charges || 0) < 3;
            shouldShowPanel = true;
        } else if (piece.ability && piece.ability.name) {
            if (abilityBtn) abilityBtn.style.display = 'block';
            if (cooldownContainer) cooldownContainer.style.display = 'block';
            const cdEl = document.getElementById("ability-cooldown");
            if (cdEl) cdEl.textContent = piece.ability.cooldown;
            if (abilityBtn) abilityBtn.disabled = piece.ability.cooldown > 0;
            shouldShowPanel = true;
        }
        if (piece.canRiftPulse && riftPulseBtn) {
            riftPulseBtn.style.display = 'block';
            shouldShowPanel = true;
        }
        panel.style.display = shouldShowPanel ? 'block' : 'none';
        return;
    }

    resetMobileAbilityBar();
    if (!piece) return;

    const nameEl = document.getElementById("mobile-ability-name");
    const descEl = document.getElementById("mobile-ability-description");
    if (nameEl) nameEl.textContent = C.PIECE_TYPES[piece.key]?.name || 'Unit';
    if (descEl) descEl.innerHTML = generatePieceInfoString(piece, gameState);

    let btnIndex = 1;
    const getBtnId = () => `action-btn-${btnIndex++}`;

    if (piece.key === 'snowIceWisp') {
        setActionButton(getBtnId(), "Despawn", () => despawnPiece(piece));
    } else if (piece.ability?.name === 'Siphon') {
        const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
        const isOnActiveRift = !!rift;
        const isOnShrine = C.SHAPES.shrineArea.some(([r, c]) => r === piece.row && c === piece.col);
        const canSiphon = (isOnActiveRift || isOnShrine) && (piece.charges || 0) < piece.ability.maxCharges;
        setActionButton(getBtnId(), "Siphon", () => handleSiphon(piece), !canSiphon);
        (piece.ability.unleash || []).forEach((abilityKey, i) => {
            const cost = i + 1;
            setActionButton(getBtnId(), `${C.ABILITIES[abilityKey].name} (${cost})`, () => activateAbility(piece, abilityKey), (piece.charges || 0) < cost);
        });
    } else if (piece.ability && piece.ability.name) {
        setActionButton(getBtnId(), piece.ability.name, () => activateAbility(piece, piece.ability.key), piece.ability.cooldown > 0);
    }

    if (piece.canRiftPulse) {
        setActionButton(getBtnId(), "Rift Pulse", () => executeRiftPulse(piece));
    }
}

export function hideAbilityPanel() {
    const panel = document.getElementById("ability-info-panel");
    if (panel) panel.style.display = "none";
    resetMobileAbilityBar();
}