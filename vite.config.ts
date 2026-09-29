import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vitest/config';
import { serviceWorker } from './scripts/service-worker-plugin.mjs';

// `--mode https` serves a self-signed certificate (npm run dev:https): needed for the gyroscope on a phone
// over LAN, since iOS only exposes device orientation to secure contexts.
export default defineConfig(({ mode }) => ({
  plugins: [serviceWorker(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: { port: 5173, host: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
