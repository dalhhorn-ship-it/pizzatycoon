// The coach, market analytics, managed restaurants in the live market, and the market commands (cleanup sprint 4:
// QA6, QA7, QA10).

import { describe, expect, test } from 'vitest';
import { CAMPAIGNS } from '../src/data/campaigns';
import { T } from '../src/data/tunables';
import { VENUES } from '../src/data/venues';
import { PRESETS, RIVAL_PRESETS } from '../src/sim/economy';
import { apply, type Command } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import { coach, districtShare } from '../src/sim/market';
import { campaignUnlocked } from '../src/sim/marketing';
import { activeRivals, rivalAt, seedRivals } from '../src/sim/rivals';
import { deserialise } from '../src/save/saveFile';
import type { GameState } from '../src/sim/state';
import { buildState } from './balance/builds';
import saveV6 from './fixtures/save-v6.json?raw';

const step = (s: GameState, cmd: Command): GameState => {
  const r = apply(s, cmd, { noise: false });
  expect(r.error, `${cmd.type}: ${r.error}`).toBeUndefined();
  return r.state;
};
const days = (s: GameState, n: number): GameState => {
  for (let i = 0; i < n; i++) s = apply(s, { type: 'runDay' }, { noise: false }).state;
  return s;
};
const live = (seed = 2): GameState => {
  const s = buildState('middle', 'canal');
  s.seed = seed;
  s.rep = 60;
  s.following = 0.6;
  s.cash = 30000;
  s.economy = { ...PRESETS.normal, rivals: RIVAL_PRESETS.normal };
  seedRivals(s);
  return s;
};

describe('the coach (AC-259)', () => {
  test('a full restaurant hears the full house advice', () => {
    // Cheap mains in the middle build: more guests than both services can seat.
    const full = buildState('middle', 'canal', 9);
    full.rep = 80;
    full.following = 1;
    const s = days(full, 7);
    expect(s.history.at(-1)?.services.every((x) => x.rho > 1)).toBe(true);
    expect(coach(s).map((x) => x.id)).toContain('fullHouse');
  });

  test('at most two situations, most at stake first, each with 1 to 3 answers', () => {
    for (const seed of [1, 2, 3]) {
      const s = days(live(seed), 21);
      const sits = coach(s);
      expect(sits.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < sits.length; i++) expect(sits[i - 1]!.stake).toBeGreaterThanOrEqual(sits[i]!.stake);
      for (const x of sits) {
        expect(x.answers.length).toBeGreaterThanOrEqual(1);
        expect(x.answers.length).toBeLessThanOrEqual(3);
      }
    }
  });

  test('every campaign the coach suggests exists and can be started as suggested', () => {
    for (const seed of [1, 2, 3, 4]) {
      let s = days(live(seed), 21);
      s = { ...s, unlockAll: true, cash: 50000 };
      for (const sit of coach(s)) {
        for (const a of sit.answers) {
          if (a.action.kind !== 'campaign') continue;
          const c = CAMPAIGNS[a.action.id];
          expect(c, a.action.id).toBeDefined();
          expect(campaignUnlocked(s, c!)).toBe(true);
          const r = apply(s, { type: 'startCampaign', campaignId: a.action.id, audience: a.action.audience });
          expect(r.error ?? '', `${a.action.id} ${a.action.audience.join(',')}`).not.toMatch(/Unknown|Pick 1/);
        }
      }
    }
  });
});

describe('market analytics (AC-254)', () => {
  test('shares of a neighbourhood add up, and yours is your guests over all pizza guests', () => {
    const s = days(live(2), 14);
    const rows = districtShare(s, s.districtId);
    const total = rows.reduce((a, r) => a + r.total, 0);
    const you = rows.find((r) => r.who === 'you');
    expect(you).toBeDefined();
    const mine = s.history.slice(-7).reduce((a, r) => a + r.covers, 0);
    expect(you!.total).toBeCloseTo(mine, 6);
    expect(rows.reduce((a, r) => a + r.total / total, 0)).toBeCloseTo(1, 9);
  });
});

