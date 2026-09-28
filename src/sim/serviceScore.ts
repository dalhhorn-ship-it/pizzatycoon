// The restaurant scorecard (service-deals.md 5): lunch and dinner graded side by side over the last 7 open days.

import { isMain } from '../data/recipes';
import { SERVICE_DEALS } from '../data/serviceDeals';
import type { Service } from '../data/types';
import { T } from '../data/tunables';
import { type Grade, gradeOf } from './deliveryScore';
import type { DayReport, GameState, ServiceReport } from './state';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Where the fix for a KPI lives: the promotions on the Scorecard tab, or another Restaurant tab. */
export type ServiceFix = 'promo' | 'menu' | 'kitchen' | 'room' | 'staff';
export type ServiceKpiId = 'filled' | 'fulfilled' | 'ticket' | 'check' | 'margin';

export interface ServiceKpi {
  id: ServiceKpiId;
  label: string;
  /** 0 to 1: how close to the A mark. */
  score: number;
  grade: Grade;
  /** The measure as shown, e.g. "72%" or "$21.40". */
  shown: string;
  target: string;
  weight: number;
  fix: ServiceFix;
  why: string;
}

export interface ServiceCard {
  service: Service;
  /** Open days with this service in the window. */
  days: number;
  overall: number;
  grade: Grade;
  kpis: ServiceKpi[];
  /** Guests, sales and profit after food a day, and guests on the set menu a day. */
  guests: number;
  sales: number;
  gross: number;
  dealGuests: number;
  given: number;
  /** The kitchen or front of house stage that most often set the limit, if any. */
  bottleneck: ServiceReport['bottleneck'];
}

export interface RestaurantScorecard {
  days: number;
  lunch: ServiceCard;
  dinner: ServiceCard;
  /** The weakest KPI over both services (ties: the heavier one), the one to work on this week. */
  focus: (ServiceKpi & { service: Service }) | null;
}

/** A marks per service. Lunch is quick and cheap, dinner is long and full. */
export const SERVICE_A: Record<Service, { filled: number; fulfilled: number; ticket: number; check: number; margin: number }> = {
  lunch: { filled: 0.75, fulfilled: 0.95, ticket: T.satisfaction.ticketFree, check: 1.35, margin: 0.68 },
  dinner: { filled: 0.85, fulfilled: 0.95, ticket: T.satisfaction.ticketFree, check: 1.7, margin: 0.68 },
};

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const dollars = (x: number): string => `$${x.toFixed(2)}`;

/** Open days with full service reports, oldest first (older days keep only totals). */
export function serviceDays(history: readonly DayReport[]): DayReport[] {
  return history.filter((r) => r.open && r.services.length);
}

/** Average price of a main on the menu: the yardstick for the check. */
export function mainPrice(state: Pick<GameState, 'recipes'>): number {
  const mains = state.recipes.filter((r) => r.onMenu && isMain(r.kind));
  return mains.length ? mains.reduce((x, r) => x + r.price, 0) / mains.length : 0;
}

const FIX_FOR: Record<ServiceReport['bottleneck'], ServiceFix> = {
  seats: 'room', servers: 'staff', cooks: 'staff', oven: 'kitchen', prep: 'kitchen', plates: 'kitchen', cold: 'kitchen', none: 'room',
};

