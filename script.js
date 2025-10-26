import * as C from './modules/constants.js';
import {
    initGameState, initGame, movePiece, resetGame,
    activateAbility, handleSiphon, handleAbilityClick, executeRiftPulse,
    endGame, switchTurn, selectPiece, deselectPiece,
    despawnPiece,
    getGameState,
    getCurrentState, isState, GameState,
    executeAbility
} from './modules/game.js';
import {
    getValidMoves, preloadImages, getEffectivePower
} from './modules/utils.js';
import {
    initUI, renderBoard, placePieces, drawSelection, drawAbilityHighlights,
    updateTimerDisplay, drawLastMoveIndicator, generatePieceInfoString
} from './modules/ui.js';
import {
    initEffects, drawParticles, drawRifts, drawShrineEffects, drawShockwaves, drawAttackTexts, drawProjectiles,
    drawSiphonParticles, drawGroundEffectParticles, drawConduitParticles,
    drawWhiteoutParticles, drawRiftAssaultAnimations, drawMarkOfCinderSparks,
    drawShrineOverloadEffects
} from './modules/effects.js';
// --- REMOVED: import { takeAITurn } from './modules/ai.js'; ---

const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");
canvas.width = canvas.height = C.CANVAS_SIZE;

const boardCanvas = document.createElement('canvas');
boardCanvas.width = boardCanvas.height = C.CANVAS_SIZE;
const boardCtx = boardCanvas.getContext('2d');

const effectsCanvas = document.createElement("canvas");
effectsCanvas.width = effectsCanvas.height = C.CANVAS_SIZE;
const effectsCtx = effectsCanvas.getContext("2d");

// --- NEW: AI Worker and gameActions ---
let aiWorker;
const gameActions = { movePiece, activateAbility, executeAbility };
// --- END NEW ---

initGameState({
    pieces: [],
    snowTerritory: new Set(),
    ashTerritory: new Set(),
    boardMap: [],
    selectedPiece: null,
    currentTurn: "snow",
    turnCount: 0,
    gameOver: false,
    gameStarted: false,
    gameMode: 'human',
    playerTeam: 'snow',
    opponentTeam: 'ash',
    shrineChargeLevel: 0,
    shrineIsOverloaded: false,
    riftPhaseNotified: { strong: false, chaotic: false },
    shockwaves: [],
    attackTexts: [],
    snowParticles: [],
    ashParticles: [],
    battleParticles: [],
    siphonParticles: [],
    groundEffectParticles: [],
    conduitParticles: [],
    whiteoutParticles: [],
    riftAssaultAnimations: [],
    markOfCinderSparks: [],
    shrineArcs: [],
    messageHistory: [],
    timers: { snow: 10 * 60, ash: 10 * 60 },
    timerInterval: null,
    images: {},
    boardImgs: {},
    territoryCaptureTurn: {},
    glacialWalls: [],
    markedPieces: [],
    unstableGrounds: [],
    abilityContext: null,
    conduitLinkActive: false,
    conduitTeam: null,
    riftAnchors: { topLeft: null, bottomRight: null },
    lastMoveIndicator: null,
});
const gameState = getGameState();

initUI(ctx, boardCtx);
initEffects(ctx, effectsCtx);

function animationLoop() {
    ctx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

    // redraw board to offscreen boardCtx and blit it once
    renderBoard(gameState);
    ctx.drawImage(boardCanvas, 0, 0);

    // layered effects (main ctx)
    drawParticles(gameState);
    drawRifts(gameState);
    drawShrineEffects(gameState);
    drawShrineOverloadEffects(gameState);
    drawSiphonParticles(gameState);
    drawGroundEffectParticles(gameState);
    if (gameState.conduitLinkActive) drawConduitParticles(gameState);
    drawWhiteoutParticles(gameState);
    drawRiftAssaultAnimations(gameState);
    drawMarkOfCinderSparks(gameState);

    // UI / foreground
    drawLastMoveIndicator(gameState);
    placePieces(gameState);
    drawProjectiles(gameState);
    drawShockwaves(gameState);
    drawAttackTexts(gameState);
    drawSelection(gameState);
    drawAbilityHighlights(gameState);

    requestAnimationFrame(animationLoop);
}

function getMousePos(canvasEl, evt) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

// --- NEW: Helper to execute the AI's chosen action ---
function executeAIBestAction(bestAction) {
    if (!bestAction) {
        console.log("AI has no moves.");
        return;
    }

    // The piece object from the worker is a clone. We need to find the "real" piece
    // in the main gameState.
    const realPiece = gameState.pieces.find(p => 
        p.row === bestAction.piece.row && 
        p.col === bestAction.piece.col && 
        p.key === bestAction.piece.key
    );

    if (!realPiece) {
        console.error("AI Error: Could not find matching piece on main thread.");
        return;
    }

    let actionTaken = false;
    if (bestAction.type === 'move') {
        actionTaken = gameActions.movePiece(realPiece, bestAction.target.row, bestAction.target.col, bestAction.target.isHighway);
    } else if (bestAction.type === 'ability') {
        const { abilityKey, target } = bestAction;
        if (C.ABILITIES[abilityKey].requiresTargeting) {
            actionTaken = gameActions.executeAbility(realPiece, target, abilityKey, gameState, true);
        } else {
            actionTaken = gameActions.activateAbility(realPiece, abilityKey);
        }
    }

    if (!actionTaken) {
        console.error("AI Warning: Best action failed to execute.");
        // Fallback or just end turn
    }
}

