// Set menus in the dining room (service-deals.md): which one runs at a service, and what the menu lacks for it.

import { COURSE_NAMES, type Course, SERVICE_DEALS, type ServiceDeal, type ServiceDealId } from '../data/serviceDeals';
import type { Service } from '../data/types';
import type { GameState } from './state';

/** The set menu chosen for a service, or null. */
export function serviceDealId(state: Pick<GameState, 'serviceDeals'>, sv: Service): ServiceDealId | null {
  const id = state.serviceDeals?.[sv] ?? null;
  return id && SERVICE_DEALS[id]?.service === sv ? id : null;
}

/** Courses of a set menu with no dish of that kind on the menu. */
export function dealMissing(state: Pick<GameState, 'recipes'>, id: ServiceDealId): Course[] {
  const kinds = new Set(state.recipes.filter((r) => r.onMenu).map((r) => r.kind));
  return SERVICE_DEALS[id].courses.filter((k) => !kinds.has(k));
}

/** The set menu that actually runs at a service: chosen, and every course on the menu. */
export function liveDeal(state: Pick<GameState, 'serviceDeals' | 'recipes'>, sv: Service): ServiceDeal | null {
  const id = serviceDealId(state, sv);
  return id && !dealMissing(state, id).length ? SERVICE_DEALS[id] : null;
}

/** "Needs a starter and a dessert on the menu." */
export function missingText(missing: readonly Course[]): string {
  const names = missing.map((k) => COURSE_NAMES[k]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] ?? '';
  return `Needs ${list} on the menu`;
}
