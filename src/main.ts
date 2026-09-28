import './style.css';
import { startApp } from './app/app';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

function showError(host: HTMLElement, text: string): void {
  const msg = document.createElement('pre');
  msg.className = 'boot-error';
  msg.textContent = text;
  host.replaceChildren(msg);
}

/** Offline play: the build emits sw.js (see scripts/service-worker-plugin.mjs). Dev never registers it, so HMR stays uncached. */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err: unknown) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

registerServiceWorker();

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

if (!hasWebGL()) {
  showError(host, 'Beyond the Last Orbit needs WebGL. Please use a current browser with hardware acceleration enabled.');
} else {
  startApp(host).catch((err: unknown) => {
    console.error(err);
    showError(host, `Failed to start: ${String(err)}`);
  });
}
