import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        gallery: 'gallery.html',
        donate: 'donate.html',
        'get-involved': 'get-involved.html',
        contact: 'contact.html',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
