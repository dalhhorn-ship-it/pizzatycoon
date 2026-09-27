// Rival pizzerias (competition.md 3): archetypes and the name pool. Values may move within plus or minus 40%.

import type { SegmentId } from './types';

export type ArchetypeId = 'priceFighter' | 'artisan' | 'hypeHouse' | 'honestTrattoria' | 'trendyKitchen' | 'budgetChain';
export type RivalTier = 'basic' | 'standard' | 'premium' | 'artisan';

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** Style weights: price, quality, marketing (sum 1). */
  style: { price: number; quality: number; marketing: number };
  tier: RivalTier;
  /** Tier from skill 7 (Artisan and Honest Trattoria step up). */
  skilledTier?: RivalTier;
  priceIndex: number;
  ambience: number;
  turns: number;
  serviceTime: number;
  /** Target segments; 'top2' means the district's two largest segments. */
  targets: readonly SegmentId[] | 'top2';
  premises: readonly string[];
  /** Rep from which it may start delivery; null = never. */
  deliveryRep: number | null;
  maxLocations: number;
  color: string;
  letter: string;
  /** Plain words for the rival card. */
  competesOn: string;
  /** Where it stays, so it stays recognisable: ingredient tiers and price index. */
  tierRange: [RivalTier, RivalTier];
  priceRange: [number, number];
}

/**
 * Turns per seat per day are calibrated to the player's own restaurants (reference builds turn 1.8 to 2.7 seats a day);
 * the first draft's 2.2 to 4.0 let rivals outearn any real kitchen.
 */
