import * as C from '../../shared/constants.js';
import * as UI from './ui.js';
import * as Effects from './effects.js';
import * as Logic from '../../shared/logic.js';
import * as E from '../../shared/utils.js';

// ============================================================================
// ROOM & MODE MANAGEMENT
// ============================================================================
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const gameMode = urlParams.get('mode');
const isLocal = gameMode === 'local';

if (!roomId && !isLocal) window.location.href = 'index.html';
if (roomId) window.history.replaceState({}, '', `?room=${roomId}`);

let gameState = null;
let myTeam = null;
let canvas, ctx;
let boardCanvas;
let touchTimer;
const LONG_PRESS_DURATION = 500; // ms
let socket = null;
let loadedImages = {};
let disconnectInterval = null
let isWaitingForServer = false; // Locks UI while waiting for server response in multiplayer
// Toggle to enable playing vs AI in local mode. Can be set via URL param `?ai=1`.
const vsAI = urlParams.get('ai') === '1';

// AI worker reference (created on demand)
let aiWorker = null;

// Check whether it's the AI's turn and, if so, run the AI (only in local mode).
function checkAITurn() {
    // CRITICAL: Never run AI logic if connected to a multiplayer room
    if (!isLocal) return;
    if (!vsAI) return;
    if (!gameState || gameState.gameOver) return;
    // Only run AI when it's Ash's turn (AI plays Ash in this setup)
    if (gameState.currentTurn !== 'ash') return;

    // Spawn a worker to compute the best action
    try {
        if (aiWorker) aiWorker.terminate();
        aiWorker = new Worker('js/ai.worker.js', { type: 'module' });
        aiWorker.onmessage = (ev) => {
            const { bestAction } = ev.data;
            if (!bestAction) return;
            // Translate worker action into local game actions
            if (bestAction.type === 'move') {
                processLocalAction('MOVE', { pieceId: bestAction.piece.id, r: bestAction.target.row, c: bestAction.target.col, isHighway: bestAction.target.isHighway || false });
            } else if (bestAction.type === 'ability') {
                processLocalAction('ABILITY', { pieceId: bestAction.piece.id, abilityKey: bestAction.abilityKey, target: bestAction.target });
            }
            aiWorker.terminate(); aiWorker = null;
            // After AI acts, re-render
            try { E.updateBoardMap(gameState); } catch (e) { }
            UI.renderBoard(gameState); UI.drawLabels(gameState);
            // If the AI's action ended its turn, check again (in case turns chain)
            setTimeout(checkAITurn, 0);
        };
        // Send a copy of the gameState to the worker
        aiWorker.postMessage({ gameState: structuredClone(gameState), aiConfig: {} });
    } catch (e) {
        console.warn('Failed to spawn AI worker:', e);
        if (aiWorker) { try { aiWorker.terminate(); } catch (er) { } aiWorker = null; }
    }
}

// ============================================================================
// INITIALIZATION (Dual-Mode)
// ============================================================================
E.preloadImages(C.IMAGES, (imgs) => {
    loadedImages = imgs;

    if (isLocal) {
        myTeam = 'snow';
        Logic.initGameState({});
        Logic.initGame();
        gameState = Logic.getGameState();
        attachImagesToState();

        setTimeout(() => {
            setupCanvas();
            requestAnimationFrame(animationLoop);
            if (vsAI) setTimeout(checkAITurn, 0);
        }, 100);
    } else {
        socket = io();
        // Mark the page as multiplayer so CSS can reveal multiplayer-only UI
        try { document.body.classList.add('multiplayer'); } catch (e) { }
        socket.on('connect', () => socket.emit('joinRoom', roomId));

        socket.on('init', (data) => {
            gameState = data.state;
            myTeam = data.team;
            // FIX: Show your team header in MP
            const teamDisplay = document.getElementById('yourTeamDisplay');
            if (teamDisplay) {
                teamDisplay.style.display = 'block';
                teamDisplay.textContent = `YOU ARE TEAM ${myTeam.toUpperCase()}`;
            }
            // Update player count UI for multiplayer and normalize the board map
            updatePlayerCountUI(data.playerCount);
            attachImagesToState();
            // Rebuild board map so client logic like getValidMoves works immediately
            E.updateBoardMap(gameState);
            setupCanvas();
            UI.showFlashMessage(`Joined room ${roomId} as Team ${myTeam.toUpperCase()}`, 'neutral', gameState);

            // Clear disconnect timer if joining mid-game (update both desktop and mobile)
            try { clearInterval(disconnectInterval); } catch (e) { }
            const timerEl = document.getElementById('disconnectTimerDisplay');
            const timerElMobile = document.getElementById('disconnectTimerDisplay-mobile');
            if (timerEl) timerEl.style.display = 'none';
            if (timerElMobile) timerElMobile.style.display = 'none';
            if (gameState && gameState.pendingAscension && !gameState.factionPassives[gameState.pendingAscension.team].ascension.isChosen) {
                if (isLocal || gameState.pendingAscension.team === myTeam) {
                    UI.showAscensionPopup(gameState);
                } else {
                    UI.showFlashMessage('Opponent is choosing an Ascension path...', 'neutral', gameState);
                }
            }

            if (gameState && gameState.gameStarted) {
                try { UI.startTimer(gameState); } catch (e) { }
                updateControlButtons();
            }

            requestAnimationFrame(animationLoop);
        });

        socket.on('playerJoined', (data) => {
            UI.showFlashMessage(`An opponent has joined as Team ${data.team.toUpperCase()}!`, 'neutral', gameState);
            updatePlayerCountUI(data.playerCount);

            try { clearInterval(disconnectInterval); } catch (e) { }
            const modal = document.getElementById('disconnectModal');
            if (modal) modal.style.display = 'none';

            if (gameState && gameState.gameStarted) {
                UI.startTimer(gameState);
                updateControlButtons();

                // NEW: Send your accurate timers to the server to sync the newly joined/reloaded player
                socket.emit('gameAction', { roomId, actionType: 'SYNC_TIMERS', data: { timers: gameState.timers } });
            }
        });

        socket.on('playerLeft', (data) => {
            if (isLocal) return; // FIX: Block in P&P mode

            UI.showFlashMessage(`Player left the room.`, 'neutral', gameState);
            updatePlayerCountUI(data.playerCount);

            // Stop the game timers
            try { UI.stopTimer(); } catch (e) { }

            // Show disconnect modal
            const modal = document.getElementById('disconnectModal');
            const messageEl = document.getElementById('disconnectMessage');
            const btn = document.getElementById('mainMenuBtn');
            if (modal) modal.style.display = 'flex';
            if (messageEl) messageEl.textContent = 'Opponent disconnected. Closing in 60s';
            if (btn) btn.style.display = 'none';

            let timeLeft = 60;
            disconnectInterval = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(disconnectInterval);
                    if (messageEl) messageEl.textContent = 'Game Over, Opponent Disconnected';
                    if (btn) btn.style.display = 'block';
                } else {
                    if (messageEl) messageEl.textContent = `Opponent disconnected. Closing in ${timeLeft}s`;
                }
            }, 1000);
        });

        socket.on('stateUpdate', (data) => {
            isWaitingForServer = false;
            try { if (gameState) UI.stopTimer(); } catch (e) { }

            const currentTimers = gameState ? gameState.timers : null;

            if (data.state) {
                gameState = data.state;
                // FIX: Only restore local if the server state didn't provide fresh timers
                if (currentTimers && !data.state.timers) gameState.timers = currentTimers;
                attachImagesToState();
            } else if (data.diff) {
                if (!gameState) { window.location.reload(); return; }
                for (const k of Object.keys(data.diff)) {
                    gameState[k] = data.diff[k];
                }
                // FIX: Only restore local if the diff payload didn't explicitly update the timers
                if (currentTimers && !data.diff.timers) gameState.timers = currentTimers;
                attachImagesToState();
            }

            if (!isLocal && gameState.currentTurn !== myTeam) {
                gameState.selectedPiece = null;
            }

            if (data.events && data.events.length > 0) processServerEvents(data.events);
            if (!isLocal && gameState?.gameStarted) {
                try { UI.startTimer(gameState); } catch (e) { }
            }
            updateControlButtons();
            UI.renderBoard(gameState);
            UI.drawLabels(gameState);
            if (gameState && gameState.pendingAscension && !gameState.factionPassives[gameState.pendingAscension.team].ascension.isChosen) {
                if (isLocal || gameState.pendingAscension.team === myTeam) {
                    UI.showAscensionPopup(gameState);
                } else {
                    UI.showFlashMessage('Opponent is choosing an Ascension path...', 'neutral', gameState);
                }
            }
        });

        // FIX: Unlock the UI if the server rejects an action
        socket.on('error', (msg) => {
            alert(msg);
            isWaitingForServer = false;
        });

        // Handle server-initiated room closure (e.g., opponent failed to reconnect)
        socket.on('roomClosed', (msg) => {
            if (isLocal) return; // FIX: Block in P&P mode

            alert(msg);
            window.location.href = 'index.html';
        });
    }
});

