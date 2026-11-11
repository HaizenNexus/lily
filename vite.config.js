
import { defineConfig } from 'vite';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const publicRoot = resolve(projectRoot, 'public');
const outputDir = resolve(projectRoot, 'dist');

function copyLilyFiles() {
  return {
    name: 'lily-copy-pwa-files',
    apply: 'build',

    async closeBundle() {
      const outputAssets = resolve(outputDir, 'assets');

      await mkdir(outputAssets, { recursive: true });

      // Copia o motor WebAssembly do Wllama.
      await copyFile(
        resolve(publicRoot, 'assets/wllama.wasm'),
        resolve(outputAssets, 'wllama.wasm')
      );

      // Preserva o Service Worker.
      await copyFile(
        resolve(publicRoot, 'sw.js'),
        resolve(outputDir, 'sw.js')
      );

      // Preserva o manifesto do PWA.
      await copyFile(
        resolve(publicRoot, 'manifest.webmanifest'),
        resolve(outputDir, 'manifest.webmanifest')
      );

      console.log('[LILY] WASM e arquivos do PWA copiados com sucesso!');
    }
  };
}

export default defineConfig({
  root: publicRoot,
  publicDir: false,

  plugins: [copyLilyFiles()],

    preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },

  build: {
    outDir: outputDir,
    emptyOutDir: true
  }
});
