// The squad day by day (staff-management.md 3, 5, 6, 7, 8): growth, coaching, courses, mood, form, notice,
// reviews, rival offers, contributions against a standard replacement, the weekly market and the manager.

import { isMain } from '../data/recipes';
import { ATTR_IDS, ATTR_SHORT, RIVALS, ROLE_AREA, ROLE_BASE_SALARY, ROLE_NAMES, ROLE_WEIGHTS } from '../data/staff';
import { COURSES, COURSE_IDS } from '../data/training';
import type { AttrId, Role, Service, Unlock } from '../data/types';
import { T } from '../data/tunables';
import { EQUIPMENT } from '../data/equipment';
import { type Analysis, type AreaLoad, analyse, personalPressure, stationsOf } from './analysis';
import { buyPrice } from './economy';
import { bestSpot, kitchenDims, layoutProblem } from './kitchen';
import { type DayOptions, simulateDay } from './day';
import { deliveryUnlocked } from './delivery';
import { Rng } from './rng';
import {
  coachRate, courseGains, courseProblem, type DaySignals, effAttr, formOf, growthAttr, hasPersonality, interestProblem, isOff,
  makeCandidate, managerOf, marketValue, moodOf, onRota, ovr, peopleSkill, standardReplacement, stepMorale,
} from './staff';
import type { DayReport, GameState, ManagerLog, Staff, StaffPolicy, TeamLine } from './state';

/** Events the team produces; game.ts turns them into GameEvents. */
export interface TeamEvent {
  kind: 'info' | 'staffNotice' | 'staffLeft' | 'staffReview' | 'staffOffer';
  text: string;
}

export const DEFAULT_POLICY: StaffPolicy = { budget: 250, pay: 'fair', focus: 'strategy', replace: false, kitchenBudget: 500 };
export const policyOf = (s: Pick<GameState, 'staffPolicy'>): StaffPolicy => ({ ...DEFAULT_POLICY, ...(s.staffPolicy ?? {}) });

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const weekOf = (day: number): number => Math.floor((day - 1) / 7);

// ---------- A day with pressure (staff-management.md 2.3) ----------

/** Pressure only matters when someone on the rota is not at neutral composure. */
export function needsPressure(state: GameState): boolean {
  return onRota(state.staff, state.day).some((s) => s.role !== 'manager' &&
    (effAttr(s, 'composure', 'lunch', state.day) !== 50 || effAttr(s, 'composure', 'dinner', state.day) !== 50));
}

/** Load per area from a day's stages (see AreaLoad). */
export function areaLoad(r: DayReport, sv: Service): AreaLoad {
  const x = r.services.find((y) => y.service === sv);
  if (!x) return { kitchen: 0, floor: 0, back: 0 };
  const st = x.stages;
  const seated = Math.min(x.demandPerHour, st.seats);
  const kitchen = Math.min(st.prep, st.oven);
  return {
    kitchen: kitchen > 0 ? seated / kitchen : 0,
    floor: st.seats > 0 ? x.demandPerHour / st.seats : 0,
    back: st.plates > 0 ? Math.min(seated, kitchen) / st.plates : 0,
  };
}

/**
 * The day model with composure: a first pass at neutral composure measures each service's load ratio (rho),
 * then the day runs with that pressure. rho is read before any composure effect, so there is no feedback loop.
 */
export function dayRun(state: GameState, opts: DayOptions): { a: Analysis; report: DayReport } {
  const a0 = analyse(state, undefined, { menuOnly: true });
  const r0 = simulateDay(state, a0, opts);
  if (!r0.open || !needsPressure(state)) return { a: a0, report: r0 };
  const a = analyse(state, { lunch: areaLoad(r0, 'lunch'), dinner: areaLoad(r0, 'dinner') }, { menuOnly: true });
  return { a, report: simulateDay(state, a, opts) };
}

// ---------- Contribution (7.1) ----------

export interface Contribution {
  id: number;
  value: number;
  reason: string;
}

/**
 * Profit today with each person against the same day with a standard replacement in their place, plus the reputation
 * their work earns: reputation settles at reviewBase + reviewSlope x satisfaction, so a satisfaction difference is worth
 * reviewSlope x (what one reputation point adds to a day's profit here).
 */
export function contributions(state: GameState, a: Analysis, report: DayReport, opts: DayOptions, ids?: readonly number[], managed = false): Contribution[] {
  if (!report.open) return [];
  // A manager at the restaurant the player runs only works when the team is handed over.
  const managing = !!managerRunsTeam(state, managed);
  // Counterfactual days reuse the day's measured load (a.pressure): one pass each instead of dayRun's two. Swapping one
  // person barely moves the load ratio, and composure still applies through analyse (sprint 2, TD2).
  const rerun = (alt: GameState): DayReport => simulateDay(alt, analyse(alt, a.pressure, { menuOnly: true }), opts);
  const repPoint = Math.max(0, rerun({ ...state, rep: Math.min(100, state.rep + 1) }).pnl.profit - report.pnl.profit);
  const out: Contribution[] = [];
  for (const s of state.staff) {
    if (ids && !ids.includes(s.id)) continue;
    if (isOff(s, state.day)) {
      out.push({ id: s.id, value: 0, reason: s.course ? 'On a course' : 'Day off' });
      continue;
    }
    const alt: GameState = { ...state, staff: state.staff.map((x) => (x.id === s.id ? standardReplacement(s) : x)) };
    const r = rerun(alt);
    const earned = (report.satisfaction - r.satisfaction) * T.reputation.reviewSlope * repPoint;
    const value = report.pnl.profit - r.pnl.profit + earned;
    out.push({ id: s.id, value, reason: reasonFor(s, value, report, r, a, state.day, managing, earned) });
  }
  return out;
}

