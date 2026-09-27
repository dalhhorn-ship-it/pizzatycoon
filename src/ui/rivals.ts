// The Rivals tab, the Marketing sheet and the coach (competition.md 5.5, 7, 8).

import { CAMPAIGN_IDS, CAMPAIGNS, type CampaignId } from '../data/campaigns';
import { DISTRICTS } from '../data/districts';
import { isMain } from '../data/recipes';
import { ARCHETYPES } from '../data/rivals';
import { SEGMENT_IDS, SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { locationName } from '../sim/chain';
import { rivalSettingsOf } from '../sim/economy';
import { type Command, isUnlocked, unlockText } from '../sim/game';
import { stateLocation } from '../sim/location';
import { type Answer, coach, districtShare, lossesOver, ownDistricts, readRival, rivalsInReach, type Situation, shareTrend } from '../sim/market';
import { audienceMatch, campaignCost, fatigueOf, isActive, matchLabel, mktFor, newCampaign, slotsUsed } from '../sim/marketing';
import { inReach } from '../sim/rivals';
import type { DayReport, GameState, Rival } from '../sim/state';
import { h, modal, money, signed, toast } from './dom';
import { compare } from './impact';
import type { PanelCtx } from './panels';

/** Where coach answers lead. */
export interface Nav {
  tab: (t: 'menu' | 'kitchen' | 'staff' | 'money') => void;
  delivery: () => void;
}

const ui = { district: null as string | null, segFilter: 'all' as SegmentId | 'all' };
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const sm = (x: number): string => `${x >= 0 ? '+' : ''}${money(x)}`;
const stars = (x: number): string => '★'.repeat(Math.round(x)) + '☆'.repeat(Math.max(0, 5 - Math.round(x)));

// ---------- Small charts ----------

function donut(rows: { name: string; color: string; total: number }[]): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 42 42');
  svg.setAttribute('class', 'donut');
  svg.setAttribute('role', 'img');
  const total = rows.reduce((a, r) => a + r.total, 0) || 1;
  svg.setAttribute('aria-label', rows.map((r) => `${r.name} ${pct(r.total / total)}`).join(', '));
  let offset = 25;
  for (const r of rows) {
    const c = document.createElementNS(ns, 'circle');
    const part = (r.total / total) * 100;
    for (const [k, v] of Object.entries({ cx: 21, cy: 21, r: 15.9155, fill: 'none', stroke: r.color, 'stroke-width': 6, 'stroke-dasharray': `${part} ${100 - part}`, 'stroke-dashoffset': offset })) c.setAttribute(k, String(v));
    offset -= part;
    svg.append(c);
  }
  return svg;
}

function sparkLine(values: number[]): HTMLElement {
  if (values.length < 2) return h('div', { class: 'small muted' }, 'The trend appears after two weeks.');
  const max = Math.max(...values, 0.01);
  return h('div', { class: 'bars spark', 'aria-label': `Your share, week by week: ${values.map(pct).join(', ')}` },
    ...values.map((v) => h('div', { title: pct(v), style: `height:${(v / max) * 100}%` })));
}

// ---------- The Rivals tab (7.1) ----------