// Helper to safely bind visuals to the pure data state
function attachImagesToState() {
    if (!gameState) return;
    gameState.images = loadedImages;
    gameState.images.snowIceWisp = loadedImages.snowIceWisp || loadedImages.wisp || loadedImages['units/wisp.png'];
    gameState.boardImgs = {
        gameBackgroundSnow: loadedImages.gameBackgroundSnow,
        gameBackgroundAsh: loadedImages.gameBackgroundAsh
    };
    gameState.playerTeam = myTeam;

    const normalizeToSet = (val) => {
        if (val instanceof Set) return val;
        if (Array.isArray(val)) return new Set(val);
        if (typeof val === 'object' && val !== null) return new Set(Object.keys(val));
        return new Set();
    };

    gameState.snowTerritory = normalizeToSet(gameState.snowTerritory);
    gameState.ashTerritory = normalizeToSet(gameState.ashTerritory);

    // CRITICAL FIX: Re-link disconnected JSON object references back to the main pieces array
    if (gameState.selectedPiece) {
        gameState.selectedPiece = gameState.pieces.find(p => p.id === gameState.selectedPiece.id) || gameState.selectedPiece;
    }
    if (gameState.abilityContext) {
        if (gameState.abilityContext.piece) {
            gameState.abilityContext.piece = gameState.pieces.find(p => p.id === gameState.abilityContext.piece.id) || gameState.abilityContext.piece;
        }
        if (gameState.abilityContext.siphoner) {
            gameState.abilityContext.siphoner = gameState.pieces.find(p => p.id === gameState.abilityContext.siphoner.id) || gameState.abilityContext.siphoner;
        }
        if (gameState.abilityContext.allyTarget) {
            gameState.abilityContext.allyTarget = gameState.pieces.find(p => p.id === gameState.abilityContext.allyTarget.id) || gameState.abilityContext.allyTarget;
        }
    }

    try { E.updateBoardMap(gameState); } catch (e) { }
}

// Start / Reset helpers
function updateControlButtons() {
    const label = (!gameState || !gameState.gameStarted) ? 'START' : 'RESET';
    ['startResetBtn', 'startResetBtn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.textContent = label;
            if (!isLocal && myTeam !== 'snow') {
                btn.style.display = 'none'; // Only host can start in MP
            } else {
                // Force visibility for mobile and desktop
                btn.style.display = id === 'startResetBtn-mobile' ? 'inline-block' : 'block';
                btn.style.visibility = 'visible';
                btn.style.opacity = '1';
            }
        }
    });

    // Hide the start buttons entirely for multiplayer once the game starts, UNLESS the game is over
    if (!isLocal && gameState && gameState.gameStarted && !gameState.gameOver) { // FIX: Added gameOver check
        const desktopBtn = document.getElementById('startResetBtn');
        const mobileBtn = document.getElementById('startResetBtn-mobile');
        if (desktopBtn) desktopBtn.style.display = 'none';
        if (mobileBtn) mobileBtn.style.display = 'none';
    }
}

