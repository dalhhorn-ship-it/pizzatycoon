// fresh-start.md 6: realistic covers per service (AC-169, AC-170).
import { beforeAll, describe, expect, test } from 'vitest';
import { FURNITURE } from '../../src/data/furniture';
import { SEGMENTS } from '../../src/data/segments';
import { analyse } from '../../src/sim/analysis';
import { simulateDay } from '../../src/sim/day';
import { newGame, seatLimit } from '../../src/sim/game';
import type { DayReport } from '../../src/sim/state';
import { type BuildId, buildState, steadyState } from './builds';

const HOME: Record<BuildId, string> = { luxury: 'harbour', volume: 'university', middle: 'canal' };
const reports = {} as Record<BuildId, DayReport>;
const dinner = (r: DayReport): number => r.services.find((s) => s.service === 'dinner')?.served ?? 0;
const lunch = (r: DayReport): number => r.services.find((s) => s.service === 'lunch')?.served ?? 0;

beforeAll(() => {
  for (const b of Object.keys(HOME) as BuildId[]) reports[b] = steadyState(buildState(b, HOME[b] as string)).report;
  console.log('\\nCovers per service at home, Thursday, steady reputation');
  for (const b of Object.keys(HOME) as BuildId[]) {
    const r = reports[b];
    console.log(`${b.padEnd(8)} lunch ${lunch(r).toFixed(0).padStart(4)}  dinner ${dinner(r).toFixed(0).padStart(4)}  profit $${Math.round(r.pnl.profit)}`);
  }
});

describe('realistic covers', () => {
  test('fine dining (luxury) serves 40 to 60 dinner covers', () => {
    expect(dinner(reports.luxury)).toBeGreaterThanOrEqual(40);
    expect(dinner(reports.luxury)).toBeLessThanOrEqual(60);
  });

  test('fast turnaround (volume) serves up to about 180 dinner covers', () => {
    expect(dinner(reports.volume)).toBeLessThanOrEqual(185);
    expect(dinner(reports.volume)).toBeGreaterThan(120);
  });

  test('seat limits cap every premises; only the big hall passes 180 dinner covers', () => {
    // Ceiling: a room filled to the seat limit with the fastest service turns tables every 17 minutes plus a student dinner.
    for (const [id, cap] of [['hole', 40], ['cosy', 100], ['medium', 125], ['large', 260]] as const) {
      const seats = seatLimit(id);
      const cycle = 17.3 + SEGMENTS.students.mealLength.dinner;
      const ceiling = ((seats * 0.75 * 60) / cycle) * 4.5 * 0.65;
      expect(ceiling, id).toBeLessThanOrEqual(cap);
      if (id !== 'large') expect(ceiling, id).toBeLessThan(180);
    }
  });

  test('the fire safety seat limit blocks tables beyond 0.55 per dining tile', async () => {
    const { apply } = await import('../../src/sim/game');
    let s = newGame(1, 'canal', 'hole');
    s.cash = 99999;
    const limit = seatLimit('hole');
    expect(limit).toBe(16);
    let err: string | undefined;
    for (let i = 0; i < 12 && !err; i++) {
      const r = apply(s, { type: 'placeFurniture', itemId: 'foldingTable', x: (i % 3) * 2, y: Math.floor(i / 3) * 2 });
      err = r.error;
      s = r.state;
    }
    expect(err).toMatch(/Fire safety/);
    const seats = s.furniture.reduce((a, f) => a + (FURNITURE[f.itemId]?.seats ?? 0), 0);
    expect(seats).toBe(16);
    void analyse;
    void simulateDay;
  });
});
