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
    wealth: 1.3, competition: 0.25, rentPerTile: 19, lunchShare: 0.3,
  },
};

export const PREMISES: Record<string, Premises> = {
  cosy: { id: 'cosy', name: 'Cosy corner shop', diningWidth: 10, diningHeight: 8, kitchenTiles: 30 },
  medium: { id: 'medium', name: 'Neighbourhood trattoria', diningWidth: 10, diningHeight: 10, kitchenTiles: 36 },
  large: { id: 'large', name: 'Big hall', diningWidth: 20, diningHeight: 11, kitchenTiles: 60 },
};
