// The bar (balance.md 4.7) and room touches (balance.md 4.8).
import { describe, expect, test } from 'vitest';
import { analyse, roomStats } from '../src/sim/analysis';
import { simulateDay } from '../src/sim/day';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { deserialise, serialise } from '../src/save/saveFile';
import type { GameState } from '../src/sim/state';

const base = (): GameState => {
  const s = withStarterKit(newGame(1, 'canal', 'cosy'));
  s.day = 4;
  s.rep = 60;
  s.cash = 50000;
  return s;
};
const withMenu = (s: GameState, ids: string[]): GameState => {
  const t = structuredClone(s);
  for (const r of t.recipes) if (ids.includes(r.id)) r.onMenu = true;
  return t;
};
const day = (s: GameState) => simulateDay(s, analyse(s), { noise: false });
const sold = (s: GameState, ids: string[]): number => ids.reduce((x, id) => x + (day(s).dishSales[id] ?? 0), 0);
const spend = (s: GameState): number => {
  const r = day(s);
  return r.pnl.sales / r.covers;
};

describe('the bar', () => {
  test('a longer wine list sells more drinks per guest (second glasses)', () => {
    const drinks = ['softDrink', 'houseWine', 'prosecco', 'chianti', 'pinotGrigio', 'barolo'];
    const perGuest = (s: GameState): number => sold(s, drinks) / day(s).covers;
    const s = base();
    const list = withMenu(s, ['prosecco', 'chianti', 'pinotGrigio', 'barolo']);
    expect(perGuest(list)).toBeGreaterThan(perGuest(s) * 1.15);
  });

  test('aperitivi and digestivi raise what every guest spends', () => {
    const s = base();
    const bar = withMenu(s, ['spritz', 'negroni', 'espresso', 'limoncello', 'grappa']);
    expect(spend(bar)).toBeGreaterThan(spend(s) + 1);
    expect(sold(bar, ['grappa'])).toBeGreaterThan(0);
  });

  test('guests linger over digestivi, so tables turn a little slower', () => {
    const s = withMenu(base(), ['grappa', 'limoncello']);
    expect(day(s).services[1]!.tableCycle).toBeGreaterThan(day(base()).services[1]!.tableCycle);
  });

  test('students choose the house wine over Barolo; foodies are happy to try it', async () => {
    const { chooseDishes } = await import('../src/sim/day');
    const s = withMenu(base(), ['barolo']);
    const a = analyse(s);
    const wines = s.recipes.filter((r) => r.id === 'houseWine' || r.id === 'barolo');
    const barolo = (seg: 'students' | 'foodies'): number => chooseDishes(wines, a, seg, 1, 0.4)!.probs.find((p) => p.recipe.id === 'barolo')!.p;
    expect(barolo('students')).toBeLessThan(barolo('foodies'));
  });

  test('drinks do not count toward kitchen complexity', () => {
    const s = base();
    const bar = withMenu(s, ['prosecco', 'chianti', 'barolo', 'spritz', 'grappa', 'espresso']);
    expect(analyse(bar).kitchen.menu.score).toBe(analyse(s).kitchen.menu.score);
  });
});

describe('room touches', () => {
  test('decoration lifts ambience without taking a floor tile', () => {
    const s = base();
    const r = apply(s, { type: 'buyRoomTouch', id: 'mural' });
    expect(r.error).toBeUndefined();
    expect(roomStats(r.state).ambience).toBeGreaterThan(roomStats(s).ambience);
    expect(r.state.furniture).toEqual(s.furniture);
    expect(s.cash - r.state.cash).toBe(2500);
    expect(apply(r.state, { type: 'buyRoomTouch', id: 'mural' }).error).toMatch(/Already/);
  });

  test('a fully decorated room raises satisfaction', () => {
    let s = base();
    const before = day(s).satisfaction;
    for (const id of ['bunting', 'photos', 'vines', 'candles', 'tablecloths', 'flowers', 'pendants', 'music']) s = apply(s, { type: 'buyRoomTouch', id }).state;
    expect(day(s).satisfaction).toBeGreaterThan(before + 2);
  });

  test('fresh flowers cost upkeep; removing sells at 80%', () => {
    const s = base();
    const t = apply(s, { type: 'buyRoomTouch', id: 'flowers' }).state;
    expect(day(t).pnl.upkeep).toBeGreaterThan(day(s).pnl.upkeep);
    const u = apply(t, { type: 'removeRoomTouch', id: 'flowers' }).state;
    expect(u.cash - t.cash).toBe(400);
    expect(u.roomTouches).toEqual([]);
  });

  test('older saves load with no decoration', () => {
    const s = base() as unknown as Record<string, unknown>;
    delete s.roomTouches;
    expect(deserialise(serialise(s as never, 0)).state.roomTouches).toEqual([]);
  });
});

describe('a larger wine list', () => {
  const list = ['prosecco', 'chianti', 'pinotGrigio', 'montepulciano', 'barolo', 'brunello'];

  test('draws more foodies, raises spend per guest and satisfaction', () => {
    const s = base();
    s.following = 1;
    const wide = withMenu(s, list);
    const foodies = (st: GameState): number => day(st).segments.find((x) => x.segment === 'foodies')!.demand;
    expect(foodies(wide)).toBeGreaterThan(foodies(s) * 1.2);
    expect(spend(wide)).toBeGreaterThan(spend(s) + 1.5);
    expect(day(wide).satisfaction).toBeGreaterThan(day(s).satisfaction + 1.5);
  });

  test('a rating that settles higher', () => {
    const settle = (s0: GameState): number => {
      const s = structuredClone(s0);
      s.following = 1;
      const a = analyse(s);
      for (let i = 0; i < 800; i++) s.rep = simulateDay(s, a, { noise: false }).repAfter;
      return s.rep;
    };
    expect(settle(withMenu(base(), list))).toBeGreaterThan(settle(base()) + 2);
  });

  test('better wines make the list count for more', async () => {
    const { wineListScore } = await import('../src/sim/day');
    const s = withMenu(base(), ['prosecco', 'chianti', 'barolo']);
    const wines = s.recipes.filter((r) => ['houseWine', 'prosecco', 'chianti', 'barolo'].includes(r.id));
    const plain = wineListScore(wines, analyse(s));
    const fine = structuredClone(s);
    for (const r of fine.recipes) if (['houseWine', 'prosecco', 'chianti', 'barolo'].includes(r.id)) for (const l of r.lines) l.tier = 'premium';
    const fineWines = fine.recipes.filter((r) => ['houseWine', 'prosecco', 'chianti', 'barolo'].includes(r.id));
    expect(wineListScore(fineWines, analyse(fine))).toBeGreaterThan(plain);
    expect(wineListScore(wines.slice(0, 1), analyse(s))).toBe(0);
  });
});

test('the wine cellar holds 17 wines, all sold by a supplier', async () => {
  const { WINE_IDS } = await import('../src/data/recipes');
  const { tiersFor } = await import('../src/sim/game');
  expect(WINE_IDS.size).toBe(17);
  const s = base();
  for (const r of s.recipes.filter((x) => WINE_IDS.has(x.id))) for (const l of r.lines) expect(tiersFor(l.ingredientId).length).toBeGreaterThan(0);
  const all = withMenu(s, [...WINE_IDS]);
  expect(day(all).dishSales.sassicaia ?? 0).toBeGreaterThan(0);
});
