// A second restaurant under a restaurant manager (prd.md 5.9, 5.12).
import { describe, expect, test } from 'vitest';
import { staffFromSkill } from '../src/sim/staff';
import { managerEffect } from '../src/sim/chain';
import { apply, newGameAt, withStarterKit } from '../src/sim/game';
import { deserialise, serialise } from '../src/save/saveFile';
import type { GameState, Staff } from '../src/sim/state';

const manager = (id: number, skill: number): Staff => staffFromSkill(id, `Manager ${skill}`, 'manager', skill, { morale: 60 });

/** An established starter restaurant at a real venue, with money in the bank. */
function established(): GameState {
  const s = withStarterKit(newGameAt(5, 'towpathKiosk'));
  s.cash = 50000;
  s.rep = 60;
  s.day = 4;
  return s;
}

const other = 'campusGate';

describe('restaurant manager', () => {
  test('a manager is always on the hiring board, from day 1', () => {
    let t = newGameAt(5, 'towpathKiosk');
    expect(t.candidates.some((c) => c.role === 'manager')).toBe(true);
    for (let i = 0; i < 7; i++) t = apply(t, { type: 'runDay' }).state;
    const m = t.candidates.find((c) => c.role === 'manager');
    expect(m).toBeDefined();
    expect(m!.salary).toBeGreaterThan(700);
  });

  test('skill 5 runs a restaurant as well as the player; better managers do better', () => {
    expect(managerEffect(manager(1, 5)).demand).toBeCloseTo(1, 10);
    expect(managerEffect(manager(1, 5)).waste).toBeCloseTo(1, 10);
    expect(managerEffect(manager(1, 9)).demand).toBeGreaterThan(managerEffect(manager(1, 3)).demand);
    expect(managerEffect(manager(1, 9)).waste).toBeLessThan(managerEffect(manager(1, 3)).waste);
    expect(managerEffect(undefined).demand).toBeLessThan(managerEffect(manager(1, 1)).demand);
  });
});

describe('opening another restaurant', () => {
  test('needs a manager for the current restaurant first', () => {
    const r = apply(established(), { type: 'openRestaurant', venueId: other });
    expect(r.error).toMatch(/manager/);
  });

  test('the old restaurant carries on under its manager; the new one starts empty', () => {
    const s = established();
    s.staff.push(manager(900, 6));
    const cash = s.cash;
    const r = apply(s, { type: 'openRestaurant', venueId: other });
    expect(r.error).toBeUndefined();
    const t = r.state;
    expect(t.venueId).toBe(other);
    expect(t.staff).toEqual([]);
    expect(t.equipment).toEqual([]);
    expect(t.cash).toBeLessThan(cash);
    expect(t.branches).toHaveLength(1);
    expect(t.branches[0]!.venueId).toBe('towpathKiosk');
    expect(t.branches[0]!.staff.some((x) => x.role === 'manager')).toBe(true);
    // Its own, empty menu; the recipe book comes along, the old restaurant keeps its menu.
    expect(t.recipes.filter((x) => x.onMenu)).toHaveLength(0);
    expect(t.recipes).toHaveLength(s.recipes.length);
    expect(t.branches[0]!.recipes.filter((x) => x.onMenu).length).toBeGreaterThan(0);
  });

  test('you cannot open or move into a venue you already run', () => {
    const s = established();
    s.staff.push(manager(900, 6));
    const t = apply(s, { type: 'openRestaurant', venueId: other }).state;
    t.staff.push(manager(901, 6));
    expect(apply(t, { type: 'openRestaurant', venueId: 'towpathKiosk' }).error).toMatch(/already/);
    expect(apply(t, { type: 'rentVenue', venueId: 'towpathKiosk' }).error).toMatch(/already/);
  });

  test('the managed restaurant keeps serving guests and earning into the shared cash', () => {
    const s = established();
    s.staff.push(manager(900, 6));
    let t = apply(s, { type: 'openRestaurant', venueId: other }).state;
    const cash = t.cash;
    const r = apply(t, { type: 'runDay' });
    t = r.state;
    const report = r.events.find((e) => e.kind === 'dayCompleted')?.report;
    const branch = report?.branches?.[0];
    expect(branch?.open).toBe(true);
    expect(branch?.covers).toBeGreaterThan(20);
    expect(branch?.manager).toBe('Manager 6');
    // The new place is closed (nothing set up), so all income today comes from the managed one.
    expect(report?.open).toBe(false);
    expect(t.cash - cash).toBeCloseTo((branch?.profit ?? 0) + (report?.pnl.profit ?? 0) + (report?.pnl.staff ?? 0) + (report?.pnl.rent ?? 0) + (report?.pnl.interest ?? 0) - (report?.weeklyPayments ?? 0) + branchBillsBack(t, report), 0);
    expect(t.branches[0]!.daysOpen).toBe(s.daysOpen + 1);
  });

  test('a better manager serves more guests and runs a tighter kitchen (before their higher wage)', () => {
    const run = (skill: number): { covers: number; gross: number; waste: number } => {
      const s = established();
      s.staff.push(manager(900, skill));
      let t = apply(s, { type: 'openRestaurant', venueId: other }).state;
      // Still building its following, so extra guests find a free table.
      t.branches[0]!.rep = 35;
      t.branches[0]!.following = 0.4;
      for (let i = 0; i < 7; i++) t = apply(t, { type: 'runDay' }, { noise: false }).state;
      const week = t.branches[0]!.history.slice(-7);
      return {
        covers: week.reduce((x, d) => x + d.covers, 0),
        gross: week.reduce((x, d) => x + d.pnl.sales - d.pnl.ingredients - d.pnl.waste, 0),
        waste: week.reduce((x, d) => x + d.pnl.waste, 0) / week.reduce((x, d) => x + d.pnl.sales, 0),
      };
    };
    const weak = run(2);
    const strong = run(9);
    expect(strong.covers).toBeGreaterThan(weak.covers);
    expect(strong.gross).toBeGreaterThan(weak.gross);
    expect(strong.waste).toBeLessThan(weak.waste);
  });
});

