// Talent ceiling on the staff market, the "Skilled staff on the market" setting, apprentice cooks at half wage,
// rookie penalties and the broader course catalogue with learning paths.

import { describe, expect, test } from 'vitest';
import { ROLE_BASE_SALARY } from '../src/data/staff';
import { COURSES } from '../src/data/training';
import { T } from '../src/data/tunables';
import { kitchenStats } from '../src/sim/analysis';
import { clampEconomy, economyOf, PRESETS, presetName } from '../src/sim/economy';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { courseProblem, ovr, staffFromSkill, talentCap } from '../src/sim/staff';
import type { GameState } from '../src/sim/state';
import { marketCap } from '../src/sim/team';

function run(s: GameState, days: number): GameState {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }, { noise: false }).state;
  return s;
}

describe('talent ceiling', () => {
  test('a new game offers mediocre people at best', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = newGame(seed, 'canal', 'cosy');
      const cap = marketCap(s, s.rep);
      expect(cap).toBeLessThanOrEqual(46);
      for (const c of s.candidates) {
        expect(ovr(c)).toBeLessThanOrEqual(cap);
        for (const a of ['quality', 'speed', 'composure', 'mentoring'] as const) expect(c.attrs[a]).toBeLessThanOrEqual(cap + T.market.talentAttrSlack);
      }
    }
  });

  test('the ceiling rises with reputation and follows the setting', () => {
    expect(talentCap(30)).toBeLessThan(talentCap(50));
    expect(talentCap(50)).toBeLessThan(talentCap(70));
    expect(talentCap(80)).toBe(92);
    expect(talentCap(30, 0.5)).toBeLessThan(talentCap(30));
    expect(talentCap(30, 1.5)).toBeGreaterThan(talentCap(30));
    const s = newGame(1, 'canal', 'cosy', { ...PRESETS.normal, talent: 1.5 });
    expect(Math.max(...s.candidates.map(ovr))).toBeGreaterThan(46);
  });

  test('the agency cannot promise stars to an unknown pizzeria', () => {
    const s = withStarterKit(newGame(3, 'canal', 'cosy'));
    s.cash = 10000;
    expect(apply(s, { type: 'agency', role: 'cook', plus: true }).error).toMatch(/unknown/);
    expect(apply(s, { type: 'agency', role: 'cook' }).error).toBeUndefined();
    s.rep = 60;
    expect(apply(s, { type: 'agency', role: 'cook', plus: true }).error).toBeUndefined();
  });

  test('saves from before the setting keep their preset', () => {
    const { talent: _t, ...oldEasy } = PRESETS.easy;
    expect(economyOf({ economy: oldEasy as never }).talent).toBe(PRESETS.easy.talent);
    expect(presetName(economyOf({ economy: oldEasy as never }))).toBe('easy');
    expect(economyOf({}).talent).toBe(1);
    expect(clampEconomy({ talent: 9 }).talent).toBe(1.5);
  });
});

describe('apprentice cooks', () => {
  test('always at least two on the market, at half a cook wage', () => {
    let s = withStarterKit(newGame(11, 'canal', 'cosy'));
    for (let d = 0; d < 30; d++) {
      const apprentices = s.candidates.filter((c) => c.apprentice && c.role === 'cook');
      expect(apprentices.length).toBeGreaterThanOrEqual(T.market.apprenticeCooks);
      for (const c of apprentices) expect(c.salary).toBeCloseTo(0.5 * ROLE_BASE_SALARY.cook, 2);
      const hire = apprentices[0]!;
      if (d % 10 === 0) {
        s.cash = 50000;
        s = apply(s, { type: 'hire', candidateId: hire.id }).state;
      }
      s = run(s, 1);
    }
  });
});

describe('rookies', () => {
  test('cooks below the rookie line cook plainer food than a steady junior', () => {
    const s = withStarterKit(newGame(3, 'canal', 'cosy'));
    const kitchen = (skill: number): number => {
      const t = structuredClone(s);
      t.staff = t.staff.map((x) => (x.role === 'cook' ? staffFromSkill(x.id, x.name, 'cook', skill, { morale: 60 }) : x));
      return kitchenStats(t).kitchenSkillK;
    };
    const linear = kitchen(5) - kitchen(4);
    // From 40 down to 30 the loss is steeper than the plain skill slope.
    expect(kitchen(4) - kitchen(3)).toBeGreaterThan(linear + 2);
  });
});

describe('courses', () => {
  test('a broad catalogue for every role, riders included', () => {
    expect(Object.keys(COURSES).length).toBeGreaterThanOrEqual(25);
    for (const role of ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager', 'rider'] as const) {
      expect(Object.values(COURSES).filter((c) => c.roles.includes(role)).length, role).toBeGreaterThanOrEqual(3);
    }
    for (const c of Object.values(COURSES)) if (c.requires) expect(COURSES[c.requires], c.id).toBeDefined();
  });

  test('a learning path: the next step opens after the first one', () => {
    let s = withStarterKit(newGame(3, 'canal', 'cosy'));
    s.cash = 50000;
    s.totalServed = 1000;
    const cook = s.staff.find((x) => x.role === 'cook')!;
    expect(courseProblem(s, cook, COURSES.pastaLab!, true)).toMatch(/Sauces and Stocks/);
    s = apply(s, { type: 'train', staffId: cook.id, courseId: 'sauceStock' }).state;
    s = run(s, 2);
    const after = s.staff.find((x) => x.id === cook.id)!;
    expect(after.done).toContain('sauceStock');
    s.day += T.training.cooldownDays;
    expect(courseProblem(s, after, COURSES.pastaLab!, true)).toBeNull();
  });
});
