import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AshReaperUnit, TheReapersTollAbility } from '@ashReaper/index.js';

describe('Ash Reaper Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(AshReaperUnit.key, 'ashAshReaper');
    assert.equal(AshReaperUnit.team, 'ash');
    assert.equal(AshReaperUnit.role, 'Siphoner');
    assert.equal(AshReaperUnit.stats.stats.hp, 8);
    assert.ok(AshReaperUnit.abilities.TheReapersToll);
  });

  it('TheReapersToll steals DEF and Agility from enemy target', () => {
    const reaper = { id: 'ar1', key: 'ashAshReaper', team: 'ash', row: 2, col: 2, def: 0, agility: 2 };
    const enemy = { id: 'en1', key: 'snowKnight', team: 'snow', row: 2, col: 4, def: 2, agility: 2 };
    const gs = {
      pieces: [reaper, enemy],
      TheReapersTolls: []
    };

    TheReapersTollAbility.effect(reaper, { r: 2, c: 4 }, gs);

    assert.equal(reaper.def, 1);
    assert.equal(reaper.agility, 2.4);
    assert.equal(enemy.def, 1);
    assert.equal(enemy.agility, 1.6);
    assert.equal(gs.TheReapersTolls.length, 1);
  });
});
