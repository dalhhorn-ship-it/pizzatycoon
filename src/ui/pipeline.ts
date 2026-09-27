// Service pipeline strip (kitchen-builder.md 6): the pizza line as stages in covers per hour.

import type { Service } from '../data/types';
import { analyse } from '../sim/analysis';
import { simulateDay } from '../sim/day';
import type { GameState, ServiceReport } from '../sim/state';
import { h } from './dom';

type StageId = keyof ServiceReport['stages'];

const STAGES: { id: StageId; name: string; icon: string; tip: string }[] = [
  { id: 'prep', name: 'Prep and stove', icon: '🫓', tip: 'Add a prep station or sheeter, bring stations closer to an oven, or trim a crowded menu.' },
  { id: 'oven', name: 'Oven', icon: '🔥', tip: 'Add or upgrade an oven, or offer primi and secondi that skip it.' },
  { id: 'seats', name: 'Tables and serving', icon: '🍽', tip: 'Add tables or a host, or a heat lamp pass.' },
  { id: 'plates', name: 'Dishwashing', icon: '🫧', tip: 'A dishwasher with room at the sink, a Double Sink or Dish Machine, Plate Shelving, or a sink nearer the pass.' },
  { id: 'cold', name: 'Dough in the fridges', icon: '🧊', tip: 'A Reach in Fridge or a Walk in Cooler holds dough for more pizzas a day.' },
];

const stage = (r: ServiceReport | undefined, id: StageId): number => r?.stages[id] ?? 0;

/** Capacity now (after any changes) and demand from the last service. */
export function pipelineData(state: GameState): { now: ServiceReport[]; last: ServiceReport[] | null } {
  const a = analyse(state);
  const now = simulateDay(state, a, { noise: false }).services;
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
  const max = Math.max(1, ...now.flatMap((r) => STAGES.map((st) => Math.min(stage(r, st.id), 400))), ...(last ?? []).map((r) => r.demandPerHour));
  // The bottleneck is the slowest stage at dinner, the busiest service.
  const dinner = by('dinner');
  const worst = dinner ? STAGES.reduce((a, b) => (stage(dinner, b.id) < stage(dinner, a.id) ? b : a)) : null;
  return h('div', { class: 'pipeline' },
    ...STAGES.map((st, i) => {
      const isWorst = worst?.id === st.id;
      const bar = (sv: Service): HTMLElement => {
        const cap = stage(by(sv), st.id);
        const demand = lastBy(sv)?.demandPerHour;
        return h('div', { class: 'pbar' },
          h('span', { class: 'plabel' }, sv === 'lunch' ? 'L' : 'D'),
          h('div', { class: 'ptrack' },
            h('div', { class: 'pfill', style: `width:${Math.min(100, (cap / max) * 100)}%` }),
            demand !== undefined ? h('div', { class: 'pdemand', title: `Last ${sv}: ${demand.toFixed(0)} guests per hour wanted in`, style: `left:${Math.min(100, (demand / max) * 100)}%` }) : null),
          h('b', null, cap.toFixed(0)));
      };
      return h('button', { class: `pstage ${isWorst ? 'worst' : ''}`, onclick: () => onStage?.(st.id) },
        h('div', { class: 'phead' }, h('span', null, `${st.icon} ${st.name}`), i < STAGES.length - 1 ? h('span', { class: 'parrow' }, '→') : null),
        bar('lunch'), bar('dinner'),
        isWorst ? h('div', { class: 'ptip' }, `Bottleneck. ${st.tip}`) : null);
    }),
    h('div', { class: 'plegend small muted' }, 'Guests per hour each stage can handle. The marker shows how many wanted in at the last service.'));
}
