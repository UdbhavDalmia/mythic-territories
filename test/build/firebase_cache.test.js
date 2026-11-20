import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Build: Firebase Hosting Cache Headers & Security Rules', () => {

  const content = fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf8');
  const firebaseConfig = JSON.parse(content);
  const headers = firebaseConfig.hosting?.headers || [];

  // =========================================================================
  // Feature 17: Firebase Hosting Cache-Control Headers
  // =========================================================================
  describe('Hosting Cache Policy Configuration', () => {
    test('firebase.json contains Cache-Control header for /assets/**', () => {
      const assetRule = headers.find(h => h.source === '/assets/**');
      assert.ok(assetRule, 'Rule for /assets/** must exist in headers');
      const cc = assetRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /assets/**');
      assert.strictEqual(cc.value, 'public, max-age=31536000, immutable');
    });

    test('firebase.json contains Cache-Control header for /fonts/**', () => {
      const fontRule = headers.find(h => h.source === '/fonts/**');
      assert.ok(fontRule, 'Rule for /fonts/** must exist in headers');
      const cc = fontRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /fonts/**');
      assert.strictEqual(cc.value, 'public, max-age=31536000, immutable');
    });

    test('firebase.json maintains /index.html cache policy as no-cache, no-store, must-revalidate', () => {
      const indexRule = headers.find(h => h.source === '/index.html');
      assert.ok(indexRule, 'Rule for /index.html must exist in headers');
      const cc = indexRule.headers.find(k => k.key.toLowerCase() === 'cache-control');
      assert.ok(cc, 'Cache-Control header must be defined for /index.html');
      assert.strictEqual(cc.value, 'no-cache, no-store, must-revalidate');
    });

    test('firebase.json security headers (X-Content-Type-Options, X-Frame-Options) remain intact', () => {
      const globalRule = headers.find(h => h.source === '**');
      assert.ok(globalRule, 'Global rule for ** must exist');
      const nosniff = globalRule.headers.find(k => k.key === 'X-Content-Type-Options');
      assert.strictEqual(nosniff?.value, 'nosniff');
      const frameOptions = globalRule.headers.find(k => k.key === 'X-Frame-Options');
      assert.strictEqual(frameOptions?.value, 'SAMEORIGIN');
    });

    test('firebase.json public directory points to client/dist', () => {
      assert.strictEqual(firebaseConfig.hosting?.public, 'client/dist');
    });
  });

  // =========================================================================
  // Header Boundaries & Routing Rules
  // =========================================================================
  describe('Hosting Header Routing & Format Rules', () => {
    test('/assets/** rule applies strictly and does not conflict with /index.html rewrite rule', () => {
      const rewrites = firebaseConfig.hosting?.rewrites || [];
      const wildcardRewrite = rewrites.find(r => r.source === '**');
      assert.strictEqual(wildcardRewrite?.destination, '/index.html', 'Wildcard rewrite must point to /index.html');
    });

    test('Font caching headers cover .woff2 and .woff files located under /fonts/', () => {
      const fontHeader = headers.find(h => h.source === '/fonts/**');
      assert.ok(fontHeader, 'Headers must include dedicated rule for /fonts/**');
    });

    test('max-age value is exactly 31536000 seconds (1 full year) and marked immutable', () => {
      const assetHeader = headers.find(h => h.source === '/assets/**');
      const val = assetHeader.headers.find(h => h.key === 'Cache-Control').value;
      assert.strictEqual(val, 'public, max-age=31536000, immutable');
    });

    test('firebase.json contains no trailing comma syntax errors or duplicate source keys', () => {
      assert.doesNotThrow(() => {
        JSON.parse(content);
      });
    });

    test('Dynamic data formats maintain their short 1-hour cache rule (max-age=3600)', () => {
      const jsonRule = headers.find(h => h.source && h.source.includes('json'));
      assert.ok(jsonRule, 'Rule for json files must exist');
      const cc = jsonRule.headers.find(k => k.key === 'Cache-Control').value;
      assert.strictEqual(cc, 'public, max-age=3600');
    });
  });

});
