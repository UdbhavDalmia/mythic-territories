// Game V2/script.js

import * as C from './modules/constants.js';
import {
    initGameState, initGame, movePiece, resetGame,
    activateAbility, handleSiphon, handleAbilityClick, executeRiftPulse,
    endGame, switchTurn, selectPiece, deselectPiece,
    despawnPiece,
    getGameState,
    getCurrentState, isState, GameState,
    executeAbility,
    executeSacrifice,
    executeRelease,
    cancelAscensionChoice,
    executeAscensionChoice,
    deactivateUltimate 
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

// Canvas and Context Initialization
const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");
canvas.width = canvas.height = C.CANVAS_SIZE;

const boardCanvas = document.createElement('canvas');
boardCanvas.width = boardCanvas.height = C.CANVAS_SIZE;
const boardCtx = boardCanvas.getContext('2d');

const effectsCanvas = document.createElement("canvas");
effectsCanvas.width = effectsCanvas.height = C.CANVAS_SIZE;
let effectsCtx = effectsCanvas.getContext("2d"); // Fix: effectsCtx needs to be defined globally for initEffects to work

// AI Worker and Game Actions
let aiWorker;
const gameActions = { movePiece, activateAbility, executeAbility, handleSiphon };

// Game State Initialization
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
    trappedPiece: null,
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
    shrineParticles: [],
    messageHistory: [],
    timers: { snow: 10 * 60, ash: 10 * 60 },
    timerInterval: null,
    images: {},
    boardImgs: {},
    territoryCaptureTurn: {},
    glacialWalls: [],
    markedPieces: [],
    unstableGrounds: [],
    specialTerrains: [],
    shields: [],
    debuffs: [],
    temporaryBoosts: [],
    flashEffects: [],
    projectiles: [],
    factionPassives: { snow: { ascension: {} }, ash: { ascension: {} } },
    pendingAscension: null,
    conduitLinkActive: false,
    conduitTeam: null,
    conduitIsContested: false,
    conduitOverchargeProgress: { snow: { turnsUncontested: 0, contested: false }, ash: { turnsUncontested: 0, contested: false } },
    riftAnchors: { topLeft: null, bottomRight: null },
    lastMoveIndicator: null,
    abilityContext: null // Ensuring all properties are initialized
});
const gameState = getGameState();

initUI(ctx, boardCtx);
initEffects(ctx, effectsCtx);

// --- Function Implementations ---

function animationLoop() {
    ctx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

    renderBoard(gameState);
    ctx.drawImage(boardCanvas, 0, 0);

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

    drawLastMoveIndicator(gameState);
    placePieces(gameState);
    drawProjectiles(gameState);
    drawShockwaves(gameState);
    drawAttackTexts(gameState);
    drawSelection(gameState);
    drawAbilityHighlights(gameState);

    requestAnimationFrame(animationLoop);
}

// Switches turn and initiates AI move if in AI mode.
export function endPlayerTurn() {
    switchTurn();

    if (gameState.gameMode === 'ai' && gameState.currentTurn === gameState.opponentTeam && !gameState.gameOver) {
        const stateClone = JSON.parse(JSON.stringify(gameState, (key, value) => (value instanceof Set) ? Array.from(value) : value));
        aiWorker.postMessage({ gameState: stateClone, aiConfig: {} });
    }
}

// Executes the AI's chosen action on the main thread.
function executeAIBestAction(bestAction) {
    console.log("AI bestAction:", bestAction);
    if (!bestAction) {
        console.log("AI has no moves.");
        return;
    }

    // SIMPLIFICATION: Find the real piece using the piece ID from the worker's action.
    const realPiece = gameState.pieces.find(p => p.id === bestAction.piece.id);
    
    if (!realPiece) {
        console.error("AI Error: Could not find matching piece on main thread.", bestAction.piece);
        return;
    }

    let actionTaken = false;
    const normTarget = (t) => {
        if (!t) return null;
        const row = t.row ?? t.r;
        const col = t.col ?? t.c;
        const isHighway = t.isHighway ?? false;
        return { row, col, isHighway };
    };

    if (bestAction.type === 'move') {
        const t = normTarget(bestAction.target);
        if (t && typeof t.row === 'number' && typeof t.col === 'number') {
            actionTaken = gameActions.movePiece(realPiece, t.row, t.col, Boolean(t.isHighway));
        } else {
            console.error('AI Error: move target malformed', bestAction.target);
        }
    } else if (bestAction.type === 'ability') {
        const { abilityKey } = bestAction;
        const t = normTarget(bestAction.target);

        if (abilityKey === 'Siphon') {
            actionTaken = gameActions.handleSiphon(realPiece);
        } else if (C.ABILITIES[abilityKey]?.requiresTargeting) {
            const abilityTarget = t ? { r: t.row, c: t.col } : null;
            actionTaken = gameActions.executeAbility(realPiece, abilityTarget, abilityKey, gameState, true);
        } else {
            actionTaken = gameActions.activateAbility(realPiece, abilityKey);
        }
    } else {
        console.error('AI Error: unknown action type', bestAction.type);
    }

    if (actionTaken) {
        // Only switch turn if an action was successfully executed.
        switchTurn();
    } else {
        console.error("AI Warning: Best action failed to execute.");
    }
}

