// Kitchen add-ons and station upgrade paths (01-product/kitchen-upgrades.md 4, 5).
import type { Unlock } from './types';

export interface AddonItem {
  id: string;
  name: string;
  /** Equipment item ids this add-on can be installed on. */
  fits: readonly string[];
  price: number;
  maintenance: number;
  unlock: Unlock;
  blurb: string;
  slotsAdd?: number;
  bakeMult?: number;
  prepMult?: number;
  qualityAdd?: number;
  washMult?: number;
  serveMult?: number;
  wasteMult?: number;
  coldReach?: boolean;
}

const PREP = ['oldWorkbench', 'prepCounter', 'marbleBench', 'prepFridge'] as const;
const DECKS = ['usedDeckOven', 'deckOven', 'doubleDeckOven'] as const;
const COLD = ['doughFridge', 'prepFridge'] as const;
const WASH = ['sink', 'dishMachine'] as const;
const OVENS = ['usedDeckOven', 'deckOven', 'doubleDeckOven', 'conveyorOven', 'stoneHearthOven', 'woodFiredOven'] as const;

export const ADDONS: Record<string, AddonItem> = Object.fromEntries(
  (
    [
      { id: 'pizzaStone', name: 'Pizza Stone Insert', fits: DECKS, price: 500, maintenance: 2, unlock: { kind: 'start' }, qualityAdd: 2, blurb: 'A proper stone under every base. Crisper, every time.' },
      { id: 'thermostatTune', name: 'Thermostat Tune up', fits: [...DECKS, 'stoneHearthOven'], price: 350, maintenance: 3, unlock: { kind: 'day', day: 5 }, bakeMult: 0.93, blurb: 'An engineer, a screwdriver and a steadier heat.' },
      { id: 'extraDeckRack', name: 'Extra Deck Rack', fits: ['doubleDeckOven'], price: 900, maintenance: 8, unlock: { kind: 'served', guests: 500 }, slotsAdd: 1, blurb: 'Squeeze one more pizza in.' },
      { id: 'beltSpeedKit', name: 'Belt Speed Kit', fits: ['conveyorOven'], price: 1200, maintenance: 12, unlock: { kind: 'rank', rank: 'owner' }, bakeMult: 0.92, blurb: 'A slightly faster belt, same golden result.' },
      { id: 'woodSmokeBox', name: 'Wood Smoke Box', fits: ['woodFiredOven'], price: 800, maintenance: 10, unlock: { kind: 'rep', rep: 55 }, qualityAdd: 2, blurb: 'A whisper of oak on every crust.' },
      { id: 'firebrickLiner', name: 'Firebrick Dome Liner', fits: ['woodFiredOven'], price: 700, maintenance: 8, unlock: { kind: 'rep', rep: 55 }, bakeMult: 0.93, blurb: 'Holds heat like a grandmother holds a grudge.' },
      { id: 'toppingRail', name: 'Topping Rail', fits: PREP, price: 400, maintenance: 3, unlock: { kind: 'served', guests: 500 }, prepMult: 1.08, blurb: 'Everything in reach, nothing to hunt for.' },
      { id: 'marbleInsert', name: 'Marble Top Insert', fits: ['oldWorkbench', 'prepCounter'], price: 400, maintenance: 0, unlock: { kind: 'served', guests: 200 }, qualityAdd: 1, blurb: 'A cool slab of marble set into the bench.' },
      { id: 'portionScale', name: 'Portion Scale', fits: PREP, price: 250, maintenance: 0, unlock: { kind: 'day', day: 8 }, qualityAdd: 1, blurb: 'Same cheese, every pizza.' },
      { id: 'fineRollers', name: 'Fine Gauge Rollers', fits: ['doughSheeter'], price: 200, maintenance: 3, unlock: { kind: 'served', guests: 500 }, qualityAdd: 1, blurb: 'Thinner, more even bases.' },
      { id: 'doorSeals', name: 'Door Seals and Shelving', fits: COLD, price: 200, maintenance: 0, unlock: { kind: 'rep', rep: 40 }, wasteMult: 0.88, blurb: 'Cold stays in, waste stays down.' },
      { id: 'tempLogger', name: 'Temperature Logger', fits: COLD, price: 450, maintenance: 0, unlock: { kind: 'rep', rep: 55 }, wasteMult: 0.8, blurb: 'It notices before the milk does.' },
      { id: 'drawerUnit', name: 'Drawer Unit', fits: COLD, price: 300, maintenance: 0, unlock: { kind: 'day', day: 8 }, coldReach: true, blurb: 'Cold drawers that slide out to the next bench.' },
      { id: 'dryingRacks', name: 'Drying Racks', fits: WASH, price: 150, maintenance: 0, unlock: { kind: 'day', day: 8 }, washMult: 1.08, blurb: 'Plates dry while you wash the next stack.' },
      { id: 'preRinseSpray', name: 'Pre rinse Spray', fits: WASH, price: 350, maintenance: 3, unlock: { kind: 'day', day: 8 }, washMult: 1.12, blurb: 'Blast it clean before it goes in.' },
      { id: 'ticketRail', name: 'Ticket Rail', fits: ['heatLampPass'], price: 150, maintenance: 0, unlock: { kind: 'day', day: 5 }, serveMult: 0.9, blurb: 'Orders in a neat row, oldest first.' },
      { id: 'heatShelf', name: 'Heat Shelf', fits: ['heatLampPass'], price: 400, maintenance: 3, unlock: { kind: 'day', day: 8 }, qualityAdd: 1, blurb: 'Plates wait hot, not warm.' },
      // More craft (balance.md 4.11): quality add-ons for every station. The quality cap rises with reputation.
      { id: 'irThermometer', name: 'Infrared Thermometer', fits: OVENS, price: 180, maintenance: 0, unlock: { kind: 'day', day: 5 }, qualityAdd: 1, blurb: 'Read the oven floor, not the dial.' },
      { id: 'steelPeels', name: 'Steel Pizza Peels', fits: OVENS, price: 220, maintenance: 1, unlock: { kind: 'served', guests: 200 }, qualityAdd: 1, blurb: 'Thin steel slides under the base without tearing it.' },
      { id: 'refractoryFloor', name: 'Refractory Floor Tiles', fits: ['stoneHearthOven'], price: 1400, maintenance: 8, unlock: { kind: 'rep', rep: 45 }, qualityAdd: 2, blurb: 'Italian biscotto tiles: a leopard spotted base.' },
      { id: 'copperDoor', name: 'Copper Dome Door', fits: ['woodFiredOven'], price: 1200, maintenance: 6, unlock: { kind: 'rep', rep: 60 }, qualityAdd: 1, bakeMult: 0.95, blurb: 'Keeps the dome roaring between pizzas.' },
      { id: 'herbPlanter', name: 'Herb Planter Box', fits: PREP, price: 250, maintenance: 2, unlock: { kind: 'day', day: 8 }, qualityAdd: 1, blurb: 'Basil and oregano cut to order.' },
      { id: 'tomatoMill', name: 'Hand Tomato Mill', fits: PREP, price: 300, maintenance: 0, unlock: { kind: 'rep', rep: 40 }, qualityAdd: 1, blurb: 'San Marzano tomatoes crushed by hand every morning.' },
      { id: 'pastaStation', name: 'Fresh Pasta Station', fits: PREP, price: 800, maintenance: 5, unlock: { kind: 'rep', rep: 45 }, qualityAdd: 1, prepMult: 1.05, blurb: 'A pot always on the boil and a drying rack for fresh pasta.' },
      { id: 'coldFerment', name: 'Cold Ferment Trays', fits: COLD, price: 600, maintenance: 0, unlock: { kind: 'rep', rep: 45 }, qualityAdd: 2, blurb: 'Dough rested 48 hours in the cold: light, airy and full of flavour.' },
      { id: 'sourdoughStarter', name: 'Sourdough Starter', fits: ['provingCabinet'], price: 500, maintenance: 4, unlock: { kind: 'rep', rep: 55 }, qualityAdd: 2, blurb: 'A lievito madre fed every day. Tangy, blistered crusts.' },
      { id: 'plateWarmer', name: 'Plate Warmer', fits: ['heatLampPass'], price: 600, maintenance: 4, unlock: { kind: 'rep', rep: 45 }, qualityAdd: 1, blurb: 'Every plate leaves the pass warm.' },
      { id: 'semolinaDuster', name: 'Semolina Duster', fits: ['doughSheeter'], price: 150, maintenance: 1, unlock: { kind: 'served', guests: 500 }, qualityAdd: 1, blurb: 'A fine dusting of semolina for a crisp, never sticky base.' },
      { id: 'humidityControl', name: 'Humidity Control', fits: ['provingCabinet'], price: 900, maintenance: 5, unlock: { kind: 'rep', rep: 40 }, qualityAdd: 1, blurb: 'Dough that proves the same in August and January.' },
    ] satisfies AddonItem[]
  ).map((a) => [a.id, a]),
);

