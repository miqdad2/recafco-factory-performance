import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Static frontend only. A same-origin `/api` proxy to the future internal
// NestJS reporting API will be added here when SAP integration begins.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite's default 500 kB chunk warning (minified, before compression) stays in force.
    // Libraries go into their own chunks so each is cached independently of app code.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'echarts', test: /node_modules[\\/](echarts|zrender)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](@tanstack|zod)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 5181,
    strictPort: true,
  },
});
