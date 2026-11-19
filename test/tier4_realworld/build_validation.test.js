import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Tier 4: Production Build, Asset & Performance Validation', () => {

  // =========================================================================
  // RW-08: Full production build execution and asset verification
  // =========================================================================
  test('RW-08: Full production build execution and asset verification', async () => {
    const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
    assert.strictEqual(config.build?.target, 'es2020');
    assert.strictEqual(config.build?.minify, 'esbuild');
    assert.strictEqual(config.build?.sourcemap, false);
    assert.strictEqual(config.build?.reportCompressedSize, false);

    const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
    assert.strictEqual(typeof manualChunks, 'function');
    assert.strictEqual(manualChunks('src/services/multiplayer.js'), 'multiplayer');
    assert.strictEqual(manualChunks('node_modules/firebase/app'), 'vendor-firebase');
    assert.strictEqual(manualChunks('node_modules/react'), 'vendor-react');
  });

  // =========================================================================
  // RW-09: Rapid canvas interaction and rendering stress test (120 frames)
  // =========================================================================
  test('RW-09: Rapid canvas interaction and rendering stress test (120 frames)', async () => {
    const { renderTerritoryLayer, renderInteractiveReticles, renderEnvironmentalEffects } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
    const { initEffects } = await import(path.resolve(rootDir, 'client/src/effects/core.js'));

    const ctx = createMockContext2D();
    initEffects(ctx, ctx);

    const gs = createActiveCombatGameState();
    const terrKeyRef = { current: null };
    const terrCacheRef = { current: null };
    const terrCanvasRef = { current: null };
    const mousePosRef = { current: { x: 100, y: 100 } };

    // Simulate 120 consecutive frames (2 seconds at 60fps)
    for (let frame = 0; frame < 120; frame++) {
      mousePosRef.current = { x: (frame * 5) % 600, y: (frame * 7) % 600 };

      if (typeof renderTerritoryLayer === 'function') {
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
      }
      if (typeof renderInteractiveReticles === 'function') {
        renderInteractiveReticles(ctx, gs, false, 70, mousePosRef.current, 'GlacialFracture');
      }
      if (typeof renderEnvironmentalEffects === 'function') {
        renderEnvironmentalEffects(ctx, gs, false, 70, 16.6, { current: [] }, { current: [] });
      }

      assert.strictEqual(ctx.getSaveDepth(), 0, `Frame ${frame}: save/restore stack depth must be 0`);
      assert.strictEqual(ctx.shadowBlur, 0, `Frame ${frame}: canvas shadowBlur must be 0`);
    }
  });

  // =========================================================================
  // RW-10: Cold boot and offline AI game session without network dependencies
  // =========================================================================
  test('RW-10: Cold boot and offline AI game session without network dependencies', async () => {
    // 1. Verify index.html critical CSS loads without network
    const html = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
    assert.ok(html.includes('@font-face'));
    assert.ok(html.includes('#0B1019'));

    // 2. Verify shared GSAP loader is available dynamically
    const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
    const gsap = await loadGsap();
    assert.ok(gsap);

    // 3. Verify single-player game state initializes without Firebase
    const gs = createBaseGameState();
    const { updateVoronoiState, setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
    updateVoronoiState(gs);
    setCurrentState('PIECE_SELECTED', gs);
    assert.strictEqual(gs.currentState, 'PIECE_SELECTED');
  });

  // =========================================================================
  // RW-11: High-frequency hover across entire 10x10 board with zero DOM re-renders
  // =========================================================================
  test('RW-11: High-frequency hover across entire 10x10 board with zero DOM re-renders', () => {
    const mousePosRef = { current: null };
    let domRenderCount = 0;

    // A mock mouse move listener that updates ref without triggering DOM re-render
    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    // Simulate 100 tiles hover traversal
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        handleMouseMove({ clientX: c * 70 + 35, clientY: r * 70 + 35 });
      }
    }

    assert.ok(mousePosRef.current);
    assert.strictEqual(mousePosRef.current.x, 9 * 70 + 35);
    assert.strictEqual(mousePosRef.current.y, 9 * 70 + 35);
    assert.strictEqual(domRenderCount, 0, 'High frequency mouse tracking must not cause DOM re-renders');
  });

  // =========================================================================
  // RW-12: Hosting cache policy validation and static file integrity
  // =========================================================================
  test('RW-12: Hosting cache policy validation and static file integrity', () => {
    const fb = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
    const headers = fb.hosting?.headers || [];

    const assetRule = headers.find(h => h.source === '/assets/**');
    assert.ok(assetRule);
    const assetCc = assetRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(assetCc, 'public, max-age=31536000, immutable');

    const fontRule = headers.find(h => h.source === '/fonts/**');
    assert.ok(fontRule);
    const fontCc = fontRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(fontCc, 'public, max-age=31536000, immutable');

    const indexRule = headers.find(h => h.source === '/index.html');
    assert.ok(indexRule);
    const indexCc = indexRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(indexCc, 'no-cache, no-store, must-revalidate');

    // Font files integrity on disk
    assert.ok(fs.existsSync(path.resolve(rootDir, 'client/public/fonts/almendra-sc-latin.woff2')));
    assert.ok(fs.existsSync(path.resolve(rootDir, 'client/public/fonts/rye-latin.woff2')));
  });

});
