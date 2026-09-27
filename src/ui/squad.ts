// The Squad (staff-management.md 9): lineup by area, player cards, market, training, coaching and manager policies.

import { PERSONALITIES } from '../data/personalities';
import { AREA_NAMES, ATTR_IDS, ATTR_NAMES, ATTR_SHORT, type Area, ROLE_AREA, ROLE_NAMES, TALENTS } from '../data/staff';
import { COURSE_IDS, COURSES } from '../data/training';
import type { AttrId, Role } from '../data/types';
import { T } from '../data/tunables';
import { bestRep, locationName, managerEffect } from '../sim/chain';
import type { Command } from '../sim/game';
import {
  coachProblem, coachRate, courseGains, courseProblem, formOf, interestProblem, isOff, managerOf, marketValue, moodText, ovr, ovrFor,
  potRange, scoutRange, type Tier, TIER_NAMES, tierOf,
} from '../sim/staff';
import type { GameState, Location, Staff, StaffPolicy } from '../sim/state';
import { courseOptions, HIREABLE_ROLES, isUnlockedFor, policyOf, unlockLabel, weekNumber } from '../sim/team';
import { h, modal, money, signed, toast } from './dom';
import { compare } from './impact';
import type { PanelCtx } from './panels';

// ---------- UI state (per session) ----------

const ui = {
  locationId: null as number | null,
  role: 'all' as Role | 'all' | 'apprentice',
  sort: 'ovr' as 'ovr' | 'price' | 'pot',
  tier: 'all' as Tier | 'all',
  agencyRole: 'cook' as Role,
};

const act = (ctx: PanelCtx, cmd: Command, ok?: string): boolean => {
  const err = ctx.dispatch(cmd);
  if (err) toast(err, 'warn');
  else if (ok) toast(ok, 'good');
  return !err;
};

const AREAS: Area[] = ['kitchen', 'floor', 'back', 'office'];
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The restaurant the Squad screen shows: the one the player runs, or a managed one. */
interface Where {
  staff: Staff[];
  name: string;
  locationId?: number;
  managed: boolean;
  /** The restaurant as a state, for previews. */
  view: GameState;
}

function where(state: GameState): Where {
  const b = ui.locationId !== null ? state.branches.find((x) => x.id === ui.locationId) : undefined;
  if (!b) {
    ui.locationId = null;
    return { staff: state.staff, name: locationName(state), managed: false, view: state };
  }
  return { staff: b.staff, name: locationName(b), locationId: b.id, managed: true, view: { ...state, ...(b as Location), locationId: b.id } };
}

// ---------- Small pieces ----------

export function moraleFace(m: number): string {
  if (m >= 70) return '😊';
  if (m >= 45) return '🙂';
  if (m >= 30) return '😐';
  return '☹️';
}

export function formArrow(s: Staff): HTMLElement {
  const f = formOf(s);
  return h('span', { class: `form f${f}`, title: f > 0 ? 'In form' : f < 0 ? 'Out of form' : 'Steady form', 'aria-label': f > 0 ? 'In form' : f < 0 ? 'Out of form' : 'Steady form' }, f > 0 ? '▲' : f < 0 ? '▼' : '▶');
}

function attrBar(label: string, value: number | [number, number]): HTMLElement {
  const [lo, hi] = typeof value === 'number' ? [value, value] : value;
  const v = (lo + hi) / 2;
  const cls = v >= 85 ? 'gold' : v >= 70 ? 'good' : v >= 50 ? 'ok' : 'low';
  return h('div', { class: 'abar', role: 'img', 'aria-label': `${label} ${lo === hi ? lo : `${lo} to ${hi}`}` },
    h('span', { class: 'al' }, label),
    h('span', { class: 'at' }, h('span', { class: `af ${cls}`, style: `width:${v}%` })),
    h('b', null, lo === hi ? String(lo) : `${lo} to ${hi}`));
}

function statusLine(s: Staff, day: number): HTMLElement | null {
  const parts: string[] = [];
  if (s.course && day < s.course.endsDay) parts.push(`📘 On ${COURSES[s.course.id]?.name ?? 'a course'} until day ${s.course.endsDay}`);
  if (s.offUntil !== null && day < s.offUntil) parts.push(`🏖 Days off until day ${s.offUntil}`);
  if (s.coaching) parts.push(`📣 Coaching ${ATTR_SHORT[s.coaching.attr]}`);
  if (s.leavingOnDay !== null) parts.push(`⚠ Leaving on day ${s.leavingOnDay}`);
  if (s.offer) parts.push(`⚠ ${s.offer.rival} wants them`);
  if (s.review) parts.push(`💬 Pay review: asks ${money(s.review.ask)}`);
  return parts.length ? h('div', { class: `small ${s.leavingOnDay !== null || s.offer ? 'warn' : 'muted'}` }, parts.join(' · ')) : null;
}

