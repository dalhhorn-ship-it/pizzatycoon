// Menu complexity (balance.md 4.2): a wider, fancier menu is harder for the kitchen to run.

import { INGREDIENTS } from '../data/ingredients';
import { isMain } from '../data/recipes';
import { T } from '../data/tunables';
import type { GameState, Recipe } from './state';

export interface MenuComplexity {
  /** Food dishes on the menu (drinks do not need the kitchen). */
  dishes: number;
  /** Distinct food ingredients the line has to keep prepped. */
  ingredients: number;
  score: number;
  /** Score the current brigade handles without slowing down. */
  allowance: number;
  /** Prep speed multiplier, 1 when the menu is within the allowance. */
  efficiency: number;
}

/** Prep work for one plate of a main, relative to a simple pizza. */
export function dishWork(recipe: Pick<Recipe, 'kind' | 'lines'>): number {
  if (!isMain(recipe.kind)) return 0;
  const extras = recipe.lines.filter((l) => !INGREDIENTS[l.ingredientId]?.base).length;
  return T.menu.work[recipe.kind] + T.menu.workPerExtra * Math.max(0, extras - T.menu.freeExtras);
}

export function menuComplexity(recipes: readonly Recipe[], avgKitchenSkill: number): MenuComplexity {
  const food = recipes.filter((r) => r.onMenu && r.kind !== 'drink');
  const ingredients = new Set(food.flatMap((r) => r.lines.map((l) => l.ingredientId))).size;
  const score = T.menu.perDish * food.length + T.menu.perIngredient * ingredients;
  const allowance = T.menu.free + T.menu.perSkill * (avgKitchenSkill - 5);
  const over = Math.max(0, score - allowance);
  const efficiency = Math.max(T.menu.efficiencyFloor, 1 - T.menu.penaltyPerPoint * over);
  return { dishes: food.length, ingredients, score, allowance, efficiency };
}

export function stateMenuComplexity(state: GameState): MenuComplexity {
  const cooks = state.staff.filter((s) => s.role === 'chef' || s.role === 'cook');
  const avg = cooks.length ? cooks.reduce((x, c) => x + c.skill, 0) / cooks.length : 5;
  return menuComplexity(state.recipes, avg);
}
