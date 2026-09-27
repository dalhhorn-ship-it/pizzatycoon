import type { District, Premises } from './types';

export const DISTRICTS: Record<string, District> = {
  university: {
    id: 'university', name: 'University Quarter',
    blurb: 'Busy streets full of students on a budget. Huge lunch rush, cheap rent.',
    footTraffic: 6000,
    shares: { students: 0.6, families: 0.15, professionals: 0.15, foodies: 0.02, seniors: 0.04, tourists: 0.04 },
    wealth: 0.8, competition: 0.4, rentPerTile: 8, lunchShare: 0.5,
  },
  canal: {
    id: 'canal', name: 'Canal Quarter',
    blurb: 'A mixed neighbourhood of families, offices and locals. A gentle place to start.',
    footTraffic: 2400,
    shares: { students: 0.15, families: 0.25, professionals: 0.25, foodies: 0.1, seniors: 0.15, tourists: 0.1 },
    wealth: 1.0, competition: 0.3, rentPerTile: 11, lunchShare: 0.4,
  },
  harbour: {
    id: 'harbour', name: 'Old Harbour',
    blurb: 'Cobbled quays, tourists and food lovers who will pay for something special. Pricey rent.',
    footTraffic: 2600,
    shares: { students: 0.03, families: 0.07, professionals: 0.2, foodies: 0.3, seniors: 0.1, tourists: 0.3 },
    wealth: 1.5, competition: 0.25, rentPerTile: 19, lunchShare: 0.3,
  },
  business: {
    id: 'business', name: 'Business District',
    blurb: 'Glass towers and busy plazas. Office workers flood the streets at lunch and vanish by eight.',
    footTraffic: 4200,
    shares: { students: 0.05, families: 0.05, professionals: 0.55, foodies: 0.15, seniors: 0.05, tourists: 0.15 },
    wealth: 1.25, competition: 0.4, rentPerTile: 17, lunchShare: 0.65,
  },
  linden: {
    id: 'linden', name: 'Linden Park',
    blurb: 'Leafy streets, playgrounds and quiet evenings. Families and retirees, very few rivals.',
    footTraffic: 1600,
    shares: { students: 0.05, families: 0.45, professionals: 0.12, foodies: 0.08, seniors: 0.25, tourists: 0.05 },
    wealth: 1.05, competition: 0.15, rentPerTile: 7, lunchShare: 0.25,
  },
  market: {
    id: 'market', name: 'Market Square',
    blurb: 'Stalls, spice shops and a covered food hall. Everybody passes through, and so do the rivals.',
    footTraffic: 3000,
    shares: { students: 0.15, families: 0.2, professionals: 0.15, foodies: 0.2, seniors: 0.15, tourists: 0.15 },
    wealth: 1.0, competition: 0.5, rentPerTile: 12, lunchShare: 0.45,
  },
  oldtown: {
    id: 'oldtown', name: 'Old Town',
    blurb: 'Cathedral bells, crooked lanes and camera toting visitors. Busy squares, hidden alleys.',
    footTraffic: 3200,
    shares: { students: 0.05, families: 0.1, professionals: 0.1, foodies: 0.2, seniors: 0.2, tourists: 0.35 },
    wealth: 1.15, competition: 0.45, rentPerTile: 16, lunchShare: 0.35,
  },
};

/** Neighbourhoods next to each other: delivery catchment and nearby rivals (competition.md 6.3). */
export const ADJACENT: Record<string, readonly string[]> = {
  university: ['business', 'market', 'canal'],
  business: ['university', 'canal', 'linden'],
  linden: ['business', 'canal', 'harbour'],
  market: ['university', 'canal', 'oldtown'],
  canal: ['university', 'business', 'linden', 'market', 'oldtown', 'harbour'],
  oldtown: ['market', 'canal', 'harbour'],
  harbour: ['linden', 'canal', 'oldtown'],
};

export const PREMISES: Record<string, Premises> = {
  hole: { id: 'hole', name: 'Hole in the wall', diningWidth: 6, diningHeight: 5, kitchenTiles: 24, kitchenWidth: 10, kitchenHeight: 5, visibility: 0.5 },
  cosy: { id: 'cosy', name: 'Cosy corner shop', diningWidth: 10, diningHeight: 8, kitchenTiles: 30, kitchenWidth: 14, kitchenHeight: 6, visibility: 0.75 },
  medium: { id: 'medium', name: 'Neighbourhood trattoria', diningWidth: 10, diningHeight: 10, kitchenTiles: 36, kitchenWidth: 16, kitchenHeight: 6, visibility: 1 },
  large: { id: 'large', name: 'Big hall', diningWidth: 20, diningHeight: 11, kitchenTiles: 60, kitchenWidth: 20, kitchenHeight: 8, visibility: 1 },
  corner: { id: 'corner', name: 'Corner unit', diningWidth: 12, diningHeight: 8, kitchenTiles: 30, kitchenWidth: 14, kitchenHeight: 6, visibility: 0.9 },
  loft: { id: 'loft', name: 'Warehouse loft', diningWidth: 14, diningHeight: 10, kitchenTiles: 48, kitchenWidth: 18, kitchenHeight: 7, visibility: 1 },
};
