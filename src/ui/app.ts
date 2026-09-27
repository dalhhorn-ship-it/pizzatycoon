// App shell: HUD, floor stage, tabs, modals.

import { DISTRICTS } from '../data/districts';
import { VENUES } from '../data/venues';
import { SEGMENTS } from '../data/segments';
import { T } from '../data/tunables';
import type { Controller } from '../game/controller';
import { fromSaveCode, toSaveCode } from '../save/saveFile';
import { analyse } from '../sim/analysis';
import { type GameEvent, moveQuote, newGameAt, RANK_NAMES, venueDeposit } from '../sim/game';
import { locationName, managerOf } from '../sim/chain';
import { ECONOMY_LABELS, ECONOMY_RANGE, type Economy, type EconomyKey, economyOf, PRESETS, presetName, RIVAL_OPTIONS, RIVAL_PRESETS, rivalSettingsOf, type RivalSettings } from '../sim/economy';
import { outlook } from './impact';
import type { DayReport, GameState } from '../sim/state';
import { h, modal, money, signed, stars, toast } from './dom';
import { CityView } from './city';
import { Floor } from './floor';
import { KitchenView } from './kitchenView';
import { pipelineStrip } from './pipeline';
import { checklistCard } from './checklist';
import { kitchenPanel, menuPanel, moneyPanel, type PanelCtx, roomPanel } from './panels';
import { dayCapacityLine, weekKitchenCard } from './capacity';
import { formArrow, moraleFace, needsAttention, openPlayerCard, squadPanel, staffAdvice } from './squad';
import { ROLE_NAMES } from '../data/staff';
import type { TeamLine } from '../sim/state';
import { lossLine } from '../sim/market';
import { type Nav, openMarketing, rivalsPanel, weekCompetitionCard } from './rivals';

type Tab = 'menu' | 'kitchen' | 'room' | 'staff' | 'rivals' | 'money';
const TABS: [Tab, string][] = [['menu', 'Menu'], ['kitchen', 'Kitchen'], ['room', 'Room'], ['staff', 'Squad'], ['rivals', 'Rivals'], ['money', 'Money']];
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

/** Week summary for the restaurants run by managers, with the manager's line on the team (staff-management.md 8.3). */
function branchWeek(reports: DayReport[]): HTMLElement | null {
  const by = new Map<number, { name: string; covers: number; profit: number; manager: string | null; line?: string; proposal?: string }>();
  for (const r of reports) for (const b of r.branches ?? []) {
    const x = by.get(b.id) ?? { name: b.name, covers: 0, profit: 0, manager: b.manager };
    x.covers += b.covers;
    x.profit += b.profit;
    if (b.staffLine) {
      x.line = b.staffLine;
      x.proposal = b.proposal;
    }
    by.set(b.id, x);
  }
  if (!by.size) return null;
  return h('div', { class: 'card' }, h('h3', null, 'Your other restaurants'),
    h('div', { class: 'kv' }, ...[...by.values()].flatMap((b) => [
      h('span', null, `${b.name}${b.manager ? ` · ${b.manager}` : ' · caretaker'}`),
      h('b', { class: b.profit >= 0 ? 'good' : 'bad' }, `${Math.round(b.covers)} guests · ${money(b.profit)}`),
    ])),
    ...[...by.values()].filter((b) => b.line).map((b) => h('details', { class: 'small' },
      h('summary', null, b.line ?? ''), h('div', { class: 'muted' }, `Proposal: ${b.proposal ?? ''}`))));
}

const teamRow = (t: TeamLine, onOpen: () => void): HTMLElement =>
  h('button', { class: `teamline ${t.value >= 0 ? 'up' : 'down'}`, onclick: onOpen },
    h('span', { class: 'tl-name' }, h('b', null, t.name), h('span', { class: 'muted small' }, ` ${ROLE_NAMES[t.role]} · ${t.ovr}`)),
    h('b', { class: t.value >= 0 ? 'good' : 'bad' }, `${signed(t.value)} $`),
    h('span', { class: 'small tl-reason' }, t.reason));

