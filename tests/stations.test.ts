// Station bottlenecks and capacity (kitchen-bottlenecks.md).
import { describe, expect, test } from 'vitest';
import { analyse, stationsOf } from '../src/sim/analysis';
import { capacityOutlook, levers, stationIssues, weekKitchen } from '../src/sim/capacity';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { autoLayout } from '../src/sim/kitchen';
import { staffFromSkill } from '../src/sim/staff';
import type { GameState } from '../src/sim/state';
import { dayRun } from '../src/sim/team';
import { buildState } from './balance/builds';

/** A big hall with a modest kitchen, like a first large restaurant. */
function bigHall(items: string[], cooks = 3, washers = 3): GameState {
  const s = buildState('middle', 'linden');
  s.premisesId = 'large';
  s.furniture = buildState('volume', 'linden').furniture;
  s.equipment = autoLayout(items.map((itemId, i) => ({ uid: 7000 + i, itemId })), 'large').placed;
  s.staff = [
    ...Array.from({ length: cooks }, (_, i) => staffFromSkill(8000 + i, `c${i}`, 'cook', 6)),
    ...Array.from({ length: 6 }, (_, i) => staffFromSkill(8100 + i, `s${i}`, 'server', 5)),
    staffFromSkill(8200, 'h', 'host', 5),
    ...Array.from({ length: washers }, (_, i) => staffFromSkill(8300 + i, `d${i}`, 'dishwasher', 5)),
  ];
  s.rep = 69;
  s.following = 0.9;
  s.day = 5;
  return s;
}

const SMALL = ['deckOven', 'deckOven', 'deckOven', 'prepCounter', 'prepCounter', 'prepCounter', 'doughFridge', 'sink'];

describe('stations', () => {
  test('one sink: only two dishwashers fit, and three cooks queue to wash up', () => {
    const st = stationsOf(bigHall(SMALL));
    expect(st.washSlots).toBe(2);
    expect(st.idleWashers).toBe(1);
    expect(st.washStrain).toBe(1);
    expect(st.prepWashMult).toBeCloseTo(0.94, 5);
    const fixed = stationsOf(bigHall([...SMALL, 'handWash', 'doubleSink']));
    expect(fixed.washSlots).toBe(5);
    expect(fixed.idleWashers).toBe(0);
    expect(fixed.washStrain).toBe(0);
  });

  test('ovens need tending: one cook cannot run four deck ovens', () => {
    const s = bigHall(['deckOven', 'deckOven', 'deckOven', 'deckOven', 'prepCounter', 'doughFridge', 'sink'], 1, 1);
    const st = stationsOf(s);
    expect(st.tendNeed).toBe(2);
    expect(st.tendRatio).toBe(0.5);
    const two = bigHall(['deckOven', 'deckOven', 'deckOven', 'deckOven', 'prepCounter', 'doughFridge', 'sink'], 2, 1);
    expect(analyse(two).kitchen.ovenPerHour).toBeGreaterThan(1.5 * analyse(s).kitchen.ovenPerHour);
  });

  test('a crowded kitchen slows everyone', () => {
    const s = withStarterKit(newGame(1, 'canal', 'hole'));
    for (let i = 0; i < 8; i++) s.staff.push(staffFromSkill(9000 + i, `c${i}`, 'cook', 5));
    const st = stationsOf(s);
    expect(st.crowdOver).toBeGreaterThan(0);
    expect(st.crowdMult).toBeLessThan(1);
    expect(st.crowdMult).toBeGreaterThanOrEqual(0.75);
  });

  test('the fridges cap pizzas a day; a walk in cooler lifts it', () => {
    const s = bigHall(SMALL, 3, 2);
    s.rep = 90;
    s.following = 1;
    for (const r of s.recipes) if (r.kind === 'pizza' && r.onMenu) r.price = 9;
    const d = dayRun(s, { noise: false }).report;
    expect(d.services.some((x) => x.bottleneck === 'cold')).toBe(true);
    const more = bigHall([...SMALL, 'walkInCooler'], 3, 2);
    Object.assign(more, { rep: 90, following: 1, recipes: s.recipes });
    expect(dayRun(more, { noise: false }).report.covers).toBeGreaterThan(d.covers);
    expect(stationIssues(s, analyse(s), d).some((i) => i.id === 'cold')).toBe(true);
  });

  test('the reference builds have no station issues', () => {
    for (const [b, d] of [['middle', 'canal'], ['volume', 'university'], ['luxury', 'harbour']] as const) {
      const s = buildState(b, d);
      const st = stationsOf(s);
      expect([st.tendRatio, st.prepWashMult, st.idleWashers, st.crowdOver], b).toEqual([1, 1, 0, 0]);
    }
  });

  test('new equipment can be bought and placed', () => {
    let s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.cash = 50000;
    s.unlockAll = true;
    for (const itemId of ['handWash', 'plateShelving', 'reachInFridge']) {
      const r = apply(s, { type: 'buyEquipment', itemId });
      expect(r.error, itemId).toBeUndefined();
      s = r.state;
    }
    expect(stationsOf(s).plateStock).toBe(180);
    expect(stationsOf(s).coldCap).toBe(550);
  });
});

describe('capacity', () => {
  test('outlook: capacity, demand and served per service, and which one limits', () => {
    const quiet = withStarterKit(newGame(1, 'canal', 'cosy'));
    const o = capacityOutlook(quiet)!;
    expect(o.lunch.capacity).toBeGreaterThan(0);
    expect(o.dinner.served).toBeLessThanOrEqual(o.dinner.capacity + 1e-6);
    expect(o.limit).toBe('demand');
    const busy = buildState('volume', 'university');
    busy.rep = 60;
    busy.following = 1;
    expect(capacityOutlook(busy)!.limit).not.toBe('demand');
  });

  test('levers are measured and sorted by profit', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    const l = levers(s);
    expect(l.map((x) => x.label).sort()).toEqual(['+5 dish quality', '+5 reputation', 'Mains 10% cheaper', 'Mains 10% dearer']);
    for (let i = 1; i < l.length; i++) expect(l[i - 1]!.profit).toBeGreaterThanOrEqual(l[i]!.profit);
    expect(l.find((x) => x.label === '+5 reputation')!.guests).toBeGreaterThan(0);
  });

  test('the week counts what limited each service', () => {
    let s = buildState('volume', 'university');
    s.rep = 60;
    s.following = 1;
    const reports = [];
    for (let i = 0; i < 7; i++) {
      const r = apply(s, { type: 'runDay' }, { noise: false });
      reports.push(r.events.find((e) => e.kind === 'dayCompleted')!.report!);
      s = r.state;
    }
    const w = weekKitchen(reports);
    expect(w.services).toBe(14);
    expect(Object.values(w.limits).reduce((a, b) => a + b, 0)).toBe(14);
    expect(w.use.lunch).toBeGreaterThan(0);
  });
});