// --- MODIFIED: endPlayerTurn ---
function endPlayerTurn() {
    switchTurn(); // Switch to AI's turn

    if (gameState.gameMode === 'ai' && gameState.currentTurn === gameState.opponentTeam && !gameState.gameOver) {
        // --- THIS IS THE CHANGE ---
        // Tell the worker to start thinking.
        // The game will NOT freeze.
        // We send a structured clone of the gameState.
        const stateClone = JSON.parse(JSON.stringify(gameState, (key, value) => (value instanceof Set) ? Array.from(value) : value));
        aiWorker.postMessage({ gameState: stateClone });
        // --- END CHANGE ---
    }
}

function handlePieceSelection(row, col) {
    const piece = C.getPieceAt(row, col, gameState.boardMap);
    if (piece && piece.team === gameState.currentTurn) selectPiece(piece);
}

function handleMove(row, col) {
    const selected = gameState.selectedPiece;
    if (!selected) return;
    if (selected.row === row && selected.col === col) {
        deselectPiece();
        return;
    }
    const validMoves = getValidMoves(selected, gameState);
    const move = validMoves.find(m => m.row === row && m.col === col);
    if (move) {
        if (movePiece(selected, row, col, Boolean(move.isHighway))) {
            endPlayerTurn();
        }
    } else {
        deselectPiece();
    }
}

