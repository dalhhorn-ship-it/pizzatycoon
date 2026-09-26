// Economy and difficulty settings: multipliers the player controls from the settings menu.
// Normal is all 1.0, which is what balance.md and every balance test use.

import { T } from '../data/tunables';
import type { GameState } from './state';

export interface Economy {
  /** Guests who want to come in. */
  demand: number;
  /** Ingredient prices. */
  ingredients: number;
  /** Staff wages. */
  wages: number;
  /** Rent. */
  rent: number;
  /** Prices of kitchen equipment and furniture. */
  equipment: number;
  /** How fast reputation moves toward what guests think. */
  reputation: number;
  /** Starting money, used when a new game starts. */
  startingCash: number;
  /**
   * How a new restaurant starts (balance.md 4.3): 'slow' has to earn its local following by word of mouth,
   * 'normal' is known in the neighbourhood from day one. Applies to new games, fresh starts and moves.
   */
  start: StartPace;
}

export type StartPace = 'slow' | 'normal';

/** The multiplier settings (sliders); `start` is a separate choice. */
export type EconomyKey = Exclude<keyof Economy, 'start'>;
const KEYS: EconomyKey[] = ['demand', 'ingredients', 'wages', 'rent', 'equipment', 'reputation', 'startingCash'];

export const ECONOMY_RANGE = { min: 0.5, max: 1.5, step: 0.05 } as const;

export const PRESETS: Record<'easy' | 'normal' | 'hard', Economy> = {
  easy: { demand: 1.2, ingredients: 0.85, wages: 0.85, rent: 0.8, equipment: 0.8, reputation: 1.3, startingCash: 1.5, start: 'normal' },
  normal: { demand: 1, ingredients: 1, wages: 1, rent: 1, equipment: 1, reputation: 1, startingCash: 1, start: 'slow' },
  hard: { demand: 0.85, ingredients: 1.15, wages: 1.15, rent: 1.2, equipment: 1.2, reputation: 0.8, startingCash: 0.75, start: 'slow' },
};

export const ECONOMY_LABELS: Record<EconomyKey, { name: string; easier: 'up' | 'down' }> = {
  demand: { name: 'Guests', easier: 'up' },
  ingredients: { name: 'Ingredient prices', easier: 'down' },
  wages: { name: 'Wages', easier: 'down' },
  rent: { name: 'Rent', easier: 'down' },
  equipment: { name: 'Equipment and furniture prices', easier: 'down' },
  reputation: { name: 'Reputation speed', easier: 'up' },
  startingCash: { name: 'Starting money (new games)', easier: 'up' },
};

export function economyOf(state: Pick<GameState, 'economy'>): Economy {
  const e = { ...PRESETS.normal, ...(state.economy ?? {}) };
  // Settings saved before the start choice existed take the start of the preset they match.
  if (state.economy && !state.economy.start) {
    const match = Object.values(PRESETS).find((p) => KEYS.every((k) => Math.abs(p[k] - e[k]) < 1e-9));
    if (match) e.start = match.start;
  }
  return e;
}

export function presetName(e: Economy): 'easy' | 'normal' | 'hard' | 'custom' {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (p.start === e.start && KEYS.every((k) => Math.abs(p[k] - e[k]) < 1e-9)) return name as 'easy' | 'normal' | 'hard';
  }
  return 'custom';
}

export function clampEconomy(e: Partial<Economy>): Economy {
  const out = { ...PRESETS.normal, ...e };
  out.start = out.start === 'normal' ? 'normal' : 'slow';
  for (const k of KEYS) {
    const v = Number(out[k]);
    out[k] = Number.isFinite(v) ? Math.min(ECONOMY_RANGE.max, Math.max(ECONOMY_RANGE.min, Math.round(v / ECONOMY_RANGE.step) * ECONOMY_RANGE.step)) : 1;
  }
  return out;
}

/** Local following a new restaurant opens with, by the start setting. */
export function startFollowing(state: Pick<GameState, 'economy'>): number {
  return economyOf(state).start === 'normal' ? T.following.normalStart : T.following.start;
}

/** What the player pays for equipment or furniture with a catalogue price. */
export function buyPrice(state: Pick<GameState, 'economy'>, base: number): number {
  return Math.round(base * economyOf(state).equipment);
}

/**
 * What the player gets back when selling: 80% of what was paid (or of today's price for items bought
 * before prices were tracked), never more, so changing settings is not a money machine.
 */
export function sellPrice(state: Pick<GameState, 'economy'>, base: number, paid?: number): number {
  const today = base * economyOf(state).equipment;
  return Math.round(Math.min(today, paid ?? today, base) * T.kitchen.resale);
}
