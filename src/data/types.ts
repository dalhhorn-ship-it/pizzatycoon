// Shapes of the content and balance data. Every number is a tuning assumption from 01-product/balance.md.

export type SegmentId = 'students' | 'families' | 'professionals' | 'foodies' | 'seniors' | 'tourists';
export type Tag = 'cheesy' | 'spicy' | 'classic' | 'artisan' | 'veggie' | 'seasonal' | 'kid friendly' | 'meaty' | 'bold';
export type TierId = 'basic' | 'standard' | 'premium' | 'artisan';
export type Category = 'dry' | 'dairy' | 'produce' | 'meat' | 'seafood' | 'drinks';
export type DishKind = 'pizza' | 'primo' | 'secondo' | 'starter' | 'drink' | 'dessert';
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

export interface Premises {
  id: string;
  name: string;
  diningWidth: number;
  diningHeight: number;
  kitchenTiles: number;
  kitchenWidth: number;
  kitchenHeight: number;
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
}

export type EquipmentFamily = 'basic' | 'volume' | 'quality' | 'artisan' | 'hybrid';
export type EquipmentRole = 'oven' | 'counter' | 'sheeter' | 'pass' | 'dishMachine' | 'proving' | 'cold' | 'sink';

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
  maintenance: number;
  unlock: Unlock;
  blurb: string;
  short: string;
}

export type FurnitureKind = 'table' | 'decor';

export interface FurnitureItem {
  id: string;
  name: string;
  kind: FurnitureKind;
  w: number;
  h: number;
  price: number;
  seats: number;
  decorPoints: number;
  lighting: number;
  comfort: number;
  color: string;
}

export type Role = 'chef' | 'cook' | 'server' | 'host' | 'dishwasher';

export type TraitId = 'speedy' | 'perfectionist' | 'charmer' | 'steady' | 'mentor' | 'nightOwl' | 'frugal' | 'crowdPleaser';

export interface Trait {
  id: TraitId;
  name: string;
  effect: string;
}
