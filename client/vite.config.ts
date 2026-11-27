import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const output = fileURLToPath(new URL('../dist', import.meta.url));

export default defineConfig({
  root: here,
  publicDir: false,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' }
  },
  build: { outDir: output, emptyOutDir: true, sourcemap: false, manifest: true }
});