// The Delivery tab (01-product/delivery-tab.md): deal days, minimum order, zone, the fleet and the scorecard.

import { describe, expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { dealTerms, deliveryWeeklyCosts, fleetOf, ridersToday } from '../src/sim/delivery';
import { deliveryScorecard, gradeOf } from '../src/sim/deliveryScore';
import { apply, type Command } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import type { DayReport, DeliveryDay, GameState, Staff } from '../src/sim/state';
import { buildState } from './balance/builds';

const step = (s: GameState, cmd: Command): GameState => {
  const r = apply(s, cmd, { noise: false });
  expect(r.error).toBeUndefined();
  return r.state;
};

function delivering(mode: 'platform' | 'marketplace' = 'platform'): GameState {
  const s = buildState('volume', 'university');
  s.rep = 70;
  s.daysOpen = 40;
  s.cash = 50000;
  s.following = 0.8;
  const { placed } = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId);
  s.equipment = placed;
  return step(step(s, { type: 'startDelivery', mode }), { type: 'setDelivery', throttle: null });
}

const day = (s: GameState): DeliveryDay => simulateDay(s, analyse(s), { noise: false }).delivery as DeliveryDay;
/** The same state on another day of the week (Mon = 0). */
const onWeekday = (s: GameState, weekday: number): GameState => ({ ...s, day: s.day - ((s.day - 1) % 7) + 7 + weekday });

const rider = (id: number, speed: number): Staff => ({
  id, name: `Rider ${id}`, role: 'rider', attrs: { quality: 50, speed, composure: 50, mentoring: 10 }, potential: 70, fame: 0, talent: null,
  personality: [], morale: 70, salary: 520, shiftsWorked: 0, lowMoraleDays: 0, leavingOnDay: null, hiredDay: 1, growthXp: 0, coachXp: {},
  lastDevelopedDay: null, coaching: null, course: null, offUntil: null, lastCourseDay: null,
} as unknown as Staff);

describe('Menu & deals: deal days and minimum order', () => {
  test('AC-321: a Mon to Thu deal gives no discount on a Saturday and does on a Tuesday', () => {
    const s = step(step(delivering(), { type: 'setDelivery', deal: 'tenOff' }), { type: 'setDelivery', dealDays: 'weekdays' });
    expect(dealTerms(s.delivery, 'dinner', 5).orderLift).toBe(0);
    expect(dealTerms(s.delivery, 'dinner', 1).orderLift).toBeGreaterThan(0);
    expect(day(onWeekday(s, 5)).dealGiven ?? 0).toBe(0);
    expect(day(onWeekday(s, 1)).dealGiven ?? 0).toBeGreaterThan(0);
    const weekend = step(s, { type: 'setDelivery', dealDays: 'weekend' });
    expect(dealTerms(weekend.delivery, 'dinner', 5).orderLift).toBeGreaterThan(0);
    expect(dealTerms(weekend.delivery, 'dinner', 1).orderLift).toBe(0);
  });

  test('AC-322: a high minimum order gives fewer orders and a bigger average order', () => {
    const base = delivering();
    const high = step(base, { type: 'setDelivery', minOrder: 'high' });
    const a = day(base);
    const b = day(high);
    expect(b.wanted).toBeLessThan(a.wanted);
    expect(b.orderValue!).toBeGreaterThan(a.orderValue!);
    expect(b.mainsPerOrder!).toBeCloseTo(a.mainsPerOrder! + T.delivery.minOrder.high.mains, 6);
  });

  test('unknown settings are refused', () => {
    const s = delivering();
    expect(apply(s, { type: 'setDelivery', zone: 'moon' as never }).error).toBeTruthy();
    expect(apply(s, { type: 'setDelivery', minOrder: 'huge' as never }).error).toBeTruthy();
    expect(apply(s, { type: 'setDelivery', dealDays: 'sometimes' as never }).error).toBeTruthy();
  });
});

