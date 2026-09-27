// Founder rules: a cook serves about 50 guests a service (up to 75 for a top cook), a server about 35 (up to 50).
// Delivery audience: starts tiny, grows slowly by word of mouth and fast with delivery campaigns.

import { describe, expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import { analyse, ownerShifts } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { audienceOf, newDelivery, nextAudience } from '../src/sim/delivery';
import { apply } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import { staffFromSkill } from '../src/sim/staff';
import type { GameState } from '../src/sim/state';
import { buildState } from './balance/builds';

const day = (s: GameState) => simulateDay(s, analyse(s), { noise: false });

describe('guests per cook', () => {
  test('a cook at Speed 50 cooks for 50 guests a service; faster cooks more, never over 75; slower ones fewer', () => {
    const one = (speed: number, talent: 'speedy' | null = null): number => {
      const s = buildState('middle', 'canal');
      const c = staffFromSkill(1, 'Cook', 'cook', 5, { morale: 50 }); // morale 50 is neutral speed
      c.attrs.speed = speed;
      if (talent) c.talent = talent;
      s.staff = [c, ...s.staff.filter((x) => x.role !== 'cook' && x.role !== 'chef')];
      return analyse(s).kitchen.cookGuests;
    };
    expect(one(50)).toBeGreaterThan(45);
    expect(one(50)).toBeLessThanOrEqual(55);
    expect(one(99)).toBeGreaterThan(one(50));
    expect(one(99, 'speedy')).toBeLessThanOrEqual(T.kitchen.guestsPerCookMax);
    expect(one(99, 'speedy')).toBeGreaterThan(70);
    expect(one(10)).toBeLessThan(one(50));
    expect(one(1)).toBeGreaterThanOrEqual(T.kitchen.guestsPerCookMin);
  });

  test('one cook caps a busy service, and hiring another lifts it', () => {
    const s = buildState('volume', 'university');
    s.rep = 70;
    s.following = 1;
    const cooks = s.staff.filter((x) => x.role === 'cook');
    const lone = { ...s, staff: [...s.staff.filter((x) => x.role !== 'cook'), cooks[0]!] };
    const r = day(lone);
    const dinner = r.services.find((x) => x.service === 'dinner')!;
    expect(dinner.served).toBeLessThanOrEqual(analyse(lone).kitchen.cookGuests + 0.5);
    expect(dinner.bottleneck).toBe('cooks');
    const two = { ...s, staff: [...s.staff.filter((x) => x.role !== 'cook'), cooks[0]!, cooks[1]!] };
    expect(day(two).covers).toBeGreaterThan(r.covers);
  });
});

describe('guests per server', () => {
  test('one server caps a full room, and hiring another lifts it', () => {
    const s = buildState('volume', 'university');
    s.rep = 70;
    s.following = 1;
    const servers = s.staff.filter((x) => x.role === 'server');
    const lone = { ...s, staff: [...s.staff.filter((x) => x.role !== 'server'), servers[0]!] };
    const a = analyse(lone);
    expect(a.service.serverGuests.dinner).toBeGreaterThan(15);
    expect(a.service.serverGuests.dinner).toBeLessThanOrEqual(T.service.guestsPerServerMax);
    const r = day(lone);
    const dinner = r.services.find((x) => x.service === 'dinner')!;
    expect(dinner.served).toBeLessThanOrEqual(a.service.serverGuests.dinner + 0.5);
    expect(dinner.bottleneck).toBe('servers');
    const two = { ...s, staff: [...s.staff.filter((x) => x.role !== 'server'), servers[0]!, servers[1]!] };
    expect(day(two).covers).toBeGreaterThan(r.covers);
  });
});

describe('delivery audience', () => {
  function delivering(): GameState {
    const s = buildState('volume', 'university');
    s.rep = 70;
    s.daysOpen = 40;
    s.cash = 50000;
    s.following = 0.8;
    s.equipment = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId).placed;
    return apply(s, { type: 'startDelivery', mode: 'platform' }, { noise: false }).state;
  }

  test('a new delivery starts with hardly anyone knowing; old saves keep an established audience', () => {
    expect(newDelivery(1, 'platform').audience).toBe(T.delivery.audienceStart);
    expect(audienceOf({})).toBe(T.delivery.audienceLegacy);
    const s = delivering();
    const r = day(s);
    s.delivery!.audience = 1;
    expect(r.delivery!.wanted).toBeLessThan(0.1 * day(s).delivery!.wanted);
  });

  test('word of mouth alone takes months; campaigns build it in weeks', () => {
    const d = newDelivery(1, 'platform');
    d.drep = 60;
    let alone = d.audience!;
    let pushed = d.audience!;
    for (let i = 0; i < 28; i++) {
      alone = nextAudience({ ...d, audience: alone }, 0, 10).after;
      pushed = nextAudience({ ...d, audience: pushed }, 0.45, 10).after;
    }
    expect(alone).toBeLessThan(0.12);
    expect(pushed).toBeGreaterThan(0.6);
  });

  test('the day carries the audience forward', () => {
    let s = delivering();
    const before = s.delivery!.audience!;
    s = apply(s, { type: 'startCampaign', campaignId: 'promotedListing', audience: [] }, { noise: false }).state;
    for (let i = 0; i < 7; i++) s = apply(s, { type: 'runDay' }, { noise: false }).state;
    expect(s.delivery!.audience!).toBeGreaterThan(before + 0.1);
  });
});

describe('economics check (balance.md 5)', () => {
  test('the owner works shifts where they run the place, not where a manager does', () => {
    const s = buildState('middle', 'canal');
    const wages = s.staff.reduce((x, y) => x + y.salary, 0);
    expect(ownerShifts(s)).toBeCloseTo(T.staff.ownerShiftShare * 1100, 5);
    expect(analyse(s).weeklySalaries).toBeCloseTo(wages - ownerShifts(s), 5);
    expect(ownerShifts({ ...s, ownerAway: true })).toBe(0);
    const managed = { ...s, staff: [...s.staff, staffFromSkill(9990, 'M', 'manager', 6)] };
    expect(ownerShifts(managed)).toBe(0);
  });

  test('a heat lamp pass lets each server look after more guests', () => {
    const s = buildState('volume', 'university');
    const without = { ...s, equipment: s.equipment.filter((e) => e.itemId !== 'heatLampPass') };
    expect(analyse(s).service.serverGuests.dinner).toBeGreaterThan(analyse(without).service.serverGuests.dinner * 1.15);
  });

  test('running costs take a share of dining sales and a fixed amount per tile', () => {
    const s = buildState('middle', 'canal');
    const r = day(s);
    const fixed = T.finance.utilitiesBase + T.finance.utilitiesPerCover * r.covers;
    expect(r.pnl.utilities).toBeGreaterThan(fixed + T.finance.runningShare * r.pnl.sales);
  });
});
