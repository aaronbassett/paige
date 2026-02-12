import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  base: './',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
