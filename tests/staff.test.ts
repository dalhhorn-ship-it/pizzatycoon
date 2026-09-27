// Staff management, the Squad (staff-management.md, AC-194 to AC-224).
import { describe, expect, test } from 'vitest';
import { PERSONALITIES, PERSONALITY_IDS } from '../src/data/personalities';
import { T } from '../src/data/tunables';
import { analyse, kitchenStats } from '../src/sim/analysis';
import { apply, newGame, withStarterKit } from '../src/sim/game';
import { Rng } from '../src/sim/rng';
import {
  type DaySignals, coachProblem, courseGains, effAttr, formOf, makeCandidate, makeStaff, marketValue, migrateStaff, moodOf, onRota, ovr,
  ovrFor, pickPersonality, pressureMult, pressureQuality, salaryFor, scoutRange, staffFromSkill, standardReplacement, stepMorale, tierOf,
} from '../src/sim/staff';
import type { Attrs, GameState, Staff } from '../src/sim/state';
import { contributions, dayRun, needsPressure, pickWithAccuracy, teamDay } from '../src/sim/team';
import { deserialise, serialise } from '../src/save/saveFile';
import { buildState, steadyState } from './balance/builds';

const attrs = (quality: number, speed: number, composure: number, mentoring: number): Attrs => ({ quality, speed, composure, mentoring });
const person = (id: number, role: Staff['role'], a: Attrs, extra: Partial<Staff> = {}): Staff =>
  Object.assign(makeStaff({ id, name: `P${id}`, role, attrs: a, potential: 70, personality: [] }), extra);

const neutral = (over: Partial<DaySignals> = {}): DaySignals => ({
  load: { kitchen: over.rho ?? 0, floor: over.rho ?? 0, back: over.rho ?? 0 },
  open: false, rho: 0, ticketOver: 0, food: 0.6, repDelta7: 0, oneStarReviews: 0, understaffed: false, basicShare: 0,
  teamMorale: 60, left: 0, letGo: 0, hotheadsDown: {}, calm: 1, day: 10, ...over,
});

function run(s: GameState, days: number): GameState {
  for (let i = 0; i < days; i++) s = apply(s, { type: 'runDay' }, { noise: false }).state;
  return s;
}

describe('player card (AC-194, AC-195)', () => {
  test('OVR, tier and salary', () => {
    const cook = person(1, 'cook', attrs(60, 70, 50, 30));
    expect(ovr(cook)).toBe(60);
    expect(tierOf(ovr(cook))).toBe('silver');
    expect(salaryFor('cook', 60, 0)).toBeCloseTo(616, 2);
    expect(ovrFor('chef', attrs(60, 70, 50, 30))).toBe(54);
  });

  test('card tiers', () => {
    expect([49, 50, 64, 65, 79, 80].map(tierOf)).toEqual(['bronze', 'silver', 'silver', 'gold', 'gold', 'elite']);
  });
});

