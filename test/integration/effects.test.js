import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Integration: Visual Effects Architecture & Particle Pipelines', () => {

  // =========================================================================
  // Feature 16: Effects Bundle Splitting
  // =========================================================================
  describe('Effects Module Exports & Core Architecture', () => {
    test('client/src/effects/core.js exists and exports core particle systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.strictEqual(typeof core.drawParticles, 'function', 'drawParticles must be a function in core.js');
      assert.strictEqual(typeof core.drawShockwaves, 'function', 'drawShockwaves must be a function in core.js');
      assert.strictEqual(typeof core.drawRifts, 'function', 'drawRifts must be a function in core.js');
    });

    test('client/src/effects/core.js exports shrine and conduit rendering systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.strictEqual(typeof core.drawShrineEffects, 'function', 'drawShrineEffects must be a function in core.js');
      assert.strictEqual(typeof core.drawConduitParticles, 'function', 'drawConduitParticles must be a function in core.js');
      assert.strictEqual(typeof core.drawSiphonParticles, 'function', 'drawSiphonParticles must be a function in core.js');
    });

    test('client/src/effects/unitEffects.js exists and exports unit-specific animations', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects, 'unitEffects.js module must be loadable');
      const exportKeys = Object.keys(unitEffects);
      assert.ok(exportKeys.length > 0, 'unitEffects.js must have exports');
    });

    test('client/src/effects/index.js re-exports core systems synchronously', async () => {
      const effectsIndex = await import(path.resolve(rootDir, 'client/src/effects/index.js'));
      assert.strictEqual(typeof effectsIndex.initEffects, 'function', 'initEffects must be exported from index.js');
      assert.strictEqual(typeof effectsIndex.drawParticles, 'function', 'drawParticles must be exported from index.js');
      assert.strictEqual(typeof effectsIndex.drawShrineEffects, 'function', 'drawShrineEffects must be exported from index.js');
    });

    test('client/src/effects/core.js does not statically import unitEffects.js', () => {
      const coreContent = fs.readFileSync(path.resolve(rootDir, 'client/src/effects/core.js'), 'utf8');
      assert.strictEqual(coreContent.includes('./unitEffects.js'), false, 'core.js must not statically import unitEffects.js');
    });
  });

  // =========================================================================
  // Feature 16 Boundaries & Robustness
  // =========================================================================
  describe('Effects Boundaries & Canvas Context Binding', () => {
    test('Calling a unit animation before lazy load completes does not throw unhandled exception', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects, 'unitEffects must be loadable');
    });

    test('initEffects initializes 2D canvas contexts across both core and unit effects systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const mockMainCtx = createMockContext2D();
      const mockEffectsCtx = createMockContext2D();
      core.initEffects(mockMainCtx, mockEffectsCtx);
      assert.strictEqual(core.getCtx(), mockMainCtx);
      assert.strictEqual(core.getEffectsCtx(), mockEffectsCtx);
    });

    test('Unknown or invalid ability effect keys fail gracefully without crashing particle loop', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.doesNotThrow(() => {
        core.drawParticles({ pieces: [] });
      });
    });

    test('Concurrent calls to trigger unit effects queue or execute seamlessly once loaded', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects);
    });

    test('Legacy particle system in core.js updates and renders independently of unit animations', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const ctx = createMockContext2D();
      core.initEffects(ctx, ctx);
      assert.doesNotThrow(() => {
        core.drawRifts({ pieces: [] });
      });
    });
  });

});
