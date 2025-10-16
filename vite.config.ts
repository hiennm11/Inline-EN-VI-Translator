import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: 'scripts/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'scripts/[name].[hash].js',
      },
    },
    outDir: 'public',
    emptyOutDir: false,
  },
});