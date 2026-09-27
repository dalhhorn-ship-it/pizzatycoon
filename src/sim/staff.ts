// Staff as a squad (staff-management.md): attributes, OVR, pressure, mood, growth, training and the market.
// Pure functions; game.ts and team.ts apply them to state.

import { PERSONALITIES, PERSONALITY_IDS } from '../data/personalities';
import { ATTR_IDS, ATTR_SHORT, FIRST_NAMES, LAST_NAMES, ROLE_AREA, ROLE_BASE_SALARY, ROLE_WEIGHTS, TALENTS } from '../data/staff';
import { COURSES, type Course } from '../data/training';
import type { AttrId, PersonalityId, Role, Service, TalentId } from '../data/types';
import { T } from '../data/tunables';
import { Rng } from './rng';
import type { Attrs, GameState, MoodDriver, Staff } from './state';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const clampAttr = (v: number): number => clamp(Math.round(v), 1, 99);

// ---------- Card ----------

export function ovrFor(role: Role, attrs: Attrs): number {
  const w = ROLE_WEIGHTS[role];
  return Math.round(ATTR_IDS.reduce((x, a) => x + w[a] * attrs[a], 0));
}

export const ovr = (s: Pick<Staff, 'role' | 'attrs'>): number => ovrFor(s.role, s.attrs);

export type Tier = 'bronze' | 'silver' | 'gold' | 'elite';
export const TIER_NAMES: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', elite: 'Elite' };

export function tierOf(o: number): Tier {
  if (o >= T.staff.tierElite) return 'elite';
  if (o >= T.staff.tierGold) return 'gold';
  if (o >= T.staff.tierSilver) return 'silver';
  return 'bronze';
}

export const hasTalent = (s: Pick<Staff, 'talent'>, t: TalentId): boolean => s.talent === t;
export const hasPersonality = (s: Pick<Staff, 'personality'>, p: PersonalityId): boolean => s.personality.includes(p);

/** The attribute with the highest weight for this role (the agency's "key attribute"). */
export function keyAttr(role: Role): AttrId {
  const w = ROLE_WEIGHTS[role];
  return [...ATTR_IDS].sort((a, b) => w[b] - w[a])[0] as AttrId;
}

/** Form from consecutive days in the high or low morale band (staff-management.md 5.3). */
export function formOf(s: Pick<Staff, 'formDays'>): -1 | 0 | 1 {
  if (s.formDays >= T.staff.formDays) return 1;
  if (s.formDays <= -T.staff.formDays) return -1;
  return 0;
}

/** Attribute the sim uses today: form and Big Game Player included. */
export function effAttr(s: Staff, a: AttrId, service: Service = 'dinner', day = 1): number {
  let v = s.attrs[a] + formOf(s) * T.staff.formBonus;
  const weekday = (day - 1) % 7;
  if (a === 'composure' && hasTalent(s, 'bigGame') && service === 'dinner' && (weekday === 4 || weekday === 5)) v += T.staff.bigGameComposure;
  return clamp(v, 1, 99);
}

// ---------- Money ----------

export function salaryFor(role: Role, o: number, fame: number): number {
  return Math.round(ROLE_BASE_SALARY[role] * (1 + T.staff.salaryPerOvr * (o - 50)) * (1 + T.staff.salaryPerFame * fame) * 100) / 100;
}

/** What this person could earn elsewhere (staff-management.md 4.4). */
export function marketValue(s: Staff): number {
  const m = T.market;
  const o = ovr(s);
  const young = Math.min(m.youngPremiumCap, m.youngPremium * Math.max(0, s.potential - o));
  // An apprentice is paid as a learner until their first review or until they reach Silver.
  if (s.apprentice) return Math.round(ROLE_BASE_SALARY[s.role] * m.apprenticeSalary * 100) / 100;
  const base = salaryFor(s.role, o, s.fame) * (1 + young) * (hasPersonality(s, 'moneyMinded') ? m.moneyMindedValue : 1);
  return Math.round(base * 100) / 100;
}

// ---------- Pressure (2.3) ----------

