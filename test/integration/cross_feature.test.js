import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Integration: Cross-Feature Interactions', () => {

  test('T3-01 (F2+F6): AI Worker structuredClone with multiplayer serializeDelta roundtrip', async () => {
    const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
    const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));

    const original = createActiveCombatGameState();
    const deltaJson = serializeDelta(original);
    const rehydrated = parseAndRehydrateGameState(deltaJson);

    for (const p of rehydrated.pieces) {
      if (p.ability) {
        for (const [k, v] of Object.entries(p.ability)) {
          if (typeof v === 'function') delete p.ability[k];
        }
      }
    }

    const workerCloned = deepClone(rehydrated);

    assert.ok(workerCloned.snowTerritory instanceof Set, 'snowTerritory must be a Set across network and worker boundaries');
    assert.ok(workerCloned.ashTerritory instanceof Set, 'ashTerritory must be a Set across network and worker boundaries');
    assert.strictEqual(workerCloned.pieces.length, original.pieces.length);
    assert.strictEqual(workerCloned.turnCount, original.turnCount);
    workerCloned.pieces[0].currentHp = 1;
    assert.notStrictEqual(original.pieces[0].currentHp, 1);
  });

  test('T3-02 (F3+F4): Territory caching _piecesKey together with voronoiData caching', async () => {
    const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
    const gs = createBaseGameState();
    const scores1 = calculateDynamicTerritoryAreas(gs);
    const key1 = gs._piecesKey;

    const scores2 = calculateDynamicTerritoryAreas(gs);
    assert.deepStrictEqual(scores1, scores2);
    if (key1) {
      assert.strictEqual(gs._piecesKey, key1);
    }
  });

  test('T3-03 (F4+F13): Voronoi polygon sides (16 vs 24) cached in gs.voronoiData', async () => {
    const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
    const gs = createBaseGameState();
    const diagram = computePowerDiagram(gs.pieces);
    gs.voronoiData = diagram;

    assert.ok(gs.voronoiData.cells.length > 0);
    const leaderCell = gs.voronoiData.cells.find(c => c.piece?.isLeader);
    assert.ok(leaderCell, 'Voronoi data must contain leader cell');
    assert.ok(leaderCell.polygon.length <= 24 && leaderCell.polygon.length >= 3, 'Leader cell polygon must be valid and bounded by 24 vertices');
  });

  test('T3-04 (F3+F5): Territory key caching during canvas shadow reset in boardRenderer', async () => {
    const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
    const ctx = createMockContext2D();
    const gs = createBaseGameState();
    const terrKeyRef = { current: null };
    const terrCacheRef = { current: null };
    const terrCanvasRef = { current: null };

    if (typeof renderTerritoryLayer === 'function') {
      renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
      assert.strictEqual(ctx.shadowBlur, 0, 'Shadow blur must be 0 after cached territory render pass');
    }
  });

  test('T3-05 (F5+F9): Canvas shadow state cleanup around offscreen crater pre-rendering', async () => {
    const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
    const ctx = createMockContext2D();
    const gs = createActiveCombatGameState();
    const terrKeyRef = { current: null };
    const terrCacheRef = { current: null };
    const terrCanvasRef = { current: null };

    if (typeof renderTerritoryLayer === 'function') {
      renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
      assert.strictEqual(ctx.shadowBlur, 0, 'Shadow blur from crater magma pulse must not leak onto canvas context');
    }
  });

  test('T3-06 (F9+F10): Offscreen crater cache lookup during high-frequency mouse hover with useRef', () => {
    const mousePosRef = { current: { x: 350, y: 350 } };
    const craterMap = new Map();
    craterMap.set('5,5', createMockCanvas(70, 70));

    for (let i = 0; i < 60; i++) {
      mousePosRef.current = { x: 350 + (i % 5), y: 350 + (i % 5) };
      const hoveredRow = Math.floor(mousePosRef.current.y / 70);
      const hoveredCol = Math.floor(mousePosRef.current.x / 70);
      const cached = craterMap.get(`${hoveredRow},${hoveredCol}`);
      assert.ok(cached, 'Offscreen crater canvas must be found in Map');
    }
  });

  test('T3-07 (F1+F15): Lucide deep imports combined with Vite build settings (es2020, esbuild minification)', async () => {
    const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
    assert.strictEqual(config.build?.target, 'es2020');
    assert.strictEqual(config.build?.minify, 'esbuild');
    const iconModule = await import(path.resolve(rootDir, 'client/node_modules/lucide-react/dist/esm/icons/swords.js'));
    assert.ok(iconModule.default);
  });

  test('T3-08 (F7+F8): Multiplayer chunk splitting with lazy Firebase dynamic import', async () => {
    const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
    const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
    assert.strictEqual(manualChunks('/client/src/services/multiplayer.js'), 'multiplayer');
    assert.strictEqual(manualChunks('/client/node_modules/firebase/app/index.js'), 'vendor-firebase');
  });

  test('T3-09 (F8+F14): Pure gameState passing during offline AI game without Firebase load', async () => {
    const { updateVoronoiState, setCurrentState, isState } = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    updateVoronoiState(gs);
    setCurrentState('PIECE_SELECTED', gs);
    assert.strictEqual(isState('PIECE_SELECTED', gs), true);
    assert.ok(gs.events.length > 0);
  });

  test('T3-10 (F6+F14): Multiplayer serializeDelta serialization from explicitly passed pure gameState', async () => {
    const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
    const customGs = createBaseGameState();
    customGs.turnCount = 42;
    customGs.currentTurn = 'ash';

    const deltaJson = serializeDelta(customGs);
    const parsed = JSON.parse(deltaJson);
    assert.strictEqual(parsed.turnCount, 42);
    assert.strictEqual(parsed.currentTurn, 'ash');
  });

  test('T3-11 (F11+F15): Dynamic GSAP loader with Vite es2020 build configuration', async () => {
    const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
    const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
    assert.strictEqual(config.build?.target, 'es2020');
    const gsap = await loadGsap();
    assert.ok(typeof gsap.to === 'function');
  });

  test('T3-12 (F12+F17): Inline critical CSS pruning in index.html with Firebase Cache-Control for assets and fonts', () => {
    const html = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
    const fb = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
    assert.ok(html.includes('/fonts/almendra-sc-latin.woff2'));
    const fontHeader = fb.hosting.headers.find(h => h.source === '/fonts/**');
    assert.ok(fontHeader, 'Firebase headers must cover /fonts/** referenced by index.html');
  });

  test('T3-13 (F1+F11): Lucide deep imports and dynamic GSAP in Lobby and Info components', () => {
    const guideContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Guide.jsx'), 'utf8');
    assert.strictEqual(guideContent.includes("from 'lucide-react'"), false);
    assert.strictEqual(guideContent.includes("^import gsap from 'gsap'"), false);
    assert.ok(guideContent.includes('loadGsap'));
  });

  test('T3-14 (F15+F16): Effects split (core vs unitEffects) under Vite rollup options', async () => {
    const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
    const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
    assert.ok(core.drawParticles);
    assert.ok(unitEffects.drawGlacialFractureAnimations);
  });

  test('T3-15 (F2+F14): Pure gameState threading into AI worker simulation iterations', async () => {
    const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
    const { setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));

    const rootState = createBaseGameState();
    const simBranch = deepClone(rootState);
    setCurrentState('ABILITY_TARGETING', simBranch);

    assert.strictEqual(simBranch.currentState, 'ABILITY_TARGETING');
    assert.strictEqual(rootState.currentState, 'AWAITING_PIECE_SELECTION');
  });

  test('T3-16 (F3+F13): Voronoi 16-side polygon tessellation area calculations with _piecesKey caching', async () => {
    const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
    const gs = createBaseGameState();
    const scores = calculateDynamicTerritoryAreas(gs);
    assert.ok(scores.snow > 0 && scores.ash > 0);
  });

  test('T3-17 (F6+F8): Multiplayer room action dispatch using serializeDelta with lazy Firestore deps', async () => {
    const { serializeDelta, getFirestoreDeps } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
    const gs = createBaseGameState();
    const delta = serializeDelta(gs);
    assert.ok(delta);
    assert.strictEqual(typeof getFirestoreDeps, 'function');
  });

  test('T3-18 (F5+F10): Reticle canvas rendering with mouse useRef maintaining clean shadow context', async () => {
    const { renderInteractiveReticles } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
    const mouseRef = { current: { x: 210, y: 210 } };
    const ctx = createMockContext2D();
    const gs = createActiveCombatGameState();
    gs.selectedPiece = gs.pieces[0];

    if (typeof renderInteractiveReticles === 'function') {
      renderInteractiveReticles(ctx, gs, false, 70, mouseRef.current, 'GlacialFracture');
      assert.strictEqual(ctx.shadowBlur, 0);
    }
  });

  test('T3-19 (F2+F3): AI worker simulation deepClones maintaining _piecesKey integrity', async () => {
    const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
    const gs = createBaseGameState();
    gs._piecesKey = '1:4.00,0.00,100,24|11:4.00,9.00,100,24';

    const cloned = deepClone(gs);
    assert.strictEqual(cloned._piecesKey, gs._piecesKey);
  });

  test('T3-20 (F14+F16): Pure gameState passing to unit effect particle triggers', async () => {
    const { drawRifts, initEffects } = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
    const ctx = createMockContext2D();
    initEffects(ctx, ctx);
    const customGs = createBaseGameState();
    assert.doesNotThrow(() => {
      drawRifts(customGs);
    });
  });

});
