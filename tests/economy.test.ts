import { describe, expect, test } from 'vitest';
import { analyse } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { PRESETS, sellPrice } from '../src/sim/economy';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import type { GameState } from '../src/sim/state';

const base = (): GameState => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.day = 4;
  return s;
};
const profit = (s: GameState): number => simulateDay(s, analyse(s), { noise: false }).pnl.profit;

describe('economy settings', () => {
  test('normal is exactly the balance tuning', () => {
    const s = base();
    const withNormal = apply(s, { type: 'setEconomy', economy: PRESETS.normal }).state;
    expect(profit(withNormal)).toBeCloseTo(profit(s), 8);
  });

  test('hard earns less and easy earns more than normal', () => {
    const s = base();
    const hard = apply(s, { type: 'setEconomy', economy: PRESETS.hard }).state;
    const easy = apply(s, { type: 'setEconomy', economy: PRESETS.easy }).state;
    expect(profit(hard)).toBeLessThan(profit(s));
    expect(profit(easy)).toBeGreaterThan(profit(s));
  });

  test('each slider moves the numbers it names', () => {
    const s = base();
    const more = apply(s, { type: 'setEconomy', economy: { demand: 1.5 } }).state;
    const busy = (x: GameState): number => simulateDay(x, analyse(x), { noise: false }).services.reduce((a, v) => a + v.demand, 0);
    expect(busy(more)).toBeCloseTo(busy(s) * 1.5, 5);
    const pricey = apply(s, { type: 'setEconomy', economy: { ingredients: 1.5 } }).state;
    expect(analyse(pricey).dishes.margherita?.foodCost).toBeCloseTo((analyse(s).dishes.margherita?.foodCost ?? 0) * 1.5, 8);
    const wages = apply(s, { type: 'setEconomy', economy: { wages: 0.5 } }).state;
    expect(analyse(wages).weeklySalaries).toBeCloseTo(analyse(s).weeklySalaries * 0.5, 8);
    const rent = apply(s, { type: 'setEconomy', economy: { rent: 1.2 } }).state;
    expect(analyse(rent).weeklyRent).toBeCloseTo(analyse(s).weeklyRent * 1.2, 8);
  });

  test('values are clamped to 50% to 150%', () => {
    const s = apply(base(), { type: 'setEconomy', economy: { demand: 9, rent: -2 } }).state;
    expect(s.economy?.demand).toBe(1.5);
    expect(s.economy?.rent).toBe(0.5);
  });

  test('changing the price slider is never a money machine', () => {
    let s = base();
    s = apply(s, { type: 'setEconomy', economy: { equipment: 0.5 } }).state;
    const cash0 = s.cash;
    s = apply(s, { type: 'buyEquipment', itemId: 'doughFridge' }).state;
    const uid = s.equipment.at(-1)!.uid;
    s = apply(s, { type: 'setEconomy', economy: { equipment: 1.5 } }).state;
    s = apply(s, { type: 'sellEquipment', uid }).state;
    expect(s.cash).toBeLessThanOrEqual(cash0);
    expect(sellPrice({ economy: PRESETS.hard }, 1000)).toBe(800);
    expect(sellPrice({ economy: PRESETS.normal }, 1000, 500)).toBe(400);
  });

  test('starting money follows the setting for new games', () => {
    const easy = newGame(1, 'canal', 'hole', PRESETS.easy);
    const normal = newGame(1, 'canal', 'hole');
    expect(easy.cash - normal.cash).toBeCloseTo(7000 * 0.5, 5);
  });
});

describe('paid prices survive layout changes', () => {
  test('tidy up keeps what was paid', () => {
    let s = base();
    s = apply(s, { type: 'setEconomy', economy: { equipment: 0.5 } }).state;
    s = apply(s, { type: 'buyEquipment', itemId: 'doughFridge' }).state;
    const uid = s.equipment.at(-1)!.uid;
    s = apply(s, { type: 'tidyKitchen' }).state;
    expect(s.equipment.find((e) => e.uid === uid)?.paid).toBe(300);
  });
});
