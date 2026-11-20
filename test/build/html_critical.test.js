import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('Build: Critical HTML & Inline Style Pruning', () => {

  const htmlContent = fs.readFileSync(path.resolve(rootDir, 'client/index.html'), 'utf8');
  const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
  const styleBlock = styleMatch ? styleMatch[1] : '';

  // =========================================================================
  // Feature 12: Inline Style Pruning in index.html
  // =========================================================================
  describe('Inline Style Pruning & Typography Integrity', () => {
    test('client/index.html retains Almendra SC @font-face declaration', () => {
      assert.ok(styleMatch, 'index.html must have an inline <style> block');
      assert.ok(styleBlock.includes("'Almendra SC'"), 'Inline style must declare Almendra SC font-face');
    });

    test('client/index.html retains Rye @font-face declaration', () => {
      assert.ok(styleBlock.includes("'Rye'"), 'Inline style must declare Rye font-face');
    });

    test('client/index.html retains html/body reset and background-color #0B1019', () => {
      assert.ok(styleBlock.includes('#0B1019') || styleBlock.includes('#0b1019'), 'Inline style must include background color #0B1019');
      assert.ok(styleBlock.includes('box-sizing: border-box'), 'Inline style must include base box-sizing reset');
    });

    test('client/index.html retains loading spinner CSS class definition', () => {
      assert.ok(styleBlock.includes('.loading-spinner') || styleBlock.includes('.spinner'), 'Inline style must include spinner class');
    });

    test('client/index.html prunes redundant utility classes (.min-h-screen, .flex, .grid)', () => {
      assert.strictEqual(styleBlock.includes('.min-h-screen {'), false, 'Pruned style must not define .min-h-screen');
      assert.strictEqual(styleBlock.includes('.flex {'), false, 'Pruned style must not define .flex');
      assert.strictEqual(styleBlock.includes('.grid {'), false, 'Pruned style must not define .grid');
      const lineCount = styleBlock.split('\n').length;
      assert.ok(lineCount < 150, `Pruned style block should be compact (current lines: ${lineCount})`);
    });
  });

  // =========================================================================
  // Style Block Boundaries & Asset Integrity
  // =========================================================================
  describe('Style Syntax & Asset Reference Validation', () => {
    test('Pruned style block contains strictly valid CSS syntax with balanced braces', () => {
      const openBraces = (styleBlock.match(/\{/g) || []).length;
      const closeBraces = (styleBlock.match(/\}/g) || []).length;
      assert.strictEqual(openBraces, closeBraces, 'CSS block must have balanced open and close braces');
    });

    test('Font URLs in @font-face point to valid existing files in client/public/fonts/', () => {
      const fontMatches = [...styleBlock.matchAll(/url\(['"]?(\/fonts\/[^'")]+)['"]?\)/g)];
      assert.ok(fontMatches.length >= 2, 'Must reference at least 2 font files');
      for (const m of fontMatches) {
        const fontRelPath = m[1].replace('/fonts/', 'client/public/fonts/');
        const fullFontPath = path.resolve(rootDir, fontRelPath);
        assert.ok(fs.existsSync(fullFontPath), `Font file must exist on disk: ${fullFontPath}`);
      }
    });

    test('No duplicate style tags exist in index.html head', () => {
      const styleTagCount = (htmlContent.match(/<style>/g) || []).length;
      assert.strictEqual(styleTagCount, 1, 'index.html head must contain exactly 1 inline <style> tag');
    });

    test('Unicode range declarations in font-face remain intact after pruning', () => {
      assert.ok(styleBlock.includes('unicode-range:'), 'Inline style must retain unicode-range definition for fonts');
    });
  });

});
