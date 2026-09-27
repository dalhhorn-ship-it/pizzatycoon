import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Writes a build id into dist/sw.js, so each build is a new service worker (solution-design.md 10). */
function serviceWorkerBuildId(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sw-build-id',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      try {
        writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', Date.now().toString(36)));
      } catch {
        // No service worker in this build.
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorkerBuildId()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
