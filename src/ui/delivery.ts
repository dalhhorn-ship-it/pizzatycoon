// The Delivery tab (delivery-tab.md 5): status strip and setup, then Promotion, Menu & deals, Fleet and Scorecard.

import { CAMPAIGNS, type CampaignId } from '../data/campaigns';
import { T } from '../data/tunables';
import { forecastSaturday, forecastWeek } from '../sim/forecast';
import {
  audienceOf, catchment, DEAL_DAYS_NAMES, deliveryMissing, fleetOf, hasPacking, MIN_ORDER_NAMES, minOrderOf, MODE_BLURB, MODE_NAMES,
  ridersNeeded, ridersToday, VEHICLE_KINDS, vehicleCount, vehicleSpec, ZONE_BLURB, ZONE_NAMES, zoneOf, dealDaysOf,
} from '../sim/delivery';
import { DELIVERY_DEAL_IDS, DELIVERY_DEALS } from '../data/deliveryDeals';
import { SEGMENTS } from '../data/segments';
import type { SegmentId, Service } from '../data/types';
import { deliveryTips } from '../sim/deliveryAdvice';
import { deliveryDays, deliveryScorecard, type DeliveryTabId, type Grade, SCORE_MIN_DAYS } from '../sim/deliveryScore';
import { stateLocation } from '../sim/location';
import { campaignCost, campaignUnlocked, campaignUnlockText, fatigueOf, isActive, newCampaign, slotsUsed } from '../sim/marketing';
import { onRota } from '../sim/staff';
import type { DealDays, DeliveryDay, DeliveryMode, DeliveryState, DeliveryZone, GameState, MinOrder, ServiceReport } from '../sim/state';
import { act, h, money, pct, signed, signedMoney, stars } from './dom';
import type { PanelCtx } from './panels';

export type { DeliveryTabId };

export const DELIVERY_TABS: [DeliveryTabId, string][] = [['promotion', 'Promotion'], ['menu', 'Menu & deals'], ['fleet', 'Fleet'], ['score', 'Scorecard']];

const MODES: DeliveryMode[] = ['platform', 'marketplace', 'own'];
/** Three presets instead of a slider (cleanup sprint 5): what each protects, in words. */
const PRESETS: { throttle: number | null; name: string; blurb: string }[] = [
  { throttle: 0.7, name: 'Protect rating', blurb: 'The app pauses at 70% kitchen load: fast deliveries, more orders refused.' },
  { throttle: 0.8, name: 'Balanced', blurb: 'The app pauses at 80% kitchen load: the default.' },
  { throttle: null, name: 'Max orders', blurb: 'The app never pauses: every order is taken, and a busy kitchen gets slow, late and refunded.' },
];
/** Campaigns that bring delivery orders, in the order the Promotion tab shows them. */
const PROMO_CAMPAIGNS: CampaignId[] = ['promotedListing', 'appVoucher', 'doorHangers', 'foodInfluencer', 'flyers'];

type Busy = { day: DeliveryDay | undefined; profit: number; services: ServiceReport[] };

/** A busy day (Saturday) with these delivery settings, for the previews. */
function busyDay(state: GameState, d: Partial<DeliveryState>, extra: Partial<GameState> = {}): Busy {
  const r = forecastSaturday({ ...state, ...extra, delivery: { ...(state.delivery as DeliveryState), ...d } });
  return { day: r.delivery, profit: r.pnl.profit, services: r.services };
}

/** A whole week with these delivery settings, for settings that change by weekday (deal days). */
function busyWeek(state: GameState, d: Partial<DeliveryState>): { delivered: number; profit: number } {
  const rs = forecastWeek({ ...state, delivery: { ...(state.delivery as DeliveryState), ...d } });
  return { delivered: rs.reduce((x, r) => x + (r.delivery?.delivered ?? 0), 0), profit: rs.reduce((x, r) => x + r.pnl.profit, 0) };
}

/** "On a Saturday: 42 orders (+5), 31 min at dinner, +$40 profit against now." */
function vsNow(f: Busy, now: Busy): string | null {
  if (!f.day || !now.day) return null;
  return `On a Saturday: ${Math.round(f.day.delivered)} orders (${signed(f.day.delivered - now.day.delivered, 0)}), ${Math.round(f.day.time.dinner)} min at dinner, ${signedMoney(f.profit - now.profit)} profit against now.`;
}

const STAGE_FIX: Record<string, string> = {
  oven: 'a bigger or faster oven (a conveyor oven suits delivery)',
  prep: 'another prep station or a cook',
  cold: 'more fridge space for dough',
};

/** When the app turns many orders away on a busy day, name the kitchen stage that limits it (competition.md 6.11). */
function kitchenLimitLine(b: Busy): string | null {
  const d = b.day;
  if (!d || d.wanted < 5 || d.refused < 0.2 * d.wanted) return null;
  const dinner = b.services.find((x) => x.service === 'dinner');
  if (!dinner) return null;
  const stages = (['oven', 'prep', 'cold'] as const).map((k) => [k, dinner.stages[k] ?? Infinity] as const).sort((x, y) => x[1] - y[1]);
  const [limit] = stages[0] ?? ['oven'];
  return `Your kitchen is the limit: on a Saturday the app wanted ${Math.round(d.wanted)} orders and you could take ${Math.round(d.accepted)}. The ${limit === 'cold' ? 'dough supply' : limit} sets the pace; ${STAGE_FIX[limit]} would take more.`;
}

const compact = (xs: readonly (HTMLElement | null)[]): HTMLElement[] => xs.filter((x): x is HTMLElement => !!x);

const lastDay = (state: GameState): DeliveryDay | undefined => [...state.history].reverse().find((r) => r.open && r.delivery)?.delivery;

/** A segmented choice with a title (the Saturday preview) on every option. */
function choice<X extends string | number | null>(items: { v: X; label: string; title?: string }[], cur: X, pick: (x: X) => void): HTMLElement {
  return h('div', { class: 'seg wrap' }, ...items.map((it) => h('button', {
    class: cur === it.v ? 'on' : '', 'aria-pressed': cur === it.v ? 'true' : 'false', title: it.title, onclick: () => pick(it.v),
  }, it.label)));
}

// ---------- Status strip and setup ----------

