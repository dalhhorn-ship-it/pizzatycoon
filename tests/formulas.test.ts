import { describe, expect, test } from 'vitest';
import { EQUIPMENT } from '../src/data/equipment';
import { T } from '../src/data/tunables';
import { analyse, harmonyOf, salaryFor, tasteMatch } from '../src/sim/analysis';
import { attachRate, queueDelay, simulateDay, valueScore } from '../src/sim/day';
import { loanPayment, newGame, withStarterKit } from '../src/sim/game';

const oven = (id: string, skill: number): number => {
  const e = EQUIPMENT[id]!;
  const volume = e.family === 'volume';
  const speed = volume ? 0.9 + 0.02 * skill : 0.7 + 0.06 * skill;
  return ((e.slots ?? 0) * 60) / (12 * (e.bakeMult ?? 1)) * speed;
};

describe('formulas match balance.md', () => {
  test('equipment servings per hour (1.7)', () => {
    expect(oven('deckOven', 5)).toBeCloseTo(20, 5);
    expect(oven('doubleDeckOven', 5)).toBeCloseTo(40, 5);
    expect(oven('conveyorOven', 4)).toBeCloseTo(44.5, 0);
    expect(oven('woodFiredOven', 5)).toBeCloseTo(12, 5);
    expect(oven('woodFiredOven', 7.5)).toBeCloseTo(13.8, 5);
  });

  test('artisan ovens stay below the deck oven throughput at skill 5 (3.7 guardrail)', () => {
    for (const e of Object.values(EQUIPMENT)) {
      if (e.family === 'artisan' && e.role === 'oven') expect(oven(e.id, 5)).toBeLessThan(oven('deckOven', 5));
    }
  });

  test('salary (1.10)', () => {
    expect(salaryFor('cook', 4, 0, 550)).toBeCloseTo(484, 2);
    expect(salaryFor('chef', 8, 1, 900)).toBeCloseTo(1530, 2);
    expect(salaryFor('dishwasher', 4, 0, 380)).toBeCloseTo(334.4, 2);
  });

  test('starter loan payment is $303.26 a week (1.12)', () => {
    expect(loanPayment({ balance: 30000, annualRate: 0.05, weeksLeft: 104, pausedWeeks: 0 })).toBeCloseTo(303.26, 1);
  });

  test('value score and worked guest (2.5)', () => {
    expect(valueScore(0.93, 1.5)).toBeCloseTo(0.763, 3);
    expect(valueScore(2, 2)).toBe(0);
  });

  test('queue delay (1.8)', () => {
    expect(queueDelay(0.9)).toBeCloseTo(18, 5);
    expect(queueDelay(0.96)).toBe(25);
    expect(queueDelay(0.5)).toBeCloseTo(2, 5);
  });

  test('attach rates (1.4)', () => {
    expect(attachRate('drink', 55)).toBeCloseTo(0.8, 5);
    expect(attachRate('dessert', 55)).toBeCloseTo(0.2625, 5);
    expect(attachRate('drink', 100)).toBeCloseTo(0.9, 5);
  });

  test('harmony (prd 5.3)', () => {
    expect(harmonyOf(['dough', 'tomatoSauce', 'mozzarella', 'basil'])).toBe(70);
    expect(harmonyOf(['dough', 'tomatoSauce', 'mozzarella', 'pineapple', 'anchovy'])).toBe(45);
    expect(harmonyOf(['dough', 'mozzarella', 'ham', 'olives', 'onion', 'peppers', 'chili'])).toBe(50);
  });

  test('taste match', () => {
    expect(tasteMatch(new Set(['meaty', 'spicy']), 'students')).toBe(1);
    expect(tasteMatch(new Set([]), 'foodies')).toBeCloseTo(0.1, 5);
  });
});

describe('golden starter day (balance.md 2)', () => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.day = 4; // Thursday
  for (const st of s.staff) st.traits = [];
  const a = analyse(s);
  const r = simulateDay(s, a, { noise: false });

  test('kitchen and service', () => {
    expect(a.kitchen.kitchenSkillK).toBeCloseTo(61.5, 5);
    expect(a.kitchen.ovenPerHour).toBeCloseTo(19.4, 1);
    expect(a.service.serviceTime.dinner).toBeCloseTo(26.1, 1);
    expect(a.room.seats).toBe(24);
  });

  test('guests within 5% of 67.5 (fresh-start.md 6) and seats are the bottleneck', () => {
    expect(r.covers).toBeGreaterThan(67.5 * 0.95);
    expect(r.covers).toBeLessThan(67.5 * 1.05);
    expect(r.services.map((x) => x.bottleneck)).toEqual(['seats', 'seats']);
    expect(r.walkAways).toBeLessThan(3);
  });

  test('money within tolerance of the worked example', () => {
    expect(r.pnl.sales).toBeGreaterThan(1281.68 * 0.9);
    expect(r.pnl.sales).toBeLessThan(1281.68 * 1.1);
    expect(r.pnl.profit).toBeGreaterThan(0);
    expect(r.pnl.staff).toBeCloseTo(2214.4 / 7, 2);
    expect(r.pnl.rent).toBeCloseTo(1210 / 7, 2);
  });

  test('reputation moves about 5% of the gap', () => {
    expect(r.repAfter).toBeGreaterThan(31);
    expect(r.repAfter).toBeLessThan(33);
  });

  test('pricing well above fair loses guests (elasticity)', () => {
    const pricey = structuredClone(s);
    for (const rec of pricey.recipes) if (rec.kind === 'pizza') rec.price *= 1.5;
    const r2 = simulateDay(pricey, analyse(pricey), { noise: false });
    const demand = (x: typeof r): number => x.services.reduce((acc, sv) => acc + sv.demand, 0);
    expect(demand(r2)).toBeLessThan(demand(r) * 0.7);
  });

  test('tunables are sane', () => {
    const w = T.satisfaction;
    expect(w.wFood + w.wService + w.wAmbience + w.wValue + w.wWait).toBeCloseTo(1, 10);
    expect(T.quality.wIngredients + T.quality.wHarmony + T.quality.wKitchen).toBeCloseTo(1, 10);
  });
});
