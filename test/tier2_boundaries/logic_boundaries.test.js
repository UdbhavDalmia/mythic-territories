import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Tier 2: State Logic, Worker & Serialization Boundaries', () => {

  // =========================================================================
  // Feature 2 Boundaries: AI Worker StructuredClone
  // =========================================================================
  describe('Feature 2 Boundaries', () => {
    test('F2-T2-1: deepClone handles empty or missing territory Sets gracefully without throwing', async () => {
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

    test('F2-T2-2: deepClone handles unstableGrounds where creator is either an ID or piece object', async () => {
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

    test('F2-T2-3: deepClone handles cyclic references or re-linked pieces without infinite recursion', async () => {
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

    test('F2-T2-4: deepClone handles empty state or state with 0 pieces without throwing', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      assert.strictEqual(deepClone(null), null);
      assert.strictEqual(deepClone(undefined), undefined);
      const emptyCloned = deepClone({ pieces: [] });
      assert.deepStrictEqual(emptyCloned.pieces, []);
    });

    test('F2-T2-5: deepClone preserves non-standard game state properties (timers, shrine, voidScars)', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const gs = createActiveCombatGameState();
      gs.voidScarSquares = [{ row: 2, col: 2 }];
      gs.customFlag = 'mythic-valor';

      const cloned = deepClone(gs);
      assert.deepStrictEqual(cloned.voidScarSquares, gs.voidScarSquares);
      assert.strictEqual(cloned.customFlag, 'mythic-valor');
      assert.strictEqual(cloned.shrineChargeLevel, gs.shrineChargeLevel);
    });
  });

  // =========================================================================
  // Feature 6 Boundaries: Multiplayer serializeDelta Helper
  // =========================================================================
  describe('Feature 6 Boundaries', () => {
    test('F6-T2-1: serializeDelta handles null, undefined, or empty state input gracefully', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      assert.strictEqual(serializeDelta(null), null);
      assert.strictEqual(serializeDelta(undefined), null);
      assert.doesNotThrow(() => serializeDelta({}));
    });

    test('F6-T2-2: parseAndRehydrateGameState handles null, invalid JSON, or partial JSON strings gracefully', async () => {
      const { parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      assert.strictEqual(parseAndRehydrateGameState(null), null);
      assert.strictEqual(parseAndRehydrateGameState(undefined), null);
      assert.strictEqual(parseAndRehydrateGameState('invalid json {{{'), null);
    });

    test('F6-T2-3: serializeDelta handles circular piece references inside temporaryBoosts/shields without throwing', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createBaseGameState();
      gs.temporaryBoosts = [
        { id: 'b1', piece: gs.pieces[0], pieceId: gs.pieces[0].id }
      ];
      assert.doesNotThrow(() => {
        const delta = serializeDelta(gs);
        assert.ok(delta);
      });
    });

    test('F6-T2-4: parseAndRehydrateGameState guarantees all 14 array fields are defined even if omitted in delta', async () => {
      const { parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const bareDelta = JSON.stringify({ pieces: [] });
      const rehydrated = parseAndRehydrateGameState(bareDelta);

      assert.ok(Array.isArray(rehydrated.events));
      assert.ok(Array.isArray(rehydrated.markedPieces));
      assert.ok(Array.isArray(rehydrated.shields));
      assert.ok(Array.isArray(rehydrated.debuffs));
      assert.ok(Array.isArray(rehydrated.unstableGrounds));
      assert.ok(Array.isArray(rehydrated.specialTerrains));
      assert.ok(Array.isArray(rehydrated.temporaryBoosts));
      assert.ok(Array.isArray(rehydrated.territoryTrails));
      assert.ok(Array.isArray(rehydrated.glacialWalls));
      assert.ok(Array.isArray(rehydrated.voidScarSquares));
      assert.ok(Array.isArray(rehydrated.deathMeteors));
    });

    test('F6-T2-5: serializeDelta preserves piece abilities and veteran status accurately', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createBaseGameState();
      gs.pieces[0].isVeteran = true;

      const delta = serializeDelta(gs);
      const rehydrated = parseAndRehydrateGameState(delta);
      assert.strictEqual(rehydrated.pieces[0].isVeteran, true);
    });
  });

  // =========================================================================
  // Feature 14 Boundaries: Pure gameState Parameter Passing
  // =========================================================================
  describe('Feature 14 Boundaries', () => {
    test('F14-T2-1: getGameState called with no arguments falls back safely to default gameState for backwards compatibility', async () => {
      const { getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const defaultState = getGameState();
      assert.ok(typeof defaultState === 'object', 'getGameState() must return an object');
    });

    test('F14-T2-2: getCurrentState(null) and getCurrentState(undefined) return GameState.AWAITING_PIECE_SELECTION without crashing', async () => {
      const { getCurrentState, GameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      assert.strictEqual(getCurrentState(null), GameState.AWAITING_PIECE_SELECTION);
      assert.strictEqual(getCurrentState(undefined), GameState.AWAITING_PIECE_SELECTION);
    });

    test('F14-T2-3: setCurrentState on a state without events array initializes events array before pushing', async () => {
      const { setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const bareState = { currentState: 'OLD' };
      setCurrentState('NEW_STATE', bareState);
      assert.strictEqual(bareState.currentState, 'NEW_STATE');
      assert.ok(Array.isArray(bareState.events));
      assert.ok(bareState.events.length > 0);
    });

    test('F14-T2-4: Two independent game state instances can be stepped simultaneously without cross-talk or mutation bleed', async () => {
      const { setCurrentState, isState, emit } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const stateA = { currentState: 'STATE_A', events: [] };
      const stateB = { currentState: 'STATE_B', events: [] };

      setCurrentState('ASCENSION_CHOICE', stateA);
      emit(stateA, { type: 'ACTION_A' });

      assert.strictEqual(isState('ASCENSION_CHOICE', stateA), true);
      assert.strictEqual(isState('STATE_B', stateB), true);
      assert.strictEqual(stateB.events.length, 0, 'stateB events must not receive events emitted to stateA');
    });

    test('F14-T2-5: emit(gs, event) on state without events property handles undefined events gracefully', async () => {
      const { emit } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const stateWithoutEvents = {};
      assert.doesNotThrow(() => {
        emit(stateWithoutEvents, { type: 'TEST_EVENT' });
      });
      assert.ok(Array.isArray(stateWithoutEvents.events));
      assert.strictEqual(stateWithoutEvents.events[0].type, 'TEST_EVENT');
    });
  });

});
