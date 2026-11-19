import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  root: 'client',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@client': path.resolve(__dirname, './client/src')
    }
  },
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
});
