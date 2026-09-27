// Delivery balance (competition.md 11, AC-274 and AC-286).

import { describe, expect, test } from 'vitest';
import { apply, type Command } from '../../src/sim/game';
import { autoLayout } from '../../src/sim/kitchen';
import { staffFromSkill } from '../../src/sim/staff';
import type { GameState } from '../../src/sim/state';
import { type BuildId, buildFromSpec, type BuildSpec, buildState } from './builds';

/** A hole in the wall set up as a delivery kitchen (6.12). */
const DELIVERY_KITCHEN: BuildSpec = {
  premises: 'hole', tables: { table2: 4 }, ambience: 45,
  tierFor: { dry: 'standard', dairy: 'premium', produce: 'premium', meat: 'standard', drinks: 'basic' },
  menu: ['margherita', 'pepperoni', 'diavola', 'quattroFormaggi'], mainPrice: 12,
  sides: { drink: 3.5, starter: 5, dessert: 5 },
  equipment: ['deckOven', 'deckOven', 'prepCounter', 'prepCounter', 'prepFridge', 'packingStation'],
  staff: [['cook', 6, 0], ['cook', 6, 0], ['cook', 6, 0], ['server', 5, 0], ['dishwasher', 4, 0]],
};
/** The same kitchen played badly (AC-286): one oven. */
const ONE_OVEN: BuildSpec = { ...DELIVERY_KITCHEN, equipment: DELIVERY_KITCHEN.equipment.filter((e, i) => e !== 'deckOven' || i > 0) };
const SPECS: Record<string, BuildSpec> = { deliveryKitchen: DELIVERY_KITCHEN, oneOven: ONE_OVEN };

function ready(build: string, district: string): GameState {
  const s = SPECS[build] ? buildFromSpec(SPECS[build] as BuildSpec, district) : buildState(build as BuildId, district);
  s.rep = 70;
  s.daysOpen = 40;
  s.cash = 60000;
  s.following = 0.8;
  if (!s.equipment.some((e) => e.itemId === 'packingStation')) {
    s.equipment = autoLayout([...s.equipment.map((e) => e.itemId), 'packingStation'].map((itemId, i) => ({ uid: 9000 + i, itemId })), s.premisesId).placed;
  }
  return s;
}

/** Average daily profit and the final delivery rating over weeks 3 to `weeks`. */
function run(s: GameState, setup: Command[], weeks: number): { profit: number; drep: number } {
  for (const c of setup) s = apply(s, c).state;
  let profit = 0;
  let n = 0;
  for (let d = 0; d < weeks * 7; d++) {
    s = apply(s, { type: 'runDay' }).state;
    if (d >= 14) {
      profit += s.history.at(-1)?.pnl.profit ?? 0;
      n++;
    }
  }
  return { profit: profit / n, drep: s.delivery?.drep ?? 0 };
}

// AC-274's per build bands and AC-286's 60% target are Open (competition.md 15.2, cleanup sprint 4); these checks pin
// what holds today so a change cannot make it worse unnoticed.
describe('delivery balance', () => {
  test('AC-274: delivery helps the volume build, and no reference build gains more than 40%', () => {
    for (const [build, district] of [['volume', 'university'], ['middle', 'canal'], ['luxury', 'harbour']] as const) {
      const off = run(ready(build, district), [], 4).profit;
      const on = run(ready(build, district), [{ type: 'startDelivery', mode: 'platform' }], 4).profit;
      expect(on / off).toBeLessThan(1.4);
      if (build === 'volume') expect(on / off).toBeGreaterThan(1.1);
    }
  }, 120000);

  test('AC-286: a small kitchen run well as a delivery kitchen turns a loss into a solid profit; run badly it rates lower', () => {
    const dining = run(ready('deliveryKitchen', 'canal'), [], 8).profit;
    const wellRun = ready('deliveryKitchen', 'canal');
    for (let i = 0; i < 5; i++) wellRun.staff.push(staffFromSkill(7000 + i, `Rider ${i}`, 'rider', 6, { morale: 60 }));
    const good = run(wellRun, [
      { type: 'startDelivery', mode: 'marketplace' },
      { type: 'setDelivery', packaging: 'eco' },
      ...Array.from({ length: 5 }, (): Command => ({ type: 'buyVehicle', kind: 'scooter' })),
      { type: 'startCampaign', campaignId: 'social', audience: ['students', 'families'] },
    ], 8);
    const bad = run(ready('oneOven', 'canal'), [{ type: 'startDelivery', mode: 'platform' }, { type: 'setDelivery', throttle: null }], 8);
    expect(dining).toBeLessThan(0);
    expect(good.profit - dining).toBeGreaterThan(400);
    expect(good.drep).toBeGreaterThan(bad.drep + 10);
  }, 120000);
});
