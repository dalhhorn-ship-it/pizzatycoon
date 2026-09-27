// Business review (WBR style): key KPIs over the last 6 or 12 weeks, week on week and against the average, per
// restaurant and for all of them together. Opened from the Money tab.

import { locationName } from '../sim/chain';
import {
  buildReview, formatChange, formatKpi, KPI_GROUPS, KPI_WEEKS_OPTIONS, KPIS, type KpiDef, type KpiLine, kpiRows, type Review, type WeekKpi,
} from '../sim/kpi';
import type { GameState } from '../sim/state';
import { h, modal, toast } from './dom';
import type { PanelCtx } from './panels';

const ui = { weeks: 6 as number, location: 'all' as number | 'all' };

const nameOf = (state: GameState) => (id: number): string => {
  if (id === state.locationId) return locationName(state);
  const b = state.branches.find((x) => x.id === id);
  return b ? locationName(b) : `Restaurant ${id}`;
};

function tone(def: KpiDef, c: number | null): string {
  if (c === null || def.better === 'none' || Math.abs(c) < 1e-6) return 'muted';
  return (c > 0) === (def.better === 'up') ? 'good' : 'bad';
}

function spark(series: (number | null)[]): HTMLElement {
  const vals = series.map((v) => v ?? 0);
  const max = Math.max(...vals.map(Math.abs), 1e-9);
  return h('div', { class: 'wbr-spark', 'aria-hidden': 'true' },
    ...series.map((v, i) => h('i', { class: `${v !== null && v < 0 ? 'neg' : ''} ${i === series.length - 1 ? 'last' : ''}`, style: `height:${v === null ? 0 : Math.max(4, (Math.abs(v) / max) * 100)}%` })));
}

function kpiTable(review: Review): HTMLElement {
  const head = h('tr', null, h('th', { class: 'k' }, 'KPI'), ...review.weeks.map((w, i) => h('th', { class: i === review.weeks.length - 1 ? 'cur' : '' }, `W${w}`)),
    h('th', null, 'WoW'), h('th', null, `vs ${Math.max(1, review.weeks.length - 1)} wk avg`), h('th', null, 'Trend'));
  const body: HTMLElement[] = [];
  for (const g of KPI_GROUPS) {
    const lines = review.lines.filter((l) => l.def.group === g);
    if (!lines.length) continue;
    body.push(h('tr', { class: 'grp' }, h('td', { colspan: String(review.weeks.length + 4) }, g)));
    for (const l of lines) body.push(row(l));
  }
  return h('div', { class: 'tscroll' }, h('table', { class: 'wbr' }, h('thead', null, head), h('tbody', null, ...body)));
}

function row(l: KpiLine): HTMLElement {
  return h('tr', null,
    h('td', { class: 'k', title: l.def.help }, l.def.label),
    ...l.series.map((v, i) => h('td', { class: i === l.series.length - 1 ? 'cur' : '' }, formatKpi(l.def, v))),
    h('td', { class: tone(l.def, l.wow) }, formatChange(l.def, l.wow)),
    h('td', { class: tone(l.def, l.vsAvg) }, formatChange(l.def, l.vsAvg)),
    h('td', null, spark(l.series)));
}

const COMPARE = ['sales', 'profit', 'margin', 'covers', 'check', 'foodCost', 'labour', 'sat', 'rep', 'turnedAway', 'share', 'orders'];

function restaurantTable(review: Review, which: 'last' | 'window'): HTMLElement {
  const defs = COMPARE.map((id) => KPIS.find((k) => k.id === id) as KpiDef).filter((d) => review.byRestaurant.some((r) => d.value(r[which]) !== null));
  return h('div', { class: 'tscroll' }, h('table', { class: 'wbr' },
    h('thead', null, h('tr', null, h('th', { class: 'k' }, 'Restaurant'), ...defs.map((d) => h('th', { title: d.help }, d.label)))),
    h('tbody', null, ...review.byRestaurant.map((r) => h('tr', null, h('td', { class: 'k' }, r.name),
      ...defs.map((d) => {
        const v = d.value(r[which]);
        const warn = d.guard && v !== null && ((d.guard.above !== undefined && v > d.guard.above) || (d.guard.below !== undefined && v < d.guard.below));
        return h('td', { class: warn ? 'bad' : '' }, formatKpi(d, v));
      }))))));
}

/** The review as plain text, to paste into notes or a message. */
function asText(state: GameState, review: Review): string {
  const scope = ui.location === 'all' ? 'All restaurants' : nameOf(state)(ui.location);
  const out = [`Pizza D business review: ${scope}, weeks ${review.weeks[0]} to ${review.weeks.at(-1)}`, ''];
  for (const c of review.callouts) out.push(`${c.tone === 'good' ? '+' : '!'} ${c.text}`);
  out.push('');
  for (const l of review.lines) out.push(`${l.def.label}: ${formatKpi(l.def, l.last)} (WoW ${formatChange(l.def, l.wow)}, vs avg ${formatChange(l.def, l.vsAvg)})`);
  return out.join('\n');
}

