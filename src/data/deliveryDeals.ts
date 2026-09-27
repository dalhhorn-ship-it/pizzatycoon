// Delivery deals: a standing offer on every delivery order. Prices go down, orders and baskets go up.
// Every number is a tuning assumption and may move within plus or minus 40%.

export type DeliveryDealId = 'secondPizza25' | 'secondPizzaHalf' | 'freeDelivery' | 'mealDeal' | 'tenOff' | 'lunchDeal';

export interface DeliveryDeal {
  id: DeliveryDealId;
  name: string;
  /** Share of the mains value given away on an average order. */
  mainsDiscount: number;
  /** Share of the drinks and desserts value given away. */
  sidesDiscount: number;
  /** Extra mains, drinks and desserts on an average order (bigger baskets). */
  extraMains: number;
  extraDrinks: number;
  extraDesserts: number;
  /** More orders from being seen with a deal on the app, on top of the lower price. */
  orderLift: number;
  /** You pay the delivery fee: own riders lose it, on the app you refund it to the app. */
  feeWaived?: boolean;
  /** Only at lunch. */
  lunchOnly?: boolean;
  effect: string;
  blurb: string;
}

export const DELIVERY_DEALS: Record<DeliveryDealId, DeliveryDeal> = {
  secondPizza25: {
    id: 'secondPizza25', name: 'Second pizza 25% off', mainsDiscount: 0.12, sidesDiscount: 0, extraMains: 0.3, extraDrinks: 0, extraDesserts: 0, orderLift: 0.12,
    effect: 'About 12% off the mains, +0.3 mains an order, +12% orders', blurb: 'Two pizzas feel like a bargain. Bigger orders, a thinner margin on each.',
  },
  secondPizzaHalf: {
    id: 'secondPizzaHalf', name: 'Second pizza half price', mainsDiscount: 0.22, sidesDiscount: 0, extraMains: 0.45, extraDrinks: 0, extraDesserts: 0, orderLift: 0.2,
    effect: 'About 22% off the mains, +0.45 mains an order, +20% orders', blurb: 'The loudest deal on the app. Volume first, margin second.',
  },
  freeDelivery: {
    id: 'freeDelivery', name: 'Free delivery', mainsDiscount: 0, sidesDiscount: 0, extraMains: 0, extraDrinks: 0, extraDesserts: 0, orderLift: 0.18, feeWaived: true,
    effect: '+18% orders; you pay the delivery fee on every order', blurb: 'No fee at checkout: the one line every app user reads.',
  },
  mealDeal: {
    id: 'mealDeal', name: 'Meal deal: main, drink and dessert 15% off', mainsDiscount: 0.15, sidesDiscount: 0.15, extraMains: 0, extraDrinks: 0.5, extraDesserts: 0.5, orderLift: 0.08,
    effect: '15% off, +0.5 drinks and +0.5 desserts an order, +8% orders', blurb: 'Sells what costs little to make: drinks and desserts ride along.',
  },
  tenOff: {
    id: 'tenOff', name: '10% off every order', mainsDiscount: 0.1, sidesDiscount: 0.1, extraMains: 0, extraDrinks: 0, extraDesserts: 0, orderLift: 0.05,
    effect: '10% off everything, +5% orders', blurb: 'Simple and fair. Price hungry students notice most.',
  },
  lunchDeal: {
    id: 'lunchDeal', name: 'Lunch deal: 20% off before 3pm', mainsDiscount: 0.2, sidesDiscount: 0.2, extraMains: 0, extraDrinks: 0.3, extraDesserts: 0, orderLift: 0.25, lunchOnly: true,
    effect: 'Lunch only: 20% off, +0.3 drinks an order, +25% orders', blurb: 'Fills the quiet lunch oven and leaves dinner prices alone.',
  },
};

export const DELIVERY_DEAL_IDS = Object.keys(DELIVERY_DEALS) as DeliveryDealId[];