describe('attributes in the sim (AC-196, AC-197)', () => {
  test('a v5 save migrates to neutral composure and the same day', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    s.day = 4;
    const old = structuredClone(s) as unknown as Record<string, unknown>;
    old.schemaVersion = 5;
    old.staff = s.staff.map((x, i) => ({
      id: x.id, name: x.name, role: x.role, skill: x.attrs.quality / 10, potential: x.potential / 10, fame: 0,
      traits: [['steady'], ['crowdPleaser'], ['charmer'], ['nightOwl'], ['steady', 'mentor']][i], morale: 50, salary: x.salary,
      shiftsWorked: 0, lowMoraleDays: 0, leavingOnDay: null,
    }));
    const loaded = deserialise(JSON.stringify({ schemaVersion: 5, savedAt: 0, summary: {}, state: old })).state;
    const cook = loaded.staff[0]!;
    expect(cook.attrs).toEqual({ quality: 50, speed: 50, composure: 50, mentoring: 50 });
    expect(cook.personality).toEqual(['steady']);
    expect(loaded.staff[1]!.talent).toBe('crowdPleaser');
    expect(loaded.staff[1]!.personality).toEqual(['easyGoing']);
    expect(loaded.staff[4]!.attrs.mentoring).toBe(70);
    expect(loaded.staff.map((x) => x.salary)).toEqual(s.staff.map((x) => x.salary));
    expect(loaded.candidates.length).toBeGreaterThan(0);
    expect(dayRun(loaded, { noise: false }).report.pnl).toEqual(dayRun(s, { noise: false }).report.pnl);
    expect(needsPressure(loaded)).toBe(false);
  });

  test('Quality drives kitchen skill, Speed drives throughput', () => {
    const base = withStarterKit(newGame(1, 'canal', 'cosy'));
    const kitchen = (a: Attrs): ReturnType<typeof kitchenStats> => {
      const s = structuredClone(base);
      s.staff = s.staff.filter((x) => x.role !== 'cook');
      s.staff.push(person(900, 'cook', a), person(901, 'cook', a));
      return kitchenStats(s, 'dinner');
    };
    const A = kitchen(attrs(70, 30, 50, 50));
    const B = kitchen(attrs(30, 70, 50, 50));
    expect(A.kitchenSkillK).toBeGreaterThan(B.kitchenSkillK);
    expect(B.ovenPerHour).toBeGreaterThan(A.ovenPerHour);
    expect(B.prepPerHour).toBeGreaterThan(A.prepPerHour);
    // K = 30 + 7 x QUA/10 (+ morale 50 x 1.0) = 79 for QUA 70.
    expect(A.kitchenSkillK).toBeCloseTo(79, 5);
  });
});

describe('composure (AC-198, AC-199)', () => {
  test('pressure multipliers', () => {
    expect(pressureMult(20, 1.2)).toBeCloseTo(0.88, 5);
    expect(pressureMult(50, 1.2)).toBeCloseTo(1, 5);
    expect(pressureMult(90, 1.2)).toBeCloseTo(1.08, 5);
    expect(pressureQuality(pressureMult(20, 1.2))).toBeCloseTo(0.94, 5);
    expect(pressureQuality(pressureMult(90, 1.2))).toBe(1);
    for (const c of [20, 50, 90]) expect(pressureMult(c, 0.8)).toBe(1);
    expect(pressureMult(0, 2)).toBeCloseTo(0.7, 5);
  });

  test('the pressure a day runs with is read before composure', () => {
    const s = buildState('volume', 'university');
    const at = (c: number): GameState => {
      const t = structuredClone(s);
      for (const x of t.staff) x.attrs.composure = c;
      return t;
    };
    expect(dayRun(at(20), { noise: false }).a.pressure).toEqual(dayRun(at(90), { noise: false }).a.pressure);
  });
});

