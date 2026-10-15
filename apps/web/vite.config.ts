import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, Vite redirige /api vers le serveur Node (apps/api). L'hôte d'origine est conservé (comme
    // nginx en production) : l'API vérifie que les modifications viennent du site lui-même.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
    },
  },
});
