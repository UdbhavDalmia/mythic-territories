document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const localPlayBtn = $('localPlayBtn');
    const multiplayerBtn = $('multiplayerBtn');
    const rulesBtn = $('rules-btn');
    const notesBtn = $('notes-btn');
    const roomModal = $('roomModal');
    const roomCodeInput = $('roomCodeInput');
    const joinRoomBtn = $('joinRoomBtn');
    const closeModalBtn = $('closeModalBtn');

    // Navigation
    rulesBtn?.addEventListener('click', () => location.href = 'rules.html');
    notesBtn?.addEventListener('click', () => location.href = 'notes.html');
    localPlayBtn?.addEventListener('click', () => location.href = 'game.html?mode=local');

    // Multiplayer modal
    multiplayerBtn?.addEventListener('click', () => {
        roomModal?.classList.remove('hidden');
        setTimeout(() => roomCodeInput?.focus(), 50);
    });
    closeModalBtn?.addEventListener('click', () => {
        roomModal?.classList.add('hidden');
        if (roomCodeInput) roomCodeInput.value = '';
    });

    // Connect
    const connectToRoom = () => {
        const code = (roomCodeInput?.value || '').trim().toUpperCase();
        if (code.length >= 3) location.href = `game.html?room=${encodeURIComponent(code)}`;
        else alert('Room code must be at least 3 characters.');
    };
    joinRoomBtn?.addEventListener('click', connectToRoom);
    roomCodeInput?.addEventListener('keypress', e => { if (e.key === 'Enter') connectToRoom(); });

    // --- Lightweight Particle System ---
    const canvas = $('background-effects-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let width, height;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor(x, y, type) {
                this.x = x; this.y = y; this.type = type;
                this.size = type === 'snow' ? (Math.random() * 2 + 1) * 1.3 : (Math.random() * 2 + 0.5) * 1.3;
                this.speedX = (Math.random() - 0.5) * 0.8;
                this.speedY = type === 'snow' ? Math.random() * 0.5 + 0.2 : (Math.random() * -0.8 - 0.2);
                this.life = 1.0;
                this.decay = Math.random() * 0.001 + 0.0015;
            }
            update() {
                this.x += this.speedX; this.y += this.speedY;
                this.life -= this.decay;
            }
            draw() {
                const alpha = this.life;
                ctx.fillStyle = this.type === 'snow' ? `rgba(0, 119, 255, ${alpha})` : `rgba(255, 46, 0, ${alpha})`;
                ctx.beginPath();
                if (this.type === 'snow') ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                else ctx.rect(this.x, this.y, this.size, this.size);
                ctx.fill();
            }
        }

        const spawn = (x, y, count = 1) => {
            const type = x < width / 2 ? 'snow' : 'ash';
            for (let i = 0; i < count; i++) particles.push(new Particle(x, y, type));
        };

        let lastSpawn = 0;
        window.addEventListener('mousemove', e => {
            const now = performance.now();
            if (now - lastSpawn > 50 && Math.random() > 0.4) {
                spawn(e.clientX, e.clientY);
                lastSpawn = now;
            }
        });
        window.addEventListener('click', e => spawn(e.clientX, e.clientY, 10));

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
                if (particles[i].life <= 0) { particles.splice(i, 1); i--; }
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
});