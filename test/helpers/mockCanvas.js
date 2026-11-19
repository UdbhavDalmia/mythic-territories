/**
 * Mock CanvasRenderingContext2D and HTMLCanvasElement for Headless Node 22 testing
 */

export function createMockContext2D(canvas = null) {
  let saveDepth = 0;
  const saveHistory = [];
  const calls = [];

  const ctxState = {
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  const stack = [];

  const ctx = {
    canvas: canvas || { width: 600, height: 600 },

    get shadowBlur() {
      return ctxState.shadowBlur;
    },
    set shadowBlur(val) {
      ctxState.shadowBlur = Number(val) || 0;
      calls.push({ method: 'set shadowBlur', value: ctxState.shadowBlur });
    },

    get shadowColor() {
      return ctxState.shadowColor;
    },
    set shadowColor(val) {
      ctxState.shadowColor = String(val);
      calls.push({ method: 'set shadowColor', value: ctxState.shadowColor });
    },

    get shadowOffsetX() {
      return ctxState.shadowOffsetX;
    },
    set shadowOffsetX(val) {
      ctxState.shadowOffsetX = Number(val) || 0;
    },

    get shadowOffsetY() {
      return ctxState.shadowOffsetY;
    },
    set shadowOffsetY(val) {
      ctxState.shadowOffsetY = Number(val) || 0;
    },

    get fillStyle() {
      return ctxState.fillStyle;
    },
    set fillStyle(val) {
      ctxState.fillStyle = val;
    },

    get strokeStyle() {
      return ctxState.strokeStyle;
    },
    set strokeStyle(val) {
      ctxState.strokeStyle = val;
    },

    get lineWidth() {
      return ctxState.lineWidth;
    },
    set lineWidth(val) {
      ctxState.lineWidth = Number(val) || 1;
    },

    get globalAlpha() {
      return ctxState.globalAlpha;
    },
    set globalAlpha(val) {
      ctxState.globalAlpha = Number(val) || 1;
    },

    get globalCompositeOperation() {
      return ctxState.globalCompositeOperation;
    },
    set globalCompositeOperation(val) {
      ctxState.globalCompositeOperation = String(val);
    },

    get font() {
      return ctxState.font;
    },
    set font(val) {
      ctxState.font = String(val);
    },

    get textAlign() {
      return ctxState.textAlign;
    },
    set textAlign(val) {
      ctxState.textAlign = String(val);
    },

    get textBaseline() {
      return ctxState.textBaseline;
    },
    set textBaseline(val) {
      ctxState.textBaseline = String(val);
    },

    save() {
      saveDepth++;
      stack.push({ ...ctxState });
      saveHistory.push({ type: 'save', depth: saveDepth });
      calls.push({ method: 'save', depth: saveDepth });
    },

    restore() {
      if (saveDepth > 0) {
        saveDepth--;
        const restored = stack.pop();
        if (restored) {
          Object.assign(ctxState, restored);
        }
      }
      saveHistory.push({ type: 'restore', depth: saveDepth });
      calls.push({ method: 'restore', depth: saveDepth });
    },

    getSaveDepth() {
      return saveDepth;
    },

    beginPath() {
      calls.push({ method: 'beginPath' });
    },
    closePath() {
      calls.push({ method: 'closePath' });
    },
    moveTo(x, y) {
      calls.push({ method: 'moveTo', args: [x, y] });
    },
    lineTo(x, y) {
      calls.push({ method: 'lineTo', args: [x, y] });
    },
    arc(x, y, radius, startAngle, endAngle, anticlockwise) {
      calls.push({ method: 'arc', args: [x, y, radius, startAngle, endAngle, anticlockwise] });
    },
    rect(x, y, w, h) {
      calls.push({ method: 'rect', args: [x, y, w, h] });
    },
    roundRect(x, y, w, h, r) {
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] });
    },
    fill() {
      calls.push({ method: 'fill' });
    },
    stroke() {
      calls.push({ method: 'stroke' });
    },
    fillRect(x, y, w, h) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    strokeRect(x, y, w, h) {
      calls.push({ method: 'strokeRect', args: [x, y, w, h] });
    },
    clearRect(x, y, w, h) {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    fillText(text, x, y, maxWidth) {
      calls.push({ method: 'fillText', args: [text, x, y, maxWidth] });
    },
    strokeText(text, x, y, maxWidth) {
      calls.push({ method: 'strokeText', args: [text, x, y, maxWidth] });
    },
    measureText(text) {
      return { width: (String(text).length) * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
    },
    drawImage(img, ...args) {
      calls.push({ method: 'drawImage', args: [img, ...args] });
    },
    createLinearGradient(x0, y0, x1, y1) {
      return {
        addColorStop(offset, color) {}
      };
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      return {
        addColorStop(offset, color) {}
      };
    },
    setLineDash(segments) {},
    getLineDash() { return []; },
    translate(x, y) {
      calls.push({ method: 'translate', args: [x, y] });
    },
    rotate(angle) {
      calls.push({ method: 'rotate', args: [angle] });
    },
    scale(x, y) {
      calls.push({ method: 'scale', args: [x, y] });
    },
    resetTransform() {
      calls.push({ method: 'resetTransform' });
    },
    clip() {
      calls.push({ method: 'clip' });
    },

    getCalls() {
      return [...calls];
    },
    clearCalls() {
      calls.length = 0;
    },
    getShadowAudit() {
      return {
        currentShadowBlur: ctxState.shadowBlur,
        currentShadowColor: ctxState.shadowColor,
        saveDepth,
        isShadowLeaked: ctxState.shadowBlur > 0 && ctxState.shadowColor !== 'transparent',
        isStackBalanced: saveDepth === 0
      };
    }
  };

  return ctx;
}

export function createMockCanvas(width = 600, height = 600) {
  let ctxInstance = null;
  const canvas = {
    width,
    height,
    getContext(type) {
      if (type === '2d') {
        if (!ctxInstance) {
          ctxInstance = createMockContext2D(canvas);
        }
        return ctxInstance;
      }
      return null;
    },
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        width,
        height
      };
    },
    addEventListener() {},
    removeEventListener() {}
  };
  return canvas;
}