describe('market (AC-202 to AC-206)', () => {
  test('24 candidates, every role, 21 days at most, apprentices each week', () => {
    let s = withStarterKit(newGame(11, 'canal', 'cosy'));
    for (let d = 0; d < 70; d++) {
      expect(s.candidates.length).toBe(T.market.pool);
      for (const role of ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager']) expect(s.candidates.some((c) => c.role === role)).toBe(true);
      for (const c of s.candidates) expect(s.day - c.hiredDay).toBeLessThan(T.market.stayDays);
      s = run(s, 1);
    }
    const apprentices = s.candidates.filter((c) => c.apprentice);
    expect(apprentices.length).toBeGreaterThanOrEqual(2);
    for (const c of apprentices) {
      expect(ovr(c)).toBeGreaterThanOrEqual(25 - 2);
      expect(ovr(c)).toBeLessThanOrEqual(40 + 2);
      expect(c.salary).toBeCloseTo(0.6 * { chef: 900, cook: 550, server: 450, host: 420, dishwasher: 380, manager: 1100 }[c.role], 2);
    }
  });

  test('tier mix follows reputation', () => {
    const share = (rep: number): number[] => {
      const rng = new Rng(rep);
      const n = [0, 0, 0, 0];
      for (let i = 0; i < 1000; i++) n[['bronze', 'silver', 'gold', 'elite'].indexOf(tierOf(ovr(makeCandidate(rng, i, 'cook', 1, rep))))]! += 1;
      return n.map((x) => x / 1000);
    };
    const low = share(30);
    expect(low[3]).toBe(0);
    expect(Math.abs(low[2]! - 0.05)).toBeLessThan(0.03);
    const high = share(65);
    expect(Math.abs(high[2]! - 0.28)).toBeLessThan(0.04);
    expect(Math.abs(high[3]! - 0.07)).toBeLessThan(0.03);
  });

  test('gold and elite candidates want a reputation first', () => {
    const s = withStarterKit(newGame(3, 'canal', 'cosy'));
    const elite = makeCandidate(new Rng(1), 7000, 'chef', s.day, 70, { tier: 'elite' });
    s.candidates.push(elite);
    s.cash = 100000;
    s.rep = 55;
    expect(apply(s, { type: 'hire', candidateId: 7000 }).error).toMatch(/3 star/);
    s.rep = 60;
    expect(apply(s, { type: 'hire', candidateId: 7000 }).error).toBeUndefined();
  });

  test('offers 10% below asking land about 60% of the time, 20% for the Money Minded', () => {
    const rate = (money: boolean): number => {
      let ok = 0;
      for (let seed = 0; seed < 1000; seed++) {
        const s = newGame(seed, 'canal', 'hole');
        const c = s.candidates[0]!;
        c.personality = money ? ['moneyMinded'] : ['steady'];
        const r = apply(s, { type: 'hire', candidateId: c.id, low: true });
        if (r.state.staff.length) {
          ok += 1;
          expect(r.state.staff[0]!.salary).toBeCloseTo(c.salary * 0.9, 1);
        } else expect(r.state.candidates.some((x) => x.id === c.id)).toBe(false);
      }
      return ok / 1000;
    };
    expect(Math.abs(rate(false) - 0.6)).toBeLessThan(0.04);
    expect(Math.abs(rate(true) - 0.2)).toBeLessThan(0.04);
  });

  test('the agency delivers 3 candidates with the key attribute 60 or more', () => {
    let s = withStarterKit(newGame(3, 'canal', 'cosy'));
    const cash = s.cash;
    s = apply(s, { type: 'agency', role: 'server' }).state;
    expect(s.cash).toBe(cash - 250);
    const before = s.candidates.length;
    s = run(s, 2);
    const fresh = s.candidates.filter((c) => c.role === 'server' && c.hiredDay >= s.day - 1 && c.scouted);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(s.candidates.length).toBeGreaterThanOrEqual(before);
    for (const c of fresh.slice(-3)) expect(Math.max(c.attrs.quality, c.attrs.speed)).toBeGreaterThanOrEqual(60);
  });

  test('scouting ranges contain the truth; 3 free interviews a week', () => {
    let s = newGame(5, 'canal', 'hole');
    for (const c of s.candidates) {
      for (const a of ['quality', 'speed', 'composure', 'mentoring'] as const) {
        const [lo, hi] = scoutRange(c, a);
        expect(c.attrs[a]).toBeGreaterThanOrEqual(lo);
        expect(c.attrs[a]).toBeLessThanOrEqual(hi);
        expect(hi - lo).toBeLessThanOrEqual(['gold', 'elite'].includes(tierOf(ovr(c))) ? 10 : 16);
      }
    }
    const cash = s.cash;
    for (const c of s.candidates.slice(0, 4)) s = apply(s, { type: 'interview', candidateId: c.id }).state;
    expect(s.cash).toBe(cash - 40);
    expect(s.candidates.slice(0, 4).every((c) => c.scouted)).toBe(true);
  });
});

describe('development (AC-208 to AC-213)', () => {
  function kitchenOf(cooks: Staff[]): GameState {
    const s = withStarterKit(newGame(4, 'canal', 'cosy'));
    s.staff = [...s.staff.filter((x) => x.role !== 'cook'), ...cooks];
    return s;
  }

  test('natural growth: 10 points per 40 shifts, 13 with a MEN 80 teammate', () => {
    const grow = (mentor: boolean): Staff => {
      const cook = person(900, 'cook', attrs(50, 50, 50, 50), { potential: 70 });
      const team = mentor ? [cook, person(901, 'cook', attrs(50, 50, 50, 80), { potential: 50 })] : [cook];
      let s = kitchenOf(team);
      while ((s.staff.find((x) => x.id === 900)?.shiftsWorked ?? 0) < 40) s = run(s, 1);
      return s.staff.find((x) => x.id === 900)!;
    };
    const alone = grow(false);
    expect(alone.attrs.speed).toBe(60);
    expect(ovr(alone)).toBe(54);
    const mentored = grow(true);
    expect(mentored.attrs.speed - 50 + mentored.attrs.quality - 50).toBe(13);
  });

  test('coaching: +2 a week from a MEN 70 coach; bad pairs are refused', () => {
    const coach = person(901, 'cook', attrs(60, 60, 50, 70), { potential: 60 });
    const trainee = person(900, 'cook', attrs(40, 50, 50, 50), { potential: 70 });
    let s = kitchenOf([coach, trainee]);
    s = apply(s, { type: 'coach', coachId: 901, traineeId: 900, attr: 'quality' }).state;
    const a0 = analyse(s);
    const noCoach = structuredClone(s);
    noCoach.staff.find((x) => x.id === 901)!.coaching = null;
    expect(a0.kitchen.ovenPerHour).toBeLessThan(analyse(noCoach).kitchen.ovenPerHour);
    s = run(s, 7);
    expect(s.staff.find((x) => x.id === 900)!.attrs.quality).toBe(42);
    expect(coachProblem(person(1, 'cook', attrs(50, 50, 50, 45)), trainee)).toMatch(/Mentoring/);
    expect(coachProblem(person(1, 'server', attrs(50, 50, 50, 80)), trainee)).toMatch(/same area/);
    expect(coachProblem(trainee, trainee)).toMatch(/themselves/);
  });

  test('courses: gains, cost, days off, cooldown, low morale', () => {
    const c1 = person(900, 'cook', attrs(50, 50, 50, 50), { potential: 70, morale: 60 });
    const c2 = person(901, 'cook', attrs(66, 66, 66, 66), { potential: 70, morale: 60 });
    const c3 = person(902, 'cook', attrs(50, 50, 50, 50), { potential: 70, morale: 60, talent: 'eagerLearner' });
    // Base +10; near potential a quarter (2.5, rounded half up); Eager Learner x1.25; low morale x0.7.
    expect(courseGains(c1, 'doughSkills').quality).toBe(10);
    expect(courseGains(c2, 'doughSkills').quality).toBe(3);
    expect(courseGains(c3, 'doughSkills').quality).toBe(13);
    expect(courseGains({ ...c1, morale: 35 }, 'doughSkills').quality).toBe(7);
    let s = kitchenOf([c1, c3]);
    const cash = s.cash;
    s = apply(s, { type: 'train', staffId: 900, courseId: 'doughSkills' }).state;
    expect(s.cash).toBe(cash - 300);
    expect(onRota(s.staff, s.day).some((x) => x.id === 900)).toBe(false);
    s = run(s, 1);
    expect(onRota(s.staff, s.day).some((x) => x.id === 900)).toBe(true);
    expect(s.staff.find((x) => x.id === 900)!.attrs.quality).toBe(60);
    expect(apply(s, { type: 'train', staffId: 900, courseId: 'lineDrills' }).error).toMatch(/14 days/);
    expect(apply(s, { type: 'train', staffId: 900, courseId: 'tableService' }).error).toMatch(/not for a cook/);
  });

  test('contract review asks for market value; declining leaves pay fairness negative', () => {
    const cook = person(900, 'cook', attrs(60, 70, 50, 30), { potential: 80, salary: 616 });
    expect(marketValue(cook)).toBeCloseTo(677.6, 2);
    expect(marketValue({ ...cook, personality: ['moneyMinded'] })).toBeCloseTo(745.36, 2);
    const { drivers } = moodOf(cook, neutral());
    expect(drivers.find((d) => d.label.startsWith('paid below'))!.value).toBeCloseTo(-4.55, 1);
    cook.nextReviewDay = 6;
    let s = kitchenOf([cook]);
    s.day = 5;
    s = run(s, 1);
    const asked = s.staff.find((x) => x.id === 900)!;
    expect(asked.review?.ask).toBeCloseTo(677.6, 1);
    s = apply(s, { type: 'answerReview', staffId: 900, accept: false }).state;
    expect(s.staff.find((x) => x.id === 900)!.salary).toBe(616);
    expect(s.staff.find((x) => x.id === 900)!.review).toBeNull();
  });

  test('promotion thresholds', () => {
    const s = kitchenOf([person(900, 'cook', attrs(59, 59, 59, 59)), person(901, 'cook', attrs(60, 60, 60, 60))]);
    s.staff.push(person(902, 'server', attrs(50, 50, 50, 54)), person(903, 'server', attrs(50, 50, 50, 55)));
    expect(apply(s, { type: 'promote', staffId: 900, role: 'chef' }).error).toMatch(/OVR 60/);
    const t = apply(s, { type: 'promote', staffId: 901, role: 'chef' });
    expect(t.error).toBeUndefined();
    expect(t.state.staff.find((x) => x.id === 901)!.role).toBe('chef');
    expect(apply(s, { type: 'promote', staffId: 902, role: 'manager' }).error).toMatch(/Mentoring 55/);
    expect(apply(s, { type: 'promote', staffId: 903, role: 'manager' }).error).toBeUndefined();
  });
});

describe('mood (AC-214 to AC-217, AC-220)', () => {
  test('morale moves 4 a day toward a target built from drivers', () => {
    const p = person(1, 'cook', attrs(60, 70, 50, 30), { potential: 60, salary: 550, morale: 50 });
    p.potential = ovr(p);
    const mv = marketValue(p);
    p.salary = mv * (550 / 616);
    const { target } = moodOf(p, neutral());
    expect(target).toBeCloseTo(59.6, 1);
    let m = 50;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) seen.push((m = stepMorale(m, target, false)));
    expect(seen.map((x) => Math.round(x * 10) / 10)).toEqual([54, 58, 59.6, 59.6]);
    expect(moodOf(p, neutral({ understaffed: true })).target).toBeCloseTo(53.6, 1);
  });

  test('Thrill Seeker: 72 on a packed Friday, 57 on a quiet lunch', () => {
    const p = person(1, 'cook', attrs(50, 50, 50, 50), { personality: ['thrillSeeker'] });
    p.potential = ovr(p);
    p.salary = marketValue(p);
    expect(moodOf(p, neutral({ open: true, rho: 1.0 })).target).toBeCloseTo(72, 5);
    expect(moodOf(p, neutral({ open: true, rho: 0.4 })).target).toBeCloseTo(57, 5);
  });

  test('personalities read their signals', () => {
    const at = (id: Staff['personality'][number], sig: Partial<DaySignals>): number => {
      const p = person(1, 'cook', attrs(50, 50, 50, 50), { personality: [id] });
      p.potential = ovr(p);
      p.salary = marketValue(p);
      return moodOf(p, neutral(sig)).target;
    };
    expect(at('craftsperson', { open: true, food: 0.8, rho: 0.6 })).toBe(73);
    expect(at('craftsperson', { open: true, food: 0.4, rho: 0.6 })).toBe(55);
    expect(at('racer', { open: true, ticketOver: -1, rho: 0.6 })).toBe(71);
    expect(at('racer', { open: true, ticketOver: 6, rho: 0.6 })).toBe(57);
    expect(at('calmSoul', { open: true, rho: 0.7 })).toBe(71);
    expect(at('gloryHunter', { repDelta7: 2 })).toBe(71);
    expect(at('gloryHunter', { repDelta7: -2, oneStarReviews: 2 })).toBe(55);
    expect(at('teamPlayer', { teamMorale: 75 })).toBe(71);
    expect(at('teamPlayer', { letGo: 1 })).toBe(57);
    expect(at('loyal', { understaffed: true })).toBe(62);
    expect(at('easyGoing', { understaffed: true })).toBe(67.5);
    expect(at('hothead', { understaffed: true })).toBe(56);
    expect(at('steady', { hotheadsDown: { kitchen: 1 } })).toBe(62);
    expect(stepMorale(40, 20, true)).toBe(50);
  });

  test('spawn frequencies follow the weights', () => {
    const rng = new Rng(9);
    const n: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const id = pickPersonality(rng);
      n[id] = (n[id] ?? 0) + 1;
    }
    const total = PERSONALITY_IDS.reduce((x, id) => x + PERSONALITIES[id].weight, 0);
    for (const id of PERSONALITY_IDS) expect(Math.abs((n[id] ?? 0) / 10000 - PERSONALITIES[id].weight / total)).toBeLessThan(0.01);
  });

  test('form after 5 days high or low', () => {
    let s = withStarterKit(newGame(8, 'canal', 'cosy'));
    const cook = s.staff[0]!;
    cook.personality = ['easyGoing'];
    cook.morale = 90;
    // A very happy restaurant keeps her above 80.
    for (let i = 0; i < 5; i++) {
      s.staff[0]!.morale = 90;
      s = run(s, 1);
    }
    expect(s.staff[0]!.formDays).toBeGreaterThanOrEqual(5);
    expect(formOf(s.staff[0]!)).toBe(1);
    expect(effAttr(s.staff[0]!, 'quality')).toBe(s.staff[0]!.attrs.quality + 3);
    s.staff[0]!.formDays = -5;
    expect(formOf(s.staff[0]!)).toBe(-1);
  });

  test('a mixed team paid at market in a fitting restaurant stays content', () => {
    let s = buildState('middle', 'university');
    s.rep = 55;
    s.following = 0.9;
    const rng = new Rng(3);
    for (const x of s.staff) {
      x.personality = [pickPersonality(rng)];
      x.salary = marketValue(x);
      x.morale = 65;
    }
    for (let d = 0; d < 28; d++) {
      s = run(s, 1);
      const avg = s.staff.reduce((a, x) => a + x.morale, 0) / s.staff.length;
      expect(avg).toBeGreaterThanOrEqual(60);
      expect(avg).toBeLessThanOrEqual(75);
      expect(s.staff.every((x) => x.leavingOnDay === null)).toBe(true);
    }
  });
});

