import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBaseGameState } from '../helpers/fixtureState.js';

const rootDir = process.cwd();

describe('Build: Production Build Artifacts & Offline Session Validation', () => {

  // =========================================================================
  // RW-08: Full production build settings & manual chunks verification
  // =========================================================================
  test('RW-08: Full production build settings & manual chunks verification', async () => {
    const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
    assert.strictEqual(config.build?.target, 'es2020');
    assert.strictEqual(config.build?.minify, 'esbuild');
    assert.strictEqual(config.build?.sourcemap, false);
    assert.strictEqual(config.build?.reportCompressedSize, false);

    const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
    assert.strictEqual(typeof manualChunks, 'function');
    assert.strictEqual(manualChunks('src/services/multiplayer.js'), 'multiplayer');
    assert.strictEqual(manualChunks('node_modules/firebase/app'), 'vendor-firebase');
    assert.strictEqual(manualChunks('node_modules/react'), 'vendor-react');
  });

  // =========================================================================
  // RW-10: Cold boot and offline AI game session without network dependencies
  // =========================================================================
  test('RW-10: Cold boot and offline AI game session without network dependencies', async () => {
    const html = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
    assert.ok(html.includes('@font-face'));
    assert.ok(html.includes('#0B1019'));

    const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
    const gsap = await loadGsap();
    assert.ok(gsap);

    const gs = createBaseGameState();
    const { updateVoronoiState, setCurrentState } = await import(path.resolve(rootDir, 'shared/logic.js'));
    updateVoronoiState(gs);
    setCurrentState('PIECE_SELECTED', gs);
    assert.strictEqual(gs.currentState, 'PIECE_SELECTED');
  });

  // =========================================================================
  // RW-12: Hosting cache policy validation and static file integrity
  // =========================================================================
  test('RW-12: Hosting cache policy validation and static file integrity', () => {
    const fb = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
    const headers = fb.hosting?.headers || [];

    const assetRule = headers.find(h => h.source === '/assets/**');
    assert.ok(assetRule);
    const assetCc = assetRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(assetCc, 'public, max-age=31536000, immutable');

    const fontRule = headers.find(h => h.source === '/fonts/**');
    assert.ok(fontRule);
    const fontCc = fontRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(fontCc, 'public, max-age=31536000, immutable');

    const indexRule = headers.find(h => h.source === '/index.html');
    assert.ok(indexRule);
    const indexCc = indexRule.headers.find(k => k.key === 'Cache-Control').value;
    assert.strictEqual(indexCc, 'no-cache, no-store, must-revalidate');

    assert.ok(fs.existsSync(path.resolve(rootDir, 'client/public/fonts/almendra-sc-latin.woff2')));
    assert.ok(fs.existsSync(path.resolve(rootDir, 'client/public/fonts/rye-latin.woff2')));
  });

});