describe('Fleet: zone and vehicles', () => {
  test('AC-328: a wide zone brings more orders and longer deliveries than close by', () => {
    const tight = step(delivering(), { type: 'setDelivery', zone: 'tight' });
    const wide = step(delivering(), { type: 'setDelivery', zone: 'wide' });
    const a = day(tight);
    const b = day(wide);
    expect(b.wanted).toBeGreaterThan(a.wanted);
    expect(b.time.dinner).toBeGreaterThan(a.time.dinner);
    expect(b.scores!.food).toBeLessThan(a.scores!.food);
  });

  test('AC-327: missing new fields play exactly like their defaults', () => {
    const s = delivering('marketplace');
    s.staff = [...s.staff, rider(801, 60), rider(802, 40)];
    s.delivery = { ...s.delivery!, vehicles: { bike: 1, scooter: 1 } };
    delete s.delivery.zone;
    delete s.delivery.minOrder;
    delete s.delivery.dealDays;
    const explicit: GameState = { ...s, delivery: { ...s.delivery, vehicles: { bike: 1, scooter: 1, ebike: 0, car: 0 }, zone: 'standard', minOrder: 'none', dealDays: 'all' } };
    expect(day(explicit)).toEqual(day(s));
    // Bikes and scooters alone: two orders a trip, the mean ride as before.
    const r = ridersToday(s);
    expect(r.onShift).toBe(2);
    const ride = ((T.delivery.scooterRide + T.delivery.bikeRide) / 2) * (1.15 - 0.003 * 50);
    expect(r.ride).toBeCloseTo(ride, 9);
    expect(r.capPerHour).toBeCloseTo((2 * 60 / (2 * ride + 4)) * T.delivery.ordersPerTrip, 9);
  });

  test('AC-326: a car carries four orders a trip and goes to the first rider', () => {
    const s = delivering('marketplace');
    s.staff = [...s.staff, rider(801, 50)];
    s.delivery = { ...s.delivery!, vehicles: { bike: 1, scooter: 1, ebike: 0, car: 1 } };
    expect(fleetOf(s.delivery!)[0]?.kind).toBe('car');
    const r = ridersToday(s);
    expect(r.onShift).toBe(1);
    expect(r.capPerHour).toBeCloseTo((60 / (2 * r.ride + 4)) * T.delivery.carOrdersPerTrip, 9);
  });

  test('AC-325: e-bikes and cars are bought and sold at 80%, with their upkeep', () => {
    let s = delivering('marketplace');
    const cash = s.cash;
    s = step(s, { type: 'buyVehicle', kind: 'car' });
    s = step(s, { type: 'buyVehicle', kind: 'ebike' });
    expect(s.delivery!.vehicles.car).toBe(1);
    expect(s.delivery!.vehicles.ebike).toBe(1);
    expect(deliveryWeeklyCosts(s.delivery!)).toBe(T.delivery.car.upkeep + T.delivery.ebike.upkeep);
    const paid = cash - s.cash;
    s = step(s, { type: 'sellVehicle', kind: 'car' });
    s = step(s, { type: 'sellVehicle', kind: 'ebike' });
    expect(s.delivery!.vehicles.car).toBe(0);
    expect(cash - s.cash).toBeCloseTo(paid * 0.2, -1);
    expect(apply(s, { type: 'sellVehicle', kind: 'car' }).error).toBeTruthy();
  });
});

describe('Scorecard', () => {
  const dday = (x: Partial<DeliveryDay>): DeliveryDay => ({
    wanted: 20, accepted: 20, refused: 0, cancelled: 0, delivered: 20, time: { lunch: 30, dinner: 30 }, drepBefore: 70, drepAfter: 70,
    topRated: false, topRatedDays: 0, profit: 100, kitchenShare: 0.2, satisfaction: 80, scores: { food: 0.9, time: 1, value: 0.85 },
    audienceAfter: 0.7, ...x,
  } as DeliveryDay);
  const reports = (ds: DeliveryDay[]): DayReport[] => ds.map((delivery, i) => ({ day: i + 1, open: true, delivery }) as unknown as DayReport);

  test('AC-333: no scorecard before the first delivery day; a short window is flagged by its day count', () => {
    expect(deliveryScorecard([])).toBeNull();
    expect(deliveryScorecard(reports([dday({})]))?.days).toBe(1);
  });

  test('AC-330, AC-331: seven KPIs graded A to E; the overall score is the weighted mean', () => {
    const sc = deliveryScorecard(reports(Array.from({ length: 9 }, () => dday({}))))!;
    expect(sc.days).toBe(7);
    expect(sc.kpis).toHaveLength(7);
    for (const k of sc.kpis) expect(['A', 'B', 'C', 'D', 'E']).toContain(k.grade);
    const w = sc.kpis.reduce((x, k) => x + k.weight, 0);
    expect(w).toBe(100);
    expect(sc.overall).toBe(Math.round(sc.kpis.reduce((x, k) => x + k.weight * k.score, 0)));
  });

  test('AC-332: focus names the lowest graded KPI, and it links to the tab that fixes it', () => {
    const late = deliveryScorecard(reports(Array.from({ length: 7 }, () => dday({ time: { lunch: 50, dinner: 50 } }))))!;
    expect(late.kpis.find((k) => k.id === 'onTime')?.grade).toBe('E');
    expect(late.focus?.id).toBe('onTime');
    expect(late.focus?.fix).toBe('fleet');
    const unknown = deliveryScorecard(reports(Array.from({ length: 7 }, () => dday({ audienceAfter: 0.05 }))))!;
    expect(unknown.focus?.id).toBe('audience');
    expect(unknown.focus?.fix).toBe('promotion');
  });

  test('grades step down from the A mark', () => {
    expect(gradeOf(1)).toBe('A');
    expect(gradeOf(0.9)).toBe('B');
    expect(gradeOf(0.75)).toBe('C');
    expect(gradeOf(0.6)).toBe('D');
    expect(gradeOf(0.2)).toBe('E');
  });

  test('the week change compares with the 7 delivery days before', () => {
    const ds = [...Array.from({ length: 7 }, () => dday({ profit: 20 })), ...Array.from({ length: 7 }, () => dday({ profit: 120 }))];
    const sc = deliveryScorecard(reports(ds))!;
    expect(sc.kpis.find((k) => k.id === 'profit')?.change).toBeCloseTo(5, 6);
  });
});
