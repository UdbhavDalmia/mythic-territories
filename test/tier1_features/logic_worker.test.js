import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Tier 1: State Logic, AI Worker & Multiplayer Serialization', () => {

  // =========================================================================
  // Feature 2: StructuredClone in AI Worker
  // =========================================================================
  describe('Feature 2: StructuredClone in AI Worker', () => {
    test('F2-T1-1: ai.worker.js deepClone utilizes structuredClone instead of JSON stringify/parse', () => {
      const workerPath = path.resolve(rootDir, 'client/src/workers/ai.worker.js');
      const content = fs.readFileSync(workerPath, 'utf8');
      assert.ok(content.includes('structuredClone'), 'ai.worker.js must utilize structuredClone');
      assert.ok(content.includes('export function deepClone'), 'ai.worker.js must export deepClone');
    });

    test('F2-T1-2: deepClone preserves snowTerritory and ashTerritory as active Set instances', async () => {
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

    test('F2-T1-3: deepClone re-links temporaryBoosts and debuffs piece references to cloned pieces', async () => {
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

    test('F2-T1-4: deepClone re-links markedPieces target references to cloned piece instances', async () => {
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

    test('F2-T1-5: deepClone creates an independent deep copy of piece properties preventing mutation bleed', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const original = createBaseGameState();
      const originalHp = original.pieces[0].currentHp;

      const cloned = deepClone(original);
      cloned.pieces[0].currentHp -= 20;

      assert.strictEqual(original.pieces[0].currentHp, originalHp, 'Original piece currentHp must not mutate when cloned piece changes');
    });
  });

  // =========================================================================
  // Feature 6: Multiplayer serializeDelta Helper
  // =========================================================================
  describe('Feature 6: Multiplayer serializeDelta Helper', () => {
    test('F6-T1-1: serializeDelta returns a valid JSON string serializing only mutating gameplay fields', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      const deltaStr = serializeDelta(gs);

      assert.strictEqual(typeof deltaStr, 'string', 'serializeDelta must return a string');
      const parsed = JSON.parse(deltaStr);
      assert.ok(Array.isArray(parsed.pieces), 'parsed delta must include pieces');
      assert.strictEqual(parsed.turnCount, gs.turnCount, 'parsed delta must include turnCount');
      assert.strictEqual(parsed.currentState, gs.currentState, 'parsed delta must include currentState');
    });

    test('F6-T1-2: serializeDelta omits non-mutating asset dictionaries and image elements', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      gs.images = { boardTexture: 'data:image/png;base64,...', pieceIcons: {} };
      gs.boardImgs = { cacheCanvas: {} };

      const parsed = JSON.parse(serializeDelta(gs));
      assert.strictEqual(parsed.images, undefined, 'serializeDelta must omit images dictionary');
      assert.strictEqual(parsed.boardImgs, undefined, 'serializeDelta must omit boardImgs dictionary');
    });

    test('F6-T1-3: serializeDelta converts snowTerritory and ashTerritory Sets to Arrays', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      assert.ok(gs.snowTerritory instanceof Set);

      const parsed = JSON.parse(serializeDelta(gs));
      assert.ok(Array.isArray(parsed.snowTerritory), 'snowTerritory must be serialized as an Array');
      assert.ok(Array.isArray(parsed.ashTerritory), 'ashTerritory must be serialized as an Array');
    });

    test('F6-T1-4: parseAndRehydrateGameState rehydrates territory Sets and defaults missing arrays to []', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      const deltaStr = serializeDelta(gs);

      const rehydrated = parseAndRehydrateGameState(deltaStr);
      assert.ok(rehydrated.snowTerritory instanceof Set, 'rehydrated.snowTerritory must be a Set');
      assert.ok(rehydrated.ashTerritory instanceof Set, 'rehydrated.ashTerritory must be a Set');
      assert.ok(Array.isArray(rehydrated.markedPieces), 'rehydrated markedPieces must be an array');
      assert.ok(Array.isArray(rehydrated.shields), 'rehydrated shields must be an array');
    });

    test('F6-T1-5: serializeDelta payload size is substantially smaller than raw state JSON stringification', async () => {
      const { serializeDelta, serializeGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      // Add extra bloated properties that raw full states typically hold
      gs.cachedVoronoiDetails = { points: new Array(500).fill({ x: 1, y: 1 }) };
      gs.uiRenderState = { hovered: true, menuOpen: false, animations: [] };

      const fullStr = typeof serializeGameState === 'function' ? serializeGameState(gs) : JSON.stringify(gs);
      const deltaStr = serializeDelta(gs);

      assert.ok(deltaStr.length < fullStr.length, 'Delta payload must be smaller than full state');
    });
  });

  // =========================================================================
  // Feature 14: Pure gameState Parameter Passing
  // =========================================================================
  describe('Feature 14: Pure gameState Parameter Passing', () => {
    test('F14-T1-1: getGameState(gs) returns explicitly passed state instance', async () => {
      const { getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const customGs = { id: 'test-custom-game-state-1', pieces: [] };
      const result = getGameState(customGs);
      assert.strictEqual(result, customGs, 'getGameState(gs) must return the explicitly passed gs instance');
    });

    test('F14-T1-2: getCurrentState(gs) reads currentState from explicitly passed state', async () => {
      const { getCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const testState = { currentState: 'ABILITY_TARGETING' };
      assert.strictEqual(getCurrentState(testState), 'ABILITY_TARGETING');
    });

    test('F14-T1-3: setCurrentState(s, gs) modifies passed state and emits STATE_CHANGE without modifying default state', async () => {
      const { setCurrentState, getGameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const isolatedGs = { currentState: 'AWAITING_PIECE_SELECTION', events: [] };
      setCurrentState('PIECE_SELECTED', isolatedGs);

      assert.strictEqual(isolatedGs.currentState, 'PIECE_SELECTED');
      assert.ok(isolatedGs.events.some(e => e.type === 'STATE_CHANGE' && e.state === 'PIECE_SELECTED'));
      assert.notStrictEqual(getGameState(), isolatedGs, 'Default module state must remain distinct');
    });

    test('F14-T1-4: isState(s, gs) checks state against explicitly passed gs argument', async () => {
      const { isState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs1 = { currentState: 'GAME_OVER' };
      const gs2 = { currentState: 'PIECE_SELECTED' };
      assert.strictEqual(isState('GAME_OVER', gs1), true);
      assert.strictEqual(isState('GAME_OVER', gs2), false);
    });

    test('F14-T1-5: Logic action functions (updateVoronoiState, checkTerritoryThresholds) operate on explicitly passed gs', async () => {
      const { updateVoronoiState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const customGs = createBaseGameState();
      updateVoronoiState(customGs);
      assert.ok(customGs.voronoiData, 'updateVoronoiState must compute and assign voronoiData on passed gs');
    });
  });

});
