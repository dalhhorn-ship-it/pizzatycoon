// Versioned save format with migrations (solution-design.md 8).

import { SCHEMA_VERSION, type GameState } from '../sim/state';
import { DISTRICTS, PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { T } from '../data/tunables';
import { VENUES, venueFor } from '../data/venues';
import { ensureEveryRole, withRecipeBook } from '../sim/game';
import { bestRep } from '../sim/chain';
import { autoLayout, kitchenDims, layoutProblem } from '../sim/kitchen';
import { migrateStaff } from '../sim/staff';
import { refreshMarket } from '../sim/team';

export interface SaveSummary {
  day: number;
  cash: number;
  rep: number;
  district: string;
  savedAt: number;
}

export interface SaveFile {
  schemaVersion: number;
  savedAt: number;
  summary: SaveSummary;
  state: GameState;
}

/** migrations[n] upgrades a state from schema n to n + 1. */
const MIGRATIONS: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 to v2: the kitchen became a floor plan (kitchen-builder.md 9). Lay out old equipment, add a fridge and a sink.
  1: (state) => {
    const s = state as { equipment: { uid: number; itemId: string }[]; premisesId: string; nextUid: number; cash: number; migrationNotes?: string[] };
    const items = [...s.equipment];
    for (const id of ['doughFridge', 'sink']) if (!items.some((e) => e.itemId === id)) items.push({ uid: s.nextUid++, itemId: id });
    const { placed, unplaced } = autoLayout(items, s.premisesId);
    s.equipment = placed;
    for (const u of unplaced) s.cash += EQUIPMENT[u.itemId]?.price ?? 0;
    return s;
  },
  // v2 to v3: deposits are tracked so moving premises can refund them (fresh-start.md 3). Old games paid 8 weeks.
  2: (state) => {
    const s = state as { deposit?: number; districtId: string; premisesId: string };
    const d = DISTRICTS[s.districtId];
    const p = PREMISES[s.premisesId];
    s.deposit = d && p ? (p.diningWidth * p.diningHeight + p.kitchenTiles) * d.rentPerTile * 8 : 0;
    return s;
  },
  // v3 to v4: kitchens got bigger and the hatch moved; re-lay any kitchen that no longer follows the rules.
  3: (state) => {
    const s = state as unknown as GameState;
    if (layoutProblem(s.equipment, kitchenDims(s.premisesId))) {
      const { placed, unplaced } = autoLayout(s.equipment, s.premisesId);
      s.equipment = placed;
      for (const u of unplaced) s.cash += EQUIPMENT[u.itemId]?.price ?? 0;
    }
    return state;
  },
  // v4 to v5: venues on the city map (city-map.md 6). Land on the venue with the same district and premises.
  4: (state) => {
    const s = state as { districtId: string; premisesId: string; venueId?: string | null };
    s.venueId = venueFor(s.districtId, s.premisesId);
    return s;
  },
  // v5 to v6: staff become a squad with four attributes (staff-management.md 10). The market starts fresh.
  5: (state) => {
    const s = state as unknown as GameState;
    const old = (xs: unknown[]): Record<string, unknown>[] => xs as Record<string, unknown>[];
    s.staff = old(s.staff).map((x) => migrateStaff(x, s.day));
    for (const b of s.branches ?? []) b.staff = old(b.staff).map((x) => migrateStaff(x, s.day));
    s.candidates = [];
    refreshMarket(s, bestRep(s), s.day);
    return state;
  },
};

export function summarise(state: GameState, savedAt: number): SaveSummary {
  return {
    day: state.day,
    cash: Math.round(state.cash),
    rep: Math.round(state.rep * 10) / 10,
    district: (state.venueId ? VENUES[state.venueId]?.name : null) ?? DISTRICTS[state.districtId]?.name ?? state.districtId,
    savedAt,
  };
}

export function toSaveFile(state: GameState, savedAt: number): SaveFile {
  return { schemaVersion: SCHEMA_VERSION, savedAt, summary: summarise(state, savedAt), state };
}

export function serialise(state: GameState, savedAt: number): string {
  return JSON.stringify(toSaveFile(state, savedAt));
}

export function deserialise(text: string): SaveFile {
  const raw = JSON.parse(text) as SaveFile;
  if (!raw || typeof raw !== 'object' || !raw.state) throw new Error('Not a Pizza D save.');
  if (raw.schemaVersion > SCHEMA_VERSION) throw new Error('This save comes from a newer version of Pizza D. Reload the page to update.');
  let state = raw.state as unknown as Record<string, unknown>;
  for (let v = raw.schemaVersion; v < SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from save version ${v}.`);
    state = m(state);
  }
  const s = state as unknown as GameState;
  if (typeof s.day !== 'number' || typeof s.cash !== 'number' || !Array.isArray(s.recipes)) throw new Error('Save file is damaged.');
  s.schemaVersion = SCHEMA_VERSION;
  withRecipeBook(s);
  if (Array.isArray(s.candidates)) ensureEveryRole(s);
  // Saves from before the local following (balance.md 4.3) are established restaurants.
  if (typeof s.following !== 'number') s.following = T.following.established;
  // Saves from before fire safety: treat every day played as a day open.
  if (!Array.isArray(s.fireSafety)) s.fireSafety = [];
  if (!Array.isArray(s.roomTouches)) s.roomTouches = [];
  for (const b of s.branches ?? []) if (!Array.isArray(b.roomTouches)) b.roomTouches = [];
  if (typeof s.daysOpen !== 'number') s.daysOpen = Math.max(0, s.day - 1);
  // Saves from before chains run one restaurant.
  if (!Array.isArray(s.branches)) s.branches = [];
  if (typeof s.locationId !== 'number') s.locationId = 1;
  return { ...raw, schemaVersion: SCHEMA_VERSION, state: s };
}

/** A compact, copyable save code (base64 of the JSON) for backend free transfer. */
export function toSaveCode(state: GameState, savedAt: number): string {
  const bytes = new TextEncoder().encode(serialise(state, savedAt));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromSaveCode(code: string): SaveFile {
  const bin = atob(code.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return deserialise(new TextDecoder().decode(bytes));
}
