import * as C from '../../shared/constants.js';
import * as UI from './ui.js';
import * as Effects from './effects.js';
import * as Logic from '../../shared/logic.js';
import * as E from '../../shared/utils.js';

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
const vsAI = urlParams.get('ai') === '1';

let aiWorker = null;

function checkAITurn() {
    if (!isLocal) return;
    if (!vsAI) return;
    if (!gameState || gameState.gameOver) return;
    
    const aiTeam = myTeam === 'snow' ? 'ash' : 'snow';
    if (gameState.currentTurn !== aiTeam) return;

    try {
        if (aiWorker) aiWorker.terminate();
        aiWorker = new Worker('js/ai.worker.js', { type: 'module' });
        aiWorker.onmessage = (ev) => {
            const { bestAction } = ev.data;
            if (!bestAction) return;
            if (bestAction.type === 'move') {
                processLocalAction('MOVE', { pieceId: bestAction.piece.id, r: bestAction.target.row, c: bestAction.target.col, isHighway: bestAction.target.isHighway || false });
            } else if (bestAction.type === 'ability') {
                processLocalAction('ABILITY', { pieceId: bestAction.piece.id, abilityKey: bestAction.abilityKey, target: bestAction.target });
            }
            aiWorker.terminate(); aiWorker = null;
            try { E.updateBoardMap(gameState); } catch (e) { }
            UI.renderBoard(gameState); UI.drawLabels(gameState);
            setTimeout(checkAITurn, 0);
        };
        aiWorker.postMessage({ gameState: structuredClone(gameState), aiConfig: {} });
    } catch (e) {
        console.warn('Failed to spawn AI worker:', e);
        if (aiWorker) { try { aiWorker.terminate(); } catch (er) { } aiWorker = null; }
    }
}

let currentRoomPlayers = [];

function initFactionSelection() {
    const overlay = document.getElementById('factionSelectionOverlay');
    if (overlay) overlay.style.display = 'none';

    // Pass & Play (Local play, not vs AI) -> Skip faction selection completely!
    if (isLocal && !vsAI) {
        myTeam = 'snow';
        if (gameState) {
            gameState.gameStarted = true;
        }
        return;
    }

    const teamParam = urlParams.get('team');
    if (vsAI) {
        if (teamParam === 'snow' || teamParam === 'ash') {
            myTeam = teamParam;
            if (gameState) {
                gameState.gameStarted = true;
            }
        } else {
            window.location.href = 'index.html';
        }
    } else {
        // Online mode
        if (gameState && !gameState.gameStarted && !myTeam) {
            window.location.href = 'index.html';
        } else if (myTeam) {
            const teamDisplay = document.getElementById('yourTeamDisplay');
            if (teamDisplay) {
                teamDisplay.style.display = 'block';
                teamDisplay.textContent = `YOU ARE TEAM ${myTeam.toUpperCase()}`;
            }
        }
    }
}