function reasonFor(s: Staff, value: number, actual: DayReport, alt: DayReport, a: Analysis, day: number, managing: boolean, earned = 0): string {
  const up = value >= 0;
  if (s.role === 'manager' && !managing) return 'Nothing to run while you are here: a cost until you open another restaurant';
  const dinner = personalPressure(s, { service: 'dinner', load: a.pressure.dinner, day });
  const lunch = personalPressure(s, { service: 'lunch', load: a.pressure.lunch, day });
  const worst = Math.abs(dinner - 1) >= Math.abs(lunch - 1) ? { p: dinner, sv: 'dinner' } : { p: lunch, sv: 'lunch' };
  if (s.role !== 'manager' && Math.abs(worst.p - 1) >= 0.03 && (worst.p > 1) === up) {
    return up ? `Stayed calm in the ${worst.sv} rush` : `Struggled under pressure at ${worst.sv} (CMP ${s.attrs.composure})`;
  }
  if (!up && s.morale <= 35) return `Unhappy and slow (morale ${Math.round(s.morale)})`;
  if (up && formOf(s) === 1) return 'In form';
  const dCovers = actual.covers - alt.covers;
  const dWalk = alt.walkAways - actual.walkAways;
  if (Math.abs(dCovers) >= 1 && (dCovers > 0) === up) {
    return up ? `Kept the line moving: ${Math.round(dCovers)} more guests served` : `Slow on the line: ${Math.round(-dCovers)} fewer guests served`;
  }
  if (Math.abs(dWalk) >= 1 && (dWalk > 0) === up) return up ? `Fewer guests walked away (${Math.round(dWalk)})` : `${Math.round(-dWalk)} guests walked away`;
  const dSat = actual.satisfaction - alt.satisfaction;
  // Most of the value is the reputation their work earns: name the food or the service.
  const reputationLed = Math.abs(earned) >= 0.5 * Math.abs(value) && (earned > 0) === up;
  if ((Math.abs(dSat) >= 0.3 || reputationLed) && (dSat > 0) === up) {
    const kitchen = s.role === 'chef' || s.role === 'cook';
    return up ? (kitchen ? 'Better food lifted satisfaction' : 'Better service lifted satisfaction') : (kitchen ? 'The food score slipped' : 'The service score slipped');
  }
  if (up) return 'Great value for the wage';
  return s.salary > ROLE_BASE_SALARY[s.role] ? 'Paid more than they bring' : 'A little behind a typical hire';
}

// ---------- Signals ----------

function basicShare(state: GameState): number {
  const lines = state.recipes.filter((r) => r.onMenu && isMain(r.kind)).flatMap((r) => r.lines);
  return lines.length ? lines.filter((l) => l.tier === 'basic').length / lines.length : 0;
}

export function signalsOf(state: GameState, report: DayReport, a: Analysis, calm: number): DaySignals {
  const covers = report.segments.reduce((x, s) => x + s.served, 0);
  const food = covers > 0 ? report.segments.reduce((x, s) => x + s.scores.food * s.served, 0) / covers : 0.6;
  const weekAgo = state.history.at(-6)?.repBefore ?? report.repBefore;
  const recent = (state.departures ?? []).filter((d) => state.day - d.day < T.mood.teamDays);
  const hotheadsDown: Record<string, number> = {};
  for (const s of state.staff) {
    if (hasPersonality(s, 'hothead') && s.morale < T.mood.hotheadBelow) hotheadsDown[ROLE_AREA[s.role]] = (hotheadsDown[ROLE_AREA[s.role]] ?? 0) + 1;
  }
  return {
    open: report.open,
    rho: report.open ? Math.min(2, Math.max(...report.services.map((x) => x.rho))) : 0,
    load: report.open ? {
      kitchen: Math.max(...report.services.map((x) => areaLoad(report, x.service).kitchen)),
      floor: Math.max(...report.services.map((x) => areaLoad(report, x.service).floor)),
      back: Math.max(...report.services.map((x) => areaLoad(report, x.service).back)),
    } : { kitchen: 0, floor: 0, back: 0 },
    ticketOver: report.open ? Math.max(...report.services.map((x) => (x.ticketTime ?? 0) - T.satisfaction.ticketFree)) : 0,
    food,
    repDelta7: report.repAfter - weekAgo,
    oneStarReviews: report.reviews.filter((r) => r.stars === 1).length,
    understaffed: a.service.loadMult < 1,
    basicShare: basicShare(state),
    teamMorale: mean(state.staff.map((s) => s.morale)),
    left: recent.filter((d) => !d.letGo).length,
    letGo: recent.filter((d) => d.letGo).length,
    hotheadsDown,
    calm,
    day: state.day,
  };
}

