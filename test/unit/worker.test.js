import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: AI Worker & State Cloning', () => {

  // =========================================================================
  // Feature 2: StructuredClone in AI Worker
  // =========================================================================
  describe('StructuredClone Implementation', () => {
    test('ai.worker.js deepClone utilizes structuredClone instead of JSON stringify/parse', () => {
      const workerPath = path.resolve(rootDir, 'client/src/workers/ai.worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');
      assert.ok(content.includes('structuredClone'), 'ai.worker.js must utilize structuredClone');
      assert.ok(content.includes('export function deepClone'), 'ai.worker.js must export deepClone');
    });

    test('deepClone preserves snowTerritory and ashTerritory as active Set instances', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const original = createBaseGameState();
      original.snowTerritory = new Set(['0,4', '1,2']);
      original.ashTerritory = new Set(['9,4', '8,2']);

      const cloned = deepClone(original);
      assert.ok(cloned, 'Cloned state must be non-null');
      assert.ok(cloned.snowTerritory instanceof Set, 'cloned.snowTerritory must be an instance of Set');
      assert.ok(cloned.ashTerritory instanceof Set, 'cloned.ashTerritory must be an instance of Set');
      assert.strictEqual(cloned.snowTerritory.size, original.snowTerritory.size);
      assert.strictEqual(cloned.ashTerritory.size, original.ashTerritory.size);
      assert.ok(cloned.snowTerritory.has('0,4'));
    });

    test('deepClone re-links temporaryBoosts and debuffs piece references to cloned pieces', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const original = createBaseGameState();
      const origTarget = original.pieces[0];
      original.temporaryBoosts = [
        { pieceId: origTarget.id, piece: origTarget, amount: 4, stat: 'power' }
      ];
      original.debuffs = [
        { pieceId: original.pieces[1].id, piece: original.pieces[1], amount: -2, stat: 'control' }
      ];

      const cloned = deepClone(original);
      assert.ok(cloned.temporaryBoosts.length > 0);
      assert.strictEqual(cloned.temporaryBoosts[0].piece, cloned.pieces[0], 'temporaryBoost.piece must reference the cloned piece instance');
      assert.notStrictEqual(cloned.temporaryBoosts[0].piece, origTarget, 'cloned temporaryBoost must not reference original piece instance');
      assert.strictEqual(cloned.debuffs[0].piece, cloned.pieces[1]);
    });

    test('deepClone re-links markedPieces target references to cloned piece instances', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const original = createBaseGameState();
      const targetPiece = original.pieces[2];
      original.markedPieces = [
        { targetId: targetPiece.id, target: targetPiece, sourceTeam: 'snow' }
      ];

      const cloned = deepClone(original);
      assert.strictEqual(cloned.markedPieces[0].target, cloned.pieces[2]);
      assert.notStrictEqual(cloned.markedPieces[0].target, targetPiece);
    });

    test('deepClone creates an independent deep copy of piece properties preventing mutation bleed', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const original = createBaseGameState();
      const originalHp = original.pieces[0].currentHp;

      const cloned = deepClone(original);
      cloned.pieces[0].currentHp -= 20;

      assert.strictEqual(original.pieces[0].currentHp, originalHp, 'Original piece currentHp must not mutate when cloned piece changes');
    });
  });

  // =========================================================================
  // Feature 2 Boundaries & Edge Cases
  // =========================================================================
  describe('Cloning Boundaries & Edge Cases', () => {
    test('deepClone handles empty or missing territory Sets gracefully without throwing', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const stateWithMissingSets = {
        pieces: [],
        snowTerritory: null,
        ashTerritory: undefined
      };
      assert.doesNotThrow(() => {
        const cloned = deepClone(stateWithMissingSets);
        assert.ok(cloned);
      });
    });

    test('deepClone handles unstableGrounds where creator is either an ID or piece object', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const gs = createBaseGameState();
      gs.unstableGrounds = [
        { row: 3, col: 3, creator: gs.pieces[0].id },
        { row: 4, col: 4, creator: { id: gs.pieces[1].id } }
      ];

      const cloned = deepClone(gs);
      assert.ok(cloned.unstableGrounds.length === 2);
      assert.strictEqual(cloned.unstableGrounds[0].creator, cloned.pieces[0]);
      assert.strictEqual(cloned.unstableGrounds[1].creator, cloned.pieces[1]);
    });

    test('deepClone handles cyclic references or re-linked pieces without infinite recursion', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const state = {
        pieces: [{ id: 1, name: 'Hero' }],
        cyclic: {}
      };
      state.cyclic.self = state.cyclic;

      assert.doesNotThrow(() => {
        const cloned = deepClone(state);
        assert.ok(cloned);
        assert.strictEqual(cloned.cyclic.self, cloned.cyclic);
      });
    });

    test('deepClone handles empty state or state with 0 pieces without throwing', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      assert.strictEqual(deepClone(null), null);
      assert.strictEqual(deepClone(undefined), undefined);
      const emptyCloned = deepClone({ pieces: [] });
      assert.deepStrictEqual(emptyCloned.pieces, []);
    });

    test('deepClone preserves non-standard game state properties (timers, shrine, voidScars)', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const gs = createActiveCombatGameState();
      gs.voidScarSquares = [{ row: 2, col: 2 }];
      gs.customFlag = 'mythic-valor';

      const cloned = deepClone(gs);
      assert.deepStrictEqual(cloned.voidScarSquares, gs.voidScarSquares);
      assert.strictEqual(cloned.customFlag, 'mythic-valor');
      assert.strictEqual(cloned.shrineChargeLevel, gs.shrineChargeLevel);
    });

    test('deepClone with pieceId 0 correctly re-links boosts, debuffs, shields, markedPieces, and unstableGrounds', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));

      const piece0 = {
        id: 0,
        key: 'snowFrostLord',
        name: 'Frost Lord',
        team: 'snow',
        row: 0,
        col: 4,
        maxHp: 100,
        currentHp: 100,
        power: 24,
        control: 18,
        defense: 12,
        isLeader: true,
        isVeteran: false
      };

      const state = {
        pieces: [piece0],
        temporaryBoosts: [{ pieceId: 0, piece: piece0, amount: 2 }],
        debuffs: [{ pieceId: 0, piece: piece0, amount: -1 }],
        shields: [{ pieceId: 0, piece: piece0, amount: 5 }],
        markedPieces: [{ targetId: 0, target: piece0, sourceTeam: 'ash' }],
        unstableGrounds: [
          { r: 2, c: 2, creator: 0 },
          { r: 3, c: 3, creator: { id: 0 } }
        ],
        snowTerritory: new Set(['0,4']),
        ashTerritory: new Set(['9,4'])
      };

      const cloned = deepClone(state);
      assert.ok(cloned, 'Cloned state must exist');
      const clonedPiece0 = cloned.pieces[0];
      assert.strictEqual(clonedPiece0.id, 0);

      assert.strictEqual(cloned.temporaryBoosts[0].piece, clonedPiece0, 'temporaryBoosts must link to cloned piece 0');
      assert.strictEqual(cloned.debuffs[0].piece, clonedPiece0, 'debuffs must link to cloned piece 0');
      assert.strictEqual(cloned.shields[0].piece, clonedPiece0, 'shields must link to cloned piece 0');
      assert.strictEqual(cloned.markedPieces[0].target, clonedPiece0, 'markedPieces must link to cloned piece 0');
      assert.strictEqual(cloned.unstableGrounds[0].creator, clonedPiece0, 'unstableGrounds with primitive creator id 0 must link to cloned piece 0');
      assert.strictEqual(cloned.unstableGrounds[1].creator, clonedPiece0, 'unstableGrounds with object creator id 0 must link to cloned piece 0');
    });

    test('deepClone handles function closures gracefully via fallback without throwing DataCloneError', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));

      const stateWithFunctions = {
        pieces: [
          {
            id: 1,
            key: 'snowFrostLord',
            ability: {
              name: 'Frostfall Blessing',
              effect: () => { /* closure */ }
            }
          }
        ],
        unrelatedHelper: function () { return 42; },
        snowTerritory: new Set(['0,4']),
        ashTerritory: new Set(['9,4'])
      };

      let cloned;
      assert.doesNotThrow(() => {
        cloned = deepClone(stateWithFunctions);
      }, 'deepClone must not throw DataCloneError when object contains functions');

      assert.ok(cloned, 'Cloned state must exist');
      assert.strictEqual(cloned.pieces[0].id, 1);
      assert.ok(cloned.snowTerritory instanceof Set, 'snowTerritory must be Set');
      assert.ok(cloned.snowTerritory.has('0,4'));
    });

    test('deepClone handles null entries in pieces array without throwing TypeError', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));

      const state = {
        pieces: [null, { id: 2, key: 'snowIceWeaver' }, null],
        temporaryBoosts: [{ pieceId: 2 }],
        snowTerritory: new Set()
      };

      let cloned;
      assert.doesNotThrow(() => {
        cloned = deepClone(state);
      });
      assert.ok(cloned);
      assert.strictEqual(cloned.temporaryBoosts[0].piece, cloned.pieces[1]);
    });
  });

});
