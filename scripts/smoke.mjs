// Playwright smoke suite (cleanup sprint 5, QA14): the main screens on an iPad sized window, failing on any page error.
// Usage: npm run build && npm run smoke. Chromium comes from PLAYWRIGHT_BROWSERS_PATH (or `npx playwright-core install chromium`).

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const save = readFileSync(new URL('../tests/fixtures/save-v6.json', import.meta.url), 'utf8');

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview did not start');
}

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(['ok', name]);
  } catch (err) {
    results.push(['FAIL', `${name}: ${String(err.message ?? err).split('\n')[0]}`]);
    const shot = `smoke-fail-${results.length}.png`;
    await page.screenshot({ path: shot }).catch(() => undefined);
    results.push(['info', `  screenshot: ${shot}`]);
  }
}

await waitForServer();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|\/api\//.test(m.text())) errors.push(m.text()); });

/** Close intro cards and reports that may be open. */
async function dismiss() {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: /^(Later|Continue|Tomorrow|Close)$/ }).first();
    if (!(await b.isVisible().catch(() => false))) return;
    await b.click();
    await page.waitForTimeout(150);
  }
}

await step('an old save loads', async () => {
  await page.goto(BASE);
  // Intros are marked as seen so they do not cover the screens under test (the last step checks one).
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('pizzad:save:auto', s);
    for (const k of ['rivals', 'delivery', 'review']) localStorage.setItem(`pizzad:intro:${k}`, '1');
  }, save);
  await page.reload();
  await page.getByText(/Day \d+/).first().waitFor({ timeout: 10000 });
  await dismiss();
});

/** Two layers of tabs (delivery-tab.md 4): the group first, then its tab. */
async function openTab(group, tab) {
  await page.getByRole('tab', { name: group }).click();
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(150);
}

await step('every tab opens', async () => {
  for (const tab of ['Menu', 'Kitchen', 'Room', 'Squad', 'Scorecard']) await openTab('Restaurant', tab);
  for (const tab of ['Promotion', 'Menu & deals', 'Fleet', 'Scorecard']) await openTab('Delivery', tab);
  await openTab('Business', 'Money');
  await page.getByText('Demand and capacity').first().waitFor({ state: 'attached', timeout: 1 }).catch(() => undefined);
});

await step('the business review opens from Money', async () => {
  await openTab('Business', 'Money');
  await page.getByRole('button', { name: /Business review/ }).first().click();
  await page.getByText('Key metrics').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '12 weeks' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
});

await step('live rivals switch on in settings', async () => {
  await page.getByRole('button', { name: /Settings/ }).first().click();
  await page.getByRole('button', { name: 'Live rivals on' }).click();
  await dismiss();
  await page.keyboard.press('Escape');
  await dismiss();
});

await step('a week runs and the report shows the top 3', async () => {
  await page.getByRole('button', { name: /Run a week/ }).click();
  await page.getByText('Top 3 this week').waitFor({ timeout: 20000 });
  await dismiss();
});

await step('the restaurant scorecard grades lunch and dinner', async () => {
  await dismiss();
  await openTab('Restaurant', 'Scorecard');
  await page.getByText('Restaurant score').first().waitFor({ timeout: 5000 });
  await page.getByText('Lunch promotions').first().waitFor({ timeout: 5000 });
  if (process.env.SMOKE_SHOTS) await page.screenshot({ path: `${process.env.SMOKE_SHOTS}/scorecard.png`, fullPage: true });
});

await step('the Rivals tab and the Marketing sheet', async () => {
  await dismiss();
  await openTab('Business', 'Rivals');
  await page.getByText('Market share').first().waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: /Marketing/ }).first().click();
  await page.getByText('campaign slots used').waitFor({ timeout: 5000 });
  const start = page.getByRole('button', { name: /^Start for/ }).first();
  if (await start.isEnabled()) await start.click();
  await page.getByRole('button', { name: 'Close' }).click();
});

await step('the game survives a reload', async () => {
  const before = await page.locator('.hud').innerText();
  await page.reload();
  await page.getByText(/Day \d+/).first().waitFor({ timeout: 10000 });
  await dismiss();
  const after = await page.locator('.hud').innerText();
  const day = (t) => t.match(/Day\s+(\d+)/)?.[1];
  if (day(before) !== day(after)) throw new Error(`day ${day(before)} became ${day(after)}`);
});

await step('a new system introduces itself once', async () => {
  await page.evaluate(() => localStorage.removeItem('pizzad:intro:rivals'));
  await page.reload();
  await page.getByText('Rivals and marketing').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Later' }).click();
  await page.reload();
  await page.getByText(/Day \d+/).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  if (await page.getByText('Rivals and marketing').isVisible()) throw new Error('the intro came back');
});

await step('a new player starts on the city map', async () => {
  // A fresh browser: the game autosaves on unload, so clearing storage in the same page does not start over.
  const fresh = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const p2 = await fresh.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(BASE);
  await p2.getByText('Welcome to Porto Verde').waitFor({ timeout: 10000 });
  await fresh.close();
});

await browser.close();
stop();
for (const [s, n] of results) console.log(s === 'info' ? n : `${s === 'ok' ? '✓' : '✗'} ${n}`);
if (errors.length) console.log(`page errors:\n  ${[...new Set(errors)].join('\n  ')}`);
const failed = results.some(([s]) => s === 'FAIL') || errors.length > 0;
process.exit(failed ? 1 : 0);
