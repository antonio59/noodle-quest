import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'

const { version } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
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
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**', 'convex/**'],
      exclude: ['convex/_generated/**', 'src/test-setup.ts', 'src/assets/**'],
    },
  },
})
