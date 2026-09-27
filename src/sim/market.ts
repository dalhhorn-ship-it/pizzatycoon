// Competition analytics and the coach (competition.md 7, 8): market share, guests lost per rival, rival read outs and
// the playbook of situations with their answers.

import { CAMPAIGNS, type CampaignId } from '../data/campaigns';
import { ARCHETYPES } from '../data/rivals';
import { isMain } from '../data/recipes';
import { SEGMENT_IDS, SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { analyse } from './analysis';
import { rivalSettingsOf } from './economy';
import { stateLocation } from './location';
import { audienceMatch } from './marketing';
import { activeRivals, archetypeKnown, inReach, ownRestaurants, rivalA, rivalLocations, rivalMainPrice, rivalQ, rivalSkill, venueFacts } from './rivals';
import type { DayReport, GameState, Rival } from './state';

const zeroSeg = (): Record<SegmentId, number> => Object.fromEntries(SEGMENT_IDS.map((s) => [s, 0])) as Record<SegmentId, number>;

// ---------- Market share (7.1) ----------

export interface ShareRow {
  key: string;
  name: string;
  /** 'you' for the restaurant you run, 'own' for your other restaurants, else the rival id. */
  who: 'you' | 'own' | number;
  color: string;
  served: Record<SegmentId, number>;
  total: number;
}

/** Guests of every pizzeria in a district over the last 7 days (the rivals' last full week). */
export function districtShare(state: GameState, districtId: string): ShareRow[] {
  const rows: ShareRow[] = [];
  const addReports = (key: string, name: string, who: 'you' | 'own', reports: readonly DayReport[]): void => {
    const served = zeroSeg();
    for (const r of reports.slice(-7)) for (const s of SEGMENT_IDS) served[s] += r.market?.served[s] ?? r.segments.find((x) => x.segment === s)?.served ?? 0;
    rows.push({ key, name, who, color: who === 'you' ? '#c98a14' : '#e0b04a', served, total: SEGMENT_IDS.reduce((a, s) => a + served[s], 0) });
  };
  if (state.districtId === districtId) addReports('you', 'You', 'you', state.history);
  for (const b of state.branches) if (b.districtId === districtId) addReports(`own${b.id}`, VENUES[b.venueId ?? '']?.name ?? 'Your restaurant', 'own', b.history);
  for (const { rival, loc } of rivalLocations(state)) {
    if (venueFacts(loc.venueId).district.id !== districtId) continue;
    const week = loc.history.at(-1)?.bySegment ?? loc.week.bySegment;
    const served = { ...week };
    rows.push({ key: `r${rival.id}:${loc.venueId}`, name: rival.name, who: rival.id, color: ARCHETYPES[rival.archetype].color, served, total: SEGMENT_IDS.reduce((a, s) => a + served[s], 0) });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** Your share of pizza guests in your district, week by week, as far back as the reports go (up to 8 weeks). */
export function shareTrend(state: GameState): number[] {
  const out: number[] = [];
  const weeks = Math.floor(state.history.length / 7);
  const locs = rivalLocations(state).filter(({ loc }) => venueFacts(loc.venueId).district.id === state.districtId);
  for (let w = weeks; w >= 1; w--) {
    const reports = state.history.slice(state.history.length - 7 * w, state.history.length - 7 * (w - 1));
    const mine = reports.reduce((x, r) => x + r.covers, 0);
    const theirs = locs.reduce((x, { loc }) => x + (loc.history.at(-w)?.served ?? 0), 0);
    out.push(mine + theirs > 0 ? mine / (mine + theirs) : 1);
  }
  return out;
}

// ---------- Guests lost (7.4) ----------

export interface Loss {
  rivalId: number;
  bySegment: Record<SegmentId, number>;
  total: number;
}

/** Guests each rival took from the restaurant you run over a set of days. */
export function lossesOver(reports: readonly DayReport[]): Loss[] {
  const by = new Map<number, Record<SegmentId, number>>();
  for (const r of reports) for (const [id, seg] of Object.entries(r.market?.lostByRival ?? {})) {
    const x = by.get(Number(id)) ?? zeroSeg();
    for (const s of SEGMENT_IDS) x[s] += seg[s] ?? 0;
    by.set(Number(id), x);
  }
  return [...by.entries()].map(([rivalId, bySegment]) => ({ rivalId, bySegment, total: SEGMENT_IDS.reduce((a, s) => a + bySegment[s], 0) }))
    .sort((a, b) => b.total - a.total);
}

/** "About 9 guests went to rivals today, mostly students to Pizza Pronto." */
export function lossLine(state: GameState, r: DayReport): string | null {
  const lost = lossesOver([r]);
  const total = lost.reduce((a, x) => a + x.total, 0);
  if (total < 1) return null;
  const top = lost[0];
  const rival = state.rivals?.find((x) => x.id === top?.rivalId);
  const seg = top ? [...SEGMENT_IDS].sort((a, b) => top.bySegment[b] - top.bySegment[a])[0] : undefined;
  return `About ${Math.round(total)} guest${Math.round(total) === 1 ? '' : 's'} went to rivals today${rival && seg ? `, mostly ${SEGMENTS[seg].name.toLowerCase()} to ${rival.name}` : ''}.`;
}

// ---------- What you can tell about a rival (7.2) ----------

export interface RivalRead {
  rival: Rival;
  known: boolean;
  mystery: boolean;
  /** Price index against yours, as a band unless a mystery diner went. */
  priceVsYou: [number, number];
  mainPrice: number;
  quality: [number, number];
  yourQuality: number;
  speed: 'fast' | 'normal' | 'slow';
  stars: number;
  trend: 'Growing' | 'Steady' | 'Struggling';
  served: Record<SegmentId, number>;
  satisfaction: number;
  lowest: string;
}

function yourPriceIndex(state: GameState): { index: number; quality: number } {
  const a = analyse(state);
  const mains = state.recipes.filter((r) => r.onMenu && isMain(r.kind));
  if (!mains.length) return { index: 1, quality: 60 };
  const idx = mains.reduce((x, r) => x + r.price / (a.dishes[r.id]?.fairPrice ?? r.price), 0) / mains.length;
  const q = mains.reduce((x, r) => x + (a.dishes[r.id]?.quality ?? 60), 0) / mains.length;
  return { index: idx, quality: q };
}

export function readRival(state: GameState, rival: Rival): RivalRead {
  const loc = rival.locations[0];
  const skill = rivalSkill(state, rival);
  const you = yourPriceIndex(state);
  const mystery = (rival.mysteryUntil ?? 0) > state.day;
  const rel = loc ? loc.priceIndex / you.index : 1;
  const Q = loc ? rivalQ(loc.tier, skill) : 50;
  // Estimates are a band 10 points wide around the truth, offset by the rival's id so they do not jump about.
  const off = ((rival.id * 37) % 10) / 100;
  const hist = loc?.history ?? [];
  const losing = hist.slice(-3).every((w) => w.profit < 0) && hist.length >= 3;
  const growing = hist.length >= 2 && (hist.at(-1)?.served ?? 0) > 1.05 * (hist.at(-2)?.served ?? 0);
  const serviceTime = ARCHETYPES[rival.archetype].serviceTime;
  return {
    rival, known: archetypeKnown(state, rival), mystery,
    priceVsYou: mystery ? [rel, rel] : [rel - off, rel - off + 0.1],
    mainPrice: loc ? rivalMainPrice(loc, skill) : 0,
    quality: mystery ? [Q, Q] : [Math.round(Q - off * 100), Math.round(Q - off * 100 + 10)],
    yourQuality: you.quality,
    speed: serviceTime <= 18 ? 'fast' : serviceTime >= 24 ? 'slow' : 'normal',
    stars: loc ? loc.rep / 20 : 0,
    trend: losing ? 'Struggling' : growing ? 'Growing' : 'Steady',
    served: loc?.last.bySegment ?? zeroSeg(),
    satisfaction: loc?.last.satisfaction ?? 0,
    lowest: loc?.last.lowest ?? '',
  };
}

// ---------- The coach (7.5) ----------

export type AnswerKind =
  | { kind: 'price'; mult: number; segment?: SegmentId }
  | { kind: 'campaign'; id: CampaignId; audience: SegmentId[] }
  | { kind: 'tierUp' }
  | { kind: 'hold' }
  | { kind: 'kitchen' }
  | { kind: 'course' }
  | { kind: 'delivery' };

export interface Answer {
  text: string;
  action: AnswerKind;
}

export interface Situation {
  id: 'undercut' | 'outCooked' | 'outShouted' | 'newcomer' | 'struggling' | 'lead' | 'fullHouse' | 'deliveryOverload';
  diagnosis: string;
  /** Guests or dollars at stake, for ordering. */
  stake: number;
  answers: Answer[];
}

function lossShare(reports: readonly DayReport[], rivalId: number, s: SegmentId): number {
  let lost = 0;
  let served = 0;
  for (const r of reports) {
    lost += r.market?.lostByRival[rivalId]?.[s] ?? 0;
    served += r.market?.served[s] ?? 0;
  }
  return served + lost > 0 ? lost / (served + lost) : 0;
}

/** The best matched campaign for a segment at the restaurant you run. */
export function bestCampaignFor(state: GameState, segments: SegmentId[]): { id: CampaignId; audience: SegmentId[] } | null {
  const facts = stateLocation(state);
  let best: { id: CampaignId; audience: SegmentId[]; match: number } | null = null;
  for (const c of Object.values(CAMPAIGNS)) {
    if (c.lift <= 0 || c.everyRestaurant || c.unlock === 'delivery') continue;
    const audience = c.audience === 'choose' ? segments.slice(0, c.choose ?? 1) : [];
    const reaches = SEGMENT_IDS.filter((s) => (c.audience === 'choose' ? audience.includes(s) : (c.audience[s] ?? 0) > 0));
    if (!segments.some((s) => reaches.includes(s))) continue;
    const match = audienceMatch(c, audience, facts.shares);
    if (!best || match > best.match) best = { id: c.id, audience, match };
  }
  return best ? { id: best.id, audience: best.audience } : null;
}

/** Situations the coach sees at the restaurant you run, most at stake first, at most two (7.5). */
export function coach(state: GameState): Situation[] {
  const out: Situation[] = [];
  const reports = state.history.slice(-7).filter((r) => r.open);
  const last = reports.at(-1);
  const you = yourPriceIndex(state);
  const key = [...SEGMENT_IDS].sort((a, b) => (last?.market?.served[b] ?? 0) - (last?.market?.served[a] ?? 0));
  const live = rivalSettingsOf(state).on;
  if (live) {
    for (const rival of activeRivals(state)) {
      if (!inReach(state, rival)) continue;
      const read = readRival(state, rival);
      const loc = rival.locations[0];
      if (!loc) continue;
      const lostTotal = lossesOver(reports).find((l) => l.rivalId === rival.id)?.total ?? 0;
      const worstSeg = [...SEGMENT_IDS].sort((a, b) => lossShare(reports, rival.id, b) - lossShare(reports, rival.id, a))[0] as SegmentId;
      const worstShare = lossShare(reports, rival.id, worstSeg);
      const segName = SEGMENTS[worstSeg].name.toLowerCase();
      if (loc.priceIndex <= 0.9 * you.index && worstShare >= 0.1) {
        const targets = ARCHETYPES[rival.archetype].targets;
        const other = key.find((s) => !(Array.isArray(targets) && targets.includes(s)) && s !== worstSeg) ?? key[0] ?? 'families';
        const camp = bestCampaignFor(state, [other]);
        out.push({
          id: 'undercut', stake: lostTotal,
          diagnosis: `${rival.name} is about ${Math.round((1 - loc.priceIndex / you.index) * 100)}% cheaper and took about ${Math.round(lostTotal)} of your guests this week, mostly ${segName}.`,
          answers: [
            { text: `A sharper price on your mains (5% lower) for the ${segName}`, action: { kind: 'price', mult: 0.95, segment: worstSeg } },
            ...(camp ? [{ text: `A ${CAMPAIGNS[camp.id].name.toLowerCase()} for ${SEGMENTS[other].name.toLowerCase()}, a crowd ${rival.name} does not chase`, action: { kind: 'campaign' as const, ...camp } }] : []),
            { text: 'Faster lunch service: look at the pipeline', action: { kind: 'kitchen' } },
          ],
        });
      }
      if (read.quality[0] >= you.quality + 5 && (lossShare(reports, rival.id, 'foodies') >= 0.1 || lossShare(reports, rival.id, 'tourists') >= 0.1)) {
        const camp = bestCampaignFor(state, ['professionals']);
        out.push({
          id: 'outCooked', stake: lostTotal,
          diagnosis: `${rival.name}'s pizza is better and foodies noticed: about ${Math.round(lostTotal)} guests went there this week.`,
          answers: [
            { text: 'Better ingredients on your two best sellers', action: { kind: 'tierUp' } },
            { text: 'Send a cook on the Dough and Knife Skills course', action: { kind: 'course' } },
            ...(camp ? [{ text: 'Or leave the foodies to them and win professionals', action: { kind: 'campaign' as const, ...camp } }] : []),
          ],
        });
      }
      if (loc.campaigns.filter((c) => state.day < c.endsDay).length >= 2 && worstShare >= 0.1) {
        const camp = bestCampaignFor(state, [worstSeg]);
        out.push({
          id: 'outShouted', stake: lostTotal,
          diagnosis: `${rival.name} is everywhere with ${loc.campaigns.length} campaigns and took about ${Math.round(lostTotal)} of your guests, mostly ${segName}.`,
          answers: [
            { text: 'Loyalty cards keep your regulars', action: { kind: 'campaign', id: 'loyalty', audience: [] } },
            ...(camp ? [{ text: `One matched campaign for your ${segName} only`, action: { kind: 'campaign' as const, ...camp } }] : []),
            { text: 'Hold steady: hype fades when the campaigns stop', action: { kind: 'hold' } },
          ],
        });
      }
      if (state.day - loc.opened <= 28 && loc.opened > 1) {
        const camp = bestCampaignFor(state, key.slice(0, 1));
        out.push({
          id: 'newcomer', stake: lostTotal + 1,
          diagnosis: `${rival.name} opened nearby on day ${loc.opened}. Expect a dip of about ${Math.max(1, Math.round(lostTotal))} guest${Math.max(1, Math.round(lostTotal)) === 1 ? '' : 's'} a week while people try them.`,
          answers: [
            { text: 'Hold steady: the novelty wears off', action: { kind: 'hold' } },
            ...(camp ? [{ text: `A campaign for your biggest crowd (${SEGMENTS[key[0] ?? 'families'].name.toLowerCase()})`, action: { kind: 'campaign' as const, ...camp } }] : []),
          ],
        });
      }
      if (read.trend === 'Struggling') {
        out.push({
          id: 'struggling', stake: lostTotal * 0.5,
          diagnosis: `${rival.name} is losing money at these prices: ${loc.last.lowest ? `guests complain about ${loc.last.lowest}` : 'half empty rooms'}.`,
          answers: [{ text: 'Hold steady. Do not cut your prices; they will run out of road first.', action: { kind: 'hold' } }],
        });
      }
    }
    // You lead: highest share in the district and clearly more attractive than every rival for your key segments.
    const rows = districtShare(state, state.districtId);
    if (rows[0]?.who === 'you' && rows.length > 1 && last?.market) {
      const A = last.market.A;
      const rivalsHere = rivalLocations(state).filter(({ loc }) => venueFacts(loc.venueId).district.id === state.districtId);
      const strong = key.slice(0, 2).every((s) => rivalsHere.every(({ rival, loc }) => A[s] >= 1.3 * rivalAInline(state, rival, loc, s)));
      if (strong) out.push({
        id: 'lead', stake: (last.pnl.sales ?? 0) * 0.05,
        diagnosis: `You lead ${stateLocation(state).district.name}: ${Math.round(((rows[0]?.total ?? 0) / Math.max(1, rows.reduce((x, r) => x + r.total, 0))) * 100)}% of pizza guests here.`,
        answers: [{ text: 'A 5% price rise on your mains', action: { kind: 'price', mult: 1.05 } }],
      });
    }
  }
  if (last && last.services.length && last.services.every((s) => s.rho > 1)) {
    out.push({
      id: 'fullHouse', stake: last.walkAways * 10,
      diagnosis: `You turn guests away at lunch and dinner (${Math.round(last.walkAways)} yesterday). Rivals do not matter today.`,
      answers: [
        { text: 'Raise prices 5%: the queue costs you little', action: { kind: 'price', mult: 1.05 } },
        { text: 'Add capacity: see the Kitchen tab', action: { kind: 'kitchen' } },
        ...(state.delivery?.on ? [] : [{ text: 'Delivery only if the kitchen has room', action: { kind: 'delivery' as const } }]),
      ],
    });
  }
  const d = last?.delivery;
  if (d && state.delivery?.on && (Math.max(d.time.lunch, d.time.dinner) > T.delivery.promise + 10 || d.drepAfter < d.drepBefore - 0.5)) {
    out.push({
      id: 'deliveryOverload', stake: d.accepted * 5,
      diagnosis: `Deliveries took ${Math.round(Math.max(d.time.lunch, d.time.dinner))} minutes at the busiest service: your kitchen was the limit.`,
      answers: [
        { text: 'Lower the throttle so the app pauses sooner', action: { kind: 'delivery' } },
        { text: 'Add oven or prep capacity', action: { kind: 'kitchen' } },
      ],
    });
  }
  const seen = new Set<string>();
  return out.sort((a, b) => b.stake - a.stake).filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).slice(0, 2);
}

const rivalAInline = (state: GameState, rival: Rival, loc: Rival['locations'][number], s: SegmentId): number => rivalA(state, rival, loc, s, state.day);

/** Rivals within reach of any restaurant you own, sorted by guests they took from you this week. */
export function rivalsInReach(state: GameState): { rival: Rival; lost: number }[] {
  const losses = lossesOver(state.history.slice(-7));
  return activeRivals(state).filter((r) => inReach(state, r))
    .map((rival) => ({ rival, lost: losses.find((l) => l.rivalId === rival.id)?.total ?? 0 }))
    .sort((a, b) => b.lost - a.lost);
}

export const ownDistricts = (state: GameState): string[] => [...new Set(ownRestaurants(state).map((o) => o.districtId))];