export function rivalsPanel(ctx: PanelCtx, nav: Nav): HTMLElement {
  const { state } = ctx;
  const on = rivalSettingsOf(state).on;
  const districts = [...ownDistricts(state), ...Object.keys(DISTRICTS).filter((d) => !ownDistricts(state).includes(d))];
  const district = ui.district && DISTRICTS[ui.district] ? ui.district : districts[0] ?? state.districtId;
  const rows = districtShare(state, district);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const mine = rows.filter((r) => r.who === 'you' || r.who === 'own').reduce((a, r) => a + r.total, 0);
  const segBars = h('div', { class: 'stack', style: 'gap:4px' }, ...SEGMENT_IDS.map((s) => {
    const sum = rows.reduce((a, r) => a + r.served[s], 0);
    if (sum < 1) return null;
    return h('div', { class: 'segbar' }, h('span', { class: 'small' }, SEGMENTS[s].name),
      h('div', { class: 'stack-bar', role: 'img', 'aria-label': rows.map((r) => `${r.name} ${pct(r.served[s] / sum)}`).join(', ') },
        ...rows.map((r) => h('div', { style: `width:${(r.served[s] / sum) * 100}%;background:${r.color}`, title: `${r.name}: ${Math.round(r.served[s])}` }))));
  }));
  const reach = rivalsInReach(state);
  const news = (state.marketNews ?? []).filter((n) => ownDistricts(state).includes(n.districtId) || (state.rivals?.find((r) => r.id === n.rivalId) && inReach(state, state.rivals.find((r) => r.id === n.rivalId) as Rival)))
    .slice(-12).reverse();
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Rivals'), h('button', { class: 'small', onclick: () => openMarketing(ctx) }, '📣 Marketing')),
    on ? null : h('div', { class: 'card' }, h('div', { class: 'small' }, 'Live rivals are off: competition is a steady background number per neighbourhood. Turn them on under ⚙ Settings, Competition. Marketing works either way.')),
    h('div', { class: 'seg wrap' }, ...districts.map((d) => h('button', { class: d === district ? 'on' : '', onclick: () => { ui.district = d; ctx.rerender(); } }, DISTRICTS[d]?.name ?? d))),
    h('div', { class: 'card' },
      h('h3', null, h('span', null, 'Market share'), h('span', { class: 'small' }, total ? `${pct(mine / total)} of ${Math.round(total)} pizza guests a week` : 'no data yet')),
      total ? h('div', { class: 'share-row' }, donut(rows), h('div', { class: 'kv' }, ...rows.slice(0, 8).flatMap((r) => [
        h('span', null, h('i', { class: 'lg m', style: `background:${r.color}` }), ` ${r.name}`), h('b', null, pct(r.total / total)),
      ]))) : null,
      segBars,
      district === state.districtId ? h('div', null, h('div', { class: 'small muted' }, 'Your share of pizza guests here, week by week'), sparkLine(shareTrend(state))) : null),
    coachCard(ctx, nav),
    on ? h('h3', null, `Rivals within reach (${reach.length})`) : null,
    ...reach.map(({ rival, lost }) => rivalCard(ctx, rival, lost)),
    news.length ? h('div', { class: 'card' }, h('h3', null, 'News'), ...news.map((n) => h('div', { class: 'small' }, h('span', { class: 'muted' }, `Day ${n.day} · `), n.text))) : null);
}

function dots(n: number): string {
  const k = Math.round(n * 3);
  return '●'.repeat(k) + '○'.repeat(3 - k);
}