// Calculates mouse position relative to the canvas.
function getMousePos(canvasEl, evt) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

// Handles piece movement after a selection has been made.
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

// Handles the piece selection event.
function handlePieceSelection(row, col) {
    const piece = C.getPieceAt(row, col, gameState.boardMap);
    if (piece && piece.team === gameState.currentTurn) selectPiece(piece);
}

// Handles start and reset button clicks.
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

// Decrements the turn timer and checks for time out.
function timerTick() {
    if (!gameState.gameStarted || gameState.gameOver) return;
    gameState.timers[gameState.currentTurn]--;
    updateTimerDisplay(gameState);
    if (gameState.timers[gameState.currentTurn] <= 0) {
        endGame(gameState.currentTurn === "snow" ? "ash" : "snow");
    }
}

// Initializes the game on window load.
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
            aiWorker = new Worker('modules/ai.worker.js', {type: 'module'});

            aiWorker.onmessage = (event) => {
                const { bestAction } = event.data;
                executeAIBestAction(bestAction); // executeAIBestAction now handles the turn switch
            };

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
                const stateClone = JSON.parse(JSON.stringify(gameState, (key, value) => (value instanceof Set) ? Array.from(value) : value));
                aiWorker.postMessage({ gameState: stateClone, aiConfig: {} });
            }
        } else {
            gameState.gameStarted = false;
        }

        animationLoop();
    });
};

// --- Event Listeners ---

if (canvas) {
    canvas.addEventListener("click", (e) => {
        if (!gameState.gameStarted || gameState.gameOver || (gameState.gameMode === 'ai' && gameState.currentTurn !== gameState.playerTeam)) return;

        const mousePos = getMousePos(canvas, e);
        const col = Math.floor(mousePos.x / C.CELL_SIZE);
        const row = Math.floor(mousePos.y / C.CELL_SIZE);

        if (isState(GameState.ASCENSION_CHOICE) /* REMOVED || isState(GameState.ULTIMATE_CHARGE_SELECTION) */) { 
            // Player must use the Ascension buttons, ignore board click in this state
            return;
        }

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

    let lastHoveredPiece = null; // Add this state tracker outside the listener

    canvas.addEventListener("mousemove", (e) => {
        const popup = document.getElementById("piecePopup");
        if (!popup) return;

        if (window.innerWidth > 768) {
            if (isState(GameState.ASCENSION_CHOICE)) { 
                popup.style.display = "none";
                return;
            }

            const mousePos = getMousePos(canvas, e);
            const col = Math.floor(mousePos.x / C.CELL_SIZE);
            const row = Math.floor(mousePos.y / C.CELL_SIZE);
            const p = C.getPieceAt(row, col, gameState.boardMap);

            if (p) {
                // Only rewrite HTML if we hovered over a NEW piece
                if (p !== lastHoveredPiece) {
                    const info = generatePieceInfoString(p, gameState);
                    popup.innerHTML = info;
                    popup.className = "piecePopup " + (p.team || '');
                    lastHoveredPiece = p;
                }
                popup.style.display = "block";
                let leftPos = e.clientX + 15;
                if (leftPos + popup.offsetWidth > window.innerWidth) leftPos = e.clientX - popup.offsetWidth - 15;
                popup.style.left = leftPos + 'px';
                popup.style.top = e.clientY + 'px';
            } else {
                popup.style.display = "none";
                lastHoveredPiece = null; // Reset when hovering empty square
            }
        } else {
            popup.style.display = "none"; 
        }
    })};

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
    const piece = gameState.selectedPiece;
    if (!piece) return;

    // Special check for Leader Ultimate when clicking the main ability button
    const isLeader = piece.key.includes('Lord') || piece.key.includes('Tyrant');
    
    if (isLeader) {
        // If ready to fire or ready to channel, call activateAbility which handles the transition
        if (!piece.isUltimateActive) {
            // activateAbility now directly executes the ultimate if charges are present, 
            // or starts channeling if they are not.
            if (activateAbility(piece)) endPlayerTurn();
        }
        return;
    }
    
    // Standard ability/trapped logic
    if (piece.isTrapped) {
        if (executeSacrifice(piece)) {
            // Logic handled in game.js after UI interaction 
        } else if (activateAbility(piece)) {
            endPlayerTurn();
        }
    } else {
        if (activateAbility(piece)) endPlayerTurn();
    }
});