E.preloadImages(C.IMAGES, (imgs) => {
    loadedImages = imgs;

    if (isLocal) {
        Logic.initGameState({});
        Logic.initGame();
        gameState = Logic.getGameState();
        attachImagesToState();

        if (!vsAI) {
            myTeam = 'snow';
            gameState.gameStarted = true;
        } else {
            const teamParam = urlParams.get('team');
            if (teamParam === 'snow' || teamParam === 'ash') {
                myTeam = teamParam;
                gameState.gameStarted = true;
            } else {
                myTeam = null;
            }
        }

        setTimeout(() => {
            setupCanvas();
            requestAnimationFrame(animationLoop);
            initFactionSelection();
            if (vsAI && gameState.gameStarted) setTimeout(checkAITurn, 0);
        }, 100);
    } else {
        const devPorts = ['5500', '5501', '5173', '8080', '8081', '3001'];
        const isDevServer = devPorts.includes(window.location.port);
        const connectionUrl = (window.location.protocol === 'file:' || isDevServer) ? 'http://localhost:3000' : '';
        socket = io(connectionUrl);
        try { document.body.classList.add('multiplayer'); } catch (e) { }
        let playerId = sessionStorage.getItem('mythic_playerId');
        if (!playerId) {
            playerId = 'p_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('mythic_playerId', playerId);
        }
        socket.on('connect', () => socket.emit('joinRoom', { roomId, playerId }));

        socket.on('init', (data) => {
            gameState = data.state;
            myTeam = data.team;
            currentRoomPlayers = data.players || [];

            const teamDisplay = document.getElementById('yourTeamDisplay');
            if (teamDisplay) {
                teamDisplay.style.display = myTeam ? 'block' : 'none';
                if (myTeam) {
                    teamDisplay.textContent = `YOU ARE TEAM ${myTeam.toUpperCase()}`;
                }
            }
            updatePlayerCountUI(data.playerCount);
            attachImagesToState();
            E.updateBoardMap(gameState);
            setupCanvas();
            requestAnimationFrame(animationLoop);

            if (myTeam) {
                UI.showFlashMessage(`Joined room ${roomId} as Team ${myTeam.toUpperCase()}`, 'neutral', gameState);
            } else {
                UI.showFlashMessage(`Joined room ${roomId}. Select a faction!`, 'neutral', gameState);
            }

            try { clearInterval(disconnectInterval); } catch (e) { }
            const timerEl = document.getElementById('disconnectTimerDisplay');
            const timerElMobile = document.getElementById('disconnectTimerDisplay-mobile');
            if (timerEl) timerEl.style.display = 'none';
            if (timerElMobile) timerElMobile.style.display = 'none';

            initFactionSelection();

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
        });

        socket.on('playerJoined', (data) => {
            UI.showFlashMessage(`An opponent has joined!`, 'neutral', gameState);
            updatePlayerCountUI(data.playerCount);
            currentRoomPlayers = data.players || [];
            initFactionSelection();

            try { clearInterval(disconnectInterval); } catch (e) { }
            const modal = document.getElementById('disconnectModal');
            if (modal) modal.style.display = 'none';

            if (gameState && gameState.gameStarted) {
                UI.startTimer(gameState);
                updateControlButtons();

                socket.emit('gameAction', { roomId, actionType: 'SYNC_TIMERS', data: { timers: gameState.timers } });
            }
        });

        socket.on('playerLeft', (data) => {
            if (isLocal) return; // FIX: Block in P&P mode

            UI.showFlashMessage(`Player left the room.`, 'neutral', gameState);
            updatePlayerCountUI(data.playerCount);

            try { UI.stopTimer(); } catch (e) { }

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
                if (Array.isArray(gameState.snowTerritory)) gameState.snowTerritory = new Set(gameState.snowTerritory);
                if (Array.isArray(gameState.ashTerritory)) gameState.ashTerritory = new Set(gameState.ashTerritory);
                if (currentTimers && !data.state.timers) gameState.timers = currentTimers;
                attachImagesToState();
            } else if (data.diff) {
                if (!gameState) { window.location.reload(); return; }
                for (const k of Object.keys(data.diff)) {
                    gameState[k] = data.diff[k];
                }
                if (Array.isArray(gameState.snowTerritory)) gameState.snowTerritory = new Set(gameState.snowTerritory);
                if (Array.isArray(gameState.ashTerritory)) gameState.ashTerritory = new Set(gameState.ashTerritory);
                if (currentTimers && !data.diff.timers) gameState.timers = currentTimers;
                attachImagesToState();
            }

            const testToggle = document.getElementById('testModeToggle');
            if (testToggle) {
                testToggle.checked = !!gameState.testMode;
            }

            if (!isLocal && gameState.currentTurn !== myTeam) {
                gameState.selectedPiece = null;
            }

            if (data.events && data.events.length > 0) processServerEvents(data.events);
            if (!isLocal && gameState?.gameStarted) {
                try { UI.startTimer(gameState); } catch (e) { }
            }

            const overlay = document.getElementById('factionSelectionOverlay');
            if (overlay) {
                if (isLocal && !vsAI) {
                    overlay.style.display = 'none';
                } else if (gameState && gameState.gameStarted) {
                    overlay.style.display = 'none';
                } else {
                    overlay.style.display = 'flex';
                }
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

        socket.on('error', (msg) => {
            alert(msg);
            isWaitingForServer = false;
        });

        socket.on('roomClosed', (msg) => {
            if (isLocal) return; // FIX: Block in P&P mode

            alert(msg);
            window.location.href = 'index.html';
        });

        socket.on('teamAssigned', (faction) => {
            myTeam = faction;
            const teamDisplay = document.getElementById('yourTeamDisplay');
            if (teamDisplay) {
                teamDisplay.style.display = 'block';
                teamDisplay.textContent = `YOU ARE TEAM ${myTeam.toUpperCase()}`;
            }
            initFactionSelection();
        });

        socket.on('roomUpdate', (data) => {
            currentRoomPlayers = data.players || [];
            initFactionSelection();
        });
    }
});

function attachImagesToState() {
    if (!gameState) return;
    try { E.updateBoardMap(gameState); } catch (e) { }

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
}

function updateControlButtons() {
    const label = (!gameState || !gameState.gameStarted) ? 'START' : 'RESET';
    ['startResetBtn', 'startResetBtn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.textContent = label;
            if (!isLocal && myTeam !== 'snow') {
                btn.style.display = 'none'; // Only host can start in MP
            } else {
                btn.style.display = id === 'startResetBtn-mobile' ? 'inline-block' : 'block';
                btn.style.visibility = 'visible';
                btn.style.opacity = '1';
            }
        }
    });

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
        const ml = document.getElementById('messageLog'); if (ml) ml.innerHTML = '';
        const mlMobile = document.getElementById('messageLog-mobile'); if (mlMobile) mlMobile.innerHTML = '';

        if (isLocal) {
            gameState.gameStarted = true;
            try {
                gameState.ashParticles = [];
                gameState.frostfallShards = [];
                Effects.initParticles(gameState);
            } catch (e) { }
            try { UI.startTimer(gameState); } catch (e) { }
            updateControlButtons();
            UI.renderBoard(gameState);
            UI.drawLabels(gameState);
            if (vsAI) setTimeout(checkAITurn, 0);
        } else {
            socket.emit('gameAction', { roomId, actionType: 'START_GAME', data: {} });
        }
    } else {
        if (isLocal) {
            try {
                Logic.resetGame();
                gameState = Logic.getGameState();
                try { UI.clearMessageLog(); } catch (e) { }
                attachImagesToState();
                Effects.initParticles(gameState);
                UI.resetTimers(gameState);
                UI.renderBoard(gameState);
                UI.drawLabels(gameState);
            } catch (e) {
                console.error('Failed to reset game', e);
            }
        } else {
            socket.emit('gameAction', { roomId, actionType: 'RESET_GAME', data: {} });
        }
    }
    updateControlButtons();
};

