// Running days: the day loop, fast forward and the guests lost to rivals (solution-design.md 5.2).

import { EQUIPMENT } from '../data/equipment';
import type { EquipmentItem, SegmentId } from '../data/types';
import { T } from '../data/tunables';
import type { Analysis } from './analysis';
import { bestRep, runBranchDay } from './chain';
import type { GameEvent, Result } from './commands';
import { type DayOptions, simulateDay } from './day';
import { applyDeliveryDay } from './delivery';
import { rivalSettingsOf } from './economy';
import { closeWeek } from './kpi';
import { stateLocation } from './location';
import { renewCampaigns } from './marketing';
import { computeRank, loanPayment, RANK_NAMES, unlockedIds } from './progress';
import { inReach, ownRestaurants, playerCompetition, runRivalsDay } from './rivals';
import { dailyCash, type DayReport, type GameState, pushReport } from './state';
import { dayRun, deliverAgency, managerWeek, refreshMarket, teamDay } from './team';

function guestsLost(state: GameState, a: Analysis, report: DayReport, opts: DayOptions): void {
  const m = report.market;
  if (!m || !rivalSettingsOf(state).on) return;
  const comp = playerCompetition(state, stateLocation(state), m.A);
  if (!Object.keys(comp.byRival).length) return;
  const without = simulateDay(state, a, { ...opts, live: false });
  for (const seg of without.segments) {
    const s = seg.segment;
    const lost = Math.max(0, seg.served - (m.served[s] ?? 0));
    m.lost[s] = lost;
    const total = Object.values(comp.byRival).reduce((x, r) => x + (r[s] ?? 0), 0);
    if (total <= 0 || lost <= 0) continue;
    for (const [id, r] of Object.entries(comp.byRival)) {
      const byRival = (m.lostByRival[Number(id)] ??= Object.fromEntries(Object.keys(m.lost).map((k) => [k, 0])) as Record<SegmentId, number>);
      byRival[s] = (lost * (r[s] ?? 0)) / total;
    }
  }
}

// ---------- Fast forward ----------

const WEEK_STOPS: readonly GameEvent['kind'][] = ['staffNotice', 'staffLeft', 'staffOffer', 'restructure'];

export function runWeek(state: GameState, opts: DayOptions): Result {
  const reports: DayReport[] = [];
  const events: GameEvent[] = [];
  let stoppedBecause: string | null = null;
  for (let i = 0; i < 7; i++) {
    const r = runDay(state, opts);
    state = r.state;
    const day = r.events.find((e) => e.kind === 'dayCompleted');
    if (day?.report) reports.push(day.report);
    const others = r.events.filter((e) => e.kind !== 'dayCompleted');
    events.push(...others);
    // With only one restaurant a closed day needs the player; with more, the others keep earning while this one is set up.
    if (day?.report && !day.report.open && !state.branches.length) stoppedBecause = `Closed on day ${day.report.day}: ${day.report.closedReason}`;
    const stop = others.find((e) => WEEK_STOPS.includes(e.kind));
    if (stop) stoppedBecause = stop.text;
    if (stoppedBecause) break;
  }
  const covers = reports.reduce((a, r) => a + r.covers, 0);
  return {
    state,
    events: [{ kind: 'weekCompleted', text: `${reports.length} days run, ${Math.round(covers)} guests served.`, reports, stoppedBecause }, ...events],
  };
}

// ---------- Day settlement ----------

