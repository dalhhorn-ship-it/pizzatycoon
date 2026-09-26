// Balance checks from 01-product/balance.md 3.5 (AC-10, AC-11, AC-12, AC-105, AC-114).
// Prints the profit table so every balance change shows its effect in the CI log.

import { beforeAll, describe, expect, test } from 'vitest';
import { type BuildId, buildState, steadyState } from './builds';

const DISTRICTS = ['university', 'canal', 'harbour'] as const;
const HOME: Record<BuildId, (typeof DISTRICTS)[number]> = { luxury: 'harbour', volume: 'university', middle: 'canal' };
const BANDS: Record<BuildId, number[]> = {
  luxury: [20, 24, 28, 32, 34, 36, 38, 40],
  volume: [8, 8.5, 9, 9.5, 10],
  middle: [12, 13, 14, 15, 16],
};

type Table = Record<BuildId, Record<string, { ref: number; best: number; bestPrice: number }>>;
const table = {} as Table;

beforeAll(() => {
  for (const b of Object.keys(BANDS) as BuildId[]) {
    table[b] = {};
    for (const d of DISTRICTS) {
      const ref = steadyState(buildState(b, d)).report.pnl.profit;
      let best = -Infinity;
      let bestPrice = 0;
      for (const p of BANDS[b]) {
        const profit = steadyState(buildState(b, d, p)).report.pnl.profit;
        if (profit > best) {
          best = profit;
          bestPrice = p;
        }
      }
      table[b][d] = { ref, best, bestPrice };
    }
  }
  const fmt = (n: number): string => `$${Math.round(n)}`.padStart(7);
  const lines = ['build    ' + DISTRICTS.map((d) => d.padEnd(24)).join('')];
  for (const b of Object.keys(table) as BuildId[]) {
    lines.push(b.padEnd(9) + DISTRICTS.map((d) => {
      const c = table[b][d] as Table[BuildId][string];
      return `${fmt(c.ref)} best ${fmt(c.best)} @${c.bestPrice}`.padEnd(24);
    }).join(''));
  }
  console.log(`\nProfit per day at steady reputation (reference price, best price in band)\n${lines.join('\n')}\n`);
});

const best = (b: BuildId, d: string): number => table[b][d]?.best ?? NaN;
const ref = (b: BuildId, d: string): number => table[b][d]?.ref ?? NaN;

describe('strategy balance (balance.md 3.5)', () => {
  test('two strategies both win: luxury and volume home profits within 10%', () => {
    const l = ref('luxury', 'harbour');
    const v = ref('volume', 'university');
    expect(Math.abs(l - v) / Math.max(l, v)).toBeLessThanOrEqual(0.1);
  });

  test('neither strictly dominates: each build tops its home district', () => {
    for (const b of Object.keys(HOME) as BuildId[]) {
      const d = HOME[b];
      for (const other of Object.keys(HOME) as BuildId[]) {
        if (other !== b) expect(best(b, d), `${b} should beat ${other} in ${d}`).toBeGreaterThan(best(other, d));
      }
    }
  });

  test('middle ground not dominant: specialists beat the best middle build at home by 15% or more', () => {
    expect(best('volume', 'university')).toBeGreaterThanOrEqual(1.15 * best('middle', 'university'));
    expect(best('luxury', 'harbour')).toBeGreaterThanOrEqual(1.15 * best('middle', 'harbour'));
  });

  test('middle ground possible: profitable everywhere', () => {
    for (const d of DISTRICTS) expect(best('middle', d)).toBeGreaterThan(0);
  });

  test("specialists must fit their district: they lose money in the other specialist's home", () => {
    expect(ref('luxury', 'university')).toBeLessThan(0);
    expect(ref('volume', 'harbour')).toBeLessThan(0);
  });
});