window.handleStartReset = function () {
    if (!isLocal && myTeam !== 'snow') return;

    if (!gameState || !gameState.gameStarted) {
        // Clear message logs on Start
        const ml = document.getElementById('messageLog'); if (ml) ml.innerHTML = '';
        const mlMobile = document.getElementById('messageLog-mobile'); if (mlMobile) mlMobile.innerHTML = '';

        if (isLocal) {
            gameState.gameStarted = true;
            try { UI.startTimer(gameState); } catch (e) { }
            if (vsAI) setTimeout(checkAITurn, 0);
        } else {
            socket.emit('gameAction', { roomId, actionType: 'START_GAME', data: {} });
        }
    } else {
        if (isLocal) {
            try {
                Logic.resetGame();
                gameState = Logic.getGameState();
                attachImagesToState();
                Effects.initParticles(gameState);
                UI.resetTimers(gameState);
                UI.renderBoard(gameState);
                UI.drawLabels(gameState);
            } catch (e) {
                console.error('Failed to reset game', e);
            }
        } else {
            // CRITICAL FIX: Emit reset command to server
            socket.emit('gameAction', { roomId, actionType: 'RESET_GAME', data: {} });
        }
    }
    updateControlButtons();
};

function setupCanvas() {
    const displayCanvas = document.getElementById('gameBoard');
    if (!displayCanvas) return;
    canvas = displayCanvas;

    // CRITICAL FIX: Explicitly set the internal resolution of the canvas
    canvas.width = C.CANVAS_SIZE;
    canvas.height = C.CANVAS_SIZE;
    ctx = canvas.getContext('2d');

    // Create offscreen canvases
    boardCanvas = document.createElement('canvas');
    boardCanvas.width = C.CANVAS_SIZE;
    boardCanvas.height = C.CANVAS_SIZE;
    const boardCtx = boardCanvas.getContext('2d');

    const effectsCanvas = document.createElement('canvas');
    effectsCanvas.width = C.CANVAS_SIZE;
    effectsCanvas.height = C.CANVAS_SIZE;
    const effectsCtx = effectsCanvas.getContext('2d');

    UI.initUI(ctx, boardCtx);
    Effects.initEffects(ctx, effectsCtx);
    Effects.initParticles(gameState);
    UI.renderBoard(gameState);
    UI.drawLabels(gameState);

    // Attach UI DOM handlers (menu, start/reset, mobile variants, and piece hover)
    const menuBtn = document.getElementById('menuButton');
    const menuBtnMobile = document.getElementById('menuButton-mobile');
    const startBtn = document.getElementById('startResetBtn');
    const startBtnMobile = document.getElementById('startResetBtn-mobile');
    const piecePopup = document.getElementById('piecePopup');

    if (menuBtn) menuBtn.onclick = () => { window.location.href = 'index.html'; };
    if (menuBtnMobile) menuBtnMobile.onclick = () => { window.location.href = 'index.html'; };

    if (startBtn) startBtn.onclick = window.handleStartReset;
    if (startBtnMobile) startBtnMobile.onclick = window.handleStartReset;
    updateControlButtons();

    // Setup Optional Expansion / Toggle for Mobile Drawer
    const drawerHandle = document.querySelector('.drawer-handle');
    const drawerPeek = document.getElementById('drawerPeek');
    // Use a global toggle so other code (and delegated listeners) can reliably toggle the drawer
    if (typeof window.toggleMobileDrawer !== 'function') {
        window.toggleMobileDrawer = function () {
            const drawer = document.getElementById('mobileDrawer');
            if (!drawer) return;
            drawer.classList.toggle('expanded');
            // Ensure peek class is present when not expanded
            if (!drawer.classList.contains('expanded')) {
                drawer.classList.add('peek');
            } else {
                drawer.classList.remove('peek');
            }
        };
    }
    if (drawerHandle) drawerHandle.addEventListener('click', window.toggleMobileDrawer);
    if (drawerPeek) drawerPeek.addEventListener('click', window.toggleMobileDrawer);

    // ====== UPDATE: Fix Piece Hover Popup Position & Tracking ======
    if (canvas && piecePopup) {
        canvas.addEventListener('mousemove', (e) => {
            if (!gameState) { piecePopup.style.display = 'none'; return; }
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) { piecePopup.style.display = 'none'; return; }

            let col = Math.floor(x / C.CELL_SIZE);
            let row = Math.floor(y / C.CELL_SIZE);

            // Account for rotated view for Ash in multiplayer
            if (!isLocal && myTeam === 'ash') {
                col = C.COLS - 1 - col;
                row = C.ROWS - 1 - row;
            }

            const hoverPiece = C.getPieceAt(row, col, gameState.boardMap);
            if (!hoverPiece) { piecePopup.style.display = 'none'; return; }

            try {
                let infoHtml = UI.generatePieceInfoString(hoverPiece, gameState) || '';
                infoHtml = infoHtml.replace(/stary/gi, '');
                infoHtml = infoHtml.replace(/★|\*/g, '');
                infoHtml = infoHtml.replace(/\n{2,}/g, '\n').trim();
                piecePopup.innerHTML = infoHtml;
            } catch (e) {
                piecePopup.textContent = hoverPiece.name || '';
            }
            piecePopup.style.display = 'block';

            const offsetX = 15;
            const offsetY = 15;

            // CRITICAL FIX: Use pageX/pageY so scrolling doesn't detach the popup
            let finalLeft = e.pageX + offsetX;
            let finalTop = e.pageY + offsetY;

            // CRITICAL FIX: Check against document dimensions
            if (finalLeft + piecePopup.offsetWidth > document.documentElement.scrollWidth - 10) {
                finalLeft = e.pageX - piecePopup.offsetWidth - 10;
            }
            if (finalTop + piecePopup.offsetHeight > document.documentElement.scrollHeight - 10) {
                finalTop = e.pageY - piecePopup.offsetHeight - 10;
            }

            // CRITICAL FIX: Make the popup invisible to the mouse so it doesn't cause flickering loops
            piecePopup.style.pointerEvents = 'none';
            piecePopup.style.position = 'absolute';
            piecePopup.style.left = finalLeft + 'px';
            piecePopup.style.top = finalTop + 'px';
        });
        canvas.addEventListener('mouseleave', () => { piecePopup.style.display = 'none'; });
    }

    // Improved Selection Handler for Mobile & Desktop
    function handleSelection(e) {
        if (!canvas || !gameState) return;
        try { if (!isLocal && isWaitingForServer) return; } catch (er) { }
        // Prevent global click handler from also processing this event
        try { if (e.stopPropagation) e.stopPropagation(); } catch (er) { }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.clientX, clientY = e.clientY;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

        let col = Math.floor(x / C.CELL_SIZE);
        let row = Math.floor(y / C.CELL_SIZE);
        // Account for rotated view for Ash in multiplayer
        if (!isLocal && myTeam === 'ash') {
            col = C.COLS - 1 - col;
            row = C.ROWS - 1 - row;
        }

        // Prevent selecting units before the game has started
        if (!gameState.gameStarted) {
            const clickedPiece = C.getPieceAt(row, col, gameState.boardMap);
            if (clickedPiece) {
                try { UI.showFlashMessage('Start the game to select units', null, gameState); } catch (err) { }
            }
            return;
        }

        // If we're in an ability targeting mode, delegate to the existing handler
        if (gameState.abilityContext) {
            // CRITICAL FIX: Send all target interactions as a raw click to let the server router handle Tethers/Walls properly
            window.sendAction('HANDLE_CLICK', { r: row, c: col });
            return;
        }

        const clickedPiece = C.getPieceAt(row, col, gameState.boardMap);
        const allowedSelectTeam = isLocal
            ? gameState.currentTurn
            : (gameState.currentTurn === myTeam ? myTeam : null);

        if (allowedSelectTeam && clickedPiece && clickedPiece.team === allowedSelectTeam) {
            // Select
            window.sendAction('SELECT_PIECE', { pieceId: clickedPiece.id });
            try { gameState.selectedPiece = clickedPiece; } catch (e) { }
            try { gameState.validMoves = calculateValidMoves(clickedPiece); } catch (e) { gameState.validMoves = []; }
            try { updateMobileDrawer(clickedPiece); } catch (e) { }
            // UI update
            try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
            return;
        }

        // If no piece clicked but a piece is selected, check for move
        if (gameState.selectedPiece) {
            const move = (gameState.validMoves || []).find(m => (m.r === row || m.row === row) && (m.c === col || m.col === col));
            if (move) {
                executeMove(gameState.selectedPiece, row, col);
            }
            deselectPiece();
            try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
            return;
        }

        // Otherwise ensure nothing is selected
        deselectPiece();
    }

    function executeMove(piece, r, c) {
        if (!piece) return;
        window.sendAction('MOVE', { pieceId: piece.id, r, c, isHighway: false });
    }

    function deselectPiece() {
        try { window.sendAction('SELECT_PIECE', { pieceId: null }); } catch (e) { }
        try { gameState.selectedPiece = null; } catch (e) { }
        try { gameState.validMoves = []; } catch (e) { }

        // Reset the text when a piece is deselected
        const peekName = document.getElementById('peek-name');
        const peekDesc = document.getElementById('peek-desc');
        const miniLog = document.getElementById('miniLog');

        if (peekName) peekName.textContent = 'Awaiting selection...';
        if (peekDesc) peekDesc.textContent = '';
        if (miniLog) miniLog.style.display = 'none';

        // Add these lines to clear the expanded menu:
        const nameEl = document.getElementById('mobile-ability-name');
        const descEl = document.getElementById('mobile-ability-description');
        const expandedHeader = document.querySelector('.unit-header-mobile');

        if (expandedHeader) expandedHeader.innerHTML = '<div class="expanded-name">No Unit Selected</div><div class="expanded-ability">Select a unit to see its actions.</div>';
        if (nameEl) nameEl.textContent = 'No Unit Selected';
        if (descEl) descEl.innerHTML = 'Select a unit to see its actions.';

        const drawer = document.getElementById('mobileDrawer');
        if (drawer) { drawer.classList.remove('expanded'); }
    }
    // Hook canvas-level click/touch to selection handler; stop propagation to avoid global handler
    if (canvas) {
        canvas.addEventListener('click', (ev) => { try { handleSelection(ev); } catch (e) { } });
        canvas.addEventListener('touchstart', (ev) => {
            // Prevent double-firing and page scroll
            try { ev.preventDefault(); } catch (e) { }
            const t = ev.touches && ev.touches[0];
            if (t) {
                try { handleSelection(t); } catch (e) { }
            }
        }, { passive: false });
    }

    // Touch long-press (mobile): show a ghost overlay/peek for the touched tile
    if (canvas) {
        canvas.addEventListener('touchstart', (e) => {
            if (!gameState) return;
            // Do not show ghost previews before the game starts
            if (!gameState.gameStarted) return;
            // Prevent synthetic mouse events and page scroll while interacting with the board
            try { e.preventDefault(); } catch (err) { }
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
            let col = Math.floor(x / C.CELL_SIZE);
            let row = Math.floor(y / C.CELL_SIZE);
            // Account for rotated view for Ash in multiplayer
            if (!isLocal && myTeam === 'ash') {
                col = C.COLS - 1 - col;
                row = C.ROWS - 1 - row;
            }

            clearTimeout(touchTimer);
            touchTimer = setTimeout(() => {
                const piece = C.getPieceAt(row, col, gameState.boardMap);
                if (piece) setGhost(piece);
                if (window.navigator.vibrate) window.navigator.vibrate(20);
            }, LONG_PRESS_DURATION);
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            clearTimeout(touchTimer);
            clearGhost();
        });

        canvas.addEventListener('touchcancel', (e) => {
            clearTimeout(touchTimer);
            clearGhost();
        });
    }
}

