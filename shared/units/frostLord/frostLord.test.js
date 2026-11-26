import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FrostLordUnit, FrostfallBlessingAbility, handleHelpFromAboveLethal, isHelpFromAboveInvulnerable, getFrostLordDynamicStats } from '@frostLord/index.js';

describe('Frost Lord Unit Domain Tests', () => {
  it('manifest contains correct metadata, stats, and abilities', () => {
    assert.equal(FrostLordUnit.key, 'snowFrostLord');
    assert.equal(FrostLordUnit.team, 'snow');
    assert.equal(FrostLordUnit.role, 'Tyrant');
    assert.equal(FrostLordUnit.stats.stats.hp, 12);
    assert.equal(FrostLordUnit.stats.stats.strength, 5);
    assert.ok(FrostLordUnit.abilities.FrostfallBlessing);
    assert.ok(typeof FrostLordUnit.handlers.onLethalBlow === 'function');
    assert.ok(typeof FrostLordUnit.handlers.isInvulnerable === 'function');
  });

  it('FrostfallBlessing places blessing zone and shields allies within radius', () => {
    const caster = { id: 'fl1', key: 'snowFrostLord', team: 'snow', row: 4, col: 4 };
    const ally = { id: 'ally1', key: 'snowWarrior', team: 'snow', row: 5, col: 4 };
    const gs = {
      pieces: [caster, ally],
      frostfallBlessings: [],
      shields: []
    };

    FrostfallBlessingAbility.effect(caster, { r: 5, c: 4 }, gs);

    assert.equal(gs.frostfallBlessings.length, 1);
    assert.equal(gs.frostfallBlessings[0].creatorId, 'fl1');
    assert.ok(gs.shields.some(s => s.pieceId === 'ally1'));
    assert.ok(gs.shields.some(s => s.pieceId === 'fl1'));
  });

  it('handleHelpFromAboveLethal saves Frost Lord and grants nearby ally strength boost', () => {
    const lord = { id: 'fl1', key: 'snowFrostLord', team: 'snow', row: 4, col: 4, currentHp: 0 };
    const ally = { id: 'ally1', key: 'snowMage', team: 'snow', row: 4, col: 5, currentHp: 4 };
    const gs = {
      pieces: [lord, ally],
      temporaryBoosts: [],
      events: []
    };

    let flashed = false;
    const flash = () => { flashed = true; };

    const intercepted = handleHelpFromAboveLethal(lord, gs, flash);

    assert.equal(intercepted, true);
    assert.equal(lord.currentHp, 1);
    assert.equal(lord.hasHelpFromAboveActive, true);
    assert.equal(flashed, true);
    assert.ok(gs.temporaryBoosts.some(b => b.pieceId === 'ally1' && b.name === 'HelpFromAboveStr'));
  });

  it('isHelpFromAboveInvulnerable returns true when active and dynamic stats override strength', () => {
    const lord = { key: 'snowFrostLord', hasHelpFromAboveActive: true };
    assert.equal(isHelpFromAboveInvulnerable(lord), true);
    const stats = getFrostLordDynamicStats(lord, {});
    assert.equal(stats?.strengthOverride, 3);
  });
});