describe('rival offers (AC-218)', () => {
  test('about 15% of weeks for an underpaid star, never for the Loyal', () => {
    const base = withStarterKit(newGame(2, 'canal', 'cosy'));
    base.day = 7; // Sunday
    const { a, report } = dayRun(base, { noise: false });
    let offers = 0;
    let loyalOffers = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const s = structuredClone(base);
      s.seed = seed;
      s.staff = s.staff.filter((x) => x.role !== 'cook');
      const star = person(900, 'cook', attrs(75, 75, 75, 60), { personality: ['steady'] });
      star.potential = ovr(star);
      star.salary = marketValue(star) * 0.88;
      const loyal = { ...structuredClone(star), id: 901, personality: ['loyal' as const] };
      s.staff.push(star, loyal);
      const r = teamDay(s, report, a, { noise: false, managed: false, contrib: false, bestRep: s.rep });
      if (s.staff.find((x) => x.id === 900)?.offer) offers += 1;
      if (s.staff.find((x) => x.id === 901)?.offer) loyalOffers += 1;
      if (seed === 0 && s.staff.find((x) => x.id === 900)?.offer) expect(r.events.some((e) => e.kind === 'staffOffer')).toBe(true);
    }
    expect(Math.abs(offers / 1000 - 0.15)).toBeLessThan(0.03);
    expect(loyalOffers).toBe(0);
  });

  test('match or let go', () => {
    const s = withStarterKit(newGame(2, 'canal', 'cosy'));
    const x = s.staff[0]!;
    x.offer = { rival: 'Da Enzo', salary: 700, leavesOnDay: s.day + 7 };
    const matched = apply(s, { type: 'answerOffer', staffId: x.id, match: true }).state.staff[0]!;
    expect(matched.salary).toBe(700);
    expect(matched.offer).toBeNull();
    const gone = apply(s, { type: 'answerOffer', staffId: x.id, match: false }).state;
    expect(gone.staff.some((y) => y.id === x.id)).toBe(false);
  });
});