// ============================================================================
// THE EVENT PROCESSOR
// ============================================================================
function processServerEvents(events) {
    events.forEach(event => {
        switch (event.type) {
            case 'FLASH':
                UI.showFlashMessage(event.message, event.team, gameState);
                break;
            case 'SHOW_ABILITY_PANEL':
                const pieceToShow = gameState.pieces.find(p => p.id === event.pieceId);
                if (pieceToShow) UI.showAbilityPanel(pieceToShow, gameState);
                break;
            case 'HIDE_ABILITY_PANEL': UI.hideAbilityPanel(); break;

            // CRITICAL FIX: Only show the popup to the triggering player
            case 'SHOW_ASCENSION_POPUP':
                if (isLocal || (gameState.pendingAscension && gameState.pendingAscension.team === myTeam)) {
                    UI.showAscensionPopup(gameState);
                } else {
                    UI.showFlashMessage('Opponent is choosing an Ascension path...', 'neutral', gameState);
                }
                break;

            case 'HIDE_ASCENSION_POPUP': UI.hideAscensionPopup(); break;
            case 'GAME_OVER': UI.showVictoryScreen(event.winningTeam); break;
            case 'ANIMATION': playAnimation(event); break;
            case 'RESET_GAME':
                try { UI.resetTimers(gameState); } catch (e) { }
                try { Effects.initParticles(gameState); } catch (e) { }
                break;
        }
    });
}

