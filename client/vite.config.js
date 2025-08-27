import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,           // <-- très important: Vite regarde /app/client
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
});