function setupCanvas() {
    const displayCanvas = document.getElementById('gameBoard');
    if (!displayCanvas) return;
    canvas = displayCanvas;

    canvas.width = C.CANVAS_SIZE;
    canvas.height = C.CANVAS_SIZE;
    ctx = canvas.getContext('2d');

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

    const menuBtn = document.getElementById('menuButton');
    const menuBtnMobile = document.getElementById('menuButton-mobile');
    const startBtn = document.getElementById('startResetBtn');
    const startBtnMobile = document.getElementById('startResetBtn-mobile');
    const piecePopup = document.getElementById('piecePopup');

    if (menuBtn) menuBtn.onclick = () => { window.location.href = 'index.html'; };
    if (menuBtnMobile) menuBtnMobile.onclick = () => { window.location.href = 'index.html'; };

    const testModeToggle = document.getElementById('testModeToggle');
    const testModeToggleMobile = document.getElementById('testModeToggle-mobile');
    const handleTestModeToggle = (enabled) => {
        if (testModeToggle) testModeToggle.checked = enabled;
        if (testModeToggleMobile) testModeToggleMobile.checked = enabled;
        window.sendAction('TOGGLE_TEST_MODE', { enabled });
    };
    if (testModeToggle) {
        testModeToggle.onchange = () => handleTestModeToggle(testModeToggle.checked);
    }
    if (testModeToggleMobile) {
        testModeToggleMobile.onchange = () => handleTestModeToggle(testModeToggleMobile.checked);
    }

    if (startBtn) startBtn.onclick = window.handleStartReset;
    if (startBtnMobile) startBtnMobile.onclick = window.handleStartReset;

    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) restartBtn.onclick = () => {
        const vs = document.getElementById('victoryScreen');
        if (vs) vs.style.display = 'none';
        window.handleStartReset();
    };

    const victoryMenuBtn = document.getElementById('victoryMenuBtn');
    if (victoryMenuBtn) victoryMenuBtn.onclick = () => {
        window.location.href = 'index.html';
    };

    updateControlButtons();

    const drawerHandle = document.querySelector('.drawer-handle');
    const drawerPeek = document.getElementById('drawerPeek');
    if (typeof window.toggleMobileDrawer !== 'function') {
        window.toggleMobileDrawer = function () {
            const drawer = document.getElementById('mobileDrawer');
            if (!drawer) return;
            drawer.classList.toggle('expanded');
            if (!drawer.classList.contains('expanded')) {
                drawer.classList.add('peek');
            } else {
                drawer.classList.remove('peek');
            }
        };
    }
    if (drawerHandle) drawerHandle.addEventListener('click', window.toggleMobileDrawer);
    if (drawerPeek) drawerPeek.addEventListener('click', window.toggleMobileDrawer);

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

            gameState.hoverCol = col;
            gameState.hoverRow = row;

            if (myTeam === 'ash') {
                row = C.ROWS - 1 - row;
                col = C.COLS - 1 - col;
            }

            const hoverPiece = C.getPieceAt(row, col, gameState.pieces);
            if (!hoverPiece) { piecePopup.style.display = 'none'; return; }

            try {
                let infoHtml = UI.generatePieceInfoString(hoverPiece, gameState) || '';
                infoHtml = infoHtml.replace(/stary/gi, '');
                infoHtml = infoHtml.replace(/★|\*/g, '');
                infoHtml = infoHtml.replace(/\n{2,}/g, '\n').trim();

                const sel = gameState.selectedPiece;
                if (
                    sel &&
                    sel.team !== hoverPiece.team &&
                    typeof E.previewDamage === 'function'
                ) {
                    try {
                        const preview = E.previewDamage(sel, hoverPiece, gameState);
                        const hpNow = typeof hoverPiece.currentHp === 'number' ? hoverPiece.currentHp : (hoverPiece.maxHp || '?');
                        const hpMax = hoverPiece.maxHp || hpNow;
                        let predHtml = `<div id="tacticalPredictor">`;
                        predHtml += `<div>⚔ ${C.PIECE_TYPES[sel.key]?.name || sel.key} → ${C.PIECE_TYPES[hoverPiece.key]?.name || hoverPiece.key}</div>`;
                        predHtml += `<div>HP: ${hpNow}/${hpMax} &nbsp;|&nbsp; `;
                        predHtml += `DMG: <span class="pred-dmg">-${preview.dmg}</span></div>`;
                        if (preview.isFatal) {
                            predHtml += `<div class="pred-fatal">☠ LETHAL STRIKE</div>`;
                        } else {
                            const hpAfter = Math.max(0, hpNow - preview.dmg);
                            predHtml += `<div>Remaining HP: <span class="pred-chip">${hpAfter}</span></div>`;
                        }
                        predHtml += `</div>`;
                        infoHtml += predHtml;
                    } catch (predErr) { /* non-fatal */ }
                }

                piecePopup.innerHTML = infoHtml;
            } catch (e) {
                piecePopup.textContent = hoverPiece.name || '';
            }
            piecePopup.style.display = 'block';

            const offsetX = 15;
            const offsetY = 15;

            let finalLeft = e.pageX + offsetX;
            let finalTop = e.pageY + offsetY;

            if (finalLeft + piecePopup.offsetWidth > document.documentElement.scrollWidth - 10) {
                finalLeft = e.pageX - piecePopup.offsetWidth - 10;
            }
            if (finalTop + piecePopup.offsetHeight > document.documentElement.scrollHeight - 10) {
                finalTop = e.pageY - piecePopup.offsetHeight - 10;
            }

            piecePopup.style.pointerEvents = 'none';
            piecePopup.style.position = 'absolute';
            piecePopup.style.left = finalLeft + 'px';
            piecePopup.style.top = finalTop + 'px';
        });
        canvas.addEventListener('mouseleave', () => { piecePopup.style.display = 'none'; });

    }

    function handleSelection(e) {
        if (!canvas || !gameState) return;
        try { if (!isLocal && isWaitingForServer) return; } catch (er) { }
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
        let decimalCol = x / C.CELL_SIZE;
        let decimalRow = y / C.CELL_SIZE;
        if (myTeam === 'ash') {
            row = C.ROWS - 1 - row;
            col = C.COLS - 1 - col;
            decimalRow = C.ROWS - decimalRow;
            decimalCol = C.COLS - decimalCol;
        }

        if (!gameState.gameStarted) {
            const clickedPiece = C.getPieceAt(row, col, gameState.pieces);
            if (clickedPiece) {
                try { UI.showFlashMessage('Start the game to select units', null, gameState); } catch (err) { }
            }
            return;
        }

        const logicRow = decimalRow - 0.5;
        const logicCol = decimalCol - 0.5;

        if (gameState.abilityContext) {
            const targetP = C.getPieceAt(logicRow, logicCol, gameState.pieces);
            const targetR = targetP ? targetP.row : Math.floor(decimalRow);
            const targetC = targetP ? targetP.col : Math.floor(decimalCol);
            window.sendAction('HANDLE_CLICK', { r: targetR, c: targetC });
            return;
        }

        const clickedPiece = C.getPieceAt(logicRow, logicCol, gameState.pieces);
        const allowedSelectTeam = isLocal
            ? gameState.currentTurn
            : (gameState.currentTurn === myTeam ? myTeam : null);

        if (allowedSelectTeam && clickedPiece && clickedPiece.team === allowedSelectTeam) {
            window.sendAction('SELECT_PIECE', { pieceId: clickedPiece.id });
            try { gameState.selectedPiece = clickedPiece; } catch (e) { }
            try { gameState.validMoves = calculateValidMoves(clickedPiece); } catch (e) { gameState.validMoves = []; }
            try { updateMobileDrawer(clickedPiece); } catch (e) { }
            try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
            return;
        }

        if (gameState.selectedPiece) {
            if (clickedPiece && clickedPiece.team === allowedSelectTeam) {
                window.sendAction('SELECT_PIECE', { pieceId: clickedPiece.id });
                try { gameState.selectedPiece = clickedPiece; } catch (e) { }
                try { gameState.validMoves = calculateValidMoves(clickedPiece); } catch (e) { }
                try { updateMobileDrawer(clickedPiece); } catch (e) { }
                try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
                return;
            } else {
                const targetRow = clickedPiece ? clickedPiece.row : logicRow;
                const targetCol = clickedPiece ? clickedPiece.col : logicCol;

                const dist = Math.hypot(targetRow - gameState.selectedPiece.row, targetCol - gameState.selectedPiece.col);
                const maxRadius = E.getPieceMoveRadius ? E.getPieceMoveRadius(gameState.selectedPiece, gameState) : (gameState.selectedPiece.agility || 2);

                const isTargetAlly = clickedPiece && clickedPiece.team === gameState.selectedPiece.team;

                if (dist <= maxRadius + 0.1 && !isTargetAlly) {
                    executeMove(gameState.selectedPiece, targetRow, targetCol);
                    deselectPiece();
                    try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
                    return;
                } else {
                    deselectPiece();
                    try { UI.drawLabels(gameState); UI.renderBoard(gameState); } catch (e) { }
                    return;
                }
            }
        }

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

        const peekName = document.getElementById('peek-name');
        const peekDesc = document.getElementById('peek-desc');
        const miniLog = document.getElementById('miniLog');

        if (peekName) peekName.textContent = 'Awaiting selection...';
        if (peekDesc) peekDesc.textContent = '';
        if (miniLog) miniLog.style.display = 'none';

        const nameEl = document.getElementById('mobile-ability-name');
        const descEl = document.getElementById('mobile-ability-description');

        if (nameEl) {
            nameEl.textContent = 'No Unit Selected';
            nameEl.style.color = '#fff';
            nameEl.style.fontSize = '15px';
            nameEl.style.marginBottom = '5px';
        }
        if (descEl) {
            descEl.innerHTML = '<div style="color:#aaa;font-size:12px;">Select a unit to see its actions.</div>';
            descEl.style.fontSize = '13px';
            descEl.style.lineHeight = '1.4';
        }

        const drawer = document.getElementById('mobileDrawer');
        if (drawer) { drawer.classList.remove('expanded'); }
    }
    if (canvas) {
        canvas.addEventListener('click', (ev) => { try { handleSelection(ev); } catch (e) { } });
        canvas.addEventListener('touchstart', (ev) => {
            try { ev.preventDefault(); } catch (e) { }
            const t = ev.touches && ev.touches[0];
            if (t) {
                try { handleSelection(t); } catch (e) { }
            }
        }, { passive: false });
    }

    if (canvas) {
        canvas.addEventListener('touchstart', (e) => {
            if (!gameState) return;
            if (!gameState.gameStarted) return;
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
            if (myTeam === 'ash') {
                row = C.ROWS - 1 - row;
                col = C.COLS - 1 - col;
            }

            clearTimeout(touchTimer);
            touchTimer = setTimeout(() => {
                const piece = C.getPieceAt(row, col, gameState.pieces);
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
                try { UI.clearVisualStates(); } catch (e) { }
                try { UI.clearMessageLog(); } catch (e) { }
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
        case 'GuardianSave':
            const savedPiece = gameState.pieces.find(p => p.id === animData.pieceId);
            Effects.spawnGuardianSaveEffect(savedPiece, gameState);
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
        case 'FrostfallBlessing':
            Effects.spawnFrostfallBlessingEffect(animData.targetR, animData.targetC, gameState);
            break;
        case 'FateLinkCast':
            const src = gameState.pieces.find(p => p.id === animData.sourceId);
            const dst = gameState.pieces.find(p => p.id === animData.targetId);
            Effects.spawnFateLinkCast(src, dst, gameState);
            break;
        case 'GlacialFracture':
            Effects.spawnGlacialFractureEffect(animData.targetR, animData.targetC, gameState);
            if (animData.wispId) {
                const wisp = gameState.pieces.find(p => p.id === animData.wispId);
                Effects.spawnSummonWispEffect(wisp.row, wisp.col, wisp, gameState);
            }
            break;
        case 'AColdFarewell':
            Effects.spawnAColdFarewellEffect(animData.r, animData.c, gameState);
            break;
        case 'ReignOfFire': {
            const tyrant = gameState.pieces.find(p => p.id === animData.pieceId);
            if (tyrant) Effects.spawnReignOfFireEffect(tyrant, animData.targetR, animData.targetC, gameState);
            break;
        }
        case 'DeathMeteor': {
            const meteor = gameState.pieces.find(p => p.id === animData.pieceId);
            if (meteor) Effects.spawnDeathMeteorEffect(meteor, gameState);
            break;
        }
    }
}

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

function calculateValidMoves(piece) {
    if (!piece || !gameState) return [];
    try {
        const utilMoves = E.getValidMoves ? E.getValidMoves(piece, gameState) : null;
        if (Array.isArray(utilMoves)) return utilMoves.map(m => ({ r: m.row ?? m.r, c: m.col ?? m.c, ...m }));
    } catch (e) { }

    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = piece.row + dr;
            const nc = piece.col + dc;
            if (C.inBounds(nr, nc) && !C.getPieceAt(nr, nc, gameState.pieces)) moves.push({ r: nr, c: nc });
        }
    }
    return moves;
}

function updateMobileDrawer(piece) {
    const drawer = document.getElementById('mobileDrawer');
    if (!drawer || !piece) return;

    try { gameState.selectedPiece = piece; } catch (e) { }
    try { gameState.validMoves = calculateValidMoves(piece); } catch (e) { gameState.validMoves = []; }

    drawer.classList.remove('hidden');
    drawer.classList.add('peek');

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

    const nameEl = document.getElementById('mobile-ability-name');
    const descEl = document.getElementById('mobile-ability-description');

    let abilities = [];
    if (Array.isArray(piece.abilities) && piece.abilities.length > 0) abilities = [...piece.abilities];
    else if (piece.ability) abilities = [{ ...piece.ability }];
    else if (piece.abilityName) abilities = [{ name: piece.abilityName, key: piece.abilityKey || piece.abilityKeyName }];

    if (piece.isVeteran && piece.secondaryAbilityKey) {
        const vetName = C.ABILITIES[piece.secondaryAbilityKey]?.name || 'Veteran Ability';

        abilities.push({
            name: vetName,
            key: piece.secondaryAbilityKey,
            cooldown: piece.secondaryAbilityCooldown
        });
    }

    try {
        if (nameEl) {
            nameEl.innerText = displayName;
            nameEl.style.color = '#fff';
            nameEl.style.fontSize = '15px';
            nameEl.style.marginBottom = '5px';
        }
        if (descEl) {
            const abilitiesHtml = UI.generateAbilitiesInfoString(piece);
            descEl.innerHTML = abilitiesHtml || '<div style="color:#aaa;font-size:12px;">No abilities available.</div>';
            descEl.style.fontSize = '13px';
            descEl.style.lineHeight = '1.4';
        }
    } catch (er) {
        if (nameEl) nameEl.innerText = displayName;
        if (descEl) descEl.innerHTML = 'Error loading abilities.';
    }
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
        'Siphon': 'Link units to transfer power or absorb debuffs.'
    };
    return descriptions[abilityKey] || 'Activate ability.';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    if (!drawer) return;
    drawer.classList.remove('expanded');
}

