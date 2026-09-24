import './style.css';
import { startApp } from './app/app';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

startApp(host).catch((err: unknown) => {
  console.error(err);
  const msg = document.createElement('pre');
  msg.className = 'boot-error';
  msg.textContent = `Failed to start: ${String(err)}`;
  host.replaceChildren(msg);
});
