// Rentable venues on the city map (01-product/city-map.md 4.4). Every number is a tuning assumption.

import type { Venue } from './types';

const v = (x: Omit<Venue, 'competitionDelta' | 'lunchShareDelta' | 'wealthMult' | 'tilt'> & Partial<Venue>): Venue => ({
  competitionDelta: 0, lunchShareDelta: 0, wealthMult: 1, tilt: {}, ...x,
});

export const VENUES: Record<string, Venue> = Object.fromEntries([
  // University Quarter
  v({
    id: 'campusGate', name: 'Campus Gate Slice', address: '2 College Street', districtId: 'university', premisesId: 'cosy',
    rentPerTile: 9, trafficMult: 1.2, lunchShareDelta: 0.1, tilt: { students: 1.4 }, x: 20, y: 9,
    pros: ['Right on the campus gate: a flood of students', 'Huge lunch rush', 'Low rent for the footfall'],
    cons: ['Students spend little a head', 'Evenings are quiet', 'Small dining room'],
  }),
  v({
    id: 'libraryLane', name: 'Library Lane Hall', address: '41 Library Lane', districtId: 'university', premisesId: 'large',
    rentPerTile: 7, trafficMult: 0.85, x: 8, y: 20,
    pros: ['Cheapest big hall in the city', 'Room for a volume kitchen', 'Space for large groups'],
    cons: ['Back street, fewer passersby', 'A big room to fill and staff'],
  }),
  v({
    id: 'dormRow', name: 'Dorm Row Corner', address: '17 Dorm Row', districtId: 'university', premisesId: 'corner',
    rentPerTile: 8, trafficMult: 1.0, competitionDelta: 0.15, tilt: { students: 1.2 }, x: 30, y: 21,
    pros: ['Wide corner unit with extra tables', 'Late night student crowd', 'Low rent'],
    cons: ['Two rival pizzerias on the same block', 'Very price sensitive guests'],
  }),
  // Business District
  v({
    id: 'towerPlaza', name: 'Tower Plaza Lobby', address: '1 Tower Plaza', districtId: 'business', premisesId: 'corner',
    rentPerTile: 19, trafficMult: 1.15, lunchShareDelta: 0.15, tilt: { professionals: 1.3 }, x: 50, y: 9,
    pros: ['Thousands of office workers at lunch', 'Guests with money to spend', 'Fast lunch service pays off'],
    cons: ['Dead after eight in the evening', 'One of the highest rents', 'Impatient lunch guests'],
  }),
  v({
    id: 'exchangeArcade', name: 'Exchange Arcade', address: '9 Exchange Arcade', districtId: 'business', premisesId: 'medium',
    rentPerTile: 15, trafficMult: 0.9, lunchShareDelta: -0.2, wealthMult: 1.1, tilt: { foodies: 1.3 }, x: 60, y: 19,
    pros: ['After work dinner crowd', 'Wealthy guests', 'Classy covered arcade'],
    cons: ['Tucked inside an arcade', 'Pricey rent'],
  }),
  // Linden Park
  v({
    id: 'parkside', name: 'Parkside Pavilion', address: 'Linden Park, east gate', districtId: 'linden', premisesId: 'large',
    rentPerTile: 6, trafficMult: 0.9, lunchShareDelta: -0.05, tilt: { families: 1.3 }, x: 88, y: 12,
    pros: ['Lowest rent per square metre', 'Families come in big parties', 'Almost no competition'],
    cons: ['Few passersby', 'Mostly an evening and weekend trade', 'Big room to fill'],
  }),
  v({
    id: 'villageHigh', name: 'Village High Street', address: '23 High Street', districtId: 'linden', premisesId: 'cosy',
    rentPerTile: 8, trafficMult: 1.2, competitionDelta: -0.1, tilt: { seniors: 1.2 }, x: 76, y: 30,
    pros: ['The only pizzeria on the high street', 'Loyal locals', 'Cheap and cosy'],
    cons: ['Small neighbourhood crowd', 'Seniors like classics, not experiments'],
  }),
  // Market Square
  v({
    id: 'marketHall', name: 'Market Hall Stall', address: 'Market Hall, unit 4', districtId: 'market', premisesId: 'hole',
    rentPerTile: 12, trafficMult: 1.3, competitionDelta: 0.2, lunchShareDelta: 0.1, x: 16, y: 38,
    pros: ['Busiest pitch in the city', 'Everyone walks past', 'Cheap first step'],
    cons: ['Food stalls compete on every side', 'Tiny: a handful of seats for a big crowd'],
  }),
  v({
    id: 'spiceRow', name: 'Spice Row', address: '8 Spice Row', districtId: 'market', premisesId: 'medium',
    rentPerTile: 13, trafficMult: 1.0, tilt: { foodies: 1.5 }, x: 8, y: 50,
    pros: ['Food lovers come here to explore', 'Good fit for artisan pizza', 'Fair rent'],
    cons: ['Foodies expect top quality', 'Crowded restaurant street'],
  }),
  v({
    id: 'tanneryYard', name: 'Tannery Yard', address: 'Tannery Yard, building C', districtId: 'market', premisesId: 'loft',
    rentPerTile: 9, trafficMult: 0.8, competitionDelta: -0.15, x: 22, y: 60,
    pros: ['Huge loft for the money', 'Few rivals in the yard', 'Room to grow into a big operation'],
    cons: ['Off the main square', 'High total rent for a start'],
  }),
  // Canal Quarter
  v({
    id: 'lockKeeper', name: "Lock Keeper's Cottage", address: '5 Lock Street', districtId: 'canal', premisesId: 'cosy',
    rentPerTile: 11, trafficMult: 1.0, x: 40, y: 30,
    pros: ['A gentle, balanced place to start', 'Mixed crowd forgives mistakes', 'Canal side charm'],
    cons: ['Nothing special stands out', 'Small dining room'],
  }),
  v({
    id: 'bridgeStreet', name: 'Bridge Street Trattoria', address: '30 Bridge Street', districtId: 'canal', premisesId: 'medium',
    rentPerTile: 11, trafficMult: 1.05, x: 52, y: 34,
    pros: ['Room for a proper trattoria', 'Balanced lunch and dinner', 'Busy bridge crossing'],
    cons: ['Middling rent for middling crowds'],
  }),
  v({
    id: 'warehouseLoft', name: 'Old Warehouse Loft', address: '12 Wharf Row', districtId: 'canal', premisesId: 'loft',
    rentPerTile: 10, trafficMult: 0.9, tilt: { professionals: 1.15, foodies: 1.15 }, x: 62, y: 43,
    pros: ['Big industrial space on the water', 'Trendy with young professionals', 'Space for a volume kitchen'],
    cons: ['Slightly off the main path', 'Large rent bill every Sunday'],
  }),
  // Old Town
  v({
    id: 'cathedralSquare', name: 'Cathedral Square', address: '3 Cathedral Square', districtId: 'oldtown', premisesId: 'medium',
    rentPerTile: 20, trafficMult: 1.3, competitionDelta: 0.2, tilt: { tourists: 1.3 }, x: 47, y: 58,
    pros: ['Postcard location, crowds all day', 'Tourists pay well', 'Great for reputation building'],
    cons: ['Expensive rent', 'Tourist traps on every corner'],
  }),
  v({
    id: 'cobblersAlley', name: "Cobbler's Alley", address: '11 Cobbler\'s Alley', districtId: 'oldtown', premisesId: 'hole',
    rentPerTile: 12, trafficMult: 0.7, competitionDelta: -0.15, wealthMult: 1.1, tilt: { foodies: 1.5 }, x: 36, y: 64,
    pros: ['Hidden gem that foodies hunt for', 'Few rivals down the alley', 'Affordable for Old Town'],
    cons: ['Hard to find, fewer passersby', 'Needs great food to get noticed'],
  }),
  v({
    id: 'guildhallCellar', name: 'Guildhall Cellar', address: 'Guildhall, lower floor', districtId: 'oldtown', premisesId: 'corner',
    rentPerTile: 14, trafficMult: 0.9, wealthMult: 1.1, tilt: { seniors: 1.3 }, x: 56, y: 64,
    pros: ['Vaulted cellar full of character', 'Wealthy older guests', 'Long relaxed dinners'],
    cons: ['Seniors dislike long waits', 'Below street level'],
  }),
  // Old Harbour
  v({
    id: 'quaysideNook', name: 'Quayside Nook', address: '6 Quay Street', districtId: 'harbour', premisesId: 'cosy',
    rentPerTile: 19, trafficMult: 1.0, x: 74, y: 50,
    pros: ['Cobbled quay with sea views', 'Food lovers and tourists', 'Guests pay for quality'],
    cons: ['Pricey rent for a small room', 'Not much of a lunch trade'],
  }),
  v({
    id: 'lighthouseView', name: 'Lighthouse View', address: '1 Lighthouse Pier', districtId: 'harbour', premisesId: 'medium',
    rentPerTile: 23, trafficMult: 0.85, wealthMult: 1.15, competitionDelta: -0.05, tilt: { foodies: 1.3 }, x: 90, y: 50,
    pros: ['Most exclusive spot in the city', 'Richest guests', 'Perfect for a luxury pizzeria'],
    cons: ['Highest rent in the city', 'End of the pier: fewer passersby'],
  }),
  v({
    id: 'fishMarket', name: 'Fish Market Hall', address: 'Fish Market, hall 2', districtId: 'harbour', premisesId: 'large',
    rentPerTile: 13, trafficMult: 1.1, lunchShareDelta: 0.1, tilt: { tourists: 1.3 }, x: 80, y: 62,
    pros: ['Huge hall by the harbour', 'Busy with tourists at lunch', 'Lower rent than the quay'],
    cons: ['High total rent', 'Tourists do not come back'],
  }),
  // Hole in the wall starters: cheap deposits for a first pizzeria (fresh-start.md 2).
  v({
    id: 'studentHatch', name: 'Student Hatch', address: '9 Chalk Lane', districtId: 'university', premisesId: 'hole',
    rentPerTile: 8, trafficMult: 1.1, tilt: { students: 1.2 }, x: 11, y: 10,
    pros: ['Cheapest way into the student crowd', 'Slices to go at lunch', 'Tiny deposit'],
    cons: ['Only a handful of seats', 'Students count every coin'],
  }),
  v({
    id: 'plazaHatch', name: 'Plaza Pizza Hatch', address: '4 Tower Plaza, arcade side', districtId: 'business', premisesId: 'hole',
    rentPerTile: 15, trafficMult: 1.0, lunchShareDelta: 0.15, x: 42, y: 17,
    pros: ['Office lunch crowd on the doorstep', 'Guests who pay for speed', 'Small and easy to run'],
    cons: ['Quiet evenings', 'Pricey for its size'],
  }),
  v({
    id: 'bandstandHatch', name: 'Bandstand Kiosk', address: 'Linden Park, bandstand', districtId: 'linden', premisesId: 'hole',
    rentPerTile: 6, trafficMult: 0.9, tilt: { families: 1.2 }, x: 72, y: 14,
    pros: ['Cheapest rent in the city', 'Families after the playground', 'No rivals nearby'],
    cons: ['Few passersby', 'Tiny kitchen'],
  }),
  v({
    id: 'towpathKiosk', name: 'Towpath Kiosk', address: 'Canal towpath, lock 3', districtId: 'canal', premisesId: 'hole',
    rentPerTile: 10, trafficMult: 0.95, x: 36, y: 41,
    pros: ['Gentle, mixed crowd to learn on', 'Low deposit', 'Canal side charm'],
    cons: ['A few seats only', 'Off the main bridge'],
  }),
  v({
    id: 'netLoft', name: 'Net Loft Hatch', address: '2 Rope Walk', districtId: 'harbour', premisesId: 'hole',
    rentPerTile: 16, trafficMult: 0.9, tilt: { foodies: 1.2 }, x: 72, y: 58,
    pros: ['A harbour address on a small budget', 'Food lovers with deep pockets', 'Small and cosy'],
    cons: ['Few seats for a wealthy crowd', 'Rent is high for the size'],
  }),
].map((x) => [x.id, x]));

/** The venue an old save lands on: same district and premises, if one exists. */
export function venueFor(districtId: string, premisesId: string): string | null {
  return Object.values(VENUES).find((x) => x.districtId === districtId && x.premisesId === premisesId)?.id ?? null;
}
