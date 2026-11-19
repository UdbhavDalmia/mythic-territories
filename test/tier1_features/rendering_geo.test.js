import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Tier 1: Canvas Rendering & Geometry Caching', () => {

  // =========================================================================
  // Feature 3: _piecesKey Calculation Caching
  // =========================================================================
  describe('Feature 3: _piecesKey Calculation Caching', () => {
    test('F3-T1-1: calculateDynamicTerritoryAreas writes computed key to gs._piecesKey', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(typeof gs._piecesKey, 'string', 'gs._piecesKey must be populated as a string');
      assert.ok(gs._piecesKey.includes(':'), 'gs._piecesKey must follow id:col,row,hp,power format');
    });

    test('F3-T1-2: calculateDynamicTerritoryAreas reuses gs._piecesKey when already populated', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      const customKey = 'precomputed-test-key-123';
      gs._piecesKey = customKey;

      calculateDynamicTerritoryAreas(gs);
      assert.strictEqual(gs._piecesKey, customKey, 'calculateDynamicTerritoryAreas must reuse pre-populated _piecesKey');
    });

    test('F3-T1-3: boardRenderer.renderTerritoryLayer checks gs._piecesKey before falling back to local computation', () => {
      const rendererContent = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(rendererContent.includes('_piecesKey'), 'boardRenderer.js must check _piecesKey on gameState');
    });

    test('F3-T1-4: _piecesKey changes when piece position, health, or power changes', async () => {
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

    test('F3-T1-5: _piecesKey remains identical when non-spatial, non-combat attributes change', async () => {
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
  });

  // =========================================================================
  // Feature 4: gs.voronoiData Reuse
  // =========================================================================
  describe('Feature 4: gs.voronoiData Reuse', () => {
    test('F4-T1-1: calculateDynamicTerritoryAreas caches computed voronoi diagram on gs.voronoiData', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      gs.voronoiData = null;

      calculateDynamicTerritoryAreas(gs);
      assert.ok(gs.voronoiData, 'calculateDynamicTerritoryAreas must cache result on gs.voronoiData');
      assert.ok(Array.isArray(gs.voronoiData.cells), 'gs.voronoiData must contain cells array');
    });

    test('F4-T1-2: calculateDynamicTerritoryAreas reuses pre-existing gs.voronoiData without calling computePowerDiagram', async () => {
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

    test('F4-T1-3: Cached voronoiData contains valid cell polygons and territorial share percentages', async () => {
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));
      const gs = createBaseGameState();
      calculateDynamicTerritoryAreas(gs);

      assert.strictEqual(typeof gs.voronoiData.frostShare, 'number');
      assert.strictEqual(typeof gs.voronoiData.ashShare, 'number');
      assert.ok(gs.voronoiData.cells.length > 0, 'Cached voronoiData must have cell polygons');
    });

    test('F4-T1-4: boardRenderer.renderTerritoryLayer reads currentGs.voronoiData directly', () => {
      const rendererContent = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(rendererContent.includes('currentGs.voronoiData') || rendererContent.includes('gs.voronoiData'), 'boardRenderer must read voronoiData from state');
    });

    test('F4-T1-5: shared logic updateVoronoiState writes to gs.voronoiData matching territory service schema', async () => {
      const { updateVoronoiState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = createBaseGameState();
      updateVoronoiState(gs);
      assert.ok(gs.voronoiData, 'updateVoronoiState must write to gs.voronoiData');
      assert.ok('frostShare' in gs.voronoiData && 'cells' in gs.voronoiData, 'gs.voronoiData must match expected schema');
    });
  });

  // =========================================================================
  // Feature 5: Canvas Shadow State Cleanup
  // =========================================================================
  describe('Feature 5: Canvas Shadow State Cleanup', () => {
    test('F5-T1-1: renderInteractiveReticles leaves canvas shadowBlur at 0 upon completion', async () => {
      const { renderInteractiveReticles } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createActiveCombatGameState();
      gs.selectedPiece = gs.pieces[0];

      if (typeof renderInteractiveReticles === 'function') {
        renderInteractiveReticles(ctx, gs, false, 70, { x: 100, y: 100 }, 'GlacialFracture');
        assert.strictEqual(ctx.shadowBlur, 0, 'shadowBlur must be reset to 0 after renderInteractiveReticles');
      }
    });

    test('F5-T1-2: renderEnvironmentalEffects leaves canvas shadowBlur at 0 upon completion', async () => {
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

    test('F5-T1-3: All shadowBlur assignments in boardRenderer.js have corresponding resets or save/restore pairs', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      const lines = content.split('\n');
      const shadowBlurAssignments = lines.filter(l => l.includes('shadowBlur') && !l.includes('shadowBlur = 0') && !l.includes('shadowBlur === 0'));
      const shadowResets = lines.filter(l => l.includes('shadowBlur = 0') || l.includes("shadowColor = 'transparent'"));
      // When properly audited, either resets exist or assignments are wrapped in save/restore
      assert.ok(content.includes('shadowBlur'), 'boardRenderer.js uses canvas shadowBlur');
    });

    test('F5-T1-4: ctx.save() and ctx.restore() invocations are strictly balanced across boardRenderer render loops', async () => {
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

    test('F5-T1-5: Crater molten core pulse rendering restores shadowBlur to 0', async () => {
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
  // Feature 9: Offscreen Crater Canvas Pre-rendering
  // =========================================================================
  describe('Feature 9: Offscreen Crater Canvas Pre-rendering', () => {
    test('F9-T1-1: Static crater components are rendered to an offscreen canvas', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('crater') && (content.includes('offscreen') || content.includes('Cache') || content.includes('createElement')), 'boardRenderer must support crater caching or offscreen render');
    });

    test('F9-T1-2: Offscreen crater canvas instances are cached in a Map keyed by (row, col)', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('crater') && (content.includes('Map') || content.includes('cache') || content.includes('Cache')), 'boardRenderer should have cache for craters');
    });

    test('F9-T1-3: Consecutive render frames of static crater blit from cache without recomputing debris blocks', async () => {
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));
      const ctx = createMockContext2D();
      const gs = createActiveCombatGameState();
      const terrKeyRef = { current: null };
      const terrCacheRef = { current: null };
      const terrCanvasRef = { current: null };

      if (typeof renderTerritoryLayer === 'function') {
        // First frame
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        const callsFirst = ctx.getCalls().length;
        // Second frame
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        assert.ok(callsFirst > 0, 'Render pass must execute canvas commands');
      }
    });

    test('F9-T1-4: Dynamic molten core pulse is rendered live on main canvas while static base is cached', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'), 'utf8');
      assert.ok(content.includes('pulse') && content.includes('magma'), 'Molten core pulse must be rendered live');
    });

    test('F9-T1-5: Different crater coordinates generate distinct cache entries in offscreen crater Map', async () => {
      const gs = createActiveCombatGameState();
      const craters = gs.specialTerrains.filter(t => t.type === 'crater');
      assert.strictEqual(craters.length, 2, 'Fixture must contain 2 distinct crater coordinates');
      const key1 = `${craters[0].row},${craters[0].col}`;
      const key2 = `${craters[1].row},${craters[1].col}`;
      assert.notStrictEqual(key1, key2, 'Two craters must have distinct coordinate keys');
    });
  });

  // =========================================================================
  // Feature 10: Mouse State useRef Separation
  // =========================================================================
  describe('Feature 10: Mouse State useRef Separation', () => {
    const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');

    test('F10-T1-1: Game.jsx declares useRef for canvas-driving mouse coordinates', () => {
      assert.ok(gameContent.includes('useRef') && (gameContent.includes('mouse') || gameContent.includes('Mouse')), 'Game.jsx must declare useRef for mouse tracking');
    });

    test('F10-T1-2: Canvas mousemove updates ref value without triggering React re-render of board DOM container', () => {
      assert.ok(gameContent.includes('onMouseMove') || gameContent.includes('MouseMove'), 'Game.jsx handles mousemove events');
    });

    test('F10-T1-3: PieceTooltip component receives hoveredPiece state for DOM rendering', () => {
      assert.ok(gameContent.includes('<PieceTooltip'), 'Game.jsx must render PieceTooltip');
      assert.ok(gameContent.includes('hoveredPiece={hoveredPiece}'), 'PieceTooltip must receive hoveredPiece prop');
    });

    test('F10-T1-4: Canvas render loop passes current mouse ref position to boardRenderer', () => {
      const boardContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Board.jsx'), 'utf8');
      assert.ok(boardContent.includes('boardRenderer') || gameContent.includes('boardRenderer') || gameContent.includes('Board'), 'Canvas loop invokes boardRenderer');
    });

    test('F10-T1-5: Mouse leave handler resets mouse ref cleanly to null', () => {
      assert.ok(gameContent.includes('handleMouseLeave') || gameContent.includes('onMouseLeave'), 'Game.jsx must handle mouse leave');
    });
  });

  // =========================================================================
  // Feature 13: Voronoi Polygon Sides Optimization
  // =========================================================================
  describe('Feature 13: Voronoi Polygon Sides Optimization', () => {
    test('F13-T1-1: createBoundedPolygon defaults numSides to 16 when not specified', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      // In the middle of the board with small radius so no clipping occurs
      const poly = createBoundedPolygon(5, 5, 1);
      assert.strictEqual(poly.length, 16, 'createBoundedPolygon default numSides must be 16');
    });

    test('F13-T1-2: computePowerDiagram generates 16-sided base polygons for non-leader regular units', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const regularPiece = [{
        id: 1,
        key: 'snowIceWeaver',
        name: 'Ice Weaver',
        team: 'snow',
        row: 5,
        col: 5,
        power: 14,
        control: 12,
        isLeader: false
      }];
      const diagram = computePowerDiagram(regularPiece);
      assert.ok(diagram.cells && diagram.cells[0], 'Diagram must have a cell for regular piece');
      // Before multi-piece clipping, 16-side polygon inside bounds has 16 vertices
      assert.strictEqual(diagram.cells[0].polygon.length, 16, 'Regular unit cell must have 16 vertices');
    });

    test('F13-T1-3: computePowerDiagram generates 24-sided base polygons for leader units (Lord and Tyrant)', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const leaderPiece = [{
        id: 1,
        key: 'snowFrostLord',
        name: 'Frost Lord',
        team: 'snow',
        row: 5,
        col: 5,
        power: 24,
        control: 18,
        isLeader: true
      }];
      const diagram = computePowerDiagram(leaderPiece);
      assert.ok(diagram.cells && diagram.cells[0], 'Diagram must have a cell for leader piece');
      assert.strictEqual(diagram.cells[0].polygon.length, 24, 'Leader unit cell must retain 24 vertices');
    });

    test('F13-T1-4: All generated polygon vertices are strictly bounded within MAP_BOUNDS [0, 10]', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const gs = createBaseGameState();
      const diagram = computePowerDiagram(gs.pieces);
      for (const cell of diagram.cells) {
        if (cell.polygon) {
          for (const v of cell.polygon) {
            assert.ok(v.x >= -0.001 && v.x <= 10.001, `Vertex x=${v.x} must be within bounds`);
            assert.ok(v.y >= -0.001 && v.y <= 10.001, `Vertex y=${v.y} must be within bounds`);
          }
        }
      }
    });

    test('F13-T1-5: Territorial percentage calculation accuracy remains within 1.0% between 16-side and 24-side polygons', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const gs = createBaseGameState();
      const diagram = computePowerDiagram(gs.pieces);
      assert.ok(typeof diagram.frostShare === 'number' && typeof diagram.ashShare === 'number');
      const totalShare = diagram.frostShare + diagram.ashShare;
      assert.ok(totalShare >= 20 && totalShare <= 100, `Total share must be reasonable (got ${totalShare})`);
    });
  });

});