// ---------- Growth helpers ----------

function addPoint(s: Staff, attr: AttrId, day: number): boolean {
  if (s.attrs[attr] >= 99) return false;
  s.attrs[attr] += 1;
  s.lastDevelopedDay = day;
  return true;
}

/** Best Mentoring in the same area lifts natural growth (3.1). */
function areaBonus(team: readonly Staff[], s: Staff): number {
  const best = Math.max(...team.filter((x) => ROLE_AREA[x.role] === ROLE_AREA[s.role]).map((x) => x.attrs.mentoring));
  return Math.max(0.5, 1 + (best - 50) / 100);
}

function lowestOpenAttr(s: Staff): AttrId | null {
  const w = ROLE_WEIGHTS[s.role];
  const open = ATTR_IDS.filter((a) => s.attrs[a] < s.potential && w[a] > 0).sort((a, b) => s.attrs[a] - s.attrs[b]);
  return open[0] ?? null;
}

export function recordDeparture(state: GameState, letGo: boolean): void {
  state.departures = [...(state.departures ?? []).filter((d) => state.day - d.day < T.mood.teamDays), { day: state.day, letGo }];
}

/** Does the manager make the staff decisions here (staff-management.md 1.1)? */
export function managerRunsTeam(state: GameState, managed: boolean): Staff | undefined {
  const m = managerOf(state.staff);
  if (!m) return undefined;
  return managed || state.delegateStaff ? m : undefined;
}

// ---------- The day ----------

export interface TeamDayResult {
  events: TeamEvent[];
  team: TeamLine[];
  mood: string[];
}

/**
 * Everything that happens to the team after a day: growth, coaching, courses, mood, form, notice, reviews and offers.
 * `state` is the restaurant (the player's, or a managed one merged with shared fields). Mutates it.
 */
