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

    // Scramble title (respects prefers-reduced-motion)
    (function scrambleTitle() {
        const el = $('main-title');
        if (!el) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.opacity = '1'; return; }
        const finalTitle = (el.textContent || 'MYTHIC TERRITORIES').toUpperCase().trim();
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+{}|:<>?';
        const duration = 30, interval = 50; let frame = 0;
        el.style.opacity = '1';
        const tick = () => {
            if (frame > duration) { el.textContent = finalTitle; return; }
            const resolved = Math.floor(finalTitle.length * (frame / duration));
            el.textContent = finalTitle.split('').map((ch, i) => i < resolved ? ch : (ch === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0])).join('');
            frame++; setTimeout(tick, interval);
        };
        setTimeout(tick, 300);
    })();
});