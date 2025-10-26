import * as C from './constants.js';

let ctx;
let effectsCtx;

export function initEffects(mainCtx, effectsContext) {
    ctx = mainCtx;
    effectsCtx = effectsContext;
}

export function initParticles(gameState) {
    const createSet = (count, territory, team) =>
        Array.from({ length: count }, () => {
            const [r, c] = Array.from(territory)[
                Math.floor(Math.random() * territory.size)
            ].split(',').map(Number);

            return {
                x: c * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
                y: r * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
                radius: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.3,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (team === 'snow' ? 1 : -1) * (Math.random() * 0.5 + 0.2),
                team
            };
        });

    gameState.snowParticles = createSet(125, gameState.snowTerritory, 'snow');
    gameState.ashParticles = createSet(125, gameState.ashTerritory, 'ash');
    gameState.battleParticles = [];
}

export function drawParticles(gameState) {
    const drawSet = (arr, color, territory) =>
        arr.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            const currentTerritory = `${Math.floor(p.y / C.CELL_SIZE)},${Math.floor(p.x / C.CELL_SIZE)}`;
            if (!territory.has(currentTerritory)) {
                const [r, c] = Array.from(territory)[Math.floor(Math.random() * territory.size)].split(',').map(Number);
                p.x = c * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
                p.y = r * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
            }

            if (p.x < 0) p.x = C.CANVAS_SIZE;
            if (p.x > C.CANVAS_SIZE) p.x = 0;
            if (p.y < 0) p.y = C.CANVAS_SIZE;
            if (p.y > C.CANVAS_SIZE) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color},${p.alpha})`;
            ctx.fill();
        });

    drawSet(gameState.snowParticles, '150,200,255', gameState.snowTerritory);
    drawSet(gameState.ashParticles, '250,100,80', gameState.ashTerritory);

    for (let i = gameState.battleParticles.length - 1; i >= 0; i--) {
        const p = gameState.battleParticles[i];
        p.alpha -= 0.03;
        if (p.alpha <= 0) {
            gameState.battleParticles.splice(i, 1);
            continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();
    }
}

export function spawnBattleParticles(attacker, defender, gameState) {
    const color = attacker.team === 'snow' ? '150,200,255' : '255,100,80';
    const startX = attacker.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const startY = attacker.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    const endX = defender.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const endY = defender.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    const angle = Math.atan2(endY - startY, endX - startX);

    for (let i = 0; i < 15; i++) {
        const speed = Math.random() * 2 + 1;
        gameState.battleParticles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5),
            vy: Math.sin(angle) * speed + (Math.random() - 0.5),
            alpha: 1,
            radius: Math.random() * 3 + 2,
            color
        });
    }
}

export function drawRifts(gameState) {
    effectsCtx.clearRect(0, 0, C.CANVAS_SIZE, C.CANVAS_SIZE);
    C.SHAPES.riftAreas.forEach(rift => {
        rift.pulsePhase += 0.06;
        const pulse = 0.25 + 0.08 * Math.sin(rift.pulsePhase);
        rift.cells.forEach(([r, c]) => {
            effectsCtx.fillStyle = `rgba(190,120,255,${pulse * 0.5})`;
            effectsCtx.fillRect(c * C.CELL_SIZE, r * C.CELL_SIZE, C.CELL_SIZE, C.CELL_SIZE);
        });
    });
    ctx.drawImage(effectsCtx.canvas, 0, 0);
}

export function updateShrineParticles(chargeLevel, gameState) {
    gameState.shrineParticles = [];
    const numParticles = chargeLevel * 75;
    const radius = C.CELL_SIZE * 1.0 + chargeLevel * 0.15 * C.CELL_SIZE;
    for (let i = 0; i < numParticles; i++) {
        const angle = (i / (numParticles * 0.7)) * Math.PI * 2;
        gameState.shrineParticles.push({
            angle,
            radius: radius + (Math.random() - 0.5) * 20,
            size: Math.random() * 3 + 1.5,
            speed: (0.005 + Math.random() * 0.005) * (1 + chargeLevel * 0.5)
        });
    }
}

export function triggerShrineOverloadEffects(gameState, isNova = false) {
    updateShrineParticles(3, gameState);
    if (!isNova) return;

    for (let i = 0; i < 300; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 10;
        gameState.battleParticles.push({
            x: 5 * C.CELL_SIZE,
            y: 5 * C.CELL_SIZE,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            radius: Math.random() * 4 + 2,
            color: '220,20,60'
        });
    }
}

export function drawShrineEffects(gameState) {
    const centerX = 5 * C.CELL_SIZE;
    const centerY = 5 * C.CELL_SIZE;

    if (!gameState.infusionTarget) {
        for (let i = gameState.shrineParticles.length - 1; i >= 0; i--) {
            const p = gameState.shrineParticles[i];
            let currentX = centerX + Math.cos(p.angle) * p.radius;
            let currentY = centerY + Math.sin(p.angle) * p.radius;

            if (gameState.shrineIsOverloaded) {
                p.angle += p.speed * 4;
                p.radius += Math.sin(performance.now() * 0.008 + p.angle * 5) * 1.0;
            } else {
                p.angle += p.speed;
            }

            ctx.beginPath();
            ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 20, 60, 0.85)';
            ctx.fill();
        }
    } else {
        for (let i = gameState.shrineParticles.length - 1; i >= 0; i--) {
            const p = gameState.shrineParticles[i];
            let currentX = centerX + Math.cos(p.angle) * p.radius;
            let currentY = centerY + Math.sin(p.angle) * p.radius;
            const target = gameState.infusionTarget;
            const targetX = target.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const targetY = target.row * C.CELL_SIZE + C.CELL_SIZE / 2;
            if (Math.hypot(targetX - currentX, targetY - currentY) < 10) {
                gameState.shrineParticles.splice(i, 1);
                continue;
            }
            p.angle += p.speed * 8;
            p.radius -= 5;
            ctx.beginPath();
            ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 20, 60, 0.85)';
            ctx.fill();
        }
    }
}

export function drawShrineOverloadEffects(gameState) {
    if (!gameState.shrineIsOverloaded) return;

    const shrineCoords = C.SHAPES.shrineArea;
    const shrineCenterX = 5 * C.CELL_SIZE;
    const shrineCenterY = 5 * C.CELL_SIZE;

    const flicker = 0.5 + Math.sin(performance.now() * 0.01) * 0.2;
    ctx.strokeStyle = `rgba(255, 0, 0, ${flicker})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(shrineCoords[0][1] * C.CELL_SIZE + 10, shrineCoords[0][0] * C.CELL_SIZE + 15);
    ctx.lineTo(shrineCoords[3][1] * C.CELL_SIZE + C.CELL_SIZE - 15, shrineCoords[3][0] * C.CELL_SIZE + C.CELL_SIZE - 20);
    ctx.moveTo(shrineCoords[1][1] * C.CELL_SIZE + C.CELL_SIZE - 10, shrineCoords[1][0] * C.CELL_SIZE + 10);
    ctx.lineTo(shrineCoords[2][1] * C.CELL_SIZE + 20, shrineCoords[2][0] * C.CELL_SIZE + C.CELL_SIZE - 10);
    ctx.stroke();

    if (Math.random() > 0.85) {
        const startIdx = Math.floor(Math.random() * 4);
        let endIdx = Math.floor(Math.random() * 4);
        while (endIdx === startIdx) endIdx = Math.floor(Math.random() * 4);

        const [startR, startC] = shrineCoords[startIdx];
        const [endR, endC] = shrineCoords[endIdx];

        gameState.shrineArcs.push({
            startX: startC * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
            startY: startR * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
            endX: endC * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
            endY: endR * C.CELL_SIZE + C.CELL_SIZE / 2 + (Math.random() - 0.5) * 5,
            life: 0.25
        });
    }

    ctx.strokeStyle = 'rgba(255, 50, 100, 0.8)';
    ctx.lineWidth = 1.0;
    ctx.shadowColor = 'red';
    ctx.shadowBlur = 5;

    for (let i = gameState.shrineArcs.length - 1; i >= 0; i--) {
        const arc = gameState.shrineArcs[i];
        arc.life -= 0.016;
        if (arc.life <= 0) {
            gameState.shrineArcs.splice(i, 1);
            continue;
        }
        ctx.globalAlpha = arc.life / 0.25;
        ctx.beginPath();
        ctx.moveTo(arc.startX, arc.startY);
        ctx.quadraticCurveTo(
            shrineCenterX + (Math.random() - 0.5) * 15,
            shrineCenterY + (Math.random() - 0.5) * 15,
            arc.endX,
            arc.endY
        );
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
}

