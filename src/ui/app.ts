// App shell: HUD, floor stage, tabs, modals.

import { DISTRICTS, PREMISES } from '../data/districts';
import { SEGMENTS } from '../data/segments';
import { T } from '../data/tunables';
import type { Controller } from '../game/controller';
import { fromSaveCode, toSaveCode } from '../save/saveFile';
import { analyse } from '../sim/analysis';
import { depositFor, type GameEvent, RANK_NAMES, seatLimit } from '../sim/game';
import { ECONOMY_LABELS, ECONOMY_RANGE, type Economy, type EconomyKey, economyOf, PRESETS, presetName } from '../sim/economy';
import { outlook } from './impact';
import type { DayReport, GameState } from '../sim/state';
import { h, modal, money, signed, stars, toast } from './dom';
import { Floor } from './floor';
import { KitchenView } from './kitchenView';
import { pipelineStrip } from './pipeline';
import { checklistCard } from './checklist';
import { kitchenPanel, menuPanel, moneyPanel, type PanelCtx, roomPanel, staffPanel } from './panels';

type Tab = 'menu' | 'kitchen' | 'room' | 'staff' | 'money';
const TABS: [Tab, string][] = [['menu', 'Menu'], ['kitchen', 'Kitchen'], ['room', 'Room'], ['staff', 'Staff'], ['money', 'Money']];
const TAB_KEY = 'pizzad:ui:tab';
const ECONOMY_KEY = 'pizzad:economy';

/** Difficulty last chosen on this device; used for new games. */
function savedEconomy(): Economy | undefined {
  try {
    const raw = localStorage.getItem(ECONOMY_KEY);
    return raw ? (JSON.parse(raw) as Economy) : undefined;
  } catch {
    return undefined;
  }
}

