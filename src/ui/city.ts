// City map: neighbourhoods, venues, demographic cards and the move flow (01-product/city-map.md 7).

import { ovr } from '../sim/staff';
import { DISTRICTS } from '../data/districts';
import { SEGMENTS, SEGMENT_IDS } from '../data/segments';
import type { SegmentId, Venue } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { bestRep, CARETAKER_TEXT, locationName, managerOf, ownedVenues } from '../sim/chain';
import { type Command, moveQuote, seatLimit, venueDeposit } from '../sim/game';
import { ARCHETYPES } from '../data/rivals';
import { activeRivals, archetypeKnown, proximity, proximityLabel, rivalAt, rivalLocations, viewerOf } from '../sim/rivals';
import { economyOf } from '../sim/economy';
import { bestFor, type LocationFacts, locationFacts, stateLocation } from '../sim/location';
import type { GameState } from '../sim/state';
import { h, money, pct, signed } from './dom';

export interface CityCtx {
  /** 'new' picks the first venue of a new game; 'move' rents another venue for the running game. */
  mode: 'new' | 'move';
  state: GameState | null;
  /** New game only: cash before the deposit and the difficulty name. */
  startCash?: number;
  difficulty?: string;
  /** Null when there is nothing to go back to (first launch). */
  onBack: (() => void) | null;
  onRent: (venueId: string) => void;
  /** Move mode: open a second restaurant here; the current one stays open under its manager. */
  onOpen?: (venueId: string) => void;
  /** Move mode: go and run a restaurant you already own. */
  onSwitch?: (locationId: number) => void;
  onLinkDevice?: () => void;
  /** New game: the city as it will be, so rivals show on the welcome map. */
  preview?: GameState | null;
  /** Move mode: send a command (holding a venue). */
  dispatch?: (cmd: Command) => string | null;
}

type SortKey = 'traffic' | 'rent' | 'size' | 'name';
type Show = 'all' | 'free' | 'rivals' | 'mine';

/** Neighbourhood blocks on the 100 x 70 map. */
const BLOCKS: Record<string, { x: number; y: number; w: number; h: number; lx: number; ly: number }> = {
  university: { x: 2, y: 2, w: 32, h: 23, lx: 4, ly: 5.5 },
  business: { x: 36, y: 2, w: 30, h: 22, lx: 38, ly: 5.5 },
  linden: { x: 68, y: 2, w: 30, h: 36, lx: 70, ly: 5.5 },
  market: { x: 2, y: 27, w: 28, h: 41, lx: 4, ly: 30.5 },
  canal: { x: 32, y: 26, w: 34, h: 20, lx: 34, ly: 44.2 },
  oldtown: { x: 32, y: 48, w: 30, h: 20, lx: 34, ly: 51.5 },
  harbour: { x: 68, y: 40, w: 30, h: 28, lx: 70, ly: 43.5 },
};

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}, ...children: (Node | string)[]): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

/** fresh-start.md: the cheapest working pizzeria costs about this to fit out. */
const FIT_OUT_MIN = 2920;

const pinRadius = (premisesId: string): number =>
  premisesId === 'hole' ? 1.3 : premisesId === 'cosy' ? 1.7 : premisesId === 'medium' || premisesId === 'corner' ? 2.1 : 2.5;
const level = (v: number, lo: number, hi: number, words: [string, string, string]): string => (v < lo ? words[0] : v < hi ? words[1] : words[2]);
const sqm = (v: number): string => `${Math.round(v)} m²`;

export function venueFacts(v: Venue): LocationFacts {
  return locationFacts(v.districtId, v.premisesId, v.id);
}

export class CityView {
  readonly el = h('section', { class: 'city', 'aria-label': 'City map' });
  private selected: string | null = null;
  private district: string | null = null;
  private sort: SortKey = 'traffic';
  private filter = 'all';
  private show: Show = 'all';
  private ctx: CityCtx | null = null;