window.sendAction = function (actionType, data) {
    if (isLocal) {
        processLocalAction(actionType, data);
    } else {
        if (isWaitingForServer && (actionType === 'MOVE' || actionType === 'ABILITY' || actionType === 'HANDLE_CLICK' || actionType === 'SWITCH_TURN')) {
            return;
        }

        if (gameState && (actionType === 'MOVE' || actionType === 'ABILITY' || actionType === 'HANDLE_CLICK' || actionType === 'SWITCH_TURN')) {
            if (gameState.currentTurn !== myTeam) return;

            isWaitingForServer = true;
        }

        socket.emit('gameAction', { roomId, actionType, data });
    }
};

window.addEventListener('click', (e) => {
    if (!isLocal && isWaitingForServer) return;

    if (e.target === canvas) return;

    try {
        if (e.target && e.target.closest && e.target.closest('.ability-panel, .ui-container, button, .top-menu-btn, #left-column, #right-column, #mobile-top-bar, #disconnectModal, .mobile-drawer')) return;
    } catch (err) { }

    window.sendAction('SELECT_PIECE', { pieceId: null });
    try { gameState.selectedPiece = null; gameState.validMoves = []; } catch (e) { }
});

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
    closeMobileDrawer();
};

window.endTurn = function () {
    window.sendAction('SWITCH_TURN', {});
};

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
            if (mp) {
                const defender = C.getPieceAt(data.r, data.c, gs.pieces);
                if (defender && defender.team !== mp.team) {
                    try {
                        if (mp.key === 'ashMagmaShaper') {
                            UI.triggerObsidianProjectile(mp.id, data.r, data.c, gs);
                        } else {
                            UI.triggerLunge(mp.id, data.r, data.c);
                        }

                        const preview = E.previewDamage(mp, defender, gs);
                        if (preview.isFatal) {
                            UI.triggerPieceDissolve(defender);

                        }
                    } catch (e) { }
                }
                turnEnded = Logic.movePiece(mp, data.r, data.c, data.isHighway);
            }
            break;

        case 'ABILITY':
            const cp = find(data.pieceId);
            if (cp) {
                if (data.target) {
                    try {
                        UI.triggerPulse(cp.id);

                    } catch (e) { }
                    turnEnded = Logic.executeAbility(cp, data.target, data.abilityKey, gs);
                } else {
                    turnEnded = Logic.activateAbility(cp, data.abilityKey || data.unleashCostOrKey || 0);
                }
            }
            break;
        case 'HANDLE_CLICK': turnEnded = Logic.handleAbilityClick(data.r, data.c); break;
        case 'SWITCH_TURN': turnEnded = true; break;
        case 'ASCENSION_CHOICE': turnEnded = Logic.executeAscensionChoice(data.choice); break;
        case 'CANCEL_ASCENSION': Logic.cancelAscensionChoice(); break;
        case 'VENT_OVERLOAD':
            const vp = find(data.pieceId);
            if (vp) {
                try {
                    UI.triggerPulse(vp.id);

                } catch (e) { }
            }
            turnEnded = Logic.ventOverload(vp);
            break;
        case 'SACRIFICE': turnEnded = Logic.executeSacrifice(find(data.pieceId)); break;
        case 'RELEASE': turnEnded = Logic.executeRelease(find(data.pieceId)); break;
        case 'START_TETHER':
            const tp = find(data.pieceId);
            gs.abilityContext = { piece: tp, siphoner: tp, mode: data.mode, abilityKey: 'Tether' };
            Logic.setCurrentState(Logic.GameState.TETHER_TARGETING);
            Logic.emit(gs, { type: 'FLASH', message: `Select target for ${data.mode}`, team: tp.team });
            break;
        case 'RIFT_PULSE':
            const rp = find(data.pieceId);
            if (rp) {
                try {
                    UI.triggerPulse(rp.id);

                } catch (e) { }
            }
            turnEnded = Logic.executeRiftPulse(rp);
            break;
        case 'DESPAWN': Logic.despawnPiece(find(data.pieceId)); turnEnded = true; break;
        case 'TIMEOUT':
            Logic.endGame(data.team === 'snow' ? 'ash' : 'snow');
            break;
        case 'TOGGLE_TEST_MODE':
            gs.testMode = data.enabled;
            if (gs.testMode) {
                if (!gs.originalPieces) {
                    gs.originalPieces = JSON.parse(JSON.stringify(gs.pieces));
                }
                gs.pieces = gs.pieces.filter(p => p.key === 'snowFrostLord' || p.key === 'ashAshTyrant' || p.key === 'ashMagmaShaper');
            } else {
                if (gs.originalPieces) {
                    gs.pieces = JSON.parse(JSON.stringify(gs.originalPieces));
                    delete gs.originalPieces;
                }
            }
            break;
    }
    try { E.updateBoardMap(gs); } catch (e) { }
    try { UI.renderBoard(gs); UI.drawLabels(gs); } catch (e) { }

    if (turnEnded) {
        const ascensionTriggered = Logic.checkAscensionReady();
        if (!ascensionTriggered && isLocal) {
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
    if (isLocal && vsAI) setTimeout(checkAITurn, 0);
}

function drawLeyLines(ctx, gs) {
}
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
        const cx = m.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const cy = m.row * C.CELL_SIZE + C.CELL_SIZE / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, C.CELL_SIZE / 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    const cpx = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const cpy = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    ctx.beginPath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.arc(cpx, cpy, C.CELL_SIZE / 2.1, 0, Math.PI * 2);
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
let lastAnimTime = performance.now();
function animationLoop(time) {
    if (!time) time = performance.now();
    let dt = time - lastAnimTime;
    if (dt > 100) dt = 16.67; // Cap dt to prevent massive jumps if tab is inactive
    lastAnimTime = time;

    if (!gameState) { requestAnimationFrame(animationLoop); return; }

    try { UI.updateVisualStates(gameState, dt); } catch (e) { }

    ctx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);

    ctx.save();
    try { UI.applyScreenshake(ctx); } catch (e) { }

    // Draw the background image directly on the main canvas (unrotated)
    const bgKey = (gameState.playerTeam === 'ash') ? 'gameBackgroundAsh' : 'gameBackgroundSnow';
    const backgroundImg = gameState.boardImgs?.[bgKey];
    if (backgroundImg?.complete) {
        ctx.drawImage(backgroundImg, 0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    } else {
        const bgGrad = ctx.createRadialGradient(
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
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    }

    let didTransform = false;
    if (gameState.playerTeam === 'ash') {
        ctx.save();
        ctx.translate(C.CANVAS_SIZE, C.CANVAS_SIZE);
        ctx.rotate(Math.PI);
        didTransform = true;
    }

    const bgCanvas = UI.getBoardCanvas();
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    try { drawLeyLines(ctx, gameState); } catch (e) { /* non-fatal */ }
    try { drawGhostOverlay(ctx, gameState); } catch (e) { /* non-fatal */ }
    try {
        if (gameState && gameState.selectedPiece) {
            const piece = gameState.selectedPiece;
            const moveRadius = E.getPieceMoveRadius(piece);
            const vis = UI.getPieceVisualState(piece);
            const cx = vis.x + C.CELL_SIZE / 2 + (vis.offsetX || 0) + (vis.lungeDx || 0);
            const cy = vis.y + C.CELL_SIZE / 2 + (vis.offsetY || 0) + (vis.lungeDy || 0);
            const color = piece.team === 'snow' ? '#00BFFF' : '#FF4500';
            const radiusPx = moveRadius * C.CELL_SIZE;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const fillGrad = ctx.createRadialGradient(cx, cy, radiusPx * 0.4, cx, cy, radiusPx);
            if (piece.team === 'snow') {
                fillGrad.addColorStop(0, 'rgba(0, 191, 255, 0.08)');
                fillGrad.addColorStop(0.8, 'rgba(0, 191, 255, 0.03)');
                fillGrad.addColorStop(1, 'rgba(0, 191, 255, 0.0)');
            } else {
                fillGrad.addColorStop(0, 'rgba(255, 69, 0, 0.08)');
                fillGrad.addColorStop(0.8, 'rgba(255, 69, 0, 0.03)');
                fillGrad.addColorStop(1, 'rgba(255, 69, 0, 0.0)');
            }
            ctx.beginPath();
            ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
            ctx.fillStyle = fillGrad;
            ctx.fill();

            const pulse = 10 + Math.sin(Date.now() / 250) * 4; // breathing shadow
            ctx.strokeStyle = piece.team === 'snow' ? 'rgba(0, 191, 255, 0.85)' : 'rgba(255, 69, 0, 0.85)';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = pulse;
            ctx.beginPath();
            ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = piece.team === 'snow' ? 'rgba(0, 191, 255, 0.35)' : 'rgba(255, 69, 0, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 8]);
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(cx, cy, radiusPx + 6, 0, Math.PI * 2);
            ctx.stroke();

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
    gameState.lowDetail = visualLoad > 450;

    if (gameState.lowDetail) {
        if (gameState.battleParticles && gameState.battleParticles.length > 200) gameState.battleParticles.length = 200;
        if (gameState.snowParticles && gameState.snowParticles.length > 80) gameState.snowParticles.length = 80;
        if (gameState.ashParticles && gameState.ashParticles.length > 80) gameState.ashParticles.length = 80;
    }

    if (Effects.drawParticles) Effects.drawParticles(gameState);
    if (Effects.drawGroundEffectParticles) Effects.drawGroundEffectParticles(gameState);
    if (Effects.drawSiphonParticles) Effects.drawSiphonParticles(gameState);
    if (Effects.drawProjectiles) Effects.drawProjectiles(gameState);

    if (Effects.drawHelpFromAboveFog) Effects.drawHelpFromAboveFog(ctx, gameState);

    if (gameState.pieces) {
        gameState.pieces.forEach(p => {
            if (p.id !== gameState.trappedPiece) UI.drawPiece(p, ctx, gameState);
        });
    }

    if (Effects.drawHelpFromAboveVapors) Effects.drawHelpFromAboveVapors(ctx, gameState);

    try { UI.drawDyingPieces(ctx, gameState); } catch (e) { }

    if (Effects.drawFrenziedDashAnimations) Effects.drawFrenziedDashAnimations(gameState);
    if (Effects.drawSummonWispAnimations) Effects.drawSummonWispAnimations(gameState);
    if (Effects.drawLavaGlobAnimations) Effects.drawLavaGlobAnimations(gameState);
    if (Effects.drawTrapDeployments) Effects.drawTrapDeployments(gameState);
    if (Effects.drawTrapTriggerAnimations) Effects.drawTrapTriggerAnimations(gameState);
    if (Effects.drawFrigidPathAnimations) Effects.drawFrigidPathAnimations(gameState);
    if (Effects.drawGlacialWallAnimations) Effects.drawGlacialWallAnimations(gameState);
    if (Effects.drawPummelKnockbackAnimations) Effects.drawPummelKnockbackAnimations(gameState);
    if (Effects.drawScorchedRetreatAnimations) Effects.drawScorchedRetreatAnimations(gameState, ctx, loadedImages);
    if (Effects.drawVentAnimations) Effects.drawVentAnimations(gameState);
    if (Effects.drawGlacialFractureAnimations) Effects.drawGlacialFractureAnimations(gameState);
    if (Effects.drawAColdFarewellAnimations) Effects.drawAColdFarewellAnimations(gameState);
    if (Effects.drawFrostfallBlessingAnimations) Effects.drawFrostfallBlessingAnimations(gameState);
    if (Effects.drawGuardianSaveAnimations) Effects.drawGuardianSaveAnimations(ctx, gameState);
    if (Effects.drawFateLinkAnimations) Effects.drawFateLinkAnimations(ctx, gameState);
    if (Effects.drawReignOfFireAnimations) Effects.drawReignOfFireAnimations(gameState);
    // Death Meteor eclipse must be drawn after pieces (it overlays the full canvas)
    if (Effects.drawDeathMeteorAnimations) Effects.drawDeathMeteorAnimations(gameState);
    if (Effects.drawShrineEffects) Effects.drawShrineEffects(gameState);
    UI.drawLastMoveIndicator(gameState);

    if (gameState.selectedPiece && (isLocal || gameState.currentTurn === myTeam)) {
        UI.drawSelection(gameState);
        if (gameState.abilityContext) UI.drawAbilityHighlights(gameState);
    }
    if (didTransform) ctx.restore();

    ctx.restore();

    if (gameState && gameState.timers) {
        const sTimer = document.getElementById('miniTimerSnow');
        const aTimer = document.getElementById('miniTimerAsh');
        const formatTime = seconds => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        if (sTimer) {
            const sStr = formatTime(gameState.timers.snow);
            if (sTimer.textContent !== sStr) sTimer.textContent = sStr;
        }
        if (aTimer) {
            const aStr = formatTime(gameState.timers.ash);
            if (aTimer.textContent !== aStr) aTimer.textContent = aStr;
        }
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

function scaleGame() {
    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;

    if (window.innerWidth <= 1024) {
        wrapper.style.transform = 'none';
        return;
    }

    const baseWidth = 1460;
    const baseHeight = 1020;
    const padding = 20;

    const winWidth = window.innerWidth - padding;
    const winHeight = window.innerHeight - padding;

    let scale = Math.min(winWidth / baseWidth, winHeight / baseHeight);
    if (scale > 1) scale = 1;

    wrapper.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', scaleGame);
window.addEventListener('DOMContentLoaded', scaleGame);
scaleGame();

let lastDebugKey = null;
let lastDebugKeyTime = 0;

// Keydown listener for developer testing of the leader visual effects (f+1/2 for Frost Lord, t+1/2 for Ash Tyrant)
window.addEventListener('keydown', e => {
    if (!gameState?.pieces) return;

    const key = e.key.toLowerCase();
    const now = Date.now();

    if (key === 'f' || key === 't') {
        lastDebugKey = key;
        lastDebugKeyTime = now;
        return;
    }

    if ((key === '1' || key === '2') && lastDebugKey && (now - lastDebugKeyTime < 2000)) {
        const prefix = lastDebugKey;
        lastDebugKey = null; // consume

        if (prefix === 'f') {
            const frostLord = gameState.pieces.find(p => p.key === 'snowFrostLord');
            if (frostLord) {
                if (key === '1') {
                    // Frost Lord active visuals (Frostfall Blessing)
                    Effects.spawnFrostfallBlessingEffect(frostLord.row, frostLord.col, gameState);
                } else {
                    // Frost Lord passive visuals (Guardian Save / Help From Above)
                    frostLord.hasHelpFromAboveActive = true;
                    frostLord.helpFromAboveActiveTurns = 4;
                    Effects.spawnGuardianSaveEffect(frostLord, gameState);
                }
            }
        } else if (prefix === 't') {
            const tyrant = gameState.pieces.find(p => p.key === 'ashAshTyrant');
            if (tyrant) {
                if (key === '1') {
                    // Ash Tyrant active visuals (Reign of Fire)
                    const targetR = tyrant.row;
                    const targetC = Math.min(7, tyrant.col + 2);
                    Effects.spawnReignOfFireEffect(tyrant, targetR, targetC, gameState);

                    // Add temporary strength boost for local test visual feedback
                    const radius = 2;
                    gameState.pieces.forEach(p => {
                        const dist = Math.hypot(p.row - targetR, p.col - targetC);
                        if (dist <= radius && p.team === tyrant.team) {
                            gameState.temporaryBoosts = gameState.temporaryBoosts || [];
                            if (!gameState.temporaryBoosts.some(b => b.pieceId === p.id && b.name === "ReignOfFireStr")) {
                                gameState.temporaryBoosts.push({
                                    pieceId: p.id,
                                    duration: 3,
                                    amount: 2,
                                    name: "ReignOfFireStr"
                                });
                            }
                        }
                    });
                } else {
                    // Ash Tyrant passive visuals (Death Meteor)
                    tyrant.deathMeteorCooldown = 15;
                    tyrant.hasTriggeredDeathMeteor = true;
                    Effects.spawnDeathMeteorEffect(tyrant, gameState);
                }
            }
        }
        return;
    }
});