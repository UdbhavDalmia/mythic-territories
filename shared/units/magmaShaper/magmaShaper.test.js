import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MagmaShaperUnit, ObsidianPillarAbility } from '@magmaShaper/index.js';

describe('Magma Shaper Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(MagmaShaperUnit.key, 'ashMagmaShaper');
    assert.equal(MagmaShaperUnit.team, 'ash');
    assert.equal(MagmaShaperUnit.role, 'Mystic');
    assert.equal(MagmaShaperUnit.stats.stats.hp, 7);
    assert.ok(MagmaShaperUnit.abilities.ObsidianPillar);
  });

  it('ObsidianPillar on empty tile raises pillar wall and claims Ash territory', () => {
    const shaper = { id: 'ms1', key: 'ashMagmaShaper', team: 'ash', row: 5, col: 5 };
    const gs = {
      pieces: [shaper],
      glacialWalls: [],
      ashTerritory: new Set(),
      snowTerritory: new Set(),
      territoryCaptureTurn: {},
      turnCount: 1,
      events: []
    };

    ObsidianPillarAbility.effect(shaper, { r: 5, c: 6 }, gs);

    assert.equal(gs.glacialWalls.length, 1);
    assert.equal(gs.glacialWalls[0].type, 'obsidianPillar');
    assert.ok(gs.ashTerritory.has('5,6'));
  });

  it('ObsidianPillar on ally grants ObsidianPillarShield', () => {
    const shaper = { id: 'ms1', key: 'ashMagmaShaper', team: 'ash', row: 5, col: 5 };
    const ally = { id: 'al1', key: 'ashWarrior', team: 'ash', row: 5, col: 6 };
    const gs = {
      pieces: [shaper, ally],
      shields: [],
      events: []
    };

    ObsidianPillarAbility.effect(shaper, { r: 5, c: 6 }, gs);

    assert.equal(gs.shields.length, 1);
    assert.equal(gs.shields[0].pieceId, 'al1');
    assert.equal(gs.shields[0].name, 'ObsidianPillarShield');
  });
});
