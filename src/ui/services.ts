// The Restaurant Scorecard tab (service-deals.md 5): lunch and dinner graded side by side, set menus and lunch promotions.

import { CAMPAIGNS, type CampaignId } from '../data/campaigns';
import { dealsFor, SERVICE_DEALS, type ServiceDealId } from '../data/serviceDeals';
import type { Service } from '../data/types';
import { T } from '../data/tunables';
import type { Grade } from '../sim/deliveryScore';
import { forecastWeek } from '../sim/forecast';
import { stateLocation } from '../sim/location';
import { campaignCost, campaignUnlocked, campaignUnlockText, fatigueOf, isActive, newCampaign, slotsUsed } from '../sim/marketing';
import { dealMissing, missingText, serviceDealId } from '../sim/serviceDeals';
import { restaurantScorecard, type ServiceCard, type ServiceFix, type ServiceKpiId, SERVICE_A } from '../sim/serviceScore';
import type { GameState } from '../sim/state';
import { act, h, money, pct, signed, signedMoney } from './dom';
import type { PanelCtx } from './panels';

/** Campaigns that bring guests to lunch, in the order the tab shows them. */
const LUNCH_CAMPAIGNS: CampaignId[] = ['lunchFlyers', 'lunchCoupons', 'lunchClub'];
const SV_NAME: Record<Service, string> = { lunch: 'Lunch', dinner: 'Dinner' };
/** The Restaurant tab each fix opens; 'promo' stays here. */
export type RestaurantTab = 'menu' | 'kitchen' | 'room' | 'staff';
const FIX_LABEL: Record<Exclude<ServiceFix, 'promo'>, string> = { menu: 'Menu', kitchen: 'Kitchen', room: 'Room', staff: 'Squad' };

const gradeBadge = (g: Grade): HTMLElement => h('span', { class: `grade g-${g}` }, g);

/** A week at the restaurant with these changes: guests and profit after food per service, and profit. */
interface Week { guests: Record<Service, number>; gross: Record<Service, number>; profit: number }
function week(state: GameState, extra: Partial<GameState> = {}): Week {
  const rs = forecastWeek({ ...state, ...extra });
  const out: Week = { guests: { lunch: 0, dinner: 0 }, gross: { lunch: 0, dinner: 0 }, profit: 0 };
  for (const r of rs) {
    out.profit += r.pnl.profit;
    for (const s of r.services) {
      out.guests[s.service] += s.served;
      out.gross[s.service] += (s.sales ?? 0) - (s.food ?? 0);
    }
  }
  return out;
}

const vsNow = (sv: Service, f: Week, now: Week): string =>
  `A week: ${Math.round(f.guests[sv])} ${sv} guests (${signed(f.guests[sv] - now.guests[sv], 0)}), ${signedMoney(f.profit - now.profit)} profit against now.`;

// ---------- Scorecard ----------

function scoreCard(sc: NonNullable<ReturnType<typeof restaurantScorecard>>, go: (t: RestaurantTab) => void): HTMLElement {
  const head = (c: ServiceCard): HTMLElement => h('div', { class: 'svhead' },
    h('span', { class: 'small muted' }, SV_NAME[c.service]),
    h('div', { class: 'score-head' }, h('span', { class: 'big' }, `${c.overall}`), gradeBadge(c.grade),
      h('span', { class: 'small muted' }, `${Math.round(c.guests)} guests a day`)));
  const ids: ServiceKpiId[] = ['filled', 'fulfilled', 'ticket', 'check', 'margin'];
  const cell = (c: ServiceCard, id: ServiceKpiId): HTMLElement[] => {
    const k = c.kpis.find((x) => x.id === id);
    if (!k) return [h('span', { role: 'cell' }), h('span', { role: 'cell' })];
    return [h('b', { role: 'cell', title: `A from ${k.target}` }, k.shown), h('span', { role: 'cell' }, gradeBadge(k.grade))];
  };
  const fixBtn = (id: ServiceKpiId): HTMLElement => {
    const weak = [sc.lunch, sc.dinner].map((c) => c.kpis.find((k) => k.id === id)).filter((k) => k && k.grade !== 'A');
    const fix = weak.sort((a, b) => (a?.score ?? 1) - (b?.score ?? 1))[0]?.fix;
    return fix && fix !== 'promo' ? h('button', { role: 'cell', class: 'small ghost', onclick: () => go(fix) }, FIX_LABEL[fix]) : h('span', { role: 'cell' });
  };
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Restaurant score'), h('span', { class: 'small' }, `last ${sc.days} open day${sc.days === 1 ? '' : 's'}`)),
    h('div', { class: 'svheads' }, head(sc.lunch), head(sc.dinner)),
    sc.days < 3 ? h('div', { class: 'small warn' }, `Only ${sc.days} open day${sc.days === 1 ? '' : 's'} so far: the grades settle after 3 or more.`) : null,
    h('div', { class: 'scoretable svtable', role: 'table' },
      h('div', { class: 'sv-row st-head', role: 'row' }, ...['KPI', 'Lunch', '', 'Dinner', '', ''].map((x) => h('span', { role: 'columnheader' }, x))),
      ...ids.map((id) => {
        const k = sc.lunch.kpis.find((x) => x.id === id);
        return h('div', { class: 'sv-row', role: 'row', title: k?.why ?? '' },
          h('span', { role: 'cell' }, k?.label ?? id), ...cell(sc.lunch, id), ...cell(sc.dinner, id), fixBtn(id));
      })),
    h('div', { class: 'small muted' },
      `Out of 100 per service: seats filled 25, guests served, check and margin 20 each, ticket time 15. A marks: seats ${pct(SERVICE_A.lunch.filled)} at lunch and ${pct(SERVICE_A.dinner.filled)} at dinner, a check of ${SERVICE_A.lunch.check}x and ${SERVICE_A.dinner.check}x your average main. Tap a row for what moves it.`));
}

