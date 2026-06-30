document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const gameModesOverlay = document.getElementById('gameModesOverlay');
    const closeModesBtn = document.getElementById('closeModesBtn');
    const onlineRealmBtn = document.getElementById('onlineRealmBtn');
    const multiplayerModal = document.getElementById('multiplayerModal');
    const closeMultiplayerBtn = document.getElementById('closeMultiplayerBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const localPlayBtn = document.getElementById('localPlayBtn');
    const ancientTrialsBtn = document.getElementById('ancientTrialsBtn');

    // Faction Selection Modal Elements
    const factionSelectionOverlay = document.getElementById('factionSelectionOverlay');
    const selectSnowBtn = document.getElementById('selectSnowBtn');
    const selectAshBtn = document.getElementById('selectAshBtn');
    const factionCancelBtn = document.getElementById('factionCancelBtn');
    const roomStatusDisplay = document.getElementById('roomStatusDisplay');

    let currentMode = null; // 'ai' or 'online'
    let currentRoomId = null;
    let menuSocket = null;
    let mySelectedFaction = null;

    function updateFactionUI(players = []) {
        if (currentMode === 'ai') {
            selectSnowBtn.disabled = false;
            selectSnowBtn.textContent = 'SELECT FACTION';
            selectAshBtn.disabled = false;
            selectAshBtn.textContent = 'SELECT FACTION';
            return;
        }

        // Online Realm Faction UI
        selectSnowBtn.disabled = false;
        selectSnowBtn.textContent = 'SELECT FACTION';
        selectSnowBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        selectAshBtn.disabled = false;
        selectAshBtn.textContent = 'SELECT FACTION';
        selectAshBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        const storedPlayerId = sessionStorage.getItem('mythic_playerId');

        players.forEach(p => {
            if (p.team === 'snow') {
                if (p.id === storedPlayerId || p.socketId === menuSocket?.id) {
                    mySelectedFaction = 'snow';
                } else {
                    selectSnowBtn.textContent = 'OCCUPIED';
                    selectSnowBtn.disabled = true;
                    selectSnowBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
            if (p.team === 'ash') {
                if (p.id === storedPlayerId || p.socketId === menuSocket?.id) {
                    mySelectedFaction = 'ash';
                } else {
                    selectAshBtn.textContent = 'OCCUPIED';
                    selectAshBtn.disabled = true;
                    selectAshBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        });

        // Apply local selection locks
        if (mySelectedFaction === 'snow') {
            selectSnowBtn.textContent = 'YOUR SELECTION';
            selectSnowBtn.disabled = true;
            selectSnowBtn.classList.add('opacity-50', 'cursor-not-allowed');

            if (selectAshBtn.textContent !== 'OCCUPIED') {
                selectAshBtn.disabled = true;
                selectAshBtn.textContent = 'LOCKED';
                selectAshBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else if (mySelectedFaction === 'ash') {
            selectAshBtn.textContent = 'YOUR SELECTION';
            selectAshBtn.disabled = true;
            selectAshBtn.classList.add('opacity-50', 'cursor-not-allowed');

            if (selectSnowBtn.textContent !== 'OCCUPIED') {
                selectSnowBtn.disabled = true;
                selectSnowBtn.textContent = 'LOCKED';
                selectSnowBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    function showFactionSelection(mode, roomId = null) {
        currentMode = mode;
        currentRoomId = roomId;
        mySelectedFaction = null;

        if (roomStatusDisplay) {
            if (roomId) {
                roomStatusDisplay.textContent = `ROOM CODE: ${roomId}`;
                roomStatusDisplay.style.display = 'block';
            } else {
                roomStatusDisplay.style.display = 'none';
            }
        }

        gameModesOverlay?.classList.remove('active');
        multiplayerModal?.classList.remove('active');
        factionSelectionOverlay?.classList.add('active');

        updateFactionUI([]);
    }

    // Navigation logic
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            gameModesOverlay?.classList.add('active');
        });
    }

    if (closeModesBtn) {
        closeModesBtn.addEventListener('click', () => {
            gameModesOverlay?.classList.remove('active');
        });
    }

    // Pass & Play -> Redirects immediately
    if (localPlayBtn) {
        localPlayBtn.addEventListener('click', () => {
            window.location.href = 'game.html?mode=local';
        });
    }

    // Ancient Trials -> Opens Faction Selection locally
    if (ancientTrialsBtn) {
        ancientTrialsBtn.addEventListener('click', () => {
            showFactionSelection('ai');
        });
    }

    // Online Realm -> Multiplayer Modal
    if (onlineRealmBtn) {
        onlineRealmBtn.addEventListener('click', () => {
            multiplayerModal?.classList.add('active');
            setTimeout(() => roomCodeInput?.focus(), 50);
        });
    }

    if (closeMultiplayerBtn) {
        closeMultiplayerBtn.addEventListener('click', () => {
            multiplayerModal?.classList.remove('active');
            if (roomCodeInput) roomCodeInput.value = '';
        });
    }

    // Join/Create Room in Multiplayer
    const handleJoinRoom = () => {
        if (!roomCodeInput) return;
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code.length >= 3) {
            if (menuSocket) {
                menuSocket.disconnect();
            }

            let playerId = sessionStorage.getItem('mythic_playerId');
            if (!playerId) {
                playerId = 'p_' + Math.random().toString(36).substr(2, 9);
                sessionStorage.setItem('mythic_playerId', playerId);
            }

            if (typeof io !== 'undefined') {
                const devPorts = ['5500', '5501', '5173', '8080', '8081', '3001'];
                const isDevServer = devPorts.includes(window.location.port);
                const connectionUrl = (window.location.protocol === 'file:' || isDevServer) ? 'http://localhost:3000' : '';
                menuSocket = io(connectionUrl);
                menuSocket.on('connect', () => {
                    menuSocket.emit('joinRoom', { roomId: code, playerId });
                });

                menuSocket.on('init', (data) => {
                    showFactionSelection('online', code);
                    updateFactionUI(data.players || []);
                });

                menuSocket.on('roomUpdate', (data) => {
                    updateFactionUI(data.players || []);
                });

                menuSocket.on('playerJoined', (data) => {
                    updateFactionUI(data.players || []);
                });

                menuSocket.on('playerLeft', (data) => {
                    // Handled by roomUpdate
                });

                menuSocket.on('stateUpdate', (data) => {
                    const gs = data ? (data.state || data.diff) : null;
                    if (gs && gs.gameStarted) {
                        window.location.href = `game.html?room=${encodeURIComponent(code)}&team=${encodeURIComponent(mySelectedFaction)}`;
                    }
                });

                menuSocket.on('error', (msg) => {
                    alert(msg);
                });
            } else {
                alert('Socket.io client not loaded.');
                return;
            }
        } else {
            alert('Room code must be at least 3 characters.');
        }
    };

    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', handleJoinRoom);
    }
    if (roomCodeInput) {
        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleJoinRoom();
        });
    }

    // Faction Selection Button Clicks
    if (selectSnowBtn) {
        selectSnowBtn.onclick = () => {
            if (currentMode === 'ai') {
                window.location.href = 'game.html?mode=local&ai=1&team=snow';
            } else if (currentMode === 'online' && menuSocket) {
                mySelectedFaction = 'snow';
                menuSocket.emit('selectFaction', { roomId: currentRoomId, faction: 'snow' });
                updateFactionUI();
            }
        };
    }

    if (selectAshBtn) {
        selectAshBtn.onclick = () => {
            if (currentMode === 'ai') {
                window.location.href = 'game.html?mode=local&ai=1&team=ash';
            } else if (currentMode === 'online' && menuSocket) {
                mySelectedFaction = 'ash';
                menuSocket.emit('selectFaction', { roomId: currentRoomId, faction: 'ash' });
                updateFactionUI();
            }
        };
    }

    if (factionCancelBtn) {
        factionCancelBtn.onclick = () => {
            if (menuSocket) {
                const playerId = sessionStorage.getItem('mythic_playerId');
                menuSocket.emit('leaveRoom', { roomId: currentRoomId, playerId });
                menuSocket.disconnect();
                menuSocket = null;
            }
            factionSelectionOverlay?.classList.remove('active');
            if (currentMode === 'online') {
                multiplayerModal?.classList.add('active');
            } else {
                gameModesOverlay?.classList.add('active');
            }
        };
    }

    // Close overlays on clicking background
    if (gameModesOverlay) {
        gameModesOverlay.addEventListener('click', (e) => {
            if (e.target === gameModesOverlay) gameModesOverlay.classList.remove('active');
        });
    }
    if (multiplayerModal) {
        multiplayerModal.addEventListener('click', (e) => {
            if (e.target === multiplayerModal) multiplayerModal.classList.remove('active');
        });
    }
});