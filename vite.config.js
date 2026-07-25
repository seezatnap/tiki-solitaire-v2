import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
