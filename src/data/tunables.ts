/** Every constant from 01-product/balance.md section 1 that is not tied to a content item. */
export const T = {
  time: {
    realSecondsPerGameMinute: 0.5,
    lunchHours: 3,
    dinnerHours: 4.5,
    weekdayMult: [0.8, 0.85, 0.9, 1.0, 1.25, 1.35, 1.1] as readonly number[], // Mon..Sun
    weekdayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as readonly string[],
  },
  demand: {
    captureBase: 0.035,
    repMultBase: 0.5,
    repMultSlope: 0.012,
    menuFitBase: 0.6,
    menuFitSlope: 0.8,
    priceMultMin: 0.2,
    priceMultMax: 1.5,
    budgetExponent: 2,
    budgetMultMin: 0.1,
    budgetMultMax: 1.2,
    qualityPivot: 60,
    qualityDivisor: 50,
    qualityMultMin: 0.3,
    qualityMultMax: 1.6,
    speedRef: 20,
    speedMultMin: 0.8,
    speedMultMax: 1.25,
    competitionFactor: 0.5,
    cannibalisation: 0.2,
    competitionCap: 0.9,
    choiceTemperature: 3,
    chefFameFoodieBonus: 0.05,
    crowdPleaserFit: 0.05,
    /** taste_match = min(1, base + slope x liked tags). Not defined in the PRD; see solution-design.md 11. */
    tasteMatchBase: 0.1,
    tasteMatchPerTag: 0.45,
    /** Dish choice: appeal drops by aversion x (price / (budget x wealth) - slack) for mains above the slack. */
    budgetChoiceSlack: 1.2,
    budgetChoiceAversion: 1.5,
  },
  attach: {
    drink: { base: 0.8, bonus: 0.1, pivot: 60, span: 25 },
    starter: { base: 0.3, bonus: 0.2, pivot: 60, span: 25 },
    dessert: { base: 0.2, bonus: 0.25, pivot: 45, span: 40 },
    // Bar (balance.md 4.7). Aperitivi and digestivi also depend on who the guest is and lunch or dinner.
    aperitivo: { base: 0.12, bonus: 0.15, pivot: 55, span: 30 },
    digestivo: { base: 0.15, bonus: 0.2, pivot: 55, span: 30 },
    /** How much each segment likes an aperitivo or a digestivo. */
    barAffinity: { students: 0.4, families: 0.4, professionals: 1.1, foodies: 1.4, seniors: 1.0, tourists: 1.3 } as Record<string, number>,
    /** At lunch guests order this share of what they would at dinner. */
    barLunch: 0.3,
    /** Every wine on the menu beyond the first: this many more drinks per guest (a second glass), up to wineListCap. */
    wineListPerWine: 0.05,
    wineListCap: 0.25,
    /**
     * Wine list score 0..1 (balance.md 4.9): wines beyond the first / wineListFull, x wine quality / 60 (0.7 to 1.3), capped at 1.
     * It draws wine lovers (demand x (1 + wineDemand[segment] x score)) and lifts the food score by
     * wineFood x score x (equipmentFoodBase + segment quality appeal): a good bottle makes the meal.
     */
    wineListFull: 6,
    wineDemand: { students: 0, families: 0, professionals: 0.08, foodies: 0.25, seniors: 0.05, tourists: 0.1 } as Record<string, number>,
    wineFood: 0.1,
    /** Drinks are chosen against this share of the segment's meal budget: students skip the Barolo. */
    barBudgetShare: 0.4,
    /** Extra minutes at the table per aperitivo and per digestivo ordered. */
    aperitivoMinutes: 6,
    digestivoMinutes: 8,
  },
  quality: {
    wIngredients: 0.5,
    wHarmony: 0.15,
    wKitchen: 0.35,
    harmonyBase: 60,
    harmonyMatch: 10,
    harmonyClash: -15,
    harmonyExtraTopping: -10,
    maxToppingsBeforePenalty: 4,
    /** Primi and secondi carry more on the plate before it gets muddled. */
    maxExtrasBeforePenaltyNonPizza: 5,
    kitchenBase: 30,
    kitchenPerSkill: 7,
    chefSpecialty: 5,
    perfectionistK: 8,
    eMin: -6,
    eMax: 15,
    artisanShareForTag: 0.5,
  },
  pricing: {
    fairIntercept: 4,
    fairQualitySlope: 0.08,
    fairFoodCostMult: 1.5,
    /** Guests accept a bigger markup on wine and spirits than on food (balance.md 4.7). */
    barCostMult: 2.5,
    /** Sides (drinks, starters, desserts) use a lower intercept and quality slope; not in the PRD, see solution-design.md 11. */
    sideFairIntercept: 1.5,
    sideFairQualitySlope: 0.04,
    /** Guests expect to pay more for a plated primo or secondo than for a pizza of the same quality and cost. */
    fairKindPremium: { pizza: 0, primo: 1, secondo: 4 },
    fairBandLow: 0.9,
    fairBandHigh: 1.1,
    valueBase: 0.7,
    valueSlope: 0.6,
  },
  kitchen: {
    bakeMinutes: 12,
    prepRate: 30,
    prepLoadFactor: 0.4,
    speedBase: 0.7,
    speedPerSkill: 0.06,
    volumeSpeedBase: 0.9,
    volumeSpeedPerSkill: 0.02,
    underSkillSpeed: 0.9,
    speedyBonus: 0.15,
    perfectionistCookTime: 1.1,
    platesPerCover: 3,
    dishwasherRate: 60,
    plateStock: 90,
    resale: 0.8,
  },
  /** kitchen-builder.md 4: walking distance on the kitchen grid. */
  kitchenFlow: {
    prepFreeTiles: 2,
    prepPenaltyPerTile: 0.04,
    prepPenaltyCap: 0.2,
    passFreeTiles: 3,
    plateWalkPerTile: 0.2,
    plateWalkCap: 2.0,
    washFreeTiles: 4,
    washPenaltyPerTile: 0.03,
    washPenaltyCap: 0.15,
    coldAtHandBonus: 0.05,
  },
  service: {
    seatWithHost: 2,
    seatWithoutHost: 5,
    order: 3,
    serve: 1.5,
    payBus: 4,
    tablesPerServer: 5,
    loadPenalty: 0.15,
    loadFloor: 0.4,
    partySizeFit: 0.75,
    utilisation: { lunch: 0.6, dinner: 0.65 },
    queueCap: 25,
    queueRhoCap: 0.95,
    perceivedQueueShare: { lunch: 0.5, dinner: 0.6 },
    walkAwayThreshold: 1.5,
    nightOwl: 0.1,
  },
  satisfaction: {
    wFood: 0.4,
    wService: 0.2,
    wAmbience: 0.15,
    wValue: 0.15,
    wWait: 0.1,
    foodQualityShare: 0.7,
    serviceBase: 0.3,
    servicePerSkill: 0.06,
    hostBonus: 0.1,
    charmerBonus: 0.05,
    reviewProbability: 0.2,
    /**
     * Guests taste a good kitchen (balance.md 4.4): food score + equipmentFood x E x (equipmentFoodBase + segment quality appeal),
     * where E is the equipment quality bonus when positive.
     */
    equipmentFood: 0.01,
    equipmentFoodBase: 0.5,
    /**
     * Ticket time (cook time plus queueing in a busy kitchen) counts for ticketShare of the wait score:
     * full marks up to ticketFree minutes, zero at ticketFree + ticketSpan.
     */
    ticketShare: 0.4,
    /** Share of the kitchen queue guests feel as waiting for food (the rest overlaps with drinks and starters). */
    ticketQueueShare: 0.5,
    ticketFree: 12,
    ticketSpan: 20,
  },
  /** kitchen-upgrades.md 7. */
  addons: {
    maxPerStation: 2,
    qualityCap: 2,
    coldReachTiles: 2,
  },
  /** Fire safety upgrades (src/data/fireSafety.ts) unlock once the restaurant has been open this many days. */
  fireSafety: { unlockDaysOpen: 60 },
  build: {
    /** Fire safety: seats at most 0.55 per dining tile (fresh-start.md 3). */
    maxSeatsPerDiningTile: 0.55,
    menuMinItems: 0,
    menuMaxItems: 36,
  },
  /**
   * Menu complexity (balance.md 4.2): every dish and every ingredient the line has to keep ready slows the cooks down.
   * complexity = perDish x food dishes + perIngredient x distinct food ingredients.
   * Up to free + perSkill x (average kitchen skill - 5) is handled without trouble; every point above costs
   * penaltyPerPoint of prep speed (down to efficiencyFloor); ticket times grow by ticketShare of that slowdown.
   */
  menu: {
    perDish: 1,
    perIngredient: 0.5,
    free: 16,
    perSkill: 1,
    penaltyPerPoint: 0.02,
    efficiencyFloor: 0.6,
    ticketShare: 0.4,
    /** Share of the kitchen queue guests feel as waiting for food (the rest overlaps with drinks and starters). */
    ticketQueueShare: 0.5,
    /** Prep work per plate relative to a pizza. Primi go on the stove, secondi need the most hands. */
    work: { pizza: 1, primo: 1.25, secondo: 1.5 },
    /** Extras (non base ingredients) included in that work; each one above adds workPerExtra. */
    freeExtras: 4,
    workPerExtra: 0.08,
  },
  ambience: {
    base: 25,
    decorFactor: 5,
    lightingCap: 10,
    crowdingPenalty: 5,
  },
  staff: {
    salaryPerSkill: 0.12,
    salaryPerFame: 0.25,
    moraleTarget: 70,
    moraleDrift: 3,
    moraleStart: 50,
    understaffedMorale: -1,
    raiseMorale: 10,
    raiseFraction: 0.1,
    steadyFloor: 50,
    noticeMorale: 30,
    noticeDays: 7,
    fameRepPerWeek: 1.5,
    fameRepCap: 5,
    shiftsPerSkill: 40,
    candidatesPerWeek: 6,
    fameCandidateRep: 50,
    severanceWeeks: 2,
    mentorDays: 28,
    frugalDiscount: 0.05,
  },
  reputation: {
    start: 30,
    learningRate: 0.05,
    walkAwayPenalty: 1,
    walkAwayThreshold: 0.1,
    reviewBase: -10,
    reviewSlope: 1.1,
  },
  finance: {
    // fresh-start.md 5: rags to riches.
    startingCash: 7000,
    starterLoanMax: 5000,
    starterLoanRate: 0.05,
    starterLoanWeeks: 52,
    leaseDepositWeeks: 4,
    utilitiesBase: 30,
    utilitiesPerCover: 0.8,
    upkeepBase: 15,
    restructureDays: 7,
    restructureWeeks: 4,
    freshStartThreshold: -20000,
  },
  /** 01-product/city-map.md 4 and 6. */
  /**
   * Local following (balance.md 4.3): a new restaurant has no loyal base yet and has to earn it.
   * Demand x (walkIn + (1 - walkIn) x following). Following moves toward a target set by satisfaction:
   * target = (satisfaction - satZero) / (satFull - satZero), clamped to 0..1, at `growth` a day while it rises
   * (word of mouth, scaled down when fewer than wordOfMouthGuests are served) and `decline` a day while it falls.
   */
  following: {
    start: 0.1,
    /** "Normal start" in the settings: the neighbourhood already knows you, as before the following existed. */
    normalStart: 1,
    walkIn: 0.25,
    satZero: 35,
    satFull: 62,
    growth: 0.04,
    decline: 0.04,
    wordOfMouthGuests: 30,
    wordOfMouthMin: 0.2,
    /** Guests who gave up waiting tell their friends too: following drops by this x the share who gave up. */
    walkAwayLoss: 0.1,
    closedDecay: 0.02,
    keepSameDistrict: 0.6,
    keepOtherDistrict: 0,
    /** Saves from before the following existed are established restaurants. */
    established: 0.8,
  },
  /**
   * Restaurant manager (prd.md 5.9): runs a restaurant the player is not running. Skill m 1..10.
   * Guests x (1 + demandBase + demandPerSkill x m): m 5 is as good as the player.
   * Stock accuracy = accuracyBase + accuracyPerSkill x m; waste x (1 + wastePerAccuracy x (parityAccuracy - accuracy)).
   * No manager: caretaker mode (last settings repeated) at caretakerDemand and caretakerWaste.
   */
  manager: {
    demandBase: -0.1,
    demandPerSkill: 0.02,
    accuracyBase: 0.7,
    accuracyPerSkill: 0.03,
    parityAccuracy: 0.85,
    wastePerAccuracy: 2,
    caretakerDemand: -0.2,
    caretakerWaste: 1.5,
    /** A frugal manager buys 5% cheaper. */
    frugalIngredients: 0.95,
    /** Opening another restaurant needs this reputation at one you already run (prd.md 5.12). */
    openRep: 50,
    /** Manager candidates on the weekly board: skill range. */
    candidateSkill: [3, 9] as readonly [number, number],
  },
  city: {
    sqmPerTile: 1.5,
    movingFee: 1500,
    repKeepSameDistrict: 0.9,
    repKeepOtherDistrict: 0.6,
    competitionMax: 0.9,
    lunchShareMin: 0.15,
    lunchShareMax: 0.8,
  },
  progression: {
    ownerServed: 1000,
    ownerRep: 45,
    restaurateurServed: 5000,
    restaurateurRep: 65,
  },
} as const;
