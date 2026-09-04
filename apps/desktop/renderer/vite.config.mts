import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(repoRoot, 'public'),
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env': JSON.stringify({
      NODE_ENV: process.env.NODE_ENV || 'development',
    }),
  },
  resolve: {
    alias: {
      '@': repoRoot,
      '@momentai/shared-types': path.resolve(repoRoot, 'packages/shared-types/src'),
      '@momentai/session-engine': path.resolve(repoRoot, 'packages/session-engine/src'),
      '@momentai/shot-engine': path.resolve(repoRoot, 'packages/shot-engine/src'),
      '@momentai/camera-contract': path.resolve(repoRoot, 'packages/camera-contract/src'),
      '@momentai/printer-contract': path.resolve(repoRoot, 'packages/printer-contract/src'),
      '@momentai/storage-contract': path.resolve(repoRoot, 'packages/storage-contract/src'),
      '@momentai/admin-contract': path.resolve(repoRoot, 'packages/admin-contract/src'),
      '@momentai/test-fixtures': path.resolve(repoRoot, 'packages/test-fixtures/src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
