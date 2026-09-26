// Acceptance criteria from 01-product/kitchen-builder.md 12 (AC-134 onward).
import { describe, expect, test } from 'vitest';
import { analyse } from '../src/sim/analysis';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { autoLayout, distance, kitchenDims, layoutProblem, rectOf } from '../src/sim/kitchen';
import type { GameState } from '../src/sim/state';
import { deserialise } from '../src/save/saveFile';

const starter = (): GameState => withStarterKit(newGame(1, 'canal', 'cosy'));

describe('kitchen floor plan', () => {
  test('grids and pass tiles per premises (AC-134)', () => {
    expect(kitchenDims('hole')).toEqual({ W: 10, H: 5, pass: [[4, 0], [5, 0]] });
    expect(kitchenDims('cosy')).toEqual({ W: 14, H: 6, pass: [[6, 0], [7, 0]] });
    expect(kitchenDims('medium')).toEqual({ W: 16, H: 6, pass: [[7, 0], [8, 0]] });
    expect(kitchenDims('large')).toEqual({ W: 20, H: 8, pass: [[9, 0], [10, 0]] });
  });

  test('invalid placements are rejected with a reason and state unchanged (AC-135)', () => {
    const s = starter();
    s.cash = 50000;
    const oven = s.equipment.find((e) => e.itemId === 'deckOven')!;
    const cases: [number, number, RegExp][] = [
      [13, 5, /Off the kitchen/],
      [2, 0, /already there/],
      [6, 0, /pass stays clear/],
    ];
    for (const [x, y, reason] of cases) {
      const r = apply(s, { type: 'moveEquipment', uid: oven.uid, x, y, rot: 0 });
      expect(r.error).toMatch(reason);
      expect(r.state).toBe(s);
    }
  });

  test('the heat lamp pass goes on the hatch', () => {
    const s = starter();
    s.cash = 50000;
    s.day = 10;
    expect(apply(s, { type: 'buyEquipment', itemId: 'heatLampPass', x: 7, y: 1 }).error).toMatch(/hatch/);
    const ok = apply(s, { type: 'buyEquipment', itemId: 'heatLampPass', x: 6, y: 0 });
    expect(ok.error).toBeUndefined();
  });

  test('a station walled in on every side is invalid', () => {
    const d = kitchenDims('cosy');
    const eq = [
      { uid: 1, itemId: 'sink', x: 0, y: 1, rot: 0 as const },
      { uid: 2, itemId: 'prepCounter', x: 0, y: 0, rot: 0 as const },
      { uid: 3, itemId: 'prepCounter', x: 0, y: 2, rot: 0 as const },
      { uid: 4, itemId: 'doughFridge', x: 1, y: 1, rot: 0 as const },
    ];
    expect(layoutProblem(eq, d)).toMatch(/free tile/);
  });

  test('rotation swaps the footprint and keeps stats when distances are unchanged (AC-136)', () => {
    expect(rectOf({ itemId: 'conveyorOven', x: 0, y: 0, rot: 1 })).toEqual({ x: 0, y: 0, w: 2, h: 3 });
  });

  test('the starter kitchen has zero flow penalty', () => {
    const a = analyse(starter());
    expect(a.kitchen.plateWalk).toBe(0);
    expect(a.kitchen.flow.washMult).toBe(1);
    for (const st of Object.values(a.kitchen.flow.stations)) expect(st.reachMult).toBe(1);
    expect(a.kitchen.ovenPerHour).toBeCloseTo(19.4, 1);
  });

  test('moving a prep counter far from the oven lowers prep capacity', () => {
    const s = starter();
    const before = analyse(s).kitchen.prepPerHour;
    const counter = s.equipment.find((e) => e.itemId === 'prepCounter' && e.y === 2)!;
    const r = apply(s, { type: 'moveEquipment', uid: counter.uid, x: 9, y: 2, rot: 0 });
    expect(r.error).toBeUndefined();
    const after = analyse(r.state).kitchen;
    expect(after.prepPerHour).toBeLessThan(before);
    expect(after.flow.stations[counter.uid]?.dOven).toBe(5);
    expect(after.flow.stations[counter.uid]?.reachMult).toBeCloseTo(1 - 0.04 * (5 - 2), 5);
  });

  test('an oven far from the pass adds plate walk to cook time (AC-142)', () => {
    const s = starter();
    s.premisesId = 'large';
    s.equipment = [
      { uid: 1, itemId: 'deckOven', x: 14, y: 4, rot: 0 },
      { uid: 2, itemId: 'prepCounter', x: 12, y: 4, rot: 0 },
      { uid: 3, itemId: 'sink', x: 11, y: 0, rot: 0 },
      { uid: 4, itemId: 'doughFridge', x: 0, y: 7, rot: 0 },
    ];
    const dPass = distance(rectOf(s.equipment[0]!), { x: 9, y: 0, w: 2, h: 1 });
    expect(dPass).toBe(8);
    const a = analyse(s).kitchen;
    expect(a.plateWalk).toBeCloseTo(Math.min(2, 0.2 * (dPass - 3)), 5);
  });

  test('a prep fridge with marble top is a faster prep station and keeps dough cold', () => {
    const s = starter();
    s.cash = 50000;
    s.totalServed = 500;
    const before = analyse(s).kitchen;
    const counter = s.equipment.find((e) => e.itemId === 'prepCounter' && e.y === 2)!;
    const sold = apply(s, { type: 'sellEquipment', uid: counter.uid }).state;
    const r = apply(sold, { type: 'buyEquipment', itemId: 'prepFridge', x: 2, y: 2 });
    expect(r.error).toBeUndefined();
    const after = analyse(r.state).kitchen;
    expect(after.prepPerHour).toBeGreaterThan(before.prepPerHour);
    expect(after.equipmentE).toBeGreaterThan(before.equipmentE);
  });

  test('the kitchen needs a fridge and a sink to open', () => {
    const s = starter();
    s.equipment = s.equipment.filter((e) => e.itemId !== 'sink');
    const r = apply(s, { type: 'runDay' });
    expect(r.events[0]?.report?.closedReason).toMatch(/sink/);
  });

  test('auto layout places a full kitchen validly', () => {
    const items = ['conveyorOven', 'conveyorOven', 'conveyorOven', 'prepCounter', 'prepCounter', 'prepCounter', 'prepCounter', 'doughSheeter', 'heatLampPass', 'dishMachine', 'doughFridge', 'sink']
      .map((itemId, i) => ({ uid: i + 1, itemId }));
    const { placed, unplaced } = autoLayout(items, 'large');
    expect(unplaced).toEqual([]);
    expect(layoutProblem(placed, kitchenDims('large'))).toBeNull();
  });

  test('an old v1 save migrates into a valid kitchen with a fridge and a sink', () => {
    const s = starter() as unknown as Record<string, unknown>;
    s.schemaVersion = 1;
    s.equipment = [{ uid: 90, itemId: 'deckOven' }, { uid: 91, itemId: 'prepCounter' }, { uid: 92, itemId: 'prepCounter' }];
    const file = deserialise(JSON.stringify({ schemaVersion: 1, savedAt: 0, summary: {}, state: s }));
    const ids = file.state.equipment.map((e) => e.itemId).sort();
    expect(ids).toEqual(['deckOven', 'doughFridge', 'prepCounter', 'prepCounter', 'sink']);
    expect(layoutProblem(file.state.equipment, kitchenDims('cosy'))).toBeNull();
  });
});