  /** The city's market: the running game, or the new game preview. */
  private get market(): GameState | null {
    return this.ctx?.state ?? this.ctx?.preview ?? null;
  }

  open(ctx: CityCtx, focusDistrict: string | null = null): void {
    this.ctx = ctx;
    this.selected = focusDistrict ? null : (ctx.state?.venueId ?? 'towpathKiosk');
    this.district = focusDistrict;
    this.filter = 'all';
    this.render();
  }

  /** After a command from the map (holding a venue): show the new state. */
  update(state: GameState): void {
    if (this.ctx) this.ctx.state = state;
    this.render();
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const here = ctx.state?.venueId ? VENUES[ctx.state.venueId] : null;
    const head = h('div', { class: 'city-head' },
      ctx.onBack
        ? h('button', { class: 'back', onclick: () => ctx.onBack?.() }, `← Back to ${here?.name ?? 'my pizzeria'}`)
        : null,
      h('div', { class: 'city-title' },
        h('h2', null, ctx.mode === 'new' ? 'Welcome to Porto Verde' : 'City map'),
        h('span', { class: 'muted small' }, ctx.mode === 'new'
          ? `You have ${money(ctx.startCash ?? T.finance.startingCash)} and a dream. Rent an empty place on the map, then set it up yourself. A hole in the wall is the cosy way to start; bigger venues are for later. Nobody knows you yet: expect quiet first weeks while word of mouth builds your local following. There is no game over.`
          : 'Compare neighbourhoods and venues. Moving takes your team, menu and equipment with you.')),
      ctx.onLinkDevice ? h('button', { class: 'ghost small', onclick: () => ctx.onLinkDevice?.() }, 'Continue a game from another device') : null);
    const detail = h('div', { class: 'city-detail' }, this.detail());
    this.el.replaceChildren(head, h('div', { class: 'city-body' },
      h('div', { class: 'city-left' }, h('div', { class: 'city-map' }, this.map()), this.legend(), this.list()),
      detail));
  }

