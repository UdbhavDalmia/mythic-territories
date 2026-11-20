import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Unit: State Logic & Transitions', () => {

  // =========================================================================
  // Feature 14: Pure gameState Parameter Passing
  // =========================================================================
  describe('Pure GameState Parameter Passing', () => {
    test('getGameState(gs) returns explicitly passed state instance', async () => {
      const { getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const customGs = { id: 'test-custom-game-state-1', pieces: [] };
      const result = getGameState(customGs);
      assert.strictEqual(result, customGs, 'getGameState(gs) must return the explicitly passed gs instance');
    });

    test('getCurrentState(gs) reads currentState from explicitly passed state', async () => {
      const { getCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const testState = { currentState: 'ABILITY_TARGETING' };
      assert.strictEqual(getCurrentState(testState), 'ABILITY_TARGETING');
    });

    test('setCurrentState(s, gs) modifies passed state and emits STATE_CHANGE without modifying default state', async () => {
      const { setCurrentState, getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const isolatedGs = { currentState: 'AWAITING_PIECE_SELECTION', events: [] };
      setCurrentState('PIECE_SELECTED', isolatedGs);

      assert.strictEqual(isolatedGs.currentState, 'PIECE_SELECTED');
      assert.ok(isolatedGs.events.some(e => e.type === 'STATE_CHANGE' && e.state === 'PIECE_SELECTED'));
      assert.notStrictEqual(getGameState(), isolatedGs, 'Default module state must remain distinct');
    });

    test('isState(s, gs) checks state against explicitly passed gs argument', async () => {
      const { isState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs1 = { currentState: 'GAME_OVER' };
      const gs2 = { currentState: 'PIECE_SELECTED' };
      assert.strictEqual(isState('GAME_OVER', gs1), true);
      assert.strictEqual(isState('GAME_OVER', gs2), false);
    });

    test('Logic action functions (updateVoronoiState) operate on explicitly passed gs', async () => {
      const { updateVoronoiState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const customGs = createBaseGameState();
      updateVoronoiState(customGs);
      assert.ok(customGs.voronoiData, 'updateVoronoiState must compute and assign voronoiData on passed gs');
    });
  });

  // =========================================================================
  // State Boundaries & Edge Cases
  // =========================================================================
  describe('State Boundaries & Error Handling', () => {
    test('getGameState called with no arguments falls back safely to default gameState', async () => {
      const { getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const defaultState = getGameState();
      assert.ok(typeof defaultState === 'object', 'getGameState() must return an object');
    });

    test('getCurrentState(null) and getCurrentState(undefined) return AWAITING_PIECE_SELECTION without crashing', async () => {
      const { getCurrentState, GameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      assert.strictEqual(getCurrentState(null), GameState.AWAITING_PIECE_SELECTION);
      assert.strictEqual(getCurrentState(undefined), GameState.AWAITING_PIECE_SELECTION);
    });

    test('setCurrentState on a state without events array initializes events array before pushing', async () => {
      const { setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const bareState = { currentState: 'OLD' };
      setCurrentState('NEW_STATE', bareState);
      assert.strictEqual(bareState.currentState, 'NEW_STATE');
      assert.ok(Array.isArray(bareState.events));
      assert.ok(bareState.events.length > 0);
    });

    test('Two independent game state instances can be stepped simultaneously without mutation bleed', async () => {
      const { setCurrentState, isState, emit } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const stateA = { currentState: 'STATE_A', events: [] };
      const stateB = { currentState: 'STATE_B', events: [] };

      setCurrentState('ASCENSION_CHOICE', stateA);
      emit(stateA, { type: 'ACTION_A' });

      assert.strictEqual(isState('ASCENSION_CHOICE', stateA), true);
      assert.strictEqual(isState('STATE_B', stateB), true);
      assert.strictEqual(stateB.events.length, 0, 'stateB events must not receive events emitted to stateA');
    });

    test('emit(gs, event) on state without events property handles undefined events gracefully', async () => {
      const { emit } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const stateWithoutEvents = {};
      assert.doesNotThrow(() => {
        emit(stateWithoutEvents, { type: 'TEST_EVENT' });
      });
      assert.ok(Array.isArray(stateWithoutEvents.events));
      assert.strictEqual(stateWithoutEvents.events[0].type, 'TEST_EVENT');
    });

    test('GlacialFracture creates snowIceWisp directly in passed gameStateLocal without leaking to global state', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gsIsolated = createBaseGameState();
      Logic.initGame(gsIsolated);

      const mage = gsIsolated.pieces.find(p => p.key === 'snowGlacialMage');
      assert.ok(mage, 'snowGlacialMage must exist in initialized state');

      const target = { r: mage.row - 1, c: mage.col };
      const initialPieceCount = gsIsolated.pieces.length;

      Logic.executeAbility(mage, target, 'GlacialFracture', gsIsolated);

      const wisps = gsIsolated.pieces.filter(p => p.key === 'snowIceWisp');
      assert.ok(wisps.length > 0, 'A snowIceWisp should have been created in gsIsolated');
      assert.strictEqual(gsIsolated.pieces.length, initialPieceCount + 1);

      const defaultState = Logic.getGameState();
      if (defaultState && defaultState.pieces) {
        assert.ok(!defaultState.pieces.includes(wisps[0]), 'New wisp must not leak into default gameState');
      }
    });

    test('initGame initializes clean game state with 20 pieces and snow starting turn', async () => {
      const { initGame } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = {};
      initGame(gs);
      assert.strictEqual(gs.pieces.length, 20);
      assert.strictEqual(gs.currentTurn, 'snow');
      assert.strictEqual(gs.turnCount, 1);
      assert.strictEqual(gs.gameOver, false);
      assert.strictEqual(gs.winner, null);
    });
  });

});
