// Capacity and kitchen bottlenecks on screen (kitchen-bottlenecks.md): max guests per service, how far each day gets,
// what limits it, which levers matter, and station warnings.

import { analyse } from '../sim/analysis';
import { capacityOf, capacityOutlook, levers, type ServiceCapacity, stationIssues, weekKitchen } from '../sim/capacity';
import type { DayReport, GameState, ServiceReport } from '../sim/state';
import { h, signed } from './dom';

export const LIMIT_NAMES: Record<ServiceReport['bottleneck'], string> = {
  seats: 'tables and serving', servers: 'the servers (35 guests each a service, up to 50 for a top server)', oven: 'the ovens', prep: 'the prep line', plates: 'clean plates', cold: 'dough in the fridges', cooks: 'the cooks (50 guests each a service, up to 75 for a top cook)', none: 'nothing',
};

export const LIMIT_FIX: Record<ServiceReport['bottleneck'], string> = {
  seats: 'More tables, a host or a heat lamp pass.',
  servers: 'Hire another server, or faster ones: a server at Speed 50 looks after 35 guests a service, a top server up to 50.',
  oven: 'Another or a bigger oven, a cook to tend them, or primi and secondi that skip the oven.',
  prep: 'Another prep station or a sheeter, a cook, a hand wash station, or a shorter menu.',
  plates: 'A dishwasher with room at the sink, a Double Sink or Dish Machine, or Plate Shelving.',
  cold: 'A Reach in Fridge or a Walk in Cooler.',
  cooks: 'Hire another cook, or faster ones: a cook at Speed 50 serves 50 guests a service, a top cook up to 75.',
  none: '',
};

function serviceBar(c: ServiceCapacity): HTMLElement {
  const max = Math.max(1, c.capacity, c.demand);
  return h('div', { class: 'capbar', role: 'img', 'aria-label': `${c.service}: ${Math.round(c.served)} served of ${Math.round(c.capacity)} possible, ${Math.round(c.demand)} wanted in` },
    h('span', { class: 'cap-l' }, c.service === 'lunch' ? 'Lunch' : 'Dinner'),
    h('div', { class: 'cap-track' },
      h('div', { class: 'cap-cap', style: `width:${(c.capacity / max) * 100}%` }),
      h('div', { class: 'cap-served', style: `width:${(c.served / max) * 100}%` }),
      h('div', { class: 'cap-demand', style: `left:${Math.min(100, (c.demand / max) * 100)}%`, title: `${Math.round(c.demand)} wanted in` })),
    h('b', null, `${Math.round(c.served)} / ${Math.round(c.capacity)}`));
}

function limitText(c: ServiceCapacity): string {
  const used = c.capacity > 0 ? Math.round((c.served / c.capacity) * 100) : 0;
  if (c.demand < c.capacity * 0.95) return `${c.service === 'lunch' ? 'Lunch' : 'Dinner'}: ${used}% of capacity used; ${Math.round(c.capacity - c.demand)} more guests would fit. Demand is the limit.`;
  return `${c.service === 'lunch' ? 'Lunch' : 'Dinner'}: full. ${Math.round(Math.max(0, c.demand - c.capacity))} more wanted in; the limit is ${LIMIT_NAMES[c.bottleneck === 'none' ? 'seats' : c.bottleneck]}.`;
}

const leverCache = new WeakMap<GameState, ReturnType<typeof levers>>();