function playAnimation(animData) {
    switch (animData.name) {
        case 'VentEffect': Effects.spawnVentEffect(animData.r, animData.c, animData.team, gameState); break;
        case 'FrenziedDash':
            const dashPiece = gameState.pieces.find(p => p.id === animData.pieceId);
            Effects.spawnFrenziedDashEffect(dashPiece, animData.oldRow, animData.oldCol, animData.targetR, animData.targetC, gameState);
            break;
        case 'SummonWisp':
            const wisp = gameState.pieces.find(p => p.id === animData.wispId);
            Effects.spawnSummonWispEffect(animData.r, animData.c, wisp, gameState);
            break;
        case 'LavaGlob': Effects.spawnLavaGlobEffect(animData.oldRow, animData.oldCol, animData.targetR, animData.targetC, gameState); break;
        case 'PummelKnockback':
            const target = gameState.pieces.find(p => p.id === animData.targetPieceId);
            Effects.spawnPummelKnockbackEffect(target, animData.attackerR, animData.attackerC, animData.oldRow, animData.oldCol, animData.newRow, animData.newCol, gameState);
            break;
        case 'TrapDeployment': Effects.spawnTrapDeploymentEffect(animData.oldRow, animData.oldCol, animData.targetR, animData.targetC, gameState); break;
        case 'FrigidPath': Effects.spawnFrigidPathEffect(animData.oldRow, animData.oldCol, animData.targetR, animData.targetC, gameState); break;
        case 'GlacialWall': Effects.spawnGlacialWallEffect(animData.r, animData.c, gameState); break;
        case 'WallShatter': Effects.spawnWallShatterEffect(animData.r, animData.c, gameState); break;
        case 'ShatterCapture': Effects.triggerShatterCapture(animData.c * C.CELL_SIZE + C.CELL_SIZE / 2, animData.r * C.CELL_SIZE + C.CELL_SIZE / 2, animData.color); break;
        case 'ShrineOverload': Effects.triggerShrineOverloadEffects(gameState); break;
        case 'UpdateShrine': Effects.updateShrineParticles(animData.level, gameState); break;
        case 'SiphonParticles':
            const siphoner = gameState.pieces.find(p => p.id === animData.pieceId);
            Effects.spawnSiphonParticles(siphoner, animData.source, gameState);
            break;
        case 'TrapTrigger':
            const stuckPiece = gameState.pieces.find(p => p.id === animData.pieceId);
            Effects.spawnTrapTriggerEffect(animData.r, animData.c, stuckPiece, gameState);
            break;
    }
}

// ============================================================================
// INPUT HANDLING & LOCAL ROUTER
// ============================================================================
const menuBtn = document.getElementById('menuButton');
if (menuBtn) {
    menuBtn.onclick = () => { window.location.href = 'index.html'; };
}


function updatePlayerCountUI(count) {
    const el = document.getElementById('playerCountDisplay');
    const elMobile = document.getElementById('playerCountDisplay-mobile') || document.getElementById('playerCountDisplay-mobile');
    if (el) el.textContent = `Players: ${count}/2`;
    if (elMobile) elMobile.textContent = `Players: ${count}/2`;
}

// Calculate valid moves for a piece. Prefer using the shared utils if available.
function calculateValidMoves(piece) {
    if (!piece || !gameState) return [];
    try {
        // Shared utility returns rich move objects — use that when possible
        const utilMoves = E.getValidMoves ? E.getValidMoves(piece, gameState) : null;
        if (Array.isArray(utilMoves)) return utilMoves.map(m => ({ r: m.row ?? m.r, c: m.col ?? m.c, ...m }));
    } catch (e) { }

    // Fallback: simple adjacent empty squares
    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = piece.row + dr;
            const nc = piece.col + dc;
            if (C.inBounds(nr, nc) && !C.getPieceAt(nr, nc, gameState.boardMap)) moves.push({ r: nr, c: nc });
        }
    }
    return moves;
}

