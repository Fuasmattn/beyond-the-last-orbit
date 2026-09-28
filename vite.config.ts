import { defineConfig } from 'vitest/config';
import { serviceWorker } from './scripts/service-worker-plugin.mjs';

export default defineConfig({
  plugins: [serviceWorker()],
  server: { port: 5173, host: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
