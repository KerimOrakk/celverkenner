import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // De frontend gebruikt backend/data/*.json als offline-terugval. Die map
    // ligt buiten frontend/, dus Vite moet één niveau omhoog mogen lezen.
    fs: { allow: ['..'] },
  },
  build: {
    // three.js is groot; een eigen chunk houdt de app-code klein en goed cachebaar.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: { manualChunks: { three: ['three'], react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});
