// Plain tips to grow delivery, read from the last day's delivery numbers and today's settings (competition.md 6).

import { CAMPAIGNS } from '../data/campaigns';
import { DELIVERY_DEALS } from '../data/deliveryDeals';
import { SEGMENTS } from '../data/segments';
import { T } from '../data/tunables';
import type { SegmentId } from '../data/types';
import { audienceOf, packingOf, ridersNeeded, ridersToday } from './delivery';
import { campaignUnlocked, isActive } from './marketing';
import type { DeliveryDay, GameState } from './state';

export interface DeliveryTip {
  /** Higher comes first. */
  weight: number;
  text: string;
}

const running = (state: GameState, id: keyof typeof CAMPAIGNS): boolean => (state.campaigns ?? []).some((a) => a.id === id && (a.renew || isActive(a, state.day)));

/** Up to `max` tips, most useful first. `d` is the last delivery day, if there was one. */
export function deliveryTips(state: GameState, d: DeliveryDay | undefined, max = 4): string[] {
  const dl = state.delivery;
  if (!dl?.on) return [];
  const t = T.delivery;
  const tips: DeliveryTip[] = [];
  const own = dl.mode !== 'platform';
  if (d && d.wanted > 1) {
    const refusedShare = d.refused / d.wanted;
    if (d.accepted < 0.5 && own) tips.push({ weight: 100, text: 'Orders came in but nobody could ride them out. Put riders with a bike or scooter on the rota, or switch to the Scoot riders.' });
    else if (refusedShare > 0.15) {
      tips.push({
        weight: 80 * refusedShare + 20,
        text: dl.throttle !== null && dl.throttle < 0.8
          ? `The app refused ${Math.round(d.refused)} orders (${Math.round(refusedShare * 100)}%). Your kitchen limit is set low: try Balanced, or add oven and prep capacity.`
          : `The app refused ${Math.round(d.refused)} orders (${Math.round(refusedShare * 100)}%) because the kitchen was full. A conveyor oven, another prep station or a cook turns those into sales.`,
      });
    }
    if (dl.deal && refusedShare > 0.25) {
      tips.push({ weight: 75, text: `Your kitchen is full and the app still turned ${Math.round(d.refused)} orders away, so the ${DELIVERY_DEALS[dl.deal].name} deal mostly gives money away on orders you would get anyway. Deals pay when the kitchen has room: pause it, or add ovens and prep first.` });
    }
    if (d.cancelled >= 1) tips.push({ weight: 60, text: `${Math.round(d.cancelled)} orders were cancelled after they were accepted: the kitchen could not keep up. Protect rating on the kitchen limit stops that.` });
  }
  const lateSv = d ? (['dinner', 'lunch'] as const).find((sv) => d.time[sv] > t.promise) : undefined;
  if (d && lateSv) {
    const riders = ridersToday(state);
    const peak = d.accepted * (1 - t.lunchShare) / (T.time.dinnerHours * T.service.utilisation.dinner);
    const need = own ? ridersNeeded(peak, riders.ride) : 0;
    const reason = own && riders.onShift < need
      ? `you had ${riders.onShift} riders out and needed about ${need}. Hire a rider or buy a scooter (${t.scooterRide} min a ride against ${t.bikeRide} by bike).`
      : 'the kitchen queue held them up. A lower kitchen limit or a faster oven gets them out sooner.';
    tips.push({ weight: 70 + (d.time[lateSv] - t.promise), text: `Deliveries took ${Math.round(d.time[lateSv])} min at ${lateSv}, over the ${t.promise} min promise: ${reason}` });
  }
  const s = d?.scores;
  if (s) {
    const weakest = (['food', 'time', 'value'] as const).reduce((a, b) => (s[a] <= s[b] ? a : b));
    if (s[weakest] < 0.65) {
      if (weakest === 'food') {
        const fixes: string[] = [];
        if (dl.packaging === 'basic') fixes.push('insulated eco packaging');
        if ((packingOf(state)?.deliveryFood ?? 0) <= 0) fixes.push('a Heated Packing Station');
        fixes.push('better ingredient tiers on your delivery favourites');
        tips.push({ weight: 50, text: `Food arrives at ${Math.round(s.food * 100)} out of 100: that is what drags your delivery rating most. Try ${fixes.join(', ')}.` });
      } else if (weakest === 'value') {
        tips.push({
          weight: 50,
          text: dl.markup > 0.05
            ? `Guests find your app prices steep (value ${Math.round(s.value * 100)}). Cut the app markup from ${Math.round(dl.markup * 100)}%, or run a deal like Second pizza 25% off.`
            : `Guests find your app prices steep (value ${Math.round(s.value * 100)}). A deal like 10% off or Second pizza 25% off makes the price feel right.`,
        });
      }
    }
  }
  if (!dl.deal) {
    tips.push({ weight: 40, text: `No deal is running. ${DELIVERY_DEALS.secondPizza25.name} brings about ${Math.round(DELIVERY_DEALS.secondPizza25.orderLift * 100)}% more orders and bigger baskets; prices go down, volume goes up. Pick one under Deals.` });
  } else if (d && d.profit < 0 && (d.dealGiven ?? 0) + (d.feesWaived ?? 0) > Math.abs(d.profit)) {
    tips.push({ weight: 65, text: `Delivery lost $${Math.round(-d.profit)} today and the ${DELIVERY_DEALS[dl.deal].name} deal gave away $${Math.round((d.dealGiven ?? 0) + (d.feesWaived ?? 0))}. Try a lighter deal, or raise the app markup a little to pay for it.` });
  }
  const promos = (['promotedListing', 'appVoucher', 'doorHangers', 'foodInfluencer', 'flyers'] as const)
    .filter((id) => campaignUnlocked(state, CAMPAIGNS[id]) && !running(state, id));
  const anyRunning = (['promotedListing', 'appVoucher', 'doorHangers', 'foodInfluencer', 'flyers'] as const).some((id) => running(state, id));
  const promo = promos[0];
  const audience = audienceOf(dl);
  if (audience < 0.5 && !anyRunning) {
    // The audience barely grows on its own (6.13): this is the first thing to fix.
    tips.push({
      weight: 95 - 60 * audience,
      text: `Only ${Math.round(audience * 100)}% of the neighbourhood knows you deliver, and word of mouth alone adds well under 1% a day. Run delivery campaigns to build it${promo ? `: ${CAMPAIGNS[promo].name} is a good start` : ''}.`,
    });
  } else if (promo) {
    const c = CAMPAIGNS[promo];
    tips.push({ weight: anyRunning ? 20 : 35, text: `Delivery marketing: ${c.name} (${c.effect.charAt(0).toLowerCase()}${c.effect.slice(1)}). Start it in Marketing.` });
  }
  if (dl.mode === 'own' && d && d.wanted < 15) tips.push({ weight: 30, text: 'Your own ordering page reaches only the people who already know you (40% of the app). Listing on Scoot with your own riders reaches everyone for 14% commission.' });
  if (dl.mode === 'platform' && d && d.profit < 0 && d.delivered > 20) tips.push({ weight: 45, text: 'The app takes 30% of every order. With your own riders on Scoot it takes 14% and you keep the delivery fee: worth it from about 25 orders a day.' });
  if (!dl.topRated && dl.drep >= t.topRatedDrep - 10) {
    tips.push({ weight: 25, text: dl.drep >= t.topRatedDrep
      ? `${dl.topRatedDays} of ${t.topRatedDays} days at a delivery rating of ${t.topRatedDrep}: keep it there for Top rated and ${Math.round((t.topRatedBoost - 1) * 100)}% more orders.`
      : `Delivery rating ${dl.drep.toFixed(0)}: at ${t.topRatedDrep} for ${t.topRatedDays} days you become Top rated on Scoot, worth ${Math.round((t.topRatedBoost - 1) * 100)}% more orders.` });
  }
  if (d?.bySegment) {
    const bySeg = Object.entries(d.bySegment) as [SegmentId, number][];
    const top = bySeg.sort((a, b) => b[1] - a[1])[0];
    if (top && d.delivered > 5 && top[1] / d.delivered > 0.45) {
      tips.push({ weight: 15, text: `${SEGMENTS[top[0]].name} place ${Math.round((top[1] / d.delivered) * 100)}% of your orders. Dishes and prices they like keep them coming${top[0] === 'students' ? '; the Student deal counts for delivery too' : ''}.` });
    }
  }
  return tips.sort((a, b) => b.weight - a.weight).slice(0, max).map((x) => x.text);
}