export function teamDay(state: GameState, report: DayReport, a: Analysis, opts: DayOptions & { managed: boolean; contrib: boolean; bestRep: number }): TeamDayResult {
  const events: TeamEvent[] = [];
  const day = state.day;
  const manager = managerRunsTeam(state, opts.managed);
  const log = manager ? (state.managerLog ??= freshLog(state)) : undefined;
  const calm = manager && manager.attrs.composure > 50 ? 1 - (manager.attrs.composure - 50) / 100 : 1;
  const sig = signalsOf(state, report, a, calm);
  const before = new Map(state.staff.map((s) => [s.id, { ovr: ovr(s), morale: s.morale, target: s.moodTarget }]));

  // Contributions first: they describe the day that just ran, with the team as it was.
  const values = opts.contrib ? contributions(state, a, report, opts, undefined, opts.managed) : [];

  const rng = Rng.stream(state.seed + state.locationId * 31, day, 'team');
  for (const s of state.staff) {
    // Courses finish at the end of their last day off.
    if (s.course && day + 1 >= s.course.endsDay) {
      const c = COURSES[s.course.id];
      const o0 = ovr(s);
      const gained: string[] = [];
      for (const k of ATTR_IDS) {
        const g = s.course.gains[k] ?? 0;
        if (g > 0) {
          s.attrs[k] = Math.min(99, s.attrs[k] + g);
          gained.push(`+${g} ${ATTR_SHORT[k]}`);
        }
      }
      if (gained.length) s.lastDevelopedDay = day;
      if (c?.cert && !s.certs.includes(c.cert)) s.certs.push(c.cert);
      s.course = null;
      if (ovr(s) - o0 >= T.training.reviewLift) s.nextReviewDay = Math.min(s.nextReviewDay, day + 1);
      events.push({ kind: 'info', text: `${s.name} finished ${c?.name ?? 'a course'}: ${gained.join(', ') || 'no change'}.` });
    }
    if (s.offUntil !== null && day + 1 >= s.offUntil) s.offUntil = null;

    // Natural growth on the job.
    if (report.open && !isOff(s, day)) {
      s.shiftsWorked += 1;
      s.growthXp += areaBonus(state.staff, s) / T.staff.shiftsPerPoint;
      while (s.growthXp >= 1 - 1e-9) {
        const attr = growthAttr(s);
        if (!attr) {
          s.growthXp = 0;
          break;
        }
        const o0 = ovr(s);
        addPoint(s, attr, day);
        s.growthXp -= 1;
        if (Math.floor(ovr(s) / 5) > Math.floor(o0 / 5) && ovr(s) % 5 === 0) events.push({ kind: 'info', text: `${s.name} has grown into a ${ovr(s)} rated ${ROLE_NAMES[s.role].toLowerCase()}.` });
      }
    }
  }

  // Coaching pairs (3.2), then the manager's own coaching at half rate (8.2).
  for (const coach of state.staff) {
    if (!coach.coaching) continue;
    const trainee = state.staff.find((x) => x.id === coach.coaching?.traineeId);
    const attr = coach.coaching.attr;
    if (!trainee || trainee.attrs[attr] >= Math.min(99, trainee.potential)) {
      events.push({ kind: 'info', text: trainee ? `${coach.name} has taken ${trainee.name} as far as they can in ${ATTR_SHORT[attr]}.` : `${coach.name} stopped coaching.` });
      coach.coaching = null;
      continue;
    }
    trainee.coachXp[attr] = (trainee.coachXp[attr] ?? 0) + coachRate(coach, trainee) / 7;
    while ((trainee.coachXp[attr] ?? 0) >= 1 - 1e-9) {
      addPoint(trainee, attr, day);
      trainee.coachXp[attr] = (trainee.coachXp[attr] ?? 0) - 1;
    }
  }
  if (manager) {
    const rate = Math.max(0, manager.attrs.mentoring - T.training.coachBase) / T.delegation.coachDivisor / 7;
    for (const s of state.staff) {
      if (s.id === manager.id) continue;
      const attr = lowestOpenAttr(s);
      if (!attr) continue;
      s.coachXp[attr] = (s.coachXp[attr] ?? 0) + rate;
      while ((s.coachXp[attr] ?? 0) >= 1 - 1e-9) {
        addPoint(s, attr, day);
        s.coachXp[attr] = (s.coachXp[attr] ?? 0) - 1;
      }
    }
  }

  // Mood, form, notice (5).
  const leaving: Staff[] = [];
  for (const s of state.staff) {
    const { target, drivers } = moodOf(s, sig);
    s.moodTarget = target;
    s.moodDrivers = drivers;
    s.morale = stepMorale(s.morale, target, hasPersonality(s, 'steady'));
    if (s.morale >= T.staff.formHigh) s.formDays = Math.max(0, s.formDays) + 1;
    else if (s.morale < T.staff.formLow) s.formDays = Math.min(0, s.formDays) - 1;
    else s.formDays = 0;
    if (s.morale < T.staff.noticeMorale) s.lowMoraleDays += 1;
    else s.lowMoraleDays = 0;
    if (s.leavingOnDay === null && s.lowMoraleDays >= T.staff.noticeDays) {
      s.leavingOnDay = day + T.staff.noticeDays;
      events.push({ kind: 'staffNotice', text: `${s.name} has handed in notice. A raise, a course or a few days off could change their mind.` });
    }
    if (s.leavingOnDay !== null && day >= s.leavingOnDay) leaving.push(s);
    if (s.offer && day >= s.offer.leavesOnDay) leaving.push(s);
  }

  // Contract reviews (3.4).
  for (const s of state.staff) {
    if (s.review && day >= s.review.untilDay) {
      s.review = null;
      s.nextReviewDay = day + 7 * T.market.reviewWeeks;
      events.push({ kind: 'info', text: `${s.name}'s pay review passed without a raise.` });
    }
    if (!s.review && day + 1 >= s.nextReviewDay) {
      if (s.apprentice) delete s.apprentice;
      const ask = marketValue(s);
      if (s.salary >= ask - 0.5) s.nextReviewDay = day + 7 * T.market.reviewWeeks;
      else {
        s.review = { ask, untilDay: day + T.market.reviewDecideDays };
        events.push({ kind: 'staffReview', text: `${s.name} asks for a raise to $${Math.round(ask)} a week at their pay review.` });
      }
    }
  }

  // Rival offers once a week (6.2).
  if (report.weekday === 6 && !state.staff.some((s) => s.offer)) {
    const m = T.market;
    for (const s of state.staff) {
      if (ovr(s) < m.poachOvr || hasPersonality(s, 'loyal') || s.leavingOnDay !== null) continue;
      const mv = marketValue(s);
      if (s.salary > mv * m.poachUnderpaid) continue;
      if (!rng.chance(m.poachChance)) continue;
      const rival = rng.pick(RIVALS);
      s.offer = { rival, salary: Math.round(mv * 100) / 100, leavesOnDay: day + m.poachDays };
      events.push({ kind: 'staffOffer', text: `${rival} wants ${s.name}: match $${Math.round(mv)} a week or they leave on day ${day + m.poachDays}.` });
      break;
    }
  }

  // The manager decides (8).
  if (manager && log) managerDaily(state, manager, log, rng, events, opts.bestRep);

  for (const s of leaving) {
    if (!state.staff.includes(s)) continue;
    state.staff = state.staff.filter((x) => x.id !== s.id);
    for (const c of state.staff) if (c.coaching?.traineeId === s.id) c.coaching = null;
    recordDeparture(state, false);
    events.push({ kind: 'staffLeft', text: s.offer ? `${s.name} has left for ${s.offer.rival}.` : `${s.name} has left.` });
    if (manager && log && s.id !== manager.id) managerHire(state, manager, log, rng, s.role, events, opts.bestRep);
  }

  // Contributions on each card; the report lines (7.2).
  for (const c of values) {
    const s = state.staff.find((x) => x.id === c.id);
    if (s && !isOff(s, day)) s.contrib = [...s.contrib, Math.round(c.value * 100) / 100].slice(-14);
  }
  const team: TeamLine[] = values.map((c) => {
    const s = state.staff.find((x) => x.id === c.id);
    const b = before.get(c.id);
    return {
      id: c.id, name: s?.name ?? '', role: s?.role ?? 'cook', ovr: s ? ovr(s) : (b?.ovr ?? 0), ovrBefore: b?.ovr ?? 0,
      morale: s?.morale ?? b?.morale ?? 0, moraleBefore: b?.morale ?? 0, form: s ? formOf(s) : 0, value: c.value, reason: c.reason,
    };
  });
  const moodLines = state.staff
    .map((s) => ({ s, shift: s.moodTarget - (before.get(s.id)?.target ?? s.moodTarget), top: s.moodDrivers[0] }))
    .filter((x) => Math.abs(x.shift) >= 5 && x.top && Math.abs(x.top.value) >= 5 && Math.sign(x.top.value) === Math.sign(x.shift))
    .sort((x, y) => Math.abs(y.shift) - Math.abs(x.shift))
    .slice(0, 2)
    .map((x) => `${x.s.name} ${x.shift > 0 ? 'is in good spirits' : 'is unhappy'}: ${x.top?.label} ${x.top && x.top.value > 0 ? '+' : ''}${Math.round(x.top?.value ?? 0)}`);
  return { events, team, mood: moodLines };
}

