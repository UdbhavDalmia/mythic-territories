import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Unit Catalog & Asset Integrity', () => {
  test('Every piece type has valid combat stats (power, hp, def, str, agi, ctrl)', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    assert.ok(C.PIECE_TYPES, 'PIECE_TYPES must exist');

    const keys = Object.keys(C.PIECE_TYPES);
    assert.ok(keys.length >= 20, `Expected at least 20 unit types, got ${keys.length}`);

    for (const key of keys) {
      const piece = C.PIECE_TYPES[key];
      assert.ok(piece.name, `${key} must have a name`);
      assert.ok(typeof piece.power === 'number' && piece.power >= 0, `${key} power must be non-negative number`);

      const stats = piece.stats;
      assert.ok(stats, `${key} must have stats object`);
      assert.ok(typeof stats.hp === 'number' && stats.hp > 0, `${key} stats.hp must be > 0`);
      assert.ok(typeof stats.def === 'number' && stats.def >= 0, `${key} stats.def must be >= 0`);
      assert.ok(typeof stats.strength === 'number' && stats.strength >= 0, `${key} stats.strength must be >= 0`);
      assert.ok(typeof stats.range === 'number' && stats.range > 0, `${key} stats.range must be > 0`);
      assert.ok(typeof stats.agility === 'number' && stats.agility > 0, `${key} stats.agility must be > 0`);
      assert.ok(typeof stats.control === 'number' && stats.control >= 0, `${key} stats.control must be >= 0`);
    }
  });

  test('Every primary ability referenced in PIECE_TYPES exists in ABILITIES with valid properties', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));

    for (const [key, piece] of Object.entries(C.PIECE_TYPES)) {
      if (piece.ability) {
        const abilityKey = piece.ability.key || piece.ability.name;
        assert.ok(abilityKey, `${key} ability must have a key or name`);
        const def = C.ABILITIES[abilityKey];
        assert.ok(def, `Ability ${abilityKey} for unit ${key} must exist in ABILITIES dictionary`);
        const cooldown = def.cooldown ?? C.ABILITY_VALUES[abilityKey]?.cooldown;
        assert.ok(typeof cooldown === 'number' && cooldown >= 0, `Ability ${abilityKey} cooldown must be >= 0`);
      }
    }
  });

  test('All unit images in IMAGES resolve to existing webp files in client/public/', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    assert.ok(C.IMAGES, 'IMAGES dictionary must exist');

    for (const [key, assetPath] of Object.entries(C.IMAGES)) {
      const fullPath = path.resolve(rootDir, 'client/public', assetPath);
      assert.ok(fs.existsSync(fullPath), `Asset file for ${key} must exist at ${fullPath}`);
    }
  });

  test('Leader pieces (Frost Lord and Ash Tyrant) exist and have designated leader properties', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    const frostLord = C.PIECE_TYPES.snowFrostLord;
    const ashTyrant = C.PIECE_TYPES.ashAshTyrant;

    assert.ok(frostLord, 'snowFrostLord must exist in PIECE_TYPES');
    assert.ok(ashTyrant, 'ashAshTyrant must exist in PIECE_TYPES');

    // Both leaders have highest baseline power in their respective factions
    assert.ok(frostLord.power >= 5, 'Frost Lord power must be top-tier');
    assert.ok(ashTyrant.power >= 5, 'Ash Tyrant power must be top-tier');
  });

  test('Both Frost and Ash starting layouts in SHAPES contain full team rosters', async () => {
    const C = await import(path.resolve(rootDir, 'shared/constants.js'));
    assert.ok(C.SHAPES.topLayout && C.SHAPES.bottomLayout, 'Both top and bottom layouts must be defined');
    assert.strictEqual(C.SHAPES.topLayout.length, 10, 'Ash starting layout must contain 10 units');
    assert.strictEqual(C.SHAPES.bottomLayout.length, 10, 'Snow starting layout must contain 10 units');
  });
});
