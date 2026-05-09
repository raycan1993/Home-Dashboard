import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server config.
//
// `host: '127.0.0.1'` keeps the dev server off the LAN, matching the backend.
// The proxy forwards /api to the backend so the SPA never sees a different
// origin in dev — eliminates a class of CORS quirks while still exercising
// the production-equivalent CORS allowlist.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
});
