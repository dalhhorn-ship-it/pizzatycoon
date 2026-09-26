import './ui/styles.css';
import './ui/kitchen.css';
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
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