// Mobile drawer helpers
function updateMobileDrawer(piece) {
    const drawer = document.getElementById('mobileDrawer');
    if (!drawer || !piece) return;

    // Ensure local selection state is set for UI consistency
    try { gameState.selectedPiece = piece; } catch (e) { }
    try { gameState.validMoves = calculateValidMoves(piece); } catch (e) { gameState.validMoves = []; }

    drawer.classList.remove('hidden');
    drawer.classList.add('peek');
    // NOTE: Intentionally NOT adding 'expanded' here so it stays peeked until tapped.

    // 1. Format the strict left-side text you requested on separate lines
    const peekName = document.getElementById('peek-name');
    const peekDesc = document.getElementById('peek-desc');
    const miniLog = document.getElementById('miniLog');

    const displayName = piece.name || (C.PIECE_TYPES && C.PIECE_TYPES[piece.key]?.name) || 'Unit';
    const power = typeof piece.power === 'number' ? piece.power : (piece.basePower || 0);

    let abilityText = 'No Ability';
    if (piece.ability && piece.ability.name) {
        const cd = piece.ability.cooldown > 0 ? `${piece.ability.cooldown}T CD` : 'Ready';
        abilityText = `${piece.ability.name} (${cd})`;
    }

    // Compact peek summary: single column, small text. When expanded, CSS hides this area.
    if (peekName) {
        peekName.style.display = 'block';
        peekName.style.fontSize = '13px';
        peekName.style.fontWeight = '700';
        peekName.textContent = `${displayName} (${power})`;
    }
    if (peekDesc) {
        peekDesc.style.display = 'block';
        peekDesc.style.fontSize = '12px';
        peekDesc.style.opacity = '0.95';
        peekDesc.textContent = abilityText;
    }
    if (miniLog) miniLog.style.display = 'none'; // Keep mini log out of peek; it is present in expanded view

    // 2. Populate the detailed expanded content
    const nameEl = document.getElementById('mobile-ability-name');
    const descEl = document.getElementById('mobile-ability-description');

    // Gather ability entries from the piece FIRST so we can use them for descriptions
    // Gather ability entries from the piece FIRST
    let abilities = [];
    // FIX: Use the spread operator [...] to create a shallow copy so we don't mutate the core game state!
    if (Array.isArray(piece.abilities) && piece.abilities.length > 0) abilities = [...piece.abilities];
    else if (piece.ability) abilities = [{ ...piece.ability }];
    else if (piece.abilityName) abilities = [{ name: piece.abilityName, key: piece.abilityKey || piece.abilityKeyName }];

    // Check for veteran abilities that might not be packaged in the main array
    if (piece.isVeteran && piece.secondaryAbilityKey) {
        const vetName = C.ABILITIES[piece.secondaryAbilityKey]?.name || 'Veteran Ability';

        // CRITICAL FIX: Pass the cooldown property so the UI button visually disables
        abilities.push({
            name: vetName,
            key: piece.secondaryAbilityKey,
            cooldown: piece.secondaryAbilityCooldown
        });
    }

    // Expanded header now shows concise lines: name, power, ability status
    try {
        const expandedHeader = document.querySelector('.unit-header-mobile');
        if (expandedHeader) {
            // Clear existing content and rebuild the layout
            expandedHeader.innerHTML = '';
            const lineName = document.createElement('div'); lineName.className = 'expanded-name'; lineName.textContent = displayName;
            const linePower = document.createElement('div'); linePower.className = 'expanded-power'; linePower.textContent = `Power: ${power}`;
            const lineAbility = document.createElement('div'); lineAbility.className = 'expanded-ability'; lineAbility.textContent = abilityText;

            // Build the specific ability description block
            const abilityDescriptions = abilities.map(a => {
                const name = a.name || 'Action';
                const desc = getAbilityDescription(a.key || a.abilityKey);
                return `<span style="color:#ffcc00">${name}:</span> <span style="color:#ddd">${desc}</span>`;
            }).join('<br><br>');

            const lineDesc = document.createElement('div');
            lineDesc.className = 'expanded-desc-text';
            lineDesc.style.fontSize = '13px';
            lineDesc.style.marginTop = '12px';
            lineDesc.style.marginBottom = '5px';
            lineDesc.style.lineHeight = '1.4';
            lineDesc.style.textAlign = 'center';
            lineDesc.innerHTML = abilityDescriptions;

            // Append everything in order
            expandedHeader.appendChild(lineName);
            expandedHeader.appendChild(linePower);
            expandedHeader.appendChild(lineAbility);
            if (abilities.length > 0) expandedHeader.appendChild(lineDesc);
        }
        if (nameEl) nameEl.innerText = displayName;
        if (descEl) descEl.innerHTML = UI.generatePieceInfoString(piece, gameState);
    } catch (er) {
        if (nameEl) nameEl.innerText = displayName;
        if (descEl) descEl.innerHTML = UI.generatePieceInfoString(piece, gameState);
    }
}

// Helper to get ability descriptions based on the rules
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
        'MagmaShield': 'Place a shield on an ally for 2 rounds. Next attacker takes 1 damage.',
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
        'EruptionLink': 'Grants an adjacent ally Magma Shield and +2 Power for 1 turn.',
        'HardenedIce': 'Grants an adjacent ally Steadfast for 2 full rounds.',
        'SoulfireBurst': 'Detonates a nearby Unstable Ground, dealing 1 damage to adjacent units.',
        'KingsEdict': 'Enemy Ash pieces -1 Power and cannot move diagonally (2 rounds).',
        'TyrantsProclamation': 'Friendly Ash pieces +1 Power; captures create Unstable Ground (2 rounds).',
        'Siphon': 'Link units to transfer power or absorb debuffs.'
    };
    return descriptions[abilityKey] || 'Activate ability.';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    if (!drawer) return;
    drawer.classList.remove('expanded');
    // We strictly DO NOT remove 'peek' or add 'hidden' anymore
}

window.sendAction = function (actionType, data) {
    if (isLocal) {
        processLocalAction(actionType, data);
    } else {
        // NEW: Enforce the lock globally so players can't spam buttons during lag
        if (isWaitingForServer && (actionType === 'MOVE' || actionType === 'ABILITY' || actionType === 'HANDLE_CLICK' || actionType === 'SWITCH_TURN')) {
            return;
        }

        if (gameState && (actionType === 'MOVE' || actionType === 'ABILITY' || actionType === 'HANDLE_CLICK' || actionType === 'SWITCH_TURN')) {
            if (gameState.currentTurn !== myTeam) return;

            // Apply the lock
            isWaitingForServer = true;
        }

        socket.emit('gameAction', { roomId, actionType, data });
    }
};

// Consolidate global click listener to ignore game board areas
window.addEventListener('click', (e) => {
    if (!isLocal && isWaitingForServer) return;

    // FIX: If the click is on the canvas, ignore it here. 
    // The specific canvas 'click' and 'touchstart' listeners already handle it.
    if (e.target === canvas) return;

    try {
        if (e.target && e.target.closest && e.target.closest('.ability-panel, .ui-container, button, .top-menu-btn, #left-column, #right-column, #mobile-top-bar, #disconnectModal, .mobile-drawer')) return;
    } catch (err) { }

    // Deselect if clicking on empty UI background
    window.sendAction('SELECT_PIECE', { pieceId: null });
    try { gameState.selectedPiece = null; gameState.validMoves = []; } catch (e) { }
});

// Update canvas listeners to prevent event bubbling/duplication
if (canvas) {
    canvas.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try { handleSelection(ev); } catch (e) { }
    }, { passive: false });

    canvas.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const t = ev.touches && ev.touches[0];
        if (t) {
            try { handleSelection(t); } catch (e) { }
        }
    }, { passive: false });
}

window.useAbility = function (abilityKey) {
    if (!gameState.selectedPiece) return;
    window.sendAction('ABILITY', { pieceId: gameState.selectedPiece.id, abilityKey, target: null });
};

window.endTurn = function () {
    window.sendAction('SWITCH_TURN', {});
};