function focusCard(sc: NonNullable<ReturnType<typeof restaurantScorecard>>, go: (t: RestaurantTab) => void): HTMLElement {
  const f = sc.focus;
  if (!f) return h('div', { class: 'card' }, h('div', { class: 'good' }, 'Lunch and dinner are both at A on every KPI.'));
  return h('div', { class: 'card focus' }, h('h3', null, h('span', null, `🎯 Focus this week: ${f.service}`), gradeBadge(f.grade)),
    h('div', null, h('b', null, `${f.label} at ${f.service}: ${f.shown}`), ` (A from ${f.target}).`),
    h('div', { class: 'small' }, f.why),
    f.fix === 'promo'
      ? h('div', { class: 'small muted' }, `Set menus and ${f.service === 'lunch' ? 'lunch promotions' : 'campaigns'} are below.`)
      : h('div', { class: 'row' }, h('button', { class: 'small primary', onclick: () => go(f.fix as RestaurantTab) }, `Open ${FIX_LABEL[f.fix]}`)));
}

function glance(sc: NonNullable<ReturnType<typeof restaurantScorecard>>): HTMLElement {
  const row = (label: string, f: (c: ServiceCard) => string): HTMLElement[] =>
    [h('span', { role: 'cell' }, label), h('b', { role: 'cell' }, f(sc.lunch)), h('b', { role: 'cell' }, f(sc.dinner))];
  const total = sc.lunch.guests + sc.dinner.guests;
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'Lunch and dinner, a day'), h('span', { class: 'small' }, 'average over the window')),
    h('div', { class: 'glance', role: 'table' },
      h('span', { role: 'columnheader' }), h('span', { role: 'columnheader', class: 'small muted' }, 'Lunch'), h('span', { role: 'columnheader', class: 'small muted' }, 'Dinner'),
      ...row('Guests', (c) => `${Math.round(c.guests)}${total > 0 ? ` (${pct(c.guests / total)})` : ''}`),
      ...row('Sales', (c) => money(c.sales)),
      ...row('After food', (c) => money(c.gross)),
      ...row('On the set menu', (c) => `${Math.round(c.dealGuests)}`),
      ...row('Given away', (c) => money(c.given)),
      ...row('Limit', (c) => (c.bottleneck === 'none' ? 'demand' : c.bottleneck))));
}

// ---------- Set menus ----------

function dealCard(ctx: PanelCtx, sv: Service, now: Week): HTMLElement {
  const state = ctx.state;
  const cur = serviceDealId(state, sv);
  const curMissing = cur ? dealMissing(state, cur) : [];
  const opts: (ServiceDealId | null)[] = [null, ...dealsFor(sv)];
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, sv === 'lunch' ? '🥗 Lunch deal' : '🍷 Dinner menu'), h('span', { class: 'small' }, cur ? SERVICE_DEALS[cur].name : 'none')),
    h('div', { class: 'small muted' }, sv === 'lunch'
      ? 'A set lunch at a fixed price brings the office crowd in and sells starters and desserts at a quiet service. Tables turn a little slower.'
      : 'A 3, 4 or 5 course menu at a set price. Foodies and visitors come for it; every extra course keeps the table longer.'),
    curMissing.length ? h('div', { class: 'small warn' }, `${SERVICE_DEALS[cur as ServiceDealId].name} is paused: ${missingText(curMissing).toLowerCase()}.`) : null,
    h('div', { class: 'fitlist' }, ...opts.map((id) => {
      const deal = id ? SERVICE_DEALS[id] : null;
      const on = cur === id;
      const missing = id ? dealMissing(state, id) : [];
      const f = on || missing.length ? null : week(state, { serviceDeals: { lunch: serviceDealId(state, 'lunch'), dinner: serviceDealId(state, 'dinner'), [sv]: id } });
      return h('div', { class: `fit ${on ? 'installed' : ''}` },
        h('div', { class: 'spread' }, h('b', null, deal?.name ?? 'No set menu'),
          on ? h('span', { class: 'small good' }, '✓ Running')
            : h('button', {
              class: 'small primary', disabled: missing.length > 0,
              onclick: () => act(ctx, { type: 'setServiceDeal', service: sv, deal: id }, deal ? `${deal.name} from the next service` : `No set menu at ${sv}`),
            }, missing.length ? missingText(missing) : deal ? 'Run it' : 'Stop')),
        h('div', { class: 'small' }, deal ? deal.effect : 'Everything à la carte.'),
        deal ? h('div', { class: 'small muted' }, deal.blurb) : null,
        f ? h('div', { class: 'small muted' }, vsNow(sv, f, now)) : null);
    })));
}

