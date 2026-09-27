// Forecasts for the UI (TD6): the same two pass day as the real game (dayRun, with staff pressure), without noise.
// UI code asks here instead of calling simulateDay, so a preview never disagrees with the day that follows.

import type { DayReport, GameState } from './state';
import { dayRun } from './team';

/** One day as the game would play it, without daily randomness. */
export function forecastDay(state: GameState, day: number = state.day): DayReport {
  return dayRun(day === state.day ? state : { ...state, day }, { noise: false }).report;
}

/** Monday to Sunday of the current week. */
export function forecastWeek(state: GameState): DayReport[] {
  const base = state.day - ((state.day - 1) % 7);
  return Array.from({ length: 7 }, (_, i) => forecastDay(state, base + i));
}

/** The busiest day of the week (Saturday), for previews that are about peaks. */
export const forecastSaturday = (state: GameState): DayReport => forecastDay(state, state.day - ((state.day - 1) % 7) + 5);
