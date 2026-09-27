import type { CampaignId } from '../data/campaigns';
import type { ArchetypeId, RivalTier } from '../data/rivals';
import type { AttrId, DishKind, PersonalityId, RankId, Role, SegmentId, Service, TalentId, TierId } from '../data/types';

export const SCHEMA_VERSION = 6;

export interface RecipeLine {
  ingredientId: string;
  tier: TierId;
  supplierId: string;
}

export interface Recipe {
  id: string;
  name: string;
  kind: DishKind;
  lines: RecipeLine[];
  price: number;
  onMenu: boolean;
  extraTags: string[];
  custom: boolean;
}

export interface PlacedFurniture {
  uid: number;
  itemId: string;
  x: number;
  y: number;
  /** Price actually paid; refunds are 80% of this. */
  paid?: number;
}

export interface OwnedEquipment {
  uid: number;
  itemId: string;
  /** Top left tile on the kitchen grid and rotation (0 or 1 = turned 90 degrees). */
  x: number;
  y: number;
  rot: 0 | 1;
  /** Price actually paid; refunds are 80% of this. */
  paid?: number;
  /** Installed add-ons (kitchen-upgrades.md 2). */
  addons?: InstalledAddon[];
}

export interface InstalledAddon {
  id: string;
  paid: number;
}

export type Attrs = Record<AttrId, number>;

// ---------- Competition, marketing and delivery (competition.md) ----------

/** A running campaign at one restaurant (competition.md 5). */
export interface ActiveCampaign {
  id: CampaignId;
  audience: SegmentId[];
  startDay: number;
  /** First day it no longer runs. */
  endsDay: number;
  /** Renews at the end of each run until stopped. */
  renew: boolean;
  /** Weeks in a row this campaign has run (fatigue). */
  weeksRunning: number;
  /** Cost of the current run. */
  spent: number;
}

export type DeliveryMode = 'platform' | 'marketplace' | 'own';

/** Food delivery at one restaurant (competition.md 6). */
export interface DeliveryState {
  on: boolean;
  mode: DeliveryMode;
  /** Delivery price markup, 0 to 0.2. */
  markup: number;
  packaging: 'basic' | 'eco';
  /** Pause the app at this kitchen load; null = never. */
  throttle: number | null;
  /** Delivery reputation, separate from the dining reputation. */
  drep: number;
  since: number;
  vehicles: { bike: number; scooter: number };
  /** Days in a row at or above the Top rated threshold, and whether the badge is held. */
  topRatedDays: number;
  topRated: boolean;
}

export interface RivalCampaign {
  id: CampaignId;
  audience: SegmentId[];
  endsDay: number;
  weeksRunning: number;
}

export interface RivalLocation {
  venueId: string;
  opened: number;
  tier: RivalTier;
  priceIndex: number;
  rep: number;
  following: number;
  drep: number;
  delivery: boolean;
  campaigns: RivalCampaign[];
  cutsInRow: number;
  cutCooldownUntil: number;
  rescued: boolean;
  weeksLosing: number;
  /** Days this week the room was over capacity. */
  overDays: number;
  /** This week so far. */
  week: { served: number; profit: number; sales: number; bySegment: Record<SegmentId, number> };
  /** The last 12 weeks. */
  history: { served: number; profit: number; bySegment: Record<SegmentId, number> }[];
  /** Yesterday, for the rival card. */
  last: { served: number; profit: number; satisfaction: number; lowest: string; bySegment: Record<SegmentId, number>; deliveryOrders: number };
}

export interface Rival {
  id: number;
  name: string;
  owner: string;
  motto: string;
  archetype: ArchetypeId;
  skillOffset: number;
  cash: number;
  founded: number;
  closedDay?: number;
  locations: RivalLocation[];
  /** A free venue it is viewing before signing (7 days' notice). */
  viewing?: { venueId: string; signsOn: number };
  /** Mystery diner report valid until this day. */
  mysteryUntil?: number;
  /** First day any of its locations came within reach of a player restaurant. */
  seenSince?: number;
}