/** Day report: Star of the day, Weak spot and mood lines (staff-management.md 7.2). */
function dayTeamCard(r: DayReport, open: (id: number) => void): HTMLElement | null {
  const team = (r.team ?? []).filter((t) => t.reason !== 'On a course' && t.reason !== 'Day off');
  if (!team.length && !(r.mood ?? []).length) return null;
  const sorted = [...team].sort((a, b) => b.value - a.value);
  const star = sorted[0];
  const weak = sorted.length > 1 ? sorted.at(-1) : undefined;
  const more = sorted.slice(1, -1);
  const ups = more.filter((t) => t.value >= 10).slice(0, 2);
  const downs = more.filter((t) => t.value <= -10).slice(-2);
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'Team'), h('span', { class: 'small' }, 'against a standard hire')),
    star ? h('div', { class: 'small muted' }, '⭐ Star of the day') : null,
    star ? teamRow(star, () => open(star.id)) : null,
    ...ups.map((t) => teamRow(t, () => open(t.id))),
    weak && weak.value < (star?.value ?? 0) ? h('div', { class: 'small muted' }, '🔻 Weak spot') : null,
    weak && weak.value < (star?.value ?? 0) ? teamRow(weak, () => open(weak.id)) : null,
    ...downs.filter((t) => t !== weak).map((t) => teamRow(t, () => open(t.id))),
    ...(r.mood ?? []).map((m) => h('div', { class: 'small' }, `💬 ${m}`)));
}

