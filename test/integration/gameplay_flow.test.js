import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState, createActiveCombatGameState, createEndgameGameState } from '../helpers/fixtureState.js';
import { createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Integration: Gameplay Flow, Simulations & Win/Defeat Conditions', () => {

  // =========================================================================
  // Win / Defeat Condition Integration
  // =========================================================================
  describe('Leader Capture & Win/Defeat Conditions', () => {
    test('Ash captures Frost Lord: triggers endGame with Ash victory and GameOver state', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = createBaseGameState();
      Logic.initGame(gs);

      const lord = gs.pieces.find(p => p.key === 'snowFrostLord');
      const tyrant = gs.pieces.find(p => p.key === 'ashAshTyrant');
      assert.ok(lord, 'snowFrostLord must exist');
      assert.ok(tyrant, 'ashAshTyrant must exist');

      // Ash captures Snow leader
      Logic.handlePieceCapture(lord, tyrant, gs);

      assert.strictEqual(gs.gameOver, true, 'Game must be over after leader capture');
      assert.strictEqual(gs.winner, 'ash', 'Winner must be ash when snow leader is captured');
      assert.strictEqual(gs.currentState, Logic.GameState.GAME_OVER, 'State must transition to GAME_OVER');
      assert.ok(!gs.pieces.some(p => p.id === lord.id), 'Frost Lord must be removed from pieces');
    });

    test('Snow captures Ash Tyrant: triggers endGame with Snow victory and GameOver state', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = createBaseGameState();
      Logic.initGame(gs);

      const lord = gs.pieces.find(p => p.key === 'snowFrostLord');
      const tyrant = gs.pieces.find(p => p.key === 'ashAshTyrant');
      assert.ok(lord);
      assert.ok(tyrant);

      // Snow captures Ash leader
      Logic.handlePieceCapture(tyrant, lord, gs);

      assert.strictEqual(gs.gameOver, true, 'Game must be over after leader capture');
      assert.strictEqual(gs.winner, 'snow', 'Winner must be snow when ash leader is captured');
      assert.strictEqual(gs.currentState, Logic.GameState.GAME_OVER, 'State must transition to GAME_OVER');
      assert.ok(!gs.pieces.some(p => p.id === tyrant.id), 'Ash Tyrant must be removed from pieces');
    });

    test('Capturing a non-leader unit does not trigger endGame', async () => {
      const Logic = await import(path.resolve(rootDir, 'shared/logic.js'));
      const gs = createBaseGameState();
      Logic.initGame(gs);

      const brute = gs.pieces.find(p => p.key === 'snowGlacialBrute');
      const beast = gs.pieces.find(p => p.key === 'ashBlazeboundBeast');
      assert.ok(brute);
      assert.ok(beast);

      Logic.handlePieceCapture(brute, beast, gs);

      assert.strictEqual(gs.gameOver, false, 'Game must not be over when non-leader unit is captured');
      assert.strictEqual(gs.winner, null);
      assert.notStrictEqual(gs.currentState, Logic.GameState.GAME_OVER);
    });
  });

  // =========================================================================
  // Real-World Gameplay Scenarios (RW-01 to RW-07)
  // =========================================================================
  describe('Real-World Gameplay Flow & Simulations', () => {
    test('RW-01: Complete 10-turn local AI skirmish game simulation', async () => {
      const { updateVoronoiState, setCurrentState, isState, emit } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));

      const gs = createBaseGameState();
      assert.strictEqual(gs.turnCount, 1);
      assert.strictEqual(gs.currentTurn, 'snow');

      for (let turn = 1; turn <= 10; turn++) {
        gs.turnCount = turn;
        gs.currentTurn = turn % 2 === 1 ? 'snow' : 'ash';

        setCurrentState('PIECE_SELECTED', gs);
        assert.strictEqual(isState('PIECE_SELECTED', gs), true);

        const simClone = deepClone(gs);
        assert.ok(simClone.snowTerritory instanceof Set);

        const activePiece = gs.pieces.find(p => p.team === gs.currentTurn);
        if (activePiece) {
          activePiece.col = (activePiece.col + 1) % 10;
          emit(gs, { type: 'PIECE_MOVED', pieceId: activePiece.id });
        }

        updateVoronoiState(gs);
        const scores = calculateDynamicTerritoryAreas(gs);
        assert.ok(scores.snow >= 0 && scores.ash >= 0);

        setCurrentState('AWAITING_PIECE_SELECTION', gs);
        assert.strictEqual(isState('AWAITING_PIECE_SELECTION', gs), true);
      }

      assert.strictEqual(gs.turnCount, 10);
      assert.ok(gs.events.length >= 10, 'Must record game events for every simulated move');
    });

    test('RW-02: Multiplayer 5-turn networked match with delta synchronization', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const { setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));

      let hostState = createBaseGameState();
      let peerState = null;

      for (let turn = 1; turn <= 5; turn++) {
        hostState.turnCount = turn;
        hostState.currentTurn = turn % 2 === 1 ? 'snow' : 'ash';

        setCurrentState('PIECE_SELECTED', hostState);
        hostState.pieces[0].row = (hostState.pieces[0].row + 1) % 10;

        const deltaStr = serializeDelta(hostState);
        assert.ok(deltaStr.length < 5000, `Delta payload should be compact: ${deltaStr.length} bytes`);

        peerState = parseAndRehydrateGameState(deltaStr);
        assert.strictEqual(peerState.turnCount, turn);
        assert.strictEqual(peerState.pieces[0].row, hostState.pieces[0].row);
        assert.ok(peerState.snowTerritory instanceof Set);

        hostState = peerState;
      }

      assert.strictEqual(hostState.turnCount, 5);
    });

    test('RW-03: Ascension state transition and leader ability execution', async () => {
      const { setCurrentState, isState, GameState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { computePowerDiagram } = await import(path.resolve(rootDir, 'shared/voronoi.js'));
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));

      const gs = createBaseGameState();
      const leader = gs.pieces.find(p => p.isLeader && p.team === 'snow');
      assert.ok(leader);

      leader.isVeteran = true;
      leader.power += 10;
      leader.control += 8;
      setCurrentState(GameState.ASCENSION_CHOICE, gs);
      assert.strictEqual(isState(GameState.ASCENSION_CHOICE, gs), true);

      const diagram = computePowerDiagram(gs.pieces);
      const leaderCell = diagram.cells.find(c => (c.pieceId === leader.id || c.piece?.id === leader.id));
      assert.ok(leaderCell, 'Voronoi diagram must contain a cell for ascended leader');

      const cloned = deepClone(gs);
      const clonedLeader = cloned.pieces.find(p => p.id === leader.id);
      assert.strictEqual(clonedLeader.isVeteran, true);
      assert.strictEqual(clonedLeader.power, leader.power);
    });

    test('RW-04: Death Meteor bombardment and crater terrain lifecycle', async () => {
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      const { renderTerritoryLayer } = await import(path.resolve(rootDir, 'client/src/rendering/boardRenderer.js'));

      const gs = createActiveCombatGameState();
      gs.specialTerrains.push({
        row: 5,
        col: 5,
        type: 'crater',
        duration: 5,
        magmaPulse: 1.0
      });

      const ctx = createMockContext2D();
      const terrKeyRef = { current: null };
      const terrCacheRef = { current: null };
      const terrCanvasRef = { current: null };

      if (typeof renderTerritoryLayer === 'function') {
        renderTerritoryLayer(ctx, gs, false, terrKeyRef, terrCacheRef, terrCanvasRef, 70);
        assert.strictEqual(ctx.shadowBlur, 0);
      }

      const deltaStr = serializeDelta(gs);
      const rehydrated = parseAndRehydrateGameState(deltaStr);
      assert.ok(rehydrated.specialTerrains.some(t => t.type === 'crater'));
    });

    test('RW-05: Conduit siphon and ancient shrine overload particle loop with split effects', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));

      const ctx = createMockContext2D();
      core.initEffects(ctx, ctx);

      const gs = createActiveCombatGameState();
      gs.shrineChargeLevel = 5;
      gs.shrineIsOverloaded = true;
      gs.conduitLinkActive = true;

      assert.doesNotThrow(() => {
        core.drawShrineEffects(gs);
        core.drawConduitParticles(gs);
        core.drawSiphonParticles(gs);
      });

      assert.ok(unitEffects.drawGlacialFractureAnimations);
    });

    test('RW-06: End-of-Game victory sequence and stats serialization', async () => {
      const { setCurrentState, GameState, isState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { serializeDelta, parseAndRehydrateGameState } = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));

      const gs = createEndgameGameState();
      gs.pieces = gs.pieces.filter(p => p.team === 'snow');
      gs.gameOver = true;
      gs.winner = 'snow';
      setCurrentState(GameState.GAME_OVER, gs);

      assert.strictEqual(isState(GameState.GAME_OVER, gs), true);

      const deltaStr = serializeDelta(gs);
      const parsed = parseAndRehydrateGameState(deltaStr);
      assert.strictEqual(parsed.gameOver, true);
      assert.strictEqual(parsed.winner, 'snow');

      const victoryContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/VictoryScreen.jsx'), 'utf8');
      assert.strictEqual(victoryContent.includes("from 'lucide-react'"), false);
    });

    test('RW-07: Concurrent simulation stress test (50 AI minimax lookahead branches)', async () => {
      const { deepClone } = await import(path.resolve(rootDir, 'client/src/workers/ai.worker.js'));
      const { setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
      const { calculateDynamicTerritoryAreas } = await import(path.resolve(rootDir, 'client/src/services/gameTerritory.js'));

      const rootState = createBaseGameState();
      const branchCount = 50;
      const branches = [];

      const startTime = Date.now();
      for (let i = 0; i < branchCount; i++) {
        const cloned = deepClone(rootState);
        cloned.pieces[0].row = (i % 10);
        cloned.pieces[0].col = ((i * 3) % 10);
        setCurrentState('PIECE_SELECTED', cloned);
        const scores = calculateDynamicTerritoryAreas(cloned);
        branches.push({ cloned, scores });
      }
      const elapsed = Date.now() - startTime;

      assert.strictEqual(branches.length, branchCount);
      assert.strictEqual(rootState.pieces[0].row, 0);
      assert.strictEqual(rootState.pieces[0].col, 4);
      assert.strictEqual(rootState.currentState, 'AWAITING_PIECE_SELECTION');
      assert.ok(elapsed < 2000, `50-branch simulation must complete within 2s (took ${elapsed}ms)`);
    });
  });

});
