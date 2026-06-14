const fs = require('fs');
const file = 'client/js/script.js';
let content = fs.readFileSync(file, 'utf8');

const profilerCode = `
    const p1 = performance.now();
    let p2, p3, p4, p5, p6;
`;

const replaceCode = `
    const p1 = performance.now();
    try { UI.updateVisualStates(gameState, dt); } catch (e) { }
    const p2 = performance.now();
    try { UI.drawGhostOverlay(ctx, gameState); } catch (e) { }
    const p3 = performance.now();
    try { E.renderEffects(ctx); } catch (e) { }
    const p4 = performance.now();
    if (Effects.drawParticles) Effects.drawParticles(gameState);
    const p5 = performance.now();
    
    if (p5 - p1 > 10) {
        console.log(\`Slow frame: total=\${(p5-p1).toFixed(1)}ms visual=\${(p2-p1).toFixed(1)} ghost=\${(p3-p2).toFixed(1)} effects=\${(p4-p3).toFixed(1)} particles=\${(p5-p4).toFixed(1)}\`);
    }
`;

content = content.replace("try { UI.updateVisualStates(gameState, dt); } catch (e) { }", replaceCode);
fs.writeFileSync(file, content);
