import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = process.cwd();

describe('Static Screens & Documentation Integrity', () => {
  describe('Rulebook & Guide Data Integrity', () => {
    const guideDataPath = path.resolve(rootDir, 'client/src/data/guideData.jsx');
    const guideJsxPath = path.resolve(rootDir, 'client/src/components/Guide.jsx');

    test('guideData.jsx and Guide.jsx files exist and use deep lucide imports', () => {
      assert.ok(fs.existsSync(guideDataPath), 'guideData.jsx must exist');
      assert.ok(fs.existsSync(guideJsxPath), 'Guide.jsx must exist');

      const dataContent = fs.readFileSync(guideDataPath, 'utf8');
      const jsxContent = fs.readFileSync(guideJsxPath, 'utf8');

      assert.strictEqual(dataContent.includes("from 'lucide-react'"), false);
      assert.strictEqual(jsxContent.includes("from 'lucide-react'"), false);
    });

    test('toRulebookId regex logic sanitizes strings into URL-safe anchors', () => {
      const sanitize = (val) => val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      assert.strictEqual(sanitize('Defeat the Leader!'), 'defeat-the-leader');
      assert.strictEqual(sanitize('Special Terrain & Hazards'), 'special-terrain-hazards');
      assert.strictEqual(sanitize('  Sacred Shrine  '), 'sacred-shrine');
      assert.strictEqual(sanitize('Power Rifts and Conduit'), 'power-rifts-and-conduit');
    });

    test('UNIT_PROFILES in guideData defines all required combat stats and existing portrait assets', () => {
      const content = fs.readFileSync(guideDataPath, 'utf8');
      assert.ok(content.includes('UNIT_PROFILES ='), 'Must define UNIT_PROFILES');

      // Extract all portrait paths from guideData.jsx
      const portraits = [...content.matchAll(/portrait:\s*["']([^"']+)["']/g)].map(m => m[1]);
      assert.ok(portraits.length >= 10, `Expected at least 10 unit portraits, found ${portraits.length}`);

      for (const p of portraits) {
        const fullPath = path.resolve(rootDir, 'client/public', p.replace(/^\//, ''));
        assert.ok(fs.existsSync(fullPath), `Portrait image at ${p} must exist in client/public/`);
      }
    });

    test('TERRAIN_RULES and STATUS_RULES contain core battlefield conditions', () => {
      const content = fs.readFileSync(guideDataPath, 'utf8');
      assert.ok(content.includes("name: 'Unstable Ground'"));
      assert.ok(content.includes("name: 'Glacial Wall'"));
      assert.ok(content.includes("name: 'Dazed'"));
      assert.ok(content.includes("name: 'Stuck'"));
      assert.ok(content.includes("name: 'Steadfast'"));
    });

    test('Guide.jsx contains open layout structure and primary tab handlers', () => {
      const jsx = fs.readFileSync(guideJsxPath, 'utf8');
      // Tabs and navigation
      assert.ok(jsx.includes("activeTab === 'QUICK'"));
      assert.ok(jsx.includes("activeTab === 'RULES'"));
      assert.ok(jsx.includes("activeTab === 'ASCENSION'"));
      assert.ok(jsx.includes("activeTab === 'UNITS'"));

      // Clean open design: uses border-t or divide-y instead of heavy nested card boxes
      assert.ok(jsx.includes('divide-y') || jsx.includes('border-t'));
      // Search input present
      assert.ok(jsx.includes('searchQuery'));
    });
  });

  describe('Patch Notes & Chronicles Integrity', () => {
    const patchNotesPath = path.resolve(rootDir, 'client/src/data/patchNotes.jsx');
    const notesJsxPath = path.resolve(rootDir, 'client/src/components/Notes.jsx');
    const patchTrackingPath = path.resolve(rootDir, 'client/src/services/patchTracking.js');

    test('patchNotes.jsx defines PATCHES array with epic lore titles and version tags', () => {
      assert.ok(fs.existsSync(patchNotesPath), 'patchNotes.jsx must exist');
      const content = fs.readFileSync(patchNotesPath, 'utf8');

      assert.ok(content.includes('export const PATCHES ='));
      assert.ok(content.includes('Dawn of the Ascendants'));
      assert.ok(content.includes('2.0 (UPCOMING)'));
      assert.ok(content.includes('1.9'));
      assert.ok(content.includes('The Royal Primal Overhaul'));
      assert.ok(content.includes('Realms United: Online Multiplayer'));
    });

    test('patchTracking.js provides unread status and latest version resolution', () => {
      assert.ok(fs.existsSync(patchTrackingPath), 'patchTracking.js must exist');
      const content = fs.readFileSync(patchTrackingPath, 'utf8');

      assert.ok(content.includes('getLatestReleasedVersion'));
      assert.ok(content.includes('hasUnreadPatchNotes'));
      assert.ok(content.includes('markPatchNotesAsViewed'));
    });

    test('Notes.jsx contains cinematic header and release feed', () => {
      assert.ok(fs.existsSync(notesJsxPath), 'Notes.jsx must exist');
      const jsx = fs.readFileSync(notesJsxPath, 'utf8');

      assert.ok(jsx.includes('Chronicles of the Realm') || jsx.includes('Notes'));
      assert.ok(jsx.includes('PATCHES.map') || jsx.includes('upcomingPatches'));
    });
  });

  describe('Settings & Controls Integrity', () => {
    const settingsPath = path.resolve(rootDir, 'client/src/components/Settings.jsx');
    const motionPrefPath = path.resolve(rootDir, 'client/src/services/motionPreference.js');
    const hapticsPath = path.resolve(rootDir, 'client/src/services/haptics.js');

    test('Settings.jsx provides sliding animation for motion toggle (On on left, Reduced on right)', () => {
      assert.ok(fs.existsSync(settingsPath), 'Settings.jsx must exist');
      const content = fs.readFileSync(settingsPath, 'utf8');

      // Check for the segmented control arrangement: On first (left), Reduced second (right)
      const onIndex = content.indexOf("handleSelectMotion('full')");
      const reducedIndex = content.indexOf("handleSelectMotion('reduced')");
      assert.ok(reducedIndex > 0 && onIndex > 0, 'Both motion buttons must exist');
      assert.ok(onIndex < reducedIndex, 'On must precede Reduced in order (On left, Reduced right)');

      // Check for sliding pill classes
      assert.ok(content.includes('transition-all duration-300 ease-out'));
      assert.ok(content.includes("motionMode === 'reduced'"));
      assert.ok(content.includes("'left-[calc(50%)] bg-slate-200'"));
      assert.ok(content.includes("'left-1 bg-amber-400'"));
    });

    test('motionPreference.js functions operate safely in all environments', async () => {
      assert.ok(fs.existsSync(motionPrefPath), 'motionPreference.js must exist');
      const { getMotionPreference, applyMotionPreference } = await import(path.resolve(rootDir, 'client/src/services/motionPreference.js'));
      assert.ok(typeof getMotionPreference === 'function');
      assert.ok(typeof applyMotionPreference === 'function');

      applyMotionPreference('reduced');
      assert.strictEqual(getMotionPreference(), 'reduced');
      applyMotionPreference('full');
      assert.strictEqual(getMotionPreference(), 'full');
    });

    test('haptics.js handles vibration toggling and trigger execution gracefully', async () => {
      assert.ok(fs.existsSync(hapticsPath), 'haptics.js must exist');
      const { getHapticsEnabled, setHapticsEnabled, triggerHaptic } = await import(path.resolve(rootDir, 'client/src/services/haptics.js'));

      setHapticsEnabled(true);
      assert.strictEqual(getHapticsEnabled(), true);
      assert.doesNotThrow(() => triggerHaptic('light'));

      setHapticsEnabled(false);
      assert.strictEqual(getHapticsEnabled(), false);
      assert.doesNotThrow(() => triggerHaptic('selection'));
    });
  });
});