/** Mode, rating, audience, Top rated and last profit, with Pause (delivery-tab.md 5). */
function statusStrip(ctx: PanelCtx, d: DeliveryState): HTMLElement {
  const last = lastDay(ctx.state);
  const trend = last ? last.drepAfter - last.drepBefore : 0;
  const t = T.delivery;
  return h('div', { class: 'card dstatus' },
    h('div', { class: 'dstat-row' },
      h('div', { class: 'dstat' }, h('span', { class: 'small muted' }, 'Rating'), h('b', null, `${d.drep.toFixed(0)} ${trend > 0.05 ? '↑' : trend < -0.05 ? '↓' : ''}`), h('span', { class: 'small stars' }, stars(d.drep))),
      h('div', { class: 'dstat' }, h('span', { class: 'small muted' }, 'Audience'), h('b', { class: audienceOf(d) < 0.25 ? 'warn' : '' }, pct(audienceOf(d))), h('span', { class: 'small muted' }, 'know you deliver')),
      h('div', { class: 'dstat' }, h('span', { class: 'small muted' }, 'Top rated'), h('b', { class: d.topRated ? 'good' : '' }, d.topRated ? 'Yes' : `${d.topRatedDays}/${t.topRatedDays}`),
        h('span', { class: 'small muted' }, d.topRated ? `+${Math.round((t.topRatedBoost - 1) * 100)}% orders` : `days at ${t.topRatedDrep}`)),
      h('div', { class: 'dstat' }, h('span', { class: 'small muted' }, 'Last day'), h('b', { class: last ? (last.profit >= 0 ? 'good' : 'bad') : '' }, last ? money(last.profit) : '·'),
        h('span', { class: 'small muted' }, last ? `${Math.round(last.delivered)} orders` : 'no orders yet'))),
    h('div', { class: 'spread' },
      h('span', { class: 'small' }, `${MODE_NAMES[d.mode]} · zone ${ZONE_NAMES[zoneOf(d)].toLowerCase()}${d.deal ? ` · ${DELIVERY_DEALS[d.deal].name}` : ''}`),
      h('button', { class: 'small', onclick: () => act(ctx, { type: 'stopDelivery' }) }, 'Pause delivery')));
}

/** Before delivery runs: what is missing, the packing station, then the three modes (AC-315). */
function setupView(ctx: PanelCtx): HTMLElement | null {
  const state = ctx.state;
  const d = state.delivery;
  if (d?.on && hasPacking(state)) return null;
  const missing = deliveryMissing(state);
  const steps = [
    { done: state.rep >= T.delivery.unlockRep, text: `Reach 3 stars (reputation ${T.delivery.unlockRep}); you are at ${state.rep.toFixed(0)}` },
    { done: state.daysOpen >= T.delivery.unlockDays, text: `Be open ${T.delivery.unlockDays} days; ${state.daysOpen} so far` },
    { done: hasPacking(state), text: `Place a Packing Station (${money(T.delivery.packingStation)}) in the kitchen` },
    { done: !!d?.on, text: 'Choose how orders reach the door' },
  ];
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, '🛵 Start delivering'),
      h('div', { class: 'small muted' }, 'Delivery brings orders from your neighbourhood and the ones next to it, without using a seat. It shares your oven and prep line with the dining room and has its own rating.'),
      h('div', { class: 'stack', style: 'gap:4px' }, ...steps.map((s) => h('div', { class: `small ${s.done ? 'good' : ''}` }, `${s.done ? '✓' : '○'} ${s.text}`))),
      d && !d.on ? h('div', { class: 'small muted' }, `Paused. Delivery rating ${stars(d.drep)} (${d.drep.toFixed(0)}).`) : null),
    !missing.length && hasPacking(state)
      ? h('div', { class: 'card' }, h('h3', null, 'How orders reach the door'),
        ...MODES.map((m) => h('div', { class: 'line mode spread' },
          h('div', null, h('b', null, MODE_NAMES[m]), h('div', { class: 'small muted' }, MODE_BLURB[m])),
          h('button', { class: 'small primary', onclick: () => act(ctx, { type: 'startDelivery', mode: m }, 'Delivery starts today') }, 'Start'))))
      : h('div', { class: 'small muted' }, 'Students, families and professionals order in most; foodies and tourists rarely do.'));
}

// ---------- Promotion (5.1) ----------

function funnel(state: GameState, d: DeliveryState, last: DeliveryDay | undefined): HTMLElement {
  const facts = stateLocation(state);
  const reach = catchment(facts.district.id, facts.footTraffic, T.delivery.zones[zoneOf(d)].adjacent);
  const aud = audienceOf(d);
  const steps: { label: string; n: number; note: string; weak: boolean }[] = [
    { label: 'People in your zone', n: reach, note: ZONE_NAMES[zoneOf(d)], weak: false },
    { label: 'Know you deliver', n: reach * aud, note: pct(aud), weak: aud < 0.25 },
  ];
  if (last) {
    steps.push(
      { label: 'Wanted to order', n: last.wanted, note: 'last day', weak: false },
      { label: 'Accepted', n: last.accepted, note: last.wanted > 0 ? pct(last.accepted / last.wanted) : '', weak: last.wanted > 0 && last.refused > 0.15 * last.wanted },
      { label: 'Delivered', n: last.delivered, note: last.accepted > 0 ? pct(last.delivered / last.accepted) : '', weak: last.accepted > 0 && last.cancelled > 0.05 * last.accepted },
    );
  }
  const max = Math.max(1, ...steps.map((s) => s.n));
  const weak = steps.find((s) => s.weak);
  const noRiders = d.mode !== 'platform' && ridersToday(state).onShift === 0;
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'Audience funnel'), h('span', { class: 'small' }, 'from people to orders')),
    h('div', { class: 'funnel' }, ...steps.map((s) => h('div', { class: `fstep ${s.weak ? 'weak' : ''}` },
      h('span', { class: 'small' }, s.label),
      h('div', { class: 'fbar' }, h('i', { style: `width:${Math.max(2, Math.sqrt(s.n / max) * 100)}%` })),
      h('b', { class: 'small' }, Math.round(s.n).toLocaleString('en-US')),
      h('span', { class: 'small muted' }, s.note)))),
    weak ? h('div', { class: 'small warn' }, weak.label === 'Know you deliver'
      ? 'The weakest step: too few people know you deliver. Delivery campaigns below build the audience fast.'
      : noRiders ? 'The weakest step: no rider with a vehicle is on shift, so no order can be taken. Hire riders and buy vehicles under Fleet.'
        : weak.label === 'Accepted' ? 'The weakest step: the kitchen turns orders away. See the kitchen limit under Fleet.'
        : 'The weakest step: accepted orders are cancelled. More riders or a lower kitchen limit under Fleet.') : null,
    h('div', { class: 'small muted' }, 'The audience starts tiny, grows slowly by word of mouth and fast with delivery campaigns, and fades a little every day when nobody hears from you.'));
}

function promoCampaigns(ctx: PanelCtx, now: Busy): HTMLElement {
  const state = ctx.state;
  const facts = stateLocation(state);
  const active = (state.campaigns ?? []).filter((a) => isActive(a, state.day) || a.renew);
  const slots = slotsUsed(state.campaigns, state.day);
  return h('div', { class: 'card' }, h('h3', null, h('span', null, '📣 Delivery campaigns'), h('span', { class: 'small' }, `${slots} of ${T.marketing.maxActive} campaign slots used`)),
    ...PROMO_CAMPAIGNS.map((id) => {
      const c = CAMPAIGNS[id];
      const running = active.find((a) => a.id === id);
      const unlocked = campaignUnlocked(state, c);
      const cost = campaignCost(c, facts.footTraffic);
      let preview: string | null = null;
      if (unlocked && !running) {
        const hyp = [...(state.campaigns ?? []).filter((y) => y.id !== id), { ...newCampaign(id, [], state.day, facts), startDay: state.day - 1, endsDay: state.day + 30, spent: 0 }];
        preview = vsNow(busyDay(state, {}, { campaigns: hyp }), now);
      }
      return h('div', { class: `fit ${running ? 'installed' : ''}` },
        h('div', { class: 'spread' }, h('b', null, c.name), h('span', { class: 'small' }, `${money(cost)}${c.runDays === 7 && c.renews ? ' a week' : ` for ${c.runDays} days`}`)),
        h('div', { class: 'small' }, c.effect),
        h('div', { class: 'small muted' }, c.blurb),
        preview ? h('div', { class: 'small muted' }, `${preview} Before its cost.`) : null,
        running
          ? h('div', { class: 'row' },
            h('span', { class: 'small good' }, `Running, ${Math.max(0, running.endsDay - state.day)} days left${fatigueOf(running.weeksRunning) < 1 ? ` · seen a lot: x${fatigueOf(running.weeksRunning)}` : ''}`),
            running.renew ? h('button', { class: 'small', onclick: () => act(ctx, { type: 'stopCampaign', campaignId: id }, `${c.name} stops after this run`) }, 'Stop renewing') : h('span', { class: 'small muted' }, 'ends after this run'))
          : h('button', {
            class: 'small primary',
            disabled: !unlocked || state.cash < cost || (!c.everyRestaurant && slots >= T.marketing.maxActive),
            onclick: () => act(ctx, { type: 'startCampaign', campaignId: id, audience: [] }, `${c.name} starts today`),
          }, !unlocked ? campaignUnlockText(c) : state.cash < cost ? `Need ${money(cost - state.cash)} more`
            : !c.everyRestaurant && slots >= T.marketing.maxActive ? `${T.marketing.maxActive} running, stop one first` : `Start for ${money(cost)}`));
    }));
}

function promotionTab(ctx: PanelCtx, d: DeliveryState): HTMLElement[] {
  const state = ctx.state;
  const t = T.delivery;
  const last = lastDay(state);
  const now = busyDay(state, {});
  return [
    funnel(state, d, last),
    h('div', { class: 'card' }, h('h3', null, h('span', null, 'Where you are listed'), h('span', { class: 'small' }, 'reach and commission')),
      ...MODES.map((m) => {
        const on = d.mode === m;
        const f = on ? null : vsNow(busyDay(state, { mode: m }), now);
        return h('div', { class: `fit ${on ? 'installed' : ''}` },
          h('div', { class: 'spread' }, h('b', null, MODE_NAMES[m]),
            on ? h('span', { class: 'small good' }, '✓ Now') : h('button', { class: 'small', onclick: () => act(ctx, { type: 'setDelivery', mode: m }, `${MODE_NAMES[m]} from the next service`) }, 'Switch')),
          h('div', { class: 'small' }, `Reach ${pct(t.reach[m])} · commission ${pct(t.commission[m])}`),
          h('div', { class: 'small muted' }, MODE_BLURB[m]),
          f ? h('div', { class: 'small muted' }, f) : null);
      })),
    promoCampaigns(ctx, now),
    h('div', { class: 'card' }, h('h3', null, '⭐ Top rated on Scoot'),
      h('div', { class: 'small' }, d.topRated
        ? `You are Top rated: ${Math.round((t.topRatedBoost - 1) * 100)}% more orders, and word of mouth spreads ${t.audienceTopRated}x as fast. It is lost below a rating of ${t.topRatedLoseBelow}.`
        : `Hold a delivery rating of ${t.topRatedDrep} for ${t.topRatedDays} days: ${d.drep >= t.topRatedDrep ? `${d.topRatedDays} of ${t.topRatedDays} days so far.` : `you are at ${d.drep.toFixed(0)}.`}`),
      h('div', { class: 'small muted' }, 'The rating follows food on arrival (45%), time to the door (35%) and value (20%). The Scorecard shows which one holds it back.')),
  ];
}

// ---------- Menu & deals (5.2) ----------

/** One average order split into what it pays for (F-227); the lines add up to the profit per order. */
function unpacked(last: DeliveryDay | undefined): HTMLElement {
  if (!last || last.delivered < 1) return h('div', { class: 'card' }, h('h3', null, 'One order, unpacked'), h('div', { class: 'small muted' }, 'After the first day with orders, this shows where the money of one order goes.'));
  const n = last.delivered;
  const value = last.orderValue ?? 0;
  const fee = (last.sales ?? 0) / n + (last.refunds ?? 0) / n - value;
  const lines: { label: string; v: number; cls: string }[] = [
    { label: 'Food', v: (last.food ?? 0) / n, cls: 'c-food' },
    { label: 'App commission', v: (last.commission ?? 0) / n, cls: 'c-app' },
    { label: 'Packaging', v: (last.packaging ?? 0) / n, cls: 'c-pack' },
    { label: 'Riders', v: (last.riderWages ?? 0) / n, cls: 'c-rider' },
    { label: 'Vehicles, web shop, utilities', v: (last.other ?? 0) / n, cls: 'c-other' },
    { label: 'Late refunds', v: (last.refunds ?? 0) / n, cls: 'c-refund' },
  ];
  const profit = last.profit / n;
  const gross = Math.max(0.01, value + Math.max(0, fee));
  const given = ((last.dealGiven ?? 0) + (last.feesWaived ?? 0)) / n;
  return h('div', { class: 'card' }, h('h3', null, h('span', null, 'One order, unpacked'), h('span', { class: 'small' }, `last day, ${Math.round(n)} orders`)),
    h('div', { class: 'stack-bar order-bar', title: 'Where the money of one order goes' },
      ...lines.filter((l) => l.v > 0).map((l) => h('div', { class: l.cls, title: `${l.label} ${money(l.v, true)}`, style: `width:${(l.v / gross) * 100}%` })),
      profit > 0 ? h('div', { class: 'c-profit', title: `Profit ${money(profit, true)}`, style: `width:${(profit / gross) * 100}%` }) : null),
    h('div', { class: 'kv' },
      h('span', null, 'Order value (after the deal)'), h('b', null, money(value, true)),
      Math.abs(fee) >= 0.01 ? h('span', null, fee >= 0 ? 'Delivery fee you keep' : 'Delivery fee you pay') : null,
      Math.abs(fee) >= 0.01 ? h('b', { class: fee >= 0 ? '' : 'warn' }, signedMoney(fee).replace('$', '$')) : null,
      ...lines.filter((l) => l.v >= 0.005).flatMap((l) => [h('span', null, h('i', { class: `swatch ${l.cls}` }), ` ${l.label}`), h('b', null, money(-l.v, true))]),
      h('span', { class: 'total' }, h('i', { class: 'swatch c-profit' }), ' Profit per order'), h('b', { class: `total ${profit >= 0 ? 'good' : 'bad'}` }, money(profit, true))),
    given >= 0.01 ? h('div', { class: 'small muted' }, `The deal gave away ${money(given, true)} an order, already out of the order value.`) : null);
}

function menuTab(ctx: PanelCtx, d: DeliveryState): HTMLElement[] {
  const state = ctx.state;
  const t = T.delivery;
  const now = busyDay(state, {});
  const up = d.markup < 0.2 ? busyDay(state, { markup: Math.min(0.2, d.markup + 0.05) }) : null;
  const down = d.markup > 0 ? busyDay(state, { markup: Math.max(0, d.markup - 0.05) }) : null;
  const markup = h('div', { class: 'card' }, h('h3', null, h('span', null, 'App prices'), h('span', { class: 'small' }, `${Math.round(d.markup * 100)}% above the menu`)),
    h('div', { class: 'row' },
      h('button', { class: 'small', disabled: d.markup <= 0, onclick: () => act(ctx, { type: 'setDelivery', markup: d.markup - 0.05 }) }, '−5%'),
      h('b', null, `${Math.round(d.markup * 100)}%`),
      h('button', { class: 'small', disabled: d.markup >= 0.2, onclick: () => act(ctx, { type: 'setDelivery', markup: d.markup + 0.05 }) }, '+5%')),
    down && now.day && down.day ? h('div', { class: 'small muted' }, `−5%: ${signed(down.day.delivered - now.day.delivered, 1)} orders, ${signedMoney(down.profit - now.profit)} on a Saturday`) : null,
    up && now.day && up.day ? h('div', { class: 'small muted' }, `+5%: ${signed(up.day.delivered - now.day.delivered, 1)} orders, ${signedMoney(up.profit - now.profit)} on a Saturday`) : null,
    h('div', { class: 'small muted' }, 'Most restaurants price the app a little above the menu to cover commission. Steep app prices lower value for money and the rating.'));
  const current = d.deal ? DELIVERY_DEALS[d.deal] : null;
  const deals = h('div', { class: 'card' }, h('h3', null, h('span', null, 'Deals'), h('span', { class: 'small' }, current ? current.name : 'none running')),
    h('div', { class: 'small muted' }, 'A standing offer on every delivery order. Prices go down, orders and baskets go up: the app pushes deals to the top, and price hungry crowds order more.'),
    h('div', { class: 'fitlist' }, ...[null, ...DELIVERY_DEAL_IDS].map((id) => {
      const deal = id ? DELIVERY_DEALS[id] : null;
      const on = (d.deal ?? null) === id;
      const f = on ? now : busyDay(state, { deal: id, dealDays: 'all' });
      return h('div', { class: `fit ${on ? 'installed' : ''}` },
        h('div', { class: 'spread' }, h('b', null, deal?.name ?? 'No deal'),
          on ? h('span', { class: 'small good' }, '✓ Running')
            : h('button', { class: 'small primary', onclick: () => act(ctx, { type: 'setDelivery', deal: id }, deal ? `${deal.name} is on from the next service` : 'Deal stopped') }, deal ? 'Run it' : 'Stop deals')),
        deal ? h('div', { class: 'small' }, deal.effect) : h('div', { class: 'small' }, 'Full price on every order.'),
        deal ? h('div', { class: 'small muted' }, deal.blurb) : null,
        !on && f.day && now.day ? h('div', { class: 'small muted' },
          `On a Saturday, every day: ${Math.round(f.day.delivered)} orders (${signed(f.day.delivered - now.day.delivered, 0)}), ${money(f.day.orderValue ?? 0, true)} an order, ${signedMoney(f.profit - now.profit)} profit against now.`) : null);
    })));
  const daysNow = d.deal ? busyWeek(state, {}) : null;
  const dealDays = d.deal ? h('div', { class: 'card' }, h('h3', null, h('span', null, 'Deal days'), h('span', { class: 'small' }, DEAL_DAYS_NAMES[dealDaysOf(d)])),
    h('div', { class: 'small muted' }, 'Run the deal every day, only on the quiet days (Mon to Thu, to fill the oven), or only at the busy weekend.'),
    choice((['all', 'weekdays', 'weekend'] as DealDays[]).map((v) => {
      const w = v === dealDaysOf(d) || !daysNow ? null : busyWeek(state, { dealDays: v });
      return { v, label: DEAL_DAYS_NAMES[v], title: w && daysNow ? `A week: ${signed(w.delivered - daysNow.delivered, 0)} orders, ${signedMoney(w.profit - daysNow.profit)} profit against now.` : undefined };
    }), dealDaysOf(d), (v) => act(ctx, { type: 'setDelivery', dealDays: v }, `The deal runs ${DEAL_DAYS_NAMES[v].toLowerCase()}`)),
    ...(daysNow ? (['all', 'weekdays', 'weekend'] as DealDays[]).filter((v) => v !== dealDaysOf(d)).map((v) => {
      const w = busyWeek(state, { dealDays: v });
      return h('div', { class: 'small muted' }, `${DEAL_DAYS_NAMES[v]}: ${signed(w.delivered - daysNow.delivered, 0)} orders and ${signedMoney(w.profit - daysNow.profit)} profit a week against now.`);
    }) : [])) : null;
  const minOrder = h('div', { class: 'card' }, h('h3', null, h('span', null, 'Minimum order'), h('span', { class: 'small' }, MIN_ORDER_NAMES[minOrderOf(d)])),
    h('div', { class: 'small muted' }, 'A minimum makes every order bigger and loses some small ones. Families and professionals fill a basket easily; students feel it.'),
    choice((['none', 'low', 'high'] as MinOrder[]).map((v) => {
      const m = t.minOrder[v];
      return { v, label: MIN_ORDER_NAMES[v], title: `${Math.round((m.orders - 1) * 100)}% orders, +${m.mains} mains and +${m.drinks} drinks an order` };
    }), minOrderOf(d), (v) => act(ctx, { type: 'setDelivery', minOrder: v }, `${MIN_ORDER_NAMES[v]} from the next service`)),
    ...(['none', 'low', 'high'] as MinOrder[]).filter((v) => v !== minOrderOf(d)).map((v) => {
      const f = busyDay(state, { minOrder: v });
      return f.day && now.day ? h('div', { class: 'small muted' }, `${MIN_ORDER_NAMES[v]}: ${Math.round(f.day.delivered)} orders (${signed(f.day.delivered - now.day.delivered, 0)}), ${money(f.day.orderValue ?? 0, true)} an order, ${signedMoney(f.profit - now.profit)} on a Saturday.`) : null;
    }));
  const packaging = h('div', { class: 'card' }, h('h3', null, 'Packaging'),
    choice<'basic' | 'eco'>([
      { v: 'basic', label: `Basic ${money(t.packaging.basic, true)}` },
      { v: 'eco', label: `Insulated eco ${money(t.packaging.eco, true)}` },
    ], d.packaging, (v) => act(ctx, { type: 'setDelivery', packaging: v })),
    h('div', { class: 'small muted' }, `Per main. Insulated boxes keep food ${Math.round((t.ecoPackaging - 1) * 100)}% better on the way.`));
  return compact([unpacked(lastDay(state)), markup, deals, dealDays, minOrder, packaging]);
}

// ---------- Fleet (5.3) ----------

function fleetTab(ctx: PanelCtx, d: DeliveryState): HTMLElement[] {
  const state = ctx.state;
  const t = T.delivery;
  const own = d.mode !== 'platform';
  const last = lastDay(state);
  const riders = ridersToday(state);
  const peak = last ? last.accepted * (1 - t.lunchShare) / (T.time.dinnerHours * T.service.utilisation.dinner) : 0;
  const need = own ? ridersNeeded(peak, riders.ride) : 0;
  const now = busyDay(state, {});
  const payroll = state.staff.filter((s) => s.role === 'rider').sort((a, b) => b.attrs.speed - a.attrs.speed);
  const rota = new Set(onRota(state.staff, state.day).map((s) => s.id));
  const fleet = fleetOf(d);
  let slot = 0;
  const riderCard = own ? h('div', { class: 'card' }, h('h3', null, h('span', null, '🧑 Riders'), h('span', { class: 'small' }, `${riders.onShift} riding today · about ${need} needed at the dinner peak`)),
    payroll.length ? h('div', { class: 'rtable', role: 'table' },
      ...payroll.map((s) => {
        const rides = rota.has(s.id);
        const v = rides ? fleet[slot++] : undefined;
        return h('div', { class: 'rt-row', role: 'row' },
          h('span', { role: 'cell' }, h('b', null, s.name)),
          h('span', { role: 'cell', class: 'small' }, `speed ${s.attrs.speed} · quality ${s.attrs.quality}`),
          h('span', { role: 'cell', class: `small ${rides && !v ? 'warn' : ''}` }, !rides ? 'off today' : v ? `on a ${v.name.toLowerCase()}` : 'no vehicle'),
          h('span', { role: 'cell', class: 'small muted' }, `${money(s.salary)}/wk`));
      })) : h('div', { class: 'small warn' }, 'No riders yet: orders are taken but nobody rides them out.'),
    ...state.candidates.filter((c) => c.role === 'rider').slice(0, 4).map((c) => h('div', { class: 'spread' },
      h('span', { class: 'small' }, h('b', null, c.name), ` speed ${c.attrs.speed} · quality ${c.attrs.quality} · ${money(c.salary)}/wk`),
      h('button', { class: 'small primary', onclick: () => act(ctx, { type: 'hire', candidateId: c.id }, `${c.name} joins as a rider`) }, 'Hire'))),
    h('div', { class: 'small muted' }, 'Fast riders ride faster; careful riders keep the food nicer. More rider candidates show up in the Squad tab market.'))
    : h('div', { class: 'card' }, h('h3', null, '🧑 Riders'), h('div', { class: 'small' }, `The Scoot riders deliver for you: about ${Math.round(riders.ride)} min a ride, no wages, no vehicles. Switch to your own riders under Promotion to run a fleet.`));
  const vehicles = own ? h('div', { class: 'card' }, h('h3', null, h('span', null, '🛵 Vehicles'), h('span', { class: 'small' }, `${fleet.length} in the fleet`)),
    h('div', { class: 'vtable', role: 'table' },
      h('div', { class: 'vt-row vt-head', role: 'row' }, ...['Vehicle', 'Ride', 'A trip', 'Upkeep', 'Own', ''].map((x) => h('span', { role: 'columnheader' }, x))),
      ...VEHICLE_KINDS.map((k) => {
        const v = vehicleSpec(k);
        const n = vehicleCount(d, k);
        return h('div', { class: 'vt-row', role: 'row' },
          h('b', { role: 'cell' }, v.name),
          h('span', { role: 'cell' }, `${v.ride} min`),
          h('span', { role: 'cell' }, `${v.trip}`),
          h('span', { role: 'cell' }, `${money(v.upkeep)}/wk`),
          h('b', { role: 'cell' }, `${n}`),
          h('span', { role: 'cell', class: 'row' },
            h('button', { class: 'small', onclick: () => act(ctx, { type: 'buyVehicle', kind: k }, `${v.name} bought`) }, `Buy ${money(v.price)}`),
            n ? h('button', { class: 'small', onclick: () => act(ctx, { type: 'sellVehicle', kind: k }, `${v.name} sold`) }, 'Sell') : null));
      })),
    h('div', { class: `small ${fleet.length < payroll.length ? 'warn' : 'muted'}` }, fleet.length < payroll.length
      ? `${payroll.length - fleet.length} rider${payroll.length - fleet.length === 1 ? '' : 's'} without a vehicle: a rider without a vehicle does not ride.`
      : 'Riders take the vehicle that moves the most orders an hour first. Vehicles sell back at 80%.')) : null;
  const zone = h('div', { class: 'card' }, h('h3', null, h('span', null, '🗺 Delivery zone'), h('span', { class: 'small' }, ZONE_NAMES[zoneOf(d)])),
    choice((['tight', 'standard', 'wide'] as DeliveryZone[]).map((v) => ({ v, label: ZONE_NAMES[v], title: ZONE_BLURB[v] })), zoneOf(d),
      (v) => act(ctx, { type: 'setDelivery', zone: v }, `Zone ${ZONE_NAMES[v].toLowerCase()} from the next service`)),
    h('div', { class: 'small muted' }, ZONE_BLURB[zoneOf(d)]),
    ...(['tight', 'standard', 'wide'] as DeliveryZone[]).filter((v) => v !== zoneOf(d)).map((v) => {
      const f = vsNow(busyDay(state, { zone: v }), now);
      return f ? h('div', { class: 'small muted' }, `${ZONE_NAMES[v]}: ${f.replace('On a Saturday: ', '')}`) : null;
    }));
  const throttle = h('div', { class: 'card' }, h('h3', null, 'Kitchen limit'),
    h('span', { class: 'small' }, 'How busy may the app make your kitchen?'),
    choice(PRESETS.map((p) => {
      const f = busyDay(state, { throttle: p.throttle });
      return { v: p.throttle, label: p.name, title: `${p.blurb}${f.day ? ` On a Saturday: ${Math.round(f.day.accepted)} orders taken, ${Math.round(f.day.refused)} refused, ${Math.round(f.day.time.dinner)} min at dinner, ${signedMoney(f.profit - now.profit)} against now.` : ''}` };
    }), d.throttle, (v) => act(ctx, { type: 'setDelivery', throttle: v })),
    h('div', { class: 'small muted' }, PRESETS.find((p) => p.throttle === d.throttle)?.blurb ?? `The app pauses at ${Math.round((d.throttle ?? 1) * 100)}% kitchen load.`),
    now.day ? h('div', { class: 'small muted' }, `On a Saturday: about ${Math.round(now.day.refused)} orders refused, deliveries ${Math.round(now.day.time.dinner)} min at dinner (promise ${t.promise}).`) : null,
    kitchenLimitLine(now) ? h('div', { class: 'small warn' }, kitchenLimitLine(now)) : null);
  return compact([riderCard, vehicles, zone, throttle]);
}