/** Branch profit counts staff and rent daily; cash pays them on Sunday. Add back what was not paid today. */
function branchBillsBack(t: GameState, report: { weekday: number } | undefined): number {
  if (!report || report.weekday === 6) return 0;
  const b = t.branches[0]!;
  const last = b.history.at(-1)!;
  return last.pnl.staff + last.pnl.rent + last.pnl.interest;
}

describe('switching restaurants', () => {
  test('go back and run the old one; the one you leave needs a manager', () => {
    const s = established();
    s.staff.push(manager(900, 6));
    const t = apply(s, { type: 'openRestaurant', venueId: other }).state;
    const oldId = t.branches[0]!.id;
    expect(apply(t, { type: 'switchRestaurant', locationId: oldId }).error).toMatch(/manager/);
    t.staff.push(manager(901, 4));
    const r = apply(t, { type: 'switchRestaurant', locationId: oldId });
    expect(r.error).toBeUndefined();
    expect(r.state.venueId).toBe('towpathKiosk');
    expect(r.state.branches[0]!.venueId).toBe(other);
    expect(r.state.branches[0]!.staff.some((x) => x.role === 'manager')).toBe(true);
  });

  test('restaurants survive a save and load; older saves have one restaurant', () => {
    const s = established();
    s.staff.push(manager(900, 6));
    const t = apply(s, { type: 'openRestaurant', venueId: other }).state;
    expect(deserialise(serialise(t, 0)).state.branches).toHaveLength(1);
    const old = structuredClone(s) as unknown as Record<string, unknown>;
    delete old.branches;
    delete old.locationId;
    const loaded = deserialise(serialise(old as never, 0)).state;
    expect(loaded.branches).toEqual([]);
    expect(loaded.locationId).toBe(1);
  });
});

test('fast forward keeps going while the new restaurant is being set up', () => {
  const s = established();
  s.staff.push(manager(900, 6));
  const t = apply(s, { type: 'openRestaurant', venueId: other }).state;
  const ev = apply(t, { type: 'runWeek' }).events.find((e) => e.kind === 'weekCompleted');
  expect(ev?.reports).toHaveLength(7);
  expect(ev?.reports?.every((r) => (r.branches?.[0]?.covers ?? 0) > 0)).toBe(true);
});

test('opening another restaurant needs reputation 50 at a restaurant you run', () => {
  const s = established();
  s.staff.push(manager(900, 6));
  s.rep = 45;
  expect(apply(s, { type: 'openRestaurant', venueId: other }).error).toMatch(/reputation 50/);
  s.rep = 50;
  const t = apply(s, { type: 'openRestaurant', venueId: other });
  expect(t.error).toBeUndefined();
  // The new place starts at 30, but the first restaurant still counts for a third one.
  t.state.staff.push(manager(901, 5));
  expect(apply(t.state, { type: 'openRestaurant', venueId: 'marketHall' }).error).toBeUndefined();
});

test('each restaurant has its own menu: changing one leaves the other alone', () => {
  const s = established();
  s.staff.push(manager(900, 6));
  let t = apply(s, { type: 'openRestaurant', venueId: other }).state;
  const oldMenu = t.branches[0]!.recipes.filter((x) => x.onMenu).map((x) => x.id);
  expect(apply(t, { type: 'toggleMenu', recipeId: 'margherita', on: true }).error).toBeUndefined();
  t = apply(t, { type: 'toggleMenu', recipeId: 'margherita', on: true }).state;
  t = apply(t, { type: 'toggleMenu', recipeId: 'diavola', on: true }).state;
  t = apply(t, { type: 'setPrice', recipeId: 'margherita', price: 20 }).state;
  expect(t.recipes.filter((x) => x.onMenu).map((x) => x.id).sort()).toEqual(['diavola', 'margherita']);
  expect(t.branches[0]!.recipes.filter((x) => x.onMenu).map((x) => x.id)).toEqual(oldMenu);
  expect(t.branches[0]!.recipes.find((x) => x.id === 'margherita')?.price).not.toBe(20);
  // Switching back brings the old restaurant's own menu.
  t.staff.push(manager(901, 5));
  const back = apply(t, { type: 'switchRestaurant', locationId: t.branches[0]!.id }).state;
  expect(back.recipes.filter((x) => x.onMenu).map((x) => x.id)).toEqual(oldMenu);
});
