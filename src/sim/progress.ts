// Ranks, unlocks and the loan schedule.

import { EQUIPMENT } from '../data/equipment';
import type { RankId, Unlock } from '../data/types';
import { T } from '../data/tunables';
import type { GameState } from './state';

const RANK_ORDER: RankId[] = ['cook', 'owner', 'restaurateur', 'chainFounder'];
export const RANK_NAMES: Record<RankId, string> = {
  cook: 'Cook', owner: 'Owner', restaurateur: 'Restaurateur', chainFounder: 'Chain Founder',
};

export function isUnlocked(state: GameState, unlock: Unlock): boolean {
  if (state.unlockAll) return true;
  switch (unlock.kind) {
    case 'start': return true;
    case 'served': return state.totalServed >= unlock.guests;
    case 'rep': return state.rep >= unlock.rep;
    case 'day': return state.day >= unlock.day;
    case 'rank': return RANK_ORDER.indexOf(state.rank) >= RANK_ORDER.indexOf(unlock.rank);
  }
}

export function unlockText(unlock: Unlock): string {
  switch (unlock.kind) {
    case 'start': return 'Available';
    case 'served': return `Serve ${unlock.guests} guests`;
    case 'rep': return `Reputation ${unlock.rep}`;
    case 'day': return `Day ${unlock.day}`;
    case 'rank': return `Rank ${RANK_NAMES[unlock.rank]}`;
  }
}

export function loanPayment(loan: GameState['loan']): number {
  if (loan.balance <= 0 || loan.weeksLeft <= 0) return 0;
  const r = loan.annualRate / 52;
  return (loan.balance * r) / (1 - Math.pow(1 + r, -loan.weeksLeft));
}

export function computeRank(state: GameState): RankId {
  const p = T.progression;
  if (state.totalServed >= p.restaurateurServed && state.rep >= p.restaurateurRep) return 'restaurateur';
  if (state.totalServed >= p.ownerServed && state.rep >= p.ownerRep) return 'owner';
  return state.rank;
}

export function unlockedIds(state: GameState): Set<string> {
  return new Set(Object.values(EQUIPMENT).filter((e) => isUnlocked(state, e.unlock)).map((e) => e.id));
}