// ---------- Scorecard (5.4) ----------

const gradeBadge = (g: Grade): HTMLElement => h('span', { class: `grade g-${g}` }, g);

function scoreTab(ctx: PanelCtx, go: (tab: DeliveryTabId) => void): HTMLElement[] {
  const state = ctx.state;
  const sc = deliveryScorecard(state.history);
  const last = lastDay(state);
  const tips = deliveryTips(state, last, 6);
  const tipsCard = h('div', { class: 'card' }, h('h3', null, '💡 How to grow delivery'),
    ...(tips.length ? tips.map((x) => h('div', { class: 'small' }, `• ${x}`)) : [h('div', { class: 'small muted' }, 'Delivery is running well. Tips show up here after each day.')]));
  if (!sc) return [h('div', { class: 'card' }, h('h3', null, 'Scorecard'), h('div', { class: 'small muted' }, 'The scorecard grades your delivery after the first days with orders.')), tipsCard];
  const week = deliveryWeek(deliveryDays(state.history).slice(-7));
  return compact([
    h('div', { class: 'card' },
      h('h3', null, h('span', null, 'Delivery score'), h('span', { class: 'small' }, `last ${sc.days} delivery day${sc.days === 1 ? '' : 's'}`)),
      h('div', { class: 'score-head' }, h('span', { class: 'big' }, `${sc.overall}`), gradeBadge(sc.grade),
        h('div', { class: 'small muted' }, 'Out of 100: on time and food 20 each, orders fulfilled, rating and profit 15 each, value 10, audience 5.')),
      sc.days < SCORE_MIN_DAYS ? h('div', { class: 'small warn' }, `Only ${sc.days} delivery day${sc.days === 1 ? '' : 's'} so far: the grades settle after ${SCORE_MIN_DAYS} or more.`) : null,
      h('div', { class: 'scoretable', role: 'table' },
        h('div', { class: 'st-row st-head', role: 'row' }, ...['KPI', 'Now', 'A at', 'Grade', 'Week', ''].map((x) => h('span', { role: 'columnheader' }, x))),
        ...sc.kpis.map((k) => h('div', { class: 'st-row', role: 'row', title: k.why },
          h('span', { role: 'cell' }, k.label),
          h('b', { role: 'cell' }, k.shown),
          h('span', { role: 'cell', class: 'muted' }, k.target),
          h('span', { role: 'cell' }, gradeBadge(k.grade)),
          h('span', { role: 'cell', class: `small ${k.change === null ? 'muted' : k.change > 0 ? 'good' : k.change < 0 ? 'bad' : ''}` },
            k.change === null ? '·' : k.change > 1e-3 ? '↑' : k.change < -1e-3 ? '↓' : '→'),
          k.grade !== 'A' && k.fix !== 'score' ? h('button', { role: 'cell', class: 'small ghost', onclick: () => go(k.fix) }, DELIVERY_TABS.find(([id]) => id === k.fix)?.[1] ?? '') : h('span', { role: 'cell' }))))),
    sc.focus ? h('div', { class: 'card focus' }, h('h3', null, h('span', null, '🎯 Focus this week'), gradeBadge(sc.focus.grade)),
      h('div', null, h('b', null, `${sc.focus.label}: ${sc.focus.shown}`), ` (A from ${sc.focus.target}).`),
      h('div', { class: 'small' }, sc.focus.why),
      sc.focus.fix !== 'score' ? h('div', { class: 'row' }, h('button', { class: 'small primary', onclick: () => go(sc.focus?.fix ?? 'score') }, `Open ${DELIVERY_TABS.find(([id]) => id === sc.focus?.fix)?.[1] ?? ''}`)) : null)
      : h('div', { class: 'card' }, h('div', { class: 'good' }, 'Every KPI is at A. Delivery is running like a top restaurant.')),
    tipsCard,
    week,
  ]);
}

