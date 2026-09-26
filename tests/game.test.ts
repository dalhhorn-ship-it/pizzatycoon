import { describe, expect, test } from 'vitest';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { Rng } from '../src/sim/rng';
import type { GameState } from '../src/sim/state';

const run = (s: GameState, days: number): GameState => {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }).state;
  return s;
};

describe('game commands', () => {
  test('new game is playable and profitable in the Canal Quarter', () => {
    const s = run(withStarterKit(newGame(42, 'canal', 'cosy')), 14);
    const profit = s.history.reduce((a, d) => a + d.pnl.profit, 0);
    expect(profit).toBeGreaterThan(0);
    expect(s.day).toBe(15);
    expect(s.rep).toBeGreaterThan(30);
  });

  test('same seed and commands give the same result (determinism)', () => {
    const a = run(withStarterKit(newGame(7, 'university', 'cosy')), 10);
    const b = run(withStarterKit(newGame(7, 'university', 'cosy')), 10);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('commands never mutate their input', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    const before = JSON.stringify(s);
    apply(s, { type: 'runDay' });
    apply(s, { type: 'setPrice', recipeId: 'margherita', price: 20 });
    expect(JSON.stringify(s)).toBe(before);
  });

  test('tiers change cost and quality; supplier follows the tier', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    const r = apply(s, { type: 'setTier', recipeId: 'margherita', ingredientId: 'mozzarella', tier: 'artisan' });
    expect(r.error).toBeUndefined();
    const line = r.state.recipes.find((x) => x.id === 'margherita')!.lines.find((l) => l.ingredientId === 'mozzarella')!;
    expect(line.tier).toBe('artisan');
    expect(line.supplierId).toBe('greenValley');
  });

  test('furniture placement rejects overlaps and out of bounds, refunds 80%', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    expect(apply(s, { type: 'placeFurniture', itemId: 'table2', x: 1, y: 1 }).error).toBeTruthy();
    expect(apply(s, { type: 'placeFurniture', itemId: 'table4', x: 9, y: 2 }).error).toBeTruthy();
    const placed = apply(s, { type: 'placeFurniture', itemId: 'plant', x: 3, y: 5 });
    expect(placed.error).toBeUndefined();
    expect(placed.state.cash).toBe(s.cash - 150);
    const uid = placed.state.furniture.at(-1)!.uid;
    expect(apply(placed.state, { type: 'removeFurniture', uid }).state.cash).toBe(s.cash - 30);
  });

  test('locked equipment cannot be bought until unlocked', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.cash = 100000;
    expect(apply(s, { type: 'buyEquipment', itemId: 'stoneHearthOven' }).error).toMatch(/Locked/);
    s.rep = 45;
    expect(apply(s, { type: 'buyEquipment', itemId: 'stoneHearthOven' }).error).toBeUndefined();
  });

  test('closed without staff, costs still accrue, no crash', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.staff = [];
    const r = apply(s, { type: 'runDay' });
    const report = r.events[0]?.report;
    expect(report?.open).toBe(false);
    expect(report?.pnl.profit).toBeLessThan(0);
  });

  test('weekly payments happen on Sunday and hiring board refreshes', () => {
    const s = run(withStarterKit(newGame(3, 'canal', 'cosy')), 6);
    const r = apply(s, { type: 'runDay' });
    expect(r.events[0]?.report?.weekday).toBe(6);
    expect(r.events[0]?.report?.weeklyPayments).toBeGreaterThan(3000);
    expect(r.state.candidates.map((c) => c.id)).not.toEqual(s.candidates.map((c) => c.id));
  });

  test('safety net: loan payments pause after 7 days below zero, never a game over', () => {
    let s = apply(withStarterKit(newGame(5, 'harbour', 'large')), { type: 'takeLoan', amount: 30000 }).state;
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

describe('fast forward a week', () => {
  test('runs 7 days and ends exactly where 7 single days end', () => {
    const s = withStarterKit(newGame(42, 'canal', 'cosy'));
    const week = apply(s, { type: 'runWeek' });
    const ev = week.events.find((e) => e.kind === 'weekCompleted');
    expect(ev?.reports?.length).toBe(7);
    expect(ev?.stoppedBecause).toBeNull();
    expect(JSON.stringify(week.state)).toBe(JSON.stringify(run(s, 7)));
  });

  test('stops early when the restaurant cannot open', () => {
    const s = withStarterKit(newGame(42, 'canal', 'cosy'));
    s.staff = s.staff.filter((x) => x.role !== 'server');
    const ev = apply(s, { type: 'runWeek' }).events.find((e) => e.kind === 'weekCompleted');
    expect(ev?.reports?.length).toBe(1);
    expect(ev?.stoppedBecause).toMatch(/server/);
  });

  test('stops early when someone hands in notice', () => {
    const s = withStarterKit(newGame(42, 'canal', 'cosy'));
    const cook = s.staff.find((x) => x.role === 'cook')!;
    cook.traits = [];
    cook.morale = 0;
    cook.lowMoraleDays = 6;
    const ev = apply(s, { type: 'runWeek' }).events.find((e) => e.kind === 'weekCompleted');
    expect(ev?.reports?.length).toBe(1);
    expect(ev?.stoppedBecause).toMatch(/notice/);
  });
});

describe('hiring board', () => {
  const ROLES = ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager'];

  test('every weekly board offers every role', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = newGame(seed, 'canal', 'hole');
      for (let week = 0; week < 4; week++) {
        for (const role of ROLES) expect(s.candidates.some((c) => c.role === role), `seed ${seed} week ${week} ${role}`).toBe(true);
        for (let d = 0; d < 7; d++) s = apply(s, { type: 'runDay' }).state;
      }
    }
  });

  test('hiring the last candidate of a role brings a new one straight away', () => {
    let s = newGame(3, 'canal', 'hole');
    s.cash = 100000;
    for (const role of ROLES) {
      for (let i = 0; i < 4; i++) {
        const c = s.candidates.find((x) => x.role === role)!;
        s = apply(s, { type: 'hire', candidateId: c.id }).state;
        expect(s.candidates.some((x) => x.role === role)).toBe(true);
      }
    }
    const ids = [...s.candidates, ...s.staff].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

test('a save from before the rule gets every role on its board when it loads', async () => {
  const { deserialise, serialise } = await import('../src/save/saveFile');
  const s = newGame(3, 'canal', 'hole');
  s.candidates = s.candidates.filter((c) => c.role === 'cook');
  const loaded = deserialise(serialise(s, 0)).state;
  for (const role of ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager']) expect(loaded.candidates.some((c) => c.role === role)).toBe(true);
});