// --- REMOVED ULTIMATE CHARGE SELECTION BUTTON LISTENERS (ultimateUseHandler, ultimateUse1Btn, etc.) ---


const ultimateDeactivateBtn = document.getElementById("ultimateDeactivateBtn");
if (ultimateDeactivateBtn) ultimateDeactivateBtn.addEventListener("click", () => {
    // Check if the Leader is currently active OR channeling
    const piece = gameState.selectedPiece;
    if (!piece) return;
    
    if (piece.isUltimateActive) {
        // Deactivation is free and does not use the turn.
        deactivateUltimate(piece); 
    } else if (piece.isChannelingUltimate) {
        // Stop Channeling uses a turn (per user request).
        // Charges are preserved, and hasUsedUltimate is NOT set.
        piece.isChannelingUltimate = false; 
        piece.isDazed = false; piece.dazedFor = 0; 
        endPlayerTurn(); 
    }
});
// --- END ULTIMATE BUTTON LISTENERS ---


const despawnBtn = document.getElementById("despawnBtn");
if (despawnBtn) despawnBtn.addEventListener("click", () => {
    if (gameState.selectedPiece?.key === 'snowIceWisp') despawnPiece(gameState.selectedPiece);
});

const siphonBtn = document.getElementById("siphonBtn");
if (siphonBtn) siphonBtn.addEventListener("click", () => {
    if (gameState.selectedPiece?.isTrapped) {
        if (executeRelease(gameState.selectedPiece)) endPlayerTurn();
    } else {
        if (handleSiphon(gameState.selectedPiece)) endPlayerTurn();
    }
});

// Generic Handler for Unleash/Veteran Buttons (U1/U2/U3)
const unleashHandler = (abilityIndex) => {
    if (gameState.selectedPiece) {
        const piece = gameState.selectedPiece;
        let abilityKey;

        if (piece.ability?.name === 'Siphon') {
            // Siphoner Unleash
            abilityKey = piece.ability.unleash?.[abilityIndex];
        } else if (piece.isVeteran && abilityIndex === 2) {
            // Specialist Veteran Ability (repurposing the 3rd button)
            abilityKey = piece.secondaryAbilityKey;
        }

        if (abilityKey && activateAbility(piece, abilityKey)) endPlayerTurn();
    }
};

const unleash1Btn = document.getElementById("unleash1Btn");
if (unleash1Btn) unleash1Btn.addEventListener("click", () => unleashHandler(0));

const unleash2Btn = document.getElementById("unleash2Btn");
if (unleash2Btn) unleash2Btn.addEventListener("click", () => unleashHandler(1));

const unleash3Btn = document.getElementById("unleash3Btn");
if (unleash3Btn) unleash3Btn.addEventListener("click", () => unleashHandler(2));


const riftPulseBtn = document.getElementById("riftPulseBtn");
if (riftPulseBtn) riftPulseBtn.addEventListener("click", () => {
    if (executeRiftPulse(gameState.selectedPiece)) endPlayerTurn();
});

// BEGIN DEDICATED ASCENSION CHOICE BUTTON LISTENERS (Using new popup IDs)
const ascensionPathABtn = document.getElementById("ascensionPathABtn-popup");
if (ascensionPathABtn) ascensionPathABtn.addEventListener("click", () => {
    if (isState(GameState.ASCENSION_CHOICE)) {
        if (executeAscensionChoice('PathA')) endPlayerTurn();
    }
});

const ascensionPathBBtn = document.getElementById("ascensionPathBBtn-popup");
if (ascensionPathBBtn) ascensionPathBBtn.addEventListener("click", () => {
    if (isState(GameState.ASCENSION_CHOICE)) {
        if (executeAscensionChoice('PathB')) endPlayerTurn();
    }
});

const ascensionCancelBtn = document.getElementById("ascensionCancelBtn-popup");
if (ascensionCancelBtn) ascensionCancelBtn.addEventListener("click", () => {
    if (isState(GameState.ASCENSION_CHOICE)) {
        cancelAscensionChoice();
    }
});
// END DEDICATED ASCENSION CHOICE BUTTON LISTENERS
