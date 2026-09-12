import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
  build: {
    // The three.js runtime is an isolated lazy chunk (~880KB raw, 234KB
    // gzip) loaded only by the 3D games — expected, not a regression.
    chunkSizeWarningLimit: 950,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // Playwright owns e2e/ — keep vitest out of it. Also skip stale test
    // copies inside .claude worktrees so old snapshots can't run.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.claude/**'],
    // convex-test ships TS that must be transformed by Vite
    server: { deps: { inline: ['convex-test'] } },
    // A three.js "multiple instances" warning emitted during teardown races
    // the worker RPC close and fails the run with EnvironmentTeardownError.
    onConsoleLog(log) {
      if (log.includes('Multiple instances of Three.js')) return false;
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**', 'convex/**'],
      exclude: ['convex/_generated/**', 'src/test-setup.ts', 'src/assets/**'],
    },
  },
})
