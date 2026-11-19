import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const rootDir = process.cwd();
const clientPkgUrl = pathToFileURL(path.resolve(rootDir, 'client/package.json')).href;

function tryPathExtensions(targetPath) {
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
      return targetPath;
    }
    if (stat.isDirectory()) {
      const indexPath = path.join(targetPath, 'index.js');
      if (fs.existsSync(indexPath)) return indexPath;
      const indexMjsPath = path.join(targetPath, 'index.mjs');
      if (fs.existsSync(indexMjsPath)) return indexMjsPath;
    }
  }
  if (fs.existsSync(`${targetPath}.js`)) {
    return `${targetPath}.js`;
  }
  if (fs.existsSync(`${targetPath}.mjs`)) {
    return `${targetPath}.mjs`;
  }
  if (fs.existsSync(`${targetPath}.jsx`)) {
    return `${targetPath}.jsx`;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1. Handle @shared/* alias
  if (specifier === '@shared' || specifier.startsWith('@shared/')) {
    const subpath = specifier === '@shared' ? '' : specifier.slice('@shared/'.length);
    const basePath = path.resolve(rootDir, 'shared', subpath);
    const resolved = tryPathExtensions(basePath);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  // 2. Handle @/* alias
  if (specifier === '@' || specifier.startsWith('@/')) {
    const subpath = specifier === '@' ? '' : specifier.slice('@/'.length);
    const basePath = path.resolve(rootDir, 'client/src', subpath);
    const resolved = tryPathExtensions(basePath);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  // 3. Try standard nextResolve first (preserves CJS vs ESM format determination)
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // 4. Handle relative directory imports or missing extensions if nextResolve failed
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file://')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const targetPath = path.resolve(parentDir, specifier);
      const resolved = tryPathExtensions(targetPath);
      if (resolved) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
    }

    // 5. If bare module not found from root, try resolving relative to client/package.json
    try {
      return await nextResolve(specifier, {
        ...context,
        parentURL: clientPkgUrl
      });
    } catch {
      throw err;
    }
  }
}
