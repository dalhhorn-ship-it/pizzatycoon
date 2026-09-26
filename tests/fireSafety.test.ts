// Fire safety upgrades and kitchen equipment guests can feel (balance.md 4.4).
import { describe, expect, test } from 'vitest';
import { FIRE_SAFETY_IDS } from '../src/data/fireSafety';
import { T } from '../src/data/tunables';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply, newGame, seatLimit, withStarterKit } from '../src/sim/game';
import type { GameState } from '../src/sim/state';
import { buildState, steadyState } from './balance/builds';

const rich = (): GameState => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.cash = 100000;
  return s;
};

describe('fire safety', () => {
  test('locked until the restaurant has been open 60 days', () => {
    const s = rich();
    expect(apply(s, { type: 'buyFireSafety', id: 'extinguishers' }).error).toMatch(/60 days open/);
    s.daysOpen = T.fireSafety.unlockDaysOpen;
    expect(apply(s, { type: 'buyFireSafety', id: 'extinguishers' }).error).toBeUndefined();
  });

  test('only days the restaurant actually opened count', () => {
    let s = rich();
    s = apply(s, { type: 'runDay' }).state;
    expect(s.daysOpen).toBe(1);
    s.staff = [];
    s = apply(s, { type: 'runDay' }).state;
    expect(s.daysOpen).toBe(1);
  });

  test('upgrades go in order and raise the seat limit', () => {
    let s = rich();
    s.daysOpen = 60;
    const base = seatLimit(s.premisesId);
    expect(apply(s, { type: 'buyFireSafety', id: 'sprinklers' }).error).toMatch(/first/);
    for (const id of FIRE_SAFETY_IDS) {
      const r = apply(s, { type: 'buyFireSafety', id });
      expect(r.error).toBeUndefined();
      s = r.state;
    }
    expect(seatLimit(s.premisesId, s.fireSafety)).toBe(Math.floor(base * 1.4));
    expect(s.cash).toBe(100000 - 900 - 2800 - 6500 - 12000);
  });

  test('extra seats can be placed once allowed, and inspections cost upkeep', () => {
    let s = newGame(1, 'canal', 'hole');
    s.cash = 100000;
    s.daysOpen = 60;
    const fill = (st: GameState): number => {
      for (let i = 0; i < 12; i++) {
        const r = apply(st, { type: 'placeFurniture', itemId: 'foldingTable', x: (i % 3) * 2, y: Math.floor(i / 3) * 2 });
        if (!r.error) st = r.state;
      }
      return analyse(st).room.seats;
    };
    const before = fill(s);
    expect(before).toBeLessThanOrEqual(seatLimit('hole'));
    s = apply(s, { type: 'buyFireSafety', id: 'extinguishers' }).state;
    s = apply(s, { type: 'buyFireSafety', id: 'fireAlarm' }).state;
    expect(fill(s)).toBeGreaterThan(before);
    const withKit = withStarterKit(s);
    const upkeep = (st: GameState): number => simulateDay(st, analyse(st), { noise: false }).pnl.upkeep;
    expect(upkeep(withKit)).toBeGreaterThan(upkeep({ ...withKit, fireSafety: [] }));
  });

  test('upgrades stay in the building when you move', () => {
    let s = rich();
    s.daysOpen = 60;
    s = apply(s, { type: 'buyFireSafety', id: 'extinguishers' }).state;
    s = apply(s, { type: 'movePremises', districtId: 'canal', premisesId: 'medium' }).state;
    expect(s.fireSafety).toEqual([]);
    expect(s.daysOpen).toBe(0);
  });
});

describe('guests feel the kitchen', () => {
  const sat = (s: GameState): number => simulateDay(s, analyse(s), { noise: false }).satisfaction;

  test('a better oven lifts satisfaction by a visible amount', () => {
    const s = rich();
    s.day = 4;
    s.unlockAll = true;
    const oven = s.equipment.find((e) => e.itemId === 'deckOven')!.uid;
    const upgraded = apply(s, { type: 'upgradeStation', uid: oven, toItemId: 'stoneHearthOven' }).state;
    expect(sat(upgraded) - sat(s)).toBeGreaterThan(2);
  });

  test('foodies taste the difference more than students', () => {
    const s = rich();
    s.day = 4;
    s.unlockAll = true;
    const oven = s.equipment.find((e) => e.itemId === 'deckOven')!.uid;
    const upgraded = apply(s, { type: 'upgradeStation', uid: oven, toItemId: 'stoneHearthOven' }).state;
    const food = (st: GameState, seg: string): number =>
      simulateDay(st, analyse(st), { noise: false }).segments.find((x) => x.segment === seg)!.scores.food;
    expect(food(upgraded, 'foodies') - food(s, 'foodies')).toBeGreaterThan(food(upgraded, 'students') - food(s, 'students'));
  });

  test('a busy kitchen makes guests wait for food; more capacity brings it out sooner', () => {
    const s = steadyState(buildState('middle', 'university')).state;
    const ticket = (st: GameState): number => simulateDay(st, analyse(st), { noise: false }).services[0]!.ticketTime;
    const busy = ticket(s);
    let more = structuredClone(s);
    more.cash = 100000;
    more.unlockAll = true;
    const r = apply(more, { type: 'buyEquipment', itemId: 'deckOven' });
    expect(r.error).toBeUndefined();
    more = r.state;
    expect(busy).toBeGreaterThan(T.satisfaction.ticketFree);
    expect(ticket(more)).toBeLessThan(busy - 2);
  });
});