function card(sv: Service, days: readonly DayReport[], main: number): ServiceCard {
  const rs = days.map((d) => d.services.find((s) => s.service === sv)).filter((x): x is ServiceReport => !!x);
  const sum = (f: (r: ServiceReport) => number): number => rs.reduce((x, r) => x + f(r), 0);
  const served = sum((r) => r.served);
  const n = Math.max(1, rs.length);
  const filled = sum((r) => r.capacity) > 0 ? served / sum((r) => r.capacity) : 0;
  const fulfilled = sum((r) => r.demand) > 0 ? served / sum((r) => r.demand) : 1;
  const ticket = served > 0 ? sum((r) => r.ticketTime * r.served) / served : 0;
  const sales = sum((r) => r.sales ?? 0);
  const food = sum((r) => r.food ?? 0);
  const check = served > 0 ? sales / served : 0;
  const margin = sales > 0 ? 1 - food / sales : 0;
  const counts = new Map<ServiceReport['bottleneck'], number>();
  for (const r of rs) if (r.bottleneck !== 'none') counts.set(r.bottleneck, (counts.get(r.bottleneck) ?? 0) + 1);
  const bottleneck = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
  const A = SERVICE_A[sv];
  const name = sv === 'lunch' ? 'lunch' : 'dinner';
  const kpi = (id: ServiceKpiId, label: string, score: number, shown: string, target: string, weight: number, fix: ServiceFix, why: string): ServiceKpi => {
    const s = clamp(score, 0, 1);
    return { id, label, score: s, grade: gradeOf(s), shown, target, weight, fix, why };
  };
  const checkA = A.check * main;
  const kpis: ServiceKpi[] = [
    kpi('filled', 'Seats filled', filled / A.filled, pct(filled), pct(A.filled), 25, 'promo',
      `Guests against what the room and kitchen could serve at ${name}. Empty seats are a demand question: a set menu, ${sv === 'lunch' ? 'lunch flyers or coupons' : 'campaigns'}, prices or quality.`),
    kpi('fulfilled', 'Guests served', fulfilled / A.fulfilled, pct(fulfilled), pct(A.fulfilled), 20, FIX_FOR[bottleneck],
      `Guests served out of the guests who came at ${name}. The rest were turned away or left: the limit was ${bottleneck === 'none' ? 'nothing in particular' : bottleneck === 'cold' ? 'dough in the fridges' : `the ${bottleneck}`}.`),
    kpi('ticket', 'Ticket time', ticket > 0 ? A.ticket / ticket : 0, `${ticket.toFixed(0)} min`, `${A.ticket} min`, 15, 'kitchen',
      `Minutes from order to plate at ${name}. ${sv === 'lunch' ? 'Lunch guests are in a hurry: professionals walk off first.' : 'Long waits cost satisfaction.'} Faster stations or more cooks.`),
    kpi('check', 'Check per guest', checkA > 0 ? check / checkA : 0, dollars(check), dollars(checkA), 20, 'promo',
      `What a guest spends at ${name}, against ${A.check}x your average main. Starters, desserts, the bar and set menus lift it; ${sv === 'lunch' ? 'coupons' : 'discounts'} lower it.`),
    kpi('margin', 'Margin after food', margin / A.margin, pct(margin), pct(A.margin), 20, 'menu',
      'Share of sales left after ingredients. Deep set menu discounts and coupons thin it; prices and ingredient tiers set it.'),
  ];
  const totalW = kpis.reduce((x, k) => x + k.weight, 0);
  const overall = Math.round((100 * kpis.reduce((x, k) => x + k.weight * k.score, 0)) / totalW);
  return {
    service: sv, days: rs.length, overall, grade: gradeOf(overall / 100), kpis,
    guests: served / n, sales: sales / n, gross: (sales - food) / n,
    dealGuests: sum((r) => r.dealGuests ?? 0) / n, given: sum((r) => r.dealGiven ?? 0) / n, bottleneck,
  };
}

/** The scorecard over the last 7 open days; null before the first open day. */
export function restaurantScorecard(state: Pick<GameState, 'history' | 'recipes'>): RestaurantScorecard | null {
  const days = serviceDays(state.history).slice(-7);
  if (!days.length) return null;
  const main = mainPrice(state);
  const lunch = card('lunch', days, main);
  const dinner = card('dinner', days, main);
  const all = [...lunch.kpis.map((k) => ({ ...k, service: 'lunch' as const })), ...dinner.kpis.map((k) => ({ ...k, service: 'dinner' as const }))];
  const focus = all.filter((k) => k.grade !== 'A').sort((a, b) => a.score - b.score || b.weight - a.weight)[0] ?? null;
  return { days: days.length, lunch, dinner, focus };
}

/** The set menu name for a report line. */
export const dealName = (r: ServiceReport): string | null => (r.deal ? SERVICE_DEALS[r.deal]?.name ?? null : null);
