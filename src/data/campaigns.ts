// Marketing campaigns (competition.md 5.1). Prices, lifts and audiences may move within plus or minus 40%.

import type { SegmentId, Unlock } from './types';

export type CampaignId =
  | 'flyers' | 'social' | 'studentDeal' | 'familySundays' | 'lunchClub' | 'tourGuide' | 'foodiePress' | 'loyalty' | 'radio' | 'promotedListing'
  | 'appVoucher' | 'doorHangers' | 'foodInfluencer';

export interface Campaign {
  id: CampaignId;
  name: string;
  /** Cost of one run (or of the setup for loyalty cards). */
  cost: number;
  /** Cost scales with the venue's foot traffic. */
  scaled: boolean;
  runDays: number;
  /** Renews every run until stopped (weekly campaigns and the tourist listing); false for one offs. */
  renews: boolean;
  /** Dining lift on the segments it reaches. */
  lift: number;
  /**
   * Who it reaches: fixed weights per segment, or 'choose' (the player picks up to `choose` segments; weight = reach).
   */
  audience: Partial<Record<SegmentId, number>> | 'choose';
  reach?: Partial<Record<SegmentId, number>>;
  choose?: number;
  deliveryLift: number;
  awareness: number;
  /** 'delivery': needs delivery through the app; 'deliveryAny': needs delivery running in any mode. */
  unlock: Unlock | 'delivery' | 'deliveryAny';
  /** Plain words: what it does. */
  effect: string;
  blurb: string;
  lunchOnly?: boolean;
  /** Extra lift on Sundays. */
  sundayLift?: number;
  /** Students pay this much less for mains. */
  discount?: { segment: SegmentId; share: number };
  /** Loyalty cards: share of dining sales, following decline x0.5 and target +0.05. */
  salesShare?: number;
  /** Radio: covers every restaurant the player owns and needs no slot. */
  everyRestaurant?: boolean;
  /** Rivals may use it. */
  rivals: boolean;
}

const ALL = { students: 1, families: 1, professionals: 1, foodies: 1, seniors: 1, tourists: 1 };

