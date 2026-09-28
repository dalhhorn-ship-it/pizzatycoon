// The delivery scorecard (delivery-tab.md 5.4): seven graded KPIs over the last 7 delivery days and an overall score.

import { T } from '../data/tunables';
import type { DayReport, DeliveryDay } from './state';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
/** The Delivery tab that fixes a KPI. */
export type DeliveryTabId = 'promotion' | 'menu' | 'fleet' | 'score';
export type ScoreKpiId = 'onTime' | 'food' | 'value' | 'fulfilled' | 'rating' | 'profit' | 'audience';

export interface ScoreKpi {
  id: ScoreKpiId;
  label: string;
  /** 0 to 1: how close to the A mark (1 is at or above it). */
  score: number;
  grade: Grade;
  /** The measure as shown, e.g. "86%" or "$4.20". */
  shown: string;
  /** Where A starts, as shown. */
  target: string;
  /** Change of the raw measure against the 7 delivery days before, in the measure's own unit; null without them. */
  change: number | null;
  weight: number;
  fix: DeliveryTabId;
  /** One sentence on why it matters and what moves it. */
  why: string;
}

export interface Scorecard {
  /** Delivery days in the window. */
  days: number;
  /** 0 to 100. */
  overall: number;
  grade: Grade;
  kpis: ScoreKpi[];
  /** The lowest graded KPI, the one to work on this week (ties: the heavier one). */
  focus: ScoreKpi | null;
}

export const SCORE_WINDOW = 7;
/** Fewer delivery days than this and the scorecard asks for more. */
export const SCORE_MIN_DAYS = 3;

/** Grade marks on the 0 to 1 score. */
export function gradeOf(score: number): Grade {
  return score >= 0.999 ? 'A' : score >= 0.85 ? 'B' : score >= 0.7 ? 'C' : score >= 0.5 ? 'D' : 'E';
}

interface Raw {
  onTime: number;
  food: number;
  value: number;
  fulfilled: number;
  rating: number;
  profit: number;
  audience: number | null;
}

/** Raw measures over some delivery days, weighted by orders delivered. */
function measure(ds: readonly DeliveryDay[]): Raw {
  const delivered = ds.reduce((x, d) => x + d.delivered, 0);
  const wanted = ds.reduce((x, d) => x + d.wanted, 0);
  const promise = T.delivery.promise;
  const onTimeOrders = ds.reduce((x, d) => x + (['lunch', 'dinner'] as const).reduce((y, sv) => {
    const out = d.byService?.[sv]?.delivered ?? (sv === 'lunch' ? d.delivered * T.delivery.lunchShare : d.delivered * (1 - T.delivery.lunchShare));
    return y + (d.time[sv] <= promise ? out : 0);
  }, 0), 0);
  const w = (f: (d: DeliveryDay) => number): number => (delivered > 0 ? ds.reduce((x, d) => x + d.delivered * f(d), 0) / delivered : 0);
  const last = ds.at(-1);
  return {
    onTime: delivered > 0 ? onTimeOrders / delivered : 0,
    food: w((d) => d.scores?.food ?? 0),
    value: w((d) => d.scores?.value ?? 0),
    fulfilled: wanted > 0 ? delivered / wanted : 0,
    rating: last?.drepAfter ?? 0,
    profit: delivered > 0 ? ds.reduce((x, d) => x + d.profit, 0) / delivered : 0,
    audience: last?.audienceAfter ?? null,
  };
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const dollars = (x: number): string => `${x < 0 ? '-' : ''}$${Math.abs(x).toFixed(2)}`;

/** The delivery days of the last reports, oldest first. */
export function deliveryDays(history: readonly DayReport[]): DeliveryDay[] {
  return history.filter((r) => r.open && r.delivery).map((r) => r.delivery as DeliveryDay);
}

/** The scorecard over the last 7 delivery days; null before the first delivery day. */
export function deliveryScorecard(history: readonly DayReport[]): Scorecard | null {
  const all = deliveryDays(history);
  const ds = all.slice(-SCORE_WINDOW);
  if (!ds.length) return null;
  const before = all.slice(-2 * SCORE_WINDOW, -SCORE_WINDOW);
  const now = measure(ds);
  const prev = before.length >= SCORE_MIN_DAYS ? measure(before) : null;
  const diff = (k: keyof Raw): number | null => {
    const a = now[k];
    const b = prev?.[k];
    return a === null || b === null || b === undefined ? null : a - b;
  };
  const A = { onTime: 0.9, food: 0.85, value: 0.8, fulfilled: 0.95, rating: 85, profit: 6, audience: 0.6 };
  const kpi = (id: ScoreKpiId, label: string, score: number, shown: string, target: string, weight: number, fix: DeliveryTabId, why: string): ScoreKpi => {
    const s = clamp(score, 0, 1);
    return { id, label, score: s, grade: gradeOf(s), shown, target, change: diff(id), weight, fix, why };
  };
  const kpis: ScoreKpi[] = [
    kpi('onTime', 'On time', now.onTime / A.onTime, pct(now.onTime), pct(A.onTime), 20, 'fleet',
      `Orders at the door within ${T.delivery.promise} minutes. Late orders cost rating and, very late, refunds: more riders, faster vehicles, a closer zone or a lower kitchen limit.`),
    kpi('food', 'Food on arrival', now.food / A.food, `${Math.round(now.food * 100)}`, `${Math.round(A.food * 100)}`, 20, 'menu',
      'How good the food is at the door, the biggest part of the rating: insulated packaging, a heated packing station, better ingredients, a closer zone.'),
    kpi('fulfilled', 'Orders fulfilled', now.fulfilled / A.fulfilled, pct(now.fulfilled), pct(A.fulfilled), 15, 'fleet',
      'Orders delivered out of the orders people wanted. Refused and cancelled orders are lost sales and cost rating: kitchen capacity and riders.'),
    kpi('rating', 'Delivery rating', now.rating / A.rating, `${now.rating.toFixed(0)}`, `${A.rating}`, 15, 'score',
      `The rating on the app: at ${T.delivery.topRatedDrep} for ${T.delivery.topRatedDays} days you become Top rated. It follows food, time and value.`),
    kpi('profit', 'Profit per order', (now.profit + 2) / (A.profit + 2), dollars(now.profit), dollars(A.profit), 15, 'menu',
      'What one order leaves after food, commission, packaging, riders and vehicles: app markup, deal choice, minimum order and mode.'),
    kpi('value', 'Value for money', now.value / A.value, `${Math.round(now.value * 100)}`, `${Math.round(A.value * 100)}`, 10, 'menu',
      'Whether app prices feel fair: a lower markup or a deal lifts it, a high minimum order does not.'),
    kpi('audience', 'Audience', (now.audience ?? 0) / A.audience, now.audience === null ? 'n/a' : pct(now.audience), pct(A.audience), 5, 'promotion',
      'The share of the neighbourhood that knows you deliver. Only they order. Delivery campaigns grow it fast, word of mouth slowly.'),
  ];
  const totalW = kpis.reduce((x, k) => x + k.weight, 0);
  const overall = Math.round((100 * kpis.reduce((x, k) => x + k.weight * k.score, 0)) / totalW);
  const focus = [...kpis].filter((k) => k.grade !== 'A').sort((a, b) => a.score - b.score || b.weight - a.weight)[0] ?? null;
  return { days: ds.length, overall, grade: gradeOf(overall / 100), kpis, focus };
}
