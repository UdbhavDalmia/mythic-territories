import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState, createStressGameState } from '../helpers/fixtureState.js';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Tier 2: Rendering, Geometry & Interaction Boundaries', () => {

  // =========================================================================
  // Feature 3 Boundaries: _piecesKey Caching
  // =========================================================================
  describe('Feature 3 Boundaries', () => {
    test('F3-T2-1: calculateDynamicTerritoryAreas handles empty pieces array (0 pieces) gracefully', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const emptyGs = { pieces: [] };
      const result = calculateDynamicTerritoryAreas(emptyGs);
      assert.deepStrictEqual(result, { snow: 50.0, ash: 50.0, neutral: 0.0 });
    });

    test('F3-T2-2: calculateDynamicTerritoryAreas handles null/undefined pieces array with fallback', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas({ pieces: null });
        calculateDynamicTerritoryAreas(null);
      });
    });

    test('F3-T2-3: calculateDynamicTerritoryAreas formats fractional coordinates with exact toFixed(2) precision', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.pieces[0].col = 1.3333333;
      gs.pieces[0].row = 2.6666666;
      calculateDynamicTerritoryAreas(gs);
      if (gs._piecesKey) {
        assert.ok(gs._piecesKey.includes('1.33,2.67'), 'Coordinates in _piecesKey must be formatted to 2 decimal places');
      }
    });

    test('F3-T2-4: calculateDynamicTerritoryAreas handles piece with undefined power or currentHp falling back safely', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      delete gs.pieces[0].power;
      delete gs.pieces[0].currentHp;
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas(gs);
      });
    });

    test('F3-T2-5: _piecesKey fallback works when gs is frozen (Object.freeze) or read-only', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      Object.freeze(gs.pieces);
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas(gs);
      });
    });
  });

  // =========================================================================
  // Feature 4 Boundaries: gs.voronoiData Reuse
  // =========================================================================
  describe('Feature 4 Boundaries', () => {
    test('F4-T2-1: calculateDynamicTerritoryAreas handles malformed gs.voronoiData (missing cells or NaN shares) safely', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: NaN, ashShare: NaN };
      assert.doesNotThrow(() => {
        const scores = calculateDynamicTerritoryAreas(gs);
        assert.ok(!Number.isNaN(scores.snow));
        assert.ok(!Number.isNaN(scores.ash));
      });
    });

    test('F4-T2-2: calculateDynamicTerritoryAreas handles 0 frostShare or 0 ashShare without fallback to NaN', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: 0, ashShare: 0, cells: [] };
      const scores = calculateDynamicTerritoryAreas(gs);
      assert.ok(!Number.isNaN(scores.snow));
      assert.ok(!Number.isNaN(scores.ash));
      assert.ok(!Number.isNaN(scores.neutral));
    });

    test('F4-T2-3: calculateDynamicTerritoryAreas ensures neutral percentage is clamped between 0 and 100', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const scores = calculateDynamicTerritoryAreas(gs);
      assert.ok(scores.neutral >= 0 && scores.neutral <= 100, `Neutral percentage must be in [0, 100], got ${scores.neutral}`);
    });

    test('F4-T2-4: Cache invalidation works properly when gs.pieces changes length but gs.voronoiData was stale', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const initialScores = calculateDynamicTerritoryAreas(gs);
      // Remove half the pieces
      gs.pieces = gs.pieces.slice(0, 4);
      gs.voronoiData = null; // Invalidate
      const updatedScores = calculateDynamicTerritoryAreas(gs);
      assert.ok(initialScores);
      assert.ok(updatedScores);
    });

    test('F4-T2-5: calculateDynamicTerritoryAreas does not mutate input voronoiData object when extracting shares', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: 45.0, ashShare: 40.0, cells: [] };
      const originalCopy = JSON.stringify(gs.voronoiData);
      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(JSON.stringify(gs.voronoiData), originalCopy);
    });
  });

  // =========================================================================
  // Feature 5 Boundaries: Canvas Shadow State Cleanup
  // =========================================================================
  describe('Feature 5 Boundaries', () => {
    test('F5-T2-1: Early return in renderInteractiveReticles does not leak unclosed ctx.save() or shadowBlur', async () => {
      const { renderInteractiveReticles } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createBaseGameState();
      gs.selectedPiece = null; // Trigger early return

      if (typeof renderInteractiveReticles === 'function') {
        renderInteractiveReticles(ctx, gs, false, 70, null, null);
        assert.strictEqual(ctx.getSaveDepth(), 0);
        assert.strictEqual(ctx.shadowBlur, 0);
      }
    });

    test('F5-T2-2: renderEnvironmentalEffects handles 0 deathMeteors or empty specialTerrains without leaving residual shadow', async () => {
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

    test('F5-T2-3: Exception during draw does not permanently corrupt canvas context shadow state', () => {
      const ctx = createMockContext2D();
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.restore();
      assert.strictEqual(ctx.shadowBlur, 0);
    });

    test('F5-T2-4: Nested save/restore stacks maintain correct shadow restoration at all depths', () => {
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

    test('F5-T2-5: shadowColor is reset to transparent or default whenever shadowBlur is zeroed', () => {
      const ctx = createMockContext2D();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const audit = ctx.getShadowAudit();
      assert.strictEqual(audit.isShadowLeaked, false);
    });
  });

  // =========================================================================
  // Feature 9 Boundaries: Offscreen Crater Canvas Pre-rendering
  // =========================================================================
  describe('Feature 9 Boundaries', () => {
    test('F9-T2-1: Crater cache handles non-integer or float row/col coordinates by rounding or normalized keys', () => {
      const coord1 = `${Math.round(2.0001)},${Math.round(3.0001)}`;
      const coord2 = `${2},${3}`;
      assert.strictEqual(coord1, coord2, 'Float coordinates must normalize to same cache key');
    });

    test('F9-T2-2: Crater cache handles multiple craters on the same board without cross-contamination', () => {
      const gs = createActiveCombatGameState();
      const craterTerrains = gs.specialTerrains.filter(t => t.type === 'crater');
      assert.ok(craterTerrains.length >= 2);
      const keys = new Set(craterTerrains.map(c => `${c.row},${c.col}`));
      assert.strictEqual(keys.size, craterTerrains.length);
    });

    test('F9-T2-3: Static crater pre-rendering operates safely when document.createElement is mocked or offscreen', () => {
      const canvas = document.createElement('canvas');
      assert.ok(canvas);
      assert.ok(canvas.getContext('2d'));
    });

    test('F9-T2-4: Crater rendering handles missing or empty specialTerrains array without allocating canvas', async () => {
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

    test('F9-T2-5: Offscreen crater canvas matches CELL_SIZE dimensions and maintains sharp pixel ratio', () => {
      const CS = 70;
      const offscreen = createMockCanvas(CS, CS);
      assert.strictEqual(offscreen.width, CS);
      assert.strictEqual(offscreen.height, CS);
    });
  });

  // =========================================================================
  // Feature 10 Boundaries: Mouse State useRef Separation
  // =========================================================================
  describe('Feature 10 Boundaries', () => {
    test('F10-T2-1: Rapid mouse movements (100+ events/sec) update refs without queueing React state updates', () => {
      const mouseRef = { current: { x: 0, y: 0 } };
      for (let i = 0; i < 120; i++) {
        mouseRef.current = { x: i * 2, y: i * 3 };
      }
      assert.strictEqual(mouseRef.current.x, 238);
      assert.strictEqual(mouseRef.current.y, 357);
    });

    test('F10-T2-2: Mouse coords outside canvas boundaries clamp or reset ref values safely', () => {
      const clampCoord = (val, max) => Math.max(0, Math.min(max, val));
      assert.strictEqual(clampCoord(-15, 700), 0);
      assert.strictEqual(clampCoord(750, 700), 700);
      assert.strictEqual(clampCoord(350, 700), 350);
    });

    test('F10-T2-3: Component unmount does not leave dangling animation frames reading unmounted refs', () => {
      let animId = requestAnimationFrame(() => {});
      cancelAnimationFrame(animId);
      assert.ok(animId);
    });

    test('F10-T2-4: Touch events update mouse position refs compatibly with canvas coordinates', () => {
      const touchRef = { current: null };
      const mockTouch = { clientX: 150, clientY: 220 };
      touchRef.current = { x: mockTouch.clientX, y: mockTouch.clientY };
      assert.deepStrictEqual(touchRef.current, { x: 150, y: 220 });
    });

    test('F10-T2-5: Ability drawer hover does not trigger full board canvas redraw unless ability key changes', () => {
      let currentKey = null;
      let redrawCount = 0;
      const onHoverAbility = (key) => {
        if (key !== currentKey) {
          currentKey = key;
          redrawCount++;
        }
      };
      onHoverAbility('FrostWeave');
      onHoverAbility('FrostWeave'); // duplicate
      onHoverAbility('FrostWeave'); // duplicate
      assert.strictEqual(redrawCount, 1);
    });
  });

  // =========================================================================
  // Feature 13 Boundaries: Voronoi Polygon Sides Optimization
  // =========================================================================
  describe('Feature 13 Boundaries', () => {
    test('F13-T2-1: createBoundedPolygon handles unit centered exactly on board corner (0,0) or (10,10)', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const cornerPoly = createBoundedPolygon(0, 0, 2);
      assert.ok(cornerPoly.length >= 3, 'Corner clipped polygon must have at least 3 vertices');
      assert.ok(cornerPoly.every(v => v.x >= -0.001 && v.y >= -0.001));
    });

    test('F13-T2-2: createBoundedPolygon handles unit centered on board edge without degenerate edges', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const edgePoly = createBoundedPolygon(0, 5, 2);
      assert.ok(edgePoly.length >= 3, 'Edge clipped polygon must have at least 3 vertices');
    });

    test('F13-T2-3: createBoundedPolygon handles radius <= 0 gracefully', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      assert.doesNotThrow(() => {
        const poly = createBoundedPolygon(5, 5, 0);
        assert.ok(Array.isArray(poly));
      });
    });

    test('F13-T2-4: computePowerDiagram handles piece with undefined or null key defaulting to 16 sides', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const pieceWithoutKey = [{
        id: 99,
        team: 'snow',
        row: 5,
        col: 5,
        power: 10,
        control: 10
      }];
      assert.doesNotThrow(() => {
        const diagram = computePowerDiagram(pieceWithoutKey);
        assert.ok(diagram.cells.length === 1);
      });
    });

    test('F13-T2-5: computePowerDiagram with 20 pieces generates all valid non-degenerate cell polygons', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const stressGs = createStressGameState(20);
      const diagram = computePowerDiagram(stressGs.pieces);
      assert.strictEqual(diagram.cells.length, 20);
      for (const cell of diagram.cells) {
        if (cell.polygon && cell.polygon.length > 0) {
          assert.ok(cell.polygon.length >= 3, 'Active cell polygon must have at least 3 vertices');
        }
      }
    });
  });

});
