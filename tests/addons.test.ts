// kitchen-upgrades.md (AC-175 onward).
import { describe, expect, test } from 'vitest';
import { ADDONS } from '../src/data/addons';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import type { GameState } from '../src/sim/state';
import { buildState, steadyState } from './balance/builds';

const starter = (): GameState => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.cash = 50000;
  s.day = 20;
  s.rep = 60;
  s.totalServed = 2000;
  return s;
};
const uidOf = (s: GameState, itemId: string): number => s.equipment.find((e) => e.itemId === itemId)!.uid;

describe('add-ons', () => {
  test('a pizza stone raises dish quality by 2 and costs upkeep', () => {
    const s = starter();
    const r = apply(s, { type: 'installAddon', uid: uidOf(s, 'deckOven'), addonId: 'pizzaStone' });
    expect(r.error).toBeUndefined();
    expect(analyse(r.state).kitchen.equipmentE - analyse(s).kitchen.equipmentE).toBeCloseTo(2, 5);
    expect(analyse(r.state).kitchen.maintenancePerWeek - analyse(s).kitchen.maintenancePerWeek).toBe(2);
    expect(r.state.cash).toBe(s.cash - 500);
  });

  test('a thermostat tune up makes the oven faster', () => {
    const s = starter();
    const r = apply(s, { type: 'installAddon', uid: uidOf(s, 'deckOven'), addonId: 'thermostatTune' });
    expect(analyse(r.state).kitchen.ovenPerHour).toBeCloseTo(analyse(s).kitchen.ovenPerHour / 0.93, 5);
  });

  test('at most two per station, no duplicates, must fit', () => {
    let s = starter();
    const oven = uidOf(s, 'deckOven');
    s = apply(s, { type: 'installAddon', uid: oven, addonId: 'pizzaStone' }).state;
    expect(apply(s, { type: 'installAddon', uid: oven, addonId: 'pizzaStone' }).error).toMatch(/Already/);
    s = apply(s, { type: 'installAddon', uid: oven, addonId: 'thermostatTune' }).state;
    expect(apply(s, { type: 'installAddon', uid: oven, addonId: 'extraDeckRack' }).error).toMatch(/fit|full/);
    expect(apply(s, { type: 'installAddon', uid: uidOf(s, 'sink'), addonId: 'pizzaStone' }).error).toMatch(/fit/);
  });

  test('quality from add-ons is capped (qualityCap)', () => {
    let s = starter();
    s = apply(s, { type: 'installAddon', uid: uidOf(s, 'deckOven'), addonId: 'pizzaStone' }).state;
    for (const c of s.equipment.filter((e) => e.itemId === 'prepCounter')) {
      s = apply(s, { type: 'installAddon', uid: c.uid, addonId: 'marbleInsert' }).state;
      s = apply(s, { type: 'installAddon', uid: c.uid, addonId: 'portionScale' }).state;
    }
    expect(analyse(s).kitchen.addonE).toBe(2);
  });

  test('remove refunds 80%; selling a station refunds its add-ons too', () => {
    let s = starter();
    const oven = uidOf(s, 'deckOven');
    s = apply(s, { type: 'installAddon', uid: oven, addonId: 'pizzaStone' }).state;
    const removed = apply(s, { type: 'removeAddon', uid: oven, addonId: 'pizzaStone' }).state;
    expect(removed.cash - s.cash).toBe(400);
    const sold = apply(s, { type: 'sellEquipment', uid: oven }).state;
    expect(sold.cash - s.cash).toBe(400 + 3840);
  });

  test('wash, serve and waste add-ons move their numbers', () => {
    let s = starter();
    const sink = uidOf(s, 'sink');
    const before = analyse(s);
    s = apply(s, { type: 'installAddon', uid: sink, addonId: 'preRinseSpray' }).state;
    expect(analyse(s).service.platesPerHour).toBeCloseTo(before.service.platesPerHour * 1.12, 5);
    const fridge = uidOf(s, 'doughFridge');
    const w0 = simulateDay(s, analyse(s), { noise: false }).pnl.waste;
    s = apply(s, { type: 'installAddon', uid: fridge, addonId: 'tempLogger' }).state;
    expect(simulateDay(s, analyse(s), { noise: false }).pnl.waste).toBeCloseTo(w0 * 0.8, 5);
  });

  test('a drawer unit gives cold at hand two tiles away', () => {
    let s = starter();
    const fridge = s.equipment.find((e) => e.itemId === 'doughFridge')!;
    s = apply(s, { type: 'moveEquipment', uid: fridge.uid, x: 7, y: 2, rot: 0 }).state;
    const counter = s.equipment.find((e) => e.itemId === 'prepCounter' && e.y === 2)!;
    expect(analyse(s).kitchen.flow.stations[counter.uid]?.coldMult).toBe(1);
    s = apply(s, { type: 'installAddon', uid: fridge.uid, addonId: 'drawerUnit' }).state;
    expect(analyse(s).kitchen.flow.stations[counter.uid]?.coldMult).toBeCloseTo(1.05, 5);
  });

  test('trade in keeps position and compatible add-ons, refunds the rest', () => {
    let s = starter();
    const oven = uidOf(s, 'deckOven');
    s = apply(s, { type: 'installAddon', uid: oven, addonId: 'pizzaStone' }).state;
    s = apply(s, { type: 'installAddon', uid: oven, addonId: 'thermostatTune' }).state;
    const before = s.equipment.find((e) => e.uid === oven)!;
    const r = apply(s, { type: 'upgradeStation', uid: oven, toItemId: 'stoneHearthOven' });
    expect(r.error).toBeUndefined();
    const after = r.state.equipment.find((e) => e.uid === oven)!;
    expect(after.itemId).toBe('stoneHearthOven');
    expect([after.x, after.y]).toEqual([before.x, before.y]);
    expect(after.addons?.map((a) => a.id)).toEqual(['thermostatTune']);
    // $12,000 minus 80% of the $4,800 oven minus 80% of the $500 stone.
    expect(s.cash - r.state.cash).toBe(12000 - 3840 - 400);
    expect(apply(s, { type: 'upgradeStation', uid: oven, toItemId: 'woodFiredOven' }).error).toMatch(/not an upgrade/);
  });

  test('every add-on names a real station and has a modest effect', async () => {
    const { EQUIPMENT } = await import('../src/data/equipment');
    for (const a of Object.values(ADDONS)) {
      for (const id of a.fits) expect(EQUIPMENT[id], `${a.id} fits ${id}`).toBeDefined();
      for (const m of [a.bakeMult, a.prepMult, a.washMult, a.serveMult, a.wasteMult]) if (m) expect(Math.abs(1 - m)).toBeLessThanOrEqual(0.2);
      if (a.qualityAdd) expect(a.qualityAdd).toBeLessThanOrEqual(3);
    }
  });
});