// ---------- Manager (8) ----------

function freshLog(state: GameState): ManagerLog {
  return { trained: 0, hired: 0, letGo: 0, raises: 0, spent: 0, moraleStart: mean(state.staff.map((s) => s.morale)) };
}

/** Pick the best of the top 3 with the manager's accuracy, otherwise one of the other two (8.2). */
export function pickWithAccuracy<X>(sorted: readonly X[], people: number, rng: Rng): X | undefined {
  const top = sorted.slice(0, 3);
  if (top.length <= 1) return top[0];
  const p = T.delegation.accuracyBase + T.delegation.accuracyPerPeople * people;
  if (rng.chance(p)) return top[0];
  return top[1 + Math.floor(rng.next() * (top.length - 1))];
}

type Strategy = 'luxury' | 'volume' | 'middle';
export function strategyOf(state: GameState): Strategy {
  const families = state.equipment.map((e) => EQUIPMENT[e.itemId]).filter((e) => e?.role === 'oven').map((e) => e?.family);
  if (families.includes('volume')) return 'volume';
  if (families.includes('artisan')) return 'luxury';
  return 'middle';
}

function hireScore(state: GameState, c: Staff, focus: StaffPolicy['focus']): number {
  if (focus === 'value') return ovr(c) / Math.max(1, c.salary);
  if (focus === 'youth') return (c.apprentice ? 100 : 0) + c.potential;
  const st = strategyOf(state);
  if (st === 'luxury') return c.attrs.quality;
  if (st === 'volume') return (c.attrs.speed + c.attrs.composure) / 2;
  return ovr(c);
}

function managerHire(state: GameState, m: Staff, log: ManagerLog, rng: Rng, role: Role, events: TeamEvent[], bestRep: number): void {
  const pool = state.candidates.filter((c) => c.role === role && !interestProblem(c, bestRep));
  const focus = policyOf(state).focus;
  const pick = pickWithAccuracy([...pool].sort((a, b) => hireScore(state, b, focus) - hireScore(state, a, focus)), peopleSkill(m), rng);
  if (!pick) return;
  state.candidates = state.candidates.filter((c) => c.id !== pick.id);
  state.staff.push(hiredFromMarket(pick, state.day));
  log.hired += 1;
  events.push({ kind: 'info', text: `${m.name} hired ${pick.name} (${ROLE_NAMES[role].toLowerCase()}, ${ovr(pick)}).` });
}

/** A candidate as they join the team. */
export function hiredFromMarket(c: Staff, day: number, salary?: number): Staff {
  const s = structuredClone(c);
  delete s.scout;
  delete s.scouted;
  s.hiredDay = day;
  s.nextReviewDay = day + 7 * T.market.reviewWeeks;
  if (salary !== undefined) s.salary = salary;
  return s;
}

export function isUnlockedFor(state: GameState, unlock: Unlock, bestRep: number): boolean {
  if (state.unlockAll) return true;
  switch (unlock.kind) {
    case 'start': return true;
    case 'served': return state.totalServed >= unlock.guests;
    case 'rep': return bestRep >= unlock.rep;
    case 'day': return state.day >= unlock.day;
    case 'rank': return ['cook', 'owner', 'restaurateur', 'chainFounder'].indexOf(state.rank) >= ['cook', 'owner', 'restaurateur', 'chainFounder'].indexOf(unlock.rank);
  }
}

