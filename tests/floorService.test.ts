// floor-service.md: counter service, bookings and standing places for quick bites.
import { describe, expect, test } from 'vitest';
import { FURNITURE, fireSeats } from '../src/data/furniture';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply, newGame, seatLimit, withStarterKit } from '../src/sim/game';
import { deserialise, serialise } from '../src/save/saveFile';
import type { GameState } from '../src/sim/state';
import { buildState, steadyState } from './balance/builds';

const day = (s: GameState) => {
  const t = structuredClone(s);
  t.day = 4;
  return simulateDay(t, analyse(t), { noise: false });
};
const withFloor = (s: GameState, floorPolicy: GameState['floorPolicy']): GameState => ({ ...structuredClone(s), floorPolicy });
const volume = steadyState(buildState('volume', 'university')).state;
const luxury = steadyState(buildState('luxury', 'oldtown')).state;

describe('service style', () => {
  test('table service with mixed bookings is the default and changes nothing', () => {
    expect(day(withFloor(volume, { style: 'table', bookings: 'mixed' })).covers).toBeCloseTo(day(volume).covers, 6);
  });

  test('counter service: quicker turns and more guests per server, fewer extras and a lower service score', () => {
    const counter = withFloor(volume, { style: 'counter', bookings: 'mixed' });
    const a0 = analyse(volume);
    const a1 = analyse(counter);
    expect(a1.service.serviceTime.lunch).toBeLessThan(a0.service.serviceTime.lunch - 2);
    expect(a1.service.serverGuests.dinner).toBeCloseTo(a0.service.serverGuests.dinner * 1.4, 5);
    expect(a1.service.serviceScore).toBeLessThan(a0.service.serviceScore);
    const r0 = day(volume);
    const r1 = day(counter);
    expect(r1.services[0]!.tableCycle).toBeLessThan(r0.services[0]!.tableCycle);
    expect(r1.covers).toBeGreaterThan(r0.covers);
    expect(r1.pnl.sales / r1.covers).toBeLessThan(r0.pnl.sales / r0.covers);
  });

  test('counter service pays at a busy student pizzeria and costs a luxury room', () => {
    expect(day(withFloor(volume, { style: 'counter', bookings: 'mixed' })).pnl.profit).toBeGreaterThan(day(volume).pnl.profit);
    expect(day(withFloor(luxury, { style: 'counter', bookings: 'mixed' })).pnl.profit).toBeLessThan(day(luxury).pnl.profit);
  });
});

describe('bookings', () => {
  test('no reservations turns more tables at a full student pizzeria', () => {
    const walkIn = day(withFloor(volume, { style: 'table', bookings: 'walkIn' }));
    expect(walkIn.covers).toBeGreaterThan(day(volume).covers);
  });

  test('reservations please planners and pay in a luxury room, but hold tables empty in a busy one', () => {
    const res = (s: GameState) => day(withFloor(s, { style: 'table', bookings: 'reservations' }));
    expect(res(luxury).pnl.profit).toBeGreaterThan(day(luxury).pnl.profit);
    expect(res(volume).covers).toBeLessThan(day(volume).covers);
    expect(res(volume).satisfaction).toBeGreaterThan(day(volume).satisfaction);
  });

  test('the choice is a command, kept per restaurant and in the save', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    const r = apply(s, { type: 'setFloorPolicy', style: 'counter' });
    expect(r.state.floorPolicy).toEqual({ style: 'counter', bookings: 'mixed' });
    const r2 = apply(r.state, { type: 'setFloorPolicy', bookings: 'walkIn' });
    expect(r2.state.floorPolicy).toEqual({ style: 'counter', bookings: 'walkIn' });
    expect(deserialise(serialise(r2.state, 0)).state.floorPolicy).toEqual({ style: 'counter', bookings: 'walkIn' });
  });
});

describe('standing places', () => {
  const open = (): GameState => {
    const s = withStarterKit(newGame(1, 'university', 'medium'));
    s.cash = 50000;
    s.rep = 60;
    return s;
  };

  test('a standing bar adds lunch capacity for students when the seats are full', () => {
    const s = steadyState(buildState('volume', 'university')).state;
    // Swap two small tables for a standing bar in the same corner: fewer seats, more quick bites.
    const t = structuredClone(s);
    const small = t.furniture.filter((f) => f.itemId === 'table2').slice(0, 2);
    if (small.length === 2) {
      t.furniture = t.furniture.filter((f) => !small.includes(f));
      t.furniture.push({ uid: 99999, itemId: 'standingBar', x: small[0]!.x, y: small[0]!.y });
    }
    const a = analyse(t);
    expect(a.room.standing).toBe(5);
    const before = day(s).services[0]!;
    const after = day(t).services[0]!;
    expect(after.stages.seats).toBeGreaterThan(before.stages.seats);
  });

  test('standing places count as half a seat for fire safety', () => {
    const bar = FURNITURE.standingBar!;
    expect(fireSeats(bar)).toBe(2.5);
    expect(fireSeats(FURNITURE.table4)).toBe(4);
    expect(fireSeats(FURNITURE.plant)).toBe(0);
    let s = open();
    const limit = seatLimit(s.premisesId, s.fireSafety);
    s.furniture = [];
    // Standing bars along every other row until fire safety says no.
    let placed = 0;
    for (let y = 0; y < 10; y += 2) for (let x = 0; x + 3 <= 10; x += 4) {
      const r = apply(s, { type: 'placeFurniture', itemId: 'standingBar', x, y });
      if (r.error) {
        expect(r.error).toMatch(/Fire safety/);
        continue;
      }
      s = r.state;
      placed += 1;
    }
    expect(placed * 2.5).toBeLessThanOrEqual(limit);
    expect(placed * 5).toBeGreaterThan(limit * 0.9);
  });

  test('a room with only standing places still opens', () => {
    const s = open();
    s.furniture = [{ uid: 1, itemId: 'standingBar', x: 0, y: 0 }];
    const r = day(s);
    expect(r.open).toBe(true);
    expect(r.covers).toBeGreaterThan(0);
  });
});
