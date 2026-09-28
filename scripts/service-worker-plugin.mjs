// Vite build plugin for offline play. Plain JS so the app's tsconfig needs no Node types.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function publicFiles(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return publicFiles(path, root);
    return name.endsWith('.md') ? [] : [relative(root, path).split('\\').join('/')];
  });
}

/**
 * @returns {import('vite').Plugin}
 * Build-only: emits sw.js, which precaches the bundle and public assets for offline play.
 * The cache name hashes the bundle, file list and worker code, so each deploy gets a fresh cache.
 */
export function serviceWorker() {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', ...Object.keys(bundle), ...publicFiles('public')].sort();
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : chunk.source);
      }
      const template = readFileSync('src/sw.template.js', 'utf8');
      hash.update(files.join('\n'));
      hash.update(template);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__CACHE__', JSON.stringify(`orbit-${hash.digest('hex').slice(0, 12)}`))
          .replace('__PRECACHE__', JSON.stringify(files)),
      });
    },
  };
}
