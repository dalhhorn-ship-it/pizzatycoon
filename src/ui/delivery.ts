// The delivery panel (competition.md 6.11): setup, status, settings, riders and vehicles.

import { T } from '../data/tunables';
import { forecastSaturday } from '../sim/forecast';
import { audienceOf, deliveryMissing, hasPacking, MODE_BLURB, MODE_NAMES, ridersNeeded, ridersToday } from '../sim/delivery';
import { DELIVERY_DEAL_IDS, DELIVERY_DEALS } from '../data/deliveryDeals';
import { SEGMENTS } from '../data/segments';
import type { SegmentId, Service } from '../data/types';
import { deliveryTips } from '../sim/deliveryAdvice';
import type { DeliveryDay, DeliveryMode, DeliveryState, GameState, ServiceReport } from '../sim/state';
import { act, h, money, pct, signed, signedMoney, stars } from './dom';
import type { PanelCtx } from './panels';
import { openMarketing } from './rivals';

const MODES: DeliveryMode[] = ['platform', 'marketplace', 'own'];
/** Three presets instead of a slider (cleanup sprint 5): what each protects, in words. */
const PRESETS: { throttle: number | null; name: string; blurb: string }[] = [
  { throttle: 0.7, name: 'Protect rating', blurb: 'The app pauses at 70% kitchen load: fast deliveries, more orders refused.' },
  { throttle: 0.8, name: 'Balanced', blurb: 'The app pauses at 80% kitchen load: the default.' },
  { throttle: null, name: 'Max orders', blurb: 'The app never pauses: every order is taken, and a busy kitchen gets slow, late and refunded.' },
];

/** A busy day (Saturday) with these delivery settings, for the previews. */
function busyDay(state: GameState, d: Partial<DeliveryState>): { day: DeliveryDay | undefined; profit: number; services: ServiceReport[] } {
  const r = forecastSaturday({ ...state, delivery: { ...(state.delivery as DeliveryState), ...d } });
  return { day: r.delivery, profit: r.pnl.profit, services: r.services };
}

const STAGE_FIX: Record<string, string> = {
  oven: 'a bigger or faster oven (a conveyor oven suits delivery)',
  prep: 'another prep station or a cook',
  cold: 'more fridge space for dough',
};

/** When the app turns many orders away on a busy day, name the kitchen stage that limits it (competition.md 6.11). */
function kitchenLimitLine(b: { day: DeliveryDay | undefined; services: ServiceReport[] }): string | null {
  const d = b.day;
  if (!d || d.wanted < 5 || d.refused < 0.2 * d.wanted) return null;
  const dinner = b.services.find((x) => x.service === 'dinner');
  if (!dinner) return null;
  const stages = (['oven', 'prep', 'cold'] as const).map((k) => [k, dinner.stages[k] ?? Infinity] as const).sort((x, y) => x[1] - y[1]);
  const [limit] = stages[0] ?? ['oven'];
  return `Your kitchen is the limit: on a Saturday the app wanted ${Math.round(d.wanted)} orders and you could take ${Math.round(d.accepted)}. The ${limit === 'cold' ? 'dough supply' : limit} sets the pace; ${STAGE_FIX[limit]} would take more.`;
}


