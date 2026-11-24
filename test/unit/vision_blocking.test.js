import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createBaseGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: Continuous Line-of-Sight & Vision Blocking', () => {

  test('Direct line of sight is clear when no obstruction is between caster and target', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const gs = createBaseGameState();

    const los = C.hasLineOfSight(5, 5, 5, 8, gs);
    assert.strictEqual(los.hasLos, true);
    assert.strictEqual(los.blocker, null);
  });

  test('Line of sight is blocked by an intervening unit', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    const caster = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    const blocker = Logic.createPiece(5, 6, 'snowFrostLord', 'snow', gs);
    gs.pieces.push(caster, blocker);

    // Target (5, 7) is directly behind the blocker at (5, 6)
    const los = C.hasLineOfSight(5, 5, 5, 7, gs, { ignoredPieceId: caster.id });
    assert.strictEqual(los.hasLos, false, 'Line of sight must be blocked by the intervening unit');
    assert.ok(los.blocker, 'Blocker info must be returned');
    assert.strictEqual(los.blocker.type, 'piece');
    assert.strictEqual(los.blocker.piece.id, blocker.id);
  });

  test('Targeting an enemy directly is not blocked by that enemy', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    const caster = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    const enemy = Logic.createPiece(5, 6, 'snowFrostLord', 'snow', gs);
    gs.pieces.push(caster, enemy);

    // Targeting the enemy itself at (5, 6)
    const los = C.hasLineOfSight(5, 5, 5, 6, gs, { ignoredPieceId: caster.id, targetPieceId: enemy.id });
    assert.strictEqual(los.hasLos, true, 'Target unit must not block line of sight to itself');
  });

  test('Line of sight is blocked by Glacial Walls & Obsidian Pillars', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const gs = createBaseGameState();

    gs.glacialWalls = [{
      row: 4,
      col: 5,
      duration: 3,
      type: 'obsidianPillar'
    }];

    // Ray from (4, 3) to (4, 7) passes straight through the wall at (4, 5)
    const los = C.hasLineOfSight(4, 3, 4, 7, gs);
    assert.strictEqual(los.hasLos, false);
    assert.strictEqual(los.blocker.type, 'wall');
  });

  test('Line of sight is blocked by Void Squares and Craters', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const gs = createBaseGameState();

    gs.voidSquares = [{ row: 2, col: 2 }];
    const losVoid = C.hasLineOfSight(2, 0, 2, 4, gs);
    assert.strictEqual(losVoid.hasLos, false);
    assert.strictEqual(losVoid.blocker.type, 'void');

    gs.specialTerrains = [{ row: 6, col: 6, type: 'crater' }];
    const losCrater = C.hasLineOfSight(4, 4, 8, 8, gs);
    assert.strictEqual(losCrater.hasLos, false);
    assert.strictEqual(losCrater.blocker.type, 'crater');
  });

  test('isTargetValid rejects ability execution through an obstruction for blockable abilities', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    const shaper = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    const blocker = Logic.createPiece(5, 6, 'snowFrostLord', 'snow', gs);
    gs.pieces.push(shaper, blocker);
    gs.currentTurn = 'ash';

    // Obsidian Pillar targeting empty ground at (5, 7) behind blocker
    const target = { r: 5, c: 7 };
    const success = Logic.executeAbility(shaper, target, 'ObsidianPillar', gs);
    assert.strictEqual(success, false, 'Ability execution must fail when line of sight is obstructed');
  });

  test('CSP in firebase.json allows Google Fonts stylesheets and webfonts without violation', () => {
    const fb = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
    const globalRule = fb.hosting?.headers?.find(h => h.source === '**');
    assert.ok(globalRule, 'Global header rule for ** must exist');

    const csp = globalRule.headers.find(k => k.key === 'Content-Security-Policy')?.value;
    assert.ok(csp, 'Content-Security-Policy header must exist');
    assert.ok(csp.includes('style-src') && csp.includes('https://fonts.googleapis.com'), 'style-src must include https://fonts.googleapis.com');
    assert.ok(csp.includes('font-src') && csp.includes('https://fonts.gstatic.com'), 'font-src must include https://fonts.gstatic.com');
  });

});
