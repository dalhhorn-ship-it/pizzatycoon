// Capacity and kitchen bottlenecks on screen (kitchen-bottlenecks.md): max guests per service, how far each day gets,
// what limits it, which levers matter, and station warnings.

import type { Service } from '../data/types';
import { analyse } from '../sim/analysis';
import { capacityOf, capacityOutlook, levers, type ServiceCapacity, stationIssues, weekKitchen } from '../sim/capacity';
import type { DayReport, GameState, ServiceReport } from '../sim/state';
import { h, signed } from './dom';

export const LIMIT_NAMES: Record<ServiceReport['bottleneck'], string> = {
  seats: 'tables and serving', oven: 'the ovens', prep: 'the prep line', plates: 'clean plates', cold: 'dough in the fridges', none: 'nothing',
};

const LIMIT_FIX: Record<ServiceReport['bottleneck'], string> = {
  seats: 'More tables, a host or a heat lamp pass.',
  oven: 'Another or a bigger oven, a cook to tend them, or primi and secondi that skip the oven.',
  prep: 'Another prep station or a sheeter, a cook, a hand wash station, or a shorter menu.',
  plates: 'A dishwasher with room at the sink, a Double Sink or Dish Machine, or Plate Shelving.',
  cold: 'A Reach in Fridge or a Walk in Cooler.',
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
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Capacity'), h('span', { class: 'small' }, 'an average day this week')),
    serviceBar(o.lunch), serviceBar(o.dinner),
    h('div', { class: 'small muted' }, 'Dark bar: what you can serve. Filled: what you will serve. Marker: guests who want in.'),
    h('div', { class: 'small' }, limitText(o.lunch)),
    h('div', { class: 'small' }, limitText(o.dinner)),
    h('div', { class: 'small' }, h('b', null, summary)),
    ...fixes.map((f) => h('div', { class: 'small warn' }, `Fix: ${f}`)),
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

/** Station warnings: where equipment and staff do not match. */
export function stationsCard(state: GameState): HTMLElement | null {
  const last = [...state.history].reverse().find((d) => d.open);
  const issues = stationIssues(state, analyse(state), last);
  if (!issues.length) return h('div', { class: 'card' }, h('h3', null, 'Stations'), h('div', { class: 'small good' }, 'Every station has the people it needs, and every person has a station.'));
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'Stations'), h('span', { class: 'small' }, `${issues.length} to look at`)),
    ...issues.map((i) => h('div', { class: 'issue' }, h('div', { class: 'small' }, `⚠ ${i.text}`), h('div', { class: 'small muted' }, i.fix))));
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
  const top = limits[0];
  const advice: string[] = [];
  if (top) advice.push(`${LIMIT_NAMES[top[0] as ServiceReport['bottleneck']]} held back ${top[1]} of ${w.services} services. ${LIMIT_FIX[top[0] as ServiceReport['bottleneck']]}`);
  if (issues[0]) advice.push(`${issues[0].text} ${issues[0].fix}`);
  const low = (['lunch', 'dinner'] as Service[]).filter((sv) => w.use[sv] < 0.7);
  if (low.length) advice.push(`${low.map((sv) => (sv === 'lunch' ? 'Lunch' : 'Dinner')).join(' and ')} used under 70% of capacity: that is a demand question (price, quality, reputation), not a kitchen one.`);
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Kitchen and capacity'), h('span', { class: 'small' }, 'this week')),
    h('div', { class: 'kv' },
      h('span', null, 'Lunch capacity used'), h('b', null, `${Math.round(w.use.lunch * 100)}%`),
      h('span', null, 'Dinner capacity used'), h('b', null, `${Math.round(w.use.dinner * 100)}%`),
      h('span', null, 'Guests turned away'), h('b', { class: w.turnedAway > 5 ? 'warn' : '' }, String(Math.round(w.turnedAway))),
      ...limits.flatMap(([k, n]) => [h('span', null, `Limited by ${LIMIT_NAMES[k as ServiceReport['bottleneck']]}`), h('b', null, `${n} of ${w.services} services`)])),
    ...issues.slice(0, 3).map((i) => h('div', { class: 'small warn' }, `⚠ ${i.text}`)),
    ...advice.slice(0, 2).map((a) => h('div', { class: 'impact' }, `💡 ${a}`)));
}

