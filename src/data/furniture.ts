import { T } from './tunables';
import type { FurnitureItem } from './types';

export const FURNITURE: Record<string, FurnitureItem> = Object.fromEntries(
  (
    [
      { id: 'foldingTable', name: 'Folding table', kind: 'table', w: 1, h: 1, price: 120, seats: 2, decorPoints: 0, lighting: 0, comfort: -1, color: '#b9a48a' },
      { id: 'table2', name: 'Table for two', kind: 'table', w: 1, h: 1, price: 350, seats: 2, decorPoints: 0, lighting: 0, comfort: 0, color: '#c98b5a' },
      { id: 'table4', name: 'Table for four', kind: 'table', w: 2, h: 1, price: 600, seats: 4, decorPoints: 0, lighting: 0, comfort: 0, color: '#b87945' },
      { id: 'table6', name: 'Long table for six', kind: 'table', w: 3, h: 1, price: 900, seats: 6, decorPoints: 0, lighting: 0, comfort: 0, color: '#a86a3a' },
      { id: 'booth4', name: 'Cosy booth', kind: 'table', w: 2, h: 2, price: 1100, seats: 4, decorPoints: 3, lighting: 0, comfort: 1, color: '#8e4b3c' },
      // Standing places for fast bites (floor-service.md 3): guests who want a quick slice eat on their feet.
      { id: 'highTable', name: 'Standing high table', kind: 'standing', w: 1, h: 1, price: 220, seats: 2, decorPoints: 0, lighting: 0, comfort: 0, color: '#6e4a36' },
      { id: 'windowLedge', name: 'Window ledge', kind: 'standing', w: 2, h: 1, price: 280, seats: 3, decorPoints: 1, lighting: 0, comfort: 0, color: '#9a7a5a' },
      { id: 'standingBar', name: 'Standing bar counter', kind: 'standing', w: 3, h: 1, price: 950, seats: 5, decorPoints: 3, lighting: 0, comfort: 0, color: '#5a3a2a' },
      { id: 'plant', name: 'Potted plant', kind: 'decor', w: 1, h: 1, price: 150, seats: 0, decorPoints: 3, lighting: 0, comfort: 0, color: '#6b9c5a' },
      { id: 'lamp', name: 'Warm floor lamp', kind: 'decor', w: 1, h: 1, price: 300, seats: 0, decorPoints: 4, lighting: 2, comfort: 0, color: '#f2c65b' },
      { id: 'painting', name: 'Harbour painting', kind: 'decor', w: 1, h: 1, price: 250, seats: 0, decorPoints: 5, lighting: 0, comfort: 0, color: '#6f8fb8' },
      { id: 'shelf', name: 'Wine shelf', kind: 'decor', w: 2, h: 1, price: 700, seats: 0, decorPoints: 10, lighting: 0, comfort: 0, color: '#7a4a5a' },
      { id: 'fountain', name: 'Little fountain', kind: 'decor', w: 2, h: 2, price: 1600, seats: 0, decorPoints: 22, lighting: 1, comfort: 0, color: '#8fc3cf' },
      { id: 'lanterns', name: 'String lanterns', kind: 'decor', w: 1, h: 1, price: 450, seats: 0, decorPoints: 4, lighting: 3, comfort: 0, color: '#f5a15b' },
    ] satisfies FurnitureItem[]
  ).map((f) => [f.id, f]),
);

/** Places an item counts for against the fire safety limit: a standing place takes less room than a chair. */
export function fireSeats(item: FurnitureItem | undefined): number {
  if (!item || item.kind === 'decor') return 0;
  return item.kind === 'standing' ? item.seats * T.floor.standingFireShare : item.seats;
}