describe('contributions (AC-219)', () => {
  test('a standard replacement is worth $0; a nervous cook struggles in a Friday rush', () => {
    const s = buildState('volume', 'university');
    s.rep = 60;
    s.following = 1;
    s.day = 5; // Friday
    const cook = s.staff.find((x) => x.role === 'cook')!;
    s.staff = s.staff.map((x) => (x.id === cook.id ? { ...standardReplacement(x), id: cook.id } : x));
    const { a, report } = dayRun(s, { noise: false });
    expect(Math.abs(contributions(s, a, report, { noise: false }, [cook.id])[0]!.value)).toBeLessThan(0.5);
    const nervous = structuredClone(s);
    nervous.staff.find((x) => x.id === cook.id)!.attrs.composure = 20;
    const d = dayRun(nervous, { noise: false });
    expect(Math.max(...d.report.services.map((x) => x.rho))).toBeGreaterThan(0.9);
    const c = contributions(nervous, d.a, d.report, { noise: false }, [cook.id])[0]!;
    expect(c.value).toBeLessThan(0);
    expect(c.reason).toMatch(/pressure/);
  });

  test('the day report carries the team and at most two mood lines', () => {
    const s = withStarterKit(newGame(1, 'canal', 'cosy'));
    const r = apply(s, { type: 'runDay' }, { noise: false }).events.find((e) => e.kind === 'dayCompleted')!.report!;
    expect(r.team?.length).toBe(s.staff.length);
    expect((r.mood ?? []).length).toBeLessThanOrEqual(2);
  });
});