/** A player card on the lineup (F-127). */
function miniCard(s: Staff, day: number, onOpen: () => void): HTMLElement {
  const o = ovr(s);
  const tier = tierOf(o);
  return h('button', { class: `pcard ${tier}`, onclick: onOpen, 'aria-label': `${s.name}, ${ROLE_NAMES[s.role]}, overall ${o}, ${TIER_NAMES[tier]}` },
    h('div', { class: 'pc-top' },
      h('span', { class: 'ovr' }, String(o)),
      h('span', { class: 'pc-role' }, ROLE_NAMES[s.role], s.fame ? h('span', { class: 'fame', title: 'Famous' }, ` ${'★'.repeat(s.fame)}`) : null),
      h('span', { class: 'pc-mood' }, moraleFace(s.morale), ' ', formArrow(s))),
    h('div', { class: 'pc-name' }, s.name, isOff(s, day) ? h('span', { class: 'muted small' }, ' (away)') : null),
    h('div', { class: 'pc-bars' }, ...ATTR_IDS.map((a) => attrBar(ATTR_SHORT[a], s.attrs[a]))),
    statusLine(s, day));
}

/** Team ratings strip (F-127): six numbers; the one matching yesterday's bottleneck glows. */
function ratingsStrip(w: Where, state: GameState): HTMLElement {
  const on = w.staff.filter((s) => !isOff(s, state.day));
  const kitchen = on.filter((s) => ROLE_AREA[s.role] === 'kitchen');
  const floor = on.filter((s) => ROLE_AREA[s.role] === 'floor');
  const avg = (xs: Staff[], a: AttrId): number => Math.round(mean(xs.map((s) => s.attrs[a])));
  const last = (w.managed ? state.branches.find((b) => b.id === w.locationId)?.history : state.history)?.at(-1);
  const bn = new Set(last?.services.map((x) => x.bottleneck) ?? []);
  const items: [string, number, boolean][] = [
    ['Kitchen Quality', avg(kitchen, 'quality'), false],
    ['Kitchen Speed', avg(kitchen, 'speed'), bn.has('oven') || bn.has('prep')],
    ['Floor Quality', avg(floor, 'quality'), false],
    ['Floor Speed', avg(floor, 'speed'), bn.has('seats')],
    ['Composure', avg(on.filter((s) => s.role !== 'manager'), 'composure'), false],
    ['Team Morale', Math.round(mean(w.staff.map((s) => s.morale))), false],
  ];
  return h('div', { class: 'ratings' }, ...items.map(([label, v, glow]) =>
    h('div', { class: `rating ${glow ? 'glow' : ''}`, title: glow ? 'Yesterday this was the limit' : '' }, h('b', null, v ? String(v) : '·'), h('span', null, label))));
}

// ---------- Diamond chart ----------

function diamond(s: Staff): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const size = 190;
  const c = size / 2;
  const r = 58;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'diamond');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ATTR_IDS.map((a) => `${ATTR_NAMES[a]} ${s.attrs[a]}`).join(', '));
  const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const pt = (i: number, v: number): string => `${c + dirs[i]![0] * r * v},${c + dirs[i]![1] * r * v}`;
  for (const f of [0.5, 1]) {
    const g = document.createElementNS(ns, 'polygon');
    g.setAttribute('points', dirs.map((_, i) => pt(i, f)).join(' '));
    g.setAttribute('class', 'grid');
    svg.append(g);
  }
  const poly = document.createElementNS(ns, 'polygon');
  poly.setAttribute('points', ATTR_IDS.map((a, i) => pt(i, s.attrs[a] / 99)).join(' '));
  poly.setAttribute('class', 'shape');
  svg.append(poly);
  ATTR_IDS.forEach((a, i) => {
    const t = document.createElementNS(ns, 'text');
    const [x, y] = pt(i, 1.22).split(',').map(Number);
    t.setAttribute('x', String(x));
    t.setAttribute('y', String((y ?? 0) + 4));
    t.setAttribute('text-anchor', 'middle');
    t.textContent = `${ATTR_SHORT[a]} ${s.attrs[a]}`;
    svg.append(t);
  });
  return svg;
}

function sparkline(values: number[]): HTMLElement {
  if (!values.length) return h('div', { class: 'small muted' }, 'No days on the rota yet.');
  const max = Math.max(1, ...values.map(Math.abs));
  return h('div', { class: 'bars spark', 'aria-label': `Last ${values.length} days: ${values.map((v) => Math.round(v)).join(', ')} dollars` },
    ...values.map((v) => h('div', { class: v < 0 ? 'neg' : '', title: money(v), style: `height:${(Math.abs(v) / max) * 100}%` })));
}

// ---------- Player card (sheet) ----------