// ============================================================================
// THE SHARED LOGIC SWITCHBOARD
// ============================================================================
export function applyActionLogic(actionType, data, gs) {
    let turnEnded = false;
    const find = (id) => gs.pieces.find(x => x.id === id);

    switch (actionType) {
        case 'SELECT_PIECE':
            const p = find(data.pieceId);
            if (p) Logic.selectPiece(p); else Logic.deselectPiece();
            break;
        case 'MOVE':
            const mp = find(data.pieceId);
            if (mp) turnEnded = Logic.movePiece(mp, data.r, data.c, data.isHighway);
            break;
        case 'ABILITY':
            const cp = find(data.pieceId);
            if (cp) {
                // FIX: Only execute if a target coordinate is explicitly provided
                if (data.target) {
                    turnEnded = Logic.executeAbility(cp, data.target, data.abilityKey, gs);
                } else {
                    // Otherwise, activate it (which safely enters targeting mode)
                    turnEnded = Logic.activateAbility(cp, data.abilityKey || data.unleashCostOrKey || 0);
                }
            }
            break;
        case 'HANDLE_CLICK': turnEnded = Logic.handleAbilityClick(data.r, data.c); break;
        case 'SWITCH_TURN': turnEnded = true; break;
        case 'ASCENSION_CHOICE': turnEnded = Logic.executeAscensionChoice(data.choice); break;
        case 'CANCEL_ASCENSION': Logic.cancelAscensionChoice(); break;
        case 'VENT_OVERLOAD': turnEnded = Logic.ventOverload(find(data.pieceId)); break;
        case 'SACRIFICE': turnEnded = Logic.executeSacrifice(find(data.pieceId)); break;
        case 'RELEASE': turnEnded = Logic.executeRelease(find(data.pieceId)); break;
        case 'START_TETHER':
            const tp = find(data.pieceId);
            gs.abilityContext = { piece: tp, siphoner: tp, mode: data.mode, abilityKey: 'Tether' };
            Logic.setCurrentState(Logic.GameState.TETHER_TARGETING);
            Logic.emit(gs, { type: 'FLASH', message: `Select target for ${data.mode}`, team: tp.team });
            break;
        case 'RIFT_PULSE': turnEnded = Logic.executeRiftPulse(find(data.pieceId)); break;
        case 'DESPAWN': Logic.despawnPiece(find(data.pieceId)); turnEnded = true; break;
        case 'TIMEOUT':
            Logic.endGame(data.team === 'snow' ? 'ash' : 'snow');
            break;
    }
    // Ensure utilities depending on the 2D grid are accurate after logic changes
    try { E.updateBoardMap(gs); } catch (e) { }

    if (turnEnded) {
        // If an ascension becomes ready, show the popup and DO NOT auto-switch turns.
        const ascensionTriggered = Logic.checkAscensionReady();
        if (!ascensionTriggered && isLocal) {
            // In local mode we are authoritative for turn progression.
            Logic.switchTurn();
        }
    }
}

function processLocalAction(actionType, data) {
    gameState.events = [];
    applyActionLogic(actionType, data, gameState);
    try { E.updateBoardMap(gameState); } catch (e) { }
    if (gameState.events && gameState.events.length > 0) processServerEvents(gameState.events);
    UI.renderBoard(gameState);
    UI.drawLabels(gameState);
    // If playing locally against AI, allow the AI to act when it's their turn
    if (isLocal && vsAI) setTimeout(checkAITurn, 0);
}

