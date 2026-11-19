import './helpers/registerHooks.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const rootDir = process.cwd();

describe('Milestone 2 Iteration 2: Edge Cases & Regression Hardening', () => {

  // =========================================================================
  // Feature 2: StructuredClone & Piece ID 0 & Function Closures
  // =========================================================================
  describe('Feature 2: deepClone Edge Cases', () => {
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

      // Verify re-linking
      assert.strictEqual(cloned.temporaryBoosts[0].piece, clonedPiece0, 'temporaryBoosts must link to cloned piece 0');
      assert.strictEqual(cloned.debuffs[0].piece, clonedPiece0, 'debuffs must link to cloned piece 0');
      assert.strictEqual(cloned.shields[0].piece, clonedPiece0, 'shields must link to cloned piece 0');
      assert.strictEqual(cloned.markedPieces[0].target, clonedPiece0, 'markedPieces must link to cloned piece 0');
      assert.strictEqual(cloned.unstableGrounds[0].creator, clonedPiece0, 'unstableGrounds with primitive creator id 0 must link to cloned piece 0');
      assert.strictEqual(cloned.unstableGrounds[1].creator, clonedPiece0, 'unstableGrounds with object creator id 0 must link to cloned piece 0');
    });

    test('deepClone handles function closures gracefully via JSON fallback without throwing DataCloneError', async () => {
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

  // =========================================================================
  // Feature 6: Multiplayer Serialization & Rehydration Edge Cases
  // =========================================================================
  describe('Feature 6: serializeDelta and rehydrateGameState Edge Cases', () => {
    test('serializeDelta includes territoryCaptureTurn, riftAnchors, dynamicRifts and secondary state fields', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));

      const gs = {
        pieces: [{ id: 1, key: 'snowFrostLord' }],
        turnCount: 5,
        currentTurn: 'snow',
        currentState: 'AWAITING_PIECE_SELECTION',
        snowTerritory: new Set(['0,4']),
        ashTerritory: new Set(['9,4']),
        territoryCaptureTurn: { '0,4': 1 },
        riftAnchors: { topLeft: { r: 1, c: 1, power: 1 }, bottomRight: { r: 8, c: 8, power: 1 } },
        dynamicRifts: [{ r: 1, c: 1 }],
        voidSquares: [{ r: 4, c: 4 }],
        elementalCores: [{ r: 5, c: 5 }],
        fateLinks: [{ sourceId: 1, targetId: 2 }],
        TheReapersTolls: [{ pieceId: 1 }],
        reignOfFires: [{ r: 6, c: 6 }],
        unstableGrounds: [{ r: 2, c: 2, creator: { id: 0 } }, null]
      };

      const serialized = serializeDelta(gs);
      const parsed = JSON.parse(serialized);

      assert.deepStrictEqual(parsed.territoryCaptureTurn, { '0,4': 1 });
      assert.ok(parsed.riftAnchors && parsed.riftAnchors.topLeft);
      assert.ok(Array.isArray(parsed.dynamicRifts));
      assert.ok(Array.isArray(parsed.voidSquares));
      assert.ok(Array.isArray(parsed.elementalCores));
      assert.ok(Array.isArray(parsed.fateLinks));
      assert.ok(Array.isArray(parsed.TheReapersTolls));
      assert.ok(Array.isArray(parsed.reignOfFires));
      assert.strictEqual(parsed.unstableGrounds.length, 1, 'unstableGrounds should filter out nulls');
      assert.strictEqual(parsed.unstableGrounds[0].creator, 0, 'unstableGrounds creator should be serialized as ID 0');
    });

    test('rehydrateGameState re-links pieceId 0 for unstableGrounds and defaults missing state fields defensively', async () => {
      const { rehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));

      const rawState = {
        pieces: [{ id: 0, key: 'snowFrostLord' }, null],
        unstableGrounds: [{ r: 2, c: 2, creator: 0 }]
      };

      const rehydrated = rehydrateGameState(rawState);
      assert.strictEqual(rehydrated.unstableGrounds[0].creator, rehydrated.pieces[0], 'creator with ID 0 must be re-linked to piece with ID 0');
      assert.ok(rehydrated.territoryCaptureTurn, 'territoryCaptureTurn must be initialized');
      assert.ok(rehydrated.riftAnchors, 'riftAnchors must be initialized');
      assert.ok(Array.isArray(rehydrated.voidSquares), 'voidSquares must be array');
      assert.ok(Array.isArray(rehydrated.elementalCores), 'elementalCores must be array');
      assert.ok(Array.isArray(rehydrated.fateLinks), 'fateLinks must be array');
      assert.ok(Array.isArray(rehydrated.TheReapersTolls), 'TheReapersTolls must be array');
      assert.ok(Array.isArray(rehydrated.reignOfFires), 'reignOfFires must be array');
      assert.ok(rehydrated.snowTerritory instanceof Set, 'snowTerritory must be Set');
      assert.ok(rehydrated.ashTerritory instanceof Set, 'ashTerritory must be Set');
    });

    test('rehydrated delta state executes Logic.movePiece (and paintTerritoryPath) without TypeError on territoryCaptureTurn', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { getValidMoves } = await import(path.resolve(rootDir, 'shared/utils.js'));
      const { serializeDelta, rehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const { createBaseGameState } = await import(path.resolve(rootDir, 'test/helpers/fixtureState.js'));

      const initial = createBaseGameState();
      Logic.initGame(initial);
      initial.gameStarted = true;

      // Serialize delta and rehydrate
      const deltaStr = serializeDelta(initial);
      const rehydrated = rehydrateGameState(JSON.parse(deltaStr));

      // Move a piece (Frost Lord)
      const lord = rehydrated.pieces.find(p => p.key === 'snowFrostLord');
      assert.ok(lord);

      Logic.selectPiece(lord, rehydrated);
      const moves = getValidMoves(lord, rehydrated);
      assert.ok(moves.length > 0, 'Frost Lord must have valid moves');
      const targetMove = moves[0];

      assert.doesNotThrow(() => {
        // Move to valid tile
        Logic.movePiece(lord, targetMove.row, targetMove.col, false, rehydrated);
      }, 'movePiece must not throw TypeError on territoryCaptureTurn');

      assert.strictEqual(lord.row, targetMove.row);
      assert.strictEqual(lord.col, targetMove.col);
      assert.ok(rehydrated.territoryCaptureTurn[`${targetMove.row},${targetMove.col}`] !== undefined, 'territoryCaptureTurn should record destination');
    });

    test('rehydrated delta state executes Logic.switchTurn with Conduit Tier 2 overcharge without TypeError on riftAnchors', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { serializeDelta, rehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const { createBaseGameState } = await import(path.resolve(rootDir, 'test/helpers/fixtureState.js'));

      const initial = createBaseGameState();
      Logic.initGame(initial);

      // Setup conduit overcharge condition right before Tier 2 trigger
      initial.conduitLinkActive = true;
      initial.conduitIsContested = false;
      initial.conduitTeam = 'snow';
      initial.conduitOverchargeProgress = {
        snow: { turnsUncontested: 2 }, // CONDUIT_OVERCHARGE_TIER2_TURNS - 1 = 3 - 1 = 2
        ash: { turnsUncontested: 0 }
      };

      // Serialize delta and rehydrate
      const deltaStr = serializeDelta(initial);
      const rehydrated = rehydrateGameState(JSON.parse(deltaStr));

      assert.doesNotThrow(() => {
        Logic.switchTurn(rehydrated);
      }, 'switchTurn with Conduit Tier 2 overcharge must not throw TypeError on riftAnchors');
    });
  });

  // =========================================================================
  // Feature 14: Pure State Passing & GlacialFracture gameStateLocal
  // =========================================================================
  describe('Feature 14: State Isolation & GlacialFracture', () => {
    test('GlacialFracture creates snowIceWisp directly in passed gameStateLocal without leaking to global state', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { createBaseGameState } = await import(path.resolve(rootDir, 'test/helpers/fixtureState.js'));

      const gsIsolated = createBaseGameState();
      Logic.initGame(gsIsolated);

      const mage = gsIsolated.pieces.find(p => p.key === 'snowGlacialMage');
      assert.ok(mage, 'snowGlacialMage must exist');

      const target = { r: mage.row - 1, c: mage.col };
      const initialPieceCount = gsIsolated.pieces.length;

      Logic.executeAbility(mage, target, 'GlacialFracture', gsIsolated);

      // Verify the new wisp was created inside gsIsolated.pieces
      const wisps = gsIsolated.pieces.filter(p => p.key === 'snowIceWisp');
      assert.ok(wisps.length > 0, 'A snowIceWisp should have been created in gsIsolated');
      assert.strictEqual(gsIsolated.pieces.length, initialPieceCount + 1);

      // Verify global state did not receive this wisp
      const defaultState = Logic.getGameState();
      if (defaultState && defaultState.pieces) {
        assert.ok(!defaultState.pieces.includes(wisps[0]), 'New wisp must not leak into default gameState');
      }
    });
  });
});