/** Week report: Player of the week, the whole team, needs attention and one suggestion (7.3). */
function weekTeamCard(reports: DayReport[], state: GameState, open: (id: number) => void): HTMLElement | null {
  const rows = new Map<number, { line: TeamLine; value: number; ovrStart: number; moraleStart: number; reasons: Map<string, number> }>();
  for (const r of reports) for (const t of r.team ?? []) {
    const x = rows.get(t.id) ?? { line: t, value: 0, ovrStart: t.ovrBefore, moraleStart: t.moraleBefore, reasons: new Map() };
    x.line = t;
    x.value += t.value;
    x.reasons.set(t.reason, (x.reasons.get(t.reason) ?? 0) + Math.abs(t.value));
    rows.set(t.id, x);
  }
  if (!rows.size) return null;
  const list = [...rows.values()].sort((a, b) => b.value - a.value);
  const top = list[0];
  const attention = needsAttention(state);
  const advice = staffAdvice(state, new Map(list.map((x) => [x.line.id, x.value])));
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'Team this week'), h('span', { class: 'small' }, '$ for the week, against a standard hire')),
    top && top.value > 0 ? h('div', { class: 'potw' }, '🏆 Player of the week: ', h('b', null, top.line.name), ` (${signed(top.value)} $)`) : null,
    h('div', { class: 'teamtable', role: 'table' },
      ...list.map((x) => {
        const reason = [...x.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        const s = state.staff.find((y) => y.id === x.line.id);
        const dOvr = x.line.ovr - x.ovrStart;
        return h('button', { class: 'tt-row', role: 'row', onclick: () => open(x.line.id) },
          h('span', { role: 'cell' }, h('b', null, x.line.name), h('span', { class: 'muted small' }, ` ${ROLE_NAMES[x.line.role]}`)),
          h('span', { role: 'cell', class: 'small' }, `${x.line.ovr}${dOvr ? ` (${signed(dOvr)})` : ''}`),
          h('span', { role: 'cell', class: 'small' }, `${moraleFace(x.line.morale)} ${Math.round(x.moraleStart)} → ${Math.round(x.line.morale)} `, s ? formArrow(s) : null),
          h('b', { role: 'cell', class: x.value >= 0 ? 'good' : 'bad' }, `${signed(x.value)} $`),
          h('span', { role: 'cell', class: 'small muted tt-reason' }, reason));
      })),
    attention.length ? h('div', { class: 'stack' }, h('b', { class: 'small' }, 'Needs attention'), ...attention.map((t) => h('div', { class: 'small warn' }, `• ${t}`))) : null,
    advice ? h('div', { class: 'impact' }, `💡 ${advice}`) : null);
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
  private city = new CityView();
  private main: HTMLElement;
  /** 'shop' shows the pizzeria, 'city' the city map (city-map.md 2). */
  private view: 'shop' | 'city' = 'shop';
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
    this.main = h('main', { class: 'main' }, stage, side);
    this.city.el.hidden = true;
    root.append(this.hud, this.main, this.city.el);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.view === 'city' && this.game.state && !document.querySelector('.modal-back')) this.showShop();
    });

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
    this.setView('shop');
    this.renderAll();
    if (this.game.saves.conflict) this.showConflict();
  }

  // ---------- City map (city-map.md) ----------

  private setView(view: 'shop' | 'city'): void {
    this.view = view;
    this.main.hidden = view === 'city';
    this.city.el.hidden = view !== 'city';
  }

  /** Open the city map for the running game; the way back returns to the same tab. */
  showCity(focusDistrict: string | null = null): void {
    if (!this.game.state || this.floor.playing) return;
    this.setView('city');
    this.city.open({
      mode: 'move',
      state: this.game.state,
      onBack: () => this.showShop(),
      onRent: (venueId) => this.confirmMove(venueId),
      onOpen: (venueId) => this.confirmOpen(venueId),
      dispatch: (cmd) => {
        const err = this.game.dispatch(cmd);
        if (err) toast(err, 'warn');
        else if (this.game.state) this.city.update(this.game.state);
        return err;
      },
      onSwitch: (locationId) => this.switchRestaurant(locationId),
    }, focusDistrict);
    this.renderHud();
    this.city.el.scrollTop = 0;
  }

  private showShop(): void {
    this.setView('shop');
    this.renderAll();
  }

  private confirmOpen(venueId: string): void {
    const state = this.game.state;
    const v = VENUES[venueId];
    if (!state || !v) return;
    let close = (): void => {};
    close = modal(h('div', { class: 'stack' },
      h('h2', null, `Open ${v.name}?`),
      h('div', { class: 'muted' }, `You pay a deposit of ${money(venueDeposit(venueId))} and start ${v.name} from an empty room. ${locationName(state)} stays open under ${managerOf(state.staff)?.name ?? 'its manager'}; its profit keeps coming into your cash.`),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'ghost', onclick: () => close() }, 'Not yet'),
        h('button', { class: 'primary', onclick: () => {
          close();
          const err = this.game.dispatch({ type: 'openRestaurant', venueId });
          if (err) toast(err, 'warn');
          else this.showShop();
        } }, 'Sign the lease'))));
  }

  switchRestaurant(locationId: number): void {
    const err = this.game.dispatch({ type: 'switchRestaurant', locationId });
    if (err) toast(err, 'warn');
    else this.showShop();
  }

  private confirmMove(venueId: string): void {
    const state = this.game.state;
    const v = VENUES[venueId];
    const q = state ? moveQuote(state, venueId) : null;
    if (!state || !v || !q) return;
    let close = (): void => {};
    close = modal(h('div', { class: 'stack' },
      h('h2', null, `Move to ${v.name}?`),
      h('div', { class: 'muted' }, `${q.total >= 0 ? `You pay ${money(q.total)}` : `You get ${money(-q.total)} back`} (new deposit, old deposit back, moving van${q.resale > 0 ? ', items sold' : ''}). Reputation goes from ${state.rep.toFixed(0)} to ${q.repAfter.toFixed(0)}.`),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'ghost', onclick: () => close() }, 'Stay'),
        h('button', { class: 'primary', onclick: () => {
          close();
          const err = this.game.dispatch({ type: 'rentVenue', venueId });
          if (err) {
            toast(err, 'warn');
            return;
          }
          this.showShop();
        } }, 'Move here'))), { onClose: () => undefined });
  }

  /** Where the coach's answers lead (competition.md 7.5). */
  private nav(): Nav {
    const go = (t: Tab): void => {
      this.tab = t;
      this.renderTabs();
      this.renderPanel();
    };
    return { tab: go, delivery: () => go('money') };
  }

  private ctx(): PanelCtx {
    return {
      state: this.game.state as GameState,
      current: () => this.game.state as GameState,
      dispatch: (cmd) => this.game.dispatch(cmd),
      floor: this.floor,
      rerender: () => this.renderPanel(),
    };
  }

  private onUpdate(state: GameState, events: GameEvent[]): void {
    const week = events.find((e) => e.kind === 'weekCompleted');
    if (week?.reports) {
      // Fast forward: no service animation, straight to the week summary.
      this.shown = state;
      this.setViews(state);
      this.renderAll();
      this.showWeekReport(week.reports, week.stoppedBecause ?? null, events.filter((e) => e.kind !== 'weekCompleted'));
      return;
    }
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
    if (this.view === 'city') this.setView('shop');
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
      this.crumbs(s),
      h('div', { class: 'stat' }, h('span', null, T.time.weekdayNames[(s.day - 1) % 7] ?? ''), h('b', null, `Day ${s.day}`)),
      h('div', { class: 'stat' }, h('span', null, 'Cash'), h('b', { class: s.cash < 0 ? 'bad' : '' }, money(s.cash))),
      h('div', { class: 'stat' }, h('span', null, `Reputation ${s.rep.toFixed(0)}`), h('b', { class: 'stars' }, stars(s.rep))),
      h('div', { class: 'stat', title: 'Local following: how many locals know you and come back. It grows by word of mouth from satisfied guests.' },
        h('span', null, 'Locals'), h('b', null, `${Math.round(s.following * 100)}%`)),
      h('div', { class: 'stat' }, h('span', null, 'Rank'), h('b', null, RANK_NAMES[s.rank])),
      h('div', { class: 'grow' }),
      h('button', { class: 'small', onclick: () => this.showCity() }, '🏠 Buy another restaurant'),
      h('button', { class: 'small', onclick: () => this.showSettings() }, '⚙ Settings'),
      h('span', { class: `cloud ${status}` }, cloudText[status]),
    );
  }

  /** City map › Neighbourhood › Venue: the two way link between the pizzeria and the city. */
  private crumbs(s: GameState): HTMLElement {
    const venue = s.venueId ? VENUES[s.venueId] : null;
    const district = DISTRICTS[s.districtId];
    const inCity = this.view === 'city';
    return h('nav', { class: 'crumbs', 'aria-label': 'Location' },
      h('button', { class: inCity ? 'active' : '', title: 'Open the city map', onclick: () => (inCity ? this.showShop() : this.showCity()) }, inCity ? '← My pizzeria' : '🗺 City map'),
      h('span', { class: 'sep' }, '›'),
      h('button', { class: 'ghost', onclick: () => this.showCity(s.districtId) }, district?.name ?? ''),
      h('span', { class: 'sep' }, '›'),
      h('button', { class: 'ghost cur', onclick: () => (inCity ? this.showShop() : undefined) }, venue?.name ?? 'My pizzeria'));
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
      h('button', { title: 'Run up to 7 days without watching service. Stops early if something needs you.', onclick: () => this.runWeek() }, '⏩ Run a week'),
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
      case 'staff': content = squadPanel(ctx); break;
      case 'rivals': content = rivalsPanel(ctx, this.nav()); break;
      case 'money': content = moneyPanel(ctx, h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => openMarketing(ctx) }, '📣 Marketing'),
        h('button', { class: 'small', onclick: () => this.showSettings() }, '⚙ Settings, saves and difficulty'))); break;
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

  private runWeek(): void {
    this.floor.tool = { kind: 'none' };
    this.floor.selected = null;
    const err = this.game.dispatch({ type: 'runWeek' });
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
      h('div', { class: 'spread' }, h('h2', null, `Day ${r.day} · ${T.time.weekdayNames[r.weekday]}`), h('span', { class: 'muted' }, (state.venueId ? VENUES[state.venueId]?.name : null) ?? DISTRICTS[state.districtId]?.name ?? '')),
      !r.open
        ? h('div', { class: 'warn' }, `Closed today: ${r.closedReason}`)
        : h('div', { class: 'grid2' },
          h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Guests served'), h('span', { class: 'big' }, Math.round(r.covers).toString()),
            h('span', { class: 'small muted' }, `${Math.round(r.walkAways)} turned away · satisfaction ${r.satisfaction.toFixed(0)}`)),
          h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Profit'), h('span', { class: `big ${r.pnl.profit >= 0 ? 'good' : 'bad'}` }, money(r.pnl.profit)),
            h('span', { class: 'small muted' }, `Sales ${money(r.pnl.sales)} · reputation ${signed(repDelta, 1)}`))),
      dayCapacityLine(r),
      r.open && lossLine(state, r) ? h('div', { class: 'small' }, lossLine(state, r)) : null,
      r.open ? h('div', { class: 'small muted' },
        `Word of mouth: ${Math.round(r.followingBefore * 100)}% → ${Math.round(r.followingAfter * 100)}% of locals know you. ` +
        `At today's satisfaction the following heads for ${Math.round(r.followingTarget * 100)}%.`) : null,
      r.open ? h('div', { class: 'card' }, h('h3', null, 'How guests felt'),
        h('div', { class: 'kv' }, ...(['food', 'service', 'ambience', 'value', 'wait'] as const).flatMap((k) => [
          h('span', null, k[0]?.toUpperCase() + k.slice(1)), h('b', { class: sat[k] < 0.45 ? 'bad' : sat[k] > 0.75 ? 'good' : '' }, `${Math.round(sat[k] * 100)}`),
        ])),
        h('div', { class: 'small muted' }, `Food arrived in ${r.services.map((sv) => `${Math.round(sv.ticketTime ?? 0)} min at ${sv.service}`).join(', ')}.`),
        h('div', { class: 'small muted' }, `Busiest: ${r.segments.filter((s) => s.served > 0.5).sort((a, b) => b.served - a.served).slice(0, 3).map((s) => `${SEGMENTS[s.segment].name} ${Math.round(s.served)}`).join(', ')}`)) : null,
      r.open ? dayTeamCard(r, (id) => openPlayerCard(this.ctx(), id)) : null,
      r.tips.length ? h('div', { class: 'card' }, h('h3', null, 'Your advisor'), ...r.tips.map((t) => h('div', { class: 'small' }, t))) : null,
      r.reviews.length ? h('div', { class: 'stack' }, h('h3', null, 'Reviews'),
        ...r.reviews.slice(0, 4).map((rv) => h('div', { class: 'review' }, h('span', { class: 'st' }, '★'.repeat(rv.stars) + '☆'.repeat(5 - rv.stars)), ' ', rv.text, h('span', { class: 'muted small' }, ` (${SEGMENTS[rv.segment].name})`)))) : null,
      r.branches?.length ? h('div', { class: 'card' }, h('h3', null, 'Your other restaurants'),
        h('div', { class: 'kv' }, ...r.branches.flatMap((b) => [
          h('span', null, `${b.name}${b.manager ? ` · ${b.manager} (OVR ${b.managerSkill})` : ' · caretaker'}`),
          h('b', { class: !b.open ? 'warn' : b.profit >= 0 ? 'good' : 'bad' }, b.open ? `${Math.round(b.covers)} guests · ${money(b.profit)}` : 'closed'),
        ]))) : null,
      r.weeklyPayments ? h('div', { class: 'small muted' }, `Sunday bills paid: ${money(r.weeklyPayments)} for wages, rent and loan.`) : null,
      events.length ? h('div', { class: 'stack' }, ...events.map((e) => h('div', { class: e.kind === 'unlocked' || e.kind === 'rankUp' ? 'good' : e.kind === 'restructure' ? 'warn' : e.kind === 'market' ? 'small' : '' }, e.kind === 'market' ? `📰 ${e.text}` : e.text))) : null,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'primary', onclick: () => close() }, 'Tomorrow')));
    close = modal(content, { onClose: () => undefined });
  }

  private showWeekReport(reports: DayReport[], stoppedBecause: string | null, events: GameEvent[]): void {
    let close = (): void => {};
    const first = reports[0];
    const last = reports.at(-1);
    if (!first || !last) return;
    const sum = (f: (r: DayReport) => number): number => reports.reduce((a, r) => a + f(r), 0);
    const covers = sum((r) => r.covers);
    const profit = sum((r) => r.pnl.profit);
    const open = reports.filter((r) => r.open);
    const sat = open.length ? open.reduce((a, r) => a + r.satisfaction * r.covers, 0) / Math.max(1, sum((r) => (r.open ? r.covers : 0))) : 0;
    const bills = sum((r) => r.weeklyPayments);
    const content = h('div', { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, `Days ${first.day} to ${last.day}`), h('span', { class: 'muted' }, `${reports.length} day${reports.length === 1 ? '' : 's'} fast forwarded`)),
      stoppedBecause ? h('div', { class: 'warn' }, `Stopped early. ${stoppedBecause}`) : null,
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Guests served'), h('span', { class: 'big' }, Math.round(covers).toString()),
          h('span', { class: 'small muted' }, `${Math.round(sum((r) => r.walkAways))} turned away · satisfaction ${sat.toFixed(0)}`)),
        h('div', { class: 'card' }, h('span', { class: 'muted small' }, 'Profit'), h('span', { class: `big ${profit >= 0 ? 'good' : 'bad'}` }, money(profit)),
          h('span', { class: 'small muted' }, `Cash ${money(first.cashBefore)} → ${money(last.cashAfter)}`))),
      h('div', { class: 'card' },
        h('div', { class: 'kv' },
          h('span', null, 'Reputation'), h('b', null, `${first.repBefore.toFixed(1)} → ${last.repAfter.toFixed(1)}`),
          h('span', null, 'Local following'), h('b', null, `${Math.round(first.followingBefore * 100)}% → ${Math.round(last.followingAfter * 100)}%`),
          ...reports.flatMap((r) => [
            h('span', null, `${T.time.weekdayNames[r.weekday]} ${r.day}`),
            h('b', { class: r.open ? (r.pnl.profit >= 0 ? 'good' : 'bad') : 'warn' }, r.open ? `${Math.round(r.covers)} guests · ${money(r.pnl.profit)}` : 'closed'),
          ]))),
      weekKitchenCard(reports, this.game.state as GameState),
      weekTeamCard(reports, this.game.state as GameState, (id) => openPlayerCard(this.ctx(), id)),
      branchWeek(reports),
      weekCompetitionCard(reports, this.game.state as GameState, this.ctx(), { ...this.nav(), tab: (t) => { close(); this.nav().tab(t); } }),
      last.tips.length ? h('div', { class: 'card' }, h('h3', null, 'Your advisor'), ...last.tips.map((t) => h('div', { class: 'small' }, t))) : null,
      bills ? h('div', { class: 'small muted' }, `Sunday bills paid: ${money(bills)} for wages, rent and loan.`) : null,
      events.length ? h('div', { class: 'stack' }, ...events.map((e) => h('div', { class: e.kind === 'unlocked' || e.kind === 'rankUp' ? 'good' : e.kind === 'info' ? '' : 'warn' }, e.text))) : null,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'primary', onclick: () => close() }, 'Continue')));
    close = modal(content, { onClose: () => undefined });
  }

  /** A new game starts on the city map (city-map.md 2). */
  showNewGame(): void {
    const hadGame = !!this.game.state;
    const saved = savedEconomy();
    // New games have live rivals on the chosen difficulty unless the player switched them off (competition.md 9).
    const economy: Economy = { ...(saved ?? PRESETS.normal), rivals: saved?.rivals ?? RIVAL_PRESETS[presetName(saved ?? PRESETS.normal) === 'custom' ? 'normal' : (presetName(saved ?? PRESETS.normal) as 'easy' | 'normal' | 'hard')] };
    const seed = Math.floor(Math.random() * 2 ** 31);
    const preview = newGameAt(seed, 'towpathKiosk', economy);
    this.setView('city');
    this.city.open({
      mode: 'new',
      state: null,
      preview,
      startCash: Math.round(T.finance.startingCash * (economy?.startingCash ?? 1)),
      difficulty: `${presetName(economyOf({ economy }))}, ${economyOf({ economy }).start} start`,
      onBack: hadGame ? () => this.showShop() : null,
      onRent: (venueId) => {
        this.game.start(seed, venueId, economy);
        this.shown = this.game.state;
        this.setViews(this.game.state as GameState);
        this.setView('shop');
        this.renderAll();
      },
      onLinkDevice: hadGame ? undefined : () => this.showLinkDevice(true),
    });
    this.hud.replaceChildren(h('div', { class: 'logo' }, 'Pizza D'), h('div', { class: 'grow' }));
  }

  /** Property market: move to another restaurant (fresh-start.md 3). */
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
  /** The Competition group (competition.md 9): old saves add rivals here; there is no prompt. */
  private competitionCard(st: GameState, setEco: (e: Partial<Economy>) => void): HTMLElement {
    const r = rivalSettingsOf(st);
    const set = (x: Partial<RivalSettings>): void => setEco({ rivals: { ...r, ...x } });
    const seg = <X extends string | number | boolean>(items: [X, string][], cur: X, pick: (x: X) => void): HTMLElement =>
      h('div', { class: 'seg wrap' }, ...items.map(([v, label]) => h('button', { class: cur === v ? 'on' : '', 'aria-pressed': cur === v ? 'true' : 'false', onclick: () => pick(v) }, label)));
    const stepper = (label: string, v: number, lo: number, hi: number, pick: (x: number) => void): HTMLElement =>
      h('div', { class: 'spread' }, h('span', null, label), h('div', { class: 'price' },
        h('button', { class: 'small', 'aria-label': `Fewer: ${label}`, disabled: v <= lo, onclick: () => pick(v - 1) }, '−'),
        h('b', null, String(v)),
        h('button', { class: 'small', 'aria-label': `More: ${label}`, disabled: v >= hi, onclick: () => pick(v + 1) }, '+')));
    const skillWord: Record<number, string> = {
      3: 'Casual rivals make slow, sometimes clumsy choices and often pick the wrong crowd.',
      5: 'Capable rivals read the market fairly well.',
      7: 'Sharp rivals read the market well and rarely waste money on the wrong crowd.',
      9: 'Master rivals nearly always make the best move.',
    };
    const active = (st.rivals ?? []).filter((x) => x.closedDay === undefined).length;
    return h('div', { class: 'card' },
      h('h3', null, h('span', null, 'Competition'), h('span', { class: 'small' }, r.on ? `${active} rival${active === 1 ? '' : 's'} in the city` : 'off')),
      h('div', { class: 'small muted' }, 'Other pizzerias open around the city, pick a way to compete (price, quality or marketing) and go after the same guests. There is never a game over.'),
      seg([[true, 'Live rivals on'], [false, 'Off']], r.on, (on) => set({ on, ...(on && !r.start ? { start: RIVAL_PRESETS.normal.start } : {}) })),
      r.on ? h('div', { class: 'stack', style: 'gap:8px' },
        stepper('Rivals at the start (new games, or arriving now)', r.start, 0, 20, (v) => set({ start: v })),
        h('span', null, 'Rival skill'), seg(RIVAL_OPTIONS.skill, r.skill, (v) => set({ skill: v })),
        h('div', { class: 'small muted' }, skillWord[r.skill] ?? ''),
        h('span', null, 'Rival start capital'), seg(RIVAL_OPTIONS.capital, r.capital, (v) => set({ capital: v })),
        h('div', { class: 'small muted' }, 'Decides how big newcomers can open and how long they survive a slow start.'),
        h('span', null, 'New rivals later'), seg(RIVAL_OPTIONS.entrants, r.entrants, (v) => set({ entrants: v })),
        stepper('Most rivals in the city', r.cityCap, 4, 30, (v) => set({ cityCap: v })),
        stepper('Most rivals per neighbourhood', r.districtCap, 1, 5, (v) => set({ districtCap: v })),
        h('label', { class: 'row small' },
          h('input', { type: 'checkbox', checked: r.targetLeader, onchange: (e: Event) => set({ targetLeader: (e.target as HTMLInputElement).checked }) }),
          'Rivals target the leader: marketing minded rivals seek out your most successful restaurant'),
        h('div', { class: 'small muted' }, 'Switching rivals on mid game: they arrive over the next four weeks, each with a week of notice. Switching off: every rival closes quietly overnight.'))
        : h('div', { class: 'small muted' }, 'Off: competition is a steady background number per neighbourhood, as before.'));
  }

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
            h('button', { onclick: () => { close(); this.showCity(); } }, '🏠 Buy another restaurant'),
            h('button', { onclick: () => { close(); this.confirmRestart(); } }, '↺ Restart game'),
            st.cash <= T.finance.freshStartThreshold
              ? h('button', { onclick: () => { close(); this.game.dispatch({ type: 'freshStart' }); } }, 'Fresh start (keep recipes and unlocks)')
              : null)),

        h('div', { class: 'card' },
          h('h3', null, 'Economy and difficulty'),
          h('div', { class: 'small muted' }, 'Make the game easier or harder at any time. Changes apply from the next service. Selling equipment never pays more than the normal 80%, whatever the price slider says.'),
          h('div', { class: 'seg' }, ...(['easy', 'normal', 'hard'] as const).map((p) =>
            h('button', { class: preset === p ? 'on' : '', onclick: () => setEco({ ...PRESETS[p], ...(rivalSettingsOf(st).on ? { rivals: RIVAL_PRESETS[p] } : {}) }) }, p[0]?.toUpperCase() + p.slice(1))),
            h('button', { class: preset === 'custom' ? 'on' : '', disabled: true }, 'Custom')),
          h('div', { class: 'sliders' }, ...(Object.keys(ECONOMY_LABELS) as EconomyKey[]).map(slider)),
          h('div', { class: 'stack', style: 'gap:6px' },
            h('span', null, 'New restaurants'),
            h('div', { class: 'seg' },
              h('button', { class: eco.start === 'slow' ? 'on' : '', onclick: () => setEco({ start: 'slow' }) }, 'Slow start'),
              h('button', { class: eco.start === 'normal' ? 'on' : '', onclick: () => setEco({ start: 'normal' }) }, 'Normal start')),
            h('div', { class: 'small muted' }, eco.start === 'slow'
              ? 'Nobody knows a new restaurant yet: expect quiet first weeks while word of mouth builds your local following. Applies to new games and moves.'
              : 'The neighbourhood knows a new restaurant from day one; the following only drops if guests are unhappy. Applies to new games and moves.')),
          o.covers > 0
            ? h('div', { class: 'impact' }, 'With these settings an average day earns about ', h('b', { class: o.profit >= 0 ? 'good' : 'bad' }, money(o.profit)), ` from ${o.covers.toFixed(0)} guests (at your current reputation).`)
            : h('div', { class: 'impact' }, 'Set up and open your pizzeria to see what these settings do to a day\'s profit.')),

        this.competitionCard(st, setEco),

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
