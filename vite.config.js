import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // mkcert only in dev — requires local system certs, breaks CI/CD build
    command === 'serve' && mkcert(),
  ].filter(Boolean),
  server: {
    host: 'localhost',
    port: 5173,
  },
}));
