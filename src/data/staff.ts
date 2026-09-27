import type { AttrId, Role, Talent, TalentId } from './types';

/**
 * Weekly wage of a position at OVR 50. One staff card covers its role at every lunch and dinner, seven days a week:
 * about 2 people on real shifts (with holidays and sick days), so wages are twice a single person's (economics check, balance.md 5).
 * The manager is one salaried person on long hours; a rider only works the delivery peaks (about 1.3 people).
 */
export const ROLE_BASE_SALARY: Record<Role, number> = {
  chef: 1800, cook: 1100, server: 900, host: 840, dishwasher: 760, manager: 1500, rider: 520,
};

/** Old saves paid one person, not a position: wages scale by this on load (save v7 to v8). */
export const POSITION_WAGE_MULT = 2;

export const ROLE_NAMES: Record<Role, string> = {
  chef: 'Chef', cook: 'Cook', server: 'Server', host: 'Host', dishwasher: 'Dishwasher', manager: 'Restaurant manager', rider: 'Delivery rider',
};

export const ATTR_IDS: readonly AttrId[] = ['quality', 'speed', 'composure', 'mentoring'];

export const ATTR_NAMES: Record<AttrId, string> = {
  quality: 'Quality', speed: 'Speed', composure: 'Composure', mentoring: 'Mentoring',
};

/** Card labels (staff-management.md 2). */
export const ATTR_SHORT: Record<AttrId, string> = {
  quality: 'QUA', speed: 'SPD', composure: 'CMP', mentoring: 'MEN',
};

/** OVR = sum of weight x attribute, like a position rating (staff-management.md 2.1). */
export const ROLE_WEIGHTS: Record<Role, Record<AttrId, number>> = {
  chef: { quality: 0.45, speed: 0.15, composure: 0.2, mentoring: 0.2 },
  cook: { quality: 0.3, speed: 0.4, composure: 0.25, mentoring: 0.05 },
  server: { quality: 0.35, speed: 0.35, composure: 0.25, mentoring: 0.05 },
  host: { quality: 0.5, speed: 0.15, composure: 0.3, mentoring: 0.05 },
  dishwasher: { quality: 0.1, speed: 0.6, composure: 0.3, mentoring: 0 },
  manager: { quality: 0.25, speed: 0.1, composure: 0.3, mentoring: 0.35 },
  rider: { quality: 0.1, speed: 0.6, composure: 0.3, mentoring: 0 },
};

/** Areas share coaching and the team growth bonus (staff-management.md 3.1). */
export type Area = 'kitchen' | 'floor' | 'back' | 'office' | 'delivery';
export const ROLE_AREA: Record<Role, Area> = {
  chef: 'kitchen', cook: 'kitchen', server: 'floor', host: 'floor', dishwasher: 'back', manager: 'office', rider: 'delivery',
};
export const AREA_NAMES: Record<Area, string> = { kitchen: 'Kitchen', floor: 'Floor', back: 'Back', office: 'Office', delivery: 'Delivery' };

export const TALENTS: Record<TalentId, Talent> = {
  speedy: { id: 'speedy', name: 'Speedy', effect: '+15% work speed' },
  perfectionist: { id: 'perfectionist', name: 'Perfectionist', effect: '+8 kitchen skill points, 10% slower cooking' },
  charmer: { id: 'charmer', name: 'Charmer', effect: '+5% service score' },
  nightOwl: { id: 'nightOwl', name: 'Night Owl', effect: '+10% speed at dinner, -10% at lunch' },
  frugal: { id: 'frugal', name: 'Frugal', effect: '-5% ingredient costs (chef or manager)' },
  crowdPleaser: { id: 'crowdPleaser', name: 'Crowd Pleaser', effect: '+5% menu fit for Families' },
  eagerLearner: { id: 'eagerLearner', name: 'Eager Learner', effect: 'Training and coaching gains x1.25' },
  bigGame: { id: 'bigGame', name: 'Big Game Player', effect: '+15 Composure at Friday and Saturday dinner' },
};

export const FIRST_NAMES = [
  'Giulia', 'Marco', 'Sofia', 'Luca', 'Aisha', 'Tomás', 'Mei', 'Jonas', 'Priya', 'Noah', 'Elena', 'Kofi',
  'Ines', 'Mateo', 'Hana', 'Oskar', 'Leila', 'Ravi', 'Chiara', 'Finn', 'Yara', 'Diego', 'Aiko', 'Sam',
  'Nora', 'Ahmed', 'Lotte', 'Paolo', 'Zara', 'Emil',
];
export const LAST_NAMES = [
  'Rossi', 'Bakker', 'Moreau', 'Silva', 'Novak', 'Okafor', 'Tanaka', 'Jansen', 'Khan', 'Bianchi', 'Costa',
  'Lindqvist', 'Haddad', 'Ferrari', 'Weber', 'Nakamura', 'Mensah', 'Russo', 'Dubois', 'Park',
];

/** Rivals who try to hire well trained, underpaid staff (staff-management.md 6.2). */
export const RIVALS = ['Trattoria Nonna', 'Pizza Veloce', 'Da Enzo', 'La Bella Napoli', 'Forno Rosso', 'Osteria del Porto'];