// ---------- Lunch promotions ----------

function lunchPromos(ctx: PanelCtx, now: Week): HTMLElement {
  const state = ctx.state;
  const facts = stateLocation(state);
  const active = (state.campaigns ?? []).filter((a) => isActive(a, state.day) || a.renew);
  const slots = slotsUsed(state.campaigns, state.day);
  return h('div', { class: 'card' }, h('h3', null, h('span', null, '📣 Lunch promotions'), h('span', { class: 'small' }, `${slots} of ${T.marketing.maxActive} campaign slots used`)),
    h('div', { class: 'small muted' }, 'Lunch only: they leave dinner as it is. More dinner guests come from the campaigns under Rivals · Marketing.'),
    ...LUNCH_CAMPAIGNS.map((id) => {
      const c = CAMPAIGNS[id];
      const running = active.find((a) => a.id === id);
      const unlocked = campaignUnlocked(state, c);
      const cost = campaignCost(c, facts.footTraffic);
      let preview: string | null = null;
      if (unlocked && !running) {
        const hyp = [...(state.campaigns ?? []).filter((y) => y.id !== id), { ...newCampaign(id, [], state.day, facts), startDay: state.day - 7, endsDay: state.day + 30, spent: 0 }];
        preview = vsNow('lunch', week(state, { campaigns: hyp }), now);
      }
      return h('div', { class: `fit ${running ? 'installed' : ''}` },
        h('div', { class: 'spread' }, h('b', null, c.name), h('span', { class: 'small' }, `${money(cost)} a week`)),
        h('div', { class: 'small' }, c.effect),
        h('div', { class: 'small muted' }, c.blurb),
        preview ? h('div', { class: 'small muted' }, `${preview} Before its cost.`) : null,
        running
          ? h('div', { class: 'row' },
            h('span', { class: 'small good' }, `Running, ${Math.max(0, running.endsDay - state.day)} days left${fatigueOf(running.weeksRunning) < 1 ? ` · seen a lot: x${fatigueOf(running.weeksRunning)}` : ''}`),
            running.renew ? h('button', { class: 'small', onclick: () => act(ctx, { type: 'stopCampaign', campaignId: id }, `${c.name} stops after this run`) }, 'Stop renewing') : h('span', { class: 'small muted' }, 'ends after this run'))
          : h('button', {
            class: 'small primary',
            disabled: !unlocked || state.cash < cost || slots >= T.marketing.maxActive,
            onclick: () => act(ctx, { type: 'startCampaign', campaignId: id, audience: [] }, `${c.name} starts today`),
          }, !unlocked ? campaignUnlockText(c) : state.cash < cost ? `Need ${money(cost - state.cash)} more`
            : slots >= T.marketing.maxActive ? `${T.marketing.maxActive} running, stop one first` : `Start for ${money(cost)}`));
    }));
}

// ---------- The tab ----------

export function scorecardPanel(ctx: PanelCtx, go: (t: RestaurantTab) => void): HTMLElement {
  const state = ctx.state;
  const sc = restaurantScorecard(state);
  const now = week(state);
  return h('div', { class: 'stack' }, h('h2', null, 'Restaurant · Scorecard'),
    ...(sc ? [scoreCard(sc, go), focusCard(sc, go), glance(sc)]
      : [h('div', { class: 'card' }, h('h3', null, 'Restaurant score'), h('div', { class: 'small muted' }, 'After the first day open, lunch and dinner are graded here side by side.'))]),
    dealCard(ctx, 'lunch', now),
    lunchPromos(ctx, now),
    dealCard(ctx, 'dinner', now));
}
