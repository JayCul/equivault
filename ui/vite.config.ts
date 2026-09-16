import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  // `build.target: esnext` gives native top-level await, so no transform plugin
  // is needed (and the SWC-based one cannot handle these bundles).
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    // The Midnight SDK reaches for a handful of Node built-ins in the browser.
    nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util', 'events', 'path'] }),
  ],
  server: {
    // The repo lives on the Windows filesystem while the dev server runs in
    // WSL, where inotify does not fire for /mnt/c. Without polling, edits are
    // silently ignored until the server restarts.
    watch: { usePolling: true, interval: 400 },
  },
  resolve: {
    alias: {
      'isomorphic-ws': fileURLToPath(new URL('./src/lib/websocket-shim.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Only the packages that ship wasm, or that re-export from one that does,
    // are kept out of esbuild's dependency pre-bundling - esbuild cannot follow
    // those re-exports. Everything else is pre-bundled normally, which is what
    // makes the many CommonJS transitive dependencies importable.
    exclude: [
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/ledger-v8',
      '@midnight-ntwrk/midnight-js-protocol',
      '@midnight-ntwrk/midnight-js-contracts',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
      // Workspace sources: always served from source, never pre-bundled.
      '@equivault/contract',
      '@equivault/api',
    ],
    // CommonJS packages reached only through the excluded ones above. Without
    // this they are served raw and their default export is missing at runtime.
    include: ['object-inspect', 'side-channel', 'qs', 'cross-fetch', 'fetch-retry'],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 4096,
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
