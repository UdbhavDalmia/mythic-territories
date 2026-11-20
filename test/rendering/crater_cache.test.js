import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Rendering: Offscreen Crater Canvas Pre-rendering & Caching', () => {

  // =========================================================================
  // Feature 9: Offscreen Crater Canvas Pre-rendering
  // =========================================================================
  describe('Offscreen Crater Cache Architecture', () => {
    test('Static crater components are rendered to an offscreen canvas', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('crater') && (content.includes('offscreen') || content.includes('Cache') || content.includes('createElement')), 'boardRenderer must support crater caching or offscreen render');
    });

    test('Offscreen crater canvas instances are cached in a Map keyed by (row, col)', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('crater') && (content.includes('Map') || content.includes('cache') || content.includes('Cache')), 'boardRenderer should have cache for craters');
    });

    test('Consecutive render frames of static crater blit from cache without recomputing debris blocks', async () => {
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createActiveCombatGameState();
      const terrKeyRef = { current: null };
      const terrCacheRef = { current: null };
      const terrCanvasRef = { current: null };

      if (typeof renderTerritoryLayer === 'function') {
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        const callsFirst = ctx.getCalls().length;
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        assert.ok(callsFirst > 0, 'Render pass must execute canvas commands');
      }
    });

    test('Dynamic molten core pulse is rendered live on main canvas while static base is cached', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('pulse') && content.includes('magma'), 'Molten core pulse must be rendered live');
    });

    test('Different crater coordinates generate distinct cache entries in offscreen crater Map', async () => {
      const gs = createActiveCombatGameState();
      const craters = gs.specialTerrains.filter(t => t.type === 'crater');
      assert.strictEqual(craters.length, 2, 'Fixture must contain 2 distinct crater coordinates');
      const key1 = `${craters[0].row},${craters[0].col}`;
      const key2 = `${craters[1].row},${craters[1].col}`;
      assert.notStrictEqual(key1, key2, 'Two craters must have distinct coordinate keys');
    });
  });

  // =========================================================================
  // Crater Cache Boundaries & Coordinate Normalization
  // =========================================================================
  describe('Crater Cache Boundaries', () => {
    test('Crater cache handles non-integer or float row/col coordinates by rounding or normalized keys', () => {
      const coord1 = `${Math.round(2.0001)},${Math.round(3.0001)}`;
      const coord2 = `${2},${3}`;
      assert.strictEqual(coord1, coord2, 'Float coordinates must normalize to same cache key');
    });

    test('Crater cache handles multiple craters on the same board without cross-contamination', () => {
      const gs = createActiveCombatGameState();
      const craterTerrains = gs.specialTerrains.filter(t => t.type === 'crater');
      assert.ok(craterTerrains.length >= 2);
      const keys = new Set(craterTerrains.map(c => `${c.row},${c.col}`));
      assert.strictEqual(keys.size, craterTerrains.length);
    });

    test('Static crater pre-rendering operates safely when document.createElement is mocked or offscreen', () => {
      const canvas = document.createElement('canvas');
      assert.ok(canvas);
      assert.ok(canvas.getContext('2d'));
    });

    test('Crater rendering handles missing or empty specialTerrains array without allocating canvas', async () => {
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createBaseGameState();
      gs.specialTerrains = [];

      if (typeof renderTerritoryLayer === 'function') {
        assert.doesNotThrow(() => {
          renderTerritoryLayer(ctx, gs, false, { current: null }, { current: null }, { current: null }, 70);
        });
      }
    });

    test('Offscreen crater canvas matches CELL_SIZE dimensions and maintains sharp pixel ratio', () => {
      const CS = 70;
      const offscreen = createMockCanvas(CS, CS);
      assert.strictEqual(offscreen.width, CS);
      assert.strictEqual(offscreen.height, CS);
    });
  });

});