export interface NewsItem {
  day: number;
  text: string;
  districtId: string;
  kind: 'opening' | 'viewing' | 'closing' | 'price' | 'tier' | 'campaign' | 'delivery' | 'rescue';
  rivalId: number;
}

/** A restaurant's market on one day (competition.md 7.4). */
export interface MarketDay {
  /** Competition per segment the day ran with. */
  cEff: Record<SegmentId, number>;
  /** The restaurant's attractiveness per segment at the start of the day. */
  A: Record<SegmentId, number>;
  served: Record<SegmentId, number>;
  lost: Record<SegmentId, number>;
  /** Guests lost per rival id, by segment. */
  lostByRival: Record<number, Record<SegmentId, number>>;
}

/** Delivery on one day (competition.md 8.1). */
export interface DeliveryDay {
  wanted: number;
  accepted: number;
  refused: number;
  cancelled: number;
  delivered: number;
  time: Record<Service, number>;
  drepBefore: number;
  drepAfter: number;
  profit: number;
  kitchenShare: number;
  topRated: boolean;
}

/** One line of the mood breakdown on the player card (staff-management.md 5). */
export interface MoodDriver {
  label: string;
  value: number;
}

export interface Staff {
  id: number;
  name: string;
  role: Role;
  /** Quality, Speed, Composure, Mentoring, 1 to 99 (staff-management.md 2). */
  attrs: Attrs;
  /** OVR ceiling, 30 to 95. */
  potential: number;
  fame: number;
  talent: TalentId | null;
  personality: PersonalityId[];
  morale: number;
  salary: number;
  shiftsWorked: number;
  lowMoraleDays: number;
  leavingOnDay: number | null;
  /** Day they joined (or appeared on the market, for candidates). */
  hiredDay: number;
  /** Fractional attribute points on their way: natural growth and coaching. */
  growthXp: number;
  /** Coaching progress per attribute (a coach, or the manager at a managed restaurant). */
  coachXp: Partial<Attrs>;
  /** Last day any attribute grew. */
  lastDevelopedDay: number | null;
  /** Coaching a teammate: who and what (on the coach). */
  coaching: { traineeId: number; attr: AttrId } | null;
  /** On a course: off the rota until endsDay, gains applied then. */
  course: { id: string; endsDay: number; gains: Partial<Attrs> } | null;
  /** Days off (a break): off the rota until this day. */
  offUntil: number | null;
  lastCourseDay: number | null;
  certs: string[];
  nextReviewDay: number;
  /** A contract review waiting for an answer: they ask this salary. */
  review: { ask: number; untilDay: number } | null;
  /** A rival's offer (staff-management.md 6.2). */
  offer: { rival: string; salary: number; leavesOnDay: number } | null;
  /** Consecutive days in the high (+) or low (-) morale band; form follows it. */
  formDays: number;
  /** Where morale is heading and why, as of the last day. */
  moodTarget: number;
  moodDrivers: MoodDriver[];
  /** Contribution in $ per day for the last 14 open days (staff-management.md 7). */
  contrib: number[];
  /** Last promotion day (Ambitious). */
  promotedDay: number | null;
  /** Market only: interviewed, scouting offsets per attribute, apprentice. */
  scouted?: boolean;
  scout?: Attrs;
  apprentice?: boolean;
}

export interface Loan {
  balance: number;
  annualRate: number;
  weeksLeft: number;
  pausedWeeks: number;
}

export interface Review {
  segment: SegmentId;
  stars: number;
  text: string;
}

