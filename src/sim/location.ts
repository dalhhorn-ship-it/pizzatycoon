// Where the pizzeria stands: district plus venue modifiers (01-product/city-map.md 4.1).

import { DISTRICTS, PREMISES } from '../data/districts';
import { SEGMENT_IDS } from '../data/segments';
import type { District, Premises, SegmentId, Venue } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface LocationFacts {
  district: District;
  venue: Venue | null;
  premises: Premises;
  footTraffic: number;
  shares: Record<SegmentId, number>;
  wealth: number;
  competition: number;
  lunchShare: number;
  rentPerTile: number;
  tiles: number;
  weeklyRent: number;
  diningSqm: number;
  kitchenSqm: number;
  sqm: number;
}

/** The effective location a day is simulated in. With no venue it is the plain district (balance harness). */
export function locationFacts(districtId: string, premisesId: string, venueId: string | null): LocationFacts {
  const venue = venueId ? (VENUES[venueId] ?? null) : null;
  const district = DISTRICTS[venue?.districtId ?? districtId];
  const premises = PREMISES[venue?.premisesId ?? premisesId];
  if (!district || !premises) throw new Error(`Unknown location ${districtId}/${premisesId}`);
  let shares = district.shares;
  if (venue) {
    const raw = Object.fromEntries(SEGMENT_IDS.map((id) => [id, district.shares[id] * (venue.tilt[id] ?? 1)])) as Record<SegmentId, number>;
    const sum = SEGMENT_IDS.reduce((a, id) => a + raw[id], 0);
    shares = Object.fromEntries(SEGMENT_IDS.map((id) => [id, raw[id] / sum])) as Record<SegmentId, number>;
  }
  const rentPerTile = venue?.rentPerTile ?? district.rentPerTile;
  const diningTiles = premises.diningWidth * premises.diningHeight;
  const tiles = diningTiles + premises.kitchenTiles;
  return {
    district, venue, premises, shares, rentPerTile, tiles,
    footTraffic: district.footTraffic * (venue?.trafficMult ?? 1),
    wealth: district.wealth * (venue?.wealthMult ?? 1),
    competition: clamp(district.competition + (venue?.competitionDelta ?? 0), 0, T.city.competitionMax),
    lunchShare: clamp(district.lunchShare + (venue?.lunchShareDelta ?? 0), T.city.lunchShareMin, T.city.lunchShareMax),
    weeklyRent: tiles * rentPerTile,
    // Floor area comes from the real grids; rent keeps the balance sheet's kitchenTiles.
    diningSqm: diningTiles * T.city.sqmPerTile,
    kitchenSqm: premises.kitchenWidth * premises.kitchenHeight * T.city.sqmPerTile,
    sqm: (diningTiles + premises.kitchenWidth * premises.kitchenHeight) * T.city.sqmPerTile,
  };
}

export const stateLocation = (s: { districtId: string; premisesId: string; venueId?: string | null }): LocationFacts =>
  locationFacts(s.districtId, s.premisesId, s.venueId ?? null);

export type BestFor = 'Volume' | 'Luxury' | 'Middle road';

/** city-map.md 5: a one line verdict from the crowd mix. */
export function bestFor(shares: Record<SegmentId, number>): BestFor {
  if (shares.foodies + shares.tourists >= 0.4) return 'Luxury';
  if (shares.students + shares.families >= 0.55) return 'Volume';
  return 'Middle road';
}
