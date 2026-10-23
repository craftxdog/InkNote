import path from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { dependencies as nativeDependencies } from './release/app/package.json';
import tailwindcss from '@tailwindcss/vite';

const root = __dirname;
const nativeModules = Object.keys(nativeDependencies || {});
// Use an array so electron-vite can merge these with its builtin externals.
const external = nativeModules.flatMap((name) => [
  name,
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
]);

export default defineConfig({
  main: {
    build: {
      outDir: 'release/app/dist/main',
      sourcemap: true,
      externalizeDeps: false,
      rollupOptions: {
        input: path.join(root, 'src/main/main.ts'),
        external,
        output: { entryFileNames: 'main.js' },
      },
    },
  },
  preload: {
    build: {
      outDir: 'release/app/dist/preload',
      sourcemap: true,
      externalizeDeps: false,
      rollupOptions: {
        input: path.join(root, 'src/main/preload.ts'),
        external,
        output: { entryFileNames: 'preload.js' },
      },
    },
  },
  renderer: {
    root: path.join(root, 'src/renderer'),
    base: './',
    plugins: [react({}), svgr(), tailwindcss()],
    server: {
      host: 'localhost',
      port: Number(process.env.PORT || 1212),
      strictPort: true,
    },
    build: {
      outDir: path.join(root, 'release/app/dist/renderer'),
      emptyOutDir: true,
      minify: 'esbuild',
      sourcemap: true,
      // Mermaid loads its diagram engines on demand. ELK is the largest one
      // (about 1.5 MB minified), so the normal 500 kB warning is not useful.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: path.join(root, 'src/renderer/index.html'),
        output: {
          entryFileNames: 'renderer.js',
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/');

            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/')
            ) {
              return 'react';
            }

            if (
              normalizedId.includes('/node_modules/@codemirror/lang-markdown/')
            ) {
              return 'markdown-language';
            }

            if (normalizedId.includes('/node_modules/@codemirror/')) {
              return 'codemirror-editor';
            }

            return undefined;
          },
        },
      },
    },
  },
});
