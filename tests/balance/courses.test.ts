// Course payback table (staff-management.md 11, AC-223): each course taken by the role it targets in its reference build.
// Prints the table so every balance change shows its effect in the CI log.

import { describe, expect, test } from 'vitest';
import { COURSES } from '../../src/data/training';
import type { Role } from '../../src/data/types';
import { courseGains } from '../../src/sim/staff';
import type { GameState } from '../../src/sim/state';
import { dayRun } from '../../src/sim/team';
import { type BuildId, buildState, steadyState } from './builds';

/** Where each course is meant to pay: build, district and the role that takes it. Mentoring courses pay back over months. */
const SCENARIOS: Record<string, { build: BuildId; district: string; role: Role } | null> = {
  doughSkills: { build: 'middle', district: 'canal', role: 'cook' },
  lineDrills: { build: 'middle', district: 'university', role: 'cook' },
  tableService: { build: 'middle', district: 'canal', role: 'server' },
  floorFlow: { build: 'volume', district: 'university', role: 'server' },
  rushBootcamp: { build: 'middle', district: 'university', role: 'cook' },
  sommelier: { build: 'luxury', district: 'harbour', role: 'server' },
  napoliMaster: { build: 'middle', district: 'canal', role: 'cook' },
  trainTrainer: null,
  leadership: null,
};

/**
 * Average profit per day over a week once reputation and the local following have settled with this team
 * (an established restaurant, balance.md 3.1), with composure in play.
 */
function weekProfit(input: GameState): number {
  const s = structuredClone(input);
  s.day = 4;
  for (let i = 0; i < 3000; i++) {
    const r = dayRun(s, { noise: false }).report;
    const settled = Math.abs(r.repAfter - s.rep) < 1e-4 && Math.abs(r.followingAfter - s.following) < 1e-5;
    s.rep = r.repAfter;
    s.following = r.followingAfter;
    if (settled) break;
  }
  let total = 0;
  for (let d = 1; d <= 7; d++) total += dayRun({ ...s, day: d }, { noise: false }).report.pnl.profit;
  return total / 7;
}

const detail: Record<string, string> = {};

export function paybackWeeks(courseId: string): number | null {
  const sc = SCENARIOS[courseId];
  const course = COURSES[courseId];
  if (!sc || !course) return null;
  const { state } = steadyState(buildState(sc.build, sc.district));
  const person = state.staff.find((x) => x.role === sc.role);
  if (!person) return null;
  // Room to grow, as a real hire would have.
  person.potential = 95;
  const base = weekProfit(state);
  const trained = structuredClone(state);
  const t = trained.staff.find((x) => x.id === person.id)!;
  const gains = courseGains(t, courseId);
  for (const [k, v] of Object.entries(gains)) t.attrs[k as keyof typeof t.attrs] += v ?? 0;
  if (course.cert) t.certs.push(course.cert);
  const perDay = weekProfit(trained) - base;
  // The rota cost: the days they are away.
  const away = structuredClone(state);
  away.staff = away.staff.filter((x) => x.id !== person.id);
  const awayCost = course.daysOff * Math.max(0, base - weekProfit(away));
  const weeks = perDay > 0 ? (course.price + awayCost) / (7 * perDay) : Infinity;
  detail[courseId] = `+$${perDay.toFixed(1)}/day, away $${Math.round(awayCost)}`;
  return weeks;
}

describe('course payback (staff-management.md 11)', () => {
  const rows = Object.keys(COURSES).map((id) => ({ id, weeks: paybackWeeks(id) }));
  const lines = rows.map((r) => `${(COURSES[r.id]?.name ?? r.id).padEnd(26)} ${r.weeks === null ? 'long term (mentoring)' : `${r.weeks.toFixed(1)} weeks (${detail[r.id]})`}`);
  console.log(`\nCourse payback\n${lines.join('\n')}\n`);

  test('every measured course pays back in 3 to 10 weeks', () => {
    for (const r of rows) {
      if (r.weeks === null) continue;
      expect(r.weeks, r.id).toBeGreaterThanOrEqual(3);
      expect(r.weeks, r.id).toBeLessThanOrEqual(10);
    }
  });
});