/** A rival card (7.2): what is public, what is estimated, and what a mystery diner tells you. */
function rivalCard(ctx: PanelCtx, rival: Rival, lost: number): HTMLElement {
  const state = ctx.state;
  const r = readRival(state, rival);
  const a = ARCHETYPES[rival.archetype];
  const loc = rival.locations[0];
  const cheaper = (x: number): string => (x < 1 ? `${Math.round((1 - x) * 100)}% cheaper` : `${Math.round((x - 1) * 100)}% dearer`);
  const priceText = r.mystery ? `${cheaper(r.priceVsYou[0])} than you` : `About ${cheaper(r.priceVsYou[0])} to ${cheaper(r.priceVsYou[1])} than you`;
  const overlap = [...SEGMENT_IDS].sort((x, y) => r.served[y] - r.served[x]).slice(0, 2);
  const lossBySeg = lossesOver(state.history.slice(-7)).find((l) => l.rivalId === rival.id)?.bySegment;
  const topLoss = lossBySeg ? [...SEGMENT_IDS].sort((x, y) => lossBySeg[y] - lossBySeg[x])[0] : undefined;
  const maxServed = Math.max(1, ...SEGMENT_IDS.map((s) => r.served[s]));
  const canDine = (rival.mysteryUntil ?? 0) - T.rivals.mysteryDinerDays + 7 <= state.day;
  return h('div', { class: 'card rcard' },
    h('h3', null, h('span', null, h('span', { class: 'rlogo', style: `border-color:${a.color}` }, a.letter), ` ${rival.name}`), h('span', { class: 'small' }, stars(r.stars))),
    h('div', { class: 'small muted' }, `${rival.owner} · "${rival.motto}" · since day ${Math.max(1, rival.founded)} · ${rival.locations.map((l) => VENUES[l.venueId]?.name).join(', ')}`),
    h('div', { class: 'kv' },
      h('span', null, 'Competes on'), h('b', null, r.known ? `${a.name}: ${a.competesOn.toLowerCase()}` : 'Not sure yet'),
      h('span', null, 'Price, quality, marketing'), h('b', null, r.known ? `${dots(a.style.price)} ${dots(a.style.quality)} ${dots(a.style.marketing)}` : '? ? ?'),
      h('span', null, 'Prices'), h('b', null, priceText),
      h('span', null, 'A margherita'), h('b', null, `about ${money(r.mainPrice * 0.95, true)}`),
      h('span', null, 'Pizza quality'), h('b', null, `${r.quality[0] === r.quality[1] ? r.quality[0] : `${r.quality[0]} to ${r.quality[1]}`} (yours ${Math.round(r.yourQuality)})`),
      h('span', null, 'Speed at lunch'), h('b', null, r.speed),
      h('span', null, 'Trend'), h('b', { class: r.trend === 'Struggling' ? 'bad' : r.trend === 'Growing' ? 'warn' : '' }, r.trend),
      h('span', null, 'Took from you this week'), h('b', { class: lost >= 1 ? 'bad' : '' }, `${Math.round(lost)} guests${topLoss && lost >= 1 ? `, mostly ${SEGMENTS[topLoss].name.toLowerCase()}` : ''}`)),
    loc?.campaigns.filter((c) => state.day < c.endsDay).length
      ? h('div', { class: 'chips' }, ...(loc?.campaigns ?? []).filter((c) => state.day < c.endsDay).map((c) => h('span', { class: 'chip' }, `${CAMPAIGNS[c.id]?.name}${c.audience.length ? `: ${c.audience.map((s) => SEGMENTS[s].name).join(', ')}` : ''}`)))
      : null,
    loc?.delivery ? h('div', { class: 'small' }, `Delivers · ${stars(loc.drep / 20)}`) : null,
    h('div', { class: 'small muted' }, `Their guests: mostly ${overlap.map((s) => SEGMENTS[s].name.toLowerCase()).join(' and ')}.`),
    h('div', { class: 'mini-bars' }, ...SEGMENT_IDS.map((s) => h('div', { class: 'mb', title: `${SEGMENTS[s].name}: ${Math.round(r.served[s])}` }, h('i', { style: `height:${(r.served[s] / maxServed) * 100}%` }), h('span', null, SEGMENTS[s].name.slice(0, 3))))),
    r.mystery
      ? h('div', { class: 'impact' }, `Mystery diner report (${(rival.mysteryUntil ?? 0) - state.day} days left): satisfaction ${Math.round(r.satisfaction)}; guests say the weakest part is ${r.lowest || 'nothing much'}.`)
      : h('button', { class: 'small', disabled: !canDine || state.cash < T.rivals.mysteryDinerPrice, onclick: () => act(ctx, { type: 'mysteryDiner', rivalId: rival.id }) }, `Mystery diner ${money(T.rivals.mysteryDinerPrice)}`));
}

const act = (ctx: PanelCtx, cmd: Command, ok?: string): boolean => {
  const err = ctx.dispatch(cmd);
  if (err) toast(err, 'warn');
  else if (ok) toast(ok, 'good');
  return !err;
};

// ---------- The coach (7.5) ----------

function previewFor(state: GameState, a: Answer): number | null {
  const x = a.action;
  if (x.kind === 'price') {
    const hyp = { ...state, recipes: state.recipes.map((r) => (r.onMenu && isMain(r.kind) ? { ...r, price: Math.round(r.price * x.mult * 2) / 2 } : r)) };
    return compare(state, hyp).profit * 7;
  }
  if (x.kind === 'campaign') {
    const c = CAMPAIGNS[x.id];
    if (!c) return null;
    const facts = stateLocation(state);
    const hyp = { ...state, campaigns: [...(state.campaigns ?? []).filter((y) => y.id !== x.id), { ...newCampaign(x.id, x.audience, state.day, facts), startDay: state.day - 1, endsDay: state.day + 30 }] };
    return compare(state, hyp).profit * 7 - campaignCost(c, facts.footTraffic) * (7 / c.runDays);
  }
  return null;
}

