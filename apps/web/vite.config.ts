import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, Vite redirige /api vers le serveur Node (apps/api).
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