export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  priceFighter: {
    id: 'priceFighter', name: 'Price Fighter', style: { price: 0.7, quality: 0.1, marketing: 0.2 }, tier: 'basic', priceIndex: 0.85,
    ambience: 40, turns: 2.7, serviceTime: 16, targets: ['students', 'families'], premises: ['hole', 'corner', 'large'],
    deliveryRep: 50, maxLocations: 2, color: '#d9822b', letter: 'P', competesOn: 'Cheap and fast', tierRange: ['basic', 'standard'], priceRange: [0.75, 1.0],
  },
  artisan: {
    id: 'artisan', name: 'Artisan', style: { price: 0.1, quality: 0.8, marketing: 0.1 }, tier: 'premium', skilledTier: 'artisan', priceIndex: 1.15,
    ambience: 80, turns: 1.6, serviceTime: 26, targets: ['foodies', 'tourists'], premises: ['cosy', 'medium'],
    deliveryRep: null, maxLocations: 1, color: '#c28f12', letter: 'A', competesOn: 'The best pizza in town', tierRange: ['premium', 'artisan'], priceRange: [1.0, 1.4],
  },
  hypeHouse: {
    id: 'hypeHouse', name: 'Hype House', style: { price: 0.2, quality: 0.2, marketing: 0.6 }, tier: 'standard', priceIndex: 1.0,
    ambience: 60, turns: 2.2, serviceTime: 20, targets: 'top2', premises: ['corner', 'medium', 'loft'],
    deliveryRep: 45, maxLocations: 3, color: '#d04f8f', letter: 'H', competesOn: 'Everywhere on your phone', tierRange: ['basic', 'premium'], priceRange: [0.85, 1.25],
  },
  honestTrattoria: {
    id: 'honestTrattoria', name: 'Honest Trattoria', style: { price: 0.45, quality: 0.45, marketing: 0.1 }, tier: 'standard', skilledTier: 'premium', priceIndex: 0.95,
    ambience: 65, turns: 2.0, serviceTime: 22, targets: ['families', 'seniors', 'professionals'], premises: ['cosy', 'medium'],
    deliveryRep: null, maxLocations: 1, color: '#3f7a45', letter: 'T', competesOn: 'Good food at a fair price', tierRange: ['standard', 'premium'], priceRange: [0.85, 1.15],
  },
  trendyKitchen: {
    id: 'trendyKitchen', name: 'Trendy Kitchen', style: { price: 0.1, quality: 0.45, marketing: 0.45 }, tier: 'premium', priceIndex: 1.1,
    ambience: 75, turns: 1.9, serviceTime: 22, targets: ['professionals', 'foodies', 'tourists'], premises: ['medium', 'loft', 'corner'],
    deliveryRep: 60, maxLocations: 2, color: '#7a4fb0', letter: 'K', competesOn: 'Stylish and talked about', tierRange: ['standard', 'artisan'], priceRange: [1.0, 1.35],
  },
  budgetChain: {
    id: 'budgetChain', name: 'Budget Chain', style: { price: 0.45, quality: 0.1, marketing: 0.45 }, tier: 'basic', priceIndex: 0.9,
    ambience: 45, turns: 2.5, serviceTime: 17, targets: ['students', 'families', 'professionals'], premises: ['hole', 'corner', 'large'],
    deliveryRep: 45, maxLocations: 4, color: '#3d6fb0', letter: 'B', competesOn: 'Cheap, everywhere, well advertised', tierRange: ['basic', 'standard'], priceRange: [0.8, 1.05],
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/** Spawn weights by the district's "Best for" verdict (competition.md 3.1). */
export const SPAWN_WEIGHTS: Record<'Volume' | 'Middle road' | 'Luxury', Record<ArchetypeId, number>> = {
  Volume: { priceFighter: 4, artisan: 1, hypeHouse: 2, honestTrattoria: 2, trendyKitchen: 1, budgetChain: 3 },
  'Middle road': { priceFighter: 2, artisan: 2, hypeHouse: 3, honestTrattoria: 4, trendyKitchen: 2, budgetChain: 2 },
  Luxury: { priceFighter: 1, artisan: 4, hypeHouse: 2, honestTrattoria: 2, trendyKitchen: 3, budgetChain: 1 },
};

export const TIER_Q: Record<RivalTier, number> = { basic: 35, standard: 55, premium: 75, artisan: 90 };
export const TIER_FOOD_COST: Record<RivalTier, number> = { basic: 1.6, standard: 2.4, premium: 3.2, artisan: 4.4 };
export const TIER_ORDER: RivalTier[] = ['basic', 'standard', 'premium', 'artisan'];
export const FIT_OUT: Record<string, number> = { hole: 3000, cosy: 8000, corner: 10000, medium: 12000, loft: 18000, large: 25000 };

export interface RivalName {
  name: string;
  owner: string;
  /** Archetypes this name suits. */
  suits: readonly ArchetypeId[];
}

const ANY: readonly ArchetypeId[] = ['priceFighter', 'artisan', 'hypeHouse', 'honestTrattoria', 'trendyKitchen', 'budgetChain'];
const CHEAP: readonly ArchetypeId[] = ['priceFighter', 'budgetChain', 'hypeHouse'];
const FINE: readonly ArchetypeId[] = ['artisan', 'trendyKitchen', 'honestTrattoria'];
const HOMELY: readonly ArchetypeId[] = ['honestTrattoria', 'artisan'];

export const RIVAL_NAMES: readonly RivalName[] = [
  { name: 'Trattoria Nonna', owner: 'Rosa Bellini', suits: HOMELY },
  { name: 'Pizza Veloce', owner: 'Dario Conti', suits: CHEAP },
  { name: 'Da Enzo', owner: 'Enzo Marchetti', suits: HOMELY },
  { name: 'La Bella Napoli', owner: 'Gennaro Esposito', suits: FINE },
  { name: 'Forno Rosso', owner: 'Luisa Ferri', suits: ANY },
  { name: 'Osteria del Porto', owner: 'Marco Salvi', suits: FINE },
  { name: 'Pizza Pronto', owner: 'Tony Rizzo', suits: CHEAP },
  { name: 'Slice Society', owner: 'Jess Carter', suits: ['hypeHouse', 'budgetChain', 'priceFighter'] },
  { name: 'Crust and Co', owner: 'Mia Novak', suits: ['hypeHouse', 'trendyKitchen', 'budgetChain'] },
  { name: 'Forno Verde', owner: 'Chiara Lodi', suits: ['artisan', 'trendyKitchen'] },
  { name: 'Il Vesuvio', owner: 'Salvatore Greco', suits: ANY },
  { name: 'Dough Brothers', owner: 'Ben and Sam Hale', suits: CHEAP },
  { name: 'Mamma Rosa', owner: 'Rosa Amato', suits: HOMELY },
  { name: 'Pizzeria Aurora', owner: 'Aurora Vitale', suits: FINE },
  { name: 'The Good Slice', owner: 'Priya Shah', suits: ['priceFighter', 'budgetChain', 'honestTrattoria'] },
  { name: 'Nonna Bianca', owner: 'Bianca Moretti', suits: HOMELY },
  { name: 'Pie Hard', owner: 'Kai Jensen', suits: CHEAP },
  { name: 'Via Roma', owner: 'Paola Russo', suits: ANY },
  { name: 'Stone and Flame', owner: 'Ollie Grant', suits: ['artisan', 'trendyKitchen'] },
  { name: 'Big Slice', owner: 'Rick Mendez', suits: ['priceFighter', 'budgetChain'] },
  { name: 'Lievito', owner: 'Giorgio Sala', suits: ['artisan'] },
  { name: 'Pizza Palooza', owner: 'Tia Brooks', suits: ['hypeHouse'] },
  { name: 'Casa Mia', owner: 'Anna Ricci', suits: HOMELY },
  { name: 'Hot Box', owner: 'Leo Park', suits: CHEAP },
  { name: 'Margherita and Me', owner: 'Ella Rossi', suits: ['hypeHouse', 'trendyKitchen'] },
  { name: 'Pizzeria Sole', owner: 'Luca Sole', suits: ANY },
  { name: 'Brick Oven Co', owner: 'Hannah Clarke', suits: ['trendyKitchen', 'artisan', 'honestTrattoria'] },
  { name: 'Speedy Slice', owner: 'Omar Haddad', suits: ['priceFighter', 'budgetChain'] },
  { name: 'Tavola Calda', owner: 'Franco Deluca', suits: HOMELY },
  { name: 'Neon Pie', owner: 'Zoe Laurent', suits: ['hypeHouse', 'trendyKitchen'] },
];

export const MOTTOS: Record<ArchetypeId, readonly string[]> = {
  priceFighter: ['Cheapest slice in town, every day', 'Big pizza, small price', 'Fast, hot, cheap'],
  artisan: ['Flour, water, salt, time', 'Forty eight hour dough', 'We only do it one way: properly'],
  hypeHouse: ['You saw us on your phone', 'Tag us!', 'The pizza everyone is talking about'],
  honestTrattoria: ['Like nonna made it', 'Good food, fair prices', 'Pull up a chair'],
  trendyKitchen: ['Pizza, reimagined', 'Natural wine and sourdough', 'Come for the pizza, stay for the vibe'],
  budgetChain: ['Two for Tuesday, every day', 'Your local slice, in every neighbourhood', 'Value you can taste'],
};