// ---------- The tab ----------

/** The Delivery tab's content for one of its four tabs (delivery-tab.md 5). */
export function deliveryPanel(ctx: PanelCtx, tab: DeliveryTabId, go: (tab: DeliveryTabId) => void): HTMLElement {
  const state = ctx.state;
  const d = state.delivery;
  const title = DELIVERY_TABS.find(([id]) => id === tab)?.[1] ?? 'Delivery';
  const setup = setupView(ctx);
  if (setup || !d) return h('div', { class: 'stack' }, h('h2', null, `Delivery · ${title}`), setup ?? h('div'));
  const body = tab === 'promotion' ? promotionTab(ctx, d) : tab === 'menu' ? menuTab(ctx, d) : tab === 'fleet' ? fleetTab(ctx, d) : scoreTab(ctx, go);
  return h('div', { class: 'stack' }, h('h2', null, `Delivery · ${title}`), statusStrip(ctx, d), ...body);
}

/** The Money tab's delivery line (F-233): one sentence and a way to the Delivery tab. */
export function deliverySummaryCard(state: GameState, open: () => void): HTMLElement | null {
  const d = state.delivery;
  const missing = deliveryMissing(state);
  if (!d && state.rep < 50) return null;
  const last = lastDay(state);
  const sc = d?.on ? deliveryScorecard(state.history) : null;
  const text = !d?.on
    ? (missing.length ? `Delivery: ${missing.join(', ')}.` : d ? 'Delivery is paused.' : 'Delivery is unlocked: place a packing station and choose a mode.')
    : last ? `${Math.round(last.delivered)} orders, ${money(last.profit)} on the last day · rating ${d.drep.toFixed(0)}${sc ? ` · score ${sc.overall} (${sc.grade})` : ''}`
      : `${MODE_NAMES[d.mode]}: the first orders come in at the next service.`;
  return h('div', { class: 'card' }, h('div', { class: 'spread' }, h('span', null, h('b', null, '🛵 Delivery '), h('span', { class: 'small' }, text)),
    h('button', { class: 'small', onclick: open }, 'Open Delivery')));
}

