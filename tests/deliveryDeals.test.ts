// Delivery deals, delivery marketing, the detailed delivery day and the tips to grow it.

import { describe, expect, test } from 'vitest';
import { CAMPAIGNS } from '../src/data/campaigns';
import { DELIVERY_DEAL_IDS, DELIVERY_DEALS } from '../src/data/deliveryDeals';
import { T } from '../src/data/tunables';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { dealTerms } from '../src/sim/delivery';
import { deliveryTips } from '../src/sim/deliveryAdvice';
import { apply, type Command } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import { campaignUnlocked, mktDelivery, newCampaign } from '../src/sim/marketing';
import { stateLocation } from '../src/sim/location';
import type { GameState } from '../src/sim/state';
import { buildState } from './balance/builds';

const step = (s: GameState, cmd: Command): GameState => {
  const r = apply(s, cmd, { noise: false });
  expect(r.error).toBeUndefined();
  return r.state;
};

/** A volume build near the university delivering through the app. */
function delivering(packing = 'packingStation'): GameState {
  const s = buildState('volume', 'university');
  s.rep = 70;
  s.daysOpen = 40;
  s.cash = 50000;
  s.following = 0.8;
  const { placed } = autoLayout([...s.equipment.map((e) => e.itemId), packing].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId);
  s.equipment = placed;
  // Plenty of kitchen headroom so deals show in orders, not refusals.
  return step(step(s, { type: 'startDelivery', mode: 'platform' }), { type: 'setDelivery', throttle: null });
}

const day = (s: GameState) => simulateDay(s, analyse(s), { noise: false });

describe('delivery deals', () => {
  test('every deal gives something away and wins orders', () => {
    for (const id of DELIVERY_DEAL_IDS) {
      const d = DELIVERY_DEALS[id];
      expect(d.orderLift, id).toBeGreaterThan(0);
      expect(d.mainsDiscount + d.sidesDiscount + (d.feeWaived ? 1 : 0), id).toBeGreaterThan(0);
    }
  });

  test('second pizza 25% off: more orders, bigger baskets, a lower price per main', () => {
    const base = delivering();
    const deal = step(base, { type: 'setDelivery', deal: 'secondPizza25' });
    const a = day(base).delivery!;
    const b = day(deal).delivery!;
    expect(b.wanted).toBeGreaterThan(a.wanted * 1.1);
    expect(b.mainsPerOrder!).toBeCloseTo(T.delivery.mainsPerOrder + 0.3, 6);
    expect(b.orderValue! / b.mainsPerOrder!).toBeLessThan(a.orderValue! / a.mainsPerOrder!);
    expect(b.dealGiven!).toBeGreaterThan(0);
    expect(b.deal).toBe('secondPizza25');
    // Guests find the price fairer: value goes up.
    expect(b.scores!.value).toBeGreaterThan(a.scores!.value);
  });

  test('a lunch deal leaves dinner alone', () => {
    const s = step(delivering(), { type: 'setDelivery', deal: 'lunchDeal' });
    expect(dealTerms(s.delivery, 'dinner').orderLift).toBe(0);
    expect(dealTerms(s.delivery, 'lunch').orderLift).toBeGreaterThan(0);
    const a = day(delivering()).delivery!;
    const b = day(s).delivery!;
    expect(b.byService!.dinner.wanted).toBeCloseTo(a.byService!.dinner.wanted, 6);
    expect(b.byService!.lunch.wanted).toBeGreaterThan(a.byService!.lunch.wanted);
  });

  test('free delivery costs the fee on every order, even on the app', () => {
    const s = step(delivering(), { type: 'setDelivery', deal: 'freeDelivery' });
    const d = day(s).delivery!;
    expect(d.feesWaived!).toBeCloseTo(d.delivered * T.delivery.fee, 6);
  });

  test('deals can be switched off, and unknown deals are refused', () => {
    let s = step(delivering(), { type: 'setDelivery', deal: 'mealDeal' });
    expect(s.delivery?.deal).toBe('mealDeal');
    s = step(s, { type: 'setDelivery', deal: null });
    expect(s.delivery?.deal).toBeNull();
    const r = apply(s, { type: 'setDelivery', deal: 'nope' as never }, { noise: false });
    expect(r.error).toBeDefined();
  });

  test('older saves without a deal field deliver as before', () => {
    const s = delivering();
    delete (s.delivery as { deal?: unknown }).deal;
    expect(day(s).delivery?.dealGiven).toBe(0);
  });
});

describe('delivery day details', () => {
  test('the day splits orders by service and crowd, and adds up', () => {
    const d = day(delivering()).delivery!;
    const by = d.byService!;
    expect(by.lunch.delivered + by.dinner.delivered).toBeCloseTo(d.delivered, 6);
    const crowds = Object.values(d.bySegment!).reduce((x, n) => x + (n ?? 0), 0);
    expect(crowds).toBeCloseTo(d.delivered, 6);
    expect(d.riderWages).toBe(0);
    const costs = (d.food ?? 0) + (d.commission ?? 0) + (d.packaging ?? 0) + (d.other ?? 0) + (d.riderWages ?? 0);
    expect(d.profit).toBeCloseTo((d.sales ?? 0) - costs, 6);
  });

  test('tips name a deal and delivery marketing when none run', () => {
    const s = delivering();
    const tips = deliveryTips(s, day(s).delivery);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.join(' ')).toMatch(/deal/i);
  });
});

describe('delivery marketing', () => {
  test('the new delivery campaigns lift delivery orders and need delivery running', () => {
    const s = delivering();
    const facts = stateLocation(s);
    for (const id of ['appVoucher', 'doorHangers', 'foodInfluencer'] as const) {
      expect(campaignUnlocked(s, CAMPAIGNS[id]), id).toBe(true);
      const c = newCampaign(id, [], s.day, facts);
      expect(mktDelivery([c], s.day, facts.shares), id).toBeGreaterThan(1.1);
    }
    const off = buildState('volume', 'university');
    expect(campaignUnlocked(off, CAMPAIGNS.doorHangers)).toBe(false);
    const own = step(delivering(), { type: 'setDelivery', mode: 'own' });
    expect(campaignUnlocked(own, CAMPAIGNS.doorHangers)).toBe(true);
    expect(campaignUnlocked(own, CAMPAIGNS.appVoucher)).toBe(false);
  });
});

describe('heated packing station', () => {
  test('counts as a packing station, packs faster and keeps food hotter', () => {
    const a = day(delivering()).delivery!;
    const b = day(delivering('heatedPackingStation')).delivery!;
    expect(b.delivered).toBeGreaterThan(0);
    expect(b.scores!.food).toBeGreaterThan(a.scores!.food);
    expect(b.time.dinner).toBeLessThan(a.time.dinner);
  });
});