export function openPlayerCard(ctx: PanelCtx, staffId: number, locationId?: number, section: 'main' | 'train' | 'coach' = 'main'): void {
  let close = (): void => {};
  const rerender = (next: 'main' | 'train' | 'coach' = section): void => {
    close();
    ctx.rerender();
    openPlayerCard(ctx, staffId, locationId, next);
  };
  const state = ctx.current();
  const w = locationId !== undefined ? whereOf(state, locationId) : where(state);
  const s = w.staff.find((x) => x.id === staffId);
  if (!s) return;
  const loc = w.locationId !== undefined ? { locationId: w.locationId } : {};
  const run = (cmd: Command, ok?: string, next?: 'main' | 'train' | 'coach'): void => {
    if (act(ctx, { ...cmd, ...loc } as Command, ok)) rerender(next);
  };
  const o = ovr(s);
  const [plo, phi] = potRange(s, state.day);
  const mv = marketValue(s);
  const by = managerOf(w.staff);
  const delegated = w.managed || (!!state.delegateStaff && !!by);

  const talent = s.talent ? TALENTS[s.talent] : null;
  const chips = h('div', { class: 'chips' },
    talent ? h('span', { class: 'chip talent', title: talent.effect }, `${talent.name}: ${talent.effect}`) : null,
    ...s.personality.map((p) => h('span', { class: 'chip persona', title: PERSONALITIES[p].effect }, `${PERSONALITIES[p].name}: ${PERSONALITIES[p].effect}`)));

  const mood = h('div', { class: 'card' }, h('h3', null, h('span', null, 'Mood'), h('span', { class: 'small' }, `${moraleFace(s.morale)} ${Math.round(s.morale)}`)),
    h('div', { class: 'small' }, moodText(s)),
    s.moodDrivers.length ? h('div', { class: 'kv' }, ...s.moodDrivers.flatMap((d) => [h('span', null, d.label), h('b', { class: d.value >= 0 ? 'good' : 'bad' }, signed(d.value))])) : null);

  const contract = h('div', { class: 'card' }, h('h3', null, 'Contract'),
    h('div', { class: 'kv' },
      h('span', null, 'Salary'), h('b', null, `${money(s.salary)}/week`),
      h('span', null, 'Market value'), h('b', { class: s.salary < mv * 0.9 ? 'warn' : '' }, `${money(mv)}/week`),
      h('span', null, 'Next pay review'), h('b', null, s.review ? 'now' : `day ${s.nextReviewDay}`)),
    s.review ? h('div', { class: 'row' },
      h('span', { class: 'small' }, `${s.name} asks ${money(s.review.ask)} a week.`),
      h('button', { class: 'small primary', onclick: () => run({ type: 'answerReview', staffId: s.id, accept: true }, 'Raise agreed') }, `Agree ${money(s.review.ask)}`),
      h('button', { class: 'small', onclick: () => run({ type: 'answerReview', staffId: s.id, accept: false }) }, 'Not now')) : null,
    s.offer ? h('div', { class: 'row' },
      h('span', { class: 'small warn' }, `${s.offer.rival} offers ${money(s.offer.salary)}; ${s.name} leaves on day ${s.offer.leavesOnDay}.`),
      h('button', { class: 'small primary', onclick: () => run({ type: 'answerOffer', staffId: s.id, match: true }, `${s.name} stays`) }, `Match ${money(s.offer.salary)}`),
      h('button', { class: 'small', onclick: () => run({ type: 'answerOffer', staffId: s.id, match: false }) }, 'Let them go')) : null);

  const promoteTo: Role | null = s.role === 'cook' ? 'chef' : s.role === 'chef' || s.role === 'server' ? 'manager' : null;
  const promoteOk = promoteTo === 'chef' ? o >= T.staff.promoteChefOvr : promoteTo === 'manager' ? s.attrs.mentoring >= T.staff.promoteManagerMen : false;
  const actions = h('div', { class: 'row' },
    h('button', { class: `small ${section === 'train' ? 'active' : ''}`, onclick: () => rerender('train') }, '📘 Train'),
    h('button', { class: `small ${section === 'coach' ? 'active' : ''}`, onclick: () => rerender('coach') }, s.coaching ? '📣 Coaching' : '📣 Coach'),
    h('button', { class: 'small', onclick: () => run({ type: 'giveRaise', staffId: s.id }, `${s.name} is delighted`) }, `Raise 10% (+${money(s.salary * 0.1)})`),
    promoteTo ? h('button', {
      class: 'small', disabled: !promoteOk,
      title: promoteOk ? '' : promoteTo === 'chef' ? `Needs OVR ${T.staff.promoteChefOvr}` : `Needs Mentoring ${T.staff.promoteManagerMen}`,
      onclick: () => run({ type: 'promote', staffId: s.id, role: promoteTo }),
    }, `Promote to ${promoteTo === 'chef' ? 'chef' : 'manager'} (OVR ${ovrFor(promoteTo, s.attrs)})`) : null,
    h('button', { class: 'small', disabled: isOff(s, state.day), onclick: () => run({ type: 'daysOff', staffId: s.id }) }, `${T.staff.daysOff} days off`),
    h('button', { class: 'small ghost', onclick: () => {
      const cost = s.apprentice ? 0 : s.salary * T.staff.severanceWeeks;
      if (confirm(`Let ${s.name} go${cost ? ` with two weeks' pay (${money(cost)})` : ''}?`)) {
        if (act(ctx, { type: 'fire', staffId: s.id, ...loc })) {
          close();
          ctx.rerender();
        }
      }
    } }, 'Let go'));

  let extra: HTMLElement | null = null;
  if (section === 'train') extra = trainingSheet(state, w, s, (courseId) => run({ type: 'train', staffId: s.id, courseId }, `${s.name} is booked`, 'main'));
  if (section === 'coach') extra = coachSheet(w, s, (traineeId, attr) => run({ type: 'coach', coachId: s.id, traineeId, attr }, 'Coaching started', 'main'), () => run({ type: 'stopCoaching', coachId: s.id }, undefined, 'main'));

  const content = h('div', { class: 'stack playercard' },
    h('div', { class: 'spread' },
      h('div', null, h('h2', null, s.name), h('div', { class: 'muted' }, `${ROLE_NAMES[s.role]} · ${w.name}${s.apprentice ? ' · apprentice' : ''}`)),
      h('div', { class: `pc-badge ${tierOf(o)}` }, h('b', null, String(o)), h('span', null, TIER_NAMES[tierOf(o)]))),
    delegated ? h('div', { class: 'small muted' }, `${by?.name ?? 'The manager'} runs this team. Anything you do here overrides them.`) : null,
    h('div', { class: 'pc-head' }, diamond(s),
      h('div', { class: 'stack' },
        h('div', { class: 'kv' },
          h('span', null, 'Potential'), h('b', null, plo === phi ? String(plo) : `${plo} to ${phi}`),
          h('span', null, 'Form'), h('b', null, formArrow(s), formOf(s) > 0 ? ' In form' : formOf(s) < 0 ? ' Out of form' : ' Steady'),
          h('span', null, 'On the team'), h('b', null, `${Math.max(0, state.day - s.hiredDay)} days`)),
        ...ATTR_IDS.map((a) => attrBar(ATTR_NAMES[a], s.attrs[a])))),
    chips,
    s.role === 'manager' ? managerNote(s) : null,
    statusLine(s, state.day),
    actions,
    extra,
    mood,
    contract,
    h('div', { class: 'card' }, h('h3', null, h('span', null, 'Form'), h('span', { class: 'small' }, `last ${s.contrib.length} days against a standard hire`)),
      sparkline(s.contrib),
      s.contrib.length ? h('div', { class: 'small muted' }, `Average ${signed(mean(s.contrib))} $/day.`) : null),
    h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'primary', onclick: () => close() }, 'Close')));
  close = modal(content, { onClose: () => undefined, wide: true });
}