/** Up to two situations with 1 to 3 answers, each with its weekly estimate and a Do it button. */
export function coachCard(ctx: PanelCtx, nav: Nav, situations: Situation[] = coach(ctx.state)): HTMLElement | null {
  if (!situations.length) return null;
  const state = ctx.state;
  return h('div', { class: 'card' },
    h('h3', null, 'Marta, your market coach'),
    h('div', { class: 'small muted' }, 'She suggests; nothing changes until you press Do it and confirm.'),
    ...situations.map((sit) => {
      const answers = sit.answers.map((a) => ({ a, gain: previewFor(state, a) }));
      const best = answers.filter((x) => x.gain !== null && x.gain > 0).sort((x, y) => (y.gain ?? 0) - (x.gain ?? 0))[0];
      return h('div', { class: 'stack coach', style: 'gap:6px' },
        h('div', { class: 'small' }, h('b', null, sit.diagnosis)),
        ...answers.map(({ a, gain }) => h('div', { class: 'line' },
          h('div', null, h('div', { class: 'small' }, a.text, best?.a === a ? h('span', { class: 'chip up' }, 'Recommended') : null),
            gain !== null ? h('div', { class: `small ${gain < 0 ? 'bad' : 'muted'}` }, `about ${sm(gain)} a week`) : null),
          h('button', { class: 'small', onclick: () => doIt(ctx, nav, a) }, a.action.kind === 'hold' ? 'Noted' : 'Do it'))));
    }));
}

function doIt(ctx: PanelCtx, nav: Nav, a: Answer): void {
  const x = a.action;
  switch (x.kind) {
    case 'price': return confirmPrice(ctx, x.mult);
    case 'campaign': return openMarketing(ctx, { id: x.id, audience: x.audience });
    case 'tierUp': return nav.tab('menu');
    case 'kitchen': return nav.tab('kitchen');
    case 'course': return nav.tab('staff');
    case 'delivery': return nav.delivery();
    case 'hold': toast('Holding steady.', 'info');
  }
}

/** The change prefilled, with its preview, to confirm (never applied on its own). */
function confirmPrice(ctx: PanelCtx, mult: number): void {
  const state = ctx.current();
  const mains = state.recipes.filter((r) => r.onMenu && isMain(r.kind));
  const hyp = { ...state, recipes: state.recipes.map((r) => (r.onMenu && isMain(r.kind) ? { ...r, price: Math.round(r.price * mult * 2) / 2 } : r)) };
  const d = compare(state, hyp);
  let close = (): void => {};
  close = modal(h('div', { class: 'stack' },
    h('h2', null, `Mains ${mult < 1 ? `${Math.round((1 - mult) * 100)}% cheaper` : `${Math.round((mult - 1) * 100)}% dearer`}`),
    h('div', { class: 'kv' }, ...mains.flatMap((r) => [h('span', null, r.name), h('b', null, `${money(r.price, true)} → ${money(Math.round(r.price * mult * 2) / 2, true)}`)])),
    h('div', { class: 'impact' }, `About ${signed(d.covers, 1)} guests and ${sm(d.profit)} a day.`),
    h('div', { class: 'row', style: 'justify-content:flex-end' },
      h('button', { onclick: () => close() }, 'Cancel'),
      h('button', { class: 'primary', onclick: () => {
        for (const r of mains) ctx.dispatch({ type: 'setPrice', recipeId: r.id, price: Math.round(r.price * mult * 2) / 2 });
        close();
        toast('Prices changed.', 'good');
      } }, 'Apply'))), { onClose: () => undefined });
}

// ---------- The Marketing sheet (5.5) ----------

