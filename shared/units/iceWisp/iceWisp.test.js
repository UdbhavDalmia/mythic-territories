import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IceWispUnit, handleColdFarewellDeath } from '@iceWisp/index.js';

describe('Ice Wisp Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(IceWispUnit.key, 'snowIceWisp');
    assert.equal(IceWispUnit.team, 'snow');
    assert.equal(IceWispUnit.role, 'Minion');
    assert.equal(IceWispUnit.stats.stats.hp, 2);
    assert.ok(typeof IceWispUnit.handlers.onDeath === 'function');
    assert.ok(typeof IceWispUnit.handlers.cannotAttack === 'function');
  });

  it('cannotAttack returns true when power is 0 or less', () => {
    const wispZero = { key: 'snowIceWisp', power: 0 };
    const wispBuffed = { key: 'snowIceWisp', power: 1 };
    assert.equal(IceWispUnit.handlers.cannotAttack(wispZero), true);
    assert.equal(IceWispUnit.handlers.cannotAttack(wispBuffed), false);
  });

  it('handleColdFarewellDeath damages enemies and buffs allies upon destruction', () => {
    const wisp = { id: 'w1', key: 'snowIceWisp', team: 'snow', row: 4, col: 4, currentHp: 0 };
    const enemy = { id: 'en1', key: 'ashBeast', team: 'ash', row: 4, col: 5, currentHp: 3 };
    const ally = { id: 'al1', key: 'snowKnight', team: 'snow', row: 5, col: 4, currentHp: 5 };
    const gs = {
      pieces: [wisp, enemy, ally],
      temporaryBoosts: [],
      debuffs: [],
      blizzardStorms: [],
      events: []
    };

    handleColdFarewellDeath(wisp, null, gs);

    assert.equal(enemy.currentHp, 1); // 3 - 2 dmg
    assert.ok(gs.debuffs.some(d => d.pieceId === 'en1' && d.name === 'ColdFarewellAgi'));
    assert.ok(gs.temporaryBoosts.some(b => b.pieceId === 'al1' && b.name === 'ColdFarewellStr'));
    assert.equal(gs.blizzardStorms.length, 1);
  });
});