function whereOf(state: GameState, locationId: number): Where {
  const prev = ui.locationId;
  ui.locationId = locationId === state.locationId ? null : locationId;
  const w = where(state);
  ui.locationId = prev;
  return w;
}

function managerNote(s: Staff): HTMLElement {
  const e = managerEffect(s);
  const pct = (x: number): string => `${x >= 1 ? '+' : '−'}${Math.abs(Math.round((x - 1) * 100))}%`;
  return h('div', { class: 'small muted' },
    `Runs a restaurant while you run another one. At OVR ${ovr(s)}: guests ${pct(e.demand)}, waste ${pct(e.waste)} compared with you. ` +
    `People skill ${Math.round((s.attrs.mentoring + s.attrs.composure) / 2)}: how well they train, pay and hire.`);
}

/** Courses with gain preview, days off with the rota cost, and payback (F-131, AC-211). */
function trainingSheet(state: GameState, w: Where, s: Staff, book: (courseId: string) => void): HTMLElement {
  const rep = bestRep(state);
  const view = w.view;
  let awayCost: number | null = null;
  const away = (): number => {
    if (awayCost === null) {
      const without = { ...view, staff: view.staff.filter((x) => x.id !== s.id) };
      awayCost = Math.max(0, -compare(view, without).profit);
    }
    return awayCost;
  };
  const rows = COURSE_IDS.map((id) => COURSES[id]).filter((c): c is NonNullable<typeof c> => !!c && c.roles.includes(s.role)).map((c) => {
    const unlocked = isUnlockedFor(state, c.unlock, rep);
    const problem = courseProblem(state, s, c, unlocked);
    const gains = courseGains(s, c.id);
    const after = structuredClone(s);
    for (const a of ATTR_IDS) after.attrs[a] += gains[a] ?? 0;
    const newOvr = ovr(after);
    let preview: HTMLElement | null = null;
    if (!problem) {
      const trained = { ...view, staff: view.staff.map((x) => (x.id === s.id ? after : x)) };
      const d = compare(view, trained).profit;
      const rota = c.daysOff * away();
      const payback = d > 0 ? (c.price + rota) / (7 * d) : Infinity;
      preview = h('div', { class: 'small muted' },
        `${c.daysOff ? `Away ${c.daysOff} day${c.daysOff > 1 ? 's' : ''}${rota >= 1 ? ` (about ${money(-rota)} while away)` : ', no cost to cover'}` : 'An evening course: no days off'} · ` +
        `${signed(d)} $/day after · ${payback <= 52 ? `pays back in about ${payback.toFixed(1)} weeks` : 'pays back over the long run, not straight away'} · ` +
        `will then ask about ${money(marketValue(after))}/week`);
    }
    return h('div', { class: 'line' },
      h('div', null,
        h('div', null, h('b', null, c.name), h('span', { class: 'small muted' }, ` · ${money(c.price)}`)),
        h('div', { class: 'small' }, `${ATTR_IDS.filter((a) => gains[a]).map((a) => `+${gains[a]} ${ATTR_SHORT[a]}`).join(', ') || 'no gain'} · OVR ${ovr(s)} → ${newOvr}`),
        h('div', { class: 'small muted' }, c.blurb),
        preview),
      h('button', {
        class: 'small primary', disabled: !!problem || state.cash < c.price,
        title: problem ?? (state.cash < c.price ? 'Not enough cash' : ''),
        onclick: () => book(c.id),
      }, problem ? (unlocked ? 'Not now' : unlockLabel(c.unlock)) : state.cash < c.price ? `Need ${money(c.price - state.cash)} more` : 'Book'));
  });
  return h('div', { class: 'card' }, h('h3', null, 'Training'),
    h('div', { class: 'small muted' }, `One course every ${T.training.cooldownDays} days. Gains shrink near potential; Eager Learners learn 25% faster; unhappy people learn less.`),
    ...rows);
}

