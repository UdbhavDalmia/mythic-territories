import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createMockCanvas } from './mockCanvas.js';

// Polyfill worker and browser globals
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

if (!globalThis.window.matchMedia) {
  globalThis.window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  });
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    body: {
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {}
      }
    },
    createElement(tag) {
      if (tag === 'canvas') {
        return createMockCanvas(600, 600);
      }
      return {
        style: {},
        setAttribute() {},
        getAttribute() { return null; },
        appendChild() {},
        removeChild() {}
      };
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, val) { store.set(key, String(val)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); }
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createMockStorage();
}

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createMockStorage();
}

// Register the custom ESM module resolver hook
const resolverPath = path.resolve(process.cwd(), 'test/helpers/customResolver.js');
register(pathToFileURL(resolverPath));