/** The day report's delivery section: headline, then orders, time, money, crowds and tips (folded open). */
export function deliveryDayCard(d: DeliveryDay | undefined, state: GameState): HTMLElement | null {
  if (!d) return null;
  const t = T.delivery;
  const headline = `🛵 ${Math.round(d.delivered)} deliveries${d.refused >= 1 ? `, ${Math.round(d.refused)} refused` : ''}${d.cancelled >= 1 ? `, ${Math.round(d.cancelled)} cancelled` : ''} · ` +
    `rating ${d.drepBefore.toFixed(0)} → ${d.drepAfter.toFixed(0)} · ${money(d.profit)}`;
  const perOrder = d.delivered > 0 ? d.profit / d.delivered : 0;
  const rivals = d.rivalOrders ?? 0;
  const share = d.delivered + rivals > 0 ? d.delivered / (d.delivered + rivals) : 0;
  const svRow = (sv: Service): HTMLElement | null => {
    const b = d.byService?.[sv];
    if (!b || b.wanted < 0.5) return null;
    const late = d.time[sv] > t.promise;
    return h('div', { class: 'it-row', role: 'row' },
      h('span', { role: 'cell' }, sv === 'lunch' ? 'Lunch' : 'Dinner'),
      h('span', { role: 'cell' }, `${Math.round(b.wanted)}`),
      h('span', { role: 'cell' }, `${Math.round(b.delivered)}`),
      h('span', { role: 'cell', class: b.accepted < b.wanted - 0.5 ? 'warn' : '' }, `${Math.round(b.wanted - b.accepted)}`),
      h('b', { role: 'cell', class: b.delivered > 0 ? (late ? 'bad' : 'good') : 'muted' }, b.delivered > 0 ? `${Math.round(d.time[sv])}m` : '·'),
      h('span', { role: 'cell' }, money(b.orderValue, true)));
  };
  const money2 = (label: string, v: number | undefined, cls = ''): HTMLElement[] =>
    v && Math.abs(v) >= 0.5 ? [h('span', null, label), h('b', { class: cls }, money(v))] : [];
  const segs = Object.entries(d.bySegment ?? {}).filter(([, n]) => (n ?? 0) >= 0.5).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [SegmentId, number][];
  const score = (x: number | undefined): HTMLElement => h('b', { class: (x ?? 0) < 0.5 ? 'bad' : (x ?? 0) > 0.75 ? 'good' : '' }, `${Math.round((x ?? 0) * 100)}`);
  const deal = d.deal ? DELIVERY_DEALS[d.deal] : undefined;
  const tips = deliveryTips(state, d);
  return h('details', { class: 'card delivery-day', open: true },
    h('summary', null, h('b', null, headline)),
    h('div', { class: 'kv' },
      h('span', null, 'Orders'), h('b', null, `${Math.round(d.delivered)} delivered of ${Math.round(d.wanted)} wanted`),
      h('span', null, 'Average order'), h('b', null, `${money(d.orderValue ?? 0, true)} · ${(d.mainsPerOrder ?? t.mainsPerOrder).toFixed(1)} mains`),
      h('span', null, 'Profit per order'), h('b', { class: perOrder >= 0 ? 'good' : 'bad' }, money(perOrder, true)),
      h('span', null, 'Kitchen used by delivery'), h('b', null, pct(d.kitchenShare)),
      d.audienceAfter !== undefined ? h('span', null, 'Delivery audience') : null,
      d.audienceAfter !== undefined ? h('b', { class: d.audienceAfter < 0.25 ? 'warn' : '' },
        `${pct(d.audienceBefore ?? d.audienceAfter)} → ${pct(d.audienceAfter)} (word of mouth ${signed((d.audienceOrganic ?? 0) * 100, 1)}, campaigns ${signed((d.audienceCampaigns ?? 0) * 100, 1)} pts)`) : null,
      rivals > 0.5 ? h('span', null, 'Your share of delivery nearby') : null,
      rivals > 0.5 ? h('b', null, `${pct(share)} (rivals ${Math.round(rivals)} orders)`) : null,
      h('span', null, 'Delivery rating'), h('b', { class: d.drepAfter >= d.drepBefore ? 'good' : 'bad' },
        `${d.drepBefore.toFixed(1)} → ${d.drepAfter.toFixed(1)}${d.topRated ? ' · Top rated' : d.drepAfter >= t.topRatedDrep ? ` · ${d.topRatedDays ?? 0} of ${t.topRatedDays} days to Top rated` : ''}`)),
    d.byService ? h('div', { class: 'impact-table', role: 'table' },
      h('div', { class: 'it-row it-head', role: 'row' }, ...['Service', 'Wanted', 'Out', 'Refused', 'Time', 'Order'].map((x) => h('span', { role: 'columnheader' }, x))),
      svRow('lunch'), svRow('dinner')) : null,
    d.scores ? h('div', { class: 'stack', style: 'gap:2px' },
      h('b', { class: 'small' }, `How delivery guests felt: ${Math.round(d.satisfaction ?? 0)}`),
      h('div', { class: 'kv' }, h('span', null, 'Food on arrival'), score(d.scores.food), h('span', null, `On time (promise ${t.promise} min)`), score(d.scores.time), h('span', null, 'Value for money'), score(d.scores.value))) : null,
    h('div', { class: 'stack', style: 'gap:2px' },
      h('b', { class: 'small' }, 'Money'),
      h('div', { class: 'kv' },
        ...money2('Sales', d.sales),
        ...money2('Deal discounts', -((d.dealGiven ?? 0) + (d.feesWaived ?? 0)), 'warn'),
        ...money2('Late refunds', -(d.refunds ?? 0), 'bad'),
        ...money2('App commission', -(d.commission ?? 0)),
        ...money2('Food', -(d.food ?? 0)),
        ...money2('Packaging', -(d.packaging ?? 0)),
        ...money2('Riders', -(d.riderWages ?? 0)),
        ...money2('Vehicles, web shop, utilities', -(d.other ?? 0)),
        h('span', null, 'Delivery profit'), h('b', { class: d.profit >= 0 ? 'good' : 'bad' }, money(d.profit)))),
    deal ? h('div', { class: 'small' }, `Deal: ${deal.name}. ${d.dealGiven || d.feesWaived ? `${money((d.dealGiven ?? 0) + (d.feesWaived ?? 0))} given away for ${Math.round((deal.orderLift) * 100)}% more orders and bigger baskets.` : ''}`) : null,
    segs.length ? h('div', { class: 'small muted' }, `Who ordered: ${segs.slice(0, 4).map(([id, n]) => `${SEGMENTS[id].name} ${Math.round(n)}`).join(', ')}`) : null,
    tips.length ? h('div', { class: 'stack', style: 'gap:2px' }, h('b', { class: 'small' }, '💡 How to grow delivery'), ...tips.map((x) => h('div', { class: 'small' }, `• ${x}`))) : null);
}

/** Week summary for delivery (competition.md 8.2). */
export function deliveryWeek(days: readonly (DeliveryDay | undefined)[]): HTMLElement | null {
  const ds = days.filter((x): x is DeliveryDay => !!x);
  if (!ds.length) return null;
  const sum = (f: (d: DeliveryDay) => number): number => ds.reduce((x, d) => x + f(d), 0);
  const first = ds[0] as DeliveryDay;
  const last = ds.at(-1) as DeliveryDay;
  const late = ds.filter((d) => d.time.dinner > T.delivery.promise).length;
  return h('div', { class: 'card' }, h('h3', null, '🛵 Delivery this week'),
    h('div', { class: 'kv' },
      h('span', null, 'Orders delivered'), h('b', null, `${Math.round(sum((d) => d.delivered))} of ${Math.round(sum((d) => d.wanted))} wanted`),
      h('span', null, 'Refused, cancelled'), h('b', null, `${Math.round(sum((d) => d.refused))} · ${Math.round(sum((d) => d.cancelled))}`),
      h('span', null, 'Late dinners'), h('b', { class: late ? 'warn' : '' }, `${late} of ${ds.length}`),
      h('span', null, 'Average order'), h('b', null, money(sum((d) => d.delivered) > 0 ? sum((d) => (d.orderValue ?? 0) * d.delivered) / sum((d) => d.delivered) : 0, true)),
      h('span', null, 'Sales, deal discounts'), h('b', null, `${money(sum((d) => d.sales ?? 0))} · ${money(sum((d) => (d.dealGiven ?? 0) + (d.feesWaived ?? 0)))}`),
      h('span', null, 'Delivery rating'), h('b', null, `${first.drepBefore.toFixed(0)} → ${last.drepAfter.toFixed(0)}${last.topRated ? ' · Top rated' : ''}`),
      h('span', null, 'Profit from delivery'), h('b', { class: sum((d) => d.profit) >= 0 ? 'good' : 'bad' }, money(sum((d) => d.profit)))));
}