export interface ServiceReport {
  service: Service;
  demand: number;
  served: number;
  walkAways: number;
  capacity: number;
  rho: number;
  queueDelay: number;
  bottleneck: 'seats' | 'oven' | 'prep' | 'plates' | 'cold' | 'none';
  tableCycle: number;
  /** Minutes from order to plate: cook time plus queueing when the kitchen runs near capacity. */
  ticketTime: number;
  /** Service pipeline in covers per hour (kitchen-builder.md 6). */
  /** Guests per hour each stage handles; cold is the fridges' dough for the day spread over the service. */
  stages: { prep: number; oven: number; seats: number; plates: number; cold?: number };
  /** Demand per hour of effective service time. */
  demandPerHour: number;
}

export interface SegmentReport {
  segment: SegmentId;
  demand: number;
  served: number;
  satisfaction: number;
  scores: { food: number; service: number; ambience: number; value: number; wait: number };
}

export interface PnL {
  sales: number;
  ingredients: number;
  waste: number;
  staff: number;
  rent: number;
  utilities: number;
  upkeep: number;
  interest: number;
  /** Campaign spend charged today and loyalty card discounts (competition.md 5.2). */
  marketing?: number;
  /** The part of marketing paid in cash when a campaign run started (not again at the day's settlement). */
  marketingPrepaid?: number;
  /** Delivery (competition.md 6.7): sales, and commission, packaging, riders and vehicles, utilities. */
  deliverySales?: number;
  deliveryCosts?: number;
  profit: number;
}

/**
 * What a day's settlement moves in cash: everything except staff and rent (paid on Sunday), loan interest (paid with the
 * loan) and campaign runs already paid when they started.
 */
export function dailyCash(p: PnL): number {
  return p.sales + (p.deliverySales ?? 0) - p.ingredients - p.waste - p.utilities - p.upkeep - ((p.marketing ?? 0) - (p.marketingPrepaid ?? 0)) - (p.deliveryCosts ?? 0);
}

/** Profit from the P&L lines; delivery food cost is inside ingredients. */
export function profitOf(p: PnL): number {
  return p.sales + (p.deliverySales ?? 0) - p.ingredients - p.waste - p.staff - p.rent - p.utilities - p.upkeep - p.interest -
    (p.marketing ?? 0) - (p.deliveryCosts ?? 0);
}

export interface DayReport {
  day: number;
  weekday: number;
  open: boolean;
  closedReason: string | null;
  covers: number;
  walkAways: number;
  services: ServiceReport[];
  segments: SegmentReport[];
  dishSales: Record<string, number>;
  satisfaction: number;
  reviews: Review[];
  repBefore: number;
  repAfter: number;
  /** Local following before and after the day, and where satisfaction is pulling it (balance.md 4.3). */
  followingBefore: number;
  followingAfter: number;
  followingTarget: number;
  pnl: PnL;
  cashBefore: number;
  cashAfter: number;
  weeklyPayments: number;
  tips: string[];
  /** The player's other restaurants on the same day (chain). */
  branches?: BranchDay[];
  /** Each staff member's day against a standard replacement (staff-management.md 7). */
  team?: TeamLine[];
  /** Competition (competition.md 7.4) and delivery (6). */
  market?: MarketDay;
  delivery?: DeliveryDay;
  /** At most two mood lines a day. */
  mood?: string[];
}

export interface TeamLine {
  id: number;
  name: string;
  role: Role;
  ovr: number;
  ovrBefore: number;
  morale: number;
  moraleBefore: number;
  form: -1 | 0 | 1;
  /** Profit per day against a standard replacement. */
  value: number;
  reason: string;
}

/** How the manager runs the team at a restaurant (staff-management.md 8.1). */
export interface StaffPolicy {
  budget: number;
  pay: 'tight' | 'fair' | 'generous';
  focus: 'strategy' | 'value' | 'youth';
  replace: boolean;
  /** Weekly budget for kitchen stations that fix a bottleneck (kitchen-bottlenecks.md 5). */
  kitchenBudget: number;
}

/** What the manager did with the team this week (8.3). */
export interface ManagerLog {
  trained: number;
  hired: number;
  letGo: number;
  raises: number;
  spent: number;
  moraleStart: number;
  /** Kitchen fixes this week, in words, and what they cost. */
  kitchen?: string[];
  kitchenSpent?: number;
}

