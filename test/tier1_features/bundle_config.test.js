import { describe, test, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Tier 1: Bundle, Build Configuration & Asset Optimization', () => {

  // =========================================================================
  // Feature 1: Lucide-React Deep Imports & OptimizeDeps
  // =========================================================================
  describe('Feature 1: Lucide-React Deep Imports & OptimizeDeps', () => {
    test('F1-T1-1: Game.jsx does not import from bare root lucide-react package', () => {
      const filePath = path.resolve(rootDir, 'client/src/components/Game.jsx');
      const content = fs.readFileSync(filePath, 'utf8');
      const bareImportMatch = content.match(/from\s+['"]lucide-react['"]/);
      assert.strictEqual(bareImportMatch, null, 'Game.jsx must not have bare imports from "lucide-react"');
      assert.ok(content.includes('lucide-react/dist/esm/icons/') || content.includes('optimizeDeps'), 'Game.jsx should use deep icon imports');
    });

    test('F1-T1-2: Lobby component files use deep icon imports or optimizeDeps', () => {
      const lobbyFiles = [
        'client/src/components/lobby/LobbyHero.jsx',
        'client/src/components/lobby/LobbyFooter.jsx',
        'client/src/components/lobby/MultiplayerModal.jsx',
        'client/src/components/lobby/FactionSelectionOverlay.jsx',
        'client/src/components/lobby/RecoverableSessionBanner.jsx',
        'client/src/components/lobby/ModeSelectModal.jsx'
      ];
      for (const relPath of lobbyFiles) {
        const fullPath = path.resolve(rootDir, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const bareMatch = content.match(/from\s+['"]lucide-react['"]/);
          assert.strictEqual(bareMatch, null, `${relPath} must not use bare root lucide-react import`);
        }
      }
    });

    test('F1-T1-3: Information & static screen components (Guide, Notes, Settings, VictoryScreen) use deep icon imports', () => {
      const screenFiles = [
        'client/src/components/Guide.jsx',
        'client/src/components/Notes.jsx',
        'client/src/components/Settings.jsx',
        'client/src/components/VictoryScreen.jsx'
      ];
      for (const relPath of screenFiles) {
        const fullPath = path.resolve(rootDir, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const bareMatch = content.match(/from\s+['"]lucide-react['"]/);
          assert.strictEqual(bareMatch, null, `${relPath} must not use bare root lucide-react import`);
        }
      }
    });

    test('F1-T1-4: Static data files (patchNotes.jsx, guideData.jsx) use deep icon imports', () => {
      const dataFiles = [
        'client/src/data/patchNotes.jsx',
        'client/src/data/guideData.jsx'
      ];
      for (const relPath of dataFiles) {
        const fullPath = path.resolve(rootDir, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const bareMatch = content.match(/from\s+['"]lucide-react['"]/);
          assert.strictEqual(bareMatch, null, `${relPath} must not use bare root lucide-react import`);
        }
      }
    });

    test('F1-T1-5: All deep imported icons resolve to existing files in node_modules', () => {
      const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');
      const matches = [...gameContent.matchAll(/from\s+['"]lucide-react\/dist\/esm\/icons\/([^'"]+)['"]/g)];
      assert.ok(matches.length > 0, 'Should find deep icon imports in Game.jsx');
      for (const m of matches) {
        const iconFile = m[1];
        const iconPath = path.resolve(rootDir, 'client/node_modules/lucide-react/dist/esm/icons', iconFile);
        assert.ok(fs.existsSync(iconPath), `Icon file ${iconFile} must exist at ${iconPath}`);
      }
    });
  });

  // =========================================================================
  // Feature 7: Multiplayer Manual Chunk Splitting
  // =========================================================================
  describe('Feature 7: Multiplayer Manual Chunk Splitting', () => {
    let manualChunks;

    test('F7-T1-1: vite.config.js manualChunks separates src/services/multiplayer into multiplayer chunk', async () => {
      const viteConfig = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      manualChunks = viteConfig.build?.rollupOptions?.output?.manualChunks;
      assert.strictEqual(typeof manualChunks, 'function', 'manualChunks must be defined as a function');
      const result = manualChunks('/workspace/client/src/services/multiplayer.js');
      assert.strictEqual(result, 'multiplayer', 'manualChunks must return "multiplayer" for src/services/multiplayer');
    });

    test('F7-T1-2: manualChunks preserves vendor-react chunk for react ecosystem packages', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/react/index.js'), 'vendor-react');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/react-dom/index.js'), 'vendor-react');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/scheduler/index.js'), 'vendor-react');
    });

    test('F7-T1-3: manualChunks preserves vendor-gsap chunk for gsap package', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/gsap/index.js'), 'vendor-gsap');
    });

    test('F7-T1-4: manualChunks preserves vendor-firebase chunk for firebase packages', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/firebase/app/dist/index.mjs'), 'vendor-firebase');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/@firebase/firestore/dist/index.mjs'), 'vendor-firebase');
    });

    test('F7-T1-5: manualChunks returns undefined for standard application files to allow default rollup splitting', () => {
      assert.strictEqual(manualChunks('/workspace/client/src/components/Game.jsx'), undefined);
      assert.strictEqual(manualChunks('/workspace/client/src/rendering/boardRenderer.js'), undefined);
    });
  });

  // =========================================================================
  // Feature 8: Firebase Dynamic Import
  // =========================================================================
  describe('Feature 8: Firebase Dynamic Import', () => {
    test('F8-T1-1: firebase.js contains no eager top-level static imports of firebase packages', () => {
      const firebasePath = path.resolve(rootDir, 'client/src/services/firebase.js');
      const content = fs.readFileSync(firebasePath, 'utf8');
      const eagerMatch = content.match(/^import\s+.*from\s+['"]firebase/m);
      assert.strictEqual(eagerMatch, null, 'firebase.js must not contain eager top-level imports of firebase packages');
    });

    test('F8-T1-2: firebase.js exports async getFirebaseServices returning auth and db instances', async () => {
      const fbService = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      assert.strictEqual(typeof fbService.getFirebaseServices, 'function', 'getFirebaseServices must be exported as a function');
    });

    test('F8-T1-3: firebase.js exports getAuthUser returning promise of auth user', async () => {
      const fbService = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      assert.strictEqual(typeof fbService.getAuthUser, 'function', 'getAuthUser must be exported as a function');
    });

    test('F8-T1-4: multiplayer.js does not eagerly import firebase at module top-level', () => {
      const mpPath = path.resolve(rootDir, 'client/src/services/multiplayer.js');
      const content = fs.readFileSync(mpPath, 'utf8');
      const eagerMatch = content.match(/^import\s+.*from\s+['"]firebase/m);
      assert.strictEqual(eagerMatch, null, 'multiplayer.js must not contain top-level eager imports of firebase');
    });

    test('F8-T1-5: getFirebaseServices returns singleton promise or service instances on repeated invocations', async () => {
      const { getFirebaseServices } = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      const s1 = await getFirebaseServices();
      const s2 = await getFirebaseServices();
      assert.ok(s1 && s2, 'getFirebaseServices must resolve to valid service instances');
      assert.strictEqual(s1.db, s2.db, 'Repeated invocations to getFirebaseServices must return the same db instance');
      assert.strictEqual(s1.auth, s2.auth, 'Repeated invocations to getFirebaseServices must return the same auth instance');
    });
  });

  // =========================================================================
  // Feature 11: Dynamic GSAP Import in Components
  // =========================================================================
  describe('Feature 11: Dynamic GSAP Import in Components', () => {
    test('F11-T1-1: Guide.jsx does not eagerly import gsap at top-level', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Guide.jsx'), 'utf8');
      const eager = content.match(/^import\s+gsap\s+from\s+['"]gsap['"]/m);
      assert.strictEqual(eager, null, 'Guide.jsx must not have top-level eager gsap import');
    });

    test('F11-T1-2: Notes.jsx does not eagerly import gsap at top-level', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Notes.jsx'), 'utf8');
      const eager = content.match(/^import\s+gsap\s+from\s+['"]gsap['"]/m);
      assert.strictEqual(eager, null, 'Notes.jsx must not have top-level eager gsap import');
    });

    test('F11-T1-3: Settings.jsx does not eagerly import gsap at top-level', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Settings.jsx'), 'utf8');
      const eager = content.match(/^import\s+gsap\s+from\s+['"]gsap['"]/m);
      assert.strictEqual(eager, null, 'Settings.jsx must not have top-level eager gsap import');
    });

    test('F11-T1-4: Piece.jsx does not eagerly import gsap at top-level', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Piece.jsx'), 'utf8');
      const eager = content.match(/^import\s+gsap\s+from\s+['"]gsap['"]/m);
      assert.strictEqual(eager, null, 'Piece.jsx must not have top-level eager gsap import');
    });

    test('F11-T1-5: Shared GSAP loader resolves gsap instance asynchronously', async () => {
      const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
      assert.strictEqual(typeof loadGsap, 'function', 'loadGsap must be a function');
      const gsapInstance = await loadGsap();
      assert.ok(gsapInstance, 'loadGsap must resolve to a valid gsap instance');
      assert.strictEqual(typeof gsapInstance.to, 'function', 'gsap.to must be a function');
      assert.strictEqual(typeof gsapInstance.timeline, 'function', 'gsap.timeline must be a function');
    });
  });

  // =========================================================================
  // Feature 12: Inline Style Pruning in index.html
  // =========================================================================
  describe('Feature 12: Inline Style Pruning in index.html', () => {
    const htmlContent = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
    const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);

    test('F12-T1-1: client/index.html retains Almendra SC @font-face declaration', () => {
      assert.ok(styleMatch, 'index.html must have an inline <style> block');
      assert.ok(styleMatch[1].includes("'Almendra SC'"), 'Inline style must declare Almendra SC font-face');
    });

    test('F12-T1-2: client/index.html retains Rye @font-face declaration', () => {
      assert.ok(styleMatch[1].includes("'Rye'"), 'Inline style must declare Rye font-face');
    });

    test('F12-T1-3: client/index.html retains html/body reset and background-color #0B1019', () => {
      assert.ok(styleMatch[1].includes('#0B1019') || styleMatch[1].includes('#0b1019'), 'Inline style must include background color #0B1019');
      assert.ok(styleMatch[1].includes('box-sizing: border-box'), 'Inline style must include base box-sizing reset');
    });

    test('F12-T1-4: client/index.html retains loading spinner CSS class definition', () => {
      assert.ok(styleMatch[1].includes('.loading-spinner') || styleMatch[1].includes('.spinner'), 'Inline style must include spinner class');
    });

    test('F12-T1-5: client/index.html prunes redundant utility classes (.min-h-screen, .flex, .grid)', () => {
      const css = styleMatch[1];
      assert.strictEqual(css.includes('.min-h-screen {'), false, 'Pruned style must not define .min-h-screen');
      assert.strictEqual(css.includes('.flex {'), false, 'Pruned style must not define .flex');
      assert.strictEqual(css.includes('.grid {'), false, 'Pruned style must not define .grid');
      const lineCount = css.split('\n').length;
      assert.ok(lineCount < 150, `Pruned style block should be compact (current lines: ${lineCount})`);
    });
  });

  // =========================================================================
  // Feature 15: Vite Build Settings Hardening
  // =========================================================================
  describe('Feature 15: Vite Build Settings Hardening', () => {
    let config;

    test('F15-T1-1: vite.config.js build.target is explicitly set to es2020', async () => {
      config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      assert.strictEqual(config.build?.target, 'es2020', 'build.target must be es2020');
    });

    test('F15-T1-2: vite.config.js build.minify is explicitly set to esbuild', () => {
      assert.strictEqual(config.build?.minify, 'esbuild', 'build.minify must be esbuild');
    });

    test('F15-T1-3: vite.config.js build.sourcemap is explicitly set to false', () => {
      assert.strictEqual(config.build?.sourcemap, false, 'build.sourcemap must be false');
    });

    test('F15-T1-4: vite.config.js build.reportCompressedSize is explicitly set to false', () => {
      assert.strictEqual(config.build?.reportCompressedSize, false, 'build.reportCompressedSize must be false');
    });

    test('F15-T1-5: vite.config.js retains existing plugins and path resolve aliases', () => {
      assert.ok(config.resolve?.alias?.['@'], 'resolve.alias["@"] must be defined');
      assert.ok(config.resolve?.alias?.['@shared'], 'resolve.alias["@shared"] must be defined');
      assert.ok(Array.isArray(config.plugins), 'plugins array must be configured');
    });
  });

  // =========================================================================
  // Feature 16: Effects Bundle Splitting
  // =========================================================================
  describe('Feature 16: Effects Bundle Splitting', () => {
    test('F16-T1-1: client/src/effects/core.js exists and exports core particle systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.strictEqual(typeof core.drawParticles, 'function', 'drawParticles must be a function in core.js');
      assert.strictEqual(typeof core.drawShockwaves, 'function', 'drawShockwaves must be a function in core.js');
      assert.strictEqual(typeof core.drawRifts, 'function', 'drawRifts must be a function in core.js');
    });

    test('F16-T1-2: client/src/effects/core.js exports shrine and conduit rendering systems', async () => {
      const core = await import(path.resolve(rootDir, 'client/src/effects/core.js'));
      assert.strictEqual(typeof core.drawShrineEffects, 'function', 'drawShrineEffects must be a function in core.js');
      assert.strictEqual(typeof core.drawConduitParticles, 'function', 'drawConduitParticles must be a function in core.js');
      assert.strictEqual(typeof core.drawSiphonParticles, 'function', 'drawSiphonParticles must be a function in core.js');
    });

    test('F16-T1-3: client/src/effects/unitEffects.js exists and exports unit-specific animations', async () => {
      const unitEffects = await import(path.resolve(rootDir, 'client/src/effects/unitEffects.js'));
      assert.ok(unitEffects, 'unitEffects.js module must be loadable');
      const exportKeys = Object.keys(unitEffects);
      assert.ok(exportKeys.length > 0, 'unitEffects.js must have exports');
    });

    test('F16-T1-4: client/src/effects/index.js re-exports core systems synchronously', async () => {
      const effectsIndex = await import(path.resolve(rootDir, 'client/src/effects/index.js'));
      assert.strictEqual(typeof effectsIndex.initEffects, 'function', 'initEffects must be exported from index.js');
      assert.strictEqual(typeof effectsIndex.drawParticles, 'function', 'drawParticles must be exported from index.js');
      assert.strictEqual(typeof effectsIndex.drawShrineEffects, 'function', 'drawShrineEffects must be exported from index.js');
    });

    test('F16-T1-5: client/src/effects/core.js does not statically import unitEffects.js', () => {
      const coreContent = fs.readFileSync(path.resolve(rootDir, 'client/src/effects/core.js'), 'utf8');
      assert.strictEqual(coreContent.includes('./unitEffects.js'), false, 'core.js must not statically import unitEffects.js');
    });
  });

  // =========================================================================
  // Feature 17: Firebase Hosting Cache-Control Headers
  // =========================================================================
  describe('Feature 17: Firebase Hosting Cache-Control Headers', () => {
    let firebaseConfig;

    test('F17-T1-1: firebase.json contains Cache-Control header for /assets/**', () => {
      const content = fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8');
      firebaseConfig = JSON.parse(content);
      const headers = firebaseConfig.hosting?.headers || [];
      const assetRule = headers.find(h => h.source === '/assets/**');
      assert.ok(assetRule, 'Rule for /assets/** must exist in headers');
      const cc = assetRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /assets/**');
      assert.strictEqual(cc.value, 'public, max-age=31536000, immutable');
    });

    test('F17-T1-2: firebase.json contains Cache-Control header for /fonts/**', () => {
      const headers = firebaseConfig.hosting?.headers || [];
      const fontRule = headers.find(h => h.source === '/fonts/**');
      assert.ok(fontRule, 'Rule for /fonts/** must exist in headers');
      const cc = fontRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /fonts/**');
      assert.strictEqual(cc.value, 'public, max-age=31536000, immutable');
    });

    test('F17-T1-3: firebase.json maintains /index.html cache policy as no-cache, no-store, must-revalidate', () => {
      const headers = firebaseConfig.hosting?.headers || [];
      const indexRule = headers.find(h => h.source === '/index.html');
      assert.ok(indexRule, 'Rule for /index.html must exist in headers');
      const cc = indexRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /index.html');
      assert.strictEqual(cc.value, 'no-cache, no-store, must-revalidate');
    });

    test('F17-T1-4: firebase.json security headers (X-Content-Type-Options, X-Frame-Options) remain intact', () => {
      const headers = firebaseConfig.hosting?.headers || [];
      const globalRule = headers.find(h => h.source === '**');
      assert.ok(globalRule, 'Global rule for ** must exist');
      const nosniff = globalRule.headers.find(k => k.key === 'X-Content-Type-Options');
      assert.strictEqual(nosniff?.value, 'nosniff');
      const frameOptions = globalRule.headers.find(k => k.key === 'X-Frame-Options');
      assert.strictEqual(frameOptions?.value, 'SAMEORIGIN');
    });

    test('F17-T1-5: firebase.json public directory points to client/dist', () => {
      assert.strictEqual(firebaseConfig.hosting?.public, 'client/dist');
    });
  });

});