describe('balance (AC-222, AC-223)', () => {
  test('reference builds run at neutral composure', () => {
    for (const b of ['middle', 'volume', 'luxury'] as const) expect(needsPressure(buildState(b, 'university'))).toBe(false);
  });

  test('strategy fit: composure pays in volume, quality pleases luxury guests', () => {
    const gain = (build: 'volume' | 'luxury', district: string, f: (x: Staff) => void): { profit: number; satisfaction: number } => {
      const { state } = steadyState(buildState(build, district));
      state.day = 5;
      // The same cooks in both kitchens, so only the restaurant differs.
      for (const x of state.staff) if (x.role === 'cook' || x.role === 'chef') x.attrs.quality = 50;
      const before = dayRun(state, { noise: false }).report;
      const t = structuredClone(state);
      for (const x of t.staff) if (x.role === 'cook' || x.role === 'chef') f(x);
      const after = dayRun(t, { noise: false }).report;
      return { profit: after.pnl.profit - before.pnl.profit, satisfaction: after.satisfaction - before.satisfaction };
    };
    const calm = (x: Staff): void => {
      x.attrs.composure = 80;
    };
    const craft = (x: Staff): void => {
      x.attrs.quality += 20;
    };
    // A volume kitchen runs flat out, so calm cooks earn money; a luxury kitchen has room to breathe.
    expect(gain('volume', 'university', calm).profit).toBeGreaterThan(gain('luxury', 'harbour', calm).profit);
    // Luxury guests taste the difference: better cooks lift satisfaction (and so reputation and prices) more there.
    expect(gain('luxury', 'harbour', craft).satisfaction).toBeGreaterThan(gain('volume', 'university', craft).satisfaction);
  });
});

