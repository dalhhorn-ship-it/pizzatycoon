// service-deals.md: set menus at lunch and dinner, lunch flyers and coupons, and the lunch and dinner scorecard.
import { describe, expect, test } from 'vitest';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply } from '../src/sim/game';
import { newCampaign } from '../src/sim/marketing';
import { stateLocation } from '../src/sim/location';
import { restaurantScorecard } from '../src/sim/serviceScore';
import { deserialise, serialise } from '../src/save/saveFile';
import type { CampaignId } from '../src/data/campaigns';
import type { Service } from '../src/data/types';
import type { DayReport, GameState, ServiceDeals } from '../src/sim/state';
import { buildState, steadyState } from './balance/builds';

const day = (s: GameState, d = 2): DayReport => {
  const t = structuredClone(s);
  t.day = d;
  return simulateDay(t, analyse(t), { noise: false });
};
const sv = (r: DayReport, x: Service) => r.services.find((s) => s.service === x)!;
const perGuest = (r: DayReport, x: Service) => (sv(r, x).sales ?? 0) / sv(r, x).served;
const withDeals = (s: GameState, serviceDeals: Partial<ServiceDeals>): GameState => ({ ...structuredClone(s), serviceDeals: { lunch: null, dinner: null, ...serviceDeals } });
const withCampaign = (s: GameState, id: CampaignId): GameState => {
  const t = structuredClone(s);
  t.campaigns = [{ ...newCampaign(id, [], t.day, stateLocation(t)), startDay: 1, endsDay: 99 }];
  return t;
};
const withMenu = (s: GameState, ids: string[]): GameState => {
  const t = structuredClone(s);
  for (const r of t.recipes) if (ids.includes(r.id)) r.onMenu = true;
  return t;
};

const office = steadyState(buildState('volume', 'business')).state;
const luxury = steadyState(buildState('luxury', 'oldtown')).state;

describe('service reports', () => {
  test('lunch and dinner sales add up to dining sales, and food cost to ingredients', () => {
    const r = day(office);
    expect((sv(r, 'lunch').sales ?? 0) + (sv(r, 'dinner').sales ?? 0)).toBeCloseTo(r.pnl.sales, 6);
    expect((sv(r, 'lunch').food ?? 0) + (sv(r, 'dinner').food ?? 0)).toBeCloseTo(r.pnl.ingredients, 6);
  });

  test('no set menu and no lunch campaign changes nothing', () => {
    expect(day(withDeals(office, {})).covers).toBeCloseTo(day(office).covers, 9);
  });
});