/** Speed multiplier under pressure; quality gets half of the effect. */
export function pressureMult(composure: number, rho: number): number {
  const t = T.staff;
  const excess = clamp(rho - t.pressureOnset, 0, t.pressureExcessCap);
  if (composure < 50) return 1 - t.pressurePenalty * excess * (50 - composure) / 50;
  return 1 + t.pressureBonus * excess * (composure - 50) / 50;
}

/** Quality under pressure: a nervous person loses half their speed loss in quality; calm keeps standards but does not raise them. */
export const pressureQuality = (p: number): number => 1 + Math.min(0, p - 1) / 2;
export const moraleQuality = (morale: number): number => 0.95 + (0.1 * morale) / 100;

// ---------- Building staff ----------

export interface StaffSeed {
  id: number;
  name: string;
  role: Role;
  attrs: Attrs;
  potential: number;
  fame?: number;
  talent?: TalentId | null;
  personality?: PersonalityId[];
  day?: number;
  salary?: number;
  morale?: number;
}

export function makeStaff(x: StaffSeed): Staff {
  const day = x.day ?? 1;
  const s: Staff = {
    id: x.id, name: x.name, role: x.role, attrs: { ...x.attrs }, potential: x.potential, fame: x.fame ?? 0,
    talent: x.talent ?? null, personality: x.personality ?? ['easyGoing'], morale: x.morale ?? T.staff.moraleStart,
    salary: 0, shiftsWorked: 0, lowMoraleDays: 0, leavingOnDay: null, hiredDay: day, growthXp: 0, coachXp: {},
    lastDevelopedDay: null, coaching: null, course: null, offUntil: null, lastCourseDay: null, certs: [],
    nextReviewDay: day + 7 * T.market.reviewWeeks, review: null, offer: null, formDays: 0, moodTarget: x.morale ?? T.staff.moraleStart,
    moodDrivers: [], contrib: [], promotedDay: null,
  };
  s.salary = x.salary ?? salaryFor(s.role, ovr(s), s.fame);
  return s;
}

/**
 * A staff member as the old single skill model described them (save migration, reference builds):
 * Quality and Speed 10 x skill, Composure and Mentoring 50 (neutral), managers all four at 10 x skill.
 */
export function staffFromSkill(id: number, name: string, role: Role, skill: number, opts: { potential?: number; fame?: number; talent?: TalentId | null; personality?: PersonalityId[]; mentor?: boolean; salary?: number; morale?: number; day?: number } = {}): Staff {
  const v = clampAttr(skill * 10);
  const neutral = role === 'manager' ? v : 50;
  const attrs: Attrs = { quality: v, speed: v, composure: neutral, mentoring: opts.mentor ? 70 : neutral };
  return makeStaff({
    id, name, role, attrs, potential: clamp(Math.round((opts.potential ?? skill) * 10), 30, 95), fame: opts.fame ?? 0,
    talent: opts.talent ?? null, personality: opts.personality ?? ['easyGoing'], morale: opts.morale, day: opts.day,
    // The old salary formula at this skill (identical to OVR = 10 x skill).
    salary: opts.salary ?? salaryFor(role, skill * 10, opts.fame ?? 0),
  });
}

/** Same role, all attributes 50, morale 65, no talent or personality, paid the role base (7.1). */
export function standardReplacement(s: Staff): Staff {
  const r = makeStaff({ id: s.id, name: 'Standard replacement', role: s.role, attrs: { quality: 50, speed: 50, composure: 50, mentoring: 50 }, potential: 50, morale: 65, personality: [] });
  r.salary = ROLE_BASE_SALARY[s.role];
  return r;
}

const TRAIT_TO_TALENT: Record<string, TalentId> = {
  speedy: 'speedy', perfectionist: 'perfectionist', charmer: 'charmer', nightOwl: 'nightOwl', frugal: 'frugal', crowdPleaser: 'crowdPleaser',
};

/** Save migration (staff-management.md 10): a v5 staff member with skill, potential and traits. */
export function migrateStaff(old: Record<string, unknown>, day: number): Staff {
  const traits = (old.traits as string[] | undefined) ?? [];
  const talent = traits.map((t) => TRAIT_TO_TALENT[t]).find((t): t is TalentId => !!t) ?? null;
  const s = staffFromSkill(old.id as number, old.name as string, old.role as Role, (old.skill as number) ?? 5, {
    potential: (old.potential as number) ?? (old.skill as number) ?? 5, fame: (old.fame as number) ?? 0, talent,
    personality: traits.includes('steady') ? ['steady'] : ['easyGoing'], mentor: traits.includes('mentor'),
    salary: old.salary as number, morale: old.morale as number, day,
  });
  s.shiftsWorked = (old.shiftsWorked as number) ?? 0;
  s.lowMoraleDays = (old.lowMoraleDays as number) ?? 0;
  s.leavingOnDay = (old.leavingOnDay as number | null) ?? null;
  s.hiredDay = day - T.market.potKnownDays;
  s.nextReviewDay = day + 7 * T.market.reviewWeeks;
  return s;
}

// ---------- Who is working ----------

export const isOff = (s: Staff, day: number): boolean => (s.course !== null && day < s.course.endsDay) || (s.offUntil !== null && day < s.offUntil);

/** Staff on today's rota: not on a course or days off. */
export function onRota(staff: readonly Staff[], day: number): Staff[] {
  return staff.filter((s) => !isOff(s, day));
}

// ---------- Training (3) ----------

export function courseProblem(state: Pick<GameState, 'day' | 'cash'>, s: Staff, course: Course, unlocked: boolean): string | null {
  if (!course.roles.includes(s.role)) return `${course.name} is not for a ${s.role}.`;
  if (!unlocked) return 'Locked.';
  if (s.course && state.day < s.course.endsDay) return `${s.name} is already on a course.`;
  if (s.lastCourseDay !== null && state.day - s.lastCourseDay < T.training.cooldownDays) {
    return `One course per ${T.training.cooldownDays} days: ${s.name} can go again on day ${s.lastCourseDay + T.training.cooldownDays}.`;
  }
  return null;
}

export function learnMult(s: Staff): number {
  const t = T.training;
  const headroom = clamp((s.potential - ovr(s)) / t.headroomSpan, t.headroomMin, 1);
  return headroom * (hasTalent(s, 'eagerLearner') ? t.eagerLearner : 1) * (s.morale < t.lowMorale ? t.lowMoraleLearn : 1);
}

/** Points a course will add, rounded half up (staff-management.md 3.3). */
export function courseGains(s: Staff, courseId: string): Partial<Attrs> {
  const c = COURSES[courseId];
  if (!c) return {};
  const m = learnMult(s);
  const out: Partial<Attrs> = {};
  for (const a of ATTR_IDS) {
    const g = c.gains[a];
    if (g) out[a] = Math.min(99 - s.attrs[a], Math.floor(g * m + 0.5));
  }
  return out;
}

/** Coaching points per week a coach gives (3.2). */
export function coachRate(coach: Staff, trainee: Staff): number {
  const t = T.training;
  return (Math.max(0, coach.attrs.mentoring - t.coachBase) / t.coachDivisor) * (hasTalent(trainee, 'eagerLearner') ? t.eagerLearner : 1);
}

export function coachProblem(coach: Staff, trainee: Staff): string | null {
  if (coach.id === trainee.id) return 'Nobody can coach themselves.';
  if (coach.attrs.mentoring < T.training.coachMinMen) return `${coach.name} needs Mentoring ${T.training.coachMinMen} or more to coach.`;
  if (ROLE_AREA[coach.role] !== ROLE_AREA[trainee.role] && coach.role !== 'manager') return 'A coach works with people in the same area.';
  return null;
}

/** The attribute natural growth goes to: highest role weight still below POT, ties by lowest value. */
export function growthAttr(s: Staff): AttrId | null {
  const w = ROLE_WEIGHTS[s.role];
  const open = ATTR_IDS.filter((a) => s.attrs[a] < s.potential && w[a] > 0);
  open.sort((a, b) => w[b] - w[a] || s.attrs[a] - s.attrs[b]);
  return open[0] ?? null;
}

// ---------- Mood (5) ----------

