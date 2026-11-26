import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AshTyrantUnit, ReignOfFireAbility, handleDeathMeteorLethal } from '@ashTyrant/index.js';

describe('Ash Tyrant Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(AshTyrantUnit.key, 'ashAshTyrant');
    assert.equal(AshTyrantUnit.team, 'ash');
    assert.equal(AshTyrantUnit.role, 'Tyrant');
    assert.equal(AshTyrantUnit.stats.stats.hp, 12);
    assert.equal(AshTyrantUnit.stats.stats.strength, 5);
    assert.ok(AshTyrantUnit.abilities.ReignOfFire);
    assert.ok(typeof AshTyrantUnit.handlers.onLethalBlow === 'function');
    assert.ok(typeof AshTyrantUnit.handlers.isInvulnerable === 'function');
  });

  it('ReignOfFire damages enemies and damages/buffs allies', () => {
    const tyrant = { id: 'at1', key: 'ashAshTyrant', team: 'ash', row: 3, col: 3 };
    const enemy = { id: 'en1', key: 'snowWarrior', team: 'snow', row: 3, col: 4, currentHp: 5 };
    const ally = { id: 'al1', key: 'ashBeast', team: 'ash', row: 4, col: 3, currentHp: 5 };
    const gs = {
      pieces: [tyrant, enemy, ally],
      temporaryBoosts: [],
      reignOfFires: []
    };

    ReignOfFireAbility.effect(tyrant, { r: 3, c: 3 }, gs);

    assert.equal(enemy.currentHp, 3); // 5 - 2 dmg
    assert.equal(ally.currentHp, 4); // 5 - 1 ally dmg
    assert.ok(gs.temporaryBoosts.some(b => b.pieceId === 'al1' && b.name === 'ReignOfFireStr'));
  });

  it('handleDeathMeteorLethal intercepts lethal damage and triggers eruption', () => {
    const tyrant = { id: 'at1', key: 'ashAshTyrant', team: 'ash', row: 3, col: 3, currentHp: 0 };
    const enemy = { id: 'en1', key: 'snowWarrior', team: 'snow', row: 3, col: 4, currentHp: 5 };
    const gs = {
      pieces: [tyrant, enemy],
      deathMeteors: [],
      specialTerrains: [],
      unstableGrounds: [],
      events: []
    };

    let flashed = false;
    const context = {
      flash: () => { flashed = true; },
      emit: (s, ev) => { s.events.push(ev); },
      updatePiecePosition: (p, r, c) => { p.row = r; p.col = c; },
      resolveDeaths: () => {},
      ROWS: 8,
      COLS: 8
    };

    const intercepted = handleDeathMeteorLethal(tyrant, gs, context);

    assert.equal(intercepted, true);
    assert.equal(tyrant.currentHp, 1);
    assert.equal(tyrant.hasDeathMeteorInvincibility, true);
    assert.equal(flashed, true);
    assert.equal(enemy.currentHp, 1); // 5 - 4 dmg
    assert.ok(gs.specialTerrains.some(t => t.type === 'crater'));
  });
});