// ============================================================================
// THE RENDER LOOP
// ============================================================================
// Draw faction ley-lines (borders between captured territory)
function drawLeyLines(ctx, gs) {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    if (!gs) { ctx.restore(); return; }

    // Loop through board tiles
    for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
            const pos = `${r},${c}`;
            const owner = (gs.snowTerritory && gs.snowTerritory.has(pos)) ? 'snow' : ((gs.ashTerritory && gs.ashTerritory.has(pos)) ? 'ash' : null);
            if (!owner) continue;

            // Define the tile boundaries
            const x = c * C.CELL_SIZE;
            const y = r * C.CELL_SIZE;

            // Check neighbors (Right and Bottom) to draw borders
            const neighbors = [{ nr: r, nc: c + 1, side: 'right' }, { nr: r + 1, nc: c, side: 'bottom' }];
            neighbors.forEach(({ nr, nc, side }) => {
                if (!C.inBounds(nr, nc)) return;
                const nPos = `${nr},${nc}`;
                const nOwner = (gs.snowTerritory && gs.snowTerritory.has(nPos)) ? 'snow' : ((gs.ashTerritory && gs.ashTerritory.has(nPos)) ? 'ash' : null);

                // Draw line if owners are different (Faction Border)
                if (owner !== nOwner) {
                    ctx.beginPath();
                    const color = owner === 'snow' ? '#00BFFF' : '#FF4500';
                    ctx.strokeStyle = color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = color;

                    // Add a small margin so lines don't touch tile corners
                    const pad = Math.max(6, Math.floor(C.CELL_SIZE * 0.06));
                    if (side === 'right') {
                        ctx.moveTo(x + C.CELL_SIZE, y + pad);
                        ctx.lineTo(x + C.CELL_SIZE, y + C.CELL_SIZE - pad);
                    } else {
                        ctx.moveTo(x + pad, y + C.CELL_SIZE);
                        ctx.lineTo(x + C.CELL_SIZE - pad, y + C.CELL_SIZE);
                    }
                    ctx.stroke();
                }
            });
        }
    }

    // Reset shadow for performance
    ctx.shadowBlur = 0;
    ctx.restore();
}
// Draw a subtle ghost overlay showing a unit's possible moves / threat area
function drawGhostOverlay(ctx, gs) {
    if (!gs || !gs.ghostPieceId) return;
    const piece = gs.pieces && gs.pieces.find(p => p.id === gs.ghostPieceId);
    if (!piece) return;

    const moves = gs.ghostMoves || E.getValidMoves(piece, gs) || [];
    if (!moves || moves.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const color = piece.team === 'snow' ? 'rgba(0,191,255,0.18)' : 'rgba(255,69,0,0.18)';
    const stroke = piece.team === 'snow' ? 'rgba(0,191,255,0.6)' : 'rgba(255,69,0,0.6)';
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;

    moves.forEach(m => {
        if (!C.inBounds(m.row, m.col)) return;
        const x = m.col * C.CELL_SIZE;
        const y = m.row * C.CELL_SIZE;
        // Draw rounded rect — approximate with a filled rect and a stroked border
        ctx.fillRect(x + 4, y + 4, C.CELL_SIZE - 8, C.CELL_SIZE - 8);
        ctx.strokeRect(x + 4, y + 4, C.CELL_SIZE - 8, C.CELL_SIZE - 8);
    });

    // Also highlight the piece's current tile with a stronger ring
    const px = piece.col * C.CELL_SIZE;
    const py = piece.row * C.CELL_SIZE;
    ctx.beginPath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.rect(px + 6, py + 6, C.CELL_SIZE - 12, C.CELL_SIZE - 12);
    ctx.stroke();

    ctx.restore();
}

function setGhost(piece) {
    if (!gameState || !piece) return;
    gameState.ghostPieceId = piece.id;
    try { gameState.ghostMoves = E.getValidMoves(piece, gameState) || []; } catch (e) { gameState.ghostMoves = []; }
}

function clearGhost() {
    if (!gameState) return;
    delete gameState.ghostPieceId;
    delete gameState.ghostMoves;
}
function animationLoop() {
    if (!gameState) { requestAnimationFrame(animationLoop); return; }
    ctx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    let didTransform = false;
    if (gameState.playerTeam === 'ash') {
        ctx.save();
        ctx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
        ctx.rotate(Math.PI);
        didTransform = true;
    }

    // Render static background layer generated by ui.js
    const bgCanvas = UI.getBoardCanvas();
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    // Draw ley-lines (territory borders) above the board background
    try { drawLeyLines(ctx, gameState); } catch (e) { /* non-fatal */ }
    // Draw ghost overlay (from long-press peek) above ley-lines but under particles/pieces
    try { drawGhostOverlay(ctx, gameState); } catch (e) { /* non-fatal */ }
    // Draw valid-move highlights for the currently selected piece (mobile drawer / quick-preview)
    try {
        if (gameState && gameState.validMoves && gameState.selectedPiece) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            const team = gameState.selectedPiece.team || gameState.playerTeam || 'snow';
            ctx.fillStyle = team === 'snow' ? '#00BFFF' : '#FF4500';
            for (const move of gameState.validMoves) {
                const rr = move.r ?? move.row ?? 0;
                const cc = move.c ?? move.col ?? 0;
                const cx = cc * C.CELL_SIZE + C.CELL_SIZE / 2;
                const cy = rr * C.CELL_SIZE + C.CELL_SIZE / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, C.CELL_SIZE / 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    } catch (e) { /* non-fatal */ }

    const visualLoad = (
        (gameState.battleParticles?.length || 0) +
        (gameState.snowParticles?.length || 0) +
        (gameState.ashParticles?.length || 0) +
        (gameState.iceBeamAnimations?.length || 0) +
        (gameState.lavaAnimations?.length || 0) +
        (gameState.wispAnimations?.length || 0) +
        (gameState.wallAnimations?.length || 0) +
        (gameState.shockwaves?.length || 0) +
        (gameState.projectiles?.length || 0) +
        (gameState.groundEffectParticles?.length || 0)
    );
    // If too many active elements, throttle visuals
    gameState.lowDetail = visualLoad > 450;

    // Under lowDetail, proactively cap some particle arrays so draw work remains bounded
    if (gameState.lowDetail) {
        if (gameState.battleParticles && gameState.battleParticles.length > 200) gameState.battleParticles.length = 200;
        if (gameState.snowParticles && gameState.snowParticles.length > 80) gameState.snowParticles.length = 80;
        if (gameState.ashParticles && gameState.ashParticles.length > 80) gameState.ashParticles.length = 80;
    }

    if (Effects.drawParticles) Effects.drawParticles(gameState);
    if (Effects.drawGroundEffectParticles) Effects.drawGroundEffectParticles(gameState);
    if (Effects.drawSiphonParticles) Effects.drawSiphonParticles(gameState);

    // Draw active pieces
    if (gameState.pieces) {
        gameState.pieces.forEach(p => {
            if (p.id !== gameState.trappedPiece) UI.drawPiece(p, ctx, gameState);
        });
    }

    // FIX: Draw ALL dynamic animations (Many were missing here)
    if (Effects.drawFrenziedDashAnimations) Effects.drawFrenziedDashAnimations(gameState);
    if (Effects.drawSummonWispAnimations) Effects.drawSummonWispAnimations(gameState);
    if (Effects.drawLavaGlobAnimations) Effects.drawLavaGlobAnimations(gameState);
    if (Effects.drawTrapDeployments) Effects.drawTrapDeployments(gameState);
    if (Effects.drawTrapTriggerAnimations) Effects.drawTrapTriggerAnimations(gameState);
    if (Effects.drawFrigidPathAnimations) Effects.drawFrigidPathAnimations(gameState);
    if (Effects.drawGlacialWallAnimations) Effects.drawGlacialWallAnimations(gameState);
    if (Effects.drawPummelKnockbackAnimations) Effects.drawPummelKnockbackAnimations(gameState);
    if (Effects.drawScorchedRetreatAnimations) Effects.drawScorchedRetreatAnimations(gameState, ctx, loadedImages);
    if (Effects.drawVentAnimations) Effects.drawVentAnimations(gameState); // Fixed invalid param passing
    if (Effects.drawShrineEffects) Effects.drawShrineEffects(gameState);
    UI.drawLastMoveIndicator(gameState);

    // Draw interactive overlays
    if (gameState.selectedPiece && (isLocal || gameState.currentTurn === myTeam)) {
        UI.drawSelection(gameState);
        if (gameState.abilityContext) UI.drawAbilityHighlights(gameState);
    }
    // Restore the transform if one was applied
    if (didTransform) ctx.restore();

    // Sync mobile timers directly from gameState object to bypass ui.js missing the IDs
    if (gameState && gameState.timers) {
        const sTimer = document.getElementById('miniTimerSnow');
        const aTimer = document.getElementById('miniTimerAsh');
        const formatTime = seconds => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        if (sTimer) sTimer.textContent = formatTime(gameState.timers.snow);
        if (aTimer) aTimer.textContent = formatTime(gameState.timers.ash);
    }

    requestAnimationFrame(animationLoop);
}

try {
    if (typeof menuBtn !== 'undefined' && menuBtn) {
        menuBtn.addEventListener('click', () => {
            if (socket) try { socket.disconnect(); } catch (e) { }
            window.location.href = 'index.html';
        });
    }
} catch (e) { }