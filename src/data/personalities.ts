// Personalities: what makes a person happy or unhappy (staff-management.md 5.2). Driver sizes live in T.mood.

import type { Personality, PersonalityId } from './types';

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  thrillSeeker: { id: 'thrillSeeker', name: 'Thrill Seeker', effect: 'Loves a packed room, gets bored when it is quiet', weight: 12 },
  calmSoul: { id: 'calmSoul', name: 'Calm Soul', effect: 'Happiest on steady days; rushes stress them twice as much', weight: 12 },
  craftsperson: { id: 'craftsperson', name: 'Craftsperson', effect: 'Proud of great food, hates cutting corners', weight: 12 },
  racer: { id: 'racer', name: 'Racer', effect: 'Loves fast tickets, hates keeping guests waiting', weight: 12 },
  gloryHunter: { id: 'gloryHunter', name: 'Glory Hunter', effect: 'Follows the reputation and every bad review', weight: 10 },
  moneyMinded: { id: 'moneyMinded', name: 'Money Minded', effect: 'Pay counts double; a raise means twice as much', weight: 10 },
  ambitious: { id: 'ambitious', name: 'Ambitious', effect: 'Wants to keep learning and to be promoted', weight: 10 },
  teamPlayer: { id: 'teamPlayer', name: 'Team Player', effect: 'Happy when the team is happy; hates seeing people let go', weight: 8 },
  steady: { id: 'steady', name: 'Steady', effect: 'Morale never drops below 50', weight: 6 },
  loyal: { id: 'loyal', name: 'Loyal', effect: 'Bad days count half; never listens to rivals', weight: 4 },
  easyGoing: { id: 'easyGoing', name: 'Easy Going', effect: 'Content by nature; everything matters a little less', weight: 4 },
  hothead: { id: 'hothead', name: 'Hothead', effect: 'Feels everything 50% more; when unhappy, upsets the people next to them', weight: 4 },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];
