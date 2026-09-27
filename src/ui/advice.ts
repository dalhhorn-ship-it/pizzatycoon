// One advice voice (cleanup sprint 5, P1): every suggestion the game has, from the kitchen, the Squad, the market coach
// and the day's advisor, ranked by what it is worth a week. The week report shows the top three.

import type { Service } from '../data/types';
import { analyse } from '../sim/analysis';
import { stationIssues, weekKitchen } from '../sim/capacity';
import { type Answer, coach } from '../sim/market';
import type { DayReport, GameState, ServiceReport } from '../sim/state';
import { LIMIT_FIX, LIMIT_NAMES } from './capacity';
import { h, signedMoney } from './dom';
import type { PanelCtx } from './panels';
import { doIt, type Nav, previewFor } from './rivals';
import { staffAdvice } from './squad';

export interface Advice {
  source: 'Kitchen' | 'Room' | 'Squad' | 'Market' | 'Advisor';
  /** Suggestions with the same key are the same move; only the most valuable is kept. */
  key?: string;
  text: string;
  /** Rough dollars a week at stake, for ranking. */
  perWeek: number;
  /** What the button does. */
  act?: { label: string; run: () => void };
}

/** Every suggestion for this week, most valuable first. */
export function allAdvice(reports: readonly DayReport[], state: GameState, ctx: PanelCtx, nav: Nav, teamValue: Map<number, number>): Advice[] {
  const out: Advice[] = [];
  const open = reports.filter((r) => r.open);
  const sales = open.reduce((a, r) => a + r.pnl.sales + (r.pnl.deliverySales ?? 0), 0);
  const covers = open.reduce((a, r) => a + r.covers, 0);
  const check = covers > 0 ? open.reduce((a, r) => a + r.pnl.sales, 0) / covers : 0;
  // Margin on an extra guest: the check less food and waste.
  const margin = check * Math.max(0.3, 1 - (open.reduce((a, r) => a + r.pnl.ingredients + r.pnl.waste, 0) / Math.max(1, sales)));

  // Kitchen: the stage that turned guests away, and station mismatches.
  const w = weekKitchen(reports);
  const top = Object.entries(w.limits).filter(([k]) => k !== 'none').sort((a, b) => b[1] - a[1])[0];
  if (top && w.turnedAway > 5) {
    const k = top[0] as ServiceReport['bottleneck'];
    const name = LIMIT_NAMES[k];
    out.push({ source: k === 'seats' ? 'Room' : 'Kitchen', text: `${name.charAt(0).toUpperCase()}${name.slice(1)} held back ${top[1]} of ${w.services} services and ${Math.round(w.turnedAway)} guests were turned away. ${LIMIT_FIX[k]}`, perWeek: w.turnedAway * margin * 0.5, act: { label: k === 'seats' ? 'Room' : 'Kitchen', run: () => nav.tab(k === 'seats' ? 'room' : 'kitchen') } });
  }
  const last = [...reports].reverse().find((r) => r.open);
  for (const i of stationIssues(state, analyse(state), last).slice(0, 2)) {
    out.push({ source: 'Kitchen', text: `${i.text} ${i.fix}`, perWeek: i.severity * sales * 0.3, act: { label: 'Kitchen', run: () => nav.tab('kitchen') } });
  }
  const low = (['lunch', 'dinner'] as Service[]).filter((sv) => w.services && w.use[sv] < 0.6);
  if (low.length) out.push({ source: 'Advisor', text: `${low.map((sv) => (sv === 'lunch' ? 'Lunch' : 'Dinner')).join(' and ')} used under 60% of capacity: that is a demand question (price, quality, marketing), not a kitchen one.`, perWeek: sales * 0.03 });

  // The Squad: a course that pays back, or a replacement.
  const staff = staffAdvice(state, teamValue);
  if (staff) out.push({ source: 'Squad', text: staff.text, perWeek: staff.perWeek, act: { label: 'Squad', run: () => nav.tab('staff') } });

  // The market coach: the recommended answer of each situation, with its measured estimate.
  for (const sit of coach(state)) {
    const answers = sit.answers.map((a) => ({ a, gain: previewFor(state, a) }));
    const best: { a: Answer; gain: number | null } | undefined = answers.filter((x) => x.gain !== null && x.gain > 0).sort((x, y) => (y.gain ?? 0) - (x.gain ?? 0))[0] ?? answers[0];
    if (!best || best.a.action.kind === 'hold') continue;
    out.push({
      source: 'Market', text: `${sit.diagnosis} ${best.a.text}.`, perWeek: best.gain ?? sit.stake,
      key: best.a.action.kind === 'price' ? `price:${best.a.action.mult}` : best.a.action.kind === 'campaign' ? `campaign:${best.a.action.id}` : undefined,
      act: { label: 'Do it', run: () => doIt(ctx, nav, best.a) },
    });
  }

  // The advisor's day tips fill the list when nothing bigger is on.
  for (const t of last?.tips ?? []) if (!out.some((o) => o.text.includes(t.slice(0, 30)))) out.push({ source: 'Advisor', text: t, perWeek: 1 });
  const seen = new Set<string>();
  return out.sort((a, b) => b.perWeek - a.perWeek).filter((a) => !a.key || (!seen.has(a.key) && !!seen.add(a.key)));
}

/** The week report's single advice card: the three suggestions worth most. */
export function topAdviceCard(reports: readonly DayReport[], state: GameState, ctx: PanelCtx, nav: Nav, teamValue: Map<number, number>): HTMLElement | null {
  const list = allAdvice(reports, state, ctx, nav, teamValue).slice(0, 3);
  if (!list.length) return null;
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Top 3 this week'), h('span', { class: 'small' }, 'ranked by $ a week')),
    ...list.map((a, i) => h('div', { class: 'line advice' },
      h('div', null,
        h('div', { class: 'small' }, h('b', null, `${i + 1}. `), a.text),
        h('div', { class: 'small muted' }, `${a.source}${a.perWeek > 5 ? ` · about ${signedMoney(a.perWeek)} a week at stake` : ''}`)),
      a.act ? h('button', { class: 'small', onclick: () => a.act?.run() }, a.act.label) : null)));
}