/** Book a course: pay, go off the rota, gains land when it ends. Returns an error or null. */
export function bookCourse(state: GameState, s: Staff, courseId: string, bestRep: number): string | null {
  const c = COURSES[courseId];
  if (!c) return 'Unknown course.';
  const problem = courseProblem(state, s, c, isUnlockedFor(state, c.unlock, bestRep));
  if (problem) return problem === 'Locked.' ? `Locked: ${unlockLabel(c.unlock)}.` : problem;
  if (state.cash < c.price) return `You need $${Math.ceil(c.price - state.cash)} more.`;
  state.cash -= c.price;
  s.course = { id: c.id, endsDay: state.day + c.daysOff, gains: courseGains(s, c.id) };
  s.lastCourseDay = state.day;
  if (s.leavingOnDay !== null && hasPersonality(s, 'ambitious')) {
    s.leavingOnDay = null;
    s.lowMoraleDays = 0;
  }
  return null;
}

export function unlockLabel(u: Unlock): string {
  switch (u.kind) {
    case 'start': return 'Available';
    case 'served': return `Serve ${u.guests} guests`;
    case 'rep': return `Reputation ${u.rep}`;
    case 'day': return `Day ${u.day}`;
    case 'rank': return `Rank ${u.rank === 'owner' ? 'Owner' : u.rank}`;
  }
}