export function drawShockwaves(gameState) {
    for (let i = gameState.shockwaves.length - 1; i >= 0; i--) {
        const wave = gameState.shockwaves[i];
        wave.radius += 3;
        wave.life -= 0.025;
        if (wave.life <= 0) {
            gameState.shockwaves.splice(i, 1);
            continue;
        }
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${wave.color}, ${wave.life})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

export function drawAttackTexts(gameState) {
    for (let i = gameState.attackTexts.length - 1; i >= 0; i--) {
        const t = gameState.attackTexts[i];
        t.alpha -= 0.03;
        if (t.alpha <= 0) {
            gameState.attackTexts.splice(i, 1);
            continue;
        }
        t.y += t.vy;
        ctx.font = `bold ${C.CELL_SIZE * 0.25}px Arial`;
        ctx.fillStyle = `rgba(255, 255, 255, ${t.alpha})`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
    }
}

export function drawProjectiles(gameState) {
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const proj = gameState.projectiles[i];
        const targetX = proj.targetCol * C.CELL_SIZE + C.CELL_SIZE / 2;
        const targetY = proj.targetRow * C.CELL_SIZE + C.CELL_SIZE / 2;
        const dx = targetX - proj.x;
        const dy = targetY - proj.y;
        const dist = Math.hypot(dx, dy);

        if (dist < proj.speed) {
            proj.onHit(proj.target);
            gameState.projectiles.splice(i, 1);
            continue;
        }

        proj.x += (dx / dist) * proj.speed;
        proj.y += (dy / dist) * proj.speed;

        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

export function spawnSiphonParticles(piece, sourceType, gameState) {
    const targetX = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const targetY = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    let startX;
    let startY;
    let color;

    if (sourceType === 'rift') {
        const rift = C.SHAPES.riftAreas.find(r => r.cells.some(([rr, cc]) => rr === piece.row && cc === piece.col));
        const [riftR, riftC] = rift.cells[4];
        startX = riftC * C.CELL_SIZE + C.CELL_SIZE / 2;
        startY = riftR * C.CELL_SIZE + C.CELL_SIZE / 2;
        color = '190, 120, 255';
    } else {
        startX = 5 * C.CELL_SIZE;
        startY = 5 * C.CELL_SIZE;
        color = '220, 20, 60';
    }

    for (let i = 0; i < 30; i++) {
        const spawnX = startX + (Math.random() - 0.5) * C.CELL_SIZE * 1.5;
        const spawnY = startY + (Math.random() - 0.5) * C.CELL_SIZE * 1.5;
        gameState.siphonParticles.push({
            x: spawnX,
            y: spawnY,
            targetX,
            targetY,
            alpha: 1,
            radius: Math.random() * 2 + 1.5,
            color,
            speed: Math.random() * 3 + 2
        });
    }
}

export function drawSiphonParticles(gameState) {
    for (let i = gameState.siphonParticles.length - 1; i >= 0; i--) {
        const p = gameState.siphonParticles[i];
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < p.speed) {
            gameState.siphonParticles.splice(i, 1);
            continue;
        }

        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
        p.alpha -= 0.01;
        if (p.alpha <= 0) {
            gameState.siphonParticles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowColor = `rgba(${p.color}, 1)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

export function drawSiphonRunes(piece, gameState) {
    if (!piece || piece.ability?.name !== 'Siphon' || !piece.charges || piece.charges <= 0) return;

    const centerX = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const centerY = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    const time = performance.now() * 0.002;
    const pulse = 0.8 + 0.2 * Math.sin(time * 2);
    const color = piece.team === 'snow' ? `rgba(100, 200, 255, ${pulse})` : `rgba(255, 100, 80, ${pulse})`;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    const radius = C.CELL_SIZE * 0.35;

    if (piece.charges === 1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI * 1.2 + time * 0.5, Math.PI * 1.8 + time * 0.5);
        ctx.stroke();
    } else if (piece.charges === 2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI * 0.2 + time * 0.5, Math.PI * 0.8 + time * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI * 1.2 + time * 0.5, Math.PI * 1.8 + time * 0.5);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
            const angle = time + (i * Math.PI * 2) / 3;
            const startX = centerX + Math.cos(angle) * (radius - 5);
            const startY = centerY + Math.sin(angle) * (radius - 5);
            const endX = centerX + Math.cos(angle) * (radius + 5);
            const endY = centerY + Math.sin(angle) * (radius + 5);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
    ctx.shadowBlur = 0;
}

export function spawnBurningGroundParticle(row, col, gameState) {
    if (Math.random() > 0.3) return;
    const x = col * C.CELL_SIZE + Math.random() * C.CELL_SIZE;
    const y = row * C.CELL_SIZE + C.CELL_SIZE - 5;
    gameState.groundEffectParticles.push({
        x,
        y,
        vy: -(Math.random() * 1.5 + 0.5),
        alpha: 1,
        radius: Math.random() * 2.5 + 1,
        color: '255, 100, 0'
    });
}

export function drawGroundEffectParticles(gameState) {
    for (let i = gameState.groundEffectParticles.length - 1; i >= 0; i--) {
        const p = gameState.groundEffectParticles[i];
        p.y += p.vy;
        p.alpha -= 0.04;
        if (p.alpha <= 0) {
            gameState.groundEffectParticles.splice(i, 1);
            continue;
        }
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowColor = `rgba(${p.color}, 1)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

export function updateConduitParticles(gameState, startX, startY, endX, endY) {
    if (Math.random() > 0.5) return;

    const color = gameState.conduitTeam === 'snow' ? '100, 200, 255' : '255, 100, 80';
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    const speed = 4;

    gameState.conduitParticles.push({
        x: startX + (Math.random() - 0.5) * 10,
        y: startY + (Math.random() - 0.5) * 10,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        alpha: 1,
        radius: Math.random() * 2 + 2,
        color
    });
}

export function drawConduitParticles(gameState) {
    const [, rift2] = C.SHAPES.riftAreas;
    const endX = (rift2.cells[4][1] + 0.5) * C.CELL_SIZE;
    const endY = (rift2.cells[4][0] + 0.5) * C.CELL_SIZE;

    for (let i = gameState.conduitParticles.length - 1; i >= 0; i--) {
        const p = gameState.conduitParticles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (Math.hypot(endX - p.x, endY - p.y) < 20) {
            gameState.conduitParticles.splice(i, 1);
            continue;
        }

        p.alpha -= 0.01;
        if (p.alpha <= 0) {
            gameState.conduitParticles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.8})`;
        ctx.shadowColor = `rgba(${p.color}, 1)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

export function spawnWhiteoutParticles(piece, gameState) {
    const x = piece.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const y = piece.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        gameState.whiteoutParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            life: 1,
            radius: Math.random() * 3 + 1.5
        });
    }
}

export function drawWhiteoutParticles(gameState) {
    for (let i = gameState.whiteoutParticles.length - 1; i >= 0; i--) {
        const p = gameState.whiteoutParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= 0.025;
        if (p.life <= 0) {
            gameState.whiteoutParticles.splice(i, 1);
            continue;
        }
        ctx.fillStyle = `rgba(230, 245, 255, ${p.life * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function spawnMarkHitParticles(hitTarget, gameState) {
    const x = hitTarget.col * C.CELL_SIZE + C.CELL_SIZE / 2;
    const y = hitTarget.row * C.CELL_SIZE + C.CELL_SIZE / 2;
    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        gameState.battleParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            radius: Math.random() * 2 + 1,
            color: '255, 100, 0'
        });
    }
}

export function drawMarkOfCinderSparks(gameState) {
    gameState.markedPieces.forEach(m => {
        const piece = m.target;
        if (Math.random() > 0.6) {
            gameState.markOfCinderSparks.push({
                x: piece.col * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
                y: piece.row * C.CELL_SIZE + Math.random() * C.CELL_SIZE,
                vy: -(Math.random() * 0.5 + 0.3),
                life: 1,
                radius: Math.random() * 2 + 1
            });
        }
    });

    for (let i = gameState.markOfCinderSparks.length - 1; i >= 0; i--) {
        const p = gameState.markOfCinderSparks[i];
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
            gameState.markOfCinderSparks.splice(i, 1);
            continue;
        }
        ctx.fillStyle = `rgba(255, 100, 0, ${p.life * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function spawnRiftAssaultEffect(piece, oldRow, oldCol, newRow, newCol, gameState) {
    const anim = {
        piece,
        oldX: oldCol * C.CELL_SIZE + C.CELL_SIZE / 2,
        oldY: oldRow * C.CELL_SIZE + C.CELL_SIZE / 2,
        newX: newCol * C.CELL_SIZE + C.CELL_SIZE / 2,
        newY: newRow * C.CELL_SIZE + C.CELL_SIZE / 2,
        stage: 'dissolve',
        life: 0.5,
        particles: []
    };

    for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * C.CELL_SIZE * 0.6;
        anim.particles.push({
            x: anim.oldX + Math.cos(angle) * radius,
            y: anim.oldY + Math.sin(angle) * radius,
            radius: Math.random() * 3 + 1,
            life: 0.5
        });
    }
    gameState.riftAssaultAnimations.push(anim);
}

export function drawRiftAssaultAnimations(gameState) {
    for (let i = gameState.riftAssaultAnimations.length - 1; i >= 0; i--) {
        const anim = gameState.riftAssaultAnimations[i];
        anim.life -= 0.016;

        ctx.shadowColor = 'rgba(148, 0, 211, 1)';
        ctx.shadowBlur = 10;

        if (anim.stage === 'dissolve') {
            for (let j = anim.particles.length - 1; j >= 0; j--) {
                const p = anim.particles[j];
                p.x += (anim.oldX - p.x) * 0.15;
                p.y += (anim.oldY - p.y) * 0.15;
                p.radius *= 0.95;

                if (p.radius < 0.5) {
                    anim.particles.splice(j, 1);
                    continue;
                }

                ctx.fillStyle = `rgba(20, 0, 30, ${p.life / 0.5})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            if (anim.life <= 0) {
                anim.stage = 'reform';
                anim.life = 0.5;
                anim.particles = [];
                for (let k = 0; k < 70; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    anim.particles.push({
                        x: anim.newX,
                        y: anim.newY,
                        vx: Math.cos(angle) * (Math.random() * 6),
                        vy: Math.sin(angle) * (Math.random() * 6),
                        radius: Math.random() * 3.5 + 1,
                        life: 0.5
                    });
                }
            }
        } else {
            for (let j = anim.particles.length - 1; j >= 0; j--) {
                const p = anim.particles[j];
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.life -= 0.016;

                if (p.life <= 0) {
                    anim.particles.splice(j, 1);
                    continue;
                }

                ctx.fillStyle = `rgba(20, 0, 30, ${p.life / 0.5})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            if (anim.life <= 0) {
                anim.piece.isPhasing = false;
                gameState.riftAssaultAnimations.splice(i, 1);
            }
        }
    }
    ctx.shadowBlur = 0;
}