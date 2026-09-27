// Live rivals, marketing and delivery (01-product/competition.md).

import { describe, expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { catchment, deliveryCompetition, deliveryMinutes, nextDrep, newDelivery, ridersToday, timeScore } from '../src/sim/delivery';
import { PRESETS, RIVAL_PRESETS, RIVALS_OFF } from '../src/sim/economy';
import { apply, type Command } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import { mktFor } from '../src/sim/marketing';
import { activeRivals, seedRivals } from '../src/sim/rivals';
import { staffFromSkill } from '../src/sim/staff';
import type { GameState } from '../src/sim/state';
import { buildState } from './balance/builds';

const step = (s: GameState, cmd: Command): { s: GameState; error?: string } => {
  const r = apply(s, cmd, { noise: false });
  return { s: r.state, error: r.error };
};

/** A middle build that may deliver: reputation 70, 40 days open, a packing station in the kitchen. */
function deliveryReady(build: 'middle' | 'volume' = 'middle', district = 'canal'): GameState {
  const s = buildState(build, district);
  s.rep = 70;
  s.daysOpen = 40;
  s.cash = 50000;
  s.following = 0.8;
  const { placed } = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId);
  s.equipment = placed;
  return s;
}

describe('live rivals', () => {
  test('AC-226: rivals off (missing or switched off) leave the day unchanged', () => {
    const base = buildState('middle', 'canal');
    const off = { ...structuredClone(base), economy: { ...PRESETS.normal, rivals: RIVALS_OFF } };
    const a = simulateDay(base, analyse(base), { noise: false });
    const b = simulateDay(off, analyse(off), { noise: false });
    expect(b.pnl.profit).toBeCloseTo(a.pnl.profit, 6);
    expect(b.covers).toBeCloseTo(a.covers, 6);
    expect(a.market?.cEff.families).toBeCloseTo(0.3, 6);
  });

  test('a new game on Normal seeds rivals within the caps, never on the player venue', () => {
    const s = buildState('middle', 'canal');
    s.economy = { ...PRESETS.normal, rivals: RIVAL_PRESETS.normal };
    seedRivals(s);
    const n = activeRivals(s).length;
    expect(n).toBeGreaterThan(4);
    expect(n).toBeLessThanOrEqual(RIVAL_PRESETS.normal.cityCap);
    for (const r of activeRivals(s)) expect(r.locations.length).toBe(1);
  });

  test('old saves switch rivals on in settings: the start number arrives over 28 days; off closes them all', () => {
    let s = buildState('middle', 'canal');
    s = step(s, { type: 'setEconomy', economy: { rivals: RIVAL_PRESETS.normal } }).s;
    expect(s.rivalMeta?.pendingEntrants).toBe(RIVAL_PRESETS.normal.start);
    for (let i = 0; i < 35; i++) s = step(s, { type: 'runDay' }).s;
    expect(activeRivals(s).length).toBeGreaterThan(3);
    s = step(s, { type: 'setEconomy', economy: { rivals: { ...RIVAL_PRESETS.normal, on: false } } }).s;
    expect(activeRivals(s).length).toBe(0);
  });

  test('a mystery diner costs $60 and only once a week per rival', () => {
    const s = buildState('middle', 'canal');
    s.cash = 1000;
    s.economy = { ...PRESETS.normal, rivals: RIVAL_PRESETS.normal };
    seedRivals(s);
    const rival = activeRivals(s)[0];
    expect(rival).toBeDefined();
    const first = step(s, { type: 'mysteryDiner', rivalId: rival?.id ?? 0 });
    expect(first.error).toBeUndefined();
    expect(first.s.cash).toBe(1000 - T.rivals.mysteryDinerPrice);
    expect(step(first.s, { type: 'mysteryDiner', rivalId: rival?.id ?? 0 }).error).toBeDefined();
  });
});

describe('marketing', () => {
  test('a campaign is paid up front, lifts the crowds it reaches and shows in the P&L', () => {
    const s0 = buildState('middle', 'canal');
    s0.cash = 5000;
    s0.unlockAll = true;
    const { s, error } = step(s0, { type: 'startCampaign', campaignId: 'social', audience: ['families', 'professionals'] });
    expect(error).toBeUndefined();
    expect(s.cash).toBeLessThan(5000);
    expect(mktFor(s.campaigns, 'families', s.day)).toBeGreaterThan(1);
    expect(mktFor(s.campaigns, 'tourists', s.day)).toBe(1);
    const a = simulateDay(s0, analyse(s0), { noise: false });
    const b = simulateDay(s, analyse(s), { noise: false });
    expect(b.covers).toBeGreaterThan(a.covers);
    expect(b.pnl.marketing).toBeGreaterThan(0);
  });

  test('at most three campaigns run per restaurant, and each needs its crowds chosen', () => {
    let s = buildState('middle', 'canal');
    s.cash = 50000;
    s.unlockAll = true;
    expect(step(s, { type: 'startCampaign', campaignId: 'social', audience: [] }).error).toBeDefined();
    for (const [id, aud] of [['flyers', []], ['social', ['families']], ['familySundays', []]] as const) {
      const r = step(s, { type: 'startCampaign', campaignId: id, audience: [...aud] });
      expect(r.error).toBeUndefined();
      s = r.s;
    }
    expect(step(s, { type: 'startCampaign', campaignId: 'lunchClub', audience: [] }).error).toMatch(/3 campaigns/);
  });
});

describe('delivery', () => {
  test('AC-264 inputs: catchment of Canal Quarter and the background competition', () => {
    expect(catchment('canal', 2400)).toBe(12700);
    const s = buildState('middle', 'canal');
    expect(deliveryCompetition(s, 'canal', 50)).toBeCloseTo(0.3, 6);
  });

  test('delivery needs reputation 60, 28 days open and a packing station', () => {
    const s = buildState('middle', 'canal');
    s.rep = 70;
    expect(step(s, { type: 'startDelivery', mode: 'platform' }).error).toMatch(/open 28 days/);
    s.daysOpen = 40;
    expect(step(s, { type: 'startDelivery', mode: 'platform' }).error).toMatch(/packing station/i);
    expect(step(deliveryReady(), { type: 'startDelivery', mode: 'platform' }).error).toBeUndefined();
  });

  test('delivery time and its score follow the 35 minute promise (6.5)', () => {
    const platform = { onShift: 0, capPerHour: Infinity, ride: T.delivery.platformRide, quality: 50 };
    // 12 minute cook time, a quiet kitchen: 12 + queue + 3 pack + 5 wait + 14 ride.
    const quiet = deliveryMinutes(12, 0.47, 10, platform, 'platform');
    expect(quiet).toBeGreaterThan(35);
    expect(quiet).toBeLessThan(38);
    const busy = deliveryMinutes(12, 0.99, 10, platform, 'platform');
    expect(busy).toBeGreaterThan(55);
    expect(timeScore(busy)).toBeLessThan(0.1);
    expect(timeScore(35)).toBe(1);
  });

  test('the throttle protects the kitchen: off takes more orders but deliveries run later', () => {
    let on = step(deliveryReady('volume', 'university'), { type: 'startDelivery', mode: 'platform' }).s;
    let off = step(on, { type: 'setDelivery', throttle: null }).s;
    on = { ...on, day: on.day - ((on.day - 1) % 7) + 5 };
    off = { ...off, day: on.day };
    const a = simulateDay(on, analyse(on), { noise: false }).delivery;
    const b = simulateDay(off, analyse(off), { noise: false }).delivery;
    expect(a && b).toBeTruthy();
    expect(b?.accepted ?? 0).toBeGreaterThan(a?.accepted ?? 0);
    expect(b?.time.dinner ?? 0).toBeGreaterThan(a?.time.dinner ?? 0);
    expect(a?.refused ?? 0).toBeGreaterThan(0);
  });

  test('delivery reputation is separate from the dining reputation', () => {
    const s = step(deliveryReady(), { type: 'startDelivery', mode: 'platform' }).s;
    const day = simulateDay(s, analyse(s), { noise: false });
    expect(day.delivery?.drepBefore).toBe(T.delivery.startDRep);
    expect(day.repBefore).toBe(70);
    const after = step(s, { type: 'runDay' }).s;
    expect(after.delivery?.drep).not.toBe(T.delivery.startDRep);
    expect(after.delivery?.drep).not.toBeCloseTo(after.rep, 1);
  });

  test('Top rated: 14 days at the threshold earns it, falling below the lower line loses it (6.12)', () => {
    let d = { ...newDelivery(1, 'platform'), drep: 90 };
    for (let i = 0; i < T.delivery.topRatedDays; i++) {
      const n = nextDrep(d, 100, 50, 0, 50, 0, 1);
      d = { ...d, ...n };
    }
    expect(d.topRated).toBe(true);
    // Between the two lines the badge is kept.
    const kept = { ...d, ...nextDrep({ ...d, drep: T.delivery.topRatedLoseBelow + 2 }, 70, 50, 0, 50, 0, 1) };
    expect(kept.topRated).toBe(true);
    d = { ...d, ...nextDrep({ ...d, drep: T.delivery.topRatedLoseBelow - 4 }, 60, 50, 0, 50, 0, 1) };
    expect(d.topRated).toBe(false);
  });

  test('own riders need a vehicle; without riders on shift no orders go out', () => {
    let s = step(deliveryReady(), { type: 'startDelivery', mode: 'marketplace' }).s;
    expect(ridersToday(s).onShift).toBe(0);
    const none = simulateDay(s, analyse(s), { noise: false }).delivery;
    expect(none?.accepted).toBe(0);
    s.staff.push(staffFromSkill(8000, 'Rider', 'rider', 6, { morale: 60 }));
    s.staff.push(staffFromSkill(8001, 'Rider', 'rider', 6, { morale: 60 }));
    expect(ridersToday(s).onShift).toBe(0);
    s = step(s, { type: 'buyVehicle', kind: 'scooter' }).s;
    s = step(s, { type: 'buyVehicle', kind: 'bike' }).s;
    expect(ridersToday(s).onShift).toBeGreaterThan(0);
    const some = simulateDay(s, analyse(s), { noise: false }).delivery;
    expect(some?.delivered ?? 0).toBeGreaterThan(0);
  });

  test('delivery adds sales and costs to the P&L and shares the kitchen', () => {
    const s = step(deliveryReady('volume', 'university'), { type: 'startDelivery', mode: 'platform' }).s;
    const r = simulateDay(s, analyse(s), { noise: false });
    expect(r.pnl.deliverySales ?? 0).toBeGreaterThan(0);
    expect(r.pnl.deliveryCosts ?? 0).toBeGreaterThan(0);
    expect(r.delivery?.kitchenShare ?? 0).toBeGreaterThan(0);
    expect(r.delivery?.kitchenShare ?? 1).toBeLessThan(1);
  });
});
