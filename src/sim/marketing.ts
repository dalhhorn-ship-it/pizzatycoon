// Marketing campaigns (competition.md 5): cost, audience, match, lift, fatigue and awareness.

import { CAMPAIGNS, type Campaign, type CampaignId } from '../data/campaigns';
import { SEGMENT_IDS } from '../data/segments';
import type { SegmentId, Service } from '../data/types';
import { T } from '../data/tunables';
import type { LocationFacts } from './location';
import type { ActiveCampaign } from './state';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Audience weight of a campaign for a segment: fixed weights, or reach for the chosen segments. */
export function audienceWeight(c: Campaign, chosen: readonly SegmentId[], s: SegmentId): number {
  if (c.audience === 'choose') return chosen.includes(s) ? (c.reach?.[s] ?? 0) : 0;
  return c.audience[s] ?? 0;
}

/** What a campaign costs at this venue: bigger crowds cost more to reach (5.1). */
export function campaignCost(c: Campaign, footTraffic: number): number {
  if (!c.scaled) return c.cost;
  const m = T.marketing;
  return Math.round(c.cost * clamp(footTraffic / m.costScaleRef, m.costScaleMin, m.costScaleMax));
}

/** Share of the venue's crowd the campaign speaks to, 0..1 (5.3). */
export function audienceMatch(c: Campaign, chosen: readonly SegmentId[], shares: Record<SegmentId, number>): number {
  const weights = SEGMENT_IDS.map((s) => audienceWeight(c, chosen, s));
  const max = Math.max(0, ...weights);
  if (max <= 0) return 0;
  return SEGMENT_IDS.reduce((x, s, i) => x + (weights[i] ?? 0) * shares[s], 0) / max;
}

export function matchLabel(match: number): 'Great fit' | 'OK' | 'Poor' {
  if (match >= T.marketing.matchGreat) return 'Great fit';
  if (match >= T.marketing.matchOk) return 'OK';
  return 'Poor';
}

/** Fatigue from the streak of weeks the same campaign has run (5.2 rule 3). */
export function fatigueOf(weeksRunning: number): number {
  const m = T.marketing;
  if (weeksRunning > 2 * m.fatigueWeeks) return m.fatigue2;
  if (weeksRunning > m.fatigueWeeks) return m.fatigue1;
  return 1;
}

export const isActive = (a: ActiveCampaign, day: number): boolean => a.startDay <= day && day < a.endsDay;

/** Dining multiplier for a segment, capped (5.3). `service` and `weekday` apply lunch only and Sunday lifts; omit for the average. */
export function mktFor(campaigns: readonly ActiveCampaign[] | undefined, s: SegmentId, day: number, service?: Service): number {
  let lift = 0;
  const weekday = (day - 1) % 7;
  for (const a of campaigns ?? []) {
    if (!isActive(a, day)) continue;
    const c = CAMPAIGNS[a.id];
    if (!c || c.lift <= 0) continue;
    if (c.lunchOnly && service === 'dinner') continue;
    const w = audienceWeight(c, a.audience, s);
    if (w <= 0) continue;
    const sunday = c.sundayLift && weekday === 6 ? c.sundayLift : 0;
    const perService = c.lunchOnly && service === undefined ? 0.5 : 1;
    lift += (c.lift + sunday) * w * fatigueOf(a.weeksRunning) * perService;
  }
  return Math.min(1 + T.marketing.liftCap, 1 + lift);
}

/** Delivery multiplier, audience weighted by the delivery crowd's affinities (5.3). */
export function mktDelivery(campaigns: readonly ActiveCampaign[] | undefined, day: number, shares: Record<SegmentId, number>): number {
  let lift = 0;
  for (const a of campaigns ?? []) {
    if (!isActive(a, day)) continue;
    const c = CAMPAIGNS[a.id];
    if (!c || c.deliveryLift <= 0) continue;
    const everyone = c.audience !== 'choose' && Object.keys(c.audience).length === 0;
    const w = everyone ? 1 : SEGMENT_IDS.reduce((x, s) => x + audienceWeight(c, a.audience, s) * shares[s], 0) /
      Math.max(1e-9, SEGMENT_IDS.reduce((x, s) => x + (audienceWeight(c, a.audience, s) > 0 ? shares[s] : 0), 0));
    lift += c.deliveryLift * (Number.isFinite(w) ? w : 1) * fatigueOf(a.weeksRunning);
  }
  return Math.min(1 + T.marketing.deliveryLiftCap, 1 + lift);
}

