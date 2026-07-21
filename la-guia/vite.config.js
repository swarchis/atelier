import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the big, rarely-changing libraries into their own cacheable
        // chunks so they download in parallel and stay cached across deploys.
        // three.js in particular is only pulled in by the lazy IntroGate, so
        // it never lands in the initial landing-page payload.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('three')) return 'three';
          if (id.includes('framer-motion')) return 'framer';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
