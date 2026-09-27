// Old saves keep working (QA1 to QA3, AC-227): real save files written by earlier versions of the game.

import { describe, expect, test } from 'vitest';
import { PRESETS, RIVAL_PRESETS, rivalSettingsOf } from '../src/sim/economy';
import { apply, newGameAt } from '../src/sim/game';
import { activeRivals } from '../src/sim/rivals';
import { deserialise, serialise } from '../src/save/saveFile';
import { SCHEMA_VERSION, type GameState } from '../src/sim/state';
import { T } from '../src/data/tunables';
import saveV5 from './fixtures/save-v5.json?raw';
import saveV6 from './fixtures/save-v6.json?raw';

const fixture = (v: 'v5' | 'v6'): string => (v === 'v5' ? saveV5 : saveV6);

function week(s: GameState): { s: GameState; covers: number; profit: number } {
  let covers = 0;
  let profit = 0;
  for (let i = 0; i < 7; i++) {
    s = apply(s, { type: 'runDay' }).state;
    covers += s.history.at(-1)?.covers ?? 0;
    profit += s.history.at(-1)?.pnl.profit ?? 0;
  }
  return { s, covers, profit };
}

describe('old saves', () => {
  test('a schema 6 save from before live rivals loads with rivals off and plays exactly as it did (AC-227)', () => {
    const loaded = deserialise(fixture('v6')).state;
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(rivalSettingsOf(loaded).on).toBe(false);
    expect(loaded.branches).toHaveLength(1);
    expect(loaded.rivals).toEqual([]);
    expect(loaded.campaigns).toEqual([]);
    expect(loaded.delivery).toBeNull();
    // Measured with the code at 08e3aa4~1 on the same file.
    const { s, covers, profit } = week(loaded);
    expect(covers).toBeCloseTo(511.68, 1);
    expect(profit).toBeCloseTo(2296.31, 0);
    expect(s.cash).toBeCloseTo(75626.41, 0);
  });

  test('a schema 5 save (before the Squad) loads, migrates and plays a week', () => {
    const loaded = deserialise(fixture('v5')).state;
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.branches).toHaveLength(1);
    expect(loaded.staff.every((x) => typeof x.attrs.quality === 'number')).toBe(true);
    const { covers, profit } = week(loaded);
    expect(covers).toBeGreaterThan(400);
    expect(profit).toBeGreaterThan(0);
  });

  test('old history is compacted on load: only the last week keeps its detail', () => {
    const loaded = deserialise(fixture('v6')).state;
    const full = loaded.history.filter((r) => r.services.length > 0).length;
    expect(full).toBeLessThanOrEqual(T.history.fullDays);
    expect(loaded.history.at(0)?.pnl.profit).toBeTypeOf('number');
    expect(serialise(loaded, 0).length).toBeLessThan(fixture('v6').length * 0.6);
  });

  test('a save from a newer version is refused', () => {
    const raw = JSON.parse(fixture('v6')) as { schemaVersion: number };
    raw.schemaVersion = SCHEMA_VERSION + 1;
    expect(() => deserialise(JSON.stringify(raw))).toThrow(/newer version/);
  });
});

describe('save round trip and determinism with the live market', () => {
  const start = (): GameState => {
    let s = newGameAt(5, 'lockKeeper', { ...PRESETS.normal, rivals: RIVAL_PRESETS.normal });
    s.unlockAll = true;
    s.cash += 20000;
    s = apply(s, { type: 'startCampaign', campaignId: 'flyers', audience: [] }).state;
    return s;
  };
  const run = (s: GameState, days: number): GameState => {
    for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }).state;
    return s;
  };

  test('the same seed and commands give the same game with rivals on (QA3)', () => {
    const a = run(start(), 21);
    const b = run(start(), 21);
    expect(serialise(b, 0)).toBe(serialise(a, 0));
    expect(activeRivals(a).length).toBeGreaterThan(0);
  });

  test('saving and loading mid game changes nothing that follows (QA2)', () => {
    const mid = run(start(), 10);
    const straight = run(mid, 14);
    const reloaded = run(deserialise(serialise(mid, 0)).state, 14);
    expect(serialise(reloaded, 0)).toBe(serialise(straight, 0));
  });

  test('switching rivals off and on again is deterministic', () => {
    const toggle = (): GameState => {
      let s = run(start(), 7);
      s = apply(s, { type: 'setEconomy', economy: { rivals: { ...RIVAL_PRESETS.normal, on: false } } }).state;
      s = run(s, 3);
      s = apply(s, { type: 'setEconomy', economy: { rivals: RIVAL_PRESETS.normal } }).state;
      return run(s, 14);
    };
    expect(serialise(toggle(), 0)).toBe(serialise(toggle(), 0));
  });
});