  private select(venueId: string | null, district: string | null = null): void {
    this.selected = venueId;
    this.district = district;
    this.render();
    if (window.matchMedia('(max-width: 860px)').matches) this.el.querySelector('.city-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Map ----------

  private map(): SVGElement {
    const hereId = this.ctx?.state?.venueId ?? null;
    const focus = this.selected ? VENUES[this.selected]?.districtId : this.district;
    const root = svg('svg', { viewBox: '0 0 100 70', role: 'img', 'aria-label': 'Map of Porto Verde' });
    root.append(svg('rect', { x: 0, y: 0, width: 100, height: 70, class: 'street' }));
    for (const [id, b] of Object.entries(BLOCKS)) {
      const d = DISTRICTS[id];
      if (!d) continue;
      const g = svg('g', { class: `block d-${id} ${focus === id ? 'focus' : ''}`, tabindex: 0, role: 'button', 'aria-label': d.name });
      g.append(svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 2.2 }), svg('text', { x: b.lx, y: b.ly, class: 'dname' }, d.name));
      g.addEventListener('click', () => this.select(null, id));
      g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') this.select(null, id); });
      root.append(g);
    }
    // Water: the canal and the sea by the harbour.
    root.append(
      svg('path', { class: 'water line', d: 'M31 37 C 38 33, 44 44, 51 39 S 61 35, 65 41 L 65 70' }),
      svg('path', { class: 'water', d: 'M100 52 C 95 54, 92 57, 91 61 C 90 65, 88 68, 86 70 L 100 70 Z' }),
      svg('text', { x: 95, y: 67, class: 'sea' }, 'sea'),
    );
    // Park trees in Linden Park.
    for (const [x, y] of [[80, 20], [84, 22], [90, 24], [94, 20], [82, 34], [92, 32]] as const) root.append(svg('circle', { cx: x, cy: y, r: 1.3, class: 'tree' }));
    const pins = Object.values(VENUES).filter((v) => this.visible(v.id)).sort((a, b) => (a.id === this.selected ? 1 : b.id === this.selected ? -1 : 0));
    const m = this.market;
    for (const v of pins) {
      const r = pinRadius(v.premisesId);
      const owned = this.ctx?.state ? ownedVenues(this.ctx.state).has(v.id) : false;
      const rival = m ? rivalAt(m, v.id) : undefined;
      const viewer = m ? viewerOf(m, v.id) : undefined;
      const held = m?.venueHold && m.venueHold.venueId === v.id && m.venueHold.untilDay > m.day;
      const cls = ['pin', v.id === this.selected ? 'on' : '', v.id === hereId || owned ? 'here' : '', rival ? 'rival' : ''].join(' ');
      const label = rival ? `${v.name}: ${rival.name}` : viewer ? `${v.name}: ${viewer.name} is viewing` : v.name;
      const g = svg('g', { class: cls, tabindex: 0, role: 'button', 'aria-label': label });
      g.append(svg('circle', { cx: v.x, cy: v.y, r: 3.6, class: 'hit' }));
      if (rival) {
        // Rivals: a logo pin with a ring in the archetype colour and its letter, for colour blind players too.
        const a = ARCHETYPES[rival.archetype];
        g.append(svg('circle', { cx: v.x, cy: v.y, r: r + 0.6, class: 'rring', stroke: a.color }), svg('circle', { cx: v.x, cy: v.y, r: r, class: 'rdot' }),
          svg('text', { x: v.x, y: v.y + 0.9, class: 'rletter' }, a.letter));
      } else g.append(svg('circle', { cx: v.x, cy: v.y, r: v.id === this.selected ? r + 0.5 : r, class: 'dot' }));
      if (viewer && m) g.append(svg('circle', { cx: v.x, cy: v.y, r: r + 1.2, class: 'viewing', stroke: ARCHETYPES[viewer.archetype].color }),
        svg('text', { x: v.x, y: v.y + r + 3, class: 'vflag' }, `👁 ${Math.max(0, (viewer.viewing?.signsOn ?? 0) - m.day)}d`));
      if (held) g.append(svg('text', { x: v.x, y: v.y + r + 3, class: 'vflag' }, '🔒'));
      if (v.id === hereId) g.append(svg('text', { x: v.x, y: v.y - r - 1.2, class: 'flag' }, 'You are here'));
      else if (v.id === this.selected) g.append(svg('text', { x: v.x, y: v.y - r - 1.4, class: 'flag' }, v.name));
      g.addEventListener('click', (e) => { e.stopPropagation(); this.select(v.id); });
      g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') this.select(v.id); });
      root.append(g);
    }
    return root;
  }

  private legend(): HTMLElement {
    const item = (cls: string, text: string): HTMLElement => h('span', { class: 'row small muted' }, h('i', { class: `lg ${cls}` }), text);
    const showBtn = (k: Show, label: string): HTMLElement => h('button', { class: this.show === k ? 'on' : '', 'aria-pressed': this.show === k ? 'true' : 'false', onclick: () => { this.show = k; this.render(); } }, label);
    return h('div', { class: 'stack', style: 'gap:6px' },
      h('div', { class: 'city-legend' }, item('xs', 'Hole in the wall'), item('s', 'Small (cosy)'), item('m', 'Medium'), item('l', 'Large'), item('here', 'Your pizzeria'),
        this.market?.rivals?.length ? item('rival', 'Rival pizzeria') : null),
      this.market?.rivals?.length ? h('div', { class: 'seg' }, showBtn('all', 'All'), showBtn('free', 'Free'), showBtn('rivals', 'Rivals'), showBtn('mine', 'Mine')) : null);
  }

  /** Filter chips: all, free, rivals, mine (competition.md 4.3). */
  private visible(venueId: string): boolean {
    const m = this.market;
    if (this.show === 'all' || !m) return true;
    const mine = this.ctx?.state ? ownedVenues(this.ctx.state).has(venueId) : false;
    const rival = !!rivalAt(m, venueId);
    if (this.show === 'mine') return mine;
    if (this.show === 'rivals') return rival;
    return !mine && !rival;
  }

