// fresh-start.md 2, 5, 7 (AC-159 to AC-167).
import { describe, expect, test } from 'vitest';
import { ROLE_BASE_SALARY } from '../src/data/staff';
import { T } from '../src/data/tunables';
import { salaryFor } from '../src/sim/analysis';
import { apply, type Command, depositFor, newGame } from '../src/sim/game';
import type { GameState, Staff } from '../src/sim/state';

const hireable = (id: number, role: Staff['role'], skill: number): Staff => ({
  id, name: `${role} ${id}`, role, skill, potential: skill + 2, fame: 0, traits: [], morale: 50,
  salary: salaryFor(role, skill, 0, ROLE_BASE_SALARY[role]), shiftsWorked: 0, lowMoraleDays: 0, leavingOnDay: null,
});

function run(s: GameState, cmds: Command[]): GameState {
  for (const c of cmds) {
    const r = apply(s, c, { noise: false });
    if (r.error) throw new Error(`${c.type}: ${r.error}`);
    s = r.state;
  }
  return s;
}

/** The cheapest viable opening of fresh-start.md 7. */
function cheapestOpening(): GameState {
  let s = newGame(3, 'canal', 'hole');
  s = run(s, [
    { type: 'buyEquipment', itemId: 'usedDeckOven' },
    { type: 'buyEquipment', itemId: 'oldWorkbench' },
    { type: 'buyEquipment', itemId: 'doughFridge' },
    { type: 'buyEquipment', itemId: 'sink' },
    ...[0, 2, 4].flatMap((x) => [0, 3].map((y) => ({ type: 'placeFurniture' as const, itemId: 'foldingTable', x, y }))),
  ]);
  s.candidates = [hireable(900, 'cook', 3), hireable(901, 'server', 3)];
  const prices: Record<string, number> = { margherita: 11.5, pepperoni: 13.5, funghi: 12.5, quattroFormaggi: 12.5, softDrink: 4 };
  return run(s, [
    { type: 'hire', candidateId: 900 },
    { type: 'hire', candidateId: 901 },
    ...Object.entries(prices).flatMap(([recipeId, price]) => [
      { type: 'toggleMenu' as const, recipeId, on: true },
      { type: 'setPrice' as const, recipeId, price },
    ]),
  ]);
}

describe('fresh start', () => {
  test('a new game is empty and only the deposit is paid (AC-159)', () => {
    const s = newGame(1, 'canal', 'hole');
    expect(s.furniture).toEqual([]);
    expect(s.equipment).toEqual([]);
    expect(s.staff).toEqual([]);
    expect(s.recipes.some((r) => r.onMenu)).toBe(false);
    expect(s.deposit).toBe(54 * 11 * 4);
    expect(s.cash).toBe(T.finance.startingCash - s.deposit);
  });

  test('closed until the opening minimum is met, rent still accrues (AC-160)', () => {
    const r = apply(newGame(1, 'canal', 'hole'), { type: 'runDay' });
    const report = r.events[0]?.report;
    expect(report?.open).toBe(false);
    expect(report?.closedReason).toMatch(/pizza/);
    expect(report?.pnl.rent).toBeGreaterThan(0);
  });

  test('the first hiring board has 2 cooks, 2 servers and a dishwasher of skill 2 to 4 (AC-166)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = newGame(seed, 'university', 'hole').candidates;
      const roles = c.map((x) => x.role);
      expect(roles.filter((r) => r === 'cook').length).toBeGreaterThanOrEqual(2);
      expect(roles.filter((r) => r === 'server').length).toBeGreaterThanOrEqual(2);
      expect(roles).toContain('dishwasher');
      for (const x of c.slice(0, 5)) expect(x.skill).toBeGreaterThanOrEqual(2);
      for (const x of c.slice(0, 5)) expect(x.skill).toBeLessThanOrEqual(4);
    }
  });

  test('the cheapest opening in Canal Quarter costs $5,296 including the deposit (AC-161)', () => {
    const s = cheapestOpening();
    expect(T.finance.startingCash - s.cash).toBeCloseTo(5296, 0);
  });

  test('the worked example day: about 33.6 covers and $134 profit (AC-162)', () => {
    const s = cheapestOpening();
    s.day = 4;
    const r = apply(s, { type: 'runDay' }, { noise: false }).events[0]?.report;
    expect(r?.open).toBe(true);
    expect(r?.covers).toBeGreaterThan(33.6 * 0.9);
    expect(r?.covers).toBeLessThan(33.6 * 1.1);
    expect(r?.pnl.profit).toBeGreaterThan(134 * 0.8);
    expect(r?.pnl.profit).toBeLessThan(134 * 1.25);
  });

  test('week 1 is tight but profitable and cash never goes below zero (AC-162)', () => {
    let s = cheapestOpening();
    let lowest = s.cash;
    let profit = 0;
    for (let i = 0; i < 7; i++) {
      const r = apply(s, { type: 'runDay' }, { noise: false });
      s = r.state;
      lowest = Math.min(lowest, s.cash);
      profit += r.events[0]?.report?.pnl.profit ?? 0;
    }
    expect(lowest).toBeGreaterThan(0);
    expect(profit).toBeGreaterThan(0);
  });

  test('loan terms (AC-165)', () => {
    const r = apply(newGame(1, 'canal', 'hole'), { type: 'takeLoan', amount: 99999 });
    expect(r.state.loan.balance).toBe(5000);
    expect(r.state.loan.weeksLeft).toBe(52);
  });

  test('moving premises refunds the deposit, pays the new one and keeps equipment (AC-167)', () => {
    const s = cheapestOpening();
    s.cash = 20000;
    const r = apply(s, { type: 'movePremises', districtId: 'canal', premisesId: 'cosy' });
    expect(r.error).toBeUndefined();
    expect(r.state.cash).toBeCloseTo(20000 + s.deposit - depositFor('canal', 'cosy'), 5);
    expect(r.state.equipment.length).toBe(s.equipment.length);
    expect(r.state.furniture.length).toBe(s.furniture.length);
    expect(r.state.premisesId).toBe('cosy');
  });
});
