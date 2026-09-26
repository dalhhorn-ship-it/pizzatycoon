import type { DishKind, RankId, Role, SegmentId, Service, TierId, TraitId } from '../data/types';

export const SCHEMA_VERSION = 5;

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

export interface Staff {
  id: number;
  name: string;
  role: Role;
  skill: number;
  potential: number;
  fame: number;
  traits: TraitId[];
  morale: number;
  salary: number;
  shiftsWorked: number;
  lowMoraleDays: number;
  leavingOnDay: number | null;
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
  bottleneck: 'seats' | 'oven' | 'prep' | 'plates' | 'none';
  tableCycle: number;
  /** Minutes from order to plate: cook time plus queueing when the kitchen runs near capacity. */
  ticketTime: number;
  /** Service pipeline in covers per hour (kitchen-builder.md 6). */
  stages: { prep: number; oven: number; seats: number; plates: number };
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
}

/** Everything that belongs to one restaurant. The one the player runs lives at the top of GameState. */
export const LOCATION_KEYS = [
  'districtId', 'premisesId', 'venueId', 'deposit', 'rep', 'following', 'recipes', 'furniture', 'equipment', 'staff',
  'daysOpen', 'fireSafety', 'history',
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
  history: DayReport[];
  /** Id of the restaurant the player runs right now (the fields above). */
  locationId: number;
  /** The other restaurants the player owns, run by their managers (prd.md 5.9, 5.12). */
  branches: Location[];
  unlockAll: boolean;
  /** Difficulty multipliers from the settings menu; missing means Normal. */
  economy?: import('./economy').Economy;
}