export const CAMPAIGNS: Record<CampaignId, Campaign> = {
  flyers: {
    id: 'flyers', name: 'Street flyers', cost: 120, scaled: true, runDays: 7, renews: true, lift: 0.03, audience: ALL, deliveryLift: 0.1, awareness: 0.02,
    unlock: { kind: 'start' }, effect: '+3% of everyone, and letterbox menus for delivery', blurb: 'Cheap paper, every letterbox on the street.', rivals: true,
  },
  social: {
    id: 'social', name: 'Social media ads', cost: 300, scaled: true, runDays: 7, renews: true, lift: 0.18, audience: 'choose', choose: 2,
    reach: { students: 1, professionals: 1, foodies: 1, tourists: 0.8, families: 0.6, seniors: 0.3 }, deliveryLift: 0.15, awareness: 0.03,
    unlock: { kind: 'day', day: 8 }, effect: '+18% of the guests you target', blurb: 'Pick one or two crowds; phones do the rest.', rivals: true,
  },
  studentDeal: {
    id: 'studentDeal', name: 'Student deal', cost: 100, scaled: true, runDays: 7, renews: true, lift: 0.15, audience: { students: 1 }, deliveryLift: 0.2, awareness: 0.02,
    unlock: { kind: 'day', day: 8 }, effect: '+15% students, and students pay 10% less for mains', blurb: 'Show your card, save 10%.', discount: { segment: 'students', share: 0.1 }, rivals: true,
  },
  familySundays: {
    id: 'familySundays', name: 'Family Sundays', cost: 200, scaled: true, runDays: 7, renews: true, lift: 0.15, sundayLift: 0.4, audience: { families: 1 }, deliveryLift: 0, awareness: 0.02,
    unlock: { kind: 'day', day: 8 }, effect: '+15% families, +40% on Sundays', blurb: 'Kids eat free on Sunday.', rivals: true,
  },
  lunchClub: {
    id: 'lunchClub', name: 'Business lunch club', cost: 250, scaled: true, runDays: 7, renews: true, lift: 0.2, lunchOnly: true, audience: { professionals: 1 }, deliveryLift: 0, awareness: 0.02,
    unlock: { kind: 'served', guests: 500 }, effect: '+20% professionals at lunch', blurb: 'A stamp card for the office crowd.', rivals: true,
  },
  tourGuide: {
    id: 'tourGuide', name: 'Tourist guide listing', cost: 500, scaled: true, runDays: 28, renews: true, lift: 0.18, audience: { tourists: 1 }, deliveryLift: 0, awareness: 0.01,
    unlock: { kind: 'rep', rep: 45 }, effect: '+18% tourists for 28 days', blurb: 'A page in the city guide every visitor carries.', rivals: true,
  },
  foodiePress: {
    id: 'foodiePress', name: 'Foodie press night', cost: 900, scaled: false, runDays: 14, renews: false, lift: 0.25,
    audience: { foodies: 1, professionals: 0.4, tourists: 0.4 }, deliveryLift: 0, awareness: 0.03,
    unlock: { kind: 'rep', rep: 50 }, effect: '+25% foodies for 14 days; the critics may add or take a little reputation', blurb: 'Invite the food writers. Better be good.', rivals: true,
  },
  loyalty: {
    id: 'loyalty', name: 'Loyalty cards', cost: 300, scaled: false, runDays: 7, renews: true, lift: 0, audience: {}, deliveryLift: 0.05, awareness: 0,
    unlock: { kind: 'rank', rank: 'owner' }, effect: 'Regulars stay: following falls half as fast; costs 3% of dining sales', blurb: 'The tenth pizza is on us.', salesShare: 0.03, rivals: false,
  },
  radio: {
    id: 'radio', name: 'Local radio', cost: 1000, scaled: false, runDays: 7, renews: true, lift: 0.1, everyRestaurant: true,
    audience: { families: 1, seniors: 1, professionals: 0.8, students: 0.3, foodies: 0.3, tourists: 0.3 }, deliveryLift: 0.1, awareness: 0.03,
    unlock: { kind: 'rank', rank: 'owner' }, effect: '+10% at every restaurant you own; needs no slot', blurb: 'A jingle the whole city hums.', rivals: false,
  },
  promotedListing: {
    id: 'promotedListing', name: 'Promoted delivery listing', cost: 250, scaled: false, runDays: 7, renews: true, lift: 0, audience: {}, deliveryLift: 0.3, awareness: 0,
    unlock: 'delivery', effect: '+30% delivery orders', blurb: 'Top of the app, for a fee.', rivals: true,
  },
  appVoucher: {
    id: 'appVoucher', name: 'Welcome voucher on the app', cost: 200, scaled: false, runDays: 7, renews: true, lift: 0, audience: {}, deliveryLift: 0.25, awareness: 0.01,
    unlock: 'delivery', effect: '+25% delivery orders from people trying you for the first time', blurb: '$5 off a first order. New faces, some of them stay.', rivals: false,
  },
  doorHangers: {
    id: 'doorHangers', name: 'Door hanger menus', cost: 90, scaled: true, runDays: 7, renews: true, lift: 0, audience: {}, deliveryLift: 0.15, awareness: 0.01,
    unlock: 'deliveryAny', effect: '+15% delivery orders, in the neighbouring streets too', blurb: 'A menu on every door handle, a fridge magnet inside.', rivals: false,
  },
  foodInfluencer: {
    id: 'foodInfluencer', name: 'Food influencer unboxing', cost: 600, scaled: false, runDays: 7, renews: false, lift: 0.04,
    audience: { students: 1, professionals: 0.6, foodies: 0.5 }, deliveryLift: 0.35, awareness: 0.03,
    unlock: 'deliveryAny', effect: '+35% delivery orders for a week, a little buzz in the room too', blurb: 'A local foodie opens your box on camera. One week of fame.', rivals: false,
  },
};

export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS) as CampaignId[];
