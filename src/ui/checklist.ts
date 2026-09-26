// Opening checklist (fresh-start.md 2): pinned until the first service, shows what is missing and the cheapest fix.

import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { buyPrice } from '../sim/economy';
import type { GameState } from '../sim/state';
import { h, money } from './dom';

export type ChecklistTab = 'menu' | 'kitchen' | 'room' | 'staff';

interface Item {
  label: string;
  done: boolean;
  hint: string;
  cost: number;
  tab: ChecklistTab;
}

export function openingItems(s: GameState): Item[] {
  const roles = new Set(s.equipment.map((e) => EQUIPMENT[e.itemId]?.role));
  const cold = s.equipment.some((e) => EQUIPMENT[e.itemId]?.cold);
  const tables = s.furniture.filter((f) => FURNITURE[f.itemId]?.kind === 'table').length;
  const cheapest = (role: string): number =>
    Math.min(...Object.values(EQUIPMENT).filter((e) => e.role === role && e.unlock.kind === 'start').map((e) => buyPrice(s, e.price)));
  const cook = s.candidates.filter((c) => c.role === 'cook').sort((a, b) => a.salary - b.salary)[0];
  const server = s.candidates.filter((c) => c.role === 'server').sort((a, b) => a.salary - b.salary)[0];
  return [
    { label: 'A pizza on the menu', done: s.recipes.some((r) => r.onMenu && r.kind === 'pizza'), hint: 'Put a few classics on the menu (free)', cost: 0, tab: 'menu' },
    { label: 'An oven', done: roles.has('oven'), hint: `Second hand Deck Oven ${money(cheapest('oven'))}`, cost: cheapest('oven'), tab: 'kitchen' },
    { label: 'A prep station', done: roles.has('counter'), hint: `Old Workbench ${money(cheapest('counter'))}`, cost: cheapest('counter'), tab: 'kitchen' },
    { label: 'A fridge', done: cold, hint: `Dough Fridge ${money(cheapest('cold'))}`, cost: cheapest('cold'), tab: 'kitchen' },
    { label: 'A sink', done: roles.has('sink'), hint: `Sink ${money(cheapest('sink'))}`, cost: cheapest('sink'), tab: 'kitchen' },
    { label: 'Tables', done: tables > 0, hint: `Folding tables ${money(buyPrice(s, FURNITURE.foldingTable?.price ?? 120))} each (6 is a good start)`, cost: buyPrice(s, FURNITURE.foldingTable?.price ?? 120) * 6, tab: 'room' },
    { label: 'A cook', done: s.staff.some((x) => x.role === 'cook' || x.role === 'chef'), hint: cook ? `${cook.name}, ${money(cook.salary)}/week` : 'Check the hiring board', cost: 0, tab: 'staff' },
    { label: 'A server', done: s.staff.some((x) => x.role === 'server'), hint: server ? `${server.name}, ${money(server.salary)}/week` : 'Check the hiring board', cost: 0, tab: 'staff' },
  ];
}

export function checklistCard(s: GameState, go: (tab: ChecklistTab) => void): HTMLElement | null {
  if (s.history.some((d) => d.open)) return null;
  const items = openingItems(s);
  const todo = items.filter((i) => !i.done);
  const cost = todo.reduce((a, i) => a + i.cost, 0);
  if (!todo.length) return h('div', { class: 'checklist' }, h('div', { class: 'small good' }, '✓ Ready to open! Tap "Open for the day".'));
  return h('div', { class: 'checklist' },
    h('div', { class: 'spread' }, h('b', null, todo.length ? 'Get ready to open' : 'Ready to open!'), h('span', { class: 'small muted' }, `${items.length - todo.length}/${items.length}`)),
    ...items.map((i) => h('button', { class: `check ${i.done ? 'done' : ''}`, onclick: () => go(i.tab) },
      h('span', { class: 'tick' }, i.done ? '✓' : ''),
      h('span', null, h('span', null, i.label), i.done ? null : h('span', { class: 'small muted' }, ` · ${i.hint}`)))),
    todo.length
      ? h('div', { class: 'small muted' }, `Suggested fit out still to buy: about ${money(cost)}. Wages are paid on Sunday.`)
      : h('div', { class: 'small good' }, 'Everything is in place. Tap "Open for the day".'));
}