  // ---------- Venue list ----------

  private list(): HTMLElement {
    const m = this.market;
    const rows = Object.values(VENUES)
      .filter((v) => this.filter === 'all' || v.districtId === this.filter)
      .filter((v) => this.visible(v.id))
      .map((v) => ({ v, f: venueFacts(v) }))
      .sort((a, b) => {
        switch (this.sort) {
          case 'traffic': return b.f.footTraffic - a.f.footTraffic;
          case 'rent': return a.f.weeklyRent - b.f.weeklyRent;
          case 'size': return b.f.sqm - a.f.sqm;
          case 'name': return a.v.name.localeCompare(b.v.name);
        }
      });
    const sortBtn = (k: SortKey, label: string): HTMLElement => h('button', { class: this.sort === k ? 'on' : '', onclick: () => { this.sort = k; this.render(); } }, label);
    const hereId = this.ctx?.state?.venueId;
    return h('div', { class: 'card venue-list' },
      h('div', { class: 'spread' },
        h('h3', null, `${rows.length} venues to rent`),
        h('select', { 'aria-label': 'Neighbourhood', onchange: (e: Event) => { this.filter = (e.target as HTMLSelectElement).value; this.render(); } },
          h('option', { value: 'all', selected: this.filter === 'all' }, 'All neighbourhoods'),
          ...Object.values(DISTRICTS).map((d) => h('option', { value: d.id, selected: this.filter === d.id }, d.name)))),
      h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Sort'), h('div', { class: 'seg' },
        sortBtn('traffic', 'Foot traffic'), sortBtn('rent', 'Rent'), sortBtn('size', 'Size'), sortBtn('name', 'Name'))),
      h('div', { class: 'vrows' }, ...rows.map(({ v, f }) => h('button', { class: `vrow ${v.id === this.selected ? 'on' : ''}`, onclick: () => this.select(v.id) },
        h('span', { class: 'vname' }, h('b', null, v.name), v.id === hereId ? h('span', { class: 'chip here' }, 'You are here')
          : this.ctx?.state && ownedVenues(this.ctx.state).has(v.id) ? h('span', { class: 'chip here' }, 'Yours')
            : m && rivalAt(m, v.id) ? h('span', { class: 'chip rival' }, rivalAt(m, v.id)?.name ?? '') : null,
          h('span', { class: 'small muted' }, `${f.district.name} · ${f.premises.name}`)),
        h('span', { class: 'vnum' }, h('b', null, Math.round(f.footTraffic).toLocaleString('en-US')), h('span', { class: 'small muted' }, 'a day')),
        h('span', { class: 'vnum' }, h('b', null, money(f.weeklyRent)), h('span', { class: 'small muted' }, 'a week')),
        h('span', { class: 'vnum' }, h('b', null, sqm(f.sqm)), h('span', { class: 'small muted' }, 'floor'))))));
  }

  // ---------- Detail card ----------

  private detail(): HTMLElement {
    const v = this.selected ? VENUES[this.selected] : null;
    if (v) return this.venueCard(v);
    const d = this.district ? DISTRICTS[this.district] : null;
    if (d) return this.districtCard(d.id);
    return h('div', { class: 'muted' }, 'Tap a neighbourhood or a venue on the map.');
  }

  private districtCard(id: string): HTMLElement {
    const f = locationFacts(id, 'cosy', null);
    const d = f.district;
    const venues = Object.values(VENUES).filter((v) => v.districtId === id);
    return h('div', { class: 'stack' },
      h('div', null, h('h2', null, d.name), h('div', { class: 'muted small' }, d.blurb)),
      h('div', { class: 'chips' }, h('span', { class: 'chip best' }, `Best for: ${bestFor(f.shares)}`)),
      h('div', { class: 'figs' },
        fig('Foot traffic', `${d.footTraffic.toLocaleString('en-US')}`, 'passersby a day'),
        fig('Rent', `$${d.rentPerTile}`, `per tile a week (${(d.rentPerTile / T.city.sqmPerTile).toFixed(1)} $/m²)`),
        fig('Spending power', `x${d.wealth.toFixed(2)}`, level(d.wealth, 0.95, 1.15, ['Modest', 'Average', 'High'])),
        fig('Competition', level(d.competition, 0.25, 0.42, ['Low', 'Medium', 'High']), `${pct(d.competition)} of rivals' pull`)),
      splitBar(f.lunchShare),
      demographics(f),
      h('div', { class: 'stack' }, h('h3', null, `Venues in ${d.name}`),
        ...venues.map((v) => {
          const vf = venueFacts(v);
          return h('button', { class: 'vrow', onclick: () => this.select(v.id) },
            h('span', { class: 'vname' }, h('b', null, v.name), h('span', { class: 'small muted' }, v.pros[0] ?? '')),
            h('span', { class: 'vnum' }, h('b', null, money(vf.weeklyRent)), h('span', { class: 'small muted' }, 'a week')),
            h('span', { class: 'vnum' }, h('b', null, sqm(vf.sqm)), h('span', { class: 'small muted' }, 'floor')));
        })));
  }

  private venueCard(v: Venue): HTMLElement {
    const ctx = this.ctx as CityCtx;
    const f = venueFacts(v);
    const state = ctx.state;
    const here = state?.venueId === v.id;
    const cur = state ? stateLocation(state) : null;
    const compare = cur && !here
      ? h('div', { class: 'chips' },
        h('span', { class: 'small muted' }, 'Compared with now:'),
        cmpChip(`foot traffic ${signed(((f.footTraffic - cur.footTraffic) / cur.footTraffic) * 100, 0, '%')}`, f.footTraffic >= cur.footTraffic),
        cmpChip(`rent ${f.weeklyRent >= cur.weeklyRent ? '+' : '−'}${money(Math.abs(f.weeklyRent - cur.weeklyRent))}/week`, f.weeklyRent <= cur.weeklyRent),
        cmpChip(`floor ${signed(f.sqm - cur.sqm, 0)} m²`, f.sqm >= cur.sqm))
      : null;
    return h('div', { class: 'stack' },
      h('div', null,
        h('div', { class: 'spread' }, h('h2', null, v.name), here ? h('span', { class: 'chip here' }, 'You are here') : null),
        h('div', { class: 'muted small' }, `${v.address} · `,
          h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); this.select(null, v.districtId); } }, f.district.name),
          ` · ${f.premises.name}`)),
      h('div', { class: 'chips' }, h('span', { class: 'chip best' }, `Best for: ${bestFor(f.shares)}`)),
      h('div', { class: 'figs' },
        fig('Foot traffic', Math.round(f.footTraffic).toLocaleString('en-US'), 'passersby a day'),
        fig('Rent', money(f.weeklyRent), `a week · $${v.rentPerTile}/tile`),
        fig('Floor area', sqm(f.sqm), `dining ${sqm(f.diningSqm)} · kitchen ${sqm(f.kitchenSqm)}`),
        fig('Competition', level(f.competition, 0.25, 0.42, ['Low', 'Medium', 'High']), `spending power x${f.wealth.toFixed(2)}`)),
      h('div', { class: 'small muted' }, `Dining room ${f.premises.diningWidth} x ${f.premises.diningHeight} tiles, kitchen ${f.premises.kitchenWidth} x ${f.premises.kitchenHeight} tiles (1 tile = ${T.city.sqmPerTile} m²).`),
      splitBar(f.lunchShare),
      compare,
      h('div', { class: 'proscons' },
        h('div', null, h('h3', null, 'Pros'), h('ul', { class: 'pros' }, ...v.pros.map((p) => h('li', null, p)))),
        h('div', null, h('h3', null, 'Cons'), h('ul', { class: 'cons' }, ...v.cons.map((c) => h('li', null, c))))),
      this.rivalsNear(v),
      demographics(f),
      this.rentBox(v, f, here));
  }

  /** Rivals within reach of a venue, and who runs or views it (competition.md 4.3). */
  private rivalsNear(v: Venue): HTMLElement | null {
    const m = this.market;
    if (!m?.rivals?.length) return null;
    const near = rivalLocations(m)
      .map(({ rival, loc }) => ({ rival, loc, prox: proximity(v.districtId, v.id, VENUES[loc.venueId]?.districtId ?? '', loc.venueId) }))
      .filter((x) => x.prox > 0 && x.loc.venueId !== v.id)
      .sort((a, b) => b.prox - a.prox);
    const occupant = rivalAt(m, v.id);
    const viewer = viewerOf(m, v.id);
    const label = (r: typeof near[number]['rival']): string => (archetypeKnown(m, r) ? ARCHETYPES[r.archetype].name : 'Archetype ?');
    return h('div', { class: 'card' },
      h('h3', null, h('span', null, 'Rivals within reach'), h('span', { class: 'small' }, `${near.length}`)),
      occupant ? h('div', { class: 'small warn' }, `${occupant.name} runs a pizzeria here (${label(occupant)}). Not to let.`) : null,
      viewer ? h('div', { class: 'small warn' }, `${viewer.name} is viewing this venue and signs on day ${viewer.viewing?.signsOn}. Rent or hold it first to keep it.`) : null,
      near.length ? h('div', { class: 'kv' }, ...near.slice(0, 8).flatMap(({ rival, loc, prox }) => [
        h('span', null, h('i', { class: 'lg rival', style: `border-color:${ARCHETYPES[rival.archetype].color}` }), ` ${rival.name} · ${label(rival)}`),
        h('b', null, `${'★'.repeat(Math.round(loc.rep / 20))} · ${proximityLabel(prox)}`),
      ])) : h('div', { class: 'small muted' }, 'No rival pizzeria nearby.'));
  }

  private rentBox(v: Venue, f: LocationFacts, here: boolean): HTMLElement {
    const ctx = this.ctx as CityCtx;
    const occupant = this.market ? rivalAt(this.market, v.id) : undefined;
    if (occupant && !here) return h('div', { class: 'card rentbox' }, h('div', { class: 'small muted' }, `${occupant.name} has the lease here. If they close, the venue comes back on the market.`));
    if (ctx.mode === 'new' || !ctx.state) {
      const deposit = venueDeposit(v.id);
      const left = (ctx.startCash ?? T.finance.startingCash) - deposit;
      return h('div', { class: 'card rentbox' },
        h('div', { class: 'kv' },
          h('span', null, 'Rent'), h('b', null, `${money(f.weeklyRent)}/week`),
          h('span', null, 'Seats allowed'), h('b', null, String(seatLimit(v.premisesId))),
          h('span', null, `Deposit (${T.finance.leaseDepositWeeks} weeks rent)`), h('b', null, money(deposit)),
          h('span', null, 'Left to set up with'), h('b', { class: left < 0 ? 'bad' : left < FIT_OUT_MIN ? 'warn' : 'good' }, money(left))),
        left < 0
          ? h('div', { class: 'small bad' }, `You need ${money(-left)} more. Start in a hole in the wall and move here later.`)
          : left < FIT_OUT_MIN
            ? h('div', { class: 'small warn' }, `The cheapest working pizzeria costs about ${money(FIT_OUT_MIN)} to fit out. You could borrow, but a smaller place is the cosy way to start.`)
            : null,
        ctx.difficulty ? h('div', { class: 'small muted' }, `Difficulty: ${ctx.difficulty}. Change it any time under ⚙ Settings.`) : null,
        h('button', { class: 'primary', disabled: left < 0, onclick: () => ctx.onRent(v.id) }, 'Sign the lease here'));
    }
    if (here) return h('div', { class: 'card rentbox' }, h('div', { class: 'small muted' }, 'This is where your pizzeria is today.'),
      ctx.onBack ? h('button', { class: 'primary', onclick: () => ctx.onBack?.() }, `Back to ${v.name}`) : null);
    const branch = ctx.state.branches.find((b) => b.venueId === v.id);
    if (branch) {
      const m = managerOf(branch.staff);
      const hasManager = !!managerOf(ctx.state.staff);
      return h('div', { class: 'card rentbox' },
        h('h3', null, 'Your restaurant'),
        h('div', { class: 'small muted' }, m ? `Run by ${m.name}, restaurant manager, OVR ${ovr(m)}. Reputation ${branch.rep.toFixed(0)}.` : CARETAKER_TEXT),
        !hasManager ? h('div', { class: 'small warn' }, `To go and run it, first hire a restaurant manager for ${locationName(ctx.state)} (Staff tab).`) : null,
        h('button', { class: 'primary', disabled: !hasManager, onclick: () => ctx.onSwitch?.(branch.id) }, 'Go and run it'));
    }
    const q = moveQuote(ctx.state, v.id);
    if (!q) return h('div');
    const short = q.total > 0 && ctx.state.cash < q.total;
    const sold = [...q.soldFurniture, ...q.soldEquipment];
    return h('div', { class: 'card rentbox' },
      h('h3', null, 'Cost to move here'),
      h('div', { class: 'pnl' },
        h('span', null, `New deposit (${T.finance.leaseDepositWeeks} weeks)`), h('b', null, money(-q.newDeposit)),
        h('span', null, 'Old deposit back'), h('b', null, money(q.refund)),
        h('span', null, 'Moving van and fit out'), h('b', null, money(-q.movingFee)),
        q.resale > 0 ? h('span', null, 'Items that do not fit, sold at 80%') : null, q.resale > 0 ? h('b', null, money(q.resale)) : null,
        h('span', { class: 'total' }, q.total >= 0 ? 'You pay' : 'You get back'), h('b', { class: `total ${short ? 'bad' : ''}` }, money(Math.abs(q.total)))),
      h('div', { class: 'small muted' }, `Reputation ${ctx.state.rep.toFixed(0)} → ${q.repAfter.toFixed(0)}: ${q.sameDistrict ? 'same neighbourhood, most regulars follow you' : 'a new neighbourhood has to get to know you'}. Local following ${Math.round(ctx.state.following * 100)}% → ${Math.round(q.followingAfter * 100)}%. Team, menu, loan and rank come with you${ctx.state.fireSafety.length ? '; fire safety upgrades stay in the old building' : ''}.`),
      sold.length ? h('div', { class: 'small warn' }, `Will not fit and gets sold: ${sold.join(', ')}.`) : null,
      short ? h('div', { class: 'small bad' }, `You need ${money(q.total - ctx.state.cash)} more cash.`) : null,
      h('button', { class: 'primary', disabled: short, onclick: () => ctx.onRent(v.id) }, 'Move here'),
      this.openBox(v),
      this.holdBox(v, f));
  }

  /** Hold a free venue so no rival takes it (competition.md 3.5). */
  private holdBox(v: Venue, f: LocationFacts): HTMLElement | null {
    const ctx = this.ctx as CityCtx;
    const state = ctx.state;
    if (!state || !activeRivals(state).length && !state.rivals?.length) return null;
    const hold = state.venueHold && state.venueHold.untilDay > state.day ? state.venueHold : null;
    const fee = Math.round(f.weeklyRent * economyOf(state).rent);
    if (hold?.venueId === v.id) return h('div', { class: 'small good', style: 'margin-top:10px' }, `🔒 Held for you until day ${hold.untilDay}. The ${money(hold.fee)} comes off the deposit if you take it.`);
    return h('div', { class: 'stack', style: 'margin-top:10px' },
      h('h3', null, 'Or hold it for later'),
      h('div', { class: 'small muted' }, `Pay one week of rent (${money(fee)}, not refundable) and no rival views or signs it for ${T.rivals.holdDays} days. If you take it within the hold, the fee comes off the deposit.${hold ? ` You already hold ${VENUES[hold.venueId]?.name}.` : ''}`),
      h('button', { disabled: !!hold || state.cash < fee, onclick: () => {
        ctx.dispatch?.({ type: 'holdVenue', venueId: v.id });
      } }, `Hold for ${money(fee)}`));
  }

  /** Open a second restaurant here: the current one keeps running under its manager (prd.md 5.9). */
  private openBox(v: Venue): HTMLElement {
    const ctx = this.ctx as CityCtx;
    const state = ctx.state as GameState;
    const deposit = venueDeposit(v.id);
    const manager = managerOf(state.staff);
    const short = state.cash < deposit;
    const rep = bestRep(state);
    const repOk = rep >= T.manager.openRep;
    return h('div', { class: 'stack', style: 'margin-top:10px' },
      h('h3', null, 'Or open it as a new restaurant'),
      h('div', { class: 'small muted' }, `Keep ${locationName(state)} and open here as well. The new place starts empty, with your recipe book; you choose its own menu. Deposit ${money(deposit)}; the rest comes from shared cash.`),
      repOk
        ? null
        : h('div', { class: 'small warn' }, `Build your name first: you need reputation ${T.manager.openRep} (${(T.manager.openRep / 20).toFixed(1)} stars) at a restaurant you run before a landlord takes you on for a second one. Now ${Math.floor(rep)}.`),
      manager
        ? h('div', { class: 'small good' }, `${manager.name} (OVR ${ovr(manager)}) will run ${locationName(state)} while you are here.`)
        : h('div', { class: 'small warn' }, `First hire a restaurant manager for ${locationName(state)} in the Staff tab, to keep it running while you are away.`),
      short ? h('div', { class: 'small bad' }, `You need ${money(deposit - state.cash)} more cash.`) : null,
      h('button', { disabled: !repOk || !manager || short, onclick: () => ctx.onOpen?.(v.id) }, 'Open a new restaurant here'));
  }
}

