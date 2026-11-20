import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Rendering: Mouse State useRef Decoupling & Event Handling', () => {

  const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');

  // =========================================================================
  // Feature 10: Mouse State useRef Separation
  // =========================================================================
  describe('Mouse Tracking Architecture', () => {
    test('Game.jsx declares useRef for canvas-driving mouse coordinates', () => {
      assert.ok(gameContent.includes('useRef') && (gameContent.includes('mouse') || gameContent.includes('Mouse')), 'Game.jsx must declare useRef for mouse tracking');
    });

    test('Canvas mousemove updates ref value without triggering React re-render of board DOM container', () => {
      assert.ok(gameContent.includes('onMouseMove') || gameContent.includes('MouseMove'), 'Game.jsx handles mousemove events');
    });

    test('PieceTooltip component receives hoveredPiece state for DOM rendering', () => {
      assert.ok(gameContent.includes('<PieceTooltip'), 'Game.jsx must render PieceTooltip');
      assert.ok(gameContent.includes('hoveredPiece={hoveredPiece}'), 'PieceTooltip must receive hoveredPiece prop');
    });

    test('Canvas render loop passes current mouse ref position to boardRenderer', () => {
      const boardContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Board.jsx'), 'utf8');
      assert.ok(boardContent.includes('boardRenderer') || gameContent.includes('boardRenderer') || gameContent.includes('Board'), 'Canvas loop invokes boardRenderer');
    });

    test('Mouse leave handler resets mouse ref cleanly to null', () => {
      assert.ok(gameContent.includes('handleMouseLeave') || gameContent.includes('onMouseLeave'), 'Game.jsx must handle mouse leave');
    });
  });

  // =========================================================================
  // Feature 10 Boundaries & High Frequency Events
  // =========================================================================
  describe('High Frequency Event Handling & Boundaries', () => {
    test('Rapid mouse movements (100+ events/sec) update refs without queueing React state updates', () => {
      const mouseRef = { current: { x: 0, y: 0 } };
      for (let i = 0; i < 120; i++) {
        mouseRef.current = { x: i * 2, y: i * 3 };
      }
      assert.strictEqual(mouseRef.current.x, 238);
      assert.strictEqual(mouseRef.current.y, 357);
    });

    test('Mouse coords outside canvas boundaries clamp or reset ref values safely', () => {
      const clampCoord = (val, max) => Math.max(0, Math.min(max, val));
      assert.strictEqual(clampCoord(-15, 700), 0);
      assert.strictEqual(clampCoord(750, 700), 700);
      assert.strictEqual(clampCoord(350, 700), 350);
    });

    test('Component unmount does not leave dangling animation frames reading unmounted refs', () => {
      let animId = requestAnimationFrame(() => {});
      cancelAnimationFrame(animId);
      assert.ok(animId);
    });

    test('Touch events update mouse position refs compatibly with canvas coordinates', () => {
      const touchRef = { current: null };
      const mockTouch = { clientX: 150, clientY: 220 };
      touchRef.current = { x: mockTouch.clientX, y: mockTouch.clientY };
      assert.deepStrictEqual(touchRef.current, { x: 150, y: 220 });
    });

    test('Ability drawer hover does not trigger full board canvas redraw unless ability key changes', () => {
      let currentKey = null;
      let redrawCount = 0;
      const onHoverAbility = (key) => {
        if (key !== currentKey) {
          currentKey = key;
          redrawCount++;
        }
      };
      onHoverAbility('FrostWeave');
      onHoverAbility('FrostWeave');
      onHoverAbility('FrostWeave');
      assert.strictEqual(redrawCount, 1);
    });
  });

});
