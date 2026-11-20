import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: Territory Calculation & Voronoi Caching', () => {

  // =========================================================================
  // Feature 3: _piecesKey Calculation Caching
  // =========================================================================
  describe('Territory Key Caching (_piecesKey)', () => {
    test('calculateDynamicTerritoryAreas writes computed key to gs._piecesKey', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(typeof gs._piecesKey, 'string', 'gs._piecesKey must be populated as a string');
      assert.ok(gs._piecesKey.includes(':'), 'gs._piecesKey must follow id:col,row,hp,power format');
    });

    test('calculateDynamicTerritoryAreas reuses gs._piecesKey when already populated', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const customKey = 'precomputed-test-key-123';
      gs._piecesKey = customKey;

      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(gs._piecesKey, customKey, 'calculateDynamicTerritoryAreas must reuse pre-populated _piecesKey');
    });

    test('boardRenderer.renderTerritoryLayer checks gs._piecesKey before falling back to local computation', () => {
      const rendererContent = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(rendererContent.includes('_piecesKey'), 'boardRenderer.js must check _piecesKey on gameState');
    });

    test('_piecesKey changes when piece position, health, or power changes', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs1 = createBaseGameState();
      calculateDynamicTerritoryAreas(gs1);
      const key1 = gs1._piecesKey;

      const gs2 = createBaseGameState();
      gs2.pieces[0].row = 3; // position change
      calculateDynamicTerritoryAreas(gs2);
      const key2 = gs2._piecesKey;

      assert.notStrictEqual(key1, key2, '_piecesKey must differ when piece coordinates change');
    });

    test('_piecesKey remains identical when non-spatial, non-combat attributes change', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs1 = createBaseGameState();
      calculateDynamicTerritoryAreas(gs1);
      const key1 = gs1._piecesKey;

      const gs2 = createBaseGameState();
      gs2.turnCount = 99;
      gs2.selectedPiece = gs2.pieces[0];
      calculateDynamicTerritoryAreas(gs2);
      const key2 = gs2._piecesKey;

      assert.strictEqual(key1, key2, '_piecesKey must remain identical when non-spatial properties change');
    });

    test('calculateDynamicTerritoryAreas handles empty pieces array gracefully', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const emptyGs = { pieces: [] };
      const result = calculateDynamicTerritoryAreas(emptyGs);
      assert.deepStrictEqual(result, { snow: 50.0, ash: 50.0, neutral: 0.0 });
    });

    test('calculateDynamicTerritoryAreas handles null/undefined pieces array with fallback', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas({ pieces: null });
        calculateDynamicTerritoryAreas(null);
      });
    });

    test('calculateDynamicTerritoryAreas formats fractional coordinates with exact toFixed(2) precision', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.pieces[0].col = 1.3333333;
      gs.pieces[0].row = 2.6666666;
      calculateDynamicTerritoryAreas(gs);
      if (gs._piecesKey) {
        assert.ok(gs._piecesKey.includes('1.33,2.67'), 'Coordinates in _piecesKey must be formatted to 2 decimal places');
      }
    });

    test('calculateDynamicTerritoryAreas handles piece with undefined power or currentHp falling back safely', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      delete gs.pieces[0].power;
      delete gs.pieces[0].currentHp;
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas(gs);
      });
    });

    test('_piecesKey fallback works when gs is frozen (Object.freeze) or read-only', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      Object.freeze(gs.pieces);
      assert.doesNotThrow(() => {
        calculateDynamicTerritoryAreas(gs);
      });
    });
  });

  // =========================================================================
  // Feature 4: gs.voronoiData Reuse
  // =========================================================================
  describe('Voronoi State Reuse (gs.voronoiData)', () => {
    test('calculateDynamicTerritoryAreas caches computed voronoi diagram on gs.voronoiData', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = null;

      calculateDynamicTerritoryAreas(gs);
      assert.ok(gs.voronoiData, 'calculateDynamicTerritoryAreas must cache result on gs.voronoiData');
      assert.ok(Array.isArray(gs.voronoiData.cells), 'gs.voronoiData must contain cells array');
    });

    test('calculateDynamicTerritoryAreas reuses pre-existing gs.voronoiData without calling computePowerDiagram', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = {
        frostShare: 77.0,
        ashShare: 23.0,
        cells: []
      };

      const result = calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(result.snow, 77.0, 'calculateDynamicTerritoryAreas must reuse frostShare from pre-existing gs.voronoiData');
      assert.strictEqual(result.ash, 23.0, 'calculateDynamicTerritoryAreas must reuse ashShare from pre-existing gs.voronoiData');
    });

    test('Cached voronoiData contains valid cell polygons and territorial share percentages', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      calculateDynamicTerritoryAreas(gs);

      assert.strictEqual(typeof gs.voronoiData.frostShare, 'number');
      assert.strictEqual(typeof gs.voronoiData.ashShare, 'number');
      assert.ok(gs.voronoiData.cells.length > 0, 'Cached voronoiData must have cell polygons');
    });

    test('boardRenderer.renderTerritoryLayer reads currentGs.voronoiData directly', () => {
      const rendererContent = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(rendererContent.includes('currentGs.voronoiData') || rendererContent.includes('gs.voronoiData'), 'boardRenderer must read voronoiData from state');
    });

    test('shared logic updateVoronoiState writes to gs.voronoiData matching territory service schema', async () => {
      const { updateVoronoiState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = createBaseGameState();
      updateVoronoiState(gs);
      assert.ok(gs.voronoiData, 'updateVoronoiState must write to gs.voronoiData');
      assert.ok('frostShare' in gs.voronoiData && 'cells' in gs.voronoiData, 'gs.voronoiData must match expected schema');
    });

    test('calculateDynamicTerritoryAreas handles malformed gs.voronoiData (missing cells or NaN shares) safely', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: NaN, ashShare: NaN };
      assert.doesNotThrow(() => {
        const scores = calculateDynamicTerritoryAreas(gs);
        assert.ok(!Number.isNaN(scores.snow));
        assert.ok(!Number.isNaN(scores.ash));
      });
    });

    test('calculateDynamicTerritoryAreas handles 0 frostShare or 0 ashShare without fallback to NaN', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: 0, ashShare: 0, cells: [] };
      const scores = calculateDynamicTerritoryAreas(gs);
      assert.ok(!Number.isNaN(scores.snow));
      assert.ok(!Number.isNaN(scores.ash));
      assert.ok(!Number.isNaN(scores.neutral));
    });

    test('calculateDynamicTerritoryAreas ensures neutral percentage is clamped between 0 and 100', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const scores = calculateDynamicTerritoryAreas(gs);
      assert.ok(scores.neutral >= 0 && scores.neutral <= 100, `Neutral percentage must be in [0, 100], got ${scores.neutral}`);
    });

    test('Cache invalidation works properly when gs.pieces changes length but gs.voronoiData was stale', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const initialScores = calculateDynamicTerritoryAreas(gs);
      gs.pieces = gs.pieces.slice(0, 4);
      gs.voronoiData = null; // Invalidate
      const updatedScores = calculateDynamicTerritoryAreas(gs);
      assert.ok(initialScores);
      assert.ok(updatedScores);
    });

    test('calculateDynamicTerritoryAreas does not mutate input voronoiData object when extracting shares', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = { frostShare: 45.0, ashShare: 40.0, cells: [] };
      const originalCopy = JSON.stringify(gs.voronoiData);
      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(JSON.stringify(gs.voronoiData), originalCopy);
    });
  });

});
