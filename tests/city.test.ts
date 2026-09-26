import { describe, expect, test } from 'vitest';
import { DISTRICTS, PREMISES } from '../src/data/districts';
import { FURNITURE } from '../src/data/furniture';
import { SEGMENT_IDS } from '../src/data/segments';
import { T } from '../src/data/tunables';
import { VENUES } from '../src/data/venues';
import { deserialise, serialise } from '../src/save/saveFile';
import { apply, moveQuote, newGame, newGameAt, seatLimit, venueDeposit, withStarterKit } from '../src/sim/game';
import { layoutProblem, kitchenDims } from '../src/sim/kitchen';
import { locationFacts } from '../src/sim/location';
import type { GameState } from '../src/sim/state';

const run = (s: GameState, days: number): GameState => {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }, { noise: false }).state;
  return s;
};

describe('city map venues (city-map.md)', () => {
  const venues = Object.values(VENUES);

  test('AC-175: at least 15 valid venues with pros and cons', () => {
    expect(venues.length).toBeGreaterThanOrEqual(15);
    for (const v of venues) {
      expect(DISTRICTS[v.districtId], v.id).toBeDefined();
      expect(PREMISES[v.premisesId], v.id).toBeDefined();
      expect(v.pros.length, v.id).toBeGreaterThanOrEqual(1);
      expect(v.cons.length, v.id).toBeGreaterThanOrEqual(1);
      expect(v.x).toBeGreaterThan(0);
      expect(v.y).toBeGreaterThan(0);
    }
  });

  test('AC-176: new players can afford several venues with money left to fit out', () => {
    const affordable = venues.filter((v) => T.finance.startingCash - venueDeposit(v.id) >= 2920);
    expect(affordable.length).toBeGreaterThanOrEqual(5);
    expect(new Set(affordable.map((v) => v.districtId)).size).toBeGreaterThanOrEqual(5);
  });

  test('AC-176: the reference starter kit fits every venue big enough for it', () => {
    for (const v of venues.filter((x) => x.premisesId !== 'hole')) {
      const s = withStarterKit(newGameAt(1, v.id));
      const p = PREMISES[v.premisesId]!;
      for (const f of s.furniture) {
        const it = FURNITURE[f.itemId]!;
        expect(f.x + it.w <= p.diningWidth && f.y + it.h <= p.diningHeight, v.id).toBe(true);
      }
      expect(layoutProblem(s.equipment, kitchenDims(v.premisesId)), v.id).toBeNull();
    }
  });

  test('AC-177: effective shares sum to 1', () => {
    for (const v of venues) {
      const f = locationFacts(v.districtId, v.premisesId, v.id);
      expect(SEGMENT_IDS.reduce((a, id) => a + f.shares[id], 0)).toBeCloseTo(1, 3);
    }
  });

  test('AC-178: a new game at a venue uses its rent, traffic and premises', () => {
    const v = VENUES.towerPlaza!;
    const s = newGameAt(3, v.id);
    expect(s.venueId).toBe('towerPlaza');
    expect(s.districtId).toBe('business');
    expect(s.premisesId).toBe('corner');
    const f = locationFacts(s.districtId, s.premisesId, s.venueId);
    expect(f.weeklyRent).toBe((12 * 8 + 30) * 19);
    expect(f.footTraffic).toBeCloseTo(4200 * 1.15);
    expect(f.sqm).toBe((12 * 8 + 30) * T.city.sqmPerTile);
    expect(s.deposit).toBe(f.weeklyRent * T.finance.leaseDepositWeeks);
    expect(s.cash).toBe(T.finance.startingCash - s.deposit);
  });

  test('every venue can run a day and makes sales', () => {
    for (const v of venues.filter((x) => x.premisesId !== 'hole')) {
      const s = run(withStarterKit(newGameAt(5, v.id)), 7);
      const sales = s.history.reduce((a, d) => a + d.pnl.sales, 0);
      expect(sales, v.id).toBeGreaterThan(0);
    }
  });
});

