// Training courses (staff-management.md 3.3). Prices and gains may move within plus or minus 40% without a spec change.

import type { AttrId, Role, Unlock } from './types';

export interface Course {
  id: string;
  name: string;
  /** Attribute gains before headroom, learning speed and mood. */
  gains: Partial<Record<AttrId, number>>;
  roles: readonly Role[];
  price: number;
  daysOff: number;
  unlock: Unlock;
  blurb: string;
  /** Sommelier: servers who took it sell more wine. */
  cert?: 'sommelier';
  /** A course this person must have finished first (a learning path). */
  requires?: string;
  /** Grouping in the training sheet. */
  track: Track;
}

export type Track = 'basics' | 'kitchen' | 'floor' | 'team' | 'delivery';
export const TRACK_NAMES: Record<Track, string> = {
  basics: 'Basics for everyone', kitchen: 'Kitchen', floor: 'Floor and bar', team: 'Leadership and pressure', delivery: 'Delivery',
};

const ALL: readonly Role[] = ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager'];
const KITCHEN: readonly Role[] = ['chef', 'cook'];
const FLOOR: readonly Role[] = ['server', 'host'];

export const COURSES: Record<string, Course> = {
  doughSkills: {
    id: 'doughSkills', track: 'kitchen', name: 'Dough and Knife Skills', gains: { quality: 10 }, roles: ['chef', 'cook'], price: 300, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Stretch, fold, slice: the basics done beautifully.',
  },
  lineDrills: {
    id: 'lineDrills', track: 'kitchen', name: 'Line Speed Drills', gains: { speed: 10 }, roles: ['chef', 'cook', 'dishwasher'], price: 250, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Fewer steps, quicker hands.',
  },
  tableService: {
    id: 'tableService', track: 'floor', name: 'Table Service Course', gains: { quality: 10 }, roles: ['server', 'host'], price: 250, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Warm welcomes, clear menus, happy tables.',
  },
  floorFlow: {
    id: 'floorFlow', track: 'floor', name: 'Floor Flow Workshop', gains: { speed: 10 }, roles: ['server', 'host'], price: 220, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Carry more, walk less, never forget a table.',
  },
  rushBootcamp: {
    id: 'rushBootcamp', track: 'team', name: 'Rush Hour Bootcamp', gains: { composure: 12 }, roles: ALL, price: 260, daysOff: 0,
    unlock: { kind: 'day', day: 8 }, blurb: 'An evening workshop: a full house, simulated. Breathe, then plate.',
  },
  trainTrainer: {
    id: 'trainTrainer', track: 'team', name: 'Train the Trainer', gains: { mentoring: 12 }, roles: ALL, price: 350, daysOff: 1,
    unlock: { kind: 'served', guests: 500 }, blurb: 'How to teach what you already know.',
  },
  sommelier: {
    id: 'sommelier', track: 'floor', name: 'Sommelier Basics', gains: { quality: 12 }, roles: ['server'], price: 600, daysOff: 2,
    unlock: { kind: 'rep', rep: 45 }, blurb: 'Pairings, pours and the right word about every bottle. Wine sells better.', cert: 'sommelier', requires: 'tableService',
  },
  napoliMaster: {
    id: 'napoliMaster', track: 'kitchen', name: 'Napoli Masterclass', gains: { quality: 16 }, roles: ['chef', 'cook'], price: 550, daysOff: 2,
    unlock: { kind: 'rep', rep: 55 }, blurb: 'Two days with a maestro in Naples.', requires: 'doughSkills',
  },
  leadership: {
    id: 'leadership', track: 'team', name: 'Leadership for Managers', gains: { mentoring: 10, composure: 10 }, roles: ['manager'], price: 900, daysOff: 2,
    unlock: { kind: 'rank', rank: 'owner' }, blurb: 'Running people, not just a restaurant.',
  },

  // Basics: short and cheap, the first step for a mediocre team.
  foodSafety: {
    id: 'foodSafety', track: 'basics', name: 'Food Safety and Hygiene', gains: { quality: 4, composure: 3 }, roles: [...ALL, 'rider'], price: 120, daysOff: 0,
    unlock: { kind: 'start' }, blurb: 'An evening certificate: clean hands, cold chains, calm heads.',
  },
  onboarding: {
    id: 'onboarding', track: 'basics', name: 'Shadow Shifts', gains: { speed: 5, quality: 3 }, roles: [...ALL, 'rider'], price: 90, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'A day at a busy trattoria across town, watching how the pros do it.',
  },
  // Kitchen path: basics, then specialities, then mastery.
  sauceStock: {
    id: 'sauceStock', track: 'kitchen', name: 'Sauces and Stocks', gains: { quality: 8, speed: 3 }, roles: KITCHEN, price: 280, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Tomato, ragù, brodo: the base of every good plate.',
  },
  pastaLab: {
    id: 'pastaLab', track: 'kitchen', name: 'Fresh Pasta Lab', gains: { quality: 12 }, roles: KITCHEN, price: 420, daysOff: 1,
    unlock: { kind: 'served', guests: 300 }, blurb: 'Egg dough, semolina, filled shapes: primi that taste of the morning.', requires: 'sauceStock',
  },
  grillStation: {
    id: 'grillStation', track: 'kitchen', name: 'Grill and Pan Station', gains: { quality: 8, speed: 6 }, roles: KITCHEN, price: 450, daysOff: 1,
    unlock: { kind: 'served', guests: 800 }, blurb: 'Timing a steak, a fish and a saltimbocca in the same minute.', requires: 'sauceStock',
  },
  ovenMaster: {
    id: 'ovenMaster', track: 'kitchen', name: 'Oven Mastery', gains: { speed: 10, quality: 6 }, roles: KITCHEN, price: 480, daysOff: 1,
    unlock: { kind: 'rep', rep: 40 }, blurb: 'Reading the flame, turning on time, never a burnt crust.', requires: 'lineDrills',
  },
  batchPrep: {
    id: 'batchPrep', track: 'kitchen', name: 'Mise en Place and Batch Prep', gains: { speed: 12 }, roles: [...KITCHEN, 'dishwasher'], price: 380, daysOff: 1,
    unlock: { kind: 'served', guests: 1500 }, blurb: 'Everything prepped, labelled and in reach before the doors open.', requires: 'lineDrills',
  },
  pastryDessert: {
    id: 'pastryDessert', track: 'kitchen', name: 'Dolci and Pastry', gains: { quality: 10 }, roles: KITCHEN, price: 400, daysOff: 1,
    unlock: { kind: 'rep', rep: 45 }, blurb: 'Tiramisù, panna cotta, cannoli: the last bite people remember.',
  },
  chefTable: {
    id: 'chefTable', track: 'kitchen', name: "Chef's Menu Development", gains: { quality: 10, mentoring: 8 }, roles: ['chef'], price: 750, daysOff: 2,
    unlock: { kind: 'rep', rep: 60 }, blurb: 'Balancing a menu, costing a dish, teaching it to the brigade.', requires: 'napoliMaster',
  },
  starChef: {
    id: 'starChef', track: 'kitchen', name: 'Stage in a Starred Kitchen', gains: { quality: 18, composure: 6 }, roles: KITCHEN, price: 1400, daysOff: 3,
    unlock: { kind: 'rep', rep: 70 }, blurb: 'Three days in a Michelin kitchen in Emilia. Nobody comes back the same.', requires: 'napoliMaster',
  },
  washSystems: {
    id: 'washSystems', track: 'kitchen', name: 'Dish Pit Systems', gains: { speed: 10, composure: 4 }, roles: ['dishwasher'], price: 160, daysOff: 0,
    unlock: { kind: 'start' }, blurb: 'Scrape, rack, load, stack: a clean plate always waiting.',
  },
  // Floor path.
  hostDesk: {
    id: 'hostDesk', track: 'floor', name: 'Reservations and the Door', gains: { quality: 8, composure: 6 }, roles: FLOOR, price: 240, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Booking books, waiting lists and a smile at the door on a full night.',
  },
  upselling: {
    id: 'upselling', track: 'floor', name: 'Menu Knowledge and Upselling', gains: { quality: 8, speed: 4 }, roles: FLOOR, price: 320, daysOff: 1,
    unlock: { kind: 'served', guests: 500 }, blurb: 'Knowing every dish well enough to recommend a starter and a dolce.', requires: 'tableService',
  },
  baristaBar: {
    id: 'baristaBar', track: 'floor', name: 'Barista and Aperitivo Bar', gains: { speed: 8, quality: 6 }, roles: ['server'], price: 350, daysOff: 1,
    unlock: { kind: 'rep', rep: 40 }, blurb: 'Espresso, spritz and negroni without holding up the tables.',
  },
  complaints: {
    id: 'complaints', track: 'floor', name: 'Handling Complaints', gains: { composure: 10, quality: 4 }, roles: [...FLOOR, 'manager'], price: 260, daysOff: 0,
    unlock: { kind: 'day', day: 14 }, blurb: 'Turning a cold pizza into a regular: listen, fix, follow up.',
  },
  maitreD: {
    id: 'maitreD', track: 'floor', name: "Maître d' Programme", gains: { quality: 14, composure: 6 }, roles: FLOOR, price: 900, daysOff: 2,
    unlock: { kind: 'rep', rep: 60 }, blurb: 'Running a dining room like a stage: pace, seating and the room\'s mood.', requires: 'upselling',
  },
  // Leadership and pressure.
  kitchenLead: {
    id: 'kitchenLead', track: 'team', name: 'Leading a Brigade', gains: { mentoring: 10, composure: 6 }, roles: ['chef', 'cook', 'manager'], price: 520, daysOff: 1,
    unlock: { kind: 'served', guests: 1500 }, blurb: 'Calling the pass, keeping cooks calm, teaching on the fly.', requires: 'rushBootcamp',
  },
  mentorCert: {
    id: 'mentorCert', track: 'team', name: 'Certified Workplace Mentor', gains: { mentoring: 14 }, roles: ALL, price: 600, daysOff: 2,
    unlock: { kind: 'rep', rep: 50 }, blurb: 'A proper mentoring certificate: coaching that sticks.', requires: 'trainTrainer',
  },
  finance: {
    id: 'finance', track: 'team', name: 'Restaurant Finance and Rota Planning', gains: { quality: 8, mentoring: 4 }, roles: ['manager'], price: 650, daysOff: 1,
    unlock: { kind: 'rank', rank: 'owner' }, blurb: 'Food cost, labour cost and a rota that fits the bookings.',
  },
  // Delivery.
  roadSkills: {
    id: 'roadSkills', track: 'delivery', name: 'Safe and Swift Riding', gains: { speed: 10, composure: 4 }, roles: ['rider'], price: 150, daysOff: 0,
    unlock: { kind: 'start' }, blurb: 'Routes, weather and traffic: faster rides, fewer spills.',
  },
  doorstep: {
    id: 'doorstep', track: 'delivery', name: 'Doorstep Service', gains: { quality: 10 }, roles: ['rider'], price: 140, daysOff: 0,
    unlock: { kind: 'start' }, blurb: 'Hot bags, the right change and a friendly word at the door.',
  },
};

export const COURSE_IDS = Object.keys(COURSES);
