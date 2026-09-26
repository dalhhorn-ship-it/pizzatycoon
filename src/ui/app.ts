// App shell: HUD, floor stage, tabs, modals.

import { DISTRICTS, PREMISES } from '../data/districts';
import { SEGMENTS } from '../data/segments';
import { T } from '../data/tunables';
import type { Controller } from '../game/controller';
import { fromSaveCode, toSaveCode } from '../save/saveFile';
import { analyse } from '../sim/analysis';
import { type GameEvent, RANK_NAMES } from '../sim/game';
import type { DayReport, GameState } from '../sim/state';
import { h, modal, money, signed, stars, toast } from './dom';
import { Floor } from './floor';
import { KitchenView } from './kitchenView';
import { pipelineStrip } from './pipeline';
import { kitchenPanel, menuPanel, moneyPanel, type PanelCtx, roomPanel, staffPanel } from './panels';

type Tab = 'menu' | 'kitchen' | 'room' | 'staff' | 'money';
const TABS: [Tab, string][] = [['menu', 'Menu'], ['kitchen', 'Kitchen'], ['room', 'Room'], ['staff', 'Staff'], ['money', 'Money']];
const TAB_KEY = 'pizzad:ui:tab';

const clockText = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export class App {
  private floor = new Floor();
  private kitchen = new KitchenView();
  private pipelineHost = h('div', { class: 'pipeline-host' });
  private hud = h('header', { class: 'hud' });
  private panel = h('div', { class: 'panel' });
  private tabs = h('nav', { class: 'tabs', role: 'tablist' });
  private bar = h('div', { class: 'bar' });
  private tab: Tab = 'menu';
  /** While a day plays back, the HUD keeps showing the morning's numbers. */
  private shown: GameState | null = null;
  private pending: { report: DayReport; events: GameEvent[] } | null = null;

  constructor(private root: HTMLElement, private game: Controller) {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some(([t]) => t === saved)) this.tab = saved;
    } catch {
      // Private mode: default tab.
    }
    const stage = h('section', { class: 'stage', style: 'grid-template-rows: minmax(0, 1fr) auto auto' }, this.floor.canvas, this.kitchen.canvas, this.pipelineHost, this.bar);
    this.kitchen.isServing = () => this.floor.playing;
    this.kitchen.onSelect = () => this.renderPanel();
    this.kitchen.onMove = (uid, x, y, rot) => {
      const err = this.game.dispatch({ type: 'moveEquipment', uid, x, y, rot });
      if (err) {
        toast(err, 'warn');
        this.kitchen.invalidate();
      }
    };
    const side = h('aside', { class: 'side' }, this.tabs, this.panel);
    root.append(this.hud, h('main', { class: 'main' }, stage, side));

    this.floor.onTap = (x, y, uid) => this.onFloorTap(x, y, uid);
    this.floor.onClock = (m, done) => this.onClock(m, done);
    game.subscribe((state, events) => this.onUpdate(state, events));
    game.saves.onChange(() => {
      this.renderHud();
      if (game.saves.conflict) this.showConflict();
    });
  }

  start(): void {
    if (!this.game.state) {
      this.showNewGame();
      return;
    }
    this.shown = this.game.state;
    this.setViews(this.game.state);
    this.renderAll();
    if (this.game.saves.conflict) this.showConflict();
  }

  private ctx(): PanelCtx {
    return {
      state: this.game.state as GameState,
      dispatch: (cmd) => this.game.dispatch(cmd),
      floor: this.floor,
      rerender: () => this.renderPanel(),
    };
  }

  private onUpdate(state: GameState, events: GameEvent[]): void {
    const day = events.find((e) => e.kind === 'dayCompleted');
    if (day?.report) {
      this.pending = { report: day.report, events: events.filter((e) => e.kind !== 'dayCompleted') };
      if (day.report.open) {
        this.floor.play(state, day.report);
        this.kitchen.invalidate();
        this.renderBar();
        return;
      }
      this.finishDay();
      return;
    }
    this.shown = state;
    this.setViews(state);
    for (const e of events) toast(e.text, e.kind === 'unlocked' || e.kind === 'rankUp' ? 'good' : 'info');
    this.renderAll();
  }

  private onClock(minutes: number, done: boolean): void {
    const c = this.bar.querySelector('.clock');
    if (c) c.textContent = clockText(minutes);
    if (done) this.finishDay();
  }

  private finishDay(): void {
    const p = this.pending;
    this.pending = null;
    const state = this.game.state as GameState;
    this.shown = state;
    this.setViews(state);
    this.renderAll();
    if (p) this.showReport(p.report, p.events);
  }

  private setViews(state: GameState): void {
    this.floor.setState(state);
    this.kitchen.setState(state);
  }

  /** The Kitchen tab shows the kitchen floor plan and pipeline; every other tab shows the dining room. */
  private applyStageMode(): void {
    const kitchen = this.tab === 'kitchen';
    this.floor.canvas.style.display = kitchen ? 'none' : 'block';
    this.kitchen.canvas.style.display = kitchen ? 'block' : 'none';
    this.pipelineHost.style.display = kitchen ? 'block' : 'none';
    if (kitchen && this.game.state) {
      this.pipelineHost.replaceChildren(pipelineStrip(this.game.state));
      this.kitchen.invalidate();
    } else {
      this.floor.invalidate();
    }
  }

  private renderAll(): void {
    this.applyStageMode();
    this.renderHud();
    this.renderTabs();
    this.renderBar();
    this.renderPanel();
  }

  private renderHud(): void {
    const s = this.shown ?? this.game.state;
    if (!s) return;
    const status = this.game.saves.status;
    const cloudText: Record<typeof status, string> = {
      offline: 'Saved on this device', syncing: 'Syncing…', synced: 'Cloud saved', pending: 'Cloud sync pending', conflict: 'Choose a save',
    };
    this.hud.replaceChildren(
      h('div', { class: 'logo' }, 'Pizza D'),
      h('div', { class: 'stat' }, h('span', null, DISTRICTS[s.districtId]?.name ?? ''), h('b', null, `Day ${s.day} · ${T.time.weekdayNames[(s.day - 1) % 7]}`)),
      h('div', { class: 'stat' }, h('span', null, 'Cash'), h('b', { class: s.cash < 0 ? 'bad' : '' }, money(s.cash))),
      h('div', { class: 'stat' }, h('span', null, `Reputation ${s.rep.toFixed(0)}`), h('b', { class: 'stars' }, stars(s.rep))),
      h('div', { class: 'stat' }, h('span', null, 'Rank'), h('b', null, RANK_NAMES[s.rank])),
      h('div', { class: 'grow' }),
      h('span', { class: `cloud ${status}` }, cloudText[status]),
    );
  }

  private renderTabs(): void {
    this.tabs.replaceChildren(...TABS.map(([id, label]) => h('button', {
      class: this.tab === id ? 'active' : '', role: 'tab', 'aria-selected': this.tab === id ? 'true' : 'false',
      onclick: () => {
        this.tab = id;
        try {
          localStorage.setItem(TAB_KEY, id);
        } catch {
          // ignore
        }
        if (id !== 'room') {
          this.floor.tool = { kind: 'none' };
          this.floor.selected = null;
          this.floor.invalidate();
        }
        this.renderTabs();
        this.applyStageMode();
        this.renderPanel();
      },
    }, label)));
  }

  private renderBar(): void {
    const s = this.game.state;
    if (!s) return;
    if (this.floor.playing) {
      const speedBtn = (label: string, v: number): HTMLElement =>
        h('button', { class: `small ${this.floor.speed === v ? 'active' : ''}`, onclick: () => { this.floor.speed = v; this.renderBar(); } }, label);
      this.bar.replaceChildren(
        h('span', { class: 'clock' }, clockText(this.floor.clock)),
        h('span', { class: 'muted small' }, 'Service in progress'),
        h('div', { class: 'grow', style: 'flex:1' }),
        speedBtn('1x', 10), speedBtn('2x', 20), speedBtn('4x', 40),
        h('button', { class: 'small', onclick: () => this.floor.skip() }, 'Skip to close'),
      );
      return;
    }
    const a = analyse(s);
    this.bar.replaceChildren(
      h('span', { class: 'clock' }, '09:00'),
      h('span', { class: 'small muted' }, `${a.room.seats} seats · oven ${a.kitchen.ovenPerHour.toFixed(0)}/h · ambience ${a.room.ambience.toFixed(0)}`),
      h('div', { style: 'flex:1' }),
      h('button', { class: 'primary', onclick: () => this.openForDay() }, 'Open for the day'),
    );
  }

  private renderPanel(): void {
    if (!this.game.state) return;
    const scroll = this.panel.scrollTop;
    const ctx = this.ctx();
    let content: HTMLElement;
    switch (this.tab) {
      case 'menu': content = menuPanel(ctx); break;
      case 'kitchen': content = kitchenPanel(ctx, this.kitchen); break;
      case 'room': content = roomPanel(ctx); break;
      case 'staff': content = staffPanel(ctx); break;
      case 'money': content = moneyPanel(ctx, this.settingsCard()); break;
    }
    this.panel.replaceChildren(content);
    this.panel.scrollTop = scroll;
  }

  private openForDay(): void {
    this.floor.tool = { kind: 'none' };
    this.floor.selected = null;
    const err = this.game.dispatch({ type: 'runDay' });
    if (err) toast(err, 'warn');
  }

  private onFloorTap(x: number, y: number, uid: number | null): void {
    if (this.floor.playing) return;
    const tool = this.floor.tool;
    if (tool.kind === 'place') {
      const err = this.game.dispatch({ type: 'placeFurniture', itemId: tool.itemId, x, y });
      if (err) toast(err, 'warn');
      return;
    }
    if (tool.kind === 'move') {
      const err = this.game.dispatch({ type: 'moveFurniture', uid: tool.uid, x, y });
      if (err) toast(err, 'warn');
      else this.floor.tool = { kind: 'none' };
      this.floor.invalidate();
      return;
    }
    this.floor.selected = uid;
    this.floor.invalidate();
    if (this.tab !== 'room' && uid !== null) this.tab = 'room';
    this.renderTabs();
    this.renderPanel();
  }

  // ---------- Modals ----------

  private showReport(r: DayReport, events: GameEvent[]): void {
    const state = this.game.state as GameState;
    let close = (): void => {};
    const repDelta = r.repAfter - r.repBefore;
    const sat = r.segments.reduce((acc, s) => {
      for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += (s.scores[k] * s.served) / Math.max(1, r.covers);
      return acc;
    }, { food: 0, service: 0, ambience: 0, value: 0, wait: 0 });
    const content = h('div', { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, `Day ${r.day} · ${T.time.weekdayNames[r.weekday]}`), h('span', { class: 'muted' }, DISTRICTS[state.districtId]?.name ?? '')),
      !r.open
        ? h('div', { class: 'warn' }, `Closed today: ${r.closedReason}`)
        : h('div', { class: 'grid2' },
          h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Guests served'), h('span', { class: 'big' }, Math.round(r.covers).toString()),
            h('span', { class: 'small muted' }, `${Math.round(r.walkAways)} turned away · satisfaction ${r.satisfaction.toFixed(0)}`)),
          h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Profit'), h('span', { class: `big ${r.pnl.profit >= 0 ? 'good' : 'bad'}` }, money(r.pnl.profit)),
            h('span', { class: 'small muted' }, `Sales ${money(r.pnl.sales)} · reputation ${signed(repDelta, 1)}`))),
      r.open ? h('div', { class: 'card' }, h('h3', null, 'How guests felt'),
        h('div', { class: 'kv' }, ...(['food', 'service', 'ambience', 'value', 'wait'] as const).flatMap((k) => [
          h('span', null, k[0]?.toUpperCase() + k.slice(1)), h('b', { class: sat[k] < 0.45 ? 'bad' : sat[k] > 0.75 ? 'good' : '' }, `${Math.round(sat[k] * 100)}`),
        ])),
        h('div', { class: 'small muted' }, `Busiest: ${r.segments.filter((s) => s.served > 0.5).sort((a, b) => b.served - a.served).slice(0, 3).map((s) => `${SEGMENTS[s.segment].name} ${Math.round(s.served)}`).join(', ')}`)) : null,
      r.tips.length ? h('div', { class: 'card' }, h('h3', null, 'Your advisor'), ...r.tips.map((t) => h('div', { class: 'small' }, t))) : null,
      r.reviews.length ? h('div', { class: 'stack' }, h('h3', null, 'Reviews'),
        ...r.reviews.slice(0, 4).map((rv) => h('div', { class: 'review' }, h('span', { class: 'st' }, '★'.repeat(rv.stars) + '☆'.repeat(5 - rv.stars)), ' ', rv.text, h('span', { class: 'muted small' }, ` (${SEGMENTS[rv.segment].name})`)))) : null,
      r.weeklyPayments ? h('div', { class: 'small muted' }, `Sunday bills paid: ${money(r.weeklyPayments)} for wages, rent and loan.`) : null,
      events.length ? h('div', { class: 'stack' }, ...events.map((e) => h('div', { class: e.kind === 'unlocked' || e.kind === 'rankUp' ? 'good' : e.kind === 'restructure' ? 'warn' : '' }, e.text))) : null,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'primary', onclick: () => close() }, 'Tomorrow')));
    close = modal(content, { onClose: () => undefined });
  }

  showNewGame(): void {
    let district = 'canal';
    let premises = 'cosy';
    let close = (): void => {};
    const body = h('div', { class: 'stack' });
    const render = (): void => {
      const d = DISTRICTS[district];
      const p = PREMISES[premises];
      const tiles = p ? p.diningWidth * p.diningHeight + p.kitchenTiles : 0;
      const rent = d ? tiles * d.rentPerTile : 0;
      body.replaceChildren(
        h('h2', null, 'Welcome to Pizza D'),
        h('div', { class: 'muted' }, 'Pick a neighbourhood and a place to rent. You start with $40,000, a small team, a deck oven and a classic menu. There is no game over: take your time.'),
        h('h3', null, 'Neighbourhood'),
        h('div', { class: 'districts' }, ...Object.values(DISTRICTS).map((x) => h('button', { class: district === x.id ? 'on' : '', onclick: () => { district = x.id; render(); } },
          h('b', null, x.name), h('span', { class: 'small' }, x.blurb),
          h('span', { class: 'small muted' }, `${x.footTraffic.toLocaleString()} passers-by a day · rent $${x.rentPerTile}/tile/week`)))),
        h('h3', null, 'Premises'),
        h('div', { class: 'districts' }, ...Object.values(PREMISES).map((x) => h('button', { class: premises === x.id ? 'on' : '', onclick: () => { premises = x.id; render(); } },
          h('b', null, x.name), h('span', { class: 'small' }, `Dining room ${x.diningWidth}x${x.diningHeight}, kitchen ${x.kitchenTiles} tiles`)))),
        h('div', { class: 'card' }, h('div', { class: 'kv' },
          h('span', null, 'Rent'), h('b', null, `${money(rent)}/week`),
          h('span', null, 'Deposit (8 weeks)'), h('b', null, money(rent * 8)))),
        h('div', { class: 'row', style: 'justify-content:space-between' },
          h('button', { class: 'ghost', onclick: () => { close(); this.showLinkDevice(true); } }, 'Continue a game from another device'),
          h('button', { class: 'primary', onclick: () => {
            close();
            this.game.start(Math.floor(Math.random() * 2 ** 31), district, premises);
            this.shown = this.game.state;
            this.setViews(this.game.state as GameState);
            this.renderAll();
          } }, 'Open my pizzeria')));
    };
    render();
    close = modal(body, { wide: true });
  }

  private showConflict(): void {
    const c = this.game.saves.conflict;
    if (!c || document.querySelector('.modal.conflict')) return;
    let close = (): void => {};
    const card = (title: string, s: { day: number; cash: number; rep: number; district: string; savedAt: number }, keep: 'local' | 'remote'): HTMLElement =>
      h('div', { class: 'card' }, h('h3', null, title),
        h('div', { class: 'kv' },
          h('span', null, 'Day'), h('b', null, String(s.day)),
          h('span', null, 'Cash'), h('b', null, money(s.cash)),
          h('span', null, 'Reputation'), h('b', null, s.rep.toFixed(1)),
          h('span', null, 'Where'), h('b', null, s.district),
          h('span', null, 'Saved'), h('b', null, new Date(s.savedAt).toLocaleString())),
        h('button', { class: 'primary', onclick: async () => { close(); await this.game.resolveConflict(keep); this.start(); } }, 'Keep this one'));
    const content = h('div', { class: 'stack conflict' },
      h('h2', null, 'Two versions of your pizzeria'),
      h('div', { class: 'muted' }, 'You played on another device while this one was offline. Choose which game to continue. The other one will be replaced.'),
      h('div', { class: 'grid2' }, card('On this device', c.local, 'local'), card('In the cloud', c.remote.summary, 'remote')));
    close = modal(content, { wide: true });
  }

  private showLinkDevice(fromNewGame = false): void {
    let close = (): void => {};
    const input = h('input', { type: 'text', placeholder: 'ABC123', maxLength: 8, style: 'text-transform:uppercase;letter-spacing:3px;font-size:20px' });
    const content = h('div', { class: 'stack' },
      h('h2', null, 'Continue from another device'),
      h('div', { class: 'muted' }, 'On your other device open Money, then "Link a device", and type the 6 character code here. The game on this device will be replaced by that one.'),
      input,
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'ghost', onclick: () => { close(); if (fromNewGame) this.showNewGame(); } }, 'Back'),
        h('button', { class: 'primary', onclick: async () => {
          try {
            await this.game.saves.claim(input.value);
            const state = await this.game.saves.reconcile(null);
            close();
            if (state) {
              this.game.load(state);
              this.start();
              toast('Welcome back to your pizzeria!', 'good');
            } else {
              toast('Linked, but no save was found yet. Play a day on the other device first.', 'warn');
              if (fromNewGame) this.showNewGame();
            }
          } catch (err) {
            toast((err as Error).message, 'warn');
          }
        } }, 'Link')));
    close = modal(content);
  }

  private settingsCard(): HTMLElement {
    const status = this.game.saves.status;
    const codeBox = h('div', { class: 'small' });
    return h('div', { class: 'card' },
      h('h3', null, 'Saves and settings'),
      h('div', { class: 'small muted' }, status === 'offline'
        ? 'Your game is saved on this device. Cloud saves start when the game is online.'
        : 'Your game is saved on this device and in the cloud. Link another device (iPad, laptop) to continue there.'),
      h('div', { class: 'row' },
        h('button', { class: 'small', disabled: status === 'offline', onclick: async () => {
          try {
            this.game.saveNow(true);
            const { code, expiresAt } = await this.game.saves.linkCode();
            codeBox.replaceChildren(h('div', { class: 'big', style: 'letter-spacing:4px' }, code), `Enter this on your other device within ${Math.round((expiresAt - Date.now()) / 60000)} minutes.`);
          } catch (err) {
            toast((err as Error).message, 'warn');
          }
        } }, 'Link a device'),
        h('button', { class: 'small', onclick: () => this.showLinkDevice() }, 'I have a code'),
        h('button', { class: 'small', onclick: async () => {
          const code = toSaveCode(this.game.state as GameState, Date.now());
          try {
            await navigator.clipboard.writeText(code);
            toast('Save code copied. Paste it anywhere safe.', 'good');
          } catch {
            prompt('Copy your save code:', code);
          }
        } }, 'Copy save code'),
        h('button', { class: 'small', onclick: () => {
          const code = prompt('Paste a save code:');
          if (!code) return;
          try {
            this.game.load(fromSaveCode(code).state);
            this.start();
            toast('Save loaded.', 'good');
          } catch (err) {
            toast((err as Error).message, 'warn');
          }
        } }, 'Load save code')),
      codeBox,
      h('label', { class: 'row small' },
        h('input', { type: 'checkbox', checked: this.game.state?.unlockAll, onchange: (e: Event) => this.game.dispatch({ type: 'setUnlockAll', on: (e.target as HTMLInputElement).checked }) }),
        'Sandbox: unlock all equipment (for playtesting)'),
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => {
          const root = document.documentElement;
          const next = root.dataset.theme === 'dark' ? 'light' : root.dataset.theme === 'light' ? '' : 'dark';
          if (next) root.dataset.theme = next;
          else delete root.dataset.theme;
          try {
            localStorage.setItem('pizzad:ui:theme', next);
          } catch {
            // ignore
          }
          this.floor.invalidate();
        } }, 'Theme: light / dark / auto'),
        (this.game.state?.cash ?? 0) <= T.finance.freshStartThreshold
          ? h('button', { class: 'small', onclick: () => this.game.dispatch({ type: 'freshStart' }) }, 'Fresh start (keep recipes and unlocks)')
          : null,
        h('button', { class: 'small ghost', onclick: () => { if (confirm('Start a new pizzeria? This replaces your current game everywhere it is synced.')) this.showNewGame(); } }, 'New game')));
  }
}
