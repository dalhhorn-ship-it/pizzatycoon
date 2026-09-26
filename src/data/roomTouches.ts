// Room touches (balance.md 4.8): decoration on the walls, the tables and the ceiling. They take no floor tile,
// so a room can be made beautiful without giving up a table. Bought once for the whole room; they move with you.

export type TouchSpot = 'wall' | 'table' | 'ceiling' | 'room';

export interface RoomTouch {
  id: string;
  name: string;
  spot: TouchSpot;
  price: number;
  decorPoints: number;
  lighting: number;
  comfort: number;
  /** Per week (fresh flowers need replacing). */
  upkeep: number;
  blurb: string;
}

export const ROOM_TOUCHES: Record<string, RoomTouch> = Object.fromEntries(
  (
    [
      { id: 'bunting', name: 'Italian bunting', spot: 'wall', price: 200, decorPoints: 3, lighting: 0, comfort: 0, upkeep: 0, blurb: 'Green, white and red flags along the wall.' },
      { id: 'chalkboard', name: 'Chalkboard of specials', spot: 'wall', price: 250, decorPoints: 3, lighting: 0, comfort: 0, upkeep: 0, blurb: "Today's specials in curly chalk letters." },
      { id: 'photos', name: 'Family photos', spot: 'wall', price: 350, decorPoints: 5, lighting: 0, comfort: 0, upkeep: 0, blurb: 'Nonna, the old village and the first pizza ever sold here.' },
      { id: 'mirror', name: 'Gilded mirror', spot: 'wall', price: 800, decorPoints: 7, lighting: 1, comfort: 0, upkeep: 0, blurb: 'Makes a small room feel twice the size.' },
      { id: 'vines', name: 'Grapevine trellis', spot: 'wall', price: 1200, decorPoints: 10, lighting: 0, comfort: 0, upkeep: 0, blurb: 'Climbing vines across the wall, like a Tuscan pergola.' },
      { id: 'mural', name: 'Amalfi coast mural', spot: 'wall', price: 2500, decorPoints: 18, lighting: 0, comfort: 0, upkeep: 0, blurb: 'A painted sea view with lemon trees. The photo everyone takes.' },
      { id: 'candles', name: 'Candles on every table', spot: 'table', price: 300, decorPoints: 2, lighting: 2, comfort: 0, upkeep: 5, blurb: 'Warm little flames in wine bottles.' },
      { id: 'tablecloths', name: 'Checked tablecloths', spot: 'table', price: 400, decorPoints: 3, lighting: 0, comfort: 1, upkeep: 0, blurb: 'Red and white, crisp and classic.' },
      { id: 'flowers', name: 'Fresh flowers on the tables', spot: 'table', price: 500, decorPoints: 6, lighting: 0, comfort: 0, upkeep: 25, blurb: 'A little vase on every table, fresh each week.' },
      { id: 'cushions', name: 'Seat cushions', spot: 'table', price: 600, decorPoints: 1, lighting: 0, comfort: 2, upkeep: 0, blurb: 'Guests happily stay for dessert.' },
      { id: 'sconces', name: 'Brass wall sconces', spot: 'ceiling', price: 900, decorPoints: 4, lighting: 3, comfort: 0, upkeep: 0, blurb: 'A soft golden glow along the walls.' },
      { id: 'pendants', name: 'Pendant lights', spot: 'ceiling', price: 1400, decorPoints: 5, lighting: 4, comfort: 0, upkeep: 0, blurb: 'Warm lights hanging low over the tables.' },
      { id: 'music', name: 'Italian music', spot: 'room', price: 1000, decorPoints: 2, lighting: 0, comfort: 2, upkeep: 10, blurb: 'Soft Italian songs in the background.' },
    ] satisfies RoomTouch[]
  ).map((x) => [x.id, x]),
);

export const ROOM_TOUCH_IDS = Object.keys(ROOM_TOUCHES);
