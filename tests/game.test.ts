import { describe, expect, test } from 'vitest';
import { apply, newGame } from '../src/sim/game';
import { Rng } from '../src/sim/rng';
import type { GameState } from '../src/sim/state';

const run = (s: GameState, days: number): GameState => {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }).state;
  return s;
};

describe('game commands', () => {
  test('new game is playable and profitable in the Canal Quarter', () => {
    const s = run(newGame(42, 'canal'), 14);
    const profit = s.history.reduce((a, d) => a + d.pnl.profit, 0);
    expect(profit).toBeGreaterThan(0);
    expect(s.day).toBe(15);
    expect(s.rep).toBeGreaterThan(30);
  });

  test('same seed and commands give the same result (determinism)', () => {
    const a = run(newGame(7, 'university'), 10);
    const b = run(newGame(7, 'university'), 10);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('commands never mutate their input', () => {
    const s = newGame(1, 'canal');
    const before = JSON.stringify(s);
    apply(s, { type: 'runDay' });
    apply(s, { type: 'setPrice', recipeId: 'margherita', price: 20 });
    expect(JSON.stringify(s)).toBe(before);
  });

  test('tiers change cost and quality; supplier follows the tier', () => {
    const s = newGame(1, 'canal');
    const r = apply(s, { type: 'setTier', recipeId: 'margherita', ingredientId: 'mozzarella', tier: 'artisan' });
    expect(r.error).toBeUndefined();
    const line = r.state.recipes.find((x) => x.id === 'margherita')!.lines.find((l) => l.ingredientId === 'mozzarella')!;
    expect(line.tier).toBe('artisan');
    expect(line.supplierId).toBe('greenValley');
  });

  test('furniture placement rejects overlaps and out of bounds, refunds 80%', () => {
    const s = newGame(1, 'canal');
    expect(apply(s, { type: 'placeFurniture', itemId: 'table2', x: 1, y: 1 }).error).toBeTruthy();
    expect(apply(s, { type: 'placeFurniture', itemId: 'table4', x: 9, y: 2 }).error).toBeTruthy();
    const placed = apply(s, { type: 'placeFurniture', itemId: 'plant', x: 3, y: 5 });
    expect(placed.error).toBeUndefined();
    expect(placed.state.cash).toBe(s.cash - 150);
    const uid = placed.state.furniture.at(-1)!.uid;
    expect(apply(placed.state, { type: 'removeFurniture', uid }).state.cash).toBe(s.cash - 30);
  });

  test('locked equipment cannot be bought until unlocked', () => {
    const s = newGame(1, 'canal');
    s.cash = 100000;
    expect(apply(s, { type: 'buyEquipment', itemId: 'stoneHearthOven' }).error).toMatch(/Locked/);
    s.rep = 45;
    expect(apply(s, { type: 'buyEquipment', itemId: 'stoneHearthOven' }).error).toBeUndefined();
  });

  test('closed without staff, costs still accrue, no crash', () => {
    const s = newGame(1, 'canal');
    s.staff = [];
    const r = apply(s, { type: 'runDay' });
    const report = r.events[0]?.report;
    expect(report?.open).toBe(false);
    expect(report?.pnl.profit).toBeLessThan(0);
  });

  test('weekly payments happen on Sunday and hiring board refreshes', () => {
    const s = run(newGame(3, 'canal'), 6);
    const r = apply(s, { type: 'runDay' });
    expect(r.events[0]?.report?.weekday).toBe(6);
    expect(r.events[0]?.report?.weeklyPayments).toBeGreaterThan(3000);
    expect(r.state.candidates.map((c) => c.id)).not.toEqual(s.candidates.map((c) => c.id));
  });

  test('safety net: loan payments pause after 7 days below zero, never a game over', () => {
    let s = apply(newGame(5, 'harbour', 'large'), { type: 'takeLoan', amount: 30000 }).state;
    s.cash = -5000;
    s.recipes.forEach((r) => (r.price = r.kind === 'pizza' ? 50 : r.price));
    let restructured = false;
    for (let i = 0; i < 10; i++) {
      const r = apply(s, { type: 'runDay' });
      if (r.events.some((e) => e.kind === 'restructure')) restructured = true;
      s = r.state;
    }
    expect(restructured).toBe(true);
    expect(s.loan.pausedWeeks).toBeGreaterThan(0);
  });

  test('long run property: no NaN, cash and rep stay finite over a season in every district', () => {
    for (const d of ['university', 'canal', 'harbour']) {
      const s = run(newGame(11, d), 60);
      expect(Number.isFinite(s.cash)).toBe(true);
      expect(s.rep).toBeGreaterThanOrEqual(0);
      expect(s.rep).toBeLessThanOrEqual(100);
      for (const h of s.history) expect(Number.isFinite(h.pnl.profit)).toBe(true);
    }
  });
});

describe('rng', () => {
  test('streams are independent and reproducible', () => {
    const a = Rng.stream(1, 5, 'day');
    const b = Rng.stream(1, 5, 'day');
    const c = Rng.stream(1, 5, 'hiring');
    const xa = [a.next(), a.next()];
    expect([b.next(), b.next()]).toEqual(xa);
    expect(c.next()).not.toBe(xa[0]);
  });
});
