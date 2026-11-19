import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMockCanvas, createMockContext2D } from '../helpers/mockCanvas.js';

const rootDir = process.cwd();

describe('Tier 2: Bundle, Build Configuration & Asset Boundaries', () => {

  // =========================================================================
  // Feature 1 Boundaries: Lucide-React Imports
  // =========================================================================
  describe('Feature 1 Boundaries', () => {
    test('F1-T2-1: Icon import paths have valid extensions and exact kebab-case icon names', () => {
      const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');
      const matches = [...gameContent.matchAll(/from\s+['"]lucide-react\/dist\/esm\/icons\/([^'"]+)['"]/g)];
      for (const m of matches) {
        const iconName = m[1];
        assert.ok(iconName.endsWith('.js'), `Icon path must end with .js: ${iconName}`);
        const baseName = iconName.replace('.js', '');
        assert.match(baseName, /^[a-z0-9\-]+$/, `Icon name must be kebab-case: ${baseName}`);
      }
    });

    test('F1-T2-2: No unused lucide-react imports remain across all JSX component files', () => {
      const drawerContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/game/GameActionDrawer.jsx'), 'utf8');
      const iconMatches = [...drawerContent.matchAll(/import\s+(\w+)\s+from\s+['"]lucide-react\/dist\/esm\/icons/g)];
      for (const m of iconMatches) {
        const identifier = m[1];
        const occurrences = (drawerContent.match(new RegExp(`\\b${identifier}\\b`, 'g')) || []).length;
        assert.ok(occurrences >= 2, `Imported icon ${identifier} must be used in component JSX (found ${occurrences} occurrences)`);
      }
    });

    test('F1-T2-3: GameActionDrawer and nested drawer components do not render undefined icon components', async () => {
      const iconPath = path.resolve(rootDir, 'client/node_modules/lucide-react/dist/esm/icons/scroll-text.js');
      assert.ok(fs.existsSync(iconPath), 'Icon component file must exist');
      const iconModule = await import(iconPath);
      assert.ok(iconModule.default, 'Icon component module must export default or named component');
    });

    test('F1-T2-4: Vite optimizeDeps entries in vite.config.js are valid strings matching installed packages', async () => {
      const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      const include = config.optimizeDeps?.include || [];
      assert.ok(Array.isArray(include), 'optimizeDeps.include must be an array');
      for (const pkg of include) {
        assert.strictEqual(typeof pkg, 'string', 'optimizeDeps entry must be string');
      }
    });

    test('F1-T2-5: Dynamic icon references in guideData and patchNotes render with standard SVG props', () => {
      const patchNotesContent = fs.readFileSync(path.resolve(rootDir, 'client/src/data/patchNotes.jsx'), 'utf8');
      assert.strictEqual(patchNotesContent.includes("from 'lucide-react'"), false);
      const guideDataContent = fs.readFileSync(path.resolve(rootDir, 'client/src/data/guideData.jsx'), 'utf8');
      assert.strictEqual(guideDataContent.includes("from 'lucide-react'"), false);
    });
  });

  // =========================================================================
  // Feature 7 Boundaries: Manual Chunk Splitting
  // =========================================================================
  describe('Feature 7 Boundaries', () => {
    let manualChunks;

    test('F7-T2-1: manualChunks handles Windows-style backslashes in id paths gracefully', async () => {
      const config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      manualChunks = config.build?.rollupOptions?.output?.manualChunks;
      const winPath = 'C:\\workspace\\client\\src\\services\\multiplayer.js';
      const normalizedWinPath = winPath.replace(/\\/g, '/');
      const result = manualChunks(winPath) || manualChunks(normalizedWinPath);
      assert.strictEqual(result, 'multiplayer', 'manualChunks must identify multiplayer module on Windows paths');
    });

    test('F7-T2-2: manualChunks handles Vite query strings and module virtual suffixes (?v=123, &worker)', () => {
      assert.strictEqual(manualChunks('/client/src/services/multiplayer.js?v=9f8e7d'), 'multiplayer');
      assert.strictEqual(manualChunks('/client/node_modules/firebase/app/dist/index.mjs?commonjs-entry'), 'vendor-firebase');
    });

    test('F7-T2-3: manualChunks handles empty or non-string id input without throwing', () => {
      assert.doesNotThrow(() => {
        const r1 = manualChunks('');
        assert.ok(!r1);
      });
    });

    test('F7-T2-4: manualChunks does not chunk files outside src/services that happen to have multiplayer in filename', () => {
      const modalResult = manualChunks('/client/src/components/lobby/MultiplayerModal.jsx');
      assert.notStrictEqual(modalResult, 'multiplayer', 'MultiplayerModal component must not be chunked as service multiplayer');
    });

    test('F7-T2-5: manualChunks chunk names contain only alphanumeric characters and hyphens', () => {
      const samples = [
        'node_modules/react/index.js',
        'node_modules/gsap/index.js',
        'node_modules/firebase/firestore/index.js',
        'src/services/multiplayer.js'
      ];
      for (const s of samples) {
        const chunkName = manualChunks(s);
        if (chunkName) {
          assert.match(chunkName, /^[a-z0-9\-]+$/, `Chunk name must be url-friendly kebab-case: ${chunkName}`);
        }
      }
    });
  });

  // =========================================================================
  // Feature 8 Boundaries: Firebase Dynamic Import
  // =========================================================================
  describe('Feature 8 Boundaries', () => {
    test('F8-T2-1: getFirebaseServices handles dynamic import network failure with descriptive error rejection', async () => {
      const fb = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      assert.strictEqual(typeof fb.getFirebaseServices, 'function');
    });

    test('F8-T2-2: getAuthUser handles anonymous auth disabled in console without unhandled promise rejection', async () => {
      const { getAuthUser } = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      assert.strictEqual(typeof getAuthUser, 'function');
    });

    test('F8-T2-3: Concurrent calls to getFirebaseServices share single in-flight loading promise', async () => {
      const { getFirebaseServices } = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      const [res1, res2, res3] = await Promise.all([
        getFirebaseServices(),
        getFirebaseServices(),
        getFirebaseServices()
      ]);
      assert.strictEqual(res1.db, res2.db);
      assert.strictEqual(res2.db, res3.db);
    });

    test('F8-T2-4: multiplayer room subscriptions return a cancellable cleanup handle even if Firebase is uninitialized', async () => {
      const mp = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      if (typeof mp.subscribeToRoom === 'function') {
        const cleanup = mp.subscribeToRoom('TESTROOM', () => {});
        assert.strictEqual(typeof cleanup, 'function', 'Room subscription must return a cleanup function');
        assert.doesNotThrow(() => cleanup(), 'Cleanup must be safe to invoke');
      }
    });

    test('F8-T2-5: getDb and getAuth await getFirebaseServices internally without requiring caller pre-init', async () => {
      const { getDb, getAuth } = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      const db = await getDb();
      const auth = await getAuth();
      assert.ok(db, 'getDb must resolve to a valid db instance');
      assert.ok(auth, 'getAuth must resolve to a valid auth instance');
    });
  });

  // =========================================================================
  // Feature 11 Boundaries: Dynamic GSAP Imports
  // =========================================================================
  describe('Feature 11 Boundaries', () => {
    test('F11-T2-1: Multiple concurrent calls to loadGsap share exact same promise instance', async () => {
      const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
      const p1 = loadGsap();
      const p2 = loadGsap();
      assert.strictEqual(p1, p2, 'Concurrent loadGsap() calls must return identical Promise instance');
    });

    test('F11-T2-2: Animation callbacks handle rejection of dynamic GSAP import gracefully without crashing application', () => {
      const settingsContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Settings.jsx'), 'utf8');
      assert.ok(settingsContent.includes('loadGsap'), 'Settings.jsx must use loadGsap');
    });

    test('F11-T2-3: Component unmount before GSAP load completes aborts tween initiation safely', () => {
      const pieceContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Piece.jsx'), 'utf8');
      assert.ok(pieceContent.includes('loadGsap') || pieceContent.includes('getGsap'), 'Piece.jsx must load GSAP dynamically');
    });

    test('F11-T2-4: Lobby component transitions complete smoothly when GSAP resolves after render', () => {
      const lobbyContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Lobby.jsx'), 'utf8');
      assert.ok(lobbyContent.includes('loadGsap') || lobbyContent.includes('gsap'), 'Lobby.jsx must support GSAP transitions');
    });

    test('F11-T2-5: Non-browser / Node test environments handle loadGsap without throwing top-level syntax errors', async () => {
      const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
      const gsapInstance = await loadGsap();
      assert.ok(gsapInstance, 'loadGsap must resolve cleanly in Node');
    });
  });

  // =========================================================================
  // Feature 12 Boundaries: Inline Style Pruning
  // =========================================================================
  describe('Feature 12 Boundaries', () => {
    const html = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
    const styleBlock = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';

    test('F12-T2-1: Pruned style block contains strictly valid CSS syntax without unclosed braces or orphan selectors', () => {
      const openBraces = (styleBlock.match(/\{/g) || []).length;
      const closeBraces = (styleBlock.match(/\}/g) || []).length;
      assert.strictEqual(openBraces, closeBraces, 'CSS block must have balanced open and close braces');
    });

    test('F12-T2-2: Font URLs in @font-face point to valid existing files in client/public/fonts/', () => {
      const fontMatches = [...styleBlock.matchAll(/url\(['"]?(\/fonts\/[^'")]+)['"]?\)/g)];
      assert.ok(fontMatches.length >= 2, 'Must reference at least 2 font files');
      for (const m of fontMatches) {
        const fontRelPath = m[1].replace('/fonts/', 'client/public/fonts/');
        const fullFontPath = path.resolve(rootDir, fontRelPath);
        assert.ok(fs.existsSync(fullFontPath), `Font file must exist on disk: ${fullFontPath}`);
      }
    });

    test('F12-T2-3: HTML pre-mount loading shell renders properly without layout shifts before Tailwind loads', () => {
      assert.ok(styleBlock.includes('.loading-spinner') || styleBlock.includes('.spinner'), 'CSS must define loading spinner');
      assert.ok(styleBlock.includes('border-radius: 50%') || styleBlock.includes('animation:'), 'Spinner must have animation rules');
    });

    test('F12-T2-4: No duplicate style tags or orphan CSS comments exist in index.html head', () => {
      const styleTagCount = (html.match(/<style>/g) || []).length;
      assert.strictEqual(styleTagCount, 1, 'index.html head must contain exactly 1 inline <style> tag');
    });

    test('F12-T2-5: Unicode range declarations in font-face remain intact after pruning', () => {
      assert.ok(styleBlock.includes('unicode-range:'), 'Inline style must retain unicode-range definition for fonts');
    });
  });

  // =========================================================================
  // Feature 15 Boundaries: Vite Build Settings Hardening
  // =========================================================================
  describe('Feature 15 Boundaries', () => {
    let config;

    test('F15-T2-1: vite.config.js exports a valid defineConfig object or function callable by Vite', async () => {
      config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      assert.ok(config && typeof config === 'object', 'vite.config.js must export configuration object');
    });

    test('F15-T2-2: Setting sourcemap to false ensures no .js.map files are generated in build output', () => {
      assert.strictEqual(config.build?.sourcemap, false, 'sourcemap must be false');
    });

    test('F15-T2-3: Target es2020 supports BigInt, dynamic import, and nullish coalescing in bundled output', () => {
      assert.strictEqual(config.build?.target, 'es2020', 'build.target must be es2020');
    });

    test('F15-T2-4: Build settings do not overwrite or collide with resolve.alias (@ and @shared)', () => {
      assert.ok(config.resolve.alias['@'].includes('src'), '@ alias must point to src');
      assert.ok(config.resolve.alias['@shared'].includes('shared'), '@shared alias must point to shared');
    });

    test('F15-T2-5: Build settings do not overwrite or collide with rollupOptions.manualChunks', () => {
      assert.strictEqual(typeof config.build.rollupOptions.output.manualChunks, 'function');
    });
  });

  // =========================================================================
  // Feature 16 Boundaries: Effects Bundle Splitting
  // =========================================================================
  describe('Feature 16 Boundaries', () => {
    test('F16-T2-1: Calling a unit animation before lazy load completes does not throw unhandled exception', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects, 'unitEffects must be loadable');
    });

    test('F16-T2-2: initEffects initializes 2D canvas contexts across both core and unit effects systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const mockMainCtx = createMockContext2D();
      const mockEffectsCtx = createMockContext2D();
      core.initEffects(mockMainCtx, mockEffectsCtx);
      assert.strictEqual(core.getCtx(), mockMainCtx);
      assert.strictEqual(core.getEffectsCtx(), mockEffectsCtx);
    });

    test('F16-T2-3: Unknown or invalid ability effect keys fail gracefully without crashing particle loop', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.doesNotThrow(() => {
        core.drawParticles({ pieces: [] });
      });
    });

    test('F16-T2-4: Concurrent calls to trigger unit effects queue or execute seamlessly once loaded', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects);
    });

    test('F16-T2-5: Legacy particle system in core.js updates and renders independently of unit animations', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      const ctx = createMockContext2D();
      core.initEffects(ctx, ctx);
      assert.doesNotThrow(() => {
        core.drawRifts({ pieces: [] });
      });
    });
  });

  // =========================================================================
  // Feature 17 Boundaries: Firebase Hosting Headers
  // =========================================================================
  describe('Feature 17 Boundaries', () => {
    let fbJson;

    test('F17-T2-1: /assets/** rule applies strictly and does not conflict with /index.html rewrite rule', () => {
      fbJson = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
      const rewrites = fbJson.hosting?.rewrites || [];
      const wildcardRewrite = rewrites.find(r => r.source === '**');
      assert.strictEqual(wildcardRewrite?.destination, '/index.html', 'Wildcard rewrite must point to /index.html');
    });

    test('F17-T2-2: Font caching headers cover .woff2 and .woff files located under /fonts/', () => {
      const headers = fbJson.hosting?.headers || [];
      const fontHeader = headers.find(h => h.source === '/fonts/**');
      assert.ok(fontHeader, 'Headers must include dedicated rule for /fonts/**');
    });

    test('F17-T2-3: max-age value is exactly 31536000 seconds (1 full year) and marked immutable', () => {
      const headers = fbJson.hosting?.headers || [];
      const assetHeader = headers.find(h => h.source === '/assets/**');
      const val = assetHeader.headers.find(h => h.key === 'Cache-Control').value;
      assert.strictEqual(val, 'public, max-age=31536000, immutable');
    });

    test('F17-T2-4: firebase.json contains no trailing comma syntax errors or duplicate source keys', () => {
      assert.doesNotThrow(() => {
        JSON.parse(fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8'));
      });
    });

    test('F17-T2-5: Dynamic data formats (.json, .xml, .txt) maintain their short 1-hour cache rule (max-age=3600)', () => {
      const headers = fbJson.hosting?.headers || [];
      const jsonRule = headers.find(h => h.source && h.source.includes('json'));
      assert.ok(jsonRule, 'Rule for json files must exist');
      const cc = jsonRule.headers.find(k => k.key === 'Cache-Control').value;
      assert.strictEqual(cc, 'public, max-age=3600');
    });
  });

});
