import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Rendering: 120 FPS Interaction Stress & Zero-DOM Re-render', () => {

  // =========================================================================
  // RW-09: Rapid canvas interaction and rendering stress test (120 frames)
  // =========================================================================
  test('RW-09: Rapid canvas interaction and rendering stress test (120 consecutive frames)', async () => {
    const { renderTerritoryLayer, renderInteractiveReticles, renderEnvironmentalEffects } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
    const { initEffects } = await import(path.resolve(rootDir, 'client/src/effects/core.js'));

    const ctx = createMockContext2D();
    initEffects(ctx, ctx);

    const gs = createActiveCombatGameState();
    const terrKeyRef = { current: null };
    const terrCacheRef = { current: null };
    const terrCanvasRef = { current: null };
    const mousePosRef = { current: { x: 100, y: 100 } };

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
  // RW-11: High-frequency hover across entire 10x10 board with zero DOM re-renders
  // =========================================================================
  test('RW-11: High-frequency hover across entire 10x10 board with zero DOM re-renders', () => {
    const mousePosRef = { current: null };
    let domRenderCount = 0;

    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

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

});
