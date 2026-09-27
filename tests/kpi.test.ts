// Business review (src/sim/kpi.ts): weekly rows, adding up, and the review.

import { describe, expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { addUp, buildReview, change, KPIS, weekKpi } from '../src/sim/kpi';
import { deserialise } from '../src/save/saveFile';
import type { GameState } from '../src/sim/state';
import saveV6 from './fixtures/save-v6.json?raw';

const run = (s: GameState, days: number): GameState => {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }).state;
  return s;
};
const def = (id: string) => KPIS.find((k) => k.id === id) as (typeof KPIS)[number];

describe('weekly KPI rows', () => {
  test('a row is added every Sunday night, and at most 13 are kept', () => {
    let s = run(withStarterKit(newGame(3, 'canal', 'cosy')), 6);
    expect(s.kpis).toHaveLength(0);
    s = run(s, 1);
    expect(s.kpis).toHaveLength(1);
    expect(s.kpis[0]?.week).toBe(1);
    expect(s.kpis[0]?.days).toBe(7);
    s = run(s, 7 * 14);
    expect(s.kpis).toHaveLength(T.history.kpiWeeks);
    expect(s.kpis.at(-1)?.week).toBe(15);
  });

  test('a row adds up the week: sales, profit and guests match the day reports', () => {
    const s = run(withStarterKit(newGame(3, 'canal', 'cosy')), 14);
    const week2 = s.history.filter((r) => r.day >= 8 && r.day <= 14);
    const k = s.kpis.find((x) => x.week === 2);
    expect(k?.profit).toBeCloseTo(week2.reduce((a, r) => a + r.pnl.profit, 0), 6);
    expect(k?.covers).toBeCloseTo(week2.reduce((a, r) => a + r.covers, 0), 6);
    expect(def('sales').value(k!)).toBeCloseTo(week2.reduce((a, r) => a + r.pnl.sales + (r.pnl.deliverySales ?? 0), 0), 6);
  });

  test('ratios are derived after adding, never averaged', () => {
    const a = weekKpi(1, 1, [], { rep: 50, following: 0.5, drep: null, staff: [], departures: 0, rivalGuests: 0 });
    const b = { ...a };
    a.diningSales = 1000;
    a.food = 400;
    a.covers = 50;
    b.diningSales = 3000;
    b.food = 600;
    b.covers = 150;
    const both = addUp([a, b]);
    // 40% and 20% average to 30%, but together it is 1,000 / 4,000 = 25%.
    expect(def('foodCost').value(both)).toBeCloseTo(0.25, 9);
    expect(def('check').value(both)).toBeCloseTo(20, 9);
  });

  test('changes are relative for money and in points for shares', () => {
    expect(change(def('sales'), 1000, 1100)).toBeCloseTo(0.1, 9);
    expect(change(def('foodCost'), 0.3, 0.32)).toBeCloseTo(0.02, 9);
    expect(change(def('sales'), 0, 100)).toBeNull();
  });
});

describe('the business review', () => {
  test('covers the chosen weeks for every restaurant together and each one alone', () => {
    let s = withStarterKit(newGame(4, 'canal', 'cosy'));
    s = run(s, 7 * 8);
    const all = buildReview(s, { location: 'all', weeks: 6 }, () => 'x');
    expect(all.weeks).toEqual([3, 4, 5, 6, 7, 8]);
    const sales = all.lines.find((l) => l.def.id === 'sales');
    expect(sales?.series).toHaveLength(6);
    expect(sales?.wow).not.toBeNull();
    expect(all.byRestaurant).toHaveLength(1);
  });

  test('an old save gets its review rows back from the reports it already had', () => {
    const s = deserialise(saveV6).state;
    expect(s.kpis.length).toBeGreaterThan(0);
    expect(s.branches[0]?.kpis).toBeDefined();
    const r = buildReview(s, { location: 'all', weeks: 12 }, () => 'x');
    expect(r.lines.find((l) => l.def.id === 'profit')?.last).not.toBeNull();
  });

  test('two restaurants add up to the portfolio', () => {
    const s = run(deserialise(saveV6).state, 14);
    const ids = [s.locationId, ...s.branches.map((b) => b.id)];
    const week = s.kpis.at(-1)?.week ?? 0;
    const all = buildReview(s, { location: 'all', weeks: 1 }, () => 'x').lines.find((l) => l.def.id === 'profit')?.last ?? 0;
    const parts = ids.map((id) => buildReview(s, { location: id, weeks: 1 }, () => 'x').lines.find((l) => l.def.id === 'profit')?.last ?? 0);
    expect(week).toBeGreaterThan(0);
    // The fixture's second restaurant has an empty menu: the review says so.
    const review = buildReview(s, { location: 'all', weeks: 2 }, (id) => `R${id}`);
    expect(review.callouts.some((c) => /closed all week/.test(c.text))).toBe(true);
    expect(all).toBeCloseTo(parts.reduce((a, b) => a + b, 0), 6);
  });
});
