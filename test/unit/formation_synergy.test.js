import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const rootDir = process.cwd();

describe('Unit: Formation Synergy & Asymmetric Stat/Territory Boosts', () => {
  test('isStrongPiece and isWeakerPiece correctly categorize leaders, heavy tanks, elites, and minions', async () => {
    const { isStrongPiece, isWeakerPiece } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const ashTyrant = { id: 'at', key: 'ashAshTyrant', team: 'ash', isLeader: true };
    const frostLord = { id: 'fl', key: 'snowFrostLord', team: 'snow', isLeader: true };
    const glacialBrute = { id: 'gb', key: 'snowGlacialBrute', team: 'snow' };
    const blazeboundBeast = { id: 'bb', key: 'ashBlazeboundBeast', team: 'ash' };
    const magmaSpitter = { id: 'ms', key: 'ashMagmaSpitter', team: 'ash' }; // str 5
    const rampagingYeti = { id: 'ry', key: 'snowRampagingYeti', team: 'snow' }; // hp 10

    assert.strictEqual(isStrongPiece(ashTyrant), true, 'Ash Tyrant must be strong');
    assert.strictEqual(isStrongPiece(frostLord), true, 'Frost Lord must be strong');
    assert.strictEqual(isStrongPiece(glacialBrute), true, 'Glacial Brute must be strong');
    assert.strictEqual(isStrongPiece(blazeboundBeast), true, 'Blazebound Beast must be strong');
    assert.strictEqual(isStrongPiece(magmaSpitter), true, 'Magma Spitter must be strong');
    assert.strictEqual(isStrongPiece(rampagingYeti), true, 'Rampaging Yeti must be strong');

    assert.strictEqual(isWeakerPiece(ashTyrant), false);
    assert.strictEqual(isWeakerPiece(frostLord), false);

    // Weaker units
    const ashStrider = { id: 'as', key: 'ashAshStrider', team: 'ash' };
    const cinderScout = { id: 'cs', key: 'ashCinderScout', team: 'ash' };
    const arcticTrapper = { id: 'tr', key: 'snowArcticTrapper', team: 'snow' };
    const iceWeaver = { id: 'iw', key: 'snowIceWeaver', team: 'snow' };
    const iceWisp = { id: 'wisp', key: 'snowIceWisp', team: 'snow' };

    assert.strictEqual(isStrongPiece(ashStrider), false, 'Ash Strider is weaker');
    assert.strictEqual(isStrongPiece(cinderScout), false, 'Cinder Scout is weaker');
    assert.strictEqual(isStrongPiece(arcticTrapper), false, 'Arctic Trapper is weaker');
    assert.strictEqual(isStrongPiece(iceWeaver), false, 'Ice Weaver is weaker');
    assert.strictEqual(isStrongPiece(iceWisp), false, 'Ice Wisp is weaker');

    assert.strictEqual(isWeakerPiece(ashStrider), true);
    assert.strictEqual(isWeakerPiece(iceWisp), true);
  });

  test('Weaker unit receives no synergy when isolated (0 nearby allies)', async () => {
    const { getFormationSynergy } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const strider = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 5 };
    const enemy = { id: 'e1', key: 'snowIceWeaver', team: 'snow', col: 5, row: 6 };
    const farAlly = { id: 's2', key: 'ashAshStrider', team: 'ash', col: 1, row: 1 };

    const gs = { pieces: [strider, enemy, farAlly] };
    const synergy = getFormationSynergy(strider, gs);

    assert.strictEqual(synergy.strBonus, 0);
    assert.strictEqual(synergy.defBonus, 0);
    assert.strictEqual(synergy.ctrlBonus, 0);
    assert.strictEqual(synergy.weightMult, 1.0);
    assert.strictEqual(synergy.radiusBonus, 0.0);
    assert.strictEqual(synergy.allyCount, 0);
  });

  test('Weaker units gain DEF and Voronoi territory boosts when paired with 1 ally', async () => {
    const { getFormationSynergy } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const strider1 = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 5 };
    const strider2 = { id: 's2', key: 'ashAshStrider', team: 'ash', col: 5, row: 6 }; // adjacent dist=1

    const gs = { pieces: [strider1, strider2] };
    const syn1 = getFormationSynergy(strider1, gs);

    assert.strictEqual(syn1.allyCount, 1);
    assert.strictEqual(syn1.hasStrongAlly, false);
    assert.strictEqual(syn1.defBonus, 1, 'Pair of minions gains +1 DEF');
    assert.strictEqual(syn1.strBonus, 0);
    assert.ok(syn1.ctrlBonus >= 0.15, 'Gains control boost');
    assert.ok(syn1.weightMult > 1.0, 'Gains Voronoi push weight mult');
    assert.ok(syn1.radiusBonus > 0, 'Gains Voronoi radius expansion');
  });

  test('Weaker units gain offensive STR, DEF and heavy Voronoi weight when in numbers (pack of 3+)', async () => {
    const { getFormationSynergy } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const s1 = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 5 };
    const s2 = { id: 's2', key: 'ashAshStrider', team: 'ash', col: 5, row: 6 };
    const s3 = { id: 's3', key: 'ashCinderScout', team: 'ash', col: 6, row: 5 };

    const gs = { pieces: [s1, s2, s3] };
    const syn = getFormationSynergy(s1, gs);

    assert.strictEqual(syn.allyCount, 2);
    assert.strictEqual(syn.hasStrongAlly, false);
    assert.strictEqual(syn.defBonus, 1);
    assert.strictEqual(syn.strBonus, 1, 'Pack of 3 minions gains +1 STR in numbers');
    assert.ok(syn.weightMult >= 1.15, 'Significant Voronoi push weight');
    assert.ok(syn.radiusBonus >= 0.2, 'Significant Voronoi radius bonus');
  });

  test('Weaker units gain Vanguard/Escort boosts when accompanied by a strong unit', async () => {
    const { getFormationSynergy } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const strider = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 5 };
    const tyrant = { id: 'at', key: 'ashAshTyrant', team: 'ash', col: 5, row: 6, isLeader: true };

    const gs = { pieces: [strider, tyrant] };
    const synStrider = getFormationSynergy(strider, gs);

    assert.strictEqual(synStrider.allyCount, 1);
    assert.strictEqual(synStrider.hasStrongAlly, true);
    assert.strictEqual(synStrider.defBonus, 2, 'Minion near Leader/Tank gains +2 DEF');
    assert.strictEqual(synStrider.strBonus, 1, 'Minion near Leader/Tank gains +1 STR inspiration');
    assert.ok(synStrider.ctrlBonus >= 0.35, 'Enhanced Control');
    assert.ok(synStrider.weightMult >= 1.2, 'Enhanced Voronoi push weight');
  });

  test('CRITICAL ASYMMETRY: Stronger units receive NO boosts from weaker units or from grouping', async () => {
    const { getFormationSynergy, getEffectiveStrength, getEffectiveDefense, getEffectiveControl } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const tyrant = { id: 'at', key: 'ashAshTyrant', team: 'ash', col: 5, row: 5, strength: 5, def: 3, control: 1.3, isLeader: true };
    const s1 = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 6 };
    const s2 = { id: 's2', key: 'ashAshStrider', team: 'ash', col: 6, row: 5 };
    const s3 = { id: 's3', key: 'ashCinderScout', team: 'ash', col: 4, row: 5 };
    const beast = { id: 'bb', key: 'ashBlazeboundBeast', team: 'ash', col: 6, row: 6 };

    // Tyrant surrounded by 3 weaker units and 1 other strong unit
    const gs = { pieces: [tyrant, s1, s2, s3, beast] };

    const tyrantSynergy = getFormationSynergy(tyrant, gs);
    assert.strictEqual(tyrantSynergy.strBonus, 0, 'Stronger unit must get 0 strBonus');
    assert.strictEqual(tyrantSynergy.defBonus, 0, 'Stronger unit must get 0 defBonus');
    assert.strictEqual(tyrantSynergy.ctrlBonus, 0, 'Stronger unit must get 0 ctrlBonus');
    assert.strictEqual(tyrantSynergy.weightMult, 1.0, 'Stronger unit weightMult must remain 1.0');
    assert.strictEqual(tyrantSynergy.radiusBonus, 0.0, 'Stronger unit radiusBonus must remain 0.0');

    // Effective stats for tyrant remain uninflated by grouping
    const effStr = getEffectiveStrength(tyrant, gs);
    const effDef = getEffectiveDefense(tyrant, gs);
    const effCtrl = getEffectiveControl(tyrant, gs);

    assert.strictEqual(effStr, 5, 'Tyrant effective strength unaffected by minions');
    assert.strictEqual(effDef, 3, 'Tyrant effective defense unaffected by minions');
    assert.strictEqual(effCtrl, 1.3, 'Tyrant effective control unaffected by minions');
  });

  test('Effective stats for weaker units reflect formation synergy dynamically', async () => {
    const { getEffectiveStrength, getEffectiveDefense, getEffectiveControl } = await import(path.resolve(rootDir, 'shared/utils.js'));

    const strider1 = { id: 's1', key: 'ashAshStrider', team: 'ash', col: 5, row: 5, strength: 2, def: 1, control: 0.1 };
    const strider2 = { id: 's2', key: 'ashAshStrider', team: 'ash', col: 5, row: 6, strength: 2, def: 1, control: 0.1 };
    const strider3 = { id: 's3', key: 'ashAshStrider', team: 'ash', col: 6, row: 5, strength: 2, def: 1, control: 0.1 };

    const gs = { pieces: [strider1, strider2, strider3] };

    const effStr = getEffectiveStrength(strider1, gs);
    const effDef = getEffectiveDefense(strider1, gs);
    const effCtrl = getEffectiveControl(strider1, gs);

    assert.strictEqual(effStr, 3, 'Base 2 STR + 1 pack synergy = 3');
    assert.strictEqual(effDef, 2, 'Base 1 DEF + 1 formation synergy = 2');
    assert.ok(effCtrl >= 0.39, 'Base 0.1 Ctrl + 0.30 pack synergy >= 0.39');
  });

  test('computePowerDiagram expands territorial weight and radius of weaker units in formation', async () => {
    const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));

    const isolatedMinion = [{ id: 'm1', key: 'snowArcticTrapper', team: 'snow', col: 5, row: 5, power: 2, control: 0.1, strength: 2 }];
    const diagIsolated = computePowerDiagram(isolatedMinion);
    const isolatedCell = diagIsolated.cells[0];

    const pairedMinions = [
      { id: 'm1', key: 'snowArcticTrapper', team: 'snow', col: 5, row: 5, power: 2, control: 0.1, strength: 2 },
      { id: 'm2', key: 'snowArcticTrapper', team: 'snow', col: 5, row: 6, power: 2, control: 0.1, strength: 2 }
    ];
    const diagPaired = computePowerDiagram(pairedMinions);
    const pairedCell = diagPaired.cells.find(c => c.pieceId === 'm1');

    assert.ok(pairedCell.weight > isolatedCell.weight, `Paired weight (${pairedCell.weight}) must exceed isolated weight (${isolatedCell.weight})`);
    assert.ok(pairedCell.radius > isolatedCell.radius, `Paired radius (${pairedCell.radius}) must exceed isolated radius (${isolatedCell.radius})`);
  });
});
