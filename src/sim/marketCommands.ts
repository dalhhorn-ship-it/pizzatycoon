// Commands of the live market: campaigns, holding a venue, the mystery diner and delivery (competition.md).

import { CAMPAIGNS } from '../data/campaigns';
import { DELIVERY_DEALS } from '../data/deliveryDeals';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { type Command, fail, type GameEvent, type Result } from './commands';
import { deliveryMissing, hasPacking, MODE_NAMES, newDelivery, vehicleCount, vehicleSpec } from './delivery';
import { ownedVenues } from './chain';
import { buyPrice, economyOf } from './economy';
import { locationFacts, stateLocation } from './location';
import { campaignCost, campaignUnlocked, campaignUnlockText, newCampaign, slotsUsed, streakOnRestart } from './marketing';
import { rivalAt } from './rivals';
import type { GameState } from './state';

/** Runs a market command on `state` (already a copy of `input`). Returns a failure, or null when it succeeded. */
export function marketCommand(input: GameState, state: GameState, cmd: Command, events: GameEvent[]): Result | null {
  if (cmd.type === 'startCampaign') {
    const c = CAMPAIGNS[cmd.campaignId];
    if (!c) return fail(input, 'Unknown campaign.');
    if (!campaignUnlocked(state, c)) return fail(input, c.unlock === 'delivery' ? `${c.name} needs delivery through the app.` : `Locked: ${campaignUnlockText(c)}.`);
    const running = (state.campaigns ?? []).find((x) => x.id === c.id && (x.renew || state.day < x.endsDay));
    if (running) return fail(input, `${c.name} is already running here.`);
    if (!c.everyRestaurant && slotsUsed(state.campaigns, state.day) >= T.marketing.maxActive) return fail(input, `${T.marketing.maxActive} campaigns are running here; stop one first.`);
    const audience = c.audience === 'choose' ? [...new Set(cmd.audience)] : [];
    if (c.audience === 'choose' && (audience.length < 1 || audience.length > (c.choose ?? 1))) return fail(input, `Pick 1 to ${c.choose ?? 1} crowds to reach.`);
    const facts = stateLocation(state);
    const cost = campaignCost(c, facts.footTraffic);
    if (state.cash < cost) return fail(input, `${c.name} costs $${cost}; you need $${Math.ceil(cost - state.cash)} more.`);
    state.cash -= cost;
    const run = newCampaign(c.id, audience, state.day, facts, streakOnRestart(state.campaigns, c.id, state.day));
    state.campaigns = [...(state.campaigns ?? []).filter((x) => x.id !== c.id), run];
    // Local radio plays in every restaurant you own, paid once.
    if (c.everyRestaurant) for (const b of state.branches) b.campaigns = [...(b.campaigns ?? []).filter((x) => x.id !== c.id), { ...run, spent: 0, renew: false }];
    events.push({ kind: 'info', text: `${c.name} starts today.` });
    return null;
  }
  if (cmd.type === 'stopCampaign') {
    const run = (state.campaigns ?? []).find((x) => x.id === cmd.campaignId && x.renew);
    if (!run) return fail(input, 'That campaign is not renewing.');
    run.renew = false;
    return null;
  }
  if (cmd.type === 'holdVenue') {
    const v = VENUES[cmd.venueId];
    if (!v) return fail(input, 'Unknown venue.');
    if (ownedVenues(state).has(v.id)) return fail(input, 'You already run a restaurant here.');
    if (rivalAt(state, v.id)) return fail(input, 'A rival runs a restaurant there.');
    if (state.venueHold && state.venueHold.untilDay > state.day) return fail(input, 'You can hold one venue at a time.');
    const fee = Math.round(locationFacts(v.districtId, v.premisesId, v.id).weeklyRent * economyOf(state).rent);
    if (state.cash < fee) return fail(input, `Holding costs a week of rent, $${fee}.`);
    state.cash -= fee;
    state.venueHold = { venueId: v.id, untilDay: state.day + T.rivals.holdDays, fee };
    events.push({ kind: 'info', text: `${v.name} is held for you until day ${state.venueHold.untilDay}. The fee comes off the deposit if you take it.` });
    return null;
  }
  if (cmd.type === 'startDelivery') {
    const missing = deliveryMissing(state);
    if (missing.length) return fail(input, `Delivery needs you to ${missing.join(' and ')}.`);
    if (!hasPacking(state)) return fail(input, 'Place a packing station in the kitchen first.');
    if (state.delivery?.on) return fail(input, 'Delivery is already running.');
    state.delivery = state.delivery ? { ...state.delivery, on: true, mode: cmd.mode } : newDelivery(state.day, cmd.mode);
    events.push({ kind: 'info', text: `Delivery starts today: ${MODE_NAMES[cmd.mode]}.` });
    return null;
  }
  if (cmd.type === 'setDelivery') {
    const d = state.delivery;
    if (!d) return fail(input, 'Delivery has not started here.');
    if (cmd.mode) d.mode = cmd.mode;
    if (cmd.markup !== undefined) d.markup = Math.min(0.2, Math.max(0, Math.round(cmd.markup * 100) / 100));
    if (cmd.packaging) d.packaging = cmd.packaging;
    if (cmd.throttle !== undefined) d.throttle = cmd.throttle === null ? null : Math.min(1, Math.max(0.7, cmd.throttle));
    if (cmd.deal !== undefined) {
      if (cmd.deal !== null && !DELIVERY_DEALS[cmd.deal]) return fail(input, 'Unknown deal.');
      d.deal = cmd.deal;
    }
    if (cmd.zone) {
      if (!T.delivery.zones[cmd.zone]) return fail(input, 'Unknown delivery zone.');
      d.zone = cmd.zone;
    }
    if (cmd.minOrder) {
      if (!T.delivery.minOrder[cmd.minOrder]) return fail(input, 'Unknown minimum order.');
      d.minOrder = cmd.minOrder;
    }
    if (cmd.dealDays) {
      if (!['all', 'weekdays', 'weekend'].includes(cmd.dealDays)) return fail(input, 'Unknown deal days.');
      d.dealDays = cmd.dealDays;
    }
    return null;
  }
  if (cmd.type === 'stopDelivery') {
    if (!state.delivery?.on) return fail(input, 'Delivery is not running.');
    state.delivery.on = false;
    events.push({ kind: 'info', text: 'Delivery paused. Your delivery rating stays as it is.' });
    return null;
  }
  if (cmd.type === 'buyVehicle') {
    const d = state.delivery;
    if (!d) return fail(input, 'Start delivery first.');
    const v = vehicleSpec(cmd.kind);
    if (!v) return fail(input, 'Unknown vehicle.');
    const price = buyPrice(state, v.price);
    if (state.cash < price) return fail(input, `${v.name === 'E-bike' ? 'An' : 'A'} ${v.name.toLowerCase()} costs $${price}.`);
    state.cash -= price;
    d.vehicles = { ...d.vehicles, [cmd.kind]: vehicleCount(d, cmd.kind) + 1 };
    return null;
  }
  if (cmd.type === 'sellVehicle') {
    const d = state.delivery;
    const v = vehicleSpec(cmd.kind);
    if (!d || !v || vehicleCount(d, cmd.kind) < 1) return fail(input, `There is no ${v?.name.toLowerCase() ?? 'vehicle'} to sell.`);
    d.vehicles = { ...d.vehicles, [cmd.kind]: vehicleCount(d, cmd.kind) - 1 };
    state.cash += Math.round(buyPrice(state, v.price) * 0.8);
    return null;
  }
  if (cmd.type === 'mysteryDiner') {
    const r = state.rivals?.find((x) => x.id === cmd.rivalId && x.closedDay === undefined);
    if (!r) return fail(input, 'That rival is not open.');
    if ((r.mysteryUntil ?? 0) - T.rivals.mysteryDinerDays + 7 > state.day) return fail(input, 'One mystery diner per rival a week.');
    if (state.cash < T.rivals.mysteryDinerPrice) return fail(input, `A mystery diner costs $${T.rivals.mysteryDinerPrice}.`);
    state.cash -= T.rivals.mysteryDinerPrice;
    r.mysteryUntil = state.day + T.rivals.mysteryDinerDays;
    events.push({ kind: 'info', text: `Your mystery diner ate at ${r.name}. Their report is on the rival card for 28 days.` });
    return null;
  }
  return null;
}
