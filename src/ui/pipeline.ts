// Service pipeline strip (kitchen-builder.md 6): the pizza line as stages in covers per hour.

import type { Service } from '../data/types';
import { forecastDay } from '../sim/forecast';
import type { GameState, ServiceReport } from '../sim/state';
import { h } from './dom';

type StageId = keyof ServiceReport['stages'];

const STAGES: { id: StageId; name: string; icon: string; tip: string }[] = [
  { id: 'prep', name: 'Prep and stove', icon: '🫓', tip: 'Add a prep station or sheeter, bring stations closer to an oven, or trim a crowded menu.' },
  { id: 'oven', name: 'Oven', icon: '🔥', tip: 'Add or upgrade an oven, or offer primi and secondi that skip it.' },
  { id: 'cooks', name: 'Cooks', icon: '👩‍🍳', tip: 'Hire another cook, or faster ones: Speed 50 serves 50 guests a service, a top cook up to 75.' },
  { id: 'seats', name: 'Tables and serving', icon: '🍽', tip: 'Add tables or a host, or a heat lamp pass.' },
  { id: 'plates', name: 'Dishwashing', icon: '🫧', tip: 'A dishwasher with room at the sink, a Double Sink or Dish Machine, Plate Shelving, or a sink nearer the pass.' },
  { id: 'cold', name: 'Dough in the fridges', icon: '🧊', tip: 'A Reach in Fridge or a Walk in Cooler holds dough for more pizzas a day.' },
];

const stage = (r: ServiceReport | undefined, id: StageId): number => r?.stages[id] ?? 0;
/** Stages delivery orders share with the dining room (competition.md 6.4); seats and plates are dining only. */
const SHARED: readonly StageId[] = ['prep', 'oven', 'cooks', 'cold'];

/** Capacity now (after any changes) and demand from the last service. */
export function pipelineData(state: GameState): { now: ServiceReport[]; last: ServiceReport[] | null } {
  const now = forecastDay(state).services;
  const lastDay = [...state.history].reverse().find((d) => d.open);
  return { now, last: lastDay?.services ?? null };
}

export function pipelineStrip(state: GameState, onStage?: (id: StageId) => void): HTMLElement {
  const { now, last } = pipelineData(state);
  if (!now.length) {
    return h('div', { class: 'pipeline empty' }, 'Your kitchen needs an oven, a prep station, a fridge, a sink, a cook and a server before the pipeline can run.');
  }
  const by = (sv: Service): ServiceReport | undefined => now.find((x) => x.service === sv);
  const lastBy = (sv: Service): ServiceReport | undefined => last?.find((x) => x.service === sv);
  const max = Math.max(1, ...now.flatMap((r) => STAGES.map((st) => Math.min(stage(r, st.id), 400))), ...(last ?? []).map((r) => r.demandPerHour + (r.deliveryPerHour ?? 0)));
  // The bottleneck is the slowest stage at dinner, the busiest service.
  const dinner = by('dinner');
  const worst = dinner ? STAGES.reduce((a, b) => (stage(dinner, b.id) < stage(dinner, a.id) ? b : a)) : null;
  return h('div', { class: 'pipeline' },
    ...STAGES.map((st, i) => {
      const isWorst = worst?.id === st.id;
      const bar = (sv: Service): HTMLElement => {
        const cap = stage(by(sv), st.id);
        const demand = lastBy(sv)?.demandPerHour;
        const dlv = SHARED.includes(st.id) ? lastBy(sv)?.deliveryPerHour ?? 0 : 0;
        const at = (x: number): number => Math.min(100, (x / max) * 100);
        const title = demand === undefined ? undefined
          : `Last ${sv}: ${demand.toFixed(0)} guests per hour wanted in${dlv >= 0.5 ? ` plus delivery worth ${dlv.toFixed(0)} guests, ${(demand + dlv).toFixed(0)} in all` : ''}`;
        return h('div', { class: 'pbar' },
          h('span', { class: 'plabel' }, sv === 'lunch' ? 'L' : 'D'),
          h('div', { class: 'ptrack', title },
            h('div', { class: 'pfill', style: `width:${at(cap)}%` }),
            demand !== undefined && dlv >= 0.5 ? h('div', { class: 'pdelivery', style: `left:${at(demand)}%;width:${at(demand + dlv) - at(demand)}%` }) : null,
            demand !== undefined ? h('div', { class: 'pdemand', style: `left:${at(demand)}%` }) : null,
            demand !== undefined && dlv >= 0.5 ? h('div', { class: 'pdemand total', style: `left:${at(demand + dlv)}%` }) : null),
          h('b', { class: demand !== undefined && demand + dlv > cap ? 'bad' : '' }, cap.toFixed(0)));
      };
      return h('button', { class: `pstage ${isWorst ? 'worst' : ''}`, onclick: () => onStage?.(st.id) },
        h('div', { class: 'phead' }, h('span', null, `${st.icon} ${st.name}`), i < STAGES.length - 1 ? h('span', { class: 'parrow' }, '→') : null),
        bar('lunch'), bar('dinner'),
        isWorst ? h('div', { class: 'ptip' }, `Bottleneck. ${st.tip}`) : null);
    }),
    h('div', { class: 'plegend small muted' }, last?.some((r) => (r.deliveryPerHour ?? 0) >= 0.5)
      ? 'Guests per hour each stage can handle. The marker shows how many wanted in at the last service; the blue band on prep, oven, cooks and dough adds the delivery orders, counted as guests.'
      : 'Guests per hour each stage can handle. The marker shows how many wanted in at the last service.'));
}
