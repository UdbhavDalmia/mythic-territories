import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: Obsidian Pillar Integration', () => {

  test('Mode 1: Targeting empty ground spawns an Obsidian Pillar wall and claims Ash territory', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);

    const shaper = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    gs.pieces.push(shaper);
    gs.currentTurn = 'ash';

    const target = { r: 5, c: 6 };
    const success = Logic.executeAbility(shaper, target, 'ObsidianPillar', gs);

    assert.strictEqual(success, true, 'Ability execution must succeed on valid empty ground');
    
    // Wall spawned
    const pillar = (gs.glacialWalls || []).find(w => w.row === 5 && w.col === 6);
    assert.ok(pillar, 'GlacialWalls must contain the spawned pillar');
    assert.strictEqual(pillar.type, 'obsidianPillar');
    assert.strictEqual(pillar.duration, 4);

    // Territory claimed
    assert.ok(gs.ashTerritory.has('5,6'), 'Ash territory must claim the created pillar tile');

    // Animation event
    assert.ok(gs.events.some(e => e.type === 'ANIMATION' && e.name === 'ObsidianPillarCast' && e.subType === 'wall'));
  });

  test('Mode 2: Targeting an ally grants an Obsidian Shield (2 HP, 2 turns) that shatters into magma shards', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const Utils = await import(path.resolve(rootDir, 'shared/utils.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    const shaper = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    const ally = Logic.createPiece(5, 4, 'ashAshTyrant', 'ash', gs);
    const enemyAttacker = Logic.createPiece(5, 3, 'snowFrostLord', 'snow', gs);
    enemyAttacker.strength = 4;
    gs.pieces.push(shaper, ally, enemyAttacker);
    gs.currentTurn = 'ash';

    const initialHp = ally.currentHp;
    const target = { r: 5, c: 4 };
    const success = Logic.executeAbility(shaper, target, 'ObsidianPillar', gs);

    assert.strictEqual(success, true);
    const shield = (gs.shields || []).find(s => s.pieceId === ally.id);
    assert.ok(shield, 'Ally must receive shield');
    assert.strictEqual(shield.name, 'ObsidianPillarShield');
    assert.strictEqual(shield.hp, 2);
    assert.strictEqual(shield.duration, 2);

    // Test damage absorption: 1 damage absorbed
    Utils.dealDamage(enemyAttacker, ally, gs);
    assert.strictEqual(ally.currentHp, initialHp, 'HP must not decrease while shield has HP');
    assert.strictEqual(shield.hp, 1, 'Shield HP must decrement to 1');

    // Absorb remaining 1 damage: shield shatters and drops magma shards
    Utils.dealDamage(enemyAttacker, ally, gs);
    assert.strictEqual(ally.currentHp, initialHp, 'HP must remain full');
    const remainingShield = (gs.shields || []).find(s => s.pieceId === ally.id);
    assert.strictEqual(remainingShield, undefined, 'Shield must be consumed when depleted');

    // Verify magma shards terrain spawned
    const shards = (gs.specialTerrains || []).find(st => st.row === ally.row && st.col === ally.col && st.type === 'magmaShards');
    assert.ok(shards, 'Depleted shield must drop magmaShards on defender tile');
  });

  test('Mode 3: Targeting an enemy deals 1 damage, knocks back 1 tile, and erects an Obsidian Pillar at original tile', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    const shaper = Logic.createPiece(5, 5, 'ashMagmaShaper', 'ash', gs);
    const enemy = Logic.createPiece(5, 6, 'snowFrostLord', 'snow', gs);
    gs.pieces.push(shaper, enemy);
    gs.currentTurn = 'ash';

    const enemyInitialHp = enemy.currentHp;
    const target = { r: 5, c: 6 };
    const success = Logic.executeAbility(shaper, target, 'ObsidianPillar', gs);

    assert.strictEqual(success, true);
    assert.strictEqual(enemy.currentHp, enemyInitialHp - 1, 'Enemy must take 1 damage');
    assert.strictEqual(enemy.row, 5);
    assert.strictEqual(enemy.col, 7, 'Enemy must be knocked back 1 tile away from shaper');

    // Pillar created at original enemy tile (5, 6)
    const pillar = (gs.glacialWalls || []).find(w => w.row === 5 && w.col === 6);
    assert.ok(pillar, 'Obsidian pillar must be erected at enemy starting tile');
    assert.strictEqual(pillar.type, 'obsidianPillar');

    // Knockback animation emitted
    assert.ok(gs.events.some(e => e.type === 'ANIMATION' && e.name === 'ObsidianPillarCast' && e.subType === 'knockback'));
  });

  test('Mode 3 Collision: Knockback into boundary or obstruction causes Daze', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);
    gs.pieces = [];

    // Place shaper at (0, 8) and enemy at (0, 9). Knockback step is (0, 1), leading to (0, 10) which is out of bounds!
    const shaper = Logic.createPiece(0, 8, 'ashMagmaShaper', 'ash', gs);
    const enemy = Logic.createPiece(0, 9, 'snowFrostLord', 'snow', gs);
    gs.pieces.push(shaper, enemy);
    gs.currentTurn = 'ash';

    const target = { r: 0, c: 9 };
    const success = Logic.executeAbility(shaper, target, 'ObsidianPillar', gs);

    assert.strictEqual(success, true);
    assert.strictEqual(enemy.col, 9, 'Enemy must remain in place when knockback destination is out of bounds');
    assert.strictEqual(enemy.isDazed, true, 'Enemy must be dazed by collision');
    assert.ok(enemy.dazedFor >= 2, 'Enemy must be dazed for at least 2 turns');

    // Collision animation emitted
    assert.ok(gs.events.some(e => e.type === 'ANIMATION' && e.name === 'ObsidianPillarCast' && e.subType === 'slam'));
  });

  test('Pillar expiration drops magma shards terrain', async () => {
    const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
    const gs = createBaseGameState();
    Logic.initGame(gs);

    gs.glacialWalls = [{
      row: 4,
      col: 4,
      duration: 1, // Will expire this turn
      type: 'obsidianPillar'
    }];

    // Trigger end-of-turn cleanup
    Logic.switchTurn(gs);

    assert.strictEqual((gs.glacialWalls || []).length, 0, 'Wall must be removed upon expiration');
    const shards = (gs.specialTerrains || []).find(st => st.row === 4 && st.col === 4 && st.type === 'magmaShards');
    assert.ok(shards, 'Expired obsidian pillar must spawn magmaShards');
    assert.ok(gs.events.some(e => e.type === 'ANIMATION' && e.name === 'WallShatter'));
  });

});