/** What the restaurant was like today, as staff feel it. */
export interface DaySignals {
  open: boolean;
  /** Highest load ratio of the day: how busy the restaurant was (Thrill Seeker, Calm Soul). */
  rho: number;
  /** Highest load per area: the pressure each person felt (staff-management.md 2.3). */
  load: { kitchen: number; floor: number; back: number };
  /** Ticket minutes over the free allowance (dinner). */
  ticketOver: number;
  food: number;
  repDelta7: number;
  oneStarReviews: number;
  understaffed: boolean;
  basicShare: number;
  teamMorale: number;
  /** Departures in the last 7 days. */
  left: number;
  letGo: number;
  /** Hotheads below 40 by area. */
  hotheadsDown: Record<string, number>;
  /** Manager calm multiplier on the pressure driver. */
  calm: number;
  day: number;
}

export function moodOf(s: Staff, sig: DaySignals): { target: number; drivers: MoodDriver[] } {
  const m = T.mood;
  const drivers: MoodDriver[] = [];
  const add = (label: string, value: number): void => {
    if (Math.abs(value) >= 0.05) drivers.push({ label, value });
  };
  const p = (id: PersonalityId): boolean => hasPersonality(s, id);
  const name = (id: PersonalityId): string => PERSONALITIES[id].name;

  const payRatio = s.salary / Math.max(1, marketValue(s));
  const pay = clamp((payRatio - 1) * m.payWeight, m.payMin, m.payMax) * (p('moneyMinded') ? 2 : 1);
  add(pay >= 0 ? `paid at or above market${p('moneyMinded') ? ` (${name('moneyMinded')})` : ''}` : `paid below market${p('moneyMinded') ? ` (${name('moneyMinded')})` : ''}`, pay);
  if (sig.understaffed) add('short staffed', m.understaffed);
  if (sig.open) {
    const cmp = s.attrs.composure;
    const area = ROLE_AREA[s.role];
    const load = area === 'kitchen' ? sig.load.kitchen : area === 'back' ? sig.load.back : area === 'floor' ? sig.load.floor : sig.rho;
    let pressure = Math.max(m.pressureCap, -m.pressureSlope * Math.max(0, Math.min(load, 1 + T.staff.pressureExcessCap) - m.pressureFrom) * (1 - cmp / 100)) * sig.calm;
    if (p('calmSoul')) pressure *= 2;
    add(`busy service${p('calmSoul') ? ` (${name('calmSoul')})` : ''}`, pressure);
  }
  const developed = s.lastDevelopedDay !== null && sig.day - s.lastDevelopedDay <= m.developmentDays;
  if (developed) add(p('ambitious') ? `still learning (${name('ambitious')})` : 'still learning', p('ambitious') ? m.ambitiousGrowth : m.development);
  if (sig.letGo > 0) add(`a teammate was let go${p('teamPlayer') ? ` (${name('teamPlayer')})` : ''}`, p('teamPlayer') ? m.teamLetGo : m.teamLeft);
  else if (sig.left > 0) add('a teammate left', m.teamLeft);
  const hotheads = sig.hotheadsDown[ROLE_AREA[s.role]] ?? 0;
  if (hotheads > 0 && !(p('hothead') && s.morale < m.hotheadBelow && hotheads === 1)) add('an unhappy hothead nearby', m.hotheadSpread);

  if (sig.open && p('thrillSeeker')) {
    if (sig.rho >= m.busy) add(`a packed room (${name('thrillSeeker')})`, m.thrillBusy);
    else if (sig.rho < m.quiet) add(`a quiet room (${name('thrillSeeker')})`, m.thrillQuiet);
  }
  if (sig.open && p('calmSoul') && sig.rho >= m.steadyLo && sig.rho <= m.steadyHi) add(`a steady day (${name('calmSoul')})`, m.calmSteady);
  if (sig.open && p('craftsperson')) {
    if (sig.food >= m.craftGood) add(`great food (${name('craftsperson')})`, m.craftHappy);
    else if (sig.food <= m.craftBad) add(`poor food (${name('craftsperson')})`, m.craftUnhappy);
    if (sig.basicShare > 0.5) add(`basic ingredients (${name('craftsperson')})`, m.craftBasic);
  }
  if (sig.open && p('racer')) {
    if (sig.ticketOver <= 0) add(`fast tickets (${name('racer')})`, m.racerFast);
    else if (sig.ticketOver >= m.racerSlack) add(`slow tickets (${name('racer')})`, m.racerSlow);
  }
  if (p('gloryHunter')) {
    if (sig.repDelta7 > 0.05) add(`reputation rising (${name('gloryHunter')})`, m.gloryUp);
    else if (sig.repDelta7 < -0.05) add(`reputation falling (${name('gloryHunter')})`, m.gloryDown);
    if (sig.oneStarReviews > 0) add(`1 star reviews (${name('gloryHunter')})`, m.gloryBadReview * sig.oneStarReviews);
  }
  if (p('ambitious')) {
    if (!developed && sig.day - s.hiredDay > m.developmentDays) add(`nothing new to learn (${name('ambitious')})`, m.ambitiousStuck);
    if (ovr(s) >= m.ambitiousPromoteOvr && sig.day - (s.promotedDay ?? s.hiredDay) > 7 * m.ambitiousPromoteWeeks) add(`wants a promotion (${name('ambitious')})`, m.ambitiousStuck);
  }
  if (p('teamPlayer') && sig.teamMorale >= m.teamHappyMorale) add(`a happy team (${name('teamPlayer')})`, m.teamHappy);

  let scale = 1;
  if (p('easyGoing')) scale *= m.easyGoingScale;
  if (p('hothead')) scale *= m.hotheadScale;
  for (const d of drivers) {
    d.value *= scale;
    if (p('loyal') && d.value < 0) d.value *= 0.5;
  }
  const base = p('easyGoing') ? m.easyGoingBase : m.base;
  const target = clamp(base + drivers.reduce((x, d) => x + d.value, 0), m.min, m.max);
  drivers.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { target, drivers };
}

