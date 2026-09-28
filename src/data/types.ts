// Shapes of the content and balance data. Every number is a tuning assumption from 01-product/balance.md.

export type SegmentId = 'students' | 'families' | 'professionals' | 'foodies' | 'seniors' | 'tourists';
export type Tag = 'cheesy' | 'spicy' | 'classic' | 'artisan' | 'veggie' | 'seasonal' | 'kid friendly' | 'meaty' | 'bold';
export type TierId = 'basic' | 'standard' | 'premium' | 'artisan';
export type Category = 'dry' | 'dairy' | 'produce' | 'meat' | 'seafood' | 'drinks';
export type DishKind = 'pizza' | 'primo' | 'secondo' | 'starter' | 'drink' | 'dessert' | 'aperitivo' | 'digestivo';
/** Guests order one main: a pizza, a primo (pasta, risotto, gnocchi) or a secondo (meat or fish). */
export type MainKind = 'pizza' | 'primo' | 'secondo';
export type Service = 'lunch' | 'dinner';

export interface Segment {
  id: SegmentId;
  name: string;
  elasticity: number;
  budget: number;
  qualityAppeal: number;
  qualityWeight: number;
  waitTolerance: { lunch: number; dinner: number };
  mealLength: { lunch: number; dinner: number };
  partySize: number;
  likedTags: readonly Tag[];
  speedAppealAtLunch: boolean;
}

export interface District {
  id: string;
  name: string;
  blurb: string;
  footTraffic: number;
  shares: Record<SegmentId, number>;
  wealth: number;
  competition: number;
  rentPerTile: number;
  lunchShare: number;
}

/** One rentable shop front on the city map (01-product/city-map.md 4). */
export interface Venue {
  id: string;
  name: string;
  address: string;
  districtId: string;
  premisesId: string;
  /** Replaces the district rent for this venue. */
  rentPerTile: number;
  trafficMult: number;
  competitionDelta: number;
  lunchShareDelta: number;
  wealthMult: number;
  /** Multiplies segment shares before they are renormalised. */
  tilt: Partial<Record<SegmentId, number>>;
  /** Pin position on the 100 x 70 city map. */
  x: number;
  y: number;
  pros: readonly string[];
  cons: readonly string[];
}

export interface Premises {
  id: string;
  name: string;
  diningWidth: number;
  diningHeight: number;
  /** Kitchen tiles counted for rent and deposit (balance.md tuning). */
  kitchenTiles: number;
  /** The kitchen floor plan the player builds on; roomier than the rented tile count on purpose (founder request). */
  kitchenWidth: number;
  kitchenHeight: number;
  /** Share of passers-by who notice the place (balance.md 4.3): a narrow shopfront is easy to walk past. */
  visibility: number;
}

export interface QualityTier {
  id: TierId;
  name: string;
  quality: number;
  priceMult: number;
  shelfLifeMult: number;
  wasteRate: number;
}

export interface Supplier {
  id: string;
  name: string;
  priceIndex: number;
  qualityOffset: number;
  reliability: number;
  leadDays: number;
  minOrder: number;
  carries: Partial<Record<Category, readonly TierId[]>>;
}

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  /** Cost of one portion at Standard tier and price index 1.00. */
  portionCost: number;
  shelfLifeDays: number;
  tags: readonly Tag[];
  /** True for dough, sauce, mozzarella, pasta and rice: they do not count as toppings or extras. */
  base?: boolean;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  kind: DishKind;
  ingredients: readonly string[];
  price: number;
  onMenu: boolean;
  /** Extra tags the dish carries regardless of ingredients (sides mostly). */
  tags?: readonly Tag[];
  /** A wine: a longer wine list gets guests ordering a second glass (balance.md 4.7). */
  wine?: boolean;
}

export type EquipmentFamily = 'basic' | 'volume' | 'quality' | 'artisan' | 'hybrid';
export type EquipmentRole = 'oven' | 'counter' | 'sheeter' | 'pass' | 'dishMachine' | 'proving' | 'cold' | 'sink' | 'handwash' | 'storage' | 'packing';

export type Unlock =
  | { kind: 'start' }
  | { kind: 'served'; guests: number }
  | { kind: 'rep'; rep: number }
  | { kind: 'day'; day: number }
  | { kind: 'rank'; rank: RankId };

export type RankId = 'cook' | 'owner' | 'restaurateur' | 'chainFounder';

export interface EquipmentItem {
  id: string;
  name: string;
  family: EquipmentFamily;
  role: EquipmentRole;
  price: number;
  slots?: number;
  bakeMult?: number;
  /** Prep speed multiplier for counters and sheeters. */
  prepMult?: number;
  /** Serve time multiplier for a pass, dishwashing multiplier for a dish machine. */
  effectMult?: number;
  qualityMod: number;
  skillNeeded: number;
  /** Footprint on the kitchen grid (kitchen-builder.md 3.2); footprint = w x h. */
  w: number;
  h: number;
  footprint: number;
  /** Keeps dough cold: gives touching prep counters the cold at hand bonus (kitchen-builder.md 4). */
  cold?: boolean;
  /** Kitchen bottlenecks (kitchen-bottlenecks.md): how much of a cook an oven needs (default 0.5). */
  tend?: number;
  /** Dishwashers who can work at this station at once. */
  washers?: number;
  /** Places for cooks to wash hands, tools and pans. */
  washPoints?: number;
  /** Dough for this many pizzas a day. */
  coldCap?: number;
  /** Extra clean plates in stock. */
  plateStock?: number;
  /** Packing stations: added to how well food survives the ride. */
  deliveryFood?: number;
  maintenance: number;
  unlock: Unlock;
  blurb: string;
  short: string;
}

/** Standing places (a bar counter, a window ledge) hold guests who eat quickly on their feet (floor-service.md 3). */
export type FurnitureKind = 'table' | 'standing' | 'decor';

export interface FurnitureItem {
  id: string;
  name: string;
  kind: FurnitureKind;
  w: number;
  h: number;
  price: number;
  /** Seats at a table, or standing places at a bar. */
  seats: number;
  decorPoints: number;
  lighting: number;
  comfort: number;
  color: string;
}

export type Role = 'chef' | 'cook' | 'server' | 'host' | 'dishwasher' | 'manager' | 'rider';

/** The four key attributes of a staff member, 1 to 99 (staff-management.md 2). */
export type AttrId = 'quality' | 'speed' | 'composure' | 'mentoring';

/** A fixed performance perk; at most one per person (staff-management.md 2.4). */
export type TalentId = 'speedy' | 'perfectionist' | 'charmer' | 'nightOwl' | 'frugal' | 'crowdPleaser' | 'eagerLearner' | 'bigGame';

/** What makes a person happy or unhappy (staff-management.md 5.2). */
export type PersonalityId =
  | 'thrillSeeker' | 'calmSoul' | 'craftsperson' | 'racer' | 'gloryHunter' | 'moneyMinded'
  | 'ambitious' | 'teamPlayer' | 'steady' | 'loyal' | 'easyGoing' | 'hothead';

export interface Talent {
  id: TalentId;
  name: string;
  effect: string;
}

export interface Personality {
  id: PersonalityId;
  name: string;
  /** Plain words: what they react to. */
  effect: string;
  /** Relative chance on the market. */
  weight: number;
}