export function openMarketing(ctx: PanelCtx, prefill?: { id: CampaignId; audience: SegmentId[] }): void {
  let close = (): void => {};
  const chosen: Record<string, SegmentId[]> = {};
  if (prefill) chosen[prefill.id] = [...prefill.audience];
  const render = (): HTMLElement => {
    const state = ctx.current();
    const facts = stateLocation(state);
    const active = (state.campaigns ?? []).filter((a) => isActive(a, state.day) || a.renew);
    const slots = slotsUsed(state.campaigns, state.day);
    const lastRho = state.history.at(-1)?.services ?? [];
    const dinnerFull = lastRho.some((s) => s.service === 'dinner' && s.rho > 1);
    const card = (id: CampaignId): HTMLElement | null => {
      const c = CAMPAIGNS[id];
      if (!c) return null;
      const running = active.find((a) => a.id === id);
      const needsDelivery = c.unlock === 'delivery';
      const unlocked = needsDelivery ? !!state.delivery?.on && state.delivery.mode !== 'own' : isUnlocked(state, c.unlock as never);
      const audience = c.audience === 'choose' ? (running?.audience ?? chosen[id] ?? []) : [];
      const cost = campaignCost(c, facts.footTraffic);
      const match = audienceMatch(c, audience, facts.shares);
      const reachable = SEGMENT_IDS.filter((s) => (c.audience === 'choose' ? (c.reach?.[s] ?? 0) > 0 : (c.audience[s] ?? 0) > 0));
      let preview: HTMLElement | null = null;
      if (unlocked && !running && (c.audience !== 'choose' || audience.length) && (c.lift > 0 || c.id === 'loyalty')) {
        const hyp = { ...state, campaigns: [...(state.campaigns ?? []).filter((y) => y.id !== id), { ...newCampaign(id, audience, state.day, facts), startDay: state.day - 1, endsDay: state.day + 30, spent: 0 }] };
        const d = compare(state, hyp);
        preview = h('div', { class: 'impact' }, `About ${signed(d.covers, 1)} guests a day, ${sm(d.profit * 7 - cost * (7 / c.runDays))} a week after its cost.`,
          dinnerFull ? h('div', { class: 'small warn' }, 'Your dinner is full: most of these guests would be turned away.') : null);
      }
      const segChip = (s: SegmentId): HTMLElement => {
        const on = audience.includes(s);
        return h('button', {
          class: `chip seg-${s} ${on ? 'on' : ''}`, 'aria-pressed': on ? 'true' : 'false', disabled: c.audience !== 'choose' || !!running,
          onclick: () => {
            const cur = chosen[id] ?? [];
            chosen[id] = on ? cur.filter((x) => x !== s) : [...cur, s].slice(-(c.choose ?? 1));
            rerender();
          },
        }, `${SEGMENTS[s].name} ${pct(facts.shares[s])}`);
      };
      const label = matchLabel(match);
      return h('div', { class: `card ${running ? '' : unlocked ? '' : 'off'}` },
        h('h3', null, h('span', null, c.name), h('span', { class: 'small' }, `${money(cost)}${c.runDays === 7 && c.renews ? ' a week' : ` for ${c.runDays} days`}`)),
        h('div', { class: 'small' }, c.effect),
        h('div', { class: 'small muted' }, c.blurb),
        reachable.length ? h('div', { class: 'chips' }, ...reachable.map(segChip)) : null,
        c.lift > 0 && (c.audience !== 'choose' || audience.length)
          ? h('div', { class: `small match ${label === 'Great fit' ? 'good' : label === 'Poor' ? 'bad' : ''}` }, `Audience match: ${label} (${pct(match)} of the people here)`)
          : c.audience === 'choose' ? h('div', { class: 'small muted' }, `Pick up to ${c.choose} crowd${(c.choose ?? 1) > 1 ? 's' : ''} to reach.`) : null,
        preview,
        running
          ? h('div', { class: 'row' },
            h('span', { class: 'small good' }, `Running, ${Math.max(0, running.endsDay - state.day)} days left${fatigueOf(running.weeksRunning) < 1 ? ` · people have seen this a lot: x${fatigueOf(running.weeksRunning)}` : ''}`),
            running.renew ? h('button', { class: 'small', onclick: () => { if (act(ctx, { type: 'stopCampaign', campaignId: id })) rerender(); } }, 'Stop renewing') : h('span', { class: 'small muted' }, 'ends after this run'))
          : h('button', {
            class: 'small primary',
            disabled: !unlocked || state.cash < cost || (!c.everyRestaurant && slots >= T.marketing.maxActive) || (c.audience === 'choose' && !audience.length),
            onclick: () => { if (act(ctx, { type: 'startCampaign', campaignId: id, audience }, `${c.name} starts today`)) rerender(); },
          }, !unlocked ? (needsDelivery ? 'Needs platform delivery' : unlockText(c.unlock as never)) : state.cash < cost ? `Need ${money(cost - state.cash)} more`
            : !c.everyRestaurant && slots >= T.marketing.maxActive ? `${T.marketing.maxActive} running, stop one first` : `Start for ${money(cost)}`));
    };
    // Extra guests so far from what is running (5.5): served x (1 - 1 / lift) on the segments reached.
    const lastReport = state.history.at(-1);
    const extra = lastReport?.market ? SEGMENT_IDS.reduce((x, s) => x + (lastReport.market?.served[s] ?? 0) * (1 - 1 / mktFor(state.campaigns, s, lastReport.day)), 0) : 0;
    const order = prefill ? [prefill.id, ...CAMPAIGN_IDS.filter((x) => x !== prefill.id)] : CAMPAIGN_IDS;
    return h('div', { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, 'Marketing'), h('button', { class: 'small', onclick: () => close() }, 'Close')),
      h('div', { class: 'small muted' }, `${locationName(state)}: ${slots} of ${T.marketing.maxActive} campaign slots used. Campaigns start at the next service and are paid up front. A campaign only works on the crowds it reaches, so aim at the people who walk past here.`),
      active.length ? h('div', { class: 'small' }, `Yesterday campaigns brought about ${Math.round(extra)} extra guests.`) : null,
      ...order.map(card));
  };
  const host = h('div');
  const rerender = (): void => host.replaceChildren(render());
  rerender();
  close = modal(host, { onClose: () => ctx.rerender(), wide: true });
}

