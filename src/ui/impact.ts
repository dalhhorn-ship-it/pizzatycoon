// "Measurable impact" previews (prd.md 5.8): run the real day model on a hypothetical state.

import { isMain } from '../data/recipes';
import { analyse } from '../sim/analysis';
import { forecastWeek } from '../sim/forecast';
import type { GameState } from '../sim/state';

export interface Outlook {
  profit: number;
  covers: number;
  quality: number;
  satisfaction: number;
}

/** Game states are never changed after a command, so a state's outlook can be kept (the baseline of every preview). */
const outlooks = new WeakMap<GameState, Outlook>();

/** Average expected day across a week, without randomness, at the current reputation. */
export function outlook(state: GameState): Outlook {
  const hit = outlooks.get(state);
  if (hit) return hit;
  const out = computeOutlook(state);
  outlooks.set(state, out);
  return out;
}

function computeOutlook(state: GameState): Outlook {
  const a = analyse(state);
  const mains = state.recipes.filter((r) => r.onMenu && isMain(r.kind));
  const quality = mains.length ? mains.reduce((x, r) => x + (a.dishes[r.id]?.quality ?? 0), 0) / mains.length : 0;
  let profit = 0;
  let covers = 0;
  let sat = 0;
  for (const r of forecastWeek(state)) {
    profit += r.pnl.profit;
    covers += r.covers;
    sat += r.satisfaction;
  }
  return { profit: profit / 7, covers: covers / 7, quality, satisfaction: sat / 7 };
}

export function compare(before: GameState, after: GameState): { profit: number; covers: number; quality: number; satisfaction: number } {
  const a = outlook(before);
  const b = outlook(after);
  return { profit: b.profit - a.profit, covers: b.covers - a.covers, quality: b.quality - a.quality, satisfaction: b.satisfaction - a.satisfaction };
}
