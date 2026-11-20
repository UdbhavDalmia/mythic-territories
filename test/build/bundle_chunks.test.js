import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Build: Bundle Chunks, Dynamic Imports & Tooling Settings', () => {

  // =========================================================================
  // Feature 1: Lucide-React Deep Imports & OptimizeDeps
  // =========================================================================
  describe('Feature 1: Lucide-React Deep Imports', () => {
    test('Game.jsx does not import from bare root lucide-react package', () => {
      const filePath = path.resolve(rootDir, 'client/src/components/Game.jsx');
      const content = fs.readFileSync(filePath, 'utf8');
      const bareImportMatch = content.match(/from\s+['"]lucide-react['"]/);
      assert.strictEqual(bareImportMatch, null, 'Game.jsx must not have bare imports from "lucide-react"');
      assert.ok(content.includes('lucide-react/dist/esm/icons/') || content.includes('optimizeDeps'), 'Game.jsx should use deep icon imports');
    });

    test('Lobby component files use deep icon imports', () => {
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

    test('Static screens and data files use deep icon imports', () => {
      const files = [
        'client/src/components/Guide.jsx',
        'client/src/components/Notes.jsx',
        'client/src/components/Settings.jsx',
        'client/src/components/VictoryScreen.jsx',
        'client/src/data/patchNotes.jsx',
        'client/src/data/guideData.jsx'
      ];
      for (const relPath of files) {
        const fullPath = path.resolve(rootDir, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const bareMatch = content.match(/from\s+['"]lucide-react['"]/);
          assert.strictEqual(bareMatch, null, `${relPath} must not use bare root lucide-react import`);
        }
      }
    });

    test('All deep imported icons in Game.jsx resolve to existing files in node_modules', () => {
      const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');
      const matches = [...gameContent.matchAll(/from\s+['"]lucide-react\/dist\/esm\/icons\/([^'"]+)['"]/g)];
      assert.ok(matches.length > 0, 'Should find deep icon imports in Game.jsx');
      for (const m of matches) {
        const iconFile = m[1];
        const iconPath = path.resolve(rootDir, 'client/node_modules/lucide-react/dist/esm/icons', iconFile);
        assert.ok(fs.existsSync(iconPath), `Icon file ${iconFile} must exist at ${iconPath}`);
      }
    });

    test('Icon import paths have valid extensions and kebab-case icon names', () => {
      const gameContent = fs.readFileSync(path.resolve(rootDir, 'client/src/components/Game.jsx'), 'utf8');
      const matches = [...gameContent.matchAll(/from\s+['"]lucide-react\/dist\/esm\/icons\/([^'"]+)['"]/g)];
      for (const m of matches) {
        const iconName = m[1];
        assert.ok(iconName.endsWith('.js'), `Icon path must end with .js: ${iconName}`);
        const baseName = iconName.replace('.js', '');
        assert.match(baseName, /^[a-z0-9\-]+$/, `Icon name must be kebab-case: ${baseName}`);
      }
    });
  });

  // =========================================================================
  // Feature 7: Multiplayer Manual Chunk Splitting
  // =========================================================================
  describe('Feature 7: Manual Chunk Splitting', () => {
    let manualChunks;

    test('vite.config.js manualChunks separates src/services/multiplayer into multiplayer chunk', async () => {
      const viteConfig = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      manualChunks = viteConfig.build?.rollupOptions?.output?.manualChunks;
      assert.strictEqual(typeof manualChunks, 'function', 'manualChunks must be defined as a function');
      const result = manualChunks('/workspace/client/src/services/multiplayer.js');
      assert.strictEqual(result, 'multiplayer', 'manualChunks must return "multiplayer" for src/services/multiplayer');
    });

    test('manualChunks preserves vendor-react chunk for react ecosystem packages', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/react/index.js'), 'vendor-react');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/react-dom/index.js'), 'vendor-react');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/scheduler/index.js'), 'vendor-react');
    });

    test('manualChunks preserves vendor-gsap chunk for gsap package', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/gsap/index.js'), 'vendor-gsap');
    });

    test('manualChunks preserves vendor-firebase chunk for firebase packages', () => {
      assert.strictEqual(manualChunks('/workspace/client/node_modules/firebase/app/dist/index.mjs'), 'vendor-firebase');
      assert.strictEqual(manualChunks('/workspace/client/node_modules/@firebase/firestore/dist/index.mjs'), 'vendor-firebase');
    });

    test('manualChunks handles Windows-style backslashes in id paths gracefully', () => {
      const winPath = 'C:\\workspace\\client\\src\\services\\multiplayer.js';
      const normalizedWinPath = winPath.replace(/\\/g, '/');
      const result = manualChunks(winPath) || manualChunks(normalizedWinPath);
      assert.strictEqual(result, 'multiplayer');
    });
  });

  // =========================================================================
  // Feature 8: Firebase Dynamic Import
  // =========================================================================
  describe('Feature 8: Firebase Dynamic Import', () => {
    test('firebase.js and multiplayer.js contain no eager top-level static imports of firebase packages', () => {
      const firebaseContent = fs.readFileSync(path.resolve(rootDir, 'client/src/services/firebase.js'), 'utf8');
      const eagerFirebase = firebaseContent.match(/^import\s+.*from\s+['"]firebase/m);
      assert.strictEqual(eagerFirebase, null);

      const mpContent = fs.readFileSync(path.resolve(rootDir, 'client/src/services/multiplayer.js'), 'utf8');
      const eagerMp = mpContent.match(/^import\s+.*from\s+['"]firebase/m);
      assert.strictEqual(eagerMp, null);
    });

    test('firebase.js exports async getFirebaseServices and getAuthUser', async () => {
      const fbService = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      assert.strictEqual(typeof fbService.getFirebaseServices, 'function');
      assert.strictEqual(typeof fbService.getAuthUser, 'function');
    });

    test('getFirebaseServices returns singleton promise or service instances on repeated invocations', async () => {
      const { getFirebaseServices } = await import(path.resolve(rootDir, 'client/src/services/firebase.js'));
      const s1 = await getFirebaseServices();
      const s2 = await getFirebaseServices();
      assert.ok(s1 && s2);
      assert.strictEqual(s1.db, s2.db);
      assert.strictEqual(s1.auth, s2.auth);
    });

    test('multiplayer room subscriptions return a cancellable cleanup handle', async () => {
      const mp = await import(path.resolve(rootDir, 'client/src/services/multiplayer.js'));
      if (typeof mp.subscribeToRoom === 'function') {
        const cleanup = mp.subscribeToRoom('TESTROOM', () => {});
        assert.strictEqual(typeof cleanup, 'function');
        assert.doesNotThrow(() => cleanup());
      }
    });
  });

  // =========================================================================
  // Feature 11: Dynamic GSAP Import in Components
  // =========================================================================
  describe('Feature 11: Dynamic GSAP Import', () => {
    test('Guide, Notes, Settings, Piece do not eagerly import gsap at top-level', () => {
      const files = [
        'client/src/components/Guide.jsx',
        'client/src/components/Notes.jsx',
        'client/src/components/Settings.jsx',
        'client/src/components/Piece.jsx'
      ];
      for (const f of files) {
        const content = fs.readFileSync(path.resolve(rootDir, f), 'utf8');
        const eager = content.match(/^import\s+gsap\s+from\s+['"]gsap['"]/m);
        assert.strictEqual(eager, null, `${f} must not eagerly import gsap at top level`);
      }
    });

    test('Shared GSAP loader resolves gsap instance asynchronously', async () => {
      const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
      assert.strictEqual(typeof loadGsap, 'function');
      const gsapInstance = await loadGsap();
      assert.ok(gsapInstance);
      assert.strictEqual(typeof gsapInstance.to, 'function');
      assert.strictEqual(typeof gsapInstance.timeline, 'function');
    });

    test('Multiple concurrent calls to loadGsap share exact same promise instance', async () => {
      const { loadGsap } = await import(path.resolve(rootDir, 'client/src/services/gsap.js'));
      const p1 = loadGsap();
      const p2 = loadGsap();
      assert.strictEqual(p1, p2);
    });
  });

  // =========================================================================
  // Feature 15: Vite Build Settings Hardening
  // =========================================================================
  describe('Feature 15: Vite Build Settings', () => {
    let config;

    test('vite.config.js build settings are strictly hardened', async () => {
      config = (await import(path.resolve(rootDir, 'client/vite.config.js'))).default;
      assert.strictEqual(config.build?.target, 'es2020');
      assert.strictEqual(config.build?.minify, 'esbuild');
      assert.strictEqual(config.build?.sourcemap, false);
      assert.strictEqual(config.build?.reportCompressedSize, false);
    });

    test('vite.config.js retains resolve aliases and plugins', () => {
      assert.ok(config.resolve?.alias?.['@']);
      assert.ok(config.resolve?.alias?.['@shared']);
      assert.ok(Array.isArray(config.plugins));
    });
  });

});