describe('rentVenue (city-map.md 6)', () => {
  test('AC-179, AC-183: charges the quote and keeps team, menu and loan', () => {
    let s = withStarterKit(newGameAt(9, 'lockKeeper'));
    s = apply(s, { type: 'takeLoan', amount: 5000 }).state;
    s = { ...s, cash: s.cash + 5000 };
    const q = moveQuote(s, 'bridgeStreet')!;
    expect(q.total).toBeCloseTo(q.newDeposit - q.refund + T.city.movingFee - q.resale);
    const r = apply(s, { type: 'rentVenue', venueId: 'bridgeStreet' });
    expect(r.error).toBeUndefined();
    expect(r.state.cash).toBeCloseTo(s.cash - q.total);
    expect(r.state.venueId).toBe('bridgeStreet');
    expect(r.state.deposit).toBe(venueDeposit('bridgeStreet'));
    expect(r.state.premisesId).toBe('medium');
    expect(r.state.staff).toEqual(s.staff);
    expect(r.state.recipes).toEqual(s.recipes);
    expect(r.state.loan).toEqual(s.loan);
    expect(r.state.rank).toBe(s.rank);
  });

  test('AC-179: fails when cash is short', () => {
    const s = { ...newGameAt(9, 'libraryLane'), cash: 0 };
    const r = apply(s, { type: 'rentVenue', venueId: 'lighthouseView' });
    expect(r.error).toMatch(/more/);
    expect(r.state).toBe(s);
  });

  test('AC-180: moving to the current venue fails', () => {
    const s = newGameAt(9, 'lockKeeper');
    expect(apply(s, { type: 'rentVenue', venueId: 'lockKeeper' }).error).toMatch(/already/);
  });

  test('AC-181: what does not fit a smaller venue is sold, the rest is laid out again', () => {
    const s = { ...withStarterKit(newGameAt(9, 'parkside')), cash: 100000 };
    const q = moveQuote(s, 'towpathKiosk')!;
    expect(q.soldFurniture.length).toBeGreaterThan(0);
    const r = apply(s, { type: 'rentVenue', venueId: 'towpathKiosk' });
    expect(r.error).toBeUndefined();
    expect(r.state.furniture.length).toBe(s.furniture.length - q.soldFurniture.length);
    expect(r.state.equipment.length).toBe(s.equipment.length - q.soldEquipment.length);
    expect(r.state.cash).toBeCloseTo(s.cash - q.total);
    const seats = r.state.furniture.reduce((a, f) => a + (FURNITURE[f.itemId]?.seats ?? 0), 0);
    expect(seats).toBeLessThanOrEqual(seatLimit('hole'));
    expect(layoutProblem(r.state.equipment, kitchenDims('hole'))).toBeNull();
  });

  test('moving between same size venues keeps the player layout', () => {
    const s = { ...withStarterKit(newGameAt(9, 'lockKeeper')), cash: 100000 };
    const r = apply(s, { type: 'rentVenue', venueId: 'villageHigh' });
    expect(r.state.furniture).toEqual(s.furniture);
    expect(r.state.equipment).toEqual(s.equipment);
  });

  test('movePremises from the market lands on the matching venue', () => {
    const s = { ...newGameAt(9, 'towpathKiosk'), cash: 100000 };
    const r = apply(s, { type: 'movePremises', districtId: 'harbour', premisesId: 'medium' });
    expect(r.state.venueId).toBe('lighthouseView');
    expect(r.state.deposit).toBe(venueDeposit('lighthouseView'));
  });

  test('AC-182: reputation carry depends on the neighbourhood', () => {
    const s = { ...newGameAt(9, 'lockKeeper'), rep: 80, cash: 100000 };
    const same = apply(s, { type: 'rentVenue', venueId: 'bridgeStreet' }).state.rep;
    const other = apply(s, { type: 'rentVenue', venueId: 'quaysideNook' }).state.rep;
    expect(same).toBeCloseTo(80 * 0.9 + 30 * 0.1);
    expect(other).toBeCloseTo(80 * 0.6 + 30 * 0.4);
  });

  test('AC-184: rentVenue never mutates its input', () => {
    const s = { ...newGameAt(9, 'lockKeeper'), cash: 100000 };
    const before = JSON.stringify(s);
    apply(s, { type: 'rentVenue', venueId: 'parkside' });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('save migration v2 to v4', () => {
  test('AC-185: old saves get a deposit and the matching venue and keep playing', () => {
    const s = newGame(4, 'harbour', 'cosy') as Partial<GameState>;
    delete s.venueId;
    delete (s as { deposit?: number }).deposit;
    const raw = JSON.parse(serialise(s as GameState, 1));
    raw.schemaVersion = 2;
    const loaded = deserialise(JSON.stringify(raw));
    expect(loaded.state.venueId).toBe('quaysideNook');
    expect(loaded.state.deposit).toBeGreaterThan(0);
    expect(run(loaded.state, 2).day).toBe(3);
  });
});