describe('balance with add-ons (kitchen-upgrades.md 7)', () => {
  test('a fully upgraded middle build still trails each specialist at home by 15% or more', () => {
    const upgrade = (s: GameState): GameState => {
      const plan: Record<string, string[]> = {
        stoneHearthOven: ['thermostatTune'],
        prepCounter: ['marbleInsert', 'portionScale'],
        doughFridge: ['tempLogger', 'drawerUnit'],
        sink: ['preRinseSpray', 'dryingRacks'],
      };
      s.equipment = s.equipment.map((e) => ({ ...e, addons: (plan[e.itemId] ?? []).map((id) => ({ id, paid: ADDONS[id]!.price })) }));
      return s;
    };
    const best = (d: string, prices: number[]): number =>
      Math.max(...prices.map((p) => steadyState(upgrade(buildState('middle', d, p))).report.pnl.profit));
    // Each specialist's best home profit (kitchen-upgrades.md 7), searched over its price band like the middle build.
    const specialist = (b: 'volume' | 'luxury', d: string, prices: number[]): number =>
      Math.max(...prices.map((p) => steadyState(buildState(b, d, p)).report.pnl.profit));
    const volume = specialist('volume', 'university', [8, 8.5, 9]);
    const luxury = specialist('luxury', 'harbour', [36, 38, 40]);
    const midUni = best('university', [12, 13, 14]);
    const midHarbour = best('harbour', [14, 16, 18]);
    console.log(`upgraded middle: university $${Math.round(midUni)} vs volume $${Math.round(volume)}; harbour $${Math.round(midHarbour)} vs luxury $${Math.round(luxury)}`);
    expect(volume).toBeGreaterThanOrEqual(1.15 * midUni);
    expect(luxury).toBeGreaterThanOrEqual(1.15 * midHarbour);
  });
});