describe('the manager runs the team (AC-224)', () => {
  test('picks the best of three about 0.40 + 0.005 x P of the time', () => {
    for (const [p, want] of [[50, 0.65], [90, 0.85]] as const) {
      const rng = new Rng(p);
      let best = 0;
      for (let i = 0; i < 1000; i++) if (pickWithAccuracy(['a', 'b', 'c'], p, rng) === 'a') best += 1;
      expect(Math.abs(best / 1000 - want)).toBeLessThan(0.04);
    }
  });

  test('a managed restaurant trains its staff and they change morale', () => {
    const s = withStarterKit(newGame(5, 'canal', 'cosy'));
    s.cash = 50000;
    s.rep = 60;
    s.staff.push(staffFromSkill(990, 'Nora Park', 'manager', 7));
    let t = apply(s, { type: 'openRestaurant', venueId: 'campusGate' }).state;
    t = apply(t, { type: 'setStaffPolicy', policy: { budget: 1000 }, locationId: t.branches[0]!.id }).state;
    expect(t.branches[0]!.staffPolicy?.budget).toBe(1000);
    const before = structuredClone(t.branches[0]!.staff);
    const week = apply(t, { type: 'runWeek' }, { noise: false });
    const b = week.state.branches[0]!;
    const changed = b.staff.some((x) => {
      const o = before.find((y) => y.id === x.id);
      return !!o && (o.morale !== x.morale || JSON.stringify(o.attrs) !== JSON.stringify(x.attrs) || !!x.course);
    });
    expect(changed).toBe(true);
    const days = week.events.find((e) => e.kind === 'weekCompleted')?.reports ?? [];
    expect(days.some((r) => r.branches?.[0]?.staffLine?.includes('Nora Park'))).toBe(true);
  });

  test('Override: a command can act on a managed restaurant', () => {
    const s = withStarterKit(newGame(5, 'canal', 'cosy'));
    s.cash = 50000;
    s.rep = 60;
    s.staff.push(staffFromSkill(990, 'Nora Park', 'manager', 7));
    const t = apply(s, { type: 'openRestaurant', venueId: 'campusGate' }).state;
    const branch = t.branches[0]!;
    const cook = branch.staff.find((x) => x.role === 'cook')!;
    const r = apply(t, { type: 'train', staffId: cook.id, courseId: 'doughSkills', locationId: branch.id });
    expect(r.error).toBeUndefined();
    expect(r.state.branches[0]!.staff.find((x) => x.id === cook.id)!.course?.id).toBe('doughSkills');
    expect(r.state.cash).toBe(t.cash - 300);
    expect(r.state.locationId).toBe(t.locationId);
    expect(r.state.venueId).toBe(t.venueId);
  });
});