describe('set menus', () => {
  test('a three course lunch brings more lunch guests with a bigger check, and leaves dinner prices alone', () => {
    const r0 = day(office);
    const r1 = day(withDeals(office, { lunch: 'lunch3' }));
    expect(sv(r1, 'lunch').demand).toBeGreaterThan(sv(r0, 'lunch').demand * 1.05);
    expect(perGuest(r1, 'lunch')).toBeGreaterThan(perGuest(r0, 'lunch'));
    expect(sv(r1, 'lunch').dealGuests).toBeGreaterThan(0);
    expect(sv(r1, 'lunch').dealGiven).toBeGreaterThan(0);
    expect(sv(r1, 'lunch').tableCycle).toBeGreaterThan(sv(r0, 'lunch').tableCycle);
    expect(sv(r1, 'dinner').demand).toBeCloseTo(sv(r0, 'dinner').demand, 6);
    expect(perGuest(r1, 'dinner')).toBeCloseTo(perGuest(r0, 'dinner'), 6);
    expect(r1.dishSales.tiramisu).toBeGreaterThan(r0.dishSales.tiramisu ?? 0);
  });

  test('more courses: longer dinner tables and more on the bundle, foodies like the tasting menu best', () => {
    const t = withMenu(luxury, ['spritz', 'carbonara']);
    const base = day(t);
    const d3 = day(withDeals(t, { dinner: 'dinner3' }));
    const d5 = day(withDeals(t, { dinner: 'dinner5' }));
    expect(sv(d5, 'dinner').tableCycle).toBeGreaterThan(sv(d3, 'dinner').tableCycle);
    expect(sv(d3, 'dinner').tableCycle).toBeGreaterThan(sv(base, 'dinner').tableCycle);
    expect(perGuest(d5, 'dinner') ).toBeGreaterThan(perGuest(base, 'dinner'));
    const foodies = (r: DayReport) => r.segments.find((x) => x.segment === 'foodies')!.demand;
    expect(foodies(d5)).toBeGreaterThan(foodies(base));
    expect(sv(d5, 'lunch').demand).toBeCloseTo(sv(base, 'lunch').demand, 6);
  });

  test('a set menu needs its courses on the menu', () => {
    const r = apply(luxury, { type: 'setServiceDeal', service: 'dinner', deal: 'dinner5' });
    expect(r.error).toMatch(/aperitivo/);
    expect(apply(luxury, { type: 'setServiceDeal', service: 'lunch', deal: 'dinner3' }).error).toBeTruthy();
    const ok = apply(office, { type: 'setServiceDeal', service: 'lunch', deal: 'lunch3' });
    expect(ok.error).toBeFalsy();
    expect(ok.state.serviceDeals).toEqual({ lunch: 'lunch3', dinner: null });
    expect(deserialise(serialise(ok.state, 0)).state.serviceDeals).toEqual({ lunch: 'lunch3', dinner: null });
    // Take the dessert off the menu and the lunch deal pauses.
    const off = structuredClone(ok.state);
    for (const x of off.recipes) if (x.kind === 'dessert') x.onMenu = false;
    expect(sv(day(off), 'lunch').dealGuests).toBe(0);
  });
});

describe('lunch promotions', () => {
  test('lunch flyers bring lunch guests only', () => {
    const r0 = day(office);
    const r1 = day(withCampaign(office, 'lunchFlyers'));
    expect(sv(r1, 'lunch').demand).toBeGreaterThan(sv(r0, 'lunch').demand * 1.05);
    expect(sv(r1, 'dinner').demand).toBeCloseTo(sv(r0, 'dinner').demand, 6);
  });

  test('lunch coupons bring lunch guests at a lower lunch check', () => {
    const r0 = day(office);
    const r1 = day(withCampaign(office, 'lunchCoupons'));
    expect(sv(r1, 'lunch').demand).toBeGreaterThan(sv(r0, 'lunch').demand * 1.1);
    expect(perGuest(r1, 'lunch')).toBeLessThan(perGuest(r0, 'lunch'));
    expect(sv(r1, 'lunch').dealGiven).toBeGreaterThan(0);
    expect(perGuest(r1, 'dinner')).toBeCloseTo(perGuest(r0, 'dinner'), 6);
  });
});

describe('scorecard', () => {
  test('grades lunch and dinner side by side and names a focus', () => {
    const s = structuredClone(office);
    s.history = [2, 3, 4, 5, 6].map((d) => day(s, d));
    const sc = restaurantScorecard(s);
    expect(sc).not.toBeNull();
    expect(sc!.days).toBe(5);
    for (const c of [sc!.lunch, sc!.dinner]) {
      expect(c.kpis.map((k) => k.id)).toEqual(['filled', 'fulfilled', 'ticket', 'check', 'margin']);
      expect(c.overall).toBeGreaterThanOrEqual(0);
      expect(c.overall).toBeLessThanOrEqual(100);
      expect(c.guests).toBeGreaterThan(0);
    }
    if (sc!.focus) expect(sc!.focus.grade).not.toBe('A');
    expect(restaurantScorecard({ ...s, history: [] })).toBeNull();
  });

  test('a lunch deal shows on the lunch card', () => {
    const s = withDeals(office, { lunch: 'lunch3' });
    s.history = [2, 3, 4].map((d) => day(s, d));
    const sc = restaurantScorecard(s)!;
    expect(sc.lunch.dealGuests).toBeGreaterThan(0);
    expect(sc.dinner.dealGuests).toBe(0);
  });
});