/** One day of morale movement toward the target. */
export function stepMorale(morale: number, target: number, steady: boolean): number {
  const next = morale + Math.sign(target - morale) * Math.min(T.mood.maxStep, Math.abs(target - morale));
  return clamp(steady ? Math.max(T.staff.steadyFloor, next) : next, 0, 100);
}

export function moodText(s: Staff): string {
  const parts = s.moodDrivers.slice(0, 3).map((d) => `${d.label} ${d.value >= 0 ? '+' : ''}${Math.round(d.value)}`);
  return `Heading to ${Math.round(s.moodTarget)}${parts.length ? `: ${parts.join(', ')}` : ''}`;
}

// ---------- Market (4) ----------

export function interestProblem(c: Staff, bestRep: number): string | null {
  const t = tierOf(ovr(c));
  if (t === 'elite' && bestRep < T.market.eliteRep) return 'Not interested yet: wants a 3 star restaurant';
  if (t === 'gold' && bestRep < T.market.goldRep) return 'Not interested yet: wants a 2.5 star restaurant';
  return null;
}

const TIER_RANGE: Record<Tier, [number, number]> = { bronze: [28, 49], silver: [50, 64], gold: [65, 79], elite: [80, 92] };

export function tierMix(bestRep: number): readonly number[] {
  let mix = T.market.tierMix[0]?.mix ?? [1, 0, 0, 0];
  for (const row of T.market.tierMix) if (bestRep >= row.rep) mix = row.mix;
  return mix;
}

function pickWeighted<X>(rng: Rng, items: readonly X[], weights: readonly number[]): X {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return items[i] as X;
  }
  return items[items.length - 1] as X;
}

export function pickPersonality(rng: Rng): PersonalityId {
  return pickWeighted(rng, PERSONALITY_IDS, PERSONALITY_IDS.map((id) => PERSONALITIES[id].weight));
}