const clockText = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export class App {
  private floor = new Floor();
  private kitchen = new KitchenView();
  private pipelineHost = h('div', { class: 'pipeline-host' });
  private checklistHost = h('div');
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
    const side = h('aside', { class: 'side', style: 'grid-template-rows: auto auto minmax(0, 1fr)' }, this.tabs, this.checklistHost, this.panel);
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

  private renderChecklist(): void {
    const s = this.game.state;
    const card = s && !this.floor.playing ? checklistCard(s, (tab) => this.switchTab(tab)) : null;
    this.checklistHost.replaceChildren(...(card ? [card] : []));
  }

  private switchTab(id: Tab): void {
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
  }

  private renderAll(): void {
    this.renderChecklist();
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
      h('button', { class: 'small', onclick: () => this.showMarket() }, '🏠 Buy another restaurant'),
      h('button', { class: 'small', onclick: () => this.showSettings() }, '⚙ Settings'),
      h('span', { class: `cloud ${status}` }, cloudText[status]),
    );
  }

  private renderTabs(): void {
    this.tabs.replaceChildren(...TABS.map(([id, label]) => h('button', {
      class: this.tab === id ? 'active' : '', role: 'tab', 'aria-selected': this.tab === id ? 'true' : 'false',
      onclick: () => this.switchTab(id),
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
      case 'money': content = moneyPanel(ctx, h('button', { class: 'small', onclick: () => this.showSettings() }, '⚙ Settings, saves and difficulty')); break;
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

  /** Premises cards for one district: rent, deposit, seats and kitchen size (fresh-start.md 3). */
  private premisesCards(district: string, selected: string | null, onPick: (id: string) => void, budget: number, refund = 0): HTMLElement {
    const d = DISTRICTS[district];
    return h('div', { class: 'districts' }, ...Object.values(PREMISES).map((x) => {
      const tiles = x.diningWidth * x.diningHeight + x.kitchenTiles;
      const rent = d ? tiles * d.rentPerTile : 0;
      const deposit = depositFor(district, x.id);
      const affordable = budget + refund >= deposit;
      const tight = rent > (budget + refund - deposit) / 2;
      return h('button', { class: selected === x.id ? 'on' : '', onclick: () => onPick(x.id) },
        h('b', null, x.name),
        h('span', { class: 'small' }, `Dining ${x.diningWidth}x${x.diningHeight} (up to ${seatLimit(x.id)} seats) · kitchen ${x.kitchenWidth}x${x.kitchenHeight}`),
        h('span', { class: 'small' }, `Rent ${money(rent)}/week · deposit ${money(deposit)}`),
        !affordable ? h('span', { class: 'small bad' }, `You need ${money(deposit - budget - refund)} more`)
          : tight ? h('span', { class: 'small warn' }, 'Tight: leaves little for equipment') : null);
    }));
  }

  showNewGame(): void {
    let district = 'canal';
    let premises = 'hole';
    let close = (): void => {};
    const hasGame = !!this.game.state;
    const body = h('div', { class: 'stack' });
    const render = (): void => {
      const deposit = depositFor(district, premises);
      const startCash = Math.round(T.finance.startingCash * (savedEconomy()?.startingCash ?? 1));
      const left = startCash - deposit;
      body.replaceChildren(
        h('h2', null, hasGame ? 'Start a new pizzeria' : 'Welcome to Pizza D'),
        h('div', { class: 'muted' }, `You have ${money(startCash)} and a dream. Rent an empty place, then set it up yourself: a second hand oven, a workbench, a fridge, a sink, a few folding tables, a cook and a server. Start small, earn, and grow. There is no game over.`),
        h('h3', null, 'Neighbourhood'),
        h('div', { class: 'districts' }, ...Object.values(DISTRICTS).map((x) => h('button', { class: district === x.id ? 'on' : '', onclick: () => { district = x.id; render(); } },
          h('b', null, x.name), h('span', { class: 'small' }, x.blurb),
          h('span', { class: 'small muted' }, `${x.footTraffic.toLocaleString()} passers-by a day · rent $${x.rentPerTile}/tile/week`)))),
        h('h3', null, 'Premises'),
        this.premisesCards(district, premises, (id) => { premises = id; render(); }, startCash),
        h('div', { class: 'small muted' }, `Difficulty: ${presetName(economyOf({ economy: savedEconomy() }))}. Change it any time under ⚙ Settings.`),
        h('div', { class: 'card' }, h('div', { class: 'kv' },
          h('span', null, 'Deposit (4 weeks rent)'), h('b', null, money(deposit)),
          h('span', null, 'Left to set up with'), h('b', { class: left < 2920 ? 'warn' : 'good' }, money(left))),
          left < 2920 ? h('div', { class: 'small warn' }, 'The cheapest working pizzeria costs about $2,920 to fit out. You could borrow up to $5,000, but a smaller place is the cosy way to start.') : null),
        h('div', { class: 'row', style: 'justify-content:space-between' },
          hasGame
            ? h('button', { class: 'ghost', onclick: () => close() }, 'Cancel')
            : h('button', { class: 'ghost', onclick: () => { close(); this.showLinkDevice(true); } }, 'Continue a game from another device'),
          h('button', { class: 'primary', disabled: left < 0, onclick: () => {
            close();
            this.game.start(Math.floor(Math.random() * 2 ** 31), district, premises, savedEconomy());
            this.shown = this.game.state;
            this.setViews(this.game.state as GameState);
            this.renderAll();
          } }, 'Sign the lease')));
    };
    render();
    close = modal(body, { wide: true });
  }

  /** Property market: move to another restaurant (fresh-start.md 3). */
  private showMarket(): void {
    const s = this.game.state;
    if (!s) return;
    let district = s.districtId;
    let premises: string | null = null;
    let close = (): void => {};
    const body = h('div', { class: 'stack' });
    const render = (): void => {
      const st = this.game.state as GameState;
      const net = premises ? depositFor(district, premises) - st.deposit : 0;
      const same = premises === st.premisesId && district === st.districtId;
      body.replaceChildren(...([
        h('div', { class: 'spread' }, h('h2', null, 'Buy another restaurant'), h('button', { class: 'small', onclick: () => close() }, 'Close')),
        h('div', { class: 'muted' }, `You rent the ${PREMISES[st.premisesId]?.name} in ${DISTRICTS[st.districtId]?.name}. Moving happens overnight: your deposit of ${money(st.deposit)} comes back, the new deposit is paid, and your team, recipes, reputation, equipment and furniture come with you. Anything that does not fit is sold at 80%. Running two restaurants at once arrives with chains in v1.0.`),
        h('div', { class: 'row' }, ...Object.values(DISTRICTS).map((x) => h('button', { class: district === x.id ? 'active' : '', onclick: () => { district = x.id; premises = null; render(); } }, x.name))),
        h('div', { class: 'small muted' }, DISTRICTS[district]?.blurb ?? ''),
        this.premisesCards(district, premises, (id) => { premises = id; render(); }, st.cash, st.deposit),
        premises && !same
          ? h('div', { class: 'card' }, h('div', { class: 'kv' },
            h('span', null, 'New deposit'), h('b', null, money(depositFor(district, premises))),
            h('span', null, 'Your deposit back'), h('b', null, money(st.deposit)),
            h('span', null, net >= 0 ? 'You pay' : 'You get back'), h('b', { class: net > st.cash ? 'bad' : '' }, money(Math.abs(net))),
            h('span', null, 'Cash after the move'), h('b', null, money(st.cash - net))))
          : null,
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'primary', disabled: !premises || same || net > st.cash, onclick: () => {
            if (!premises) return;
            const err = this.game.dispatch({ type: 'movePremises', districtId: district, premisesId: premises });
            if (err) toast(err, 'warn');
            else close();
          } }, premises && !same ? `Move to the ${PREMISES[premises]?.name}` : 'Pick a place')),
      ].filter(Boolean) as HTMLElement[]));
    };
    render();
    close = modal(body, { wide: true });
  }

  private confirmRestart(): void {
    let close = (): void => {};
    close = modal(h('div', { class: 'stack' },
      h('h2', null, 'Restart the game?'),
      h('div', { class: 'muted' }, 'This starts a brand new pizzeria from scratch with $7,000. Your current game is replaced on this device and in the cloud.'),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'ghost', onclick: () => close() }, 'Keep playing'),
        h('button', { class: 'primary', onclick: () => { close(); this.showNewGame(); } }, 'Restart'))));
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

  /** One place for game, difficulty, saves and display settings. */
  private showSettings(): void {
    let close = (): void => {};
    const body = h('div', { class: 'stack' });
    const render = (): void => {
      const st = this.game.state;
      if (!st) return;
      const eco = economyOf(st);
      const preset = presetName(eco);
      const o = outlook(st);
      const status = this.game.saves.status;
      const codeBox = h('div', { class: 'small' });
      const setEco = (e: Partial<Economy>): void => {
        const err = this.game.dispatch({ type: 'setEconomy', economy: e });
        if (err) toast(err, 'warn');
        try {
          localStorage.setItem(ECONOMY_KEY, JSON.stringify(economyOf(this.game.state as GameState)));
        } catch {
          // ignore
        }
        render();
      };
      const slider = (k: EconomyKey): HTMLElement => {
        const label = ECONOMY_LABELS[k];
        const v = eco[k];
        const pct = Math.round(v * 100);
        const easier = label.easier === 'up' ? v > 1 : v < 1;
        return h('label', { class: 'slider' },
          h('span', { class: 'spread' }, h('span', null, label.name), h('b', { class: v === 1 ? '' : easier ? 'good' : 'warn' }, `${pct}%`)),
          h('input', {
            type: 'range', min: ECONOMY_RANGE.min, max: ECONOMY_RANGE.max, step: ECONOMY_RANGE.step, value: v,
            'aria-label': label.name,
            onchange: (e: Event) => setEco({ [k]: Number((e.target as HTMLInputElement).value) }),
          }));
      };
      body.replaceChildren(
        h('div', { class: 'spread' }, h('h2', null, 'Settings'), h('button', { class: 'small', onclick: () => close() }, 'Close')),

        h('div', { class: 'card' },
          h('h3', null, 'Game'),
          h('div', { class: 'row' },
            h('button', { onclick: () => { close(); this.showMarket(); } }, '🏠 Buy another restaurant'),
            h('button', { onclick: () => { close(); this.confirmRestart(); } }, '↺ Restart game'),
            st.cash <= T.finance.freshStartThreshold
              ? h('button', { onclick: () => { close(); this.game.dispatch({ type: 'freshStart' }); } }, 'Fresh start (keep recipes and unlocks)')
              : null)),

        h('div', { class: 'card' },
          h('h3', null, 'Economy and difficulty'),
          h('div', { class: 'small muted' }, 'Make the game easier or harder at any time. Changes apply from the next service. Selling equipment never pays more than the normal 80%, whatever the price slider says.'),
          h('div', { class: 'seg' }, ...(['easy', 'normal', 'hard'] as const).map((p) =>
            h('button', { class: preset === p ? 'on' : '', onclick: () => setEco(PRESETS[p]) }, p[0]?.toUpperCase() + p.slice(1))),
            h('button', { class: preset === 'custom' ? 'on' : '', disabled: true }, 'Custom')),
          h('div', { class: 'sliders' }, ...(Object.keys(ECONOMY_LABELS) as EconomyKey[]).map(slider)),
          o.covers > 0
            ? h('div', { class: 'impact' }, 'With these settings an average day earns about ', h('b', { class: o.profit >= 0 ? 'good' : 'bad' }, money(o.profit)), ` from ${o.covers.toFixed(0)} guests (at your current reputation).`)
            : h('div', { class: 'impact' }, 'Set up and open your pizzeria to see what these settings do to a day\'s profit.')),

        h('div', { class: 'card' },
          h('h3', null, 'Saves and devices'),
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
            h('button', { class: 'small', onclick: () => { close(); this.showLinkDevice(); } }, 'I have a code'),
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
                close();
                this.start();
                toast('Save loaded.', 'good');
              } catch (err) {
                toast((err as Error).message, 'warn');
              }
            } }, 'Load save code')),
          codeBox),

        h('div', { class: 'card' },
          h('h3', null, 'Display and playtesting'),
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
              this.kitchen.invalidate();
            } }, 'Theme: light / dark / auto')),
          h('label', { class: 'row small' },
            h('input', { type: 'checkbox', checked: st.unlockAll, onchange: (e: Event) => { this.game.dispatch({ type: 'setUnlockAll', on: (e.target as HTMLInputElement).checked }); render(); } }),
            'Sandbox: unlock all equipment')),
      );
    };
    render();
    close = modal(body, { wide: true });
  }

}
