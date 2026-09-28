// kitchen-upgrades.md 12: stations and add-ons that lean to speed, quality or both.
import { describe, expect, test } from 'vitest';
import { ADDONS, addonEffectText, UPGRADE_PATHS } from '../src/data/addons';
import { EQUIPMENT } from '../src/data/equipment';
import { analyse } from '../src/sim/analysis';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import type { GameState } from '../src/sim/state';

const starter = (): GameState => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.cash = 200000;
  s.day = 20;
  s.rep = 80;
  s.totalServed = 5000;
  s.rank = 'restaurateur';
  return s;
};
const uidOf = (s: GameState, itemId: string): number => s.equipment.find((e) => e.itemId === itemId)!.uid;
const swap = (s: GameState, from: string, to: string): GameState => {
  const t = structuredClone(s);
  for (const e of t.equipment) if (e.itemId === from) e.itemId = to;
  return t;
};

describe('new stations', () => {
  test('every upgrade path and add-on names real equipment', () => {
    for (const [a, b] of UPGRADE_PATHS) {
      expect(EQUIPMENT[a], a).toBeDefined();
      expect(EQUIPMENT[b], b).toBeDefined();
    }
    for (const a of Object.values(ADDONS)) for (const id of a.fits) expect(EQUIPMENT[id], `${a.id} fits ${id}`).toBeDefined();
  });

  test('speed: an air impinger oven bakes far faster than a deck oven, at a small quality cost', () => {
    const s = starter();
    const t = swap(s, 'deckOven', 'airImpingerOven');
    expect(analyse(t).kitchen.ovenPerHour).toBeGreaterThan(analyse(s).kitchen.ovenPerHour * 1.3);
    expect(analyse(t).kitchen.equipmentE).toBeLessThan(analyse(s).kitchen.equipmentE);
  });

  test('both: a dual fuel oven is faster and better than a deck oven', () => {
    const s = starter();
    s.staff.forEach((x) => { x.attrs.quality = 80; });
    const t = swap(s, 'deckOven', 'dualFuelOven');
    expect(analyse(t).kitchen.ovenPerHour).toBeGreaterThan(analyse(s).kitchen.ovenPerHour);
    expect(analyse(t).kitchen.equipmentE).toBeGreaterThan(analyse(s).kitchen.equipmentE + 5);
  });

  test('quality: a mother dough cellar beats the retarder prover and keeps dough cold', () => {
    expect(EQUIPMENT.motherDoughCellar!.qualityMod).toBeGreaterThan(EQUIPMENT.retarderProver!.qualityMod);
    expect(EQUIPMENT.motherDoughCellar!.coldCap).toBeGreaterThan(0);
  });

  test('both: a pizzaiolo station preps faster and better than a prep counter', () => {
    const s = starter();
    const t = swap(s, 'prepCounter', 'pizzaioloStation');
    expect(analyse(t).kitchen.prepPerHour).toBeGreaterThan(analyse(s).kitchen.prepPerHour * 1.2);
    expect(analyse(t).kitchen.equipmentE).toBeGreaterThan(analyse(s).kitchen.equipmentE);
  });

  test('an expo pass serves faster than a heat lamp pass', () => {
    const s = starter();
    const withPass = apply(s, { type: 'buyEquipment', itemId: 'heatLampPass' }).state;
    const expo = swap(withPass, 'heatLampPass', 'expoPass');
    expect(analyse(expo).service.serveTime.dinner).toBeLessThan(analyse(withPass).service.serveTime.dinner);
  });
});

describe('new add-ons', () => {
  test('a convection fan trades a point of quality for speed', () => {
    const s = starter();
    const r = apply(s, { type: 'installAddon', uid: uidOf(s, 'deckOven'), addonId: 'convectionFan' });
    expect(r.error).toBeUndefined();
    expect(analyse(r.state).kitchen.ovenPerHour).toBeCloseTo(analyse(s).kitchen.ovenPerHour / 0.85, 5);
    expect(analyse(r.state).kitchen.equipmentE).toBeCloseTo(analyse(s).kitchen.equipmentE - 1, 5);
    expect(addonEffectText(ADDONS.convectionFan!)).toBe('Bakes 15% faster, -1 pizza quality');
  });

  test('an infrared top heater is faster and better', () => {
    const s = starter();
    const r = apply(s, { type: 'installAddon', uid: uidOf(s, 'deckOven'), addonId: 'infraredBroiler' });
    expect(r.error).toBeUndefined();
    expect(analyse(r.state).kitchen.ovenPerHour).toBeGreaterThan(analyse(s).kitchen.ovenPerHour);
    expect(analyse(r.state).kitchen.equipmentE).toBeGreaterThan(analyse(s).kitchen.equipmentE);
  });

  test('fresh basil pots slow the bench a little for better pizza', () => {
    const s = starter();
    const r = apply(s, { type: 'installAddon', uid: uidOf(s, 'prepCounter'), addonId: 'basilPots' });
    expect(r.error).toBeUndefined();
    expect(analyse(r.state).kitchen.equipmentE).toBeGreaterThan(analyse(s).kitchen.equipmentE);
    expect(addonEffectText(ADDONS.basilPots!)).toBe('Prep 3% slower, +2 pizza quality');
  });
});
