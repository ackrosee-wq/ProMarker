import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function cepPlugin(): Plugin {
  return {
    name: 'cep-build',
    transformIndexHtml(html) {
      return html.replace(
        '<div id="root"></div>',
        '<div id="root"></div>\n    <script src="../CSInterface.js"></script>'
      );
    },
    closeBundle() {
      const rootDir = path.resolve(__dirname);
      const csFile = path.join(rootDir, 'public', 'CSInterface.js');
      const csDest = path.join(rootDir, 'CSInterface.js');
      if (fs.existsSync(csFile) && !fs.existsSync(csDest)) {
        fs.copyFileSync(csFile, csDest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), cepPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [
        'net',
        'fs',
        'path',
        'os',
        'child_process',
        'events',
        'stream',
        'buffer',
        'util',
        'http',
        'crypto',
      ],
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