describe('commands', () => {
  test('days off reverse a notice; apprentices leave without severance', () => {
    const s = withStarterKit(newGame(5, 'canal', 'cosy'));
    s.staff[0]!.leavingOnDay = s.day + 3;
    const t = apply(s, { type: 'daysOff', staffId: s.staff[0]!.id }).state;
    expect(t.staff[0]!.leavingOnDay).toBeNull();
    expect(onRota(t.staff, t.day).some((x) => x.id === s.staff[0]!.id)).toBe(false);
    const a = makeCandidate(new Rng(1), 7777, 'cook', 1, 30, { apprentice: true });
    const u = structuredClone(s);
    u.staff.push(a);
    expect(apply(u, { type: 'fire', staffId: 7777 }).state.cash).toBe(u.cash);
  });

  test('delegation needs a manager', () => {
    const s = withStarterKit(newGame(5, 'canal', 'cosy'));
    expect(apply(s, { type: 'setDelegateStaff', on: true }).error).toMatch(/manager/);
    s.staff.push(staffFromSkill(990, 'Nora Park', 'manager', 7));
    expect(apply(s, { type: 'setDelegateStaff', on: true }).state.delegateStaff).toBe(true);
  });

  test('migrateStaff keeps the old salary and gives managers all four at 10 x skill', () => {
    const m = migrateStaff({ id: 1, name: 'M', role: 'manager', skill: 7, potential: 8, fame: 0, traits: ['frugal'], morale: 60, salary: 1364 }, 30);
    expect(m.attrs).toEqual({ quality: 70, speed: 70, composure: 70, mentoring: 70 });
    expect(ovr(m)).toBe(70);
    expect(m.talent).toBe('frugal');
    expect(m.salary).toBe(1364);
  });

  test('saves round trip the squad', () => {
    let s = withStarterKit(newGame(5, 'canal', 'cosy'));
    s = run(s, 3);
    expect(deserialise(serialise(s, 0)).state.staff).toEqual(s.staff);
  });
});
