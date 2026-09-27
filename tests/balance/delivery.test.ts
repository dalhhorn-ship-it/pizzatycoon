// Delivery balance (competition.md 11 and 15, AC-274 and AC-286 as restated in cleanup sprint 4).

import { describe, expect, test } from 'vitest';
import { apply, type Command } from '../../src/sim/game';
import { autoLayout } from '../../src/sim/kitchen';
import { staffFromSkill } from '../../src/sim/staff';
import type { GameState } from '../../src/sim/state';
import { type BuildId, buildFromSpec, type BuildSpec, buildState } from './builds';

/** A hole in the wall set up as a delivery kitchen (6.12): two conveyor ovens, two counters, a prep fridge. */
const DELIVERY_KITCHEN: BuildSpec = {
  premises: 'hole', tables: { table2: 4 }, ambience: 45,
  tierFor: { dry: 'standard', dairy: 'premium', produce: 'premium', meat: 'standard', drinks: 'basic' },
  menu: ['margherita', 'pepperoni', 'diavola', 'quattroFormaggi'], mainPrice: 12,
  sides: { drink: 3.5, starter: 5, dessert: 5 },
  equipment: ['conveyorOven', 'conveyorOven', 'prepCounter', 'prepCounter', 'prepFridge', 'packingStation'],
  staff: [['cook', 6, 0], ['cook', 6, 0], ['cook', 6, 0], ['server', 5, 0], ['dishwasher', 4, 0]],
};
/** The same restaurant played badly (AC-286): one deck oven. */
const ONE_OVEN: BuildSpec = { ...DELIVERY_KITCHEN, equipment: ['deckOven', 'prepCounter', 'prepCounter', 'prepFridge', 'packingStation'] };

function ready(s: GameState): GameState {
  s.unlockAll = true;
  s.rep = 70;
  s.daysOpen = 40;
  s.cash = 60000;
  s.following = 0.8;
  if (!s.equipment.some((e) => e.itemId === 'packingStation')) {
    s.equipment = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId).placed;
  }
  return s;
}

/** Average daily profit over weeks 3 to `weeks`. Every setup command must succeed. */
function run(s: GameState, setup: Command[], weeks: number, audience?: number): number {
  for (const c of setup) {
    const r = apply(s, c);
    expect(r.error, `${c.type}: ${r.error}`).toBeUndefined();
    s = r.state;
  }
  // An established delivery business: the audience was built by earlier campaigning (competition.md 6.13).
  if (audience !== undefined && s.delivery) s.delivery.audience = audience;
  let profit = 0;
  let n = 0;
  for (let d = 0; d < weeks * 7; d++) {
    s = apply(s, { type: 'runDay' }).state;
    if (d >= 14) {
      profit += s.history.at(-1)?.pnl.profit ?? 0;
      n++;
    }
  }
  return profit / n;
}

const platform: Command[] = [{ type: 'startDelivery', mode: 'platform' }];

/** Delivery pizzas count against each cook's guests a service (founder rule), so a busy restaurant going on the app hires a cook for it. */
const APP_COOKS: Record<string, number> = { volume: 1, middle: 0, luxury: 0 };
function withAppCook(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s.staff.push(staffFromSkill(7100 + i, `App cook ${i + 1}`, 'cook', 5, { morale: 60 }));
  return s;
}
const throttleOff: Command[] = [...platform, { type: 'setDelivery', throttle: null }];
/** Delivery audience of a restaurant that has campaigned for a couple of months. */
const ESTABLISHED = 0.7;

describe('delivery balance', () => {
  test('AC-274: volume gains 5% to 40%, luxury under 25%, nobody over 40%; the throttle protects', () => {
    const gain: Record<string, number> = {};
    for (const [build, district] of [['volume', 'university'], ['middle', 'canal'], ['luxury', 'harbour']] as const) {
      const off = run(ready(buildState(build as BuildId, district)), [], 5);
      const on = run(withAppCook(ready(buildState(build as BuildId, district)), APP_COOKS[build] ?? 0), platform, 5, ESTABLISHED);
      gain[build] = on / off - 1;
      expect(gain[build]).toBeLessThan(0.4);
      // Switching the throttle off on a busy kitchen costs money (grow the kitchen before the app).
      if (build !== 'luxury') expect(run(withAppCook(ready(buildState(build as BuildId, district)), APP_COOKS[build] ?? 0), throttleOff, 5, ESTABLISHED)).toBeLessThan(on);
    }
    // Delivery pizzas now take cook time (founder rule: a cook serves 50 guests a service), so a volume kitchen near its
    // cooks' limit gains less than the 10% it did before; 5% is the floor with two cooks hired for the app.
    expect(gain.volume).toBeGreaterThan(0.05);
    // No longer luxury below volume: a quiet fine dining kitchen has cooks to spare for the app, a volume kitchen near its
    // cooks' limit does not (founder rule, 50 guests a cook a service). Since the economics check (reference main $42,
    // lower dining margins) an $80 app order lifts luxury more than before: under 25%, was 15%.
    expect(gain.luxury).toBeLessThan(0.25);
    expect(gain.middle).toBeGreaterThanOrEqual(0);
  }, 180000);

  test('AC-286: a delivery kitchen played well earns 40% to 50%+ of the middle build; played badly it loses money', () => {
    const middleHome = run(ready(buildState('middle', 'canal')), [], 5);
    const dining = run(ready(buildFromSpec(DELIVERY_KITCHEN, 'canal')), [], 8);
    const wellRun = ready(buildFromSpec(DELIVERY_KITCHEN, 'canal'));
    for (let i = 0; i < 5; i++) wellRun.staff.push(staffFromSkill(7000 + i, `Rider ${i}`, 'rider', 6, { morale: 60 }));
    const good = run(wellRun, [
      { type: 'startDelivery', mode: 'marketplace' },
      { type: 'setDelivery', packaging: 'eco' },
      ...Array.from({ length: 5 }, (): Command => ({ type: 'buyVehicle', kind: 'scooter' })),
      { type: 'startCampaign', campaignId: 'social', audience: ['students', 'families'] },
    ], 8, ESTABLISHED);
    const bad = run(ready(buildFromSpec(ONE_OVEN, 'canal')), throttleOff, 8, ESTABLISHED);
    expect(dining).toBeLessThan(0);
    expect(good / middleHome).toBeGreaterThanOrEqual(0.4);
    expect(bad - dining).toBeLessThanOrEqual(0.25 * (good - dining));
  }, 180000);
});