/** Kitchen tab: max guests per service, the coming week, the last 7 days, and the levers (kitchen-bottlenecks.md). */
export function capacityCard(state: GameState): HTMLElement | null {
  const o = capacityOutlook(state);
  if (!o) return null;
  let lv = leverCache.get(state);
  if (!lv) {
    lv = levers(state);
    leverCache.set(state, lv);
  }
  const recent = state.history.filter((r) => r.open).slice(-7);
  const summary = o.limit === 'demand'
    ? 'Not enough guests want in to fill the room: price, quality, reputation and (soon) promotions bring more.'
    : o.limit === 'capacity'
      ? 'More guests want in than you can serve: fix the limit below, or raise prices, since the queue at the door costs you little.'
      : 'One service is full and the other has room: the levers help the quiet one; the full one needs capacity.';
  const fixes = [...new Set([o.lunch, o.dinner].filter((c) => c.demand >= c.capacity * 0.95 && c.bottleneck !== 'none').map((c) => LIMIT_FIX[c.bottleneck]))];
  // One capacity view (cleanup sprint 5): the verdict first, then the services, then station mismatches and levers.
  const last = recent.at(-1);
  const issues = stationIssues(state, analyse(state), last);
  const verdict = o.limit === 'demand' ? 'This week the limit is demand' : o.limit === 'capacity' ? 'This week the limit is capacity' : 'This week: one service is full, the other has room';
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Demand and capacity'), h('span', { class: 'small' }, 'an average day this week')),
    h('div', null, h('b', null, `${verdict}. `), h('span', { class: 'small' }, summary)),
    serviceBar(o.lunch), serviceBar(o.dinner),
    h('div', { class: 'small muted' }, 'Dark bar: what you can serve. Filled: what you will serve. Marker: guests who want in.'),
    h('div', { class: 'small' }, limitText(o.lunch)),
    h('div', { class: 'small' }, limitText(o.dinner)),
    ...fixes.map((f) => h('div', { class: 'small warn' }, `Fix: ${f}`)),
    issues.length
      ? h('div', { class: 'stack', style: 'gap:4px' }, h('b', { class: 'small' }, `Stations: ${issues.length} to look at`),
        ...issues.map((i) => h('div', { class: 'issue' }, h('div', { class: 'small' }, `⚠ ${i.text}`), h('div', { class: 'small muted' }, i.fix))))
      : h('div', { class: 'small good' }, 'Stations: every station has the people it needs, and every person has a station.'),
    recent.length ? h('details', { class: 'small' }, h('summary', null, `The last ${recent.length} days`),
      h('div', { class: 'kv' }, ...recent.flatMap((r) => {
        const c = capacityOf(r);
        const cell = (x: ServiceCapacity): string => `${Math.round(x.served)}/${Math.round(x.capacity)}${x.bottleneck !== 'none' ? ` (${LIMIT_NAMES[x.bottleneck]})` : ''}`;
        return [h('span', null, `Day ${r.day}`), h('b', null, `L ${cell(c.lunch)} · D ${cell(c.dinner)}`)];
      }))) : null,
    h('b', { class: 'small' }, 'What moves the needle most right now'),
    ...lv.map((l) => h('div', { class: 'line' },
      h('div', null, h('b', null, l.label), h('div', { class: 'small muted' }, l.note)),
      h('div', { class: 'small', style: 'text-align:right' }, `${signed(l.guests, 0)} guests/day`, h('br'), h('b', { class: l.profit >= 0 ? 'good' : 'bad' }, `${signed(l.profit)} $/day`)))),
    h('div', { class: 'small muted' }, 'Measured on your restaurant with the real day model. Promotions arrive with marketing campaigns.'));
}

/** One line per service for the day report. */
export function dayCapacityLine(r: DayReport): HTMLElement | null {
  if (!r.open) return null;
  const c = capacityOf(r);
  const part = (x: ServiceCapacity): string =>
    `${x.service === 'lunch' ? 'Lunch' : 'Dinner'} ${Math.round(x.served)} of ${Math.round(x.capacity)} possible${x.demand > x.capacity * 1.02 ? `, limit: ${LIMIT_NAMES[x.bottleneck === 'none' ? 'seats' : x.bottleneck]}` : ''}`;
  return h('div', { class: 'small muted' }, `${part(c.lunch)} · ${part(c.dinner)}.`);
}

/** Week report: capacity use, what limited services, guests lost, station warnings and advice (kitchen-bottlenecks.md). */
export function weekKitchenCard(reports: readonly DayReport[], state: GameState): HTMLElement | null {
  const w = weekKitchen(reports);
  if (!w.services) return null;
  const limits = Object.entries(w.limits).filter(([k]) => k !== 'none').sort((a, b) => b[1] - a[1]);
  const last = [...reports].reverse().find((r) => r.open);
  const issues = stationIssues(state, analyse(state), last);
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Kitchen and capacity'), h('span', { class: 'small' }, 'this week')),
    h('div', { class: 'kv' },
      h('span', null, 'Lunch capacity used'), h('b', null, `${Math.round(w.use.lunch * 100)}%`),
      h('span', null, 'Dinner capacity used'), h('b', null, `${Math.round(w.use.dinner * 100)}%`),
      h('span', null, 'Guests turned away'), h('b', { class: w.turnedAway > 5 ? 'warn' : '' }, String(Math.round(w.turnedAway))),
      ...limits.flatMap(([k, n]) => [h('span', null, `Limited by ${LIMIT_NAMES[k as ServiceReport['bottleneck']]}`), h('b', null, `${n} of ${w.services} services`)])),
    ...issues.slice(0, 3).map((i) => h('div', { class: 'small warn' }, `⚠ ${i.text}`)));
}