if (canvas) {
    canvas.addEventListener("click", (e) => {
        if (!gameState.gameStarted || gameState.gameOver || (gameState.gameMode === 'ai' && gameState.currentTurn !== gameState.playerTeam)) return;

        const mousePos = getMousePos(canvas, e);
        const col = Math.floor(mousePos.x / C.CELL_SIZE);
        const row = Math.floor(mousePos.y / C.CELL_SIZE);

        if (isState(GameState.ABILITY_TARGETING) || isState(GameState.WALL_PLACEMENT_FIRST) || isState(GameState.WALL_PLACEMENT_SECOND)) {
            if (handleAbilityClick(row, col)) endPlayerTurn();
            return;
        }

        if (isState(GameState.AWAITING_PIECE_SELECTION)) {
            handlePieceSelection(row, col);
        } else if (isState(GameState.PIECE_SELECTED)) {
            handleMove(row, col);
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        const popup = document.getElementById("piecePopup");
        if (!popup) return;

        // Mobile: hide popup
        if (window.innerWidth <= 768) {
            popup.style.display = "none";
            return;
        }

        const mousePos = getMousePos(canvas, e);
        const col = Math.floor(mousePos.x / C.CELL_SIZE);
        const row = Math.floor(mousePos.y / C.CELL_SIZE);
        const p = C.getPieceAt(row, col, gameState.boardMap);

        if (p) {
            const info = generatePieceInfoString(p, gameState);
            popup.innerHTML = info;
            popup.style.display = "block";
            popup.className = "piecePopup " + (p.team || '');
            let leftPos = e.clientX + 15;
            if (leftPos + popup.offsetWidth > window.innerWidth) leftPos = e.clientX - popup.offsetWidth - 15;
            popup.style.left = leftPos + 'px';
            popup.style.top = e.clientY + 'px';
        } else {
            popup.style.display = "none";
        }
    });

    canvas.addEventListener("mouseleave", () => {
        const popup = document.getElementById("piecePopup");
        if (popup) popup.style.display = "none";
    });
}

function handleStartReset() {
    if (!gameState.gameStarted) {
        gameState.gameStarted = true;
        const startBtn = document.getElementById("startResetBtn");
        const startBtnMobile = document.getElementById("startResetBtn-mobile");
        if (startBtn) startBtn.textContent = "Reset";
        if (startBtnMobile) startBtnMobile.textContent = "Reset";
        gameState.timerInterval = setInterval(timerTick, 1000);
    } else {
        resetGame();
    }
}

const startBtn = document.getElementById("startResetBtn");
const startBtnMobile = document.getElementById("startResetBtn-mobile");
if (startBtn) startBtn.addEventListener("click", handleStartReset);
if (startBtnMobile) startBtnMobile.addEventListener("click", handleStartReset);

const menuBtn = document.getElementById("menuButton");
const menuBtnMobile = document.getElementById("menuButton-mobile");
const goToMenu = () => window.location.href = 'index.html';
if (menuBtn) menuBtn.addEventListener("click", goToMenu);
if (menuBtnMobile) menuBtnMobile.addEventListener("click", goToMenu);

const restartBtn = document.getElementById("restartBtn");
if (restartBtn) restartBtn.addEventListener("click", () => {
    const victory = document.getElementById("victoryScreen");
    if (victory) victory.style.display = "none";
    resetGame();
});

const abilityBtn = document.getElementById("abilityBtn");
if (abilityBtn) abilityBtn.addEventListener("click", () => {
    if (activateAbility(gameState.selectedPiece)) endPlayerTurn();
});

const despawnBtn = document.getElementById("despawnBtn");
if (despawnBtn) despawnBtn.addEventListener("click", () => {
    if (gameState.selectedPiece?.key === 'snowIceWisp') despawnPiece(gameState.selectedPiece);
});

const siphonBtn = document.getElementById("siphonBtn");
if (siphonBtn) siphonBtn.addEventListener("click", () => {
    if (handleSiphon(gameState.selectedPiece)) endPlayerTurn();
});

const unleash1Btn = document.getElementById("unleash1Btn");
if (unleash1Btn) unleash1Btn.addEventListener("click", () => {
    if (gameState.selectedPiece) {
        const abilityKey = gameState.selectedPiece.ability?.unleash?.[0];
        if (abilityKey && activateAbility(gameState.selectedPiece, abilityKey)) endPlayerTurn();
    }
});

const unleash2Btn = document.getElementById("unleash2Btn");
if (unleash2Btn) unleash2Btn.addEventListener("click", () => {
    if (gameState.selectedPiece) {
        const abilityKey = gameState.selectedPiece.ability?.unleash?.[1];
        if (abilityKey && activateAbility(gameState.selectedPiece, abilityKey)) endPlayerTurn();
    }
});

const unleash3Btn = document.getElementById("unleash3Btn");
if (unleash3Btn) unleash3Btn.addEventListener("click", () => {
    if (gameState.selectedPiece) {
        const abilityKey = gameState.selectedPiece.ability?.unleash?.[2];
        if (abilityKey && activateAbility(gameState.selectedPiece, abilityKey)) endPlayerTurn();
    }
});

const riftPulseBtn = document.getElementById("riftPulseBtn");
if (riftPulseBtn) riftPulseBtn.addEventListener("click", () => {
    if (executeRiftPulse(gameState.selectedPiece)) endPlayerTurn();
});

function timerTick() {
    if (!gameState.gameStarted || gameState.gameOver) return;
    gameState.timers[gameState.currentTurn]--;
    updateTimerDisplay(gameState);
    if (gameState.timers[gameState.currentTurn] <= 0) {
        endGame(gameState.currentTurn === "snow" ? "ash" : "snow");
    }
}

// --- MODIFIED: window.onload ---
window.onload = () => {
    preloadImages(C.IMAGES, (loadedImgs) => {
        gameState.images = Object.fromEntries(Object.entries(loadedImgs).filter(([k]) => !C.BOARD_IMAGE_KEYS.includes(k)));
        gameState.boardImgs = Object.fromEntries(Object.entries(loadedImgs).filter(([k]) => C.BOARD_IMAGE_KEYS.includes(k)));

        const urlParams = new URLSearchParams(window.location.search);
        gameState.gameMode = urlParams.get('mode') || 'human';
        gameState.playerTeam = urlParams.get('team') || 'snow';
        gameState.opponentTeam = gameState.playerTeam === 'snow' ? 'ash' : 'snow';

        initGame();

        if (gameState.gameMode === 'ai') {
            // --- NEW: Initialize AI Worker ---
            aiWorker = new Worker('modules/ai.worker.js', {type: 'module'});

            // This is what happens when the AI is done thinking
            aiWorker.onmessage = (event) => {
                const { bestAction } = event.data;
                
                // Execute the move the worker found
                executeAIBestAction(bestAction);
                
                // Now, switch turn back to the player
                switchTurn();
            };
            // --- END NEW ---

            gameState.gameStarted = true;
            const timerHeader = document.querySelector('#timerContainer .ui-header');
            const ashTimer = document.getElementById('ashTimer');
            const snowTimer = document.getElementById('snowTimer');
            const startBtnEl = document.getElementById('startResetBtn');
            const timerMobile = document.getElementById('timerContainer-mobile');

            if (timerHeader) timerHeader.style.display = 'none';
            if (ashTimer) ashTimer.style.display = 'none';
            if (snowTimer) snowTimer.style.display = 'none';
            if (startBtnEl) startBtnEl.style.display = 'none';
            if (timerMobile) timerMobile.style.display = 'none';

            if (gameState.currentTurn === gameState.opponentTeam) {
                // --- MODIFIED: Use worker to get first move ---
                const stateClone = JSON.parse(JSON.stringify(gameState, (key, value) => (value instanceof Set) ? Array.from(value) : value));
                aiWorker.postMessage({ gameState: stateClone });
                // --- END MODIFIED ---
            }
        } else {
            gameState.gameStarted = false;
        }

        animationLoop();
    });
};