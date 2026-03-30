// Function to handle the Scramble Reveal Animation
function startScrambleAnimation() {
    const titleElement = document.getElementById('main-title');
    if (!titleElement) return;

    // Use the actual text from the DOM element, but set it uppercase for consistency
    const finalTitle = "MYTHIC TERRITORIES"; 
    const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+{}|:<>?';
    let frame = 0;
    const duration = 30; // Total frames for the scramble to resolve
    const interval = 50; // ms per frame

    // 1. Set element opacity to 1 so we can see the effect
    titleElement.style.opacity = '1';

    function scrambleText() {
        if (frame > duration) {
            titleElement.textContent = finalTitle;
            return;
        }

        let newText = '';
        for (let i = 0; i < finalTitle.length; i++) {
            // Determine the resolution threshold for the current frame
            const resolveThreshold = Math.floor(finalTitle.length * (frame / duration));

            if (i < resolveThreshold) {
                // Resolved letters
                newText += finalTitle[i];
            } else if (i < finalTitle.length) {
                // Scrambled letters (only use scramble chars where the final letter isn't a space)
                if (finalTitle[i] === ' ') {
                    newText += ' ';
                } else {
                    newText += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
                }
            }
        }

        titleElement.textContent = newText;
        frame++;

        setTimeout(scrambleText, interval);
    }

    // Delay start of animation slightly after menu loads
    setTimeout(scrambleText, 300); 
}

document.addEventListener('DOMContentLoaded', () => {
    const teamSnow = document.getElementById('team-snow');
    const teamAsh = document.getElementById('team-ash');
    const playHumanBtn = document.getElementById('play-human-btn');
    const playAiBtn = document.getElementById('play-ai-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const notesBtn = document.getElementById('notes-btn');
    let selectedTeam = null;

    // Start the animation immediately
    startScrambleAnimation();

    const enableStartButtons = () => {
        playHumanBtn.disabled = false;
        playAiBtn.disabled = false;
    };

    teamSnow.addEventListener('click', () => {
        selectedTeam = 'snow';
        teamSnow.classList.add('selected');
        teamAsh.classList.remove('selected');
        enableStartButtons();
    });

    teamAsh.addEventListener('click', () => {
        selectedTeam = 'ash';
        teamAsh.classList.add('selected');
        teamSnow.classList.remove('selected');
        enableStartButtons();
    });

    playHumanBtn.addEventListener('click', () => {
        if (selectedTeam) window.location.href = `game.html?team=${selectedTeam}&mode=human`;
    });

    playAiBtn.addEventListener('click', () => {
        if (selectedTeam) window.location.href = `game.html?team=${selectedTeam}&mode=ai`;
    });

    rulesBtn.addEventListener('click', () => window.location.href = 'rules.html');
    notesBtn.addEventListener('click', () => window.location.href = 'notes.html');

    // --- Background Particle Logic (Kept for completeness) ---
    const canvas = document.getElementById('background-effects-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let snowParticles = [];
    let ashParticles = [];
    const SNOW_PARTICLES_COUNT = 75;
    const ASH_PARTICLES_COUNT = 75;

    function createSnowParticle() {
        return {
            x: Math.random() * (width / 2),
            y: Math.random() * height - height,
            radius: Math.random() * 2 + 1,
            alpha: Math.random() * 0.5 + 0.3,
            vx: (Math.random() - 0.5) * 0.5,
            vy: Math.random() * 0.5 + 0.2
        };
    }

    function createAshParticle() {
        const lavaX = (width / 2) + (Math.random() * (width / 2));
        const lavaY = height - (Math.random() * (height / 3));
        
        return {
            x: lavaX,
            y: lavaY,
            radius: Math.random() * 2.5 + 1,
            alpha: 1,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -(Math.random() * 1.0 + 0.5),
            life: 1.0
        };
    }

    function initParticles() {
        snowParticles = [];
        ashParticles = [];
        for (let i = 0; i < SNOW_PARTICLES_COUNT; i++) {
            snowParticles.push(createSnowParticle());
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        for (let i = snowParticles.length - 1; i >= 0; i--) {
            const p = snowParticles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.y > height + p.radius) {
                snowParticles[i] = createSnowParticle();
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150, 200, 255, ${p.alpha})`;
            ctx.fill();
        }

        if (Math.random() > 0.7) {
            if (ashParticles.length < ASH_PARTICLES_COUNT) {
                ashParticles.push(createAshParticle());
            }
        }

        for (let i = ashParticles.length - 1; i >= 0; i--) {
            const p = ashParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;

            if (p.life <= 0) {
                ashParticles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 100, 80, ${p.alpha * p.life})`;
            ctx.fill();
        }
    }

    function animationLoop() {
        draw();
        requestAnimationFrame(animationLoop);
    }

    window.addEventListener('resize', () => {
        width = (canvas.width = window.innerWidth);
        height = (canvas.height = window.innerHeight);
        initParticles();
    });

    initParticles();
    animationLoop();
});