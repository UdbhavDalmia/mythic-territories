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
                const connectionUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
                menuSocket = io(connectionUrl);
                menuSocket.on('connect', () => {
                    menuSocket.emit('joinRoom', { roomId: code, playerId });
                });

                menuSocket.on('init', (data) => {
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

            showFactionSelection('online', code);
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

    // Parallax
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) - 0.5;
        const y = (e.clientY / window.innerHeight) - 0.5;
        const bg = document.querySelector('div[style*="background-image"]');
        if (bg) {
            bg.style.transform = `scale(1.1) translate(${x * 30}px, ${y * 30}px)`;
        }
    });

    // Particle Shader Implementation
    const canvas = document.getElementById('particleCanvas');
    if (canvas) {
        const gl = canvas.getContext('webgl');
        if (gl) {
            const vertexShaderSource = `
                attribute vec2 a_position;
                varying vec2 v_texCoord;
                void main() {
                    v_texCoord = a_position * 0.5 + 0.5;
                    v_texCoord.y = 1.0 - v_texCoord.y;
                    gl_Position = vec4(a_position, 0.0, 1.0);
                }
            `;

            const fragmentShaderSource = `
                precision highp float;
                varying vec2 v_texCoord;
                uniform float u_time;
                uniform vec2 u_resolution;

                float noise(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                void main() {
                    vec2 uv = v_texCoord;
                    vec3 color = vec3(0.0);
                    
                    float snow = 0.0;
                    for(float i = 1.0; i < 5.0; i++) {
                        vec2 snowUV = uv * (2.0 + i);
                        snowUV.y += u_time * (0.2 / i);
                        snowUV.x += sin(u_time * 0.5 + i) * 0.1;
                        float n = noise(floor(snowUV));
                        if(n > 0.98 && uv.x < 0.6) {
                            float dist = length(fract(snowUV) - 0.5);
                            snow += smoothstep(0.1, 0.0, dist) * (1.0 - uv.x);
                        }
                    }
                    
                    float embers = 0.0;
                    for(float i = 1.0; i < 5.0; i++) {
                        vec2 emberUV = uv * (3.0 + i);
                        emberUV.y -= u_time * (0.3 / i);
                        emberUV.x += cos(u_time * 0.4 + i) * 0.1;
                        float n = noise(floor(emberUV));
                        if(n > 0.97 && uv.x > 0.4) {
                            float dist = length(fract(emberUV) - 0.5);
                            embers += smoothstep(0.15, 0.0, dist) * uv.x;
                        }
                    }
                    
                    vec3 snowColor = vec3(0.8, 0.9, 1.0) * snow;
                    vec3 emberColor = vec3(1.0, 0.4, 0.1) * embers * (0.8 + 0.2 * sin(u_time * 2.0));
                    
                    color = snowColor + emberColor;
                    gl_FragColor = vec4(color, color.r + color.g + color.b);
                }
            `;

            function createShader(gl, type, source) {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                return shader;
            }

            const program = gl.createProgram();
            gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
            gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
            gl.linkProgram(program);

            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

            const positionLocation = gl.getAttribLocation(program, "a_position");
            const timeLocation = gl.getUniformLocation(program, "u_time");

            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }

            window.addEventListener('resize', resize);
            resize();

            function render(time) {
                gl.useProgram(program);
                gl.enableVertexAttribArray(positionLocation);
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
                gl.uniform1f(timeLocation, time * 0.001);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                requestAnimationFrame(render);
            }
            requestAnimationFrame(render);
        }
    }
});