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
}

const ALL: readonly Role[] = ['chef', 'cook', 'server', 'host', 'dishwasher', 'manager'];

export const COURSES: Record<string, Course> = {
  doughSkills: {
    id: 'doughSkills', name: 'Dough and Knife Skills', gains: { quality: 10 }, roles: ['chef', 'cook'], price: 300, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Stretch, fold, slice: the basics done beautifully.',
  },
  lineDrills: {
    id: 'lineDrills', name: 'Line Speed Drills', gains: { speed: 10 }, roles: ['chef', 'cook', 'dishwasher'], price: 250, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Fewer steps, quicker hands.',
  },
  tableService: {
    id: 'tableService', name: 'Table Service Course', gains: { quality: 10 }, roles: ['server', 'host'], price: 250, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Warm welcomes, clear menus, happy tables.',
  },
  floorFlow: {
    id: 'floorFlow', name: 'Floor Flow Workshop', gains: { speed: 10 }, roles: ['server', 'host'], price: 220, daysOff: 1,
    unlock: { kind: 'start' }, blurb: 'Carry more, walk less, never forget a table.',
  },
  rushBootcamp: {
    id: 'rushBootcamp', name: 'Rush Hour Bootcamp', gains: { composure: 12 }, roles: ALL, price: 260, daysOff: 0,
    unlock: { kind: 'day', day: 8 }, blurb: 'An evening workshop: a full house, simulated. Breathe, then plate.',
  },
  trainTrainer: {
    id: 'trainTrainer', name: 'Train the Trainer', gains: { mentoring: 12 }, roles: ALL, price: 350, daysOff: 1,
    unlock: { kind: 'served', guests: 500 }, blurb: 'How to teach what you already know.',
  },
  sommelier: {
    id: 'sommelier', name: 'Sommelier Basics', gains: { quality: 12 }, roles: ['server'], price: 600, daysOff: 2,
    unlock: { kind: 'rep', rep: 45 }, blurb: 'Pairings, pours and the right word about every bottle. Wine sells better.', cert: 'sommelier',
  },
  napoliMaster: {
    id: 'napoliMaster', name: 'Napoli Masterclass', gains: { quality: 16 }, roles: ['chef', 'cook'], price: 550, daysOff: 2,
    unlock: { kind: 'rep', rep: 55 }, blurb: 'Two days with a maestro in Naples.',
  },
  leadership: {
    id: 'leadership', name: 'Leadership for Managers', gains: { mentoring: 10, composure: 10 }, roles: ['manager'], price: 900, daysOff: 2,
    unlock: { kind: 'rank', rank: 'owner' }, blurb: 'Running people, not just a restaurant.',
  },
};

export const COURSE_IDS = Object.keys(COURSES);
