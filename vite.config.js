import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProd = mode === 'production';

  if (command === 'serve') {
    return {
      server: {
        port: 8000,
        open: '/example/index.html'
      }
    };
  }

  return {
    build: {
      lib: {
        entry: resolve(import.meta.dirname, 'src/index.js'),
        name: 'AFrameRoomComponent',
        formats: isProd ? ['umd', 'es'] : ['umd'],
        fileName: (format) => {
          if (format === 'es') return 'aframe-room-component.esm.js';
          return isProd ? 'aframe-room-component.min.js' : 'aframe-room-component.js';
        }
      },
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      minify: isProd ? 'terser' : false,
      terserOptions: isProd ? {
        compress: { passes: 2 },
        format: { comments: false }
      } : undefined
    }
  };
});
