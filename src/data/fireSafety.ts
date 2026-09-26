// Fire safety upgrades (balance.md 4.4): each one raises the room's fire safety seat limit.
// Installed in the building, so they stay behind when the restaurant moves.

export interface FireSafetyItem {
  id: string;
  name: string;
  price: number;
  /** Added to the seat limit as a share of the base limit (0.55 seats per dining tile). */
  seatBonus: number;
  /** Inspections and servicing, per week. */
  upkeep: number;
  /** The upgrade that has to be installed first. */
  requires: string | null;
  blurb: string;
}

export const FIRE_SAFETY: Record<string, FireSafetyItem> = Object.fromEntries(
  (
    [
      { id: 'extinguishers', name: 'Extinguishers and exit signs', price: 900, seatBonus: 0.05, upkeep: 5, requires: null, blurb: 'Serviced extinguishers, a fire blanket and lit exit signs. The first thing the inspector asks for.' },
      { id: 'fireAlarm', name: 'Fire alarm system', price: 2800, seatBonus: 0.1, upkeep: 15, requires: 'extinguishers', blurb: 'Smoke detectors wired to a central alarm.' },
      { id: 'emergencyExit', name: 'Second emergency exit', price: 6500, seatBonus: 0.1, upkeep: 0, requires: 'fireAlarm', blurb: 'A second way out through the back, with a push bar door.' },
      { id: 'sprinklers', name: 'Sprinkler system', price: 12000, seatBonus: 0.15, upkeep: 40, requires: 'emergencyExit', blurb: 'Ceiling sprinklers throughout. The fire officer signs off on a full house.' },
    ] satisfies FireSafetyItem[]
  ).map((x) => [x.id, x]),
);

export const FIRE_SAFETY_IDS = Object.keys(FIRE_SAFETY);
