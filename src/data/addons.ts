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

const PREP = ['oldWorkbench', 'prepCounter', 'marbleBench', 'prepFridge', 'steelPrepTable', 'graniteBench', 'refrigeratedMakeLine', 'olivewoodBench', 'doubleMakeTable', 'pizzaioloStation'] as const;
const DECKS = ['usedDeckOven', 'deckOven', 'doubleDeckOven', 'electricDeckOven', 'tripleDeckOven'] as const;
/** Ovens with a stone or brick floor under a live flame. */
const HEARTHS = ['stoneHearthOven', 'gasStoneOven', 'rotatingStoneOven', 'woodFiredOven', 'neapolitanDomeOven', 'dualFuelOven'] as const;
const CONVEYORS = ['conveyorOven', 'twinConveyorOven'] as const;
const COLD = ['doughFridge', 'prepFridge', 'doubleDoorFridge', 'blastChiller', 'refrigeratedMakeLine', 'pizzaioloStation'] as const;
const WASH = ['sink', 'dishMachine', 'hoodDishwasher', 'conveyorDishwasher'] as const;
const PASSES = ['heatLampPass', 'heatedStonePass', 'expoPass'] as const;

export const ADDONS: Record<string, AddonItem> = Object.fromEntries(
  (
    [
      { id: 'pizzaStone', name: 'Pizza Stone Insert', fits: DECKS, price: 500, maintenance: 2, unlock: { kind: 'start' }, qualityAdd: 2, blurb: 'A proper stone under every base. Crisper, every time.' },
      { id: 'thermostatTune', name: 'Thermostat Tune up', fits: [...DECKS, 'stoneHearthOven', 'gasStoneOven', 'rotatingStoneOven', 'dualFuelOven'], price: 350, maintenance: 3, unlock: { kind: 'day', day: 5 }, bakeMult: 0.93, blurb: 'An engineer, a screwdriver and a steadier heat.' },
      { id: 'extraDeckRack', name: 'Extra Deck Rack', fits: ['doubleDeckOven', 'tripleDeckOven'], price: 900, maintenance: 8, unlock: { kind: 'served', guests: 500 }, slotsAdd: 1, blurb: 'Squeeze one more pizza in.' },
      { id: 'beltSpeedKit', name: 'Belt Speed Kit', fits: CONVEYORS, price: 1200, maintenance: 12, unlock: { kind: 'rank', rank: 'owner' }, bakeMult: 0.92, blurb: 'A slightly faster belt, same golden result.' },
      { id: 'woodSmokeBox', name: 'Wood Smoke Box', fits: ['woodFiredOven', 'neapolitanDomeOven', 'dualFuelOven'], price: 800, maintenance: 10, unlock: { kind: 'rep', rep: 55 }, qualityAdd: 2, blurb: 'A whisper of oak on every crust.' },
      { id: 'firebrickLiner', name: 'Firebrick Dome Liner', fits: ['woodFiredOven', 'neapolitanDomeOven', 'dualFuelOven'], price: 700, maintenance: 8, unlock: { kind: 'rep', rep: 55 }, bakeMult: 0.93, blurb: 'Holds heat like a grandmother holds a grudge.' },
      { id: 'toppingRail', name: 'Topping Rail', fits: PREP, price: 400, maintenance: 3, unlock: { kind: 'served', guests: 500 }, prepMult: 1.08, blurb: 'Everything in reach, nothing to hunt for.' },
      { id: 'marbleInsert', name: 'Marble Top Insert', fits: ['oldWorkbench', 'prepCounter', 'steelPrepTable'], price: 400, maintenance: 0, unlock: { kind: 'served', guests: 200 }, qualityAdd: 1, blurb: 'A cool slab of marble set into the bench.' },
      { id: 'portionScale', name: 'Portion Scale', fits: PREP, price: 250, maintenance: 0, unlock: { kind: 'day', day: 8 }, qualityAdd: 1, blurb: 'Same cheese, every pizza.' },
      { id: 'fineRollers', name: 'Fine Gauge Rollers', fits: ['doughSheeter', 'precisionSheeter', 'doughDivider', 'coldPressSheeter'], price: 200, maintenance: 3, unlock: { kind: 'served', guests: 500 }, qualityAdd: 1, blurb: 'Thinner, more even bases.' },
      { id: 'doorSeals', name: 'Door Seals and Shelving', fits: COLD, price: 200, maintenance: 0, unlock: { kind: 'rep', rep: 40 }, wasteMult: 0.88, blurb: 'Cold stays in, waste stays down.' },
      { id: 'tempLogger', name: 'Temperature Logger', fits: COLD, price: 450, maintenance: 0, unlock: { kind: 'rep', rep: 55 }, wasteMult: 0.8, blurb: 'It notices before the milk does.' },
      { id: 'drawerUnit', name: 'Drawer Unit', fits: COLD, price: 300, maintenance: 0, unlock: { kind: 'day', day: 8 }, coldReach: true, blurb: 'Cold drawers that slide out to the next bench.' },
      { id: 'dryingRacks', name: 'Drying Racks', fits: WASH, price: 150, maintenance: 0, unlock: { kind: 'day', day: 8 }, washMult: 1.08, blurb: 'Plates dry while you wash the next stack.' },
      { id: 'preRinseSpray', name: 'Pre rinse Spray', fits: WASH, price: 350, maintenance: 3, unlock: { kind: 'day', day: 8 }, washMult: 1.12, blurb: 'Blast it clean before it goes in.' },
      { id: 'ticketRail', name: 'Ticket Rail', fits: PASSES, price: 150, maintenance: 0, unlock: { kind: 'day', day: 5 }, serveMult: 0.9, blurb: 'Orders in a neat row, oldest first.' },
      { id: 'heatShelf', name: 'Heat Shelf', fits: PASSES, price: 400, maintenance: 3, unlock: { kind: 'day', day: 8 }, qualityAdd: 1, blurb: 'Plates wait hot, not warm.' },
      { id: 'humidityControl', name: 'Humidity Control', fits: ['provingCabinet', 'retarderProver', 'motherDoughCellar'], price: 900, maintenance: 5, unlock: { kind: 'rep', rep: 40 }, qualityAdd: 1, blurb: 'Dough that proves the same in August and January.' },
      // Speed, quality or both (kitchen-upgrades.md 12). Some trade one for the other.
      { id: 'convectionFan', name: 'Convection Fan Kit', fits: [...DECKS, 'airImpingerOven'], price: 900, maintenance: 8, unlock: { kind: 'served', guests: 500 }, bakeMult: 0.85, qualityAdd: -1, blurb: 'A fan in the back wall pushes the heat round. Much faster, a little drier.' },
      { id: 'biscottoFloor', name: 'Biscotto Stone Floor', fits: HEARTHS, price: 1400, maintenance: 5, unlock: { kind: 'rep', rep: 50 }, qualityAdd: 2, blurb: 'Clay tiles from Sorrento: they hold the heat without scorching the base.' },
      { id: 'infraredBroiler', name: 'Infrared Top Heater', fits: [...DECKS, ...HEARTHS], price: 1800, maintenance: 12, unlock: { kind: 'rep', rep: 60 }, bakeMult: 0.9, qualityAdd: 1, blurb: 'A glowing element over the deck: the cheese blisters while the base catches up. Faster and better.' },
      { id: 'screenRack', name: 'Pizza Screen Rack', fits: [...CONVEYORS, 'airImpingerOven'], price: 700, maintenance: 5, unlock: { kind: 'served', guests: 1000 }, slotsAdd: 1, blurb: 'Mesh screens that stack on the belt. One more pizza riding through.' },
      { id: 'sauceDispenser', name: 'Sauce Dispenser', fits: PREP, price: 450, maintenance: 4, unlock: { kind: 'served', guests: 500 }, prepMult: 1.12, blurb: 'One pump, one perfect spiral of sauce. No ladle, no drips.' },
      { id: 'basilPots', name: 'Fresh Basil Pots', fits: PREP, price: 300, maintenance: 6, unlock: { kind: 'rep', rep: 45 }, prepMult: 0.97, qualityAdd: 2, blurb: 'Living basil on the bench, picked leaf by leaf. Slower hands, better pizza.' },
      { id: 'overheadGantry', name: 'Overhead Gantry Shelf', fits: PREP, price: 800, maintenance: 3, unlock: { kind: 'rep', rep: 55 }, prepMult: 1.05, qualityAdd: 1, blurb: 'Oils, salt and garnishes on a shelf at eye level: quicker to reach, easier to finish well.' },
      { id: 'ticketScreen', name: 'Kitchen Ticket Screen', fits: PASSES, price: 1100, maintenance: 10, unlock: { kind: 'served', guests: 1000 }, serveMult: 0.85, blurb: 'Every order on a screen, timed and bumped with a tap. Plates leave sooner.' },
      { id: 'glassRacks', name: 'Glass and Plate Racks', fits: WASH, price: 600, maintenance: 2, unlock: { kind: 'served', guests: 1000 }, washMult: 1.15, blurb: 'Racks sized for every plate and glass: load once, wash once.' },
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
  // Higher end steps (kitchen-upgrades.md 7).
  ['deckOven', 'electricDeckOven'],
  ['electricDeckOven', 'gasStoneOven'],
  ['stoneHearthOven', 'gasStoneOven'],
  ['doubleDeckOven', 'tripleDeckOven'],
  ['conveyorOven', 'twinConveyorOven'],
  ['woodFiredOven', 'neapolitanDomeOven'],
  ['oldWorkbench', 'steelPrepTable'],
  ['prepCounter', 'steelPrepTable'],
  ['steelPrepTable', 'marbleBench'],
  ['marbleBench', 'graniteBench'],
  ['graniteBench', 'olivewoodBench'],
  ['doughSheeter', 'precisionSheeter'],
  ['doughSheeter', 'doughDivider'],
  ['heatLampPass', 'heatedStonePass'],
  ['dishMachine', 'hoodDishwasher'],
  ['doughFridge', 'blastChiller'],
  ['packingStation', 'heatedPackingStation'],
  ['plateShelving', 'plateWarmer'],
  // Speed, quality or both (kitchen-upgrades.md 12).
  ['conveyorOven', 'airImpingerOven'],
  ['gasStoneOven', 'dualFuelOven'],
  ['rotatingStoneOven', 'dualFuelOven'],
  ['prepCounter', 'doubleMakeTable'],
  ['steelPrepTable', 'doubleMakeTable'],
  ['refrigeratedMakeLine', 'pizzaioloStation'],
  ['precisionSheeter', 'coldPressSheeter'],
  ['doughDivider', 'coldPressSheeter'],
  ['heatLampPass', 'expoPass'],
  ['heatedStonePass', 'expoPass'],
  ['hoodDishwasher', 'conveyorDishwasher'],
  ['retarderProver', 'motherDoughCellar'],
];

/** Plain words for an add-on's effect (kitchen-upgrades.md 6). */
export function addonEffectText(a: AddonItem): string {
  const parts: string[] = [];
  if (a.bakeMult) parts.push(`Bakes ${Math.round((1 - a.bakeMult) * 100)}% faster`);
  if (a.slotsAdd) parts.push(`+${a.slotsAdd} pizza at a time`);
  if (a.prepMult) parts.push(a.prepMult >= 1 ? `Prep ${Math.round((a.prepMult - 1) * 100)}% faster` : `Prep ${Math.round((1 - a.prepMult) * 100)}% slower`);
  if (a.qualityAdd) parts.push(`${a.qualityAdd > 0 ? '+' : ''}${a.qualityAdd} pizza quality`);
  if (a.washMult) parts.push(`Washes ${Math.round((a.washMult - 1) * 100)}% faster`);
  if (a.serveMult) parts.push(`Serves ${Math.round((1 - a.serveMult) * 100)}% faster`);
  if (a.wasteMult) parts.push(`Wastes ${Math.round((1 - a.wasteMult) * 100)}% less (best one counts)`);
  if (a.coldReach) parts.push('Keeps benches 2 tiles away cold');
  return parts.join(', ');
}
