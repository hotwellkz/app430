import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5174,
    host: true,
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
    proxy: {
      /** Тот же префикс, что в Netlify/CRM — чтобы можно было задать VITE_API_BASE_URL=/sip-editor-api без CORS. */
      '/sip-editor-api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sip-editor-api/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
