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
  profit: number;
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
}

/** What the manager did with the team this week (8.3). */
export interface ManagerLog {
  trained: number;
  hired: number;
  letGo: number;
  raises: number;
  spent: number;
  moraleStart: number;
}

/** Everything that belongs to one restaurant. The one the player runs lives at the top of GameState. */
export const LOCATION_KEYS = [
  'districtId', 'premisesId', 'venueId', 'deposit', 'rep', 'following', 'recipes', 'furniture', 'equipment', 'staff',
  'daysOpen', 'fireSafety', 'roomTouches', 'history', 'departures', 'staffPolicy', 'delegateStaff', 'managerLog',
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
  /** Interviews used this week (free ones first). */
  interviews?: { week: number; used: number };
  /** Recruitment agency orders waiting to arrive. */
  agencyOrders?: { role: Role; min: number; readyDay: number }[];
  /** Difficulty multipliers from the settings menu; missing means Normal. */
  economy?: import('./economy').Economy;
}
