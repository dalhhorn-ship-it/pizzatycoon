// Performance budget (AC-272, cleanup sprint 2): live rivals may cost at most 30% more time per day.

import { describe, expect, test } from 'vitest';
import { PRESETS, RIVAL_PRESETS } from '../../src/sim/economy';
import { apply } from '../../src/sim/game';
import { deserialise } from '../../src/save/saveFile';
import type { GameState } from '../../src/sim/state';
import saveV6 from '../fixtures/save-v6.json?raw';

function msPerDay(rivals: boolean): number {
  let s: GameState = deserialise(saveV6).state;
  s = apply(s, { type: 'setEconomy', economy: { ...PRESETS.normal, ...(rivals ? { rivals: { ...RIVAL_PRESETS.hard, start: 30, cityCap: 30 } } : {}) } }).state;
  for (let i = 0; i < 35; i++) s = apply(s, { type: 'runDay' }).state;
  let best = Infinity;
  // Best of five runs of three weeks: the budget is about the code, not a busy test machine.
  for (let round = 0; round < 5; round++) {
    let x = s;
    const t0 = performance.now();
    for (let i = 0; i < 21; i++) x = apply(x, { type: 'runDay' }).state;
    best = Math.min(best, (performance.now() - t0) / 21);
  }
  return best;
}

describe('performance budget', () => {
  test('AC-272: two restaurants and a crowded city of rivals cost at most 1.3 times the time of rivals off', () => {
    const off = msPerDay(false);
    const on = msPerDay(true);
    console.log(`ms per day: rivals off ${off.toFixed(2)}, on ${on.toFixed(2)}, ratio ${(on / off).toFixed(2)}`);
    expect(on / off).toBeLessThanOrEqual(1.3);
  }, 120000);
});