/** Attributes spread around a target OVR for this role, then nudged so the OVR lands on it. */
function attrsFor(rng: Rng, role: Role, target: number, keyMin?: number): Attrs {
  const attrs = {} as Attrs;
  for (const a of ATTR_IDS) attrs[a] = clampAttr(target + 14 * rng.normal());
  if (role === 'manager') attrs.mentoring = clampAttr(Math.max(attrs.mentoring, target));
  for (let i = 0; i < 6; i++) {
    const diff = target - ovrFor(role, attrs);
    if (diff === 0) break;
    for (const a of ATTR_IDS) attrs[a] = clampAttr(attrs[a] + diff);
  }
  // Land exactly on the target: nudge the heaviest attribute one point at a time.
  const heavy = keyAttr(role);
  for (let i = 0; i < 40 && ovrFor(role, attrs) !== target; i++) attrs[heavy] = clampAttr(attrs[heavy] + Math.sign(target - ovrFor(role, attrs)));
  if (keyMin !== undefined) {
    const k = keyAttr(role);
    attrs[k] = Math.max(attrs[k], clampAttr(keyMin + rng.int(0, 8)));
  }
  return attrs;
}

export interface CandidateOpts {
  tier?: Tier;
  ovr?: number;
  apprentice?: boolean;
  keyMin?: number;
  fame?: number;
}

export function makeCandidate(rng: Rng, id: number, role: Role, day: number, bestRep: number, o: CandidateOpts = {}): Staff {
  const m = T.market;
  let target: number;
  let potential: number;
  if (o.apprentice) {
    target = rng.int(m.apprenticeOvr[0], m.apprenticeOvr[1]);
    potential = rng.int(m.apprenticePot[0], m.apprenticePot[1]);
  } else {
    const tier = o.tier ?? pickWeighted(rng, ['bronze', 'silver', 'gold', 'elite'] as Tier[], tierMix(bestRep));
    const [lo, hi] = TIER_RANGE[tier];
    target = o.ovr ?? rng.int(lo, hi);
    potential = clamp(target + rng.int(0, 20), 30, 95);
  }
  const attrs = attrsFor(rng, role, target, o.keyMin);
  const talentIds = Object.keys(TALENTS) as TalentId[];
  const talent = rng.chance(0.6) ? rng.pick(talentIds) : null;
  const personality: PersonalityId[] = [pickPersonality(rng)];
  if (target >= T.staff.tierGold && rng.chance(0.3)) {
    const second = pickPersonality(rng);
    if (second !== personality[0]) personality.push(second);
  }
  const c = makeStaff({ id, name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, role, attrs, potential: Math.max(potential, ovrFor(role, attrs)), fame: o.fame ?? 0, talent, personality, day });
  c.apprentice = o.apprentice || undefined;
  const width = tierOf(ovr(c)) === 'gold' || tierOf(ovr(c)) === 'elite' ? m.scoutWidthGold : m.scoutWidth;
  c.scout = {} as Attrs;
  for (const a of ATTR_IDS) c.scout[a] = -rng.int(0, 2 * width);
  c.scouted = false;
  c.salary = marketValue(c);
  return c;
}

/** Attribute range shown before an interview: always contains the true value (4.2). */
export function scoutRange(c: Staff, a: AttrId): [number, number] {
  if (c.scouted || !c.scout) return [c.attrs[a], c.attrs[a]];
  const width = tierOf(ovr(c)) === 'gold' || tierOf(ovr(c)) === 'elite' ? T.market.scoutWidthGold : T.market.scoutWidth;
  const lo = clamp(c.attrs[a] + c.scout[a], 1, 99);
  return [lo, clamp(lo + 2 * width, 1, 99)];
}

/** POT shown as a range until they have been on the team for a while (4.3). */
export function potRange(s: Staff, day: number): [number, number] {
  if (s.scout === undefined && day - s.hiredDay >= T.market.potKnownDays) return [s.potential, s.potential];
  const lo = Math.max(30, s.potential - 6 + (s.id % 7));
  return [Math.min(lo, s.potential), Math.max(s.potential, Math.min(95, lo + 10))];
}

/** The best restaurant manager on a team, if any. */
export function managerOf(staff: readonly Staff[]): Staff | undefined {
  return staff.filter((s) => s.role === 'manager').sort((a, b) => ovr(b) - ovr(a))[0];
}

/** A manager's people skill: (Mentoring + Composure) / 2 (staff-management.md 8.2). */
export const peopleSkill = (m: Staff): number => (m.attrs.mentoring + m.attrs.composure) / 2;

export const attrLabel = (a: AttrId): string => ATTR_SHORT[a];
