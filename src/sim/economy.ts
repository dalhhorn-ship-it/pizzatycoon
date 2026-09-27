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
  /** Live rival pizzerias (competition.md 9). Missing means off: old saves and the balance harness. */
  rivals?: RivalSettings;
}

export type StartPace = 'slow' | 'normal';

/** The Competition group of the settings menu (competition.md 9). */
export interface RivalSettings {
  on: boolean;
  /** Rivals at the start of a new game (and arriving when switched on mid game). */
  start: number;
  /** Mean rival skill: 3, 5, 7 or 9. */
  skill: number;
  /** Start capital of each rival. */
  capital: number;
  /** Average weeks between new rivals; 0 = none. */
  entrants: number;
  cityCap: number;
  districtCap: number;
  /** Founder decision on question 6: marketing minded rivals seek out the most successful player restaurant. */
  targetLeader: boolean;
}

export const RIVALS_OFF: RivalSettings = { on: false, start: 0, skill: 5, capital: 35000, entrants: 0, cityCap: 16, districtCap: 3, targetLeader: false };

export const RIVAL_PRESETS: Record<'easy' | 'normal' | 'hard', RivalSettings> = {
  easy: { on: true, start: 6, skill: 3, capital: 18000, entrants: 8, cityCap: 10, districtCap: 2, targetLeader: false },
  normal: { on: true, start: 10, skill: 5, capital: 35000, entrants: 4, cityCap: 16, districtCap: 3, targetLeader: true },
  hard: { on: true, start: 14, skill: 7, capital: 80000, entrants: 2, cityCap: 22, districtCap: 4, targetLeader: true },
};

export const RIVAL_OPTIONS = {
  skill: [[3, 'Casual'], [5, 'Capable'], [7, 'Sharp'], [9, 'Master']] as [number, string][],
  capital: [[18000, 'Small'], [35000, 'Medium'], [80000, 'Large'], [160000, 'Very large']] as [number, string][],
  entrants: [[0, 'Off'], [8, 'Rare'], [4, 'Sometimes'], [2, 'Often']] as [number, string][],
} as const;

/** Rival settings for a state: off when a game was never given any. */
export function rivalSettingsOf(state: Pick<GameState, 'economy'>): RivalSettings {
  return { ...RIVALS_OFF, ...(state.economy?.rivals ?? {}) };
}

const sameRivals = (a: RivalSettings | undefined, b: RivalSettings | undefined): boolean =>
  JSON.stringify({ ...RIVALS_OFF, ...(a ?? {}) }) === JSON.stringify({ ...RIVALS_OFF, ...(b ?? {}) });

/** The multiplier settings (sliders); `start` is a separate choice. */
export type EconomyKey = Exclude<keyof Economy, 'start' | 'rivals'>;
const KEYS: EconomyKey[] = ['demand', 'ingredients', 'wages', 'rent', 'equipment', 'reputation', 'startingCash'];

export const ECONOMY_RANGE = { min: 0.5, max: 1.5, step: 0.05 } as const;

export const PRESETS: Record<'easy' | 'normal' | 'hard', Economy> = {
  // Narrowed after the economics check: at realistic margins (about 15% on Normal) the old Hard (guests x0.85, costs x1.15
  // to 1.2) left nothing. Easy lands near 21%, Hard near 7% for a well run medium restaurant.
  easy: { demand: 1.1, ingredients: 0.92, wages: 0.92, rent: 0.9, equipment: 0.8, reputation: 1.3, startingCash: 1.5, start: 'normal' },
  normal: { demand: 1, ingredients: 1, wages: 1, rent: 1, equipment: 1, reputation: 1, startingCash: 1, start: 'slow' },
  hard: { demand: 0.93, ingredients: 1.06, wages: 1.06, rent: 1.1, equipment: 1.2, reputation: 0.8, startingCash: 0.75, start: 'slow' },
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
    const id = name as 'easy' | 'normal' | 'hard';
    // Competition counts only once the game has rival settings (competition.md 9).
    if (e.rivals && !sameRivals(e.rivals, RIVAL_PRESETS[id])) continue;
    if (p.start === e.start && KEYS.every((k) => Math.abs(p[k] - e[k]) < 1e-9)) return id;
  }
  return 'custom';
}

export function clampEconomy(e: Partial<Economy>): Economy {
  const out = { ...PRESETS.normal, ...e };
  out.start = out.start === 'normal' ? 'normal' : 'slow';
  if (e.rivals) out.rivals = clampRivals(e.rivals);
  else delete out.rivals;
  for (const k of KEYS) {
    const v = Number(out[k]);
    out[k] = Number.isFinite(v) ? Math.min(ECONOMY_RANGE.max, Math.max(ECONOMY_RANGE.min, Math.round(v / ECONOMY_RANGE.step) * ECONOMY_RANGE.step)) : 1;
  }
  return out;
}

export function clampRivals(r: Partial<RivalSettings>): RivalSettings {
  const x = { ...RIVALS_OFF, ...r };
  const int = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
  return {
    on: !!x.on, start: int(x.start, 0, 20), skill: int(x.skill, 1, 10), capital: int(x.capital, 5000, 500000),
    entrants: [0, 2, 4, 8].includes(x.entrants) ? x.entrants : 4, cityCap: int(x.cityCap, 4, 30), districtCap: int(x.districtCap, 1, 5),
    targetLeader: !!x.targetLeader,
  };
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
