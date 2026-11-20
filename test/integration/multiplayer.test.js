import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Integration: Multiplayer Networking, Serialization & Room Codes', () => {

  // =========================================================================
  // Feature 6: Multiplayer serializeDelta & Rehydration
  // =========================================================================
  describe('Multiplayer Delta Serialization & Rehydration', () => {
    test('serializeDelta returns a valid JSON string serializing only mutating gameplay fields', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      const deltaStr = serializeDelta(gs);

      assert.strictEqual(typeof deltaStr, 'string', 'serializeDelta must return a string');
      const parsed = JSON.parse(deltaStr);
      assert.ok(Array.isArray(parsed.pieces), 'parsed delta must include pieces');
      assert.strictEqual(parsed.turnCount, gs.turnCount, 'parsed delta must include turnCount');
      assert.strictEqual(parsed.currentState, gs.currentState, 'parsed delta must include currentState');
    });

    test('serializeDelta omits non-mutating asset dictionaries and image elements', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      gs.images = { boardTexture: 'data:image/png;base64,...', pieceIcons: {} };
      gs.boardImgs = { cacheCanvas: {} };

      const parsed = JSON.parse(serializeDelta(gs));
      assert.strictEqual(parsed.images, undefined, 'serializeDelta must omit images dictionary');
      assert.strictEqual(parsed.boardImgs, undefined, 'serializeDelta must omit boardImgs dictionary');
    });

    test('serializeDelta converts snowTerritory and ashTerritory Sets to Arrays', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      assert.ok(gs.snowTerritory instanceof Set);

      const parsed = JSON.parse(serializeDelta(gs));
      assert.ok(Array.isArray(parsed.snowTerritory), 'snowTerritory must be serialized as an Array');
      assert.ok(Array.isArray(parsed.ashTerritory), 'ashTerritory must be serialized as an Array');
    });

    test('parseAndRehydrateGameState rehydrates territory Sets and defaults missing arrays to []', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      const deltaStr = serializeDelta(gs);

      const rehydrated = parseAndRehydrateGameState(deltaStr);
      assert.ok(rehydrated.snowTerritory instanceof Set, 'rehydrated.snowTerritory must be a Set');
      assert.ok(rehydrated.ashTerritory instanceof Set, 'rehydrated.ashTerritory must be a Set');
      assert.ok(Array.isArray(rehydrated.markedPieces), 'rehydrated markedPieces must be an array');
      assert.ok(Array.isArray(rehydrated.shields), 'rehydrated shields must be an array');
    });

    test('serializeDelta payload size is substantially smaller than raw state JSON stringification', async () => {
      const { serializeDelta, serializeGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createActiveCombatGameState();
      gs.cachedVoronoiDetails = { points: new Array(500).fill({ x: 1, y: 1 }) };
      gs.uiRenderState = { hovered: true, menuOpen: false, animations: [] };

      const fullStr = typeof serializeGameState === 'function' ? serializeGameState(gs) : JSON.stringify(gs);
      const deltaStr = serializeDelta(gs);

      assert.ok(deltaStr.length < fullStr.length, 'Delta payload must be smaller than full state');
    });
  });

  // =========================================================================
  // Serialization Boundaries & Error Handling
  // =========================================================================
  describe('Serialization Boundaries', () => {
    test('serializeDelta handles null, undefined, or empty state input gracefully', async () => {
      const { serializeDelta } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      assert.strictEqual(serializeDelta(null), null);
      assert.strictEqual(serializeDelta(undefined), null);
      assert.doesNotThrow(() => serializeDelta({}));
    });

    test('parseAndRehydrateGameState handles null, invalid JSON, or partial JSON strings gracefully', async () => {
      const { parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      assert.strictEqual(parseAndRehydrateGameState(null), null);
      assert.strictEqual(parseAndRehydrateGameState(undefined), null);
      assert.strictEqual(parseAndRehydrateGameState('invalid json {{{'), null);
    });

    test('serializeDelta handles circular piece references inside temporaryBoosts/shields without throwing', async () => {
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

    test('parseAndRehydrateGameState guarantees all array fields are defined even if omitted in delta', async () => {
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

    test('serializeDelta preserves piece abilities and veteran status accurately', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const gs = createBaseGameState();
      gs.pieces[0].isVeteran = true;

      const delta = serializeDelta(gs);
      const rehydrated = parseAndRehydrateGameState(delta);
      assert.strictEqual(rehydrated.pieces[0].isVeteran, true);
    });
  });

  // =========================================================================
  // Secondary Fields & Rehydration Edge Cases (M2 Iteration 2)
  // =========================================================================
  describe('Secondary Game Fields & In-Game Action Rehydration', () => {
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

    test('rehydrated delta state executes Logic.movePiece without TypeError on territoryCaptureTurn', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { getValidMoves } = await import(path.resolve(rootDir, 'shared/utils.js'));
      const { serializeDelta, rehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));

      const initial = createBaseGameState();
      Logic.initGame(initial);
      initial.gameStarted = true;

      const deltaStr = serializeDelta(initial);
      const rehydrated = rehydrateGameState(JSON.parse(deltaStr));

      const lord = rehydrated.pieces.find(p => p.key === 'snowFrostLord');
      assert.ok(lord);

      Logic.selectPiece(lord, rehydrated);
      const moves = getValidMoves(lord, rehydrated);
      assert.ok(moves.length > 0, 'Frost Lord must have valid moves');
      const targetMove = moves[0];

      assert.doesNotThrow(() => {
        Logic.movePiece(lord, targetMove.row, targetMove.col, false, rehydrated);
      }, 'movePiece must not throw TypeError on territoryCaptureTurn');

      assert.strictEqual(lord.row, targetMove.row);
      assert.strictEqual(lord.col, targetMove.col);
      assert.ok(rehydrated.territoryCaptureTurn[`${targetMove.row},${targetMove.col}`] !== undefined);
    });

    test('rehydrated delta state executes Logic.switchTurn with Conduit Tier 2 overcharge without TypeError on riftAnchors', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { serializeDelta, rehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));

      const initial = createBaseGameState();
      Logic.initGame(initial);

      initial.conduitLinkActive = true;
      initial.conduitIsContested = false;
      initial.conduitTeam = 'snow';
      initial.conduitOverchargeProgress = {
        snow: { turnsUncontested: 2 },
        ash: { turnsUncontested: 0 }
      };

      const deltaStr = serializeDelta(initial);
      const rehydrated = rehydrateGameState(JSON.parse(deltaStr));

      assert.doesNotThrow(() => {
        Logic.switchTurn(rehydrated);
      }, 'switchTurn with Conduit Tier 2 overcharge must not throw TypeError on riftAnchors');
    });
  });

  // =========================================================================
  // Room Code Utilities (roomCode.js)
  // =========================================================================
  describe('Room Code Generation, Validation & Formatting', () => {
    test('generateRoomCode generates valid realm codes in format (FROST|EMBER)-DDD', async () => {
      const { generateRoomCode, isValidRoomCode } = await import(path.resolve(rootDir, 'client/src/services/roomCode.js'));
      for (let i = 0; i < 20; i++) {
        const code = generateRoomCode();
        assert.ok(isValidRoomCode(code), `Generated code ${code} must be valid according to isValidRoomCode`);
        assert.match(code, /^(FROST|EMBER)-\d{3}$/, `Code must match (FROST|EMBER)-DDD regex: ${code}`);
      }
    });

    test('isValidRoomCode validates acceptable formats and rejects malformed inputs', async () => {
      const { isValidRoomCode } = await import(path.resolve(rootDir, 'client/src/services/roomCode.js'));
      assert.strictEqual(isValidRoomCode('FROST-100'), true);
      assert.strictEqual(isValidRoomCode('EMBER-999'), true);
      assert.strictEqual(isValidRoomCode('frost-555'), true, 'Should accept lowercase input');
      assert.strictEqual(isValidRoomCode('  FROST-123  '), true, 'Should trim whitespace');

      assert.strictEqual(isValidRoomCode(''), false);
      assert.strictEqual(isValidRoomCode(null), false);
      assert.strictEqual(isValidRoomCode(undefined), false);
      assert.strictEqual(isValidRoomCode('ICE-123'), false, 'Non-realm word must fail');
      assert.strictEqual(isValidRoomCode('FROST-12'), false, '2 digits must fail');
      assert.strictEqual(isValidRoomCode('FROST-1234'), false, '4 digits must fail');
      assert.strictEqual(isValidRoomCode('EMBER123'), false, 'Missing hyphen must fail');
    });

    test('formatRoomCodeInput handles typing, backspacing and URL extraction', async () => {
      const { formatRoomCodeInput } = await import(path.resolve(rootDir, 'client/src/services/roomCode.js'));

      // 1. URL extraction
      const extracted = formatRoomCodeInput('https://mythicterritories.com/game?room=FROST-789');
      assert.strictEqual(extracted, 'FROST-789');

      // 2. Auto-uppercase and hyphen insertion on 5 letters
      assert.strictEqual(formatRoomCodeInput('frost'), 'FROST-');
      assert.strictEqual(formatRoomCodeInput('ember1'), 'EMBER-1');
      assert.strictEqual(formatRoomCodeInput('ember123'), 'EMBER-123');

      // 3. User backspacing hyphen
      const backspaced = formatRoomCodeInput('FROST', 'FROST-');
      assert.strictEqual(backspaced, 'FROS');

      // 4. Empty or invalid input
      assert.strictEqual(formatRoomCodeInput(''), '');
      assert.strictEqual(formatRoomCodeInput(null), '');
    });

    test('getOrCreatePlayerId returns persistent player ID', async () => {
      const { getOrCreatePlayerId } = await import(path.resolve(rootDir, 'client/src/services/roomCode.js'));
      const pid = getOrCreatePlayerId();
      assert.ok(typeof pid === 'string');
      assert.ok(pid.length > 0);
    });

    test('saveActiveSession, getActiveSession, and clearActiveSession persist room session', async () => {
      const { saveActiveSession, getActiveSession, clearActiveSession } = await import(path.resolve(rootDir, 'client/src/services/roomCode.js'));

      const testSession = { roomId: 'FROST-123', team: 'snow', playerId: 'p_test' };
      saveActiveSession(testSession);

      const retrieved = getActiveSession();
      if (retrieved) {
        assert.strictEqual(retrieved.roomId, 'FROST-123');
        assert.strictEqual(retrieved.team, 'snow');
      }

      clearActiveSession();
      const cleared = getActiveSession();
      assert.strictEqual(cleared, null);
    });
  });

});