/** Everything that belongs to one restaurant. The one the player runs lives at the top of GameState. */
export const LOCATION_KEYS = [
  'districtId', 'premisesId', 'venueId', 'deposit', 'rep', 'following', 'recipes', 'furniture', 'equipment', 'staff',
  'daysOpen', 'fireSafety', 'roomTouches', 'history', 'departures', 'staffPolicy', 'delegateStaff', 'managerLog', 'campaigns', 'delivery',
] as const;
export type LocationKey = (typeof LOCATION_KEYS)[number];
export type Location = Pick<GameState, LocationKey> & { id: number };

/** How a managed restaurant did today, for the day report. */
export interface BranchDay {
  id: number;
  name: string;
  open: boolean;
  covers: number;
  profit: number;
  manager: string | null;
  managerSkill: number;
  /** Weekly line on what the manager did with the team (Sundays). */
  staffLine?: string;
  proposal?: string;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  day: number;
  districtId: string;
  premisesId: string;
  /** The rented venue on the city map (city-map.md 4); null means the plain district (balance harness). */
  venueId: string | null;
  cash: number;
  /** Lease deposit held by the landlord; refunded on a move (fresh-start.md 3). */
  deposit: number;
  loan: Loan;
  rep: number;
  /** Local following 0..1: how many locals know and come back to the restaurant. New restaurants start low. */
  following: number;
  totalServed: number;
  rank: RankId;
  recipes: Recipe[];
  furniture: PlacedFurniture[];
  equipment: OwnedEquipment[];
  staff: Staff[];
  candidates: Staff[];
  nextUid: number;
  daysBelowZero: number;
  /** Days the restaurant actually opened, in this building. */
  daysOpen: number;
  /** Fire safety upgrades installed in this building (src/data/fireSafety.ts). */
  fireSafety: string[];
  /** Decoration on the walls, tables and ceiling (src/data/roomTouches.ts); takes no floor space. */
  roomTouches: string[];
  history: DayReport[];
  /** Id of the restaurant the player runs right now (the fields above). */
  locationId: number;
  /** The other restaurants the player owns, run by their managers (prd.md 5.9, 5.12). */
  branches: Location[];
  unlockAll: boolean;
  /** Recent departures at this restaurant (mood: team driver). */
  departures?: { day: number; letGo: boolean }[];
  /** How the manager runs the team; used at managed restaurants or when delegated. */
  staffPolicy?: StaffPolicy;
  /** "Let my manager handle the team" at the restaurant the player runs. */
  delegateStaff?: boolean;
  managerLog?: ManagerLog;
  /** Marketing campaigns at this restaurant (competition.md 5). */
  campaigns?: ActiveCampaign[];
  /** Food delivery at this restaurant (competition.md 6). */
  delivery?: DeliveryState | null;
  /** Live rival pizzerias in the city (competition.md 3). */
  rivals?: Rival[];
  rivalMeta?: { nextId: number; lastEntrantDay: number; lastEntrantByDistrict: Record<string, number>; pendingEntrants: number; pendingFrom: number };
  marketNews?: NewsItem[];
  /** A free venue the player holds for 28 days (3.5). */
  venueHold?: { venueId: string; untilDay: number; fee: number } | null;
  /** Days the player opened a restaurant, by district: new entrants wait 28 days there. */
  openedIn?: Record<string, number>;
  /** Every restaurant the player owns (set for a managed restaurant's day, so cannibalisation sees them all). */
  ownList?: { id: number; districtId: string; venueId: string | null }[];
  /** Interviews used this week (free ones first). */
  interviews?: { week: number; used: number };
  /** Recruitment agency orders waiting to arrive. */
  agencyOrders?: { role: Role; min: number; readyDay: number }[];
  /** Difficulty multipliers from the settings menu; missing means Normal. */
  economy?: import('./economy').Economy;
}
