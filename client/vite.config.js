import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname, // <-- force la racine sur /app/client
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
});