function fig(label: string, value: string, sub: string): HTMLElement {
  return h('div', { class: 'fig' }, h('span', { class: 'small muted' }, label), h('b', null, value), h('span', { class: 'small muted' }, sub));
}

function cmpChip(text: string, good: boolean): HTMLElement {
  return h('span', { class: `chip ${good ? 'up' : 'down'}` }, text);
}

function splitBar(lunch: number): HTMLElement {
  return h('div', { class: 'split' },
    h('div', { class: 'split-bar' }, h('div', { class: 'lunch', style: `width:${lunch * 100}%` }), h('div', { class: 'dinner' })),
    h('div', { class: 'spread small muted' }, h('span', null, `Lunch ${pct(lunch)}`), h('span', null, `Dinner ${pct(1 - lunch)}`)));
}

const SENSITIVITY = (e: number): string => (e >= 1.5 ? 'High' : e >= 1 ? 'Medium' : 'Low');

/** city-map.md 5: one card per segment, sorted by share. */
function demographics(f: LocationFacts): HTMLElement {
  const ids = [...SEGMENT_IDS].sort((a, b) => f.shares[b] - f.shares[a]);
  const max = Math.max(...ids.map((id) => f.shares[id]));
  return h('div', { class: 'stack' },
    h('h3', null, 'Who walks past'),
    h('div', { class: 'demo' }, ...ids.map((id: SegmentId) => {
      const s = SEGMENTS[id];
      const share = f.shares[id];
      return h('div', { class: `demo-card seg-${id} ${share < 0.06 ? 'faint' : ''}` },
        h('div', { class: 'spread' }, h('b', null, s.name), h('span', { class: 'share' }, pct(share))),
        h('div', { class: 'demo-bar' }, h('div', { style: `width:${(share / max) * 100}%` })),
        h('span', { class: 'small' }, `${Math.round(f.footTraffic * share).toLocaleString('en-US')} a day · spends ~${money(s.budget * f.wealth)}`),
        h('span', { class: 'small muted' }, `Likes ${s.likedTags.join(', ')} · price sensitivity ${SENSITIVITY(s.elasticity)}`));
    })));
}