/** Pick a trainee and an attribute (F-131, 3.2). */
function coachSheet(w: Where, coach: Staff, start: (traineeId: number, attr: AttrId) => void, stop: () => void): HTMLElement {
  if (coach.coaching) {
    const t = w.staff.find((x) => x.id === coach.coaching?.traineeId);
    return h('div', { class: 'card' }, h('h3', null, 'Coaching'),
      h('div', { class: 'small' }, `Coaching ${t?.name ?? 'someone'} in ${ATTR_NAMES[coach.coaching.attr]}: about +${t ? coachRate(coach, t).toFixed(1) : '?'} a week. ${coach.name} works 10% slower while teaching.`),
      h('button', { class: 'small', onclick: stop }, 'Stop coaching'));
  }
  const rows = w.staff.filter((t) => !coachProblem(coach, t) && !w.staff.some((x) => x.coaching?.traineeId === t.id)).map((t) =>
    h('div', { class: 'line' },
      h('div', null, h('b', null, t.name), h('span', { class: 'small muted' }, ` · ${ROLE_NAMES[t.role]} · OVR ${ovr(t)} · +${coachRate(coach, t).toFixed(1)} a week`)),
      h('div', { class: 'row' }, ...ATTR_IDS.filter((a) => t.attrs[a] < Math.min(99, t.potential)).map((a) =>
        h('button', { class: 'small', title: `${ATTR_NAMES[a]} ${t.attrs[a]}`, onclick: () => start(t.id, a) }, `${ATTR_SHORT[a]} ${t.attrs[a]}`)))));
  return h('div', { class: 'card' }, h('h3', null, 'Coach a teammate'),
    coach.attrs.mentoring < T.training.coachMinMen
      ? h('div', { class: 'small warn' }, `${coach.name} needs Mentoring ${T.training.coachMinMen} to coach (now ${coach.attrs.mentoring}). Train the Trainer helps.`)
      : rows.length ? h('div', { class: 'small muted' }, `Free, slow and steady: +(Mentoring − 30) / 20 a week in one attribute. ${coach.name} works 10% slower while teaching.`)
        : h('div', { class: 'small muted' }, 'Nobody in the same area to coach right now.'),
    ...(coach.attrs.mentoring >= T.training.coachMinMen ? rows : []));
}

// ---------- Market ----------

const compareCache = new WeakMap<GameState, Map<number, { profit: number; over: string | null; ovrDiff: number | null; wages: number }>>();

/** Against the weakest teammate in the role (F-129, 4.5). */
function compareLine(state: GameState, c: Staff): { profit: number; over: string | null; ovrDiff: number | null; wages: number } {
  let m = compareCache.get(state);
  if (!m) {
    m = new Map();
    compareCache.set(state, m);
  }
  const hit = m.get(c.id);
  if (hit) return hit;
  const same = state.staff.filter((x) => x.role === c.role).sort((a, b) => ovr(a) - ovr(b));
  const weakest = same[0];
  const hyp = { ...state, staff: weakest ? state.staff.map((x) => (x.id === weakest.id ? c : x)) : [...state.staff, c] };
  const d = c.role === 'manager' ? 0 : compare(state, hyp).profit;
  const out = { profit: d, over: weakest?.name ?? null, ovrDiff: weakest ? ovr(c) - ovr(weakest) : null, wages: c.salary - (weakest?.salary ?? 0) };
  m.set(c.id, out);
  return out;
}

