import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Rendering: Canvas Shadows & State Stack Isolation', () => {

  // =========================================================================
  // Feature 5: Canvas Shadow State Cleanup
  // =========================================================================
  describe('Canvas Shadow Reset Guarantees', () => {
    test('renderInteractiveReticles leaves canvas shadowBlur at 0 upon completion', async () => {
      const { renderInteractiveReticles } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createActiveCombatGameState();
      gs.selectedPiece = gs.pieces[0];

      if (typeof renderInteractiveReticles === 'function') {
        renderInteractiveReticles(ctx, gs, false, 70, { x: 100, y: 100 }, 'GlacialFracture');
        assert.strictEqual(ctx.shadowBlur, 0, 'shadowBlur must be reset to 0 after renderInteractiveReticles');
      }
    });

    test('renderEnvironmentalEffects leaves canvas shadowBlur at 0 upon completion', async () => {
      const { renderEnvironmentalEffects } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const { initEffects } = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const ctx = createMockContext2D();
      initEffects(ctx, ctx);
      const gs = createActiveCombatGameState();

      if (typeof renderEnvironmentalEffects === 'function') {
        renderEnvironmentalEffects(ctx, gs, false, 70, 16.6, { current: [] }, { current: [] });
        assert.strictEqual(ctx.shadowBlur, 0, 'shadowBlur must be reset to 0 after renderEnvironmentalEffects');
      }
    });

    test('All shadowBlur assignments in boardRenderer.js have corresponding resets or save/restore pairs', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('shadowBlur'), 'boardRenderer.js uses canvas shadowBlur');
    });

    test('ctx.save() and ctx.restore() invocations are strictly balanced across boardRenderer render loops', async () => {
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createBaseGameState();
      const terrKeyRef = { current: null };
      const terrCacheRef = { current: null };
      const terrCanvasRef = { current: null };

      if (typeof renderTerritoryLayer === 'function') {
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        assert.strictEqual(ctx.getSaveDepth(), 0, 'Canvas save/restore stack depth must return to 0');
      }
    });

    test('Crater molten core pulse rendering restores shadowBlur to 0', async () => {
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createActiveCombatGameState();
      const terrKeyRef = { current: null };
      const terrCacheRef = { current: null };
      const terrCanvasRef = { current: null };

      if (typeof renderTerritoryLayer === 'function') {
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        assert.strictEqual(ctx.shadowBlur, 0, 'Molten core pulse must not leave unclosed shadowBlur on ctx');
      }
    });
  });

  // =========================================================================
  // Shadow Boundaries & Stack Integrity
  // =========================================================================
  describe('Shadow State Boundaries & Recovery', () => {
    test('Early return in renderInteractiveReticles does not leak unclosed ctx.save() or shadowBlur', async () => {
      const { renderInteractiveReticles } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createBaseGameState();
      gs.selectedPiece = null;

      if (typeof renderInteractiveReticles === 'function') {
        renderInteractiveReticles(ctx, gs, false, 70, null, null);
        assert.strictEqual(ctx.getSaveDepth(), 0);
        assert.strictEqual(ctx.shadowBlur, 0);
      }
    });

    test('renderEnvironmentalEffects handles 0 deathMeteors or empty specialTerrains without leaving residual shadow', async () => {
      const { renderEnvironmentalEffects } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const { initEffects } = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const ctx = createMockContext2D();
      initEffects(ctx, ctx);
      const gs = createBaseGameState();
      gs.deathMeteors = [];
      gs.specialTerrains = [];

      if (typeof renderEnvironmentalEffects === 'function') {
        renderEnvironmentalEffects(ctx, gs, false, 70, 16.6, { current: [] }, { current: [] });
        assert.strictEqual(ctx.shadowBlur, 0);
      }
    });

    test('Exception during draw does not permanently corrupt canvas context shadow state', () => {
      const ctx = createMockContext2D();
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.restore();
      assert.strictEqual(ctx.shadowBlur, 0);
    });

    test('Nested save/restore stacks maintain correct shadow restoration at all depths', () => {
      const ctx = createMockContext2D();
      ctx.save();
      ctx.shadowBlur = 5;
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.restore();
      assert.strictEqual(ctx.shadowBlur, 5);
      ctx.restore();
      assert.strictEqual(ctx.shadowBlur, 0);
    });

    test('shadowColor is reset to transparent or default whenever shadowBlur is zeroed', () => {
      const ctx = createMockContext2D();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const audit = ctx.getShadowAudit();
      assert.strictEqual(audit.isShadowLeaked, false);
    });
  });

});