// ---------- Reports (8) ----------

/** Week report: "Competition this week" (8.2). */
export function weekCompetitionCard(reports: readonly DayReport[], state: GameState, ctx: PanelCtx, nav: Nav): HTMLElement | null {
  const on = rivalSettingsOf(state).on;
  const losses = lossesOver(reports);
  const lostTotal = losses.reduce((a, l) => a + l.total, 0);
  const campaigns = reports.reduce((x, r) => x + (r.pnl.marketing ?? 0), 0);
  if (!on && campaigns <= 0) return null;
  const rows = districtShare(state, state.districtId);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const trend = shareTrend(state);
  const share = trend.at(-1) ?? 0;
  const prev = trend.at(-2);
  const first = reports[0]?.day ?? state.day - 7;
  const moves = (state.marketNews ?? []).filter((n) => n.day >= first && (ownDistricts(state).includes(n.districtId) || !!state.rivals?.find((r) => r.id === n.rivalId && inReach(state, r))));
  const opened = moves.find((n) => n.kind === 'opening');
  const top = losses[0];
  const topRival = state.rivals?.find((r) => r.id === top?.rivalId);
  const headline = opened
    ? `A busy week: ${opened.text} You lost about ${Math.round(lostTotal)} guests to rivals.`
    : lostTotal >= 1 && topRival ? `Rivals took about ${Math.round(lostTotal)} of your guests this week, most of them to ${topRival.name}.` : on ? 'A quiet week in the market.' : '';
  const segs = SEGMENT_IDS.filter((s) => losses.some((l) => l.bySegment[s] >= 0.5));
  const extra = reports.reduce((x, r) => x + (r.market ? SEGMENT_IDS.reduce((y, s) => y + (r.market?.served[s] ?? 0) * (1 - 1 / mktFor(state.campaigns, s, r.day)), 0) : 0), 0);
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Competition this week'), on && total ? h('span', { class: 'small' }, `your share ${pct(share)}${prev !== undefined ? ` (${signed(Math.round((share - prev) * 100))})` : ''}`) : null),
    headline ? h('div', { class: 'small' }, h('b', null, headline)) : null,
    losses.length ? h('div', { class: 'impact-table', role: 'table' },
      h('div', { class: 'it-row it-head', role: 'row' }, h('span', { role: 'columnheader' }, 'Rival'), ...segs.map((s) => h('span', { role: 'columnheader' }, SEGMENTS[s].name.slice(0, 4))), h('span', { role: 'columnheader' }, 'Total')),
      ...losses.slice(0, 6).map((l) => h('div', { class: 'it-row', role: 'row' },
        h('span', { role: 'cell' }, state.rivals?.find((r) => r.id === l.rivalId)?.name ?? '?'),
        ...segs.map((s) => h('span', { role: 'cell', class: l.bySegment[s] >= 0.5 ? 'bad' : 'muted' }, l.bySegment[s] >= 0.5 ? `-${Math.round(l.bySegment[s])}` : '·')),
        h('b', { role: 'cell', class: 'bad' }, `-${Math.round(l.total)}`)))) : null,
    moves.length ? h('div', { class: 'stack', style: 'gap:2px' }, h('b', { class: 'small' }, 'Moves this week'), ...moves.slice(-6).map((n) => h('div', { class: 'small' }, `• ${n.text}`))) : null,
    campaigns > 0 ? h('div', { class: 'small' }, `Your marketing: ${money(campaigns)} spent, about ${Math.round(extra)} extra guests.`) : null,
    coachCard(ctx, nav));
}

/** One line for the day report. */
export { lossLine } from '../sim/market';

export const marketDistrictName = (state: GameState): string => DISTRICTS[state.districtId]?.name ?? '';
