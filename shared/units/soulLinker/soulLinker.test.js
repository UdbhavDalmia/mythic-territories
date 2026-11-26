import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SoulLinkerUnit, FateLinkAbility } from '@soulLinker/index.js';

describe('Soul Linker Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(SoulLinkerUnit.key, 'snowSoulLinker');
    assert.equal(SoulLinkerUnit.team, 'snow');
    assert.equal(SoulLinkerUnit.role, 'Siphoner');
    assert.equal(SoulLinkerUnit.stats.stats.hp, 8);
    assert.ok(SoulLinkerUnit.abilities.FateLink);
  });

  it('FateLink creates a tether between source and target pieces', () => {
    const linker = { id: 'sl1', key: 'snowSoulLinker', team: 'snow', row: 3, col: 3 };
    const enemyTarget = { id: 'en1', key: 'ashBeast', team: 'ash', row: 3, col: 4 };
    const allyTarget = { id: 'al1', key: 'snowMage', team: 'snow', row: 4, col: 3 };
    const gs = {
      pieces: [linker, enemyTarget, allyTarget],
      fateLinks: [],
      events: []
    };

    FateLinkAbility.effect(linker, { r: 4, c: 3, target1: enemyTarget }, gs);

    assert.equal(gs.fateLinks.length, 1);
    assert.equal(gs.fateLinks[0].sourceId, 'en1');
    assert.equal(gs.fateLinks[0].targetId, 'al1');
  });
});