describe('managed restaurants in the live market (QA7)', () => {
  test('a campaign at a managed restaurant renews from the shared cash and lifts its guests', () => {
    let s = deserialise(saveV6).state;
    s.unlockAll = true;
    const branch = s.branches[0]!;
    s = step(s, { type: 'startCampaign', campaignId: 'flyers', audience: [], locationId: branch.id });
    expect(s.branches[0]!.campaigns.map((c) => c.id)).toEqual(['flyers']);
    const cash = s.cash;
    s = days(s, 8);
    const run = s.branches[0]!.campaigns.find((c) => c.id === 'flyers');
    expect(run?.weeksRunning).toBeGreaterThanOrEqual(2);
    expect(s.cash).not.toBe(cash);
  });

  test('delivery keeps running at a restaurant after you leave it for another', () => {
    let s = deserialise(saveV6).state;
    const branchId = s.branches[0]!.id;
    const home = s.locationId;
    s.rep = 70;
    s.daysOpen = 40;
    s.equipment = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9500 + i, itemId })), s.premisesId).placed;
    s = step(s, { type: 'startDelivery', mode: 'platform' });
    s = step(s, { type: 'switchRestaurant', locationId: branchId });
    const managed = s.branches.find((b) => b.id === home)!;
    expect(managed.delivery?.on).toBe(true);
    const drep = managed.delivery!.drep;
    s = days(s, 7);
    const after = s.branches.find((b) => b.id === home)!;
    expect(after.delivery?.drep).not.toBe(drep);
    expect(after.history.some((r) => (r.delivery?.delivered ?? 0) > 0)).toBe(true);
    expect(after.kpis.at(-1)?.deliveryOrders ?? 0).toBeGreaterThan(0);
  });
});

describe('market commands (QA10)', () => {
  test('holding a venue costs a week of rent, keeps rivals off it and is one at a time', () => {
    let s = live(2);
    const free = Object.keys(VENUES).filter((v) => v !== s.venueId && !rivalAt(s, v));
    const cash = s.cash;
    s = step(s, { type: 'holdVenue', venueId: free[0]! });
    expect(s.venueHold?.venueId).toBe(free[0]);
    expect(s.cash).toBeLessThan(cash);
    expect(apply(s, { type: 'holdVenue', venueId: free[1]! }).error).toMatch(/one venue at a time/);
    s = days(s, 21);
    expect(rivalAt(s, free[0]!)).toBeUndefined();
    expect(activeRivals(s).length).toBeGreaterThan(0);
  });

  test('stopping a campaign lets the current run finish and stops renewal', () => {
    let s = buildState('middle', 'canal');
    s.unlockAll = true;
    s.cash = 5000;
    s = step(s, { type: 'startCampaign', campaignId: 'flyers', audience: [] });
    s = step(s, { type: 'stopCampaign', campaignId: 'flyers' });
    expect(s.campaigns[0]?.renew).toBe(false);
    s = days(s, 10);
    expect(s.campaigns.filter((c) => c.id === 'flyers' && s.day < c.endsDay)).toHaveLength(0);
  });

  test('pausing delivery stops orders; a vehicle sells for 80%', () => {
    let s = buildState('middle', 'canal');
    s.rep = 70;
    s.daysOpen = 40;
    s.cash = 20000;
    s.equipment = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9500 + i, itemId })), s.premisesId).placed;
    s = step(s, { type: 'startDelivery', mode: 'marketplace' });
    s = step(s, { type: 'buyVehicle', kind: 'scooter' });
    const before = s.cash;
    s = step(s, { type: 'sellVehicle', kind: 'scooter' });
    expect(s.cash - before).toBe(Math.round(T.delivery.scooter.price * 0.8));
    s = step(s, { type: 'stopDelivery' });
    s = days(s, 2);
    expect(s.history.at(-1)?.delivery).toBeUndefined();
  });
});
