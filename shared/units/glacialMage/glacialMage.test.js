import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GlacialMageUnit, GlacialFractureAbility, getGlacialMageDynamicStats } from '@glacialMage/index.js';

describe('Glacial Mage Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(GlacialMageUnit.key, 'snowGlacialMage');
    assert.equal(GlacialMageUnit.team, 'snow');
    assert.equal(GlacialMageUnit.role, 'Mage');
    assert.equal(GlacialMageUnit.stats.stats.hp, 7);
    assert.ok(GlacialMageUnit.abilities.GlacialFracture);
    assert.ok(typeof GlacialMageUnit.handlers.getDynamicStats === 'function');
  });

  it('GlacialFracture damages enemies and creates snowIceWisp up to cap', () => {
    const mage = { id: 'gm1', key: 'snowGlacialMage', team: 'snow', row: 3, col: 3, currentHp: 5 };
    const enemy = { id: 'en1', key: 'ashWarrior', team: 'ash', row: 3, col: 4, currentHp: 4 };
    const gs = {
      pieces: [mage, enemy],
      snowTerritory: new Set(),
      ashTerritory: new Set(),
      events: []
    };

    const createdPieces = [];
    const createPiece = (r, c, key, team) => {
      const p = { id: 'w1', row: r, col: c, key, team, currentHp: 1, power: 0 };
      createdPieces.push(p);
      return p;
    };

    GlacialFractureAbility.effect(mage, { r: 3, c: 4 }, gs, createPiece);

    assert.equal(enemy.currentHp, 2); // 4 - 2 dmg
    assert.equal(createdPieces.length, 1);
    assert.equal(createdPieces[0].key, 'snowIceWisp');
  });

  it('getGlacialMageDynamicStats grants Frost Duo boosts based on active Wisps', () => {
    const mage = { id: 'gm1', key: 'snowGlacialMage', team: 'snow' };
    const wisp1 = { id: 'w1', key: 'snowIceWisp', team: 'snow', currentHp: 1 };
    const wisp2 = { id: 'w2', key: 'snowIceWisp', team: 'snow', currentHp: 1 };
    const gs = {
      pieces: [mage, wisp1, wisp2]
    };

    const stats = getGlacialMageDynamicStats(mage, gs);
    assert.equal(stats.strengthBonus, 1);
    assert.equal(Math.round(stats.agilityBonus * 10) / 10, 0.4);
    assert.equal(Math.round(stats.controlBonus * 10) / 10, 0.4);
  });
});