/** Course options for a person, best value first: gain x role weight per dollar. */
export function courseOptions(state: GameState, s: Staff, bestRep: number): { courseId: string; score: number; price: number }[] {
  const w = ROLE_WEIGHTS[s.role];
  return COURSE_IDS.map((id) => COURSES[id]).filter((c): c is NonNullable<typeof c> => !!c)
    .filter((c) => !courseProblem(state, s, c, isUnlockedFor(state, c.unlock, bestRep)))
    .map((c) => {
      const g = courseGains(s, c.id);
      const value = ATTR_IDS.reduce((x, k) => x + (g[k] ?? 0) * w[k], 0);
      return { courseId: c.id, score: value / c.price, price: c.price };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);
}

function managerDaily(state: GameState, m: Staff, log: ManagerLog, rng: Rng, events: TeamEvent[], bestRep: number): void {
  const policy = policyOf(state);
  const payMult = T.delegation.pay[policy.pay];
  for (const s of state.staff) {
    // Reviews: pay per policy.
    if (s.review) {
      const offer = Math.max(s.salary, Math.round(s.review.ask * payMult * 100) / 100);
      if (offer > s.salary) {
        s.salary = offer;
        s.morale = Math.min(100, s.morale + (hasPersonality(s, 'moneyMinded') ? T.mood.moneyMindedRaise : T.staff.raiseMorale));
        log.raises += 1;
      }
      s.review = null;
      s.nextReviewDay = state.day + 7 * T.market.reviewWeeks;
    }
    // Rival offers: match when the person earns their keep.
    if (s.offer) {
      const recent = s.contrib.slice(-4);
      if (!recent.length || mean(recent) >= 0) {
        s.salary = s.offer.salary;
        s.morale = Math.min(100, s.morale + T.staff.raiseMorale);
        events.push({ kind: 'info', text: `${m.name} matched ${s.offer.rival}'s offer for ${s.name}.` });
        s.offer = null;
        log.raises += 1;
      }
    }
    // A notice: a raise if pay is the problem, otherwise days off.
    if (s.leavingOnDay !== null && s.id !== m.id) {
      if (s.salary < marketValue(s)) {
        s.salary = Math.max(s.salary, marketValue(s));
        s.morale = Math.min(100, s.morale + T.staff.raiseMorale);
        log.raises += 1;
      } else {
        s.offUntil = state.day + 1 + T.staff.daysOff;
        s.morale = Math.min(100, s.morale + T.staff.daysOffMorale);
      }
      s.leavingOnDay = null;
      s.lowMoraleDays = 0;
    }
  }
  if ((state.day - 1) % 7 !== 6) return;

  // Sunday: training within the weekly budget.
  let budget = Math.min(policy.budget, Math.max(0, state.cash));
  for (let i = 0; i < 6 && budget > 0; i++) {
    const options = state.staff
      .flatMap((s) => courseOptions(state, s, bestRep).filter((o) => o.price <= budget).map((o) => ({ ...o, s })))
      .sort((a, b) => b.score - a.score);
    const pick = pickWithAccuracy(options, peopleSkill(m), rng);
    if (!pick) break;
    if (bookCourse(state, pick.s, pick.courseId, bestRep)) break;
    budget -= pick.price;
    log.trained += 1;
    log.spent += pick.price;
  }

  managerKitchen(state, m, log, rng, events, bestRep);

  // Replace underperformers (8.1).
  if (policy.replace) {
    for (const s of [...state.staff]) {
      if (s.id === m.id) continue;
      const recent = s.contrib.slice(-2);
      if (recent.length < 2 || Math.max(...recent) > T.delegation.replaceBelow) continue;
      state.cash -= s.apprentice ? 0 : s.salary * T.staff.severanceWeeks;
      state.staff = state.staff.filter((x) => x.id !== s.id);
      recordDeparture(state, true);
      log.letGo += 1;
      events.push({ kind: 'info', text: `${m.name} let ${s.name} go.` });
      managerHire(state, m, log, rng, s.role, events, bestRep);
    }
  }
}

/** What the manager would buy next for the kitchen, if anything (kitchen-bottlenecks.md 5). */
export function kitchenNeed(state: GameState, bestRep: number): { itemId?: string; hire?: Role; why: string } | null {
  const st = stationsOf(state);
  const unlocked = (id: string): boolean => !!EQUIPMENT[id] && isUnlockedFor(state, EQUIPMENT[id].unlock, bestRep);
  const last = state.history.at(-1);
  const pizzas = last?.open ? Object.entries(last.dishSales).filter(([id]) => state.recipes.find((r) => r.id === id)?.kind === 'pizza').reduce((x, [, n]) => x + n, 0) : 0;
  if (st.tendRatio < 1) return { hire: 'cook', why: `the ovens run at ${Math.round(st.tendRatio * 100)}% for want of a cook` };
  if (st.coldCap > 0 && pizzas > 0.9 * st.coldCap) return { itemId: unlocked('reachInFridge') ? 'reachInFridge' : 'doughFridge', why: 'the fridges are nearly out of dough by closing' };
  if (last?.services.some((s) => s.bottleneck === 'plates')) return { itemId: st.idleWashers > 0 && unlocked('doubleSink') ? 'doubleSink' : 'plateShelving', why: 'clean plates ran out' };
  if (st.idleWashers > 0 && unlocked('doubleSink')) return { itemId: 'doubleSink', why: 'a dishwasher has no room at the sink' };
  if (st.washStrain > 0) return { itemId: 'handWash', why: 'cooks queue at the sink' };
  return null;
}

/** Sunday: the manager fixes the worst station issue within the kitchen budget, one step a week. */
function managerKitchen(state: GameState, m: Staff, log: ManagerLog, rng: Rng, events: TeamEvent[], bestRep: number): void {
  const policy = policyOf(state);
  if (policy.kitchenBudget <= 0) return;
  const need = kitchenNeed(state, bestRep);
  if (!need) return;
  if (need.hire) {
    const before = state.staff.length;
    managerHire(state, m, log, rng, need.hire, events, bestRep);
    if (state.staff.length > before) (log.kitchen ??= []).push(`hired a cook because ${need.why}`);
    return;
  }
  const it = need.itemId ? EQUIPMENT[need.itemId] : undefined;
  if (!it) return;
  const cost = buyPrice(state, it.price);
  if (cost > policy.kitchenBudget || cost > state.cash) return;
  const dims = kitchenDims(state.premisesId);
  const uid = state.nextUid;
  const spot = bestSpot(state.equipment, uid, it.id, dims);
  if (!spot || layoutProblem([...state.equipment, spot], dims)) return;
  state.nextUid += 1;
  state.cash -= cost;
  state.equipment = [...state.equipment, { ...spot, paid: cost }];
  (log.kitchen ??= []).push(`bought a ${it.name} because ${need.why}`);
  log.kitchenSpent = (log.kitchenSpent ?? 0) + cost;
  events.push({ kind: 'info', text: `${m.name} bought a ${it.name} for $${Math.round(cost)}: ${need.why}.` });
}

/** The weekly manager line (8.3) and one proposal; resets the log. */
export function managerWeek(state: GameState): { line: string; proposal: string } | null {
  const m = managerOf(state.staff);
  const log = state.managerLog;
  if (!m || !log) return null;
  const morale = mean(state.staff.map((s) => s.morale));
  const policy = policyOf(state);
  const line = `${m.name} (Manager, OVR ${ovr(m)}): trained ${log.trained}, hired ${log.hired}, let go ${log.letGo}, raises ${log.raises}; ` +
    `team morale ${Math.round(morale)} (${morale - log.moraleStart >= 0 ? '+' : ''}${Math.round(morale - log.moraleStart)}); spent $${Math.round(log.spent)} of $${policy.budget}.` +
    (log.kitchen?.length ? ` Kitchen: ${log.kitchen.join('; ')}.` : '');
  const underpaid = state.staff.find((s) => s.salary < marketValue(s) * 0.9);
  const need = kitchenNeed(state, 0);
  const needItem = need?.itemId ? EQUIPMENT[need.itemId] : undefined;
  const proposal = need && needItem && buyPrice(state, needItem.price) > policy.kitchenBudget
    ? `The kitchen needs a ${needItem.name} ($${Math.round(buyPrice(state, needItem.price))}): ${need.why}. A bigger kitchen budget would let me buy it.`
    : policy.budget === 0
    ? 'A training budget would let me develop the team.'
    : log.spent >= policy.budget
      ? 'A bigger training budget would let me send more people on courses.'
      : underpaid ? `${underpaid.name} is paid well below market; a raise would keep them.` : 'The team is in good shape.';
  state.managerLog = freshLog(state);
  return { line, proposal };
}

// ---------- Market (4) ----------

const ROLE_DRAW: Role[] = ['cook', 'cook', 'cook', 'server', 'server', 'server', 'chef', 'host', 'dishwasher', 'manager'];
export const HIREABLE_ROLES: readonly Role[] = ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager'];

/** Adds a candidate for every role missing from the market. */
export function ensureEveryRole(state: GameState, bestRep: number): void {
  // A rider joins the market once any restaurant may deliver (competition.md 6.8).
  const riders = deliveryUnlocked(state) || (state.branches ?? []).some((b) => deliveryUnlocked(b));
  for (const role of riders ? [...HIREABLE_ROLES, 'rider' as Role] : HIREABLE_ROLES) {
    if (state.candidates.some((x) => x.role === role)) continue;
    const rng = Rng.stream(state.seed, state.day, `refill-${state.nextUid}`);
    state.candidates.push(makeCandidate(rng, state.nextUid++, role, state.day, bestRep, { tier: bestRep >= T.market.goldRep ? undefined : 'bronze' }));
  }
}

/** The day 1 market: 2 cooks, 2 servers and a dishwasher to start with (fresh-start.md 4), then the rest. */
export function firstMarket(state: GameState): void {
  const rng = Rng.stream(state.seed, state.day, 'market');
  const out: Staff[] = [];
  for (const role of ['cook', 'cook', 'server', 'server', 'dishwasher'] as Role[]) {
    out.push(makeCandidate(rng, state.nextUid++, role, state.day, state.rep, { ovr: rng.int(25, 44), tier: 'bronze' }));
  }
  while (out.length < T.market.pool - T.market.apprenticesPerWeek) out.push(makeCandidate(rng, state.nextUid++, rng.pick(ROLE_DRAW), state.day, state.rep));
  for (let i = 0; i < T.market.apprenticesPerWeek; i++) out.push(makeCandidate(rng, state.nextUid++, rng.pick(['cook', 'server', 'cook', 'chef'] as Role[]), state.day, state.rep, { apprentice: true }));
  state.candidates = out;
  ensureEveryRole(state, state.rep);
  trimPool(state);
}

/** Keep the pool at its size: the oldest go first, but never the last one of a role. */
function trimPool(state: GameState): void {
  while (state.candidates.length > T.market.pool) {
    const counts = new Map<Role, number>();
    for (const c of state.candidates) counts.set(c.role, (counts.get(c.role) ?? 0) + 1);
    const victim = [...state.candidates].sort((a, b) => a.hiredDay - b.hiredDay || b.id - a.id).find((c) => (counts.get(c.role) ?? 0) > 1);
    if (!victim) break;
    state.candidates = state.candidates.filter((c) => c !== victim);
  }
}

/** Sunday night: 8 new candidates and 2 apprentices arrive, anyone past 21 days leaves, the pool stays at 24 (4.1). */
export function refreshMarket(state: GameState, bestRep: number, day: number = state.day + 1): void {
  const m = T.market;
  const rng = Rng.stream(state.seed, day, 'market');
  const pool = state.candidates.filter((c) => day - c.hiredDay < m.stayDays);
  const fresh: Staff[] = [];
  let fameUsed = false;
  for (let i = 0; i < m.newPerWeek; i++) {
    const c = makeCandidate(rng, state.nextUid++, rng.pick(ROLE_DRAW), day, bestRep);
    if (!fameUsed && bestRep >= T.staff.fameCandidateRep && ovr(c) >= 70 && rng.chance(0.5)) {
      c.fame = 1;
      c.salary = marketValue(c);
      fameUsed = true;
    }
    fresh.push(c);
  }
  for (let i = 0; i < m.apprenticesPerWeek; i++) fresh.push(makeCandidate(rng, state.nextUid++, rng.pick(['cook', 'server', 'cook', 'chef'] as Role[]), day, bestRep, { apprentice: true }));
  state.candidates = [...pool, ...fresh];
  ensureEveryRole(state, bestRep);
  trimPool(state);
}

/** Agency orders that are ready arrive as three candidates (4.1). */
export function deliverAgency(state: GameState, bestRep: number): TeamEvent[] {
  const events: TeamEvent[] = [];
  const due = (state.agencyOrders ?? []).filter((o) => state.day + 1 >= o.readyDay);
  if (!due.length) return events;
  state.agencyOrders = (state.agencyOrders ?? []).filter((o) => !due.includes(o));
  for (const o of due) {
    const rng = Rng.stream(state.seed, state.day, `agency-${state.nextUid}`);
    for (let i = 0; i < 3; i++) {
      const c = makeCandidate(rng, state.nextUid++, o.role, state.day + 1, bestRep, { keyMin: o.min, tier: o.min >= 70 ? 'gold' : 'silver' });
      c.scouted = true;
      state.candidates.push(c);
    }
    events.push({ kind: 'info', text: `The agency found 3 ${ROLE_NAMES[o.role].toLowerCase()}s for you. They are on the market now.` });
  }
  return events;
}

export const weekNumber = weekOf;