export function deliveryCard(ctx: PanelCtx): HTMLElement {
  const state = ctx.state;
  const d = state.delivery;
  const missing = deliveryMissing(state);
  // Staged reveal (cleanup sprint 5): delivery shows up from two and a half stars.
  if (missing.length && !d && state.rep < 50) return h('div');
  if (missing.length && !d) {
    return h('div', { class: 'card' }, h('h3', null, '🛵 Delivery'),
      h('div', { class: 'small' }, `Delivery: ${missing.join(', ')}.`),
      h('div', { class: 'small muted' }, 'Delivery brings orders from the whole neighbourhood and the ones next to it, without using a seat. It shares your oven and prep line with the dining room.'));
  }
  if (!hasPacking(state)) {
    return h('div', { class: 'card' }, h('h3', null, '🛵 Delivery'),
      h('div', { class: 'small' }, `Delivery is unlocked. Place a Packing Station (${money(T.delivery.packingStation)}) in the kitchen to start.`),
      h('div', { class: 'small muted' }, 'Students, families and professionals order in most; foodies and tourists rarely do.'));
  }
  if (!d?.on) {
    return h('div', { class: 'card' }, h('h3', null, '🛵 Delivery'),
      d ? h('div', { class: 'small muted' }, `Paused. Delivery rating ${stars(d.drep)} (${d.drep.toFixed(0)}).`) : h('div', { class: 'small' }, 'Choose how orders reach the door. You can change this any morning.'),
      ...MODES.map((m) => h('div', { class: 'line mode' },
        h('div', null, h('b', null, MODE_NAMES[m]), h('div', { class: 'small muted' }, MODE_BLURB[m])),
        h('button', { class: 'small primary', onclick: () => act(ctx, { type: 'startDelivery', mode: m }, 'Delivery starts today') }, 'Start'))));
  }
  const last = [...state.history].reverse().find((r) => r.open && r.delivery)?.delivery;
  const trend = last ? last.drepAfter - last.drepBefore : 0;
  const riders = ridersToday(state);
  const own = d.mode !== 'platform';
  const peak = last ? last.accepted * (1 - T.delivery.lunchShare) / (T.time.dinnerHours * T.service.utilisation.dinner) : 0;
  const need = own ? ridersNeeded(peak, riders.ride) : 0;
  const riderCount = state.staff.filter((s) => s.role === 'rider').length;
  const now = busyDay(state, {});
  const throttleRow = h('div', { class: 'stack', style: 'gap:4px' },
    h('span', { class: 'small' }, 'How busy may the app make your kitchen?'),
    h('div', { class: 'seg wrap' }, ...PRESETS.map((p) => {
      const f = busyDay(state, { throttle: p.throttle });
      return h('button', {
        class: d.throttle === p.throttle ? 'on' : '',
        title: `${p.blurb}${f.day ? ` On a Saturday: ${Math.round(f.day.accepted)} orders taken, ${Math.round(f.day.refused)} refused, ${Math.round(f.day.time.dinner)} min at dinner, ${signedMoney(f.profit - now.profit)} against now.` : ''}`,
        onclick: () => act(ctx, { type: 'setDelivery', throttle: p.throttle }),
      }, p.name);
    })),
    h('div', { class: 'small muted' }, PRESETS.find((p) => p.throttle === d.throttle)?.blurb ?? `The app pauses at ${Math.round((d.throttle ?? 1) * 100)}% kitchen load.`),
    now.day ? h('div', { class: 'small muted' }, `On a Saturday: about ${Math.round(now.day.refused)} orders refused, deliveries ${Math.round(now.day.time.dinner)} min at dinner.`) : null,
    kitchenLimitLine(now) ? h('div', { class: 'small warn' }, kitchenLimitLine(now)) : null);
  const markupRow = h('div', { class: 'row' },
    h('span', { class: 'small' }, `App prices ${Math.round(d.markup * 100)}% above the menu`),
    h('button', { class: 'small', disabled: d.markup <= 0, onclick: () => act(ctx, { type: 'setDelivery', markup: d.markup - 0.05 }) }, '−5%'),
    h('button', { class: 'small', disabled: d.markup >= 0.2, onclick: () => act(ctx, { type: 'setDelivery', markup: d.markup + 0.05 }) }, '+5%'),
    (() => {
      const up = d.markup < 0.2 ? busyDay(state, { markup: Math.min(0.2, d.markup + 0.05) }) : null;
      return up && now.day && up.day ? h('span', { class: 'small muted' }, `+5%: ${signed(up.day.delivered - now.day.delivered, 1)} orders, ${signedMoney(up.profit - now.profit)} on a Saturday`) : null;
    })());
  const late = last ? Math.max(last.time.lunch, last.time.dinner) > T.delivery.promise : false;
  const current = d.deal ? DELIVERY_DEALS[d.deal] : null;
  const dealRow = h('details', { class: 'stack deals', open: !d.deal },
    h('summary', null, h('b', { class: 'small' }, `Deals: ${current ? current.name : 'none running'}`)),
    h('div', { class: 'small muted' }, 'A standing offer on every delivery order. Prices go down, orders and baskets go up: the app pushes deals to the top, and price hungry crowds order more.'),
    h('div', { class: 'fitlist' }, ...[null, ...DELIVERY_DEAL_IDS].map((id) => {
      const deal = id ? DELIVERY_DEALS[id] : null;
      const on = (d.deal ?? null) === id;
      const f = on ? now : busyDay(state, { deal: id });
      return h('div', { class: `fit ${on ? 'installed' : ''}` },
        h('div', { class: 'spread' }, h('b', null, deal?.name ?? 'No deal'),
          on ? h('span', { class: 'small good' }, '✓ Running')
            : h('button', { class: 'small primary', onclick: () => act(ctx, { type: 'setDelivery', deal: id }, deal ? `${deal.name} is on from the next service` : 'Deal stopped') }, deal ? 'Run it' : 'Stop deals')),
        deal ? h('div', { class: 'small' }, deal.effect) : h('div', { class: 'small' }, 'Full price on every order.'),
        deal ? h('div', { class: 'small muted' }, deal.blurb) : null,
        !on && f.day && now.day ? h('div', { class: 'small muted' },
          `On a Saturday: ${Math.round(f.day.delivered)} orders (${signed(f.day.delivered - now.day.delivered, 0)}), ${money(f.day.orderValue ?? 0, true)} an order, ${signedMoney(f.profit - now.profit)} profit against now.`) : null);
    })));
  const tips = deliveryTips(state, last);
  const growRow = h('div', { class: 'stack', style: 'gap:4px' },
    h('div', { class: 'spread' }, h('b', { class: 'small' }, '💡 How to grow delivery'), h('button', { class: 'small', onclick: () => openMarketing(ctx) }, '📣 Delivery marketing')),
    ...(tips.length ? tips.map((x) => h('div', { class: 'small' }, `• ${x}`)) : [h('div', { class: 'small muted' }, 'Delivery is running well. Tips show up here after each day.')]));
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, '🛵 Delivery'), h('span', { class: 'small' }, MODE_NAMES[d.mode])),
    h('div', { class: 'kv' },
      h('span', null, 'Delivery rating'), h('b', null, `${stars(d.drep)} ${d.drep.toFixed(0)} ${trend > 0.05 ? '↑' : trend < -0.05 ? '↓' : ''}`),
      h('span', null, 'Delivery audience'), h('b', { class: audienceOf(d) < 0.25 ? 'warn' : audienceOf(d) > 0.6 ? 'good' : '' },
        `${pct(audienceOf(d))} of the neighbourhood${last?.audienceAfter !== undefined && last.audienceBefore !== undefined ? ` (${signed((last.audienceAfter - last.audienceBefore) * 100, 1)} pts a day)` : ''}`),
      h('span', null, 'Top rated on Scoot'), h('b', { class: d.topRated ? 'good' : '' }, d.topRated
        ? `Yes: ${Math.round((T.delivery.topRatedBoost - 1) * 100)}% more orders, lost below ${T.delivery.topRatedLoseBelow}`
        : d.drep >= T.delivery.topRatedDrep ? `${d.topRatedDays} of ${T.delivery.topRatedDays} days at ${T.delivery.topRatedDrep}` : `needs ${T.delivery.topRatedDrep} for ${T.delivery.topRatedDays} days`),
      ...(last ? [
        h('span', null, 'Last day'), h('b', null, `${Math.round(last.delivered)} delivered of ${Math.round(last.wanted)} wanted`),
        h('span', null, 'Refused, cancelled'), h('b', { class: last.refused + last.cancelled > 1 ? 'warn' : '' }, `${Math.round(last.refused)} refused · ${Math.round(last.cancelled)} cancelled`),
        h('span', null, 'Time to the door'), h('b', { class: late ? 'bad' : 'good' }, `${Math.round(last.time.lunch)} min lunch · ${Math.round(last.time.dinner)} min dinner (promise ${T.delivery.promise})`),
        h('span', null, 'Kitchen used by delivery'), h('b', null, `${Math.round(last.kitchenShare * 100)}%`),
        h('span', null, 'Average order'), h('b', null, `${money(last.orderValue ?? 0, true)} · ${(last.mainsPerOrder ?? T.delivery.mainsPerOrder).toFixed(1)} mains`),
        h('span', null, 'Delivery profit'), h('b', { class: last.profit >= 0 ? 'good' : 'bad' }, `${money(last.profit)} a day`),
      ] : [h('span', null, 'Orders'), h('b', null, 'The first orders come in at the next service')])),
    h('div', { class: 'seg wrap' }, ...MODES.map((m) => h('button', { class: d.mode === m ? 'on' : '', title: MODE_BLURB[m], onclick: () => act(ctx, { type: 'setDelivery', mode: m }) }, MODE_NAMES[m]))),
    h('div', { class: 'small muted' }, 'Only people who know you deliver can order. The audience starts tiny, grows slowly by word of mouth and fast with delivery campaigns, and fades when nobody hears from you.'),
    h('div', { class: 'small muted' }, MODE_BLURB[d.mode]),
    markupRow,
    dealRow,
    h('div', { class: 'row' }, h('span', { class: 'small' }, 'Packaging'),
      h('div', { class: 'seg' },
        h('button', { class: d.packaging === 'basic' ? 'on' : '', onclick: () => act(ctx, { type: 'setDelivery', packaging: 'basic' }) }, `Basic ${money(T.delivery.packaging.basic, true)}`),
        h('button', { class: d.packaging === 'eco' ? 'on' : '', onclick: () => act(ctx, { type: 'setDelivery', packaging: 'eco' }) }, `Insulated eco ${money(T.delivery.packaging.eco, true)}`))),
    throttleRow,
    own ? h('div', { class: 'stack', style: 'gap:4px' },
      h('b', { class: 'small' }, 'Riders and vehicles'),
      h('div', { class: `small ${riders.onShift < need ? 'warn' : ''}` }, `${riders.onShift} riders on shift today with a vehicle; about ${need} needed at the dinner peak. ${riderCount} on the payroll.`),
      h('div', { class: 'small muted' }, `Bikes ${d.vehicles.bike} · scooters ${d.vehicles.scooter}. A rider without a vehicle does not ride.`),
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => act(ctx, { type: 'buyVehicle', kind: 'bike' }, 'Bike bought') }, `Buy bike ${money(T.delivery.bike.price)}`),
        h('button', { class: 'small', onclick: () => act(ctx, { type: 'buyVehicle', kind: 'scooter' }, 'Scooter bought') }, `Buy scooter ${money(T.delivery.scooter.price)}`),
        d.vehicles.bike ? h('button', { class: 'small', onclick: () => act(ctx, { type: 'sellVehicle', kind: 'bike' }) }, 'Sell a bike') : null,
        d.vehicles.scooter ? h('button', { class: 'small', onclick: () => act(ctx, { type: 'sellVehicle', kind: 'scooter' }) }, 'Sell a scooter') : null),
      h('div', { class: 'small muted' }, 'Hire riders in the Squad tab (Delivery row).')) : null,
    growRow,
    h('div', { class: 'small muted' }, 'Delivery rating is separate from your dining reputation. It rises with hot food, fair app prices and deliveries under the promise.'),
    h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'small', onclick: () => act(ctx, { type: 'stopDelivery' }) }, 'Pause delivery')));
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
