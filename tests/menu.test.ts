import { describe, expect, test } from 'vitest';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPE_BOOK } from '../src/data/recipes';
import { analyse, harmonyOf } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply, newGame, tiersFor, withStarterKit } from '../src/sim/game';
import { dishWork, menuComplexity } from '../src/sim/menu';
import { deserialise, serialise } from '../src/save/saveFile';
import type { GameState } from '../src/sim/state';
import { buildState, steadyState } from './balance/builds';

const FANCY = ['carbonara', 'lasagne', 'vongole', 'risottoPorcini', 'saltimbocca', 'ossobuco', 'branzino', 'tagliata', 'bruschetta', 'calamari'];
const withOnMenu = (s: GameState, ids: string[]): GameState => {
  const t = structuredClone(s);
  for (const r of t.recipes) if (ids.includes(r.id)) r.onMenu = true;
  return t;
};

describe('recipe book', () => {
  test('every dish uses known ingredients that some supplier sells', () => {
    for (const t of RECIPE_BOOK) {
      for (const id of t.ingredients) {
        expect(INGREDIENTS[id], `${t.id} uses ${id}`).toBeDefined();
        expect(tiersFor(id).length, `${id} has a supplier`).toBeGreaterThan(0);
      }
    }
  });

  test('offers primi and secondi', () => {
    expect(RECIPE_BOOK.filter((r) => r.kind === 'primo').length).toBeGreaterThanOrEqual(10);
    expect(RECIPE_BOOK.filter((r) => r.kind === 'secondo').length).toBeGreaterThanOrEqual(8);
  });

  test('no cheese on fish', () => {
    expect(harmonyOf(['spaghetti', 'clams', 'garlic', 'parmesan'], 5)).toBeLessThan(harmonyOf(['spaghetti', 'clams', 'garlic'], 5));
  });

  test('older saves pick up new recipe book dishes, off the menu', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.recipes = s.recipes.filter((r) => r.kind !== 'primo' && r.kind !== 'secondo');
    const loaded = deserialise(serialise(s, 0)).state;
    const carbonara = loaded.recipes.find((r) => r.id === 'carbonara');
    expect(carbonara?.onMenu).toBe(false);
    expect(loaded.recipes.length).toBe(RECIPE_BOOK.length);
  });
});

describe('custom dishes', () => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));

  test('a primo needs a pasta or rice base', () => {
    expect(apply(s, { type: 'createDish', kind: 'primo', name: 'Bad', ingredients: ['garlic'], price: 14 }).error).toBeDefined();
    const r = apply(s, { type: 'createDish', kind: 'primo', name: 'Aglio e olio', base: 'spaghetti', ingredients: ['garlic', 'chili', 'oliveOil'], price: 11 });
    expect(r.error).toBeUndefined();
    const dish = r.state.recipes.at(-1);
    expect(dish?.kind).toBe('primo');
    expect(dish?.lines.map((l) => l.ingredientId)).toEqual(['spaghetti', 'garlic', 'chili', 'oliveOil']);
  });

  test('a secondo needs an ingredient; pizzas keep their base', () => {
    expect(apply(s, { type: 'createDish', kind: 'secondo', name: 'Nothing', ingredients: [], price: 20 }).error).toBeDefined();
    const p = apply(s, { type: 'createDish', kind: 'pizza', name: 'Mine', ingredients: ['ham'], price: 13 });
    expect(p.state.recipes.at(-1)?.lines.map((l) => l.ingredientId)).toEqual(['dough', 'tomatoSauce', 'mozzarella', 'ham']);
  });
});

describe('menu complexity', () => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));

  test('the classic starter menu runs at full speed', () => {
    expect(analyse(s).kitchen.menu.efficiency).toBe(1);
  });

  test('primi and secondi are more work per plate than a pizza', () => {
    const find = (id: string) => s.recipes.find((r) => r.id === id)!;
    expect(dishWork(find('margherita'))).toBe(1);
    expect(dishWork(find('carbonara'))).toBeGreaterThan(1);
    expect(dishWork(find('ossobuco'))).toBeGreaterThan(dishWork(find('carbonara')));
  });

  test('a wider menu slows prep; skilled cooks handle more', () => {
    const wide = withOnMenu(s, FANCY);
    const a = analyse(wide);
    expect(a.kitchen.menu.efficiency).toBeLessThan(0.8);
    expect(a.kitchen.prepPerHour).toBeLessThan(analyse(s).kitchen.prepPerHour);
    expect(menuComplexity(wide.recipes, 9).efficiency).toBeGreaterThan(menuComplexity(wide.recipes, 4).efficiency);
  });

  test('primi spare the oven: oven covers per hour rise when some guests order pasta', () => {
    const pasta = withOnMenu(s, ['carbonara', 'pomodoro']);
    const before = simulateDay(s, analyse(s), { noise: false }).services[1]!;
    const after = simulateDay(pasta, analyse(pasta), { noise: false }).services[1]!;
    expect(after.stages.oven).toBeGreaterThan(before.stages.oven);
  });

  test('a big fancy menu makes prep the bottleneck and lowers output where the kitchen is the limit', () => {
    const base = steadyState(buildState('middle', 'canal')).report;
    const wide = steadyState(withOnMenu(buildState('middle', 'canal'), FANCY)).report;
    expect(wide.services.some((x) => x.bottleneck === 'prep')).toBe(true);
    expect(wide.covers).toBeLessThan(base.covers * 0.95);
  });
});
