// Set menus for the dining room (service-deals.md): a lunch deal and a dinner menu of 3, 4 or 5 courses.
// A set menu is a bundle at a discount: more guests at that service, more courses on every bundle, longer tables.
// Every number is a tuning assumption and may move within plus or minus 40%.

import type { DishKind, SegmentId, Service } from './types';

export type ServiceDealId = 'lunch2' | 'lunch3' | 'dinner3' | 'dinner4' | 'dinner5';

/** A course on the set menu besides the main. 'primo' is a pasta before the main (it must be on the menu). */
export type Course = Extract<DishKind, 'starter' | 'dessert' | 'aperitivo' | 'digestivo' | 'primo'>;

export interface ServiceDeal {
  id: ServiceDealId;
  service: Service;
  name: string;
  /** Courses on the bundle besides the main. */
  courses: Course[];
  /** Share off the full price of the bundle. */
  discount: number;
  /** More guests at the service, times each crowd's appeal. */
  lift: number;
  /** Share of the service's guests who take the set menu, times each crowd's appeal (capped at maxTake). */
  take: number;
  /** How much each crowd wants it, 0..1. */
  appeal: Record<SegmentId, number>;
  /** Room ambience at which it sells in full; below it, fewer guests want it (a tasting menu in a bare room). */
  room: number;
  /** Extra minutes at the table for a guest on the set menu. */
  minutes: number;
  effect: string;
  blurb: string;
}

/** At most this share of a service's guests takes the set menu. */
export const MAX_TAKE = 0.85;
/** Below the ambience it needs, take and lift fall by this share per point, to ROOM_FLOOR. */
export const ROOM_SLOPE = 1 / 35;
export const ROOM_FLOOR = 0.1;
/** At the counter, a set menu sells this much less (nobody walks you through the courses). */
export const COUNTER_TAKE = 0.5;

const LUNCH_APPEAL: Record<SegmentId, number> = { professionals: 1, seniors: 0.8, tourists: 0.7, students: 0.6, families: 0.5, foodies: 0.3 };
const DINNER_APPEAL: Record<SegmentId, number> = { foodies: 1, tourists: 0.8, professionals: 0.6, seniors: 0.6, families: 0.3, students: 0.1 };
const TASTING_APPEAL: Record<SegmentId, number> = { foodies: 1, tourists: 0.7, professionals: 0.5, seniors: 0.3, families: 0.1, students: 0 };

export const SERVICE_DEALS: Record<ServiceDealId, ServiceDeal> = {
  lunch2: {
    id: 'lunch2', service: 'lunch', name: 'Two course lunch', courses: ['starter'], discount: 0.12, lift: 0.1, take: 0.5, appeal: LUNCH_APPEAL, room: 0, minutes: 8,
    effect: 'Starter and main 12% off: about +10% lunch guests', blurb: 'Quick and fair. The office crowd is back at the desk in 40 minutes.',
  },
  lunch3: {
    id: 'lunch3', service: 'lunch', name: 'Three course lunch deal', courses: ['starter', 'dessert'], discount: 0.18, lift: 0.18, take: 0.45, appeal: LUNCH_APPEAL, room: 0, minutes: 15,
    effect: 'Starter, main and dessert 18% off: about +18% lunch guests, bigger checks, longer tables', blurb: 'The classic menu del giorno. Fills a quiet lunch, but tables turn slower.',
  },
  dinner3: {
    id: 'dinner3', service: 'dinner', name: 'Three course dinner', courses: ['starter', 'dessert'], discount: 0.12, lift: 0.08, take: 0.35, appeal: DINNER_APPEAL, room: 40, minutes: 15,
    effect: 'Starter, main and dessert 12% off: about +8% dinner guests', blurb: 'An easy yes for couples and visitors. Sells the starters and desserts you already make.',
  },
  dinner4: {
    id: 'dinner4', service: 'dinner', name: 'Four course dinner', courses: ['aperitivo', 'starter', 'dessert'], discount: 0.15, lift: 0.1, take: 0.3, appeal: DINNER_APPEAL, room: 55, minutes: 25,
    effect: 'Aperitivo, starter, main and dessert 15% off: about +10% dinner guests, a bar course on every bundle', blurb: 'An evening out. The aperitivo is where the margin is.',
  },
  dinner5: {
    id: 'dinner5', service: 'dinner', name: 'Five course tasting', courses: ['aperitivo', 'starter', 'primo', 'dessert'], discount: 0.18, lift: 0.14, take: 0.25, appeal: TASTING_APPEAL, room: 70, minutes: 45,
    effect: 'Aperitivo, starter, pasta, main and dessert 18% off: foodies come for it, tables stay long', blurb: 'A tasting menu puts you on the foodie map. Needs a strong kitchen and a room with space.',
  },
};

export const SERVICE_DEAL_IDS = Object.keys(SERVICE_DEALS) as ServiceDealId[];
/** How well a set menu sells in a room of this ambience, ROOM_FLOOR to 1. */
export const roomFit = (d: ServiceDeal, ambience: number): number =>
  ambience >= d.room ? 1 : Math.max(ROOM_FLOOR, 1 - (d.room - ambience) * ROOM_SLOPE);

export const dealsFor = (sv: Service): ServiceDealId[] => SERVICE_DEAL_IDS.filter((id) => SERVICE_DEALS[id].service === sv);

export const COURSE_NAMES: Record<Course, string> = { starter: 'a starter', dessert: 'a dessert', aperitivo: 'an aperitivo', digestivo: 'a digestivo', primo: 'a pasta' };