export function openBusinessReview(ctx: PanelCtx): void {
  let close = (): void => {};
  const host = h('div');
  const render = (): void => {
    const state = ctx.current();
    const rows = kpiRows(state);
    const ids = [...rows.keys()];
    if (ui.location !== 'all' && !ids.includes(ui.location)) ui.location = 'all';
    const review = buildReview(state, { location: ui.location, weeks: ui.weeks + 1 }, nameOf(state));
    // One extra week is loaded so the first shown week has a week on week; it is not displayed.
    const shown: Review = review.weeks.length > ui.weeks
      ? { ...review, weeks: review.weeks.slice(1), lines: review.lines.map((l) => ({ ...l, series: l.series.slice(1) })) }
      : review;
    const empty = !shown.weeks.length;
    host.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, 'Business review'), h('button', { class: 'small', onclick: () => close() }, 'Close')),
      h('div', { class: 'row wrap' },
        h('div', { class: 'seg' }, ...KPI_WEEKS_OPTIONS.map((n) => h('button', { class: ui.weeks === n ? 'on' : '', onclick: () => { ui.weeks = n; render(); } }, `${n} weeks`))),
        ids.length > 1 ? h('div', { class: 'seg wrap' },
          h('button', { class: ui.location === 'all' ? 'on' : '', onclick: () => { ui.location = 'all'; render(); } }, 'All restaurants'),
          ...ids.map((id) => h('button', { class: ui.location === id ? 'on' : '', onclick: () => { ui.location = id; render(); } }, nameOf(state)(id)))) : null,
        empty ? null : h('button', { class: 'small', onclick: () => {
          void navigator.clipboard?.writeText(asText(state, shown)).then(() => toast('Review copied as text', 'good'), () => toast('Copy is not allowed here', 'warn'));
        } }, 'Copy as text')),
      empty
        ? h('div', { class: 'card' }, h('div', { class: 'small' }, 'The first review appears after your first full week, on Sunday night. Each week adds a column.'))
        : h('div', { class: 'stack' },
          h('div', { class: 'small muted' }, `Weeks ${shown.weeks[0]} to ${shown.weeks.at(-1)}. The last column is last week. WoW compares it with the week before; the average is over the earlier weeks shown. Shares and ratings change in points. Hover a KPI for its definition.`),
          shown.callouts.length ? h('div', { class: 'card' }, h('h3', null, 'Call outs'),
            ...shown.callouts.map((c) => h('div', { class: `small ${c.tone}` }, `${c.tone === 'good' ? '▲' : '▼'} ${c.text}`))) : null,
          h('div', { class: 'card' }, h('h3', null, 'Key metrics'), kpiTable(shown)),
          ids.length > 1 && ui.location === 'all' ? h('div', { class: 'card' }, h('h3', null, 'By restaurant, last week'), restaurantTable(shown, 'last')) : null,
          ids.length > 1 && ui.location === 'all' ? h('div', { class: 'card' }, h('h3', null, `By restaurant, ${shown.weeks.length} weeks`), restaurantTable(shown, 'window')) : null)));
  };
  render();
  close = modal(host, { wide: true, onClose: () => ctx.rerender() });
}

/** Last week at a glance, for the Money tab. */
export function lastWeekCard(ctx: PanelCtx): HTMLElement | null {
  const state = ctx.state;
  const review = buildReview(state, { location: 'all', weeks: 7 }, nameOf(state));
  if (!review.weeks.length) return null;
  const pick = ['sales', 'profit', 'margin', 'covers', 'sat', 'turnedAway'];
  const lines = review.lines.filter((l) => pick.includes(l.def.id));
  const worst = review.callouts.find((c) => c.tone === 'bad');
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, `📊 Week ${review.weeks.at(-1)}${state.branches.length ? ', all restaurants' : ''}`), h('span', { class: 'small' }, 'vs 6 week average')),
    h('div', { class: 'kpi-grid' }, ...lines.map((l) => h('div', { class: 'kpi' },
      h('span', { class: 'small muted' }, l.def.label), h('b', null, formatKpi(l.def, l.last)), h('span', { class: `small ${tone(l.def, l.vsAvg)}` }, formatChange(l.def, l.vsAvg))))),
    worst ? h('div', { class: 'small bad' }, `▼ ${worst.text}`) : null,
    h('button', { class: 'small', onclick: () => openBusinessReview(ctx) }, 'Open the business review'));
}

export type { WeekKpi };