/** Awareness added to the local following today by running campaigns (5.3). */
export function awarenessGain(campaigns: readonly ActiveCampaign[] | undefined, day: number, following: number, shares: Record<SegmentId, number>): number {
  let gain = 0;
  for (const a of campaigns ?? []) {
    if (!isActive(a, day)) continue;
    const c = CAMPAIGNS[a.id];
    if (!c || c.awareness <= 0) continue;
    gain += (c.awareness * (T.marketing.awarenessBase + audienceMatch(c, a.audience, shares)) * (1 - following)) / 7;
  }
  return gain;
}

/** Student deal and the like: the share of a segment's main price given away. */
export function discountFor(campaigns: readonly ActiveCampaign[] | undefined, s: SegmentId, day: number): number {
  let d = 0;
  for (const a of campaigns ?? []) {
    if (!isActive(a, day)) continue;
    const c = CAMPAIGNS[a.id];
    if (c?.discount?.segment === s) d = Math.max(d, c.discount.share);
  }
  return d;
}

export const hasLoyalty = (campaigns: readonly ActiveCampaign[] | undefined, day: number): boolean =>
  (campaigns ?? []).some((a) => a.id === 'loyalty' && isActive(a, day));

/** Campaigns that use a slot at this restaurant (radio needs none). */
export function slotsUsed(campaigns: readonly ActiveCampaign[] | undefined, day: number): number {
  return (campaigns ?? []).filter((a) => (a.renew || isActive(a, day)) && !CAMPAIGNS[a.id]?.everyRestaurant).length;
}

export function newCampaign(id: CampaignId, audience: SegmentId[], day: number, facts: LocationFacts, weeksRunning = 1): ActiveCampaign {
  const c = CAMPAIGNS[id];
  // Bought between services: it runs from the next service, which is the day on the clock.
  return { id, audience, startDay: day, endsDay: day + c.runDays, renew: c.renews, weeksRunning, spent: campaignCost(c, facts.footTraffic) };
}

/**
 * Start of a day: campaigns whose run ends renew (paid now), fatigue streaks continue, stopped ones fade from the list
 * after the rest period. Returns what was paid. Radio renews for the whole chain from the restaurant that bought it.
 */
export function renewCampaigns(campaigns: ActiveCampaign[] | undefined, day: number, facts: LocationFacts, cash: number): { campaigns: ActiveCampaign[]; paid: number } {
  let paid = 0;
  let left = cash;
  const out: ActiveCampaign[] = [];
  for (const a of campaigns ?? []) {
    if (day >= a.endsDay && a.renew) {
      const c = CAMPAIGNS[a.id];
      const cost = campaignCost(c, facts.footTraffic);
      if (!c || cost > left) {
        out.push({ ...a, renew: false });
        continue;
      }
      left -= cost;
      paid += cost;
      out.push({ ...a, startDay: day, endsDay: day + c.runDays, weeksRunning: a.weeksRunning + Math.max(1, Math.round(c.runDays / 7)), spent: cost });
      continue;
    }
    // Stopped runs stay listed for the rest period, so a quick restart keeps its fatigue.
    if (!a.renew && day - a.endsDay > 7 * T.marketing.restWeeks) continue;
    out.push(a);
  }
  return { campaigns: out, paid };
}

/** Weeks of fatigue a restarted campaign carries: the streak continues when it rested less than the rest period. */
export function streakOnRestart(campaigns: readonly ActiveCampaign[] | undefined, id: CampaignId, day: number): number {
  const prev = (campaigns ?? []).find((a) => a.id === id);
  if (!prev) return 1;
  return day - prev.endsDay <= 7 * T.marketing.restWeeks ? prev.weeksRunning + 1 : 1;
}

/** Spend on campaign runs that started today (already paid in cash), for the day's P&L. */
export function runSpendToday(campaigns: readonly ActiveCampaign[] | undefined, day: number): number {
  return (campaigns ?? []).filter((a) => a.startDay === day).reduce((x, a) => x + a.spent, 0);
}
