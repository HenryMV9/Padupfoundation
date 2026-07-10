import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        donate: resolve(__dirname, 'donate.html'),
        'get-involved': resolve(__dirname, 'get-involved.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.gif', '**/*.svg'],
});
