import type { Role, Trait, TraitId } from './types';

export const ROLE_BASE_SALARY: Record<Role, number> = {
  chef: 900, cook: 550, server: 450, host: 420, dishwasher: 380,
};

export const ROLE_NAMES: Record<Role, string> = {
  chef: 'Chef', cook: 'Cook', server: 'Server', host: 'Host', dishwasher: 'Dishwasher',
};

export const TRAITS: Record<TraitId, Trait> = {
  speedy: { id: 'speedy', name: 'Speedy', effect: '+15% work speed' },
  perfectionist: { id: 'perfectionist', name: 'Perfectionist', effect: '+8 kitchen skill points, 10% slower cooking' },
  charmer: { id: 'charmer', name: 'Charmer', effect: '+5% service score' },
  steady: { id: 'steady', name: 'Steady', effect: 'Morale never drops below 50' },
  mentor: { id: 'mentor', name: 'Mentor', effect: 'Every 28 days, +1 skill to the least skilled teammate in the same role' },
  nightOwl: { id: 'nightOwl', name: 'Night Owl', effect: '+10% speed at dinner, -10% at lunch' },
  frugal: { id: 'frugal', name: 'Frugal', effect: '-5% ingredient costs (chef only)' },
  crowdPleaser: { id: 'crowdPleaser', name: 'Crowd Pleaser', effect: '+5% menu fit for Families' },
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
