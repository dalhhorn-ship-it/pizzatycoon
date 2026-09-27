// Higher end kitchen equipment (kitchen-upgrades.md 11).

import { describe, expect, test } from 'vitest';
import { ADDONS, UPGRADE_PATHS } from '../src/data/addons';
import { EQUIPMENT } from '../src/data/equipment';
import { analyse } from '../src/sim/analysis';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { autoLayout, kitchenDims, layoutProblem } from '../src/sim/kitchen';
import type { GameState } from '../src/sim/state';
import { buildState } from './balance/builds';

const NEW = [
  'electricDeckOven', 'gasStoneOven', 'tripleDeckOven', 'rotatingStoneOven', 'twinConveyorOven', 'neapolitanDomeOven', 'steelPrepTable', 'graniteBench',
  'refrigeratedMakeLine', 'olivewoodBench', 'precisionSheeter', 'doughDivider', 'retarderProver', 'heatedStonePass', 'hoodDishwasher', 'blastChiller',
  'doubleDoorFridge', 'heatedPackingStation', 'plateWarmer',
];

/** A volume build with everything unlocked and cash to spare. */
function rich(): GameState {
  const s = buildState('volume', 'university');
  s.cash = 200000;
  s.rep = 80;
  s.totalServed = 5000;
  s.day = 100;
  s.rank = 'chainFounder';
  return s;
}

/** Trade one station of `from` in for `to` on the same tiles. */
function upgrade(s: GameState, from: string, to: string): GameState {
  const e = s.equipment.find((x) => x.itemId === from);
  expect(e, from).toBeDefined();
  const r = apply(s, { type: 'upgradeStation', uid: e!.uid, toItemId: to }, { noise: false });
  expect(r.error, `${from} to ${to}`).toBeUndefined();
  return r.state;
}

describe('higher end equipment', () => {
  test('all new items exist, have a footprint that matches their size and fit a kitchen on their own', () => {
    for (const id of NEW) {
      const it = EQUIPMENT[id];
      expect(it, id).toBeDefined();
      expect(it!.footprint, id).toBe(it!.w * it!.h);
      if (it!.role === 'pass') continue;
      const { placed, unplaced } = autoLayout([{ uid: 1, itemId: id }], 'medium');
      expect(unplaced, id).toEqual([]);
      expect(layoutProblem(placed, kitchenDims('medium')), id).toBeNull();
    }
  });

  test('every upgrade path and add-on names real equipment', () => {
    for (const [from, to] of UPGRADE_PATHS) {
      expect(EQUIPMENT[from], from).toBeDefined();
      expect(EQUIPMENT[to], to).toBeDefined();
      expect(EQUIPMENT[from]!.role, `${from} to ${to}`).toBe(EQUIPMENT[to]!.role);
    }
    for (const a of Object.values(ADDONS)) for (const id of a.fits) expect(EQUIPMENT[id], `${a.id} fits ${id}`).toBeDefined();
  });

  test('a heated stone pass serves faster than the heat lamp pass and adds quality', () => {
    const s = rich();
    const t = upgrade(s, 'heatLampPass', 'heatedStonePass');
    expect(analyse(t).service.serveTime.dinner).toBeLessThan(analyse(s).service.serveTime.dinner);
    expect(analyse(t).kitchen.equipmentE).toBeCloseTo(analyse(s).kitchen.equipmentE + 2, 5);
  });

  test('a hood dishwasher washes faster than the dish machine', () => {
    const s = rich();
    const t = upgrade(s, 'dishMachine', 'hoodDishwasher');
    expect(analyse(t).service.platesPerHour).toBeGreaterThan(analyse(s).service.platesPerHour * 1.2);
  });

  test('an attached precision press keeps the sheeter speed without its quality cost', () => {
    const s = rich();
    const t = upgrade(s, 'doughSheeter', 'precisionSheeter');
    expect(analyse(t).kitchen.equipmentE).toBeGreaterThan(analyse(s).kitchen.equipmentE);
    const u = upgrade(s, 'doughSheeter', 'doughDivider');
    expect(analyse(u).kitchen.prepPerHour).toBeGreaterThan(analyse(s).kitchen.prepPerHour);
  });

  test('a twin belt conveyor bakes more than the conveyor it replaces', () => {
    const s = rich();
    const t = upgrade(s, 'conveyorOven', 'twinConveyorOven');
    expect(analyse(t).kitchen.ovenPerHour).toBeGreaterThan(analyse(s).kitchen.ovenPerHour);
  });

  test('a deck oven upgrades to the Electric Deck Pro: faster and better', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.cash = 50000;
    s.totalServed = 1000;
    const t = upgrade(s, 'deckOven', 'electricDeckOven');
    expect(analyse(t).kitchen.equipmentE).toBeCloseTo(analyse(s).kitchen.equipmentE + 2, 5);
    expect(analyse(t).kitchen.ovenPerHour).toBeGreaterThan(analyse(s).kitchen.ovenPerHour);
  });

  test('locked items cannot be bought', () => {
    const s = buildState('volume', 'university');
    s.cash = 200000;
    s.rep = 10;
    const r = apply(s, { type: 'buyEquipment', itemId: 'neapolitanDomeOven', x: 0, y: 0, rot: 0 }, { noise: false });
    expect(r.error).toBeDefined();
  });
});
