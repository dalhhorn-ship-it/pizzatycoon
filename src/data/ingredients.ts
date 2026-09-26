import type { Ingredient, QualityTier, Supplier, TierId } from './types';

export const TIERS: Record<TierId, QualityTier> = {
  basic: { id: 'basic', name: 'Basic', quality: 35, priceMult: 0.7, shelfLifeMult: 1.3, wasteRate: 0.03 },
  standard: { id: 'standard', name: 'Standard', quality: 55, priceMult: 1.0, shelfLifeMult: 1.0, wasteRate: 0.05 },
  premium: { id: 'premium', name: 'Premium', quality: 75, priceMult: 1.6, shelfLifeMult: 0.8, wasteRate: 0.07 },
  artisan: { id: 'artisan', name: 'Artisan', quality: 90, priceMult: 2.4, shelfLifeMult: 0.6, wasteRate: 0.1 },
};

export const TIER_IDS: TierId[] = ['basic', 'standard', 'premium', 'artisan'];

export const SUPPLIERS: Record<string, Supplier> = {
  fratelli: {
    id: 'fratelli', name: 'Fratelli Market', priceIndex: 1.0, qualityOffset: -3, reliability: 0.85, leadDays: 1, minOrder: 0,
    carries: {
      dry: ['basic', 'standard'], dairy: ['basic', 'standard'], produce: ['basic', 'standard'],
      meat: ['basic', 'standard'], drinks: ['basic', 'standard'],
    },
  },
  metro: {
    id: 'metro', name: 'Metro Wholesale', priceIndex: 0.9, qualityOffset: 0, reliability: 0.97, leadDays: 2, minOrder: 300,
    carries: {
      dry: ['basic', 'standard', 'premium'], meat: ['basic', 'standard', 'premium'], dairy: ['basic', 'standard'],
      produce: ['basic', 'standard'], drinks: ['basic', 'standard', 'premium'],
    },
  },
  greenValley: {
    id: 'greenValley', name: 'Green Valley Farm', priceIndex: 1.1, qualityOffset: 3, reliability: 0.92, leadDays: 2, minOrder: 150,
    carries: { produce: ['standard', 'premium', 'artisan'], dairy: ['standard', 'premium', 'artisan'] },
  },
  casa: {
    id: 'casa', name: 'Casa Artigiana', priceIndex: 1.15, qualityOffset: 5, reliability: 0.9, leadDays: 3, minOrder: 200,
    carries: {
      dry: ['premium', 'artisan'], meat: ['premium', 'artisan'], dairy: ['premium', 'artisan'], drinks: ['premium', 'artisan'],
    },
  },
};

const I = (
  id: string, name: string, category: Ingredient['category'], portionCost: number, shelfLifeDays: number,
  tags: Ingredient['tags'] = [], base = false,
): Ingredient => ({ id, name, category, portionCost, shelfLifeDays, tags, base });

export const INGREDIENTS: Record<string, Ingredient> = Object.fromEntries(
  [
    I('dough', 'Pizza dough', 'dry', 0.45, 5, [], true),
    I('tomatoSauce', 'Tomato sauce', 'dry', 0.4, 7, [], true),
    I('mozzarella', 'Mozzarella', 'dairy', 1.2, 6, [], true),
    I('oliveOil', 'Olive oil', 'dry', 0.1, 60),
    I('basil', 'Basil', 'produce', 0.25, 4, ['classic']),
    I('pepperoni', 'Pepperoni', 'meat', 0.9, 14, ['meaty', 'spicy', 'classic']),
    I('mushrooms', 'Mushrooms', 'produce', 0.3, 5, ['classic']),
    I('ham', 'Ham', 'meat', 0.8, 8, ['meaty', 'classic']),
    I('gorgonzola', 'Gorgonzola', 'dairy', 0.7, 10, ['cheesy', 'bold']),
    I('parmesan', 'Parmesan', 'dairy', 0.5, 30, ['cheesy', 'classic']),
    I('ricotta', 'Ricotta', 'dairy', 0.5, 6, ['cheesy']),
    I('burrata', 'Burrata', 'dairy', 1.5, 3, ['cheesy']),
    I('prosciutto', 'Prosciutto', 'meat', 1.2, 12, ['meaty', 'classic']),
    I('nduja', "'Nduja", 'meat', 0.9, 20, ['meaty', 'spicy', 'bold']),
    I('sausage', 'Fennel sausage', 'meat', 0.8, 6, ['meaty']),
    I('anchovy', 'Anchovies', 'meat', 0.6, 30, ['bold']),
    I('chili', 'Chili', 'produce', 0.15, 10, ['spicy']),
    I('rocket', 'Rocket', 'produce', 0.25, 4),
    I('olives', 'Olives', 'produce', 0.3, 20),
    I('onion', 'Red onion', 'produce', 0.15, 14),
    I('peppers', 'Peppers', 'produce', 0.25, 7),
    I('pineapple', 'Pineapple', 'produce', 0.3, 7, ['kid friendly']),
    I('cherryTomatoes', 'Cherry tomatoes', 'produce', 0.3, 6, ['classic']),
    I('truffleOil', 'Truffle oil', 'dry', 0.8, 90),
    I('garlicButter', 'Garlic butter', 'dairy', 0.6, 10),
    I('bread', 'Ciabatta', 'dry', 0.5, 3),
    I('softDrink', 'Soft drink', 'drinks', 0.5, 180),
    I('houseWine', 'House wine (glass)', 'drinks', 1.2, 30),
    I('craftBeer', 'Craft beer', 'drinks', 1.0, 90),
    I('mascarpone', 'Mascarpone and espresso', 'dairy', 1.5, 5),
    I('cream', 'Cream and vanilla', 'dairy', 1.3, 5),
    I('gelato', 'Gelato', 'dairy', 1.0, 60, ['kid friendly']),
  ].map((i) => [i.id, i]),
);

/** Topping pairs that taste great together (+10 harmony) or clash (-15). */
export const HARMONY_MATCHES: readonly [string, string][] = [
  ['tomatoSauce', 'basil'],
  ['prosciutto', 'rocket'],
  ['ham', 'mushrooms'],
  ['gorgonzola', 'parmesan'],
  ['burrata', 'cherryTomatoes'],
  ['nduja', 'ricotta'],
  ['sausage', 'onion'],
  ['anchovy', 'olives'],
  ['truffleOil', 'mushrooms'],
  ['mascarpone', 'cream'],
];

export const HARMONY_CLASHES: readonly [string, string][] = [
  ['pineapple', 'anchovy'],
  ['pineapple', 'truffleOil'],
  ['pineapple', 'burrata'],
  ['anchovy', 'burrata'],
  ['gorgonzola', 'pineapple'],
];