export function runDay(state: GameState, opts: DayOptions): Result {
  const events: GameEvent[] = [];
  const unlockedBefore = unlockedIds(state);
  const rankBefore = state.rank;
  // Campaigns renew at the start of the day, paid now (competition.md 5.2).
  const renewed = renewCampaigns(state.campaigns, state.day, stateLocation(state), state.cash);
  state.campaigns = renewed.campaigns;
  state.cash -= renewed.paid;
  const { a, report } = dayRun(state, opts);
  const p = report.pnl;
  if (report.market && report.open) guestsLost(state, a, report, opts);

  // Daily cash: sales in, ingredients (bought just in time in M0), utilities, upkeep and marketing out.
  state.cash += dailyCash(p);
  let weekly = 0;
  if (report.weekday === 6) {
    weekly += a.weeklySalaries + a.weeklyRent;
    if (state.loan.pausedWeeks > 0) {
      state.loan.pausedWeeks -= 1;
    } else if (state.loan.balance > 0) {
      const pay = loanPayment(state.loan);
      const interest = (state.loan.balance * state.loan.annualRate) / 52;
      state.loan.balance = Math.max(0, state.loan.balance - (pay - interest));
      state.loan.weeksLeft = Math.max(0, state.loan.weeksLeft - 1);
      weekly += pay;
    }
    state.cash -= weekly;
  }
  // The other restaurants, run by their managers, share the same cash (prd.md 5.12).
  const branchDays = state.branches.map((b) => runBranchDay(state, b, report.weekday, opts));
  if (branchDays.length) report.branches = branchDays.map((x) => x.day);
  for (const d of branchDays) events.push(...d.events);
  weekly += branchDays.reduce((x, d) => x + d.weekly, 0);
  report.weeklyPayments = weekly;
  report.cashAfter = state.cash;

  state.rep = report.repAfter;
  state.following = report.followingAfter;
  applyDeliveryDay(state.delivery, report.delivery);
  state.totalServed += report.covers;
  if (report.open) state.daysOpen += 1;

  // The team (staff-management.md): growth, coaching, courses, mood, reviews, offers, contributions.
  const team = teamDay(state, report, a, { ...opts, managed: false, contrib: true, bestRep: bestRep(state) });
  events.push(...team.events);
  if (team.team.length) report.team = team.team;
  if (team.mood.length) report.mood = team.mood;
  if (report.weekday === 6 && state.delegateStaff) {
    const week = managerWeek(state);
    if (week) events.push({ kind: 'info', text: `${week.line} ${week.proposal}` });
  }
  events.push(...deliverAgency(state, bestRep(state)));

  // Safety net (prd.md 5.11): never a game over.
  if (state.cash < 0) {
    state.daysBelowZero += 1;
    if (state.daysBelowZero === T.finance.restructureDays && state.loan.balance > 0) {
      state.loan.pausedWeeks = T.finance.restructureWeeks;
      events.push({ kind: 'restructure', text: 'The bank advisor has paused your loan payments for 4 weeks to give you breathing room.' });
    }
  } else {
    state.daysBelowZero = 0;
  }

  state.rank = computeRank(state);
  if (state.rank !== rankBefore) events.push({ kind: 'rankUp', text: `You are now a ${RANK_NAMES[state.rank]}!` });

  state.history = pushReport(state.history, report, T.history.keepDays, T.history.fullDays);
  // The rival pizzerias run their day after yours, with your start of day pull (competition.md 2.3).
  const fresh = runRivalsDay(state).filter((n) => {
    const r = state.rivals?.find((x) => x.id === n.rivalId);
    return !!r && (inReach(state, r) || ownRestaurants(state).some((o) => o.districtId === n.districtId));
  });
  if (fresh[0]) events.push({ kind: 'market', text: fresh[0].text });
  // Sunday night, after the rivals closed their week: the business review rows (src/sim/kpi.ts).
  if (report.weekday === 6) closeWeek(state);
  state.day += 1;
  if (report.weekday === 6) refreshMarket(state, bestRep(state), state.day);

  const unlockedAfter = unlockedIds(state);
  for (const id of unlockedAfter) {
    if (!unlockedBefore.has(id)) events.push({ kind: 'unlocked', text: `New equipment available: ${(EQUIPMENT[id] as EquipmentItem).name}.` });
  }
  events.unshift({ kind: 'dayCompleted', text: `Day ${report.day} complete.`, report });
  return { state, events };
}
