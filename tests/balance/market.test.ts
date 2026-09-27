// Live market sanity (competition.md 11, AC-273): a middle build in Canal Quarter for 26 weeks with live rivals.

import { describe, expect, test } from 'vitest';
import { PRESETS, RIVAL_PRESETS } from '../../src/sim/economy';
import { apply } from '../../src/sim/game';
import { activeRivals, seedRivals } from '../../src/sim/rivals';
import type { GameState } from '../../src/sim/state';
import { buildState } from './builds';

const WEEKS = 26;

function play(seed: number, level: 'easy' | 'normal' | 'hard', rivals = true) {
  let s: GameState = buildState('middle', 'canal');
  s.seed = seed;
  s.cash = 20000;
  s.rep = 60;
  s.following = 0.6;
  s.economy = { ...PRESETS[level], ...(rivals ? { rivals: RIVAL_PRESETS[level] } : {}) };
  seedRivals(s);
  let profit = 0;
  let cEff = 0;
  let days = 0;
  const seen = new Set<string>();
  const kinds: Record<string, number> = {};
  const profits: number[] = [];
  let maxChain = 0;
  for (let d = 0; d < WEEKS * 7; d++) {
    s = apply(s, { type: 'runDay' }).state;
    const r = s.history.at(-1);
    profit += r?.pnl.profit ?? 0;
    if (r?.market) {
      cEff += Object.values(r.market.cEff).reduce((a, b) => a + b, 0) / 6;
      days++;
    }
    for (const n of s.marketNews ?? []) {
      const k = `${n.day}|${n.text}`;
      if (seen.has(k)) continue;
      seen.add(k);
      kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
    }
    maxChain = Math.max(maxChain, ...activeRivals(s).map((x) => x.locations.length));
    if (d % 7 === 6 && d > 56) {
      for (const rv of activeRivals(s)) for (const l of rv.locations) if (s.day - l.opened > 28 && l.history.at(-1)) profits.push((l.history.at(-1)?.profit ?? 0) / 7);
    }
  }
  profits.sort((a, b) => a - b);
  return {
    profit: profit / (WEEKS * 7), cEff: days ? cEff / days : 0, active: activeRivals(s).length, closings: kinds.closing ?? 0, openings: kinds.opening ?? 0,
    median: profits[Math.floor(profits.length / 2)] ?? 0, maxChain,
  };
}

describe('live market sanity (AC-273)', () => {
  test('Normal: competition, rival count, churn, rival profits and the player profit stay in their bands', () => {
    const off = play(1, 'normal', false).profit;
    const cEffs: number[] = [];
    for (const seed of [1, 2, 3]) {
      const on = play(seed, 'normal');
      cEffs.push(on.cEff);
      expect(on.cEff).toBeGreaterThanOrEqual(0.22);
      expect(on.cEff).toBeLessThanOrEqual(0.55);
      expect(on.active).toBeGreaterThanOrEqual(8);
      expect(on.active).toBeLessThanOrEqual(RIVAL_PRESETS.normal.cityCap);
      expect(on.closings).toBeGreaterThan(0);
      expect(on.openings).toBeGreaterThan(0);
      expect(on.maxChain).toBeLessThanOrEqual(4);
      expect(on.median).toBeGreaterThan(-50);
      expect(on.median).toBeLessThan(450);
      expect(on.profit / off).toBeGreaterThan(0.75);
      expect(on.profit / off).toBeLessThan(1.1);
    }
    // AC-273 reads the player's average C_eff at home.
    expect(cEffs.reduce((a, b) => a + b, 0) / cEffs.length).toBeGreaterThanOrEqual(0.25);
  }, 120000);

  test('Hard costs the player more than Easy, and both stay above their floors', () => {
    const easy = play(4, 'easy').profit / play(4, 'easy', false).profit;
    const hard = play(4, 'hard').profit / play(4, 'hard', false).profit;
    expect(easy).toBeGreaterThanOrEqual(0.85);
    expect(hard).toBeGreaterThanOrEqual(0.65);
    expect(hard).toBeLessThan(easy);
  }, 120000);
});
