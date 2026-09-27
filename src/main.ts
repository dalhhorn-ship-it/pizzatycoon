import './ui/styles.css';
import './ui/kitchen.css';
import './ui/city.css';
import './ui/squad.css';
import './ui/rivals.css';
import { Controller } from './game/controller';
import { App } from './ui/app';

try {
  const theme = localStorage.getItem('pizzad:ui:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Private mode: follow the system theme.
}

const root = document.getElementById('app') as HTMLElement;
const game = new Controller();
await game.boot();
void navigator.storage?.persist?.().catch(() => undefined);
new App(root, game).start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // A new build waits; the HUD offers "Update ready", which asks the waiting worker to take over, then reloads.
  const offer = (reg: ServiceWorkerRegistration): void => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.dispatchEvent(new CustomEvent('pizzad:update', { detail: () => reg.waiting?.postMessage('skipWaiting') }));
    }
  };
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    offer(reg);
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', () => offer(reg)));
  }).catch(() => undefined);
  // The first install also takes control (clients.claim); only a change from an existing version reloads.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
}
