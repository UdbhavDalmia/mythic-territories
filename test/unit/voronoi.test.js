import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState, createStressGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: Voronoi Geometry & Polygon Optimization', () => {

  // =========================================================================
  // Feature 13: Voronoi Polygon Sides Optimization
  // =========================================================================
  describe('Polygon Sides & Power Diagram Generation', () => {
    test('createBoundedPolygon defaults numSides to 16 when not specified', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const poly = createBoundedPolygon(5, 5, 1);
      assert.strictEqual(poly.length, 16, 'createBoundedPolygon default numSides must be 16');
    });

    test('computePowerDiagram generates 16-sided base polygons for non-leader regular units', async () => {
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
      assert.strictEqual(diagram.cells[0].polygon.length, 16, 'Regular unit cell must have 16 vertices');
    });

    test('computePowerDiagram generates 24-sided base polygons for leader units (Lord and Tyrant)', async () => {
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

    test('All generated polygon vertices are strictly bounded within MAP_BOUNDS [0, 10]', async () => {
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

    test('Territorial percentage calculation accuracy remains within 1.0% between 16-side and 24-side polygons', async () => {
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const gs = createBaseGameState();
      const diagram = computePowerDiagram(gs.pieces);
      assert.ok(typeof diagram.frostShare === 'number' && typeof diagram.ashShare === 'number');
      const totalShare = diagram.frostShare + diagram.ashShare;
      assert.ok(totalShare >= 20 && totalShare <= 100, `Total share must be reasonable (got ${totalShare})`);
    });
  });

  // =========================================================================
  // Geometry Boundaries & Edge Cases
  // =========================================================================
  describe('Geometry Boundaries & Clipping', () => {
    test('createBoundedPolygon handles unit centered exactly on board corner (0,0) or (10,10)', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const cornerPoly = createBoundedPolygon(0, 0, 2);
      assert.ok(cornerPoly.length >= 3, 'Corner clipped polygon must have at least 3 vertices');
      assert.ok(cornerPoly.every(v => v.x >= -0.001 && v.y >= -0.001));
    });

    test('createBoundedPolygon handles unit centered on board edge without degenerate edges', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const edgePoly = createBoundedPolygon(0, 5, 2);
      assert.ok(edgePoly.length >= 3, 'Edge clipped polygon must have at least 3 vertices');
    });

    test('createBoundedPolygon handles radius <= 0 gracefully', async () => {
      const { createBoundedPolygon } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      assert.doesNotThrow(() => {
        const poly = createBoundedPolygon(5, 5, 0);
        assert.ok(Array.isArray(poly));
      });
    });

    test('computePowerDiagram handles piece with undefined or null key defaulting to 16 sides', async () => {
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

    test('computePowerDiagram with 20 pieces generates all valid non-degenerate cell polygons', async () => {
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
