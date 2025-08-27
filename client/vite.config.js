import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname, // /app/client en prod
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
});
