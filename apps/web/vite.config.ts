import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // API_PROXY_TARGET permite apontar para outra API (ex.: VPS) sem editar este arquivo
        target: process.env.API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        // mantém /api prefix — backend expõe /api/v1
      },
    },
  },
  preview: {
    port: 4173,
  },
});
