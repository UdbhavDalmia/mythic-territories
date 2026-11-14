import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = fs.existsSync(path.resolve('dist'))
  ? path.resolve('dist')
  : path.resolve('client/dist');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg', '.webmanifest', '.xml', '.txt']);

console.log('⚡ Generating Brotli (level 11) and Gzip (level 9) pre-compressed assets...');

const indexPath = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(
    /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/,
    '<link rel="preload" as="style" href="$1" crossorigin><link rel="stylesheet" href="$1" crossorigin media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="$1" crossorigin></noscript>'
  );
  html = html.replace(
    /<script(?:\s+async)?\s+type="module"\s+crossorigin\s+src="(\/assets\/index-[^"]+\.js)"><\/script>/,
    '<script type="module" async crossorigin src="$1"></script>'
  );
  fs.writeFileSync(indexPath, html);
  console.log('  ✓ Optimized dist/index.html: Made CSS non-render-blocking & entry JS async');
}

const files = getAllFiles(DIST_DIR);
let totalOriginal = 0;
let totalBrotli = 0;
let totalGzip = 0;
let count = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!EXTENSIONS.has(ext)) continue;
  if (file.endsWith('.br') || file.endsWith('.gz')) continue;

  const content = fs.readFileSync(file);
  if (content.length < 256) continue; // skip tiny files

  const br = zlib.brotliCompressSync(content, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length
    }
  });

  const gz = zlib.gzipSync(content, { level: 9 });

  fs.writeFileSync(`${file}.br`, br);
  fs.writeFileSync(`${file}.gz`, gz);

  totalOriginal += content.length;
  totalBrotli += br.length;
  totalGzip += gz.length;
  count++;

  const rel = path.relative(DIST_DIR, file);
  if (rel.startsWith('assets/')) {
    const origKb = (content.length / 1024).toFixed(1);
    const brKb = (br.length / 1024).toFixed(1);
    const gzKb = (gz.length / 1024).toFixed(1);
    const savings = Math.round((1 - br.length / content.length) * 100);
    console.log(`  ✓ ${rel}: ${origKb} kB → br: ${brKb} kB (${savings}% smaller) [gz: ${gzKb} kB]`);
  }
}

console.log(`\n🎉 Pre-compressed ${count} files:`);
console.log(`  Original: ${(totalOriginal / 1024).toFixed(1)} kB`);
console.log(`  Gzip (lvl 9):   ${(totalGzip / 1024).toFixed(1)} kB (${Math.round((1 - totalGzip / totalOriginal) * 100)}% savings)`);
console.log(`  Brotli (lvl 11): ${(totalBrotli / 1024).toFixed(1)} kB (${Math.round((1 - totalBrotli / totalOriginal) * 100)}% savings)\n`);