function candidateCard(ctx: PanelCtx, state: GameState, c: Staff, showCompare: boolean): HTMLElement {
  const o = ovr(c);
  const [olo, ohi] = c.scouted ? [o, o] : (() => {
    const lows = {} as Record<AttrId, number>;
    const highs = {} as Record<AttrId, number>;
    for (const a of ATTR_IDS) [lows[a], highs[a]] = scoutRange(c, a);
    return [Math.max(1, ovrFor(c.role, lows)), Math.min(99, ovrFor(c.role, highs))];
  })();
  const tier = tierOf(o);
  const interest = interestProblem(c, bestRep(state));
  const week = weekNumber(state.day);
  const used = state.interviews?.week === week ? state.interviews.used : 0;
  const free = Math.max(0, T.market.freeInterviews - used);
  const [plo, phi] = potRange(c, state.day);
  const talent = c.talent ? TALENTS[c.talent] : null;
  const cmp = showCompare && !interest ? compareLine(state, c) : null;
  return h('div', { class: `card mcard ${tier}` },
    h('h3', null, h('span', null, c.name, c.fame ? ` ${'★'.repeat(c.fame)}` : ''), h('span', { class: 'small' }, `${ROLE_NAMES[c.role]}${c.apprentice ? ' · apprentice' : ''}`)),
    h('div', { class: 'spread' },
      h('div', { class: `pc-badge ${tier}` }, h('b', null, olo === ohi ? String(o) : `${olo} to ${ohi}`), h('span', null, TIER_NAMES[tier])),
      h('div', { class: 'small', style: 'text-align:right' }, `Asks ${money(c.salary)}/week`, h('br'), h('span', { class: 'muted' }, `POT ${plo} to ${phi}`))),
    h('div', { class: 'pc-bars' }, ...ATTR_IDS.map((a) => attrBar(ATTR_SHORT[a], scoutRange(c, a)))),
    h('div', { class: 'chips' },
      talent ? h('span', { class: 'chip talent', title: talent.effect }, talent.name) : null,
      ...(c.scouted ? c.personality.map((p) => h('span', { class: 'chip persona', title: PERSONALITIES[p].effect }, PERSONALITIES[p].name)) : [h('span', { class: 'chip' }, 'Personality ?')])),
    cmp ? h('div', { class: 'impact' },
      cmp.over ? `${signed(cmp.ovrDiff ?? 0)} OVR over ${cmp.over}, ` : 'A new position, ',
      h('b', { class: cmp.profit >= 0 ? 'good' : 'bad' }, `about ${signed(cmp.profit)} $/day`), `, ${signed(cmp.wages)} $/week in wages`) : null,
    interest ? h('div', { class: 'small warn' }, interest) : null,
    h('div', { class: 'row' },
      c.scouted ? null : h('button', { class: 'small', disabled: !free && state.cash < T.market.interviewPrice, onclick: () => act(ctx, { type: 'interview', candidateId: c.id }) },
        free ? `Interview (free, ${free} left)` : `Interview $${T.market.interviewPrice}`),
      h('button', { class: 'small primary', disabled: !!interest, onclick: () => act(ctx, { type: 'hire', candidateId: c.id }, `${c.name} joins the team`) }, `Hire at ${money(c.salary)}`),
      h('button', { class: 'small', disabled: !!interest, title: 'Offer 10% less: they may say no and take another job', onclick: () => act(ctx, { type: 'hire', candidateId: c.id, low: true }) }, `Offer ${money(c.salary * T.market.lowOffer)}`)));
}

