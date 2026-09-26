import type { EquipmentItem } from './types';

/** balance.md 1.7. Servings per hour at cook skill 5 follow from slots, bake multiplier and speed. */
export const EQUIPMENT: Record<string, EquipmentItem> = Object.fromEntries(
  (
    [
      { id: 'deckOven', name: 'Deck Oven', family: 'basic', role: 'oven', price: 2400, slots: 4, bakeMult: 1.0, qualityMod: 0, skillNeeded: 0, footprint: 4, maintenance: 40, unlock: { kind: 'start' }, blurb: 'The reliable workhorse. 20 pizzas an hour.' },
      { id: 'doubleDeckOven', name: 'Double Deck Oven', family: 'volume', role: 'oven', price: 5500, slots: 8, bakeMult: 1.0, qualityMod: -1, skillNeeded: 0, footprint: 4, maintenance: 70, unlock: { kind: 'served', guests: 500 }, blurb: 'Two decks, twice the pizzas, a touch less care.' },
      { id: 'conveyorOven', name: 'Conveyor Oven', family: 'volume', role: 'oven', price: 8500, slots: 5, bakeMult: 0.55, qualityMod: -3, skillNeeded: 0, footprint: 6, maintenance: 110, unlock: { kind: 'rank', rank: 'owner' }, blurb: 'Pizzas ride through on a belt. Fast, even with junior cooks.' },
      { id: 'stoneHearthOven', name: 'Stone Hearth Oven', family: 'quality', role: 'oven', price: 6000, slots: 4, bakeMult: 1.0, qualityMod: 5, skillNeeded: 0, footprint: 4, maintenance: 60, unlock: { kind: 'rep', rep: 40 }, blurb: 'A proper stone floor for a crisp, blistered base.' },
      { id: 'woodFiredOven', name: 'Wood Fired Oven', family: 'artisan', role: 'oven', price: 11000, slots: 3, bakeMult: 1.25, qualityMod: 10, skillNeeded: 7, footprint: 9, maintenance: 150, unlock: { kind: 'rep', rep: 55 }, blurb: 'Slow, smoky and glorious. Fewer pizzas, unforgettable ones. Needs a skilled cook.' },
      { id: 'prepCounter', name: 'Prep Counter', family: 'basic', role: 'counter', price: 1200, prepMult: 1, qualityMod: 0, skillNeeded: 0, footprint: 2, maintenance: 10, unlock: { kind: 'start' }, blurb: 'Where dough becomes pizza. One cook per counter.' },
      { id: 'marbleBench', name: 'Marble Bench', family: 'quality', role: 'counter', price: 4000, prepMult: 1, qualityMod: 2, skillNeeded: 0, footprint: 2, maintenance: 10, unlock: { kind: 'rep', rep: 45 }, blurb: 'A cool marble prep bench. Better dough handling.' },
      { id: 'doughSheeter', name: 'Dough Sheeter', family: 'volume', role: 'sheeter', price: 2500, prepMult: 1.35, qualityMod: -2, skillNeeded: 0, footprint: 1, maintenance: 25, unlock: { kind: 'served', guests: 500 }, blurb: 'Rolls bases in seconds. Attaches to one counter.' },
      { id: 'heatLampPass', name: 'Heat Lamp Pass', family: 'volume', role: 'pass', price: 1500, effectMult: 0.7, qualityMod: -1, skillNeeded: 0, footprint: 2, maintenance: 10, unlock: { kind: 'day', day: 5 }, blurb: 'Plates wait warm at the pass. Serving is 30% faster.' },
      { id: 'dishMachine', name: 'Dish Machine', family: 'volume', role: 'dishMachine', price: 4000, effectMult: 1.8, qualityMod: 0, skillNeeded: 0, footprint: 2, maintenance: 40, unlock: { kind: 'day', day: 8 }, blurb: 'Dishwashing 80% faster.' },
      { id: 'provingCabinet', name: 'Proving Cabinet', family: 'quality', role: 'proving', price: 3500, qualityMod: 3, skillNeeded: 0, footprint: 1, maintenance: 30, unlock: { kind: 'rep', rep: 40 }, blurb: 'Perfectly proved dough, every time.' },
    ] satisfies EquipmentItem[]
  ).map((e) => [e.id, e]),
);
