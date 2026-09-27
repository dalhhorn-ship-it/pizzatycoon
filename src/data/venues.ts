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
  // competition.md 4.2: 48 more venues so rivals and the player have room to compete.
  v({ id: 'lectureHall', name: 'Lecture Hall Corner', address: 'Lecture Hall Corner, University', districtId: 'university', premisesId: 'corner', rentPerTile: 9, trafficMult: 1.1, lunchShareDelta: 0.1, tilt: { students: 1.3 }, x: 15, y: 15, pros: ['Between two lecture halls', 'wide unit'], cons: ['Empty in the holidays', 'students count coins'] }),
  v({ id: 'bookshopRow', name: 'Bookshop Row', address: 'Bookshop Row, University', districtId: 'university', premisesId: 'cosy', rentPerTile: 8, trafficMult: 1.0, tilt: { professionals: 1.2 }, x: 24, y: 14, pros: ['Lecturers and staff', 'quiet charm'], cons: ['Small room', 'modest footfall'] }),
  v({ id: 'scienceCanteen', name: 'Science Park Canteen', address: 'Science Park Canteen, University', districtId: 'university', premisesId: 'large', rentPerTile: 7, trafficMult: 0.9, lunchShareDelta: 0.15, tilt: { professionals: 1.4 }, x: 27, y: 6, pros: ['Researchers at lunch', 'cheap space'], cons: ['Dead in the evening', 'a big room to fill'] }),
  v({ id: 'unionSquare', name: 'Student Union Square', address: 'Student Union Square, University', districtId: 'university', premisesId: 'medium', rentPerTile: 9, trafficMult: 1.25, competitionDelta: 0.1, tilt: { students: 1.3 }, x: 18, y: 22, pros: ['The busiest square on campus', 'late crowd'], cons: ['Rivals on every side', 'low spend'] }),
  v({ id: 'chalkLaneWindow', name: 'Chalk Lane Window', address: 'Chalk Lane Window, University', districtId: 'university', premisesId: 'hole', rentPerTile: 8, trafficMult: 1.0, tilt: { students: 1.2 }, x: 6, y: 14, pros: ['Tiny deposit', 'slices to go'], cons: ['Few seats', 'back lane'] }),
  v({ id: 'printworks', name: 'Old Printworks', address: 'Old Printworks, University', districtId: 'university', premisesId: 'loft', rentPerTile: 7, trafficMult: 0.85, tilt: { students: 1.1, professionals: 1.2 }, x: 12, y: 24, pros: ['Huge space for little money', 'character'], cons: ['Off the main streets', 'big rent bill'] }),
  v({ id: 'terraceRow', name: 'Terrace Row', address: 'Terrace Row, University', districtId: 'university', premisesId: 'cosy', rentPerTile: 7, trafficMult: 0.9, lunchShareDelta: -0.1, tilt: { families: 1.4 }, x: 31, y: 14, pros: ['Young families on the terraces', 'cheap'], cons: ['Quiet lunch', 'few passersby'] }),
  v({ id: 'nightOwlHatch', name: 'Night Owl Hatch', address: 'Night Owl Hatch, University', districtId: 'university', premisesId: 'hole', rentPerTile: 9, trafficMult: 1.15, lunchShareDelta: -0.15, tilt: { students: 1.4 }, x: 23, y: 19, pros: ['Late night student trade', 'busy corner'], cons: ['Tiny kitchen', 'slow mornings'] }),
  v({ id: 'glassAtrium', name: 'Glass Atrium Food Court', address: 'Glass Atrium Food Court, Business', districtId: 'business', premisesId: 'hole', rentPerTile: 16, trafficMult: 1.25, lunchShareDelta: 0.2, competitionDelta: 0.15, tilt: { professionals: 1.3 }, x: 46, y: 6, pros: ['Thousands pass at lunch', 'small and easy'], cons: ['Food court rivals', 'dead evenings'] }),
  v({ id: 'bankersRow', name: 'Bankers\' Row', address: 'Bankers\' Row, Business', districtId: 'business', premisesId: 'medium', rentPerTile: 18, trafficMult: 1.0, wealthMult: 1.15, tilt: { professionals: 1.3 }, x: 55, y: 13, pros: ['Expense account diners', 'classy street'], cons: ['High rent', 'impatient at lunch'] }),
  v({ id: 'conferenceHall', name: 'Conference Centre Hall', address: 'Conference Centre Hall, Business', districtId: 'business', premisesId: 'large', rentPerTile: 14, trafficMult: 1.0, lunchShareDelta: 0.1, tilt: { tourists: 1.3, professionals: 1.2 }, x: 63, y: 8, pros: ['Conference crowds', 'groups'], cons: ['Uneven weeks', 'high total rent'] }),
  v({ id: 'courtyardCorner', name: 'Courtyard Corner', address: 'Courtyard Corner, Business', districtId: 'business', premisesId: 'corner', rentPerTile: 16, trafficMult: 1.05, x: 40, y: 22, pros: ['Sheltered courtyard', 'balanced trade'], cons: ['Pricey', 'nothing special'] }),
  v({ id: 'skylineTerrace', name: 'Skyline Terrace', address: 'Skyline Terrace, Business', districtId: 'business', premisesId: 'medium', rentPerTile: 20, trafficMult: 0.85, wealthMult: 1.2, lunchShareDelta: -0.2, tilt: { foodies: 1.3 }, x: 58, y: 24, pros: ['City views', 'wealthy dinner guests'], cons: ['Highest rent in the district', 'hard to find'] }),
  v({ id: 'clerkStreet', name: 'Clerk Street Cosy', address: 'Clerk Street Cosy, Business', districtId: 'business', premisesId: 'cosy', rentPerTile: 15, trafficMult: 1.0, lunchShareDelta: 0.15, x: 47, y: 20, pros: ['Office lunch on the doorstep', 'small'], cons: ['Quiet evenings', 'pricey for its size'] }),
  v({ id: 'tramStopHatch', name: 'Tram Stop Hatch', address: 'Tram Stop Hatch, Business', districtId: 'business', premisesId: 'hole', rentPerTile: 14, trafficMult: 1.2, lunchShareDelta: 0.1, x: 53, y: 4, pros: ['Commuters all day', 'cheap for Business'], cons: ['Few seats', 'noisy'] }),
  v({ id: 'schoolGate', name: 'School Gate Corner', address: 'School Gate Corner, Linden Park', districtId: 'linden', premisesId: 'corner', rentPerTile: 7, trafficMult: 1.0, tilt: { families: 1.4 }, x: 82, y: 22, pros: ['Parents after school', 'cheap'], cons: ['Quiet lunch', 'kids\' menu expected'] }),
  v({ id: 'bowlsClub', name: 'Bowls Club Pavilion', address: 'Bowls Club Pavilion, Linden Park', districtId: 'linden', premisesId: 'medium', rentPerTile: 7, trafficMult: 0.8, competitionDelta: -0.05, tilt: { seniors: 1.5 }, x: 93, y: 26, pros: ['Loyal older crowd', 'no rivals'], cons: ['Few passersby', 'classics only'] }),
  v({ id: 'orchardBarn', name: 'Orchard Barn', address: 'Orchard Barn, Linden Park', districtId: 'linden', premisesId: 'loft', rentPerTile: 6, trafficMult: 0.75, lunchShareDelta: -0.1, tilt: { families: 1.3 }, x: 70, y: 26, pros: ['Enormous barn for little rent', 'weekends'], cons: ['Far from everything', 'hard to fill'] }),
  v({ id: 'duckPondKiosk', name: 'Duck Pond Kiosk', address: 'Duck Pond Kiosk, Linden Park', districtId: 'linden', premisesId: 'hole', rentPerTile: 6, trafficMult: 0.95, tilt: { families: 1.2, seniors: 1.1 }, x: 80, y: 8, pros: ['Park walkers', 'cheapest start'], cons: ['Tiny', 'weather dependent feel'] }),
  v({ id: 'cheesemongers', name: 'Cheesemonger\'s Corner', address: 'Cheesemonger\'s Corner, Market Square', districtId: 'market', premisesId: 'corner', rentPerTile: 12, trafficMult: 1.1, tilt: { foodies: 1.3 }, x: 25, y: 44, pros: ['Food lovers browse here', 'good footfall'], cons: ['Picky guests', 'crowded street'] }),
  v({ id: 'flowerStall', name: 'Flower Market Stall', address: 'Flower Market Stall, Market Square', districtId: 'market', premisesId: 'hole', rentPerTile: 11, trafficMult: 1.2, competitionDelta: 0.1, x: 12, y: 34, pros: ['Everyone walks by', 'cheap'], cons: ['Stalls compete on every side', 'few seats'] }),
  v({ id: 'butchersRow', name: 'Butchers\' Row', address: 'Butchers\' Row, Market Square', districtId: 'market', premisesId: 'cosy', rentPerTile: 11, trafficMult: 1.0, tilt: { families: 1.2 }, x: 5, y: 58, pros: ['Local families', 'fair rent'], cons: ['Plain street', 'small room'] }),
  v({ id: 'coveredFoodHall', name: 'Covered Food Hall', address: 'Covered Food Hall, Market Square', districtId: 'market', premisesId: 'large', rentPerTile: 10, trafficMult: 1.15, lunchShareDelta: 0.1, competitionDelta: 0.15, tilt: { tourists: 1.2 }, x: 18, y: 48, pros: ['Big crowds', 'room for volume'], cons: ['Food stalls all around', 'high total rent'] }),
  v({ id: 'bakersYard', name: 'Bakers\' Yard', address: 'Bakers\' Yard, Market Square', districtId: 'market', premisesId: 'medium', rentPerTile: 12, trafficMult: 0.95, x: 28, y: 54, pros: ['Balanced crowd', 'proper dining room'], cons: ['Tucked in a yard'] }),
  v({ id: 'auctionHouse', name: 'Old Auction House', address: 'Old Auction House, Market Square', districtId: 'market', premisesId: 'loft', rentPerTile: 9, trafficMult: 0.85, tilt: { professionals: 1.2 }, x: 10, y: 64, pros: ['Grand loft', 'low rent per tile'], cons: ['Off the square', 'big to fill'] }),
  v({ id: 'saffronHatch', name: 'Saffron Hatch', address: 'Saffron Hatch, Market Square', districtId: 'market', premisesId: 'hole', rentPerTile: 12, trafficMult: 1.0, tilt: { foodies: 1.4 }, x: 4, y: 44, pros: ['Spice lovers', 'small and cheap'], cons: ['Foodies expect quality', 'few seats'] }),
  v({ id: 'fountainSquare', name: 'Fountain Square', address: 'Fountain Square, Market Square', districtId: 'market', premisesId: 'cosy', rentPerTile: 13, trafficMult: 1.2, tilt: { tourists: 1.3 }, x: 24, y: 36, pros: ['Postcard fountain', 'all day crowds'], cons: ['Rent above the district', 'tourists do not return'] }),
  v({ id: 'swingBridge', name: 'Swing Bridge Corner', address: 'Swing Bridge Corner, Canal', districtId: 'canal', premisesId: 'corner', rentPerTile: 11, trafficMult: 1.1, x: 46, y: 38, pros: ['Busy crossing', 'wide unit'], cons: ['Nothing special', 'middling rent'] }),
  v({ id: 'bargeYard', name: 'Barge Yard', address: 'Barge Yard, Canal', districtId: 'canal', premisesId: 'large', rentPerTile: 9, trafficMult: 0.85, tilt: { families: 1.2 }, x: 56, y: 46, pros: ['Cheap big room', 'groups'], cons: ['Off the path', 'big to staff'] }),
  v({ id: 'millRace', name: 'Mill Race Cosy', address: 'Mill Race Cosy, Canal', districtId: 'canal', premisesId: 'cosy', rentPerTile: 11, trafficMult: 0.95, tilt: { seniors: 1.2 }, x: 44, y: 46, pros: ['Quiet waterside', 'loyal locals'], cons: ['Few passersby', 'small room'] }),
  v({ id: 'boathouse', name: 'Boathouse Trattoria', address: 'Boathouse Trattoria, Canal', districtId: 'canal', premisesId: 'medium', rentPerTile: 12, trafficMult: 1.0, tilt: { professionals: 1.1, families: 1.1 }, x: 64, y: 33, pros: ['Waterside dining', 'balanced'], cons: ['Rent above the district'] }),
  v({ id: 'lockTwoHatch', name: 'Lock Two Hatch', address: 'Lock Two Hatch, Canal', districtId: 'canal', premisesId: 'hole', rentPerTile: 10, trafficMult: 1.05, x: 48, y: 28, pros: ['Gentle crowd', 'low deposit'], cons: ['A few seats only', 'plain'] }),
  v({ id: 'ropeworks', name: 'Ropeworks', address: 'Ropeworks, Canal', districtId: 'canal', premisesId: 'loft', rentPerTile: 10, trafficMult: 0.9, tilt: { professionals: 1.2 }, x: 35, y: 35, pros: ['Trendy loft', 'space to grow'], cons: ['Big rent bill', 'quiet lunch'] }),
  v({ id: 'marinaWalk', name: 'Marina Walk', address: 'Marina Walk, Canal', districtId: 'canal', premisesId: 'cosy', rentPerTile: 12, trafficMult: 1.1, tilt: { tourists: 1.2 }, x: 58, y: 39, pros: ['Boats and strollers', 'charm'], cons: ['Pricier than the canal average'] }),
  v({ id: 'cloisterCourt', name: 'Cloister Court', address: 'Cloister Court, Old Town', districtId: 'oldtown', premisesId: 'cosy', rentPerTile: 17, trafficMult: 1.0, wealthMult: 1.1, tilt: { seniors: 1.3 }, x: 42, y: 55, pros: ['Wealthy older guests', 'calm'], cons: ['Seniors dislike waits', 'pricey'] }),
  v({ id: 'bellTowerHatch', name: 'Bell Tower Hatch', address: 'Bell Tower Hatch, Old Town', districtId: 'oldtown', premisesId: 'hole', rentPerTile: 16, trafficMult: 1.3, competitionDelta: 0.15, tilt: { tourists: 1.4 }, x: 51, y: 54, pros: ['Crowds under the bell tower', 'tiny deposit'], cons: ['Tourist traps around', 'few seats'] }),
  v({ id: 'printersLane', name: 'Printers\' Lane', address: 'Printers\' Lane, Old Town', districtId: 'oldtown', premisesId: 'medium', rentPerTile: 15, trafficMult: 0.9, tilt: { foodies: 1.3 }, x: 33, y: 58, pros: ['Food lovers\' lane', 'fair rent for Old Town'], cons: ['Side street', 'needs great food'] }),
  v({ id: 'townHallArcade', name: 'Town Hall Arcade', address: 'Town Hall Arcade, Old Town', districtId: 'oldtown', premisesId: 'corner', rentPerTile: 18, trafficMult: 1.15, tilt: { tourists: 1.2 }, x: 57, y: 58, pros: ['Covered arcade', 'all day trade'], cons: ['High rent', 'tourist heavy'] }),
  v({ id: 'wineCellars', name: 'Old Wine Cellars', address: 'Old Wine Cellars, Old Town', districtId: 'oldtown', premisesId: 'loft', rentPerTile: 13, trafficMult: 0.8, wealthMult: 1.1, tilt: { foodies: 1.2, seniors: 1.2 }, x: 44, y: 67, pros: ['Vaulted cellars', 'wine lovers'], cons: ['Below street level', 'big rent bill'] }),
  v({ id: 'pilgrimsRest', name: 'Pilgrims\' Rest', address: 'Pilgrims\' Rest, Old Town', districtId: 'oldtown', premisesId: 'medium', rentPerTile: 12, trafficMult: 1.0, tilt: { tourists: 1.3 }, x: 61, y: 55, pros: ['Coach parties', 'cheap for Old Town'], cons: ['Tourists do not return', 'plain room'] }),
  v({ id: 'lanternAlley', name: 'Lantern Alley', address: 'Lantern Alley, Old Town', districtId: 'oldtown', premisesId: 'hole', rentPerTile: 13, trafficMult: 0.75, competitionDelta: -0.1, tilt: { foodies: 1.3 }, x: 39, y: 61, pros: ['Hidden gem', 'few rivals'], cons: ['Hard to find', 'few seats'] }),
  v({ id: 'museumSteps', name: 'Museum Steps', address: 'Museum Steps, Old Town', districtId: 'oldtown', premisesId: 'cosy', rentPerTile: 18, trafficMult: 1.2, lunchShareDelta: 0.1, tilt: { tourists: 1.4 }, x: 48, y: 65, pros: ['Museum crowds at lunch', 'busy'], cons: ['Pricey', 'guests pass once'] }),
  v({ id: 'yachtClub', name: 'Yacht Club Terrace', address: 'Yacht Club Terrace, Old Harbour', districtId: 'harbour', premisesId: 'medium', rentPerTile: 22, trafficMult: 0.85, wealthMult: 1.2, tilt: { foodies: 1.2, professionals: 1.2 }, x: 94, y: 58, pros: ['Richest guests after Lighthouse', 'views'], cons: ['Very high rent', 'end of the marina'] }),
  v({ id: 'ferryTerminal', name: 'Ferry Terminal Hall', address: 'Ferry Terminal Hall, Old Harbour', districtId: 'harbour', premisesId: 'large', rentPerTile: 12, trafficMult: 1.2, lunchShareDelta: 0.15, tilt: { tourists: 1.4 }, x: 86, y: 66, pros: ['Ferry crowds', 'cheap big room'], cons: ['Tourists do not return', 'high total rent'] }),
  v({ id: 'oysterSteps', name: 'Oyster Steps', address: 'Oyster Steps, Old Harbour', districtId: 'harbour', premisesId: 'cosy', rentPerTile: 20, trafficMult: 0.95, tilt: { foodies: 1.4 }, x: 84, y: 54, pros: ['Foodie pilgrimage', 'sea air'], cons: ['Pricey small room', 'little lunch'] }),
  v({ id: 'chandlery', name: 'Old Chandlery', address: 'Old Chandlery, Old Harbour', districtId: 'harbour', premisesId: 'loft', rentPerTile: 15, trafficMult: 0.9, tilt: { foodies: 1.1, tourists: 1.1 }, x: 70, y: 66, pros: ['Harbour loft with character', 'space'], cons: ['High rent bill', 'off the quay'] }),
  v({ id: 'harbourWallHatch', name: 'Harbour Wall Hatch', address: 'Harbour Wall Hatch, Old Harbour', districtId: 'harbour', premisesId: 'hole', rentPerTile: 17, trafficMult: 1.1, tilt: { tourists: 1.3 }, x: 78, y: 46, pros: ['Harbour address on a budget', 'strollers'], cons: ['Few seats', 'windy'] }),
  v({ id: 'customsHouse', name: 'Customs House Corner', address: 'Customs House Corner, Old Harbour', districtId: 'harbour', premisesId: 'corner', rentPerTile: 19, trafficMult: 1.0, wealthMult: 1.1, x: 92, y: 44, pros: ['Handsome old building', 'wealthy crowd'], cons: ['High rent', 'nothing at lunch'] }),
].map((x) => [x.id, x]));

/** The venue an old save lands on: same district and premises, if one exists. */
export function venueFor(districtId: string, premisesId: string): string | null {
  return Object.values(VENUES).find((x) => x.districtId === districtId && x.premisesId === premisesId)?.id ?? null;
}