function marketSection(ctx: PanelCtx, state: GameState): HTMLElement {
  const roles: (Role | 'all' | 'apprentice')[] = ['all', ...HIREABLE_ROLES, 'apprentice'];
  const pool = state.candidates
    .filter((c) => (ui.role === 'all' ? true : ui.role === 'apprentice' ? !!c.apprentice : c.role === ui.role))
    .filter((c) => ui.tier === 'all' || tierOf(ovr(c)) === ui.tier)
    .sort((a, b) => (ui.sort === 'price' ? a.salary - b.salary : ui.sort === 'pot' ? b.potential - a.potential : ovr(b) - ovr(a)));
  const showCompare = ui.role !== 'all';
  const seg = <X extends string>(items: [X, string][], cur: X, set: (x: X) => void): HTMLElement =>
    h('div', { class: 'seg wrap' }, ...items.map(([id, label]) => h('button', { class: cur === id ? 'on' : '', 'aria-pressed': cur === id ? 'true' : 'false', onclick: () => {
      set(id);
      ctx.rerender();
    } }, label)));
  const m = T.market;
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Staff market'), h('span', { class: 'small muted' }, `${state.candidates.length} people · new ones on Mondays`)),
    seg(roles.map((r) => [r, r === 'all' ? 'All' : r === 'apprentice' ? 'Apprentices' : ROLE_NAMES[r as Role].replace('Restaurant ', '')] as [typeof r, string]), ui.role, (x) => (ui.role = x)),
    h('div', { class: 'row' },
      seg([['ovr', 'Best'], ['price', 'Cheapest'], ['pot', 'Potential']], ui.sort, (x) => (ui.sort = x)),
      seg([['all', 'All tiers'], ['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['elite', 'Elite']] as [Tier | 'all', string][], ui.tier, (x) => (ui.tier = x))),
    showCompare ? null : h('div', { class: 'small muted' }, 'Pick a role to compare each candidate with the weakest person you have in that role.'),
    h('div', { class: 'card' }, h('h3', null, 'Recruitment agency'),
      h('div', { class: 'small muted' }, `Three candidates of one role, strong where it counts, in ${m.agencyDays} days.`),
      h('div', { class: 'row' },
        h('select', { 'aria-label': 'Role for the agency', onchange: (e: Event) => (ui.agencyRole = (e.target as HTMLSelectElement).value as Role) },
          ...HIREABLE_ROLES.map((r) => h('option', { value: r, selected: ui.agencyRole === r }, ROLE_NAMES[r]))),
        h('button', { class: 'small', disabled: state.cash < m.agencyPrice, onclick: () => act(ctx, { type: 'agency', role: ui.agencyRole }) }, `60+ for ${money(m.agencyPrice)}`),
        h('button', { class: 'small', disabled: state.cash < m.agencyPricePlus, onclick: () => act(ctx, { type: 'agency', role: ui.agencyRole, plus: true }) }, `70+ for ${money(m.agencyPricePlus)}`)),
      (state.agencyOrders ?? []).length ? h('div', { class: 'small' }, `On the way: ${(state.agencyOrders ?? []).map((o) => `${ROLE_NAMES[o.role]} (day ${o.readyDay})`).join(', ')}`) : null),
    ...(pool.length ? pool.map((c) => candidateCard(ctx, state, c, showCompare)) : [h('div', { class: 'small muted' }, 'Nobody like that on the market this week.')]));
}

// ---------- Manager policy (8.1) ----------

function policyCard(ctx: PanelCtx, state: GameState, w: Where): HTMLElement | null {
  const m = managerOf(w.staff);
  const holder = w.managed ? state.branches.find((b) => b.id === w.locationId) : state;
  if (!holder) return null;
  const policy = policyOf(holder as GameState);
  const loc = w.locationId !== undefined ? { locationId: w.locationId } : {};
  const set = (p: Partial<StaffPolicy>): void => {
    act(ctx, { type: 'setStaffPolicy', policy: p, ...loc });
  };
  const seg = <X extends string | number>(items: [X, string][], cur: X, pick: (x: X) => void): HTMLElement =>
    h('div', { class: 'seg wrap' }, ...items.map(([id, label]) => h('button', { class: cur === id ? 'on' : '', 'aria-pressed': cur === id ? 'true' : 'false', onclick: () => pick(id) }, label)));
  const delegated = w.managed || !!state.delegateStaff;
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Who runs the team'), h('span', { class: 'small' }, delegated && m ? `${m.name} (manager)` : 'You')),
    !w.managed ? h('label', { class: 'row small' },
      h('input', { type: 'checkbox', checked: !!state.delegateStaff, disabled: !m, onchange: (e: Event) => act(ctx, { type: 'setDelegateStaff', on: (e.target as HTMLInputElement).checked }) }),
      m ? `Let ${m.name} handle the team here` : 'Hire a restaurant manager to hand over the team') : null,
    w.managed && !m ? h('div', { class: 'small warn' }, 'No manager: nobody trains or replaces anyone here.') : null,
    delegated && m ? h('div', { class: 'stack' },
      h('div', { class: 'small muted' }, `People skill ${Math.round((m.attrs.mentoring + m.attrs.composure) / 2)}: picks the best option about ${Math.round((T.delegation.accuracyBase + T.delegation.accuracyPerPeople * (m.attrs.mentoring + m.attrs.composure) / 2) * 100)}% of the time, and coaches everyone a little.`),
      h('div', { class: 'small' }, 'Training budget a week'),
      seg(T.delegation.budgets.map((b) => [b, money(b)] as [number, string]), policy.budget, (b) => set({ budget: b })),
      h('div', { class: 'small' }, 'Kitchen budget a week (fixes station bottlenecks: a hand wash station, a bigger sink, a fridge, a cook for the ovens)'),
      seg(T.delegation.kitchenBudgets.map((b) => [b, money(b)] as [number, string]), policy.kitchenBudget, (b) => set({ kitchenBudget: b })),
      h('div', { class: 'small' }, 'Pay'),
      seg([['tight', 'Tight (90%)'], ['fair', 'Fair'], ['generous', 'Generous (110%)']] as [StaffPolicy['pay'], string][], policy.pay, (p) => set({ pay: p })),
      h('div', { class: 'small' }, 'Hiring focus'),
      seg([['strategy', 'Match the strategy'], ['value', 'Best value'], ['youth', 'Grow apprentices']] as [StaffPolicy['focus'], string][], policy.focus, (f) => set({ focus: f })),
      h('label', { class: 'row small' },
        h('input', { type: 'checkbox', checked: policy.replace, onchange: (e: Event) => set({ replace: (e.target as HTMLInputElement).checked }) }),
        `Replace anyone at ${money(T.delegation.replaceBelow)}/day or worse for two weeks`)) : null);
}

// ---------- The Squad tab ----------

export function squadPanel(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const w = where(state);
  const weekly = w.staff.reduce((x, s) => x + s.salary, 0);
  const open = (s: Staff): void => openPlayerCard(ctx, s.id, w.locationId);
  const places = state.branches.length
    ? h('div', { class: 'seg wrap' },
      h('button', { class: w.managed ? '' : 'on', onclick: () => { ui.locationId = null; ctx.rerender(); } }, `${locationName(state)} (here)`),
      ...state.branches.map((b) => h('button', { class: ui.locationId === b.id ? 'on' : '', onclick: () => { ui.locationId = b.id; ctx.rerender(); } }, locationName(b))))
    : null;
  const rows = AREAS.map((area) => {
    const people = w.staff.filter((s) => ROLE_AREA[s.role] === area).sort((a, b) => ovr(b) - ovr(a));
    const hireRole: Role = area === 'kitchen' ? 'cook' : area === 'floor' ? 'server' : area === 'back' ? 'dishwasher' : 'manager';
    return h('div', { class: 'area' },
      h('div', { class: 'area-h' }, AREA_NAMES[area]),
      h('div', { class: 'area-cards' },
        ...people.map((s) => miniCard(s, state.day, () => open(s))),
        !w.managed ? h('button', { class: 'pcard empty', onclick: () => { ui.role = hireRole; ctx.rerender(); } }, `+ Hire ${ROLE_NAMES[hireRole].toLowerCase()}`) : null));
  });
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Squad'), h('span', { class: 'small muted' }, `${w.staff.length} people · ${money(weekly)}/week`)),
    places,
    ratingsStrip(w, state),
    ...rows,
    policyCard(ctx, state, w),
    w.managed ? h('div', { class: 'small muted' }, 'Hiring for this restaurant is done by its manager from the same market. Tap a card to override.') : marketSection(ctx, state));
}

/** Staff actions waiting for the player, for reports (7.3 Needs attention). */
export function needsAttention(state: GameState): string[] {
  const out: string[] = [];
  for (const s of state.staff) {
    if (s.leavingOnDay !== null) out.push(`${s.name} handed in notice (leaves day ${s.leavingOnDay}).`);
    else if (s.offer) out.push(`${s.offer.rival} wants ${s.name}: match ${money(s.offer.salary)} or they leave on day ${s.offer.leavesOnDay}.`);
    else if (s.review) out.push(`${s.name} asks for ${money(s.review.ask)} a week.`);
    else if (s.salary < marketValue(s) * 0.9 && !s.apprentice) out.push(`${s.name} is paid ${Math.round((1 - s.salary / marketValue(s)) * 100)}% below market.`);
    else if (s.morale < 40) out.push(`${s.name} is unhappy (morale ${Math.round(s.morale)}). ${moodText(s)}.`);
    else if (s.personality.includes('ambitious') && (s.lastDevelopedDay === null || state.day - s.lastDevelopedDay > 21)) out.push(`${s.name} (Ambitious) has not learned anything new for three weeks.`);
  }
  return out.slice(0, 5);
}

/** One staff suggestion with the best payback (7.3). */
export function staffAdvice(state: GameState, weekValue: Map<number, number>): string | null {
  let best: { text: string; weeks: number } | null = null;
  const rep = bestRep(state);
  for (const s of state.staff) {
    if (isOff(s, state.day)) continue;
    // Only each person's best value course is previewed: the week report must stay quick.
    for (const { courseId: id } of courseOptions(state, s, rep).slice(0, 1)) {
      const c = COURSES[id];
      if (!c) continue;
      const g = courseGains(s, id);
      const after = structuredClone(s);
      for (const a of ATTR_IDS) after.attrs[a] += g[a] ?? 0;
      const d = compare(state, { ...state, staff: state.staff.map((x) => (x.id === s.id ? after : x)) }).profit;
      if (d <= 0.5) continue;
      const weeks = c.price / (7 * d);
      if (weeks > 12) continue;
      if (!best || weeks < best.weeks) best = { text: `${c.name} for ${s.name}: about ${signed(d * 7)} $/week, pays back in ${weeks.toFixed(0)} weeks.`, weeks };
    }
  }
  const worst = [...weekValue.entries()].sort((a, b) => a[1] - b[1])[0];
  const worstStaff = worst ? state.staff.find((s) => s.id === worst[0]) : undefined;
  if (worst && worstStaff && worst[1] / 7 <= T.delegation.replaceBelow) {
    const n = state.candidates.filter((c) => c.role === worstStaff.role && ovr(c) > ovr(worstStaff) && !interestProblem(c, rep)).length;
    const text = `Replace ${worstStaff.name} (${money(worst[1] / 7)} a day): ${n} better ${ROLE_NAMES[worstStaff.role].toLowerCase()}${n === 1 ? '' : 's'} on the market.`;
    if (!best || n > 0) return text;
  }
  return best?.text ?? null;
}
