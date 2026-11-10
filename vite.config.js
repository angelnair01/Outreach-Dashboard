import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the built site works on GitHub Pages (served from /<repo-name>/) as well as Vercel/Netlify.
  base: './',
  build: {
    outDir: 'dist',
    // The charts library is large; this is expected for a dashboard and loads fine.
    chunkSizeWarningLimit: 1000,
  },
});
