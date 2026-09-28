// The game's commands, the events they raise and the reducer's result (solution-design.md 5.1).

import type { CampaignId } from '../data/campaigns';
import type { DeliveryDealId } from '../data/deliveryDeals';
import type { ServiceDealId } from '../data/serviceDeals';
import type { AttrId, MainKind, Role, SegmentId, Service, TierId } from '../data/types';
import type { Economy } from './economy';
import type { Bookings, DayReport, DealDays, DeliveryMode, DeliveryZone, GameState, MinOrder, ServiceStyle, StaffPolicy, VehicleKind } from './state';

export type Command =
  | { type: 'setTier'; recipeId: string; ingredientId: string; tier: TierId }
  | { type: 'setSupplier'; recipeId: string; ingredientId: string; supplierId: string }
  | { type: 'setPrice'; recipeId: string; price: number }
  | { type: 'toggleMenu'; recipeId: string; on: boolean }
  | { type: 'createPizza'; name: string; toppings: string[]; price: number }
  /** A custom main. `base` is the pasta or rice for a primo; pizzas always get dough, sauce and mozzarella. */
  | { type: 'createDish'; kind: MainKind; name: string; base?: string; ingredients: string[]; price: number }
  | { type: 'deleteRecipe'; recipeId: string }
  | { type: 'placeFurniture'; itemId: string; x: number; y: number }
  | { type: 'moveFurniture'; uid: number; x: number; y: number }
  | { type: 'removeFurniture'; uid: number }
  /** Table or counter service, and bookings (floor-service.md 2). */
  | { type: 'setFloorPolicy'; style?: ServiceStyle; bookings?: Bookings }
  /** The set menu at lunch or dinner, or none (service-deals.md 2). */
  | { type: 'setServiceDeal'; service: Service; deal: ServiceDealId | null }
  | { type: 'buyEquipment'; itemId: string; x?: number; y?: number; rot?: 0 | 1 }
  | { type: 'moveEquipment'; uid: number; x: number; y: number; rot: 0 | 1 }
  | { type: 'sellEquipment'; uid: number }
  | { type: 'tidyKitchen' }
  | { type: 'installAddon'; uid: number; addonId: string }
  | { type: 'removeAddon'; uid: number; addonId: string }
  | { type: 'upgradeStation'; uid: number; toItemId: string }
  | { type: 'movePremises'; districtId: string; premisesId: string }
  /** Hire at the asking salary, or offer 10% below (staff-management.md 4.4). */
  | { type: 'hire'; candidateId: number; low?: boolean }
  | { type: 'interview'; candidateId: number }
  | { type: 'agency'; role: Role; plus?: boolean }
  | { type: 'fire'; staffId: number; locationId?: number }
  | { type: 'giveRaise'; staffId: number; locationId?: number }
  | { type: 'train'; staffId: number; courseId: string; locationId?: number }
  | { type: 'coach'; coachId: number; traineeId: number; attr: AttrId; locationId?: number }
  | { type: 'stopCoaching'; coachId: number; locationId?: number }
  | { type: 'promote'; staffId: number; role: Role; locationId?: number }
  | { type: 'daysOff'; staffId: number; locationId?: number }
  | { type: 'answerReview'; staffId: number; accept: boolean; locationId?: number }
  | { type: 'answerOffer'; staffId: number; match: boolean; locationId?: number }
  | { type: 'setStaffPolicy'; policy: Partial<StaffPolicy>; locationId?: number }
  | { type: 'setDelegateStaff'; on: boolean }
  /** Marketing (competition.md 5). */
  | { type: 'startCampaign'; campaignId: CampaignId; audience: SegmentId[]; locationId?: number }
  | { type: 'stopCampaign'; campaignId: CampaignId; locationId?: number }
  /** Hold a free venue for 28 days so no rival takes it (3.5). */
  | { type: 'holdVenue'; venueId: string }
  /** Mystery diner at a rival (7.3). */
  | { type: 'mysteryDiner'; rivalId: number }
  | { type: 'startDelivery'; mode: DeliveryMode }
  | {
    type: 'setDelivery'; mode?: DeliveryMode; markup?: number; packaging?: 'basic' | 'eco'; throttle?: number | null; deal?: DeliveryDealId | null;
    zone?: DeliveryZone; minOrder?: MinOrder; dealDays?: DealDays; menuSize?: number;
  }
  | { type: 'stopDelivery' }
  | { type: 'buyVehicle'; kind: VehicleKind }
  | { type: 'sellVehicle'; kind: VehicleKind }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'setUnlockAll'; on: boolean }
  | { type: 'setEconomy'; economy: Partial<Economy> }
  | { type: 'freshStart' }
  | { type: 'rentVenue'; venueId: string }
  | { type: 'buyFireSafety'; id: string }
  | { type: 'buyRoomTouch'; id: string }
  | { type: 'removeRoomTouch'; id: string }
  /** Open a second (third...) restaurant; the current one stays open under its restaurant manager. */
  | { type: 'openRestaurant'; venueId: string }
  /** Go and run another restaurant you own; the one you leave needs a manager. */
  | { type: 'switchRestaurant'; locationId: number }
  | { type: 'runDay' }
  /** Fast forward: up to 7 days, stopping early when something needs the player (see WEEK_STOPS, and a closed day with a single restaurant). */
  | { type: 'runWeek' };

export interface GameEvent {
  kind: 'dayCompleted' | 'weekCompleted' | 'unlocked' | 'rankUp' | 'restructure' | 'staffLeft' | 'staffNotice' | 'staffReview' | 'staffOffer' | 'market' | 'info';
  text: string;
  report?: DayReport;
  /** weekCompleted: every day that ran, and why it stopped early (null when all 7 ran). */
  reports?: DayReport[];
  stoppedBecause?: string | null;
}

export interface Result {
  state: GameState;
  events: GameEvent[];
  error?: string;
}

export const fail = (state: GameState, error: string): Result => ({ state, events: [], error });
