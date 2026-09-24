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

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

if (!hasWebGL()) {
  showError(host, 'Space Alliance needs WebGL. Please use a current browser with hardware acceleration enabled.');
} else {
  startApp(host).catch((err: unknown) => {
    console.error(err);
    showError(host, `Failed to start: ${String(err)}`);
  });
}