/** Natural trade in steps on the same tiles (kitchen-upgrades.md 5). */
export const UPGRADE_PATHS: readonly [from: string, to: string][] = [
  ['usedDeckOven', 'deckOven'],
  ['deckOven', 'doubleDeckOven'],
  ['deckOven', 'stoneHearthOven'],
  ['oldWorkbench', 'prepCounter'],
  ['prepCounter', 'marbleBench'],
  ['prepCounter', 'prepFridge'],
];

/** Plain words for an add-on's effect (kitchen-upgrades.md 6). */
export function addonEffectText(a: AddonItem): string {
  const parts: string[] = [];
  if (a.bakeMult) parts.push(`Bakes ${Math.round((1 - a.bakeMult) * 100)}% faster`);
  if (a.slotsAdd) parts.push(`+${a.slotsAdd} pizza at a time`);
  if (a.prepMult) parts.push(`Prep ${Math.round((a.prepMult - 1) * 100)}% faster`);
  if (a.qualityAdd) parts.push(`+${a.qualityAdd} pizza quality`);
  if (a.washMult) parts.push(`Washes ${Math.round((a.washMult - 1) * 100)}% faster`);
  if (a.serveMult) parts.push(`Serves ${Math.round((1 - a.serveMult) * 100)}% faster`);
  if (a.wasteMult) parts.push(`Wastes ${Math.round((1 - a.wasteMult) * 100)}% less (best one counts)`);
  if (a.coldReach) parts.push('Keeps benches 2 tiles away cold');
  return parts.join(', ');
}
