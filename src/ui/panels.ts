// Side panels: menu, kitchen, room, staff, money. Each renders from state and dispatches commands.

import { lastWeekCard } from './review';
import { deliveryCard } from './delivery';
import { DISTRICTS } from '../data/districts';
import { VENUES } from '../data/venues';
import { EQUIPMENT } from '../data/equipment';
import { FIRE_SAFETY, FIRE_SAFETY_IDS, type FireSafetyItem } from '../data/fireSafety';
import { ROOM_TOUCH_IDS, ROOM_TOUCHES, type RoomTouch, type TouchSpot } from '../data/roomTouches';
import { FURNITURE } from '../data/furniture';
import { INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { isBar, isMain, menuSection, PRIMO_BASES, WINE_IDS } from '../data/recipes';
import type { EquipmentItem, MainKind } from '../data/types';
import { ADDONS, addonEffectText, UPGRADE_PATHS } from '../data/addons';
import { T } from '../data/tunables';
import { analyse, repPriceMult, roomStats } from '../sim/analysis';
import { wineListScore } from '../sim/day';
import { addonProblem, type Command, fireSafetyUnlocked, isUnlocked, seatLimit, loanPayment, RANK_NAMES, suppliersFor, tiersFor, unlockText } from '../sim/game';
import { buyPrice, sellPrice } from '../sim/economy';
import { kitchenDims, layoutProblem } from '../sim/kitchen';
import type { GameState, OwnedEquipment, Recipe } from '../sim/state';
import { locationName, managerOf } from '../sim/chain';
import { ovr } from '../sim/staff';
import { act, h, meter, money, signed, toast } from './dom';
import type { Floor } from './floor';
import { compare } from './impact';
import { capacityCard } from './capacity';
import { pipelineData } from './pipeline';
import type { KitchenView } from './kitchenView';

export interface PanelCtx {
  state: GameState;
  /** The state right now (after any dispatch in this render). */
  current: () => GameState;
  dispatch: (cmd: Command) => string | null;
  floor: Floor;
  rerender: () => void;
}

const expanded = new Set<string>(['book:pizza']);
const creatorState: { kind: MainKind; base: string; picked: Set<string> } = { kind: 'pizza', base: 'spaghetti', picked: new Set() };
function impactLine(d: { profit: number; covers: number; quality: number; satisfaction: number }, extra = ''): HTMLElement {
  const cls = d.profit >= 0 ? 'good' : 'bad';
  return h('div', { class: 'impact' },
    h('b', { class: cls }, `${signed(d.profit)} $/day`), ' profit · ',
    `${signed(d.covers, 1)} guests · `,
    `${signed(d.quality, 1)} dish quality · `,
    `${signed(d.satisfaction, 1)} satisfaction`, extra ? ` · ${extra}` : '');
}

// ---------- Menu ----------

export function menuPanel(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const a = analyse(state);
  const onMenu = state.recipes.filter((r) => r.onMenu);
  const book = state.recipes.filter((r) => !r.onMenu);
  const kinds: Recipe['kind'][] = ['aperitivo', 'starter', 'pizza', 'primo', 'secondo', 'dessert', 'digestivo', 'drink'];
  const kindName: Record<Recipe['kind'], string> = {
    aperitivo: 'Aperitivi', starter: 'Antipasti', pizza: 'Pizzas', primo: 'Primi piatti', secondo: 'Secondi', dessert: 'Desserts',
    digestivo: 'Digestivi and coffee', drink: 'Drinks and wine',
  };

  const card = (r: Recipe): HTMLElement => {
    const d = a.dishes[r.id];
    if (!d) return h('div');
    const ratio = r.price / d.fairPrice;
    const band = ratio < T.pricing.fairBandLow ? 'Generous' : ratio > T.pricing.fairBandHigh ? 'Pricey' : 'Fair';
    const margin = r.price > 0 ? (r.price - d.foodCost) / r.price : 0;
    const open = expanded.has(r.id);
    return h('div', { class: `card ${r.onMenu ? '' : 'off'}` },
      h('h3', null, h('span', null, r.name), h('span', { class: 'small muted' }, `Q ${d.quality.toFixed(0)}`)),
      meter(d.quality, 100, d.quality > 80 ? 'warm' : ''),
      h('div', { class: 'spread' },
        h('div', { class: 'price' },
          h('button', { class: 'small', 'aria-label': 'Lower price', onclick: () => act(ctx, { type: 'setPrice', recipeId: r.id, price: r.price - 0.5 }) }, '−'),
          h('b', null, money(r.price, true)),
          h('button', { class: 'small', 'aria-label': 'Raise price', onclick: () => act(ctx, { type: 'setPrice', recipeId: r.id, price: r.price + 0.5 }) }, '+')),
        h('div', { class: 'small', style: 'text-align:right' },
          h('div', { class: band === 'Pricey' ? 'warn' : band === 'Generous' ? 'good' : '' }, `${band} · fair ${money(d.fairPrice * 0.9, true)} to ${money(d.fairPrice * 1.1, true)}`),
          h('div', { class: 'muted' }, `Cost ${money(d.foodCost, true)} · margin ${(margin * 100).toFixed(0)}%`))),
      h('div', { class: 'chips' },
        ...[...d.tags].map((t) => h('span', { class: 'chip' }, t)),
        isMain(r.kind) && d.work > 1 ? h('span', { class: 'chip', title: 'Prep work per plate compared with a simple pizza' }, `prep x${d.work.toFixed(2)}`) : null,
        r.kind === 'primo' || r.kind === 'secondo' ? h('span', { class: 'chip', title: 'Cooked on the stove, not in the pizza oven' }, 'no oven') : null),
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => { if (open) expanded.delete(r.id); else expanded.add(r.id); ctx.rerender(); } }, open ? 'Hide ingredients' : 'Ingredients and suppliers'),
        (() => {
          const sec = menuSection(state.recipes, r.kind);
          const full = !r.onMenu && sec.count >= sec.max;
          return h('button', {
            class: 'small', disabled: full,
            title: full ? `The ${sec.name} menu holds ${sec.max} items. Take something off first.` : '',
            onclick: () => act(ctx, { type: 'toggleMenu', recipeId: r.id, on: !r.onMenu }),
          }, r.onMenu ? 'Take off menu' : full ? `${sec.name === 'bar' ? 'Bar' : 'Menu'} full, take a dish off first` : 'Put on menu');
        })(),
        r.custom && !r.onMenu ? h('button', { class: 'small ghost', onclick: () => act(ctx, { type: 'deleteRecipe', recipeId: r.id }) }, 'Delete') : null),
      open ? h('div', null, ...r.lines.map((l) => {
        const ing = INGREDIENTS[l.ingredientId];
        const tiers = tiersFor(l.ingredientId);
        const sups = suppliersFor(l.ingredientId, l.tier);
        return h('div', { class: 'line' },
          h('div', null,
            h('div', null, ing?.name ?? l.ingredientId),
            h('div', { class: 'small muted' }, `Quality ${TIERS[l.tier].quality + (SUPPLIERS[l.supplierId]?.qualityOffset ?? 0)} · keeps ${Math.round((ing?.shelfLifeDays ?? 0) * TIERS[l.tier].shelfLifeMult)} days`)),
          h('div', { class: 'stack', style: 'gap:4px;justify-items:end' },
            h('div', { class: 'seg' }, ...tiers.map((t) => h('button', { class: t === l.tier ? 'on' : '', title: TIERS[t].name, onclick: () => act(ctx, { type: 'setTier', recipeId: r.id, ingredientId: l.ingredientId, tier: t }) }, TIERS[t].name[0] as string))),
            sups.length > 1
              ? h('select', { onchange: (e: Event) => act(ctx, { type: 'setSupplier', recipeId: r.id, ingredientId: l.ingredientId, supplierId: (e.target as HTMLSelectElement).value }) },
                ...sups.map((sid) => h('option', { value: sid, selected: sid === l.supplierId }, `${SUPPLIERS[sid]?.name} (x${SUPPLIERS[sid]?.priceIndex.toFixed(2)})`)))
              : h('span', { class: 'small muted' }, SUPPLIERS[l.supplierId]?.name ?? '')));
      })) : null);
  };

  // Custom dishes: pizzas keep their base, primi pick a pasta or rice, secondi start from nothing.
  const creatorKind = creatorState.kind;
  const notExtras = new Set(['mascarpone', 'cream', 'gelato', 'bread', 'garlicButter']);
  const extrasPool = Object.values(INGREDIENTS).filter((i) => !i.base && i.category !== 'drinks' && !notExtras.has(i.id));
  const picked = creatorState.picked;
  const nameInput = h('input', { type: 'text', placeholder: creatorKind === 'pizza' ? 'Name your pizza' : 'Name your dish', maxLength: 40 });
  const hint: Record<MainKind, string> = {
    pizza: 'Dough, tomato sauce and mozzarella are included. Pick up to 6 toppings. Pairs that go well together raise harmony; more than 4 toppings lowers it.',
    primo: 'Pick a pasta, rice or gnocchi, then up to 6 ingredients. Primi go on the stove, so they spare the oven but keep the prep line busy. No cheese on fish.',
    secondo: 'Pick up to 6 ingredients around a meat, fish or vegetable. Secondi are the most work per plate, and fetch the highest prices.',
  };
  const creator = h('div', { class: 'card' },
    h('h3', null, 'Create a dish'),
    h('div', { class: 'seg' }, ...(['pizza', 'primo', 'secondo'] as MainKind[]).map((k) =>
      h('button', { class: k === creatorKind ? 'on' : '', onclick: () => { creatorState.kind = k; ctx.rerender(); } }, k === 'pizza' ? 'Pizza' : k === 'primo' ? 'Primo' : 'Secondo'))),
    h('div', { class: 'small muted' }, hint[creatorKind]),
    creatorKind === 'primo'
      ? h('div', { class: 'seg' }, ...PRIMO_BASES.map((b) =>
        h('button', { class: b === creatorState.base ? 'on' : '', onclick: () => { creatorState.base = b; ctx.rerender(); } }, INGREDIENTS[b]?.name ?? b)))
      : null,
    h('div', { class: 'chips' }, ...extrasPool.map((i) => {
      const b = h('button', { class: `small ${picked.has(i.id) ? 'active' : ''}`, onclick: () => {
        if (picked.has(i.id)) picked.delete(i.id);
        else if (picked.size < 6) picked.add(i.id);
        b.classList.toggle('active', picked.has(i.id));
      } }, i.name);
      return b;
    })),
    h('div', { class: 'row' }, nameInput,
      h('button', { class: 'primary', onclick: () => {
        const price = creatorKind === 'pizza' ? 13 : creatorKind === 'primo' ? 15 : 20;
        const err = ctx.dispatch({ type: 'createDish', kind: creatorKind, name: nameInput.value, base: creatorState.base, ingredients: [...picked], price });
        if (err) toast(err, 'warn');
        else picked.clear();
      } }, 'Add to recipe book')));

  const mc = a.kitchen.menu;
  const complexity = h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Kitchen complexity'), h('span', { class: `small ${mc.efficiency < 1 ? 'warn' : 'muted'}` },
      mc.efficiency < 1 ? `line at ${Math.round(mc.efficiency * 100)}% speed` : 'the line keeps up')),
    meter(mc.score, Math.max(mc.allowance * 1.6, mc.score), mc.score > mc.allowance ? 'warm' : ''),
    h('div', { class: 'small muted' },
      `${mc.dishes} dishes and ${mc.ingredients} ingredients to keep ready: ${mc.score.toFixed(1)} of ${mc.allowance.toFixed(1)} your cooks handle comfortably. ` +
      'Every point above slows prep and lengthens ticket times. Skilled cooks and dishes that share ingredients keep a wide menu running.'));

  const avgQ = onMenu.filter((r) => isMain(r.kind)).reduce((x, r, _, arr) => x + (a.dishes[r.id]?.quality ?? 0) / arr.length, 0);
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Menu'), h('span', { class: 'muted small' },
      `food ${menuSection(state.recipes, 'pizza').count} of ${T.build.menuMaxFood} · bar ${menuSection(state.recipes, 'drink').count} of ${T.build.menuMaxBar} · average main quality ${avgQ.toFixed(0)}`)),
    h('div', { class: 'small muted' }, 'Pick a quality tier for every ingredient: B Basic, S Standard, P Premium, A Artisan. Better tiers raise quality and cost, and spoil faster.'),
    repPriceMult(state.rep) > 1.005
      ? h('div', { class: 'small good' }, `Your reputation (${state.rep.toFixed(0)}) lets you charge more: guests accept prices ${Math.round((repPriceMult(state.rep) - 1) * 100)}% higher than an unknown place. The fair bands below already include it.`)
      : h('div', { class: 'small muted' }, `Above reputation ${T.pricing.repPremiumFrom}, guests accept higher prices: up to +${Math.round(T.pricing.repPremium * 100)}% at reputation 100.`),
    ...kinds.flatMap((k) => {
      const items = onMenu.filter((r) => r.kind === k);
      return items.length ? [h('h3', null, kindName[k]), ...items.map(card)] : [];
    }),
    complexity,
    barCard(state),
    h('h2', null, 'Recipe book'),
    ...kinds.flatMap((k) => {
      const items = book.filter((r) => r.kind === k);
      if (!items.length) return [];
      const key = `book:${k}`;
      const open = expanded.has(key);
      return [
        h('button', { class: 'spread ghost', onclick: () => { if (open) expanded.delete(key); else expanded.add(key); ctx.rerender(); } },
          h('b', null, kindName[k]), h('span', { class: 'small muted' }, `${items.length} ${open ? '▾' : '▸'}`)),
        ...(open ? items.map(card) : []),
      ];
    }),
    creator);
}

/** The bar's share of the bill (balance.md 4.7): wine list, aperitivi and digestivi. */
function barCard(state: GameState): HTMLElement {
  const on = state.recipes.filter((r) => r.onMenu);
  const wineList = on.filter((r) => WINE_IDS.has(r.id));
  const wines = wineList.length;
  const second = Math.min(T.attach.wineListCap, T.attach.wineListPerWine * Math.max(0, wines - 1));
  const score = wineListScore(wineList, analyse(state));
  const has = (k: Recipe['kind']): boolean => on.some((r) => r.kind === k);
  const last = [...state.history].reverse().find((d) => d.open);
  let barSales = 0;
  if (last) for (const [id, n] of Object.entries(last.dishSales)) {
    const r = state.recipes.find((x) => x.id === id);
    if (r && isBar(r.kind)) barSales += n * r.price;
  }
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'The bar'), last && last.covers > 0
      ? h('span', { class: 'small muted' }, `${money(last.pnl.sales / last.covers, true)} a guest · bar ${Math.round((barSales / Math.max(1, last.pnl.sales)) * 100)}% of sales`)
      : null),
    h('div', { class: 'kv' },
      h('span', null, 'Wines on the list'), h('b', { class: second > 0 ? 'good' : '' }, `${wines}${second > 0 ? ` · +${Math.round(second * 100)}% second glasses` : ''}`),
      h('span', null, 'Wine list score'), h('b', { class: score > 0 ? 'good' : '' }, score > 0
        ? `${Math.round(score * 100)}% · +${Math.round((T.attach.wineDemand.foodies ?? 0) * score * 100)}% foodies · tastier meals`
        : 'add a second wine'),
      h('span', null, 'Aperitivi'), h('b', null, has('aperitivo') ? 'on the menu' : 'none yet'),
      h('span', null, 'Digestivi and coffee'), h('b', null, has('digestivo') ? 'on the menu' : 'none yet')),
    h('div', { class: 'small muted' },
      'Drinks raise what every guest spends and need no kitchen work. Each wine beyond the first gets more guests ordering a second glass. ' +
      `A good wine list (${T.attach.wineListFull + 1} wines, better tiers count more) draws foodies and wine loving tourists and makes guests rate the meal higher. ` +
      'Aperitivi and digestivi sell best at dinner, in a lovely room and to foodies, tourists and professionals; guests linger a little longer over them. ' +
      'Students and families stick to cheaper drinks.'));
}

// ---------- Kitchen (kitchen-builder.md 7) ----------

/** What guests feel of the kitchen (balance.md 4.4): the equipment's craft on the plate and how fast food arrives. */
function guestsNotice(state: GameState, E: number): HTMLElement {
  const now = pipelineData(state).now;
  const t = (sv: 'lunch' | 'dinner'): number | undefined => now.find((s) => s.service === sv)?.ticketTime;
  const lunch = t('lunch');
  const dinner = t('dinner');
  const craft = (base: number): number => 100 * T.satisfaction.wFood * T.satisfaction.equipmentFood * Math.max(0, E) * base;
  const s = T.satisfaction;
  const speed = (m: number | undefined): string => (m === undefined ? '' : m <= s.ticketFree ? 'hot and quick' : m <= s.ticketFree + s.ticketSpan / 2 ? 'a little slow' : 'guests are waiting on the kitchen');
  return h('div', { class: 'card' },
    h('h3', null, 'What guests notice'),
    h('div', { class: 'kv' },
      h('span', null, 'Food arrives in'),
      h('b', { class: dinner !== undefined && dinner > s.ticketFree + s.ticketSpan / 2 ? 'warn' : '' },
        dinner === undefined ? 'not open yet' : `${lunch?.toFixed(0)} min lunch · ${dinner.toFixed(0)} min dinner (${speed(Math.max(lunch ?? 0, dinner))})`),
      h('span', null, 'Craft on the plate'),
      h('b', { class: E > 0 ? 'good' : '' }, E > 0 ? `+${craft(s.equipmentFoodBase).toFixed(1)} to +${craft(s.equipmentFoodBase + 1).toFixed(1)} satisfaction` : 'none yet')),
    h('div', { class: 'small muted' }, 'Better ovens, benches and proving lift how guests rate the food; foodies notice most, students least. More or faster stations shorten the wait for food when the kitchen is busy.'));
}

type GroupBy = 'station' | 'line';
type Group = { key: string; title: string; blurb: string; test: (it: EquipmentItem) => boolean };

/** Equipment by what it does in the kitchen. */
const STATION_GROUPS: Group[] = [
  { key: 'ovens', title: '🔥 Ovens', blurb: 'Bake the pizzas. The biggest lever on how many you sell and how good they are.', test: (it) => it.role === 'oven' },
  { key: 'prep', title: '🫓 Prep stations', blurb: 'One cook each. Where dough becomes pizza and pasta gets plated.', test: (it) => it.role === 'counter' },
  { key: 'dough', title: '🌀 Dough tools', blurb: 'Sheeters attach to a prep station; proving cabinets lift every base.', test: (it) => it.role === 'sheeter' || it.role === 'proving' },
  { key: 'cold', title: '❄️ Cold storage', blurb: 'Dough for the day. Next to a bench it speeds prep up.', test: (it) => it.role === 'cold' },
  { key: 'wash', title: '🧽 Washing', blurb: 'Clean plates and clean hands keep the line moving.', test: (it) => it.role === 'sink' || it.role === 'dishMachine' || it.role === 'handwash' },
  { key: 'pass', title: '🍽️ Pass and plates', blurb: 'Where plates wait for the servers, and spare plates for the rush.', test: (it) => it.role === 'pass' || it.role === 'storage' },
  { key: 'delivery', title: '🛵 Delivery', blurb: 'A packing station is needed before you can deliver.', test: (it) => it.role === 'packing' },
];

/** Equipment by quality line. */
const LINE_GROUPS: Group[] = [
  { key: 'basic', title: 'Basic', blurb: 'Cheap and dependable. Where every kitchen starts.', test: (it) => it.family === 'basic' },
  { key: 'volume', title: 'Volume', blurb: 'More pizzas an hour, a touch less care on each.', test: (it) => it.family === 'volume' },
  { key: 'quality', title: 'Quality', blurb: 'Better food guests can taste, at a fair pace.', test: (it) => it.family === 'quality' },
  { key: 'hybrid', title: 'Hybrid', blurb: 'Quality at speed. Expensive, and worth it for a busy good restaurant.', test: (it) => it.family === 'hybrid' },
  { key: 'artisan', title: 'Artisan', blurb: 'The very best food. Slow, and needs skilled cooks.', test: (it) => it.family === 'artisan' },
];

const FOLD_KEY = 'pizza-d.kitchenFold';
const GROUP_KEY = 'pizza-d.kitchenGroupBy';

function loadFolds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Groups the player folded, kept per browser. */
const folded = loadFolds();
let groupBy: GroupBy = (() => {
  try {
    return localStorage.getItem(GROUP_KEY) === 'line' ? 'line' : 'station';
  } catch {
    return 'station';
  }
})();

function saveFolds(): void {
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...folded]));
  } catch {
    // Private mode: folds last for this visit only.
  }
}

const groupsFor = (by: GroupBy): Group[] => (by === 'line' ? LINE_GROUPS : STATION_GROUPS);

/** A foldable group; `where` keeps the add, catalogue and owned lists folding on their own. */
function foldGroup(where: string, g: Group, meta: string, rows: HTMLElement[], openByDefault = true): HTMLElement {
  const key = `${where}:${g.key}`;
  const isOpen = openByDefault ? !folded.has(key) : folded.has(`${key}:open`);
  return h('details', {
    class: 'eq-group', open: isOpen,
    ontoggle: (e: Event) => {
      const open = (e.currentTarget as HTMLDetailsElement).open;
      if (openByDefault) {
        if (open) folded.delete(key);
        else folded.add(key);
      } else if (open) folded.add(`${key}:open`);
      else folded.delete(`${key}:open`);
      saveFolds();
    },
  },
  h('summary', null, h('span', { class: 'group-title' }, g.title), h('span', { class: 'small muted' }, meta)),
  h('div', { class: 'small muted' }, g.blurb),
  h('div', { class: 'fitlist' }, ...rows));
}

/** "Group by" switch and fold all / open all, for a list of groups. */
function groupControls(ctx: PanelCtx, where: string, keys: string[], openByDefault = true): HTMLElement {
  const setAll = (open: boolean): void => {
    for (const k of keys) {
      const key = `${where}:${k}`;
      if (openByDefault) {
        if (open) folded.delete(key);
        else folded.add(key);
      } else if (open) folded.add(`${key}:open`);
      else folded.delete(`${key}:open`);
    }
    saveFolds();
    ctx.rerender();
  };
  return h('div', { class: 'row eq-controls' },
    h('span', { class: 'small muted' }, 'Group by'),
    h('div', { class: 'seg' }, ...(['station', 'line'] as const).map((by) => h('button', {
      class: groupBy === by ? 'on' : '',
      onclick: () => {
        groupBy = by;
        try {
          localStorage.setItem(GROUP_KEY, by);
        } catch {
          // Remembered for this visit only.
        }
        ctx.rerender();
      },
    }, by === 'station' ? 'Station' : 'Quality line'))),
    h('button', { class: 'small', onclick: () => setAll(true) }, 'Open all'),
    h('button', { class: 'small', onclick: () => setAll(false) }, 'Fold all'));
}

/** Unlocked first, then the cheapest. */
const byAvailability = (state: GameState) => (a: EquipmentItem, b: EquipmentItem): number =>
  Number(isUnlocked(state, b.unlock)) - Number(isUnlocked(state, a.unlock)) || a.price - b.price;

function itemStats(it: EquipmentItem): string {
  const stats: string[] = [];
  if (it.role === 'oven') {
    const perHour = ((it.slots ?? 0) * 60) / (12 * (it.bakeMult ?? 1)) * (it.family === 'volume' ? 0.9 + 0.02 * 5 : 0.7 + 0.06 * 5);
    stats.push(`${perHour.toFixed(0)} pizzas/h with Speed 50 cooks`);
  }
  if (it.role === 'counter') stats.push(`prep station${it.prepMult && it.prepMult !== 1 ? ` x${it.prepMult}` : ''}`);
  if (it.role === 'sheeter') stats.push(`x${it.prepMult} prep at the station it touches`);
  if (it.cold) stats.push('keeps dough cold');
  if (it.coldCap) stats.push(`dough for ${it.coldCap} pizzas a day`);
  if (it.washers) stats.push(`room for ${it.washers} dishwasher${it.washers > 1 ? 's' : ''}`);
  if (it.washPoints) stats.push(`${it.washPoints} wash point${it.washPoints > 1 ? 's' : ''} for ${it.washPoints * 2} cooks`);
  if (it.plateStock) stats.push(`${it.plateStock} more clean plates`);
  if (it.role === 'oven') stats.push(`needs ${it.tend ?? 0.5} of a cook to tend`);
  if (it.effectMult) stats.push(it.role === 'pass' ? `serving x${it.effectMult}` : it.role === 'packing' ? `packs in x${it.effectMult} the time` : `dishwashing x${it.effectMult}`);
  if (it.deliveryFood) stats.push(`deliveries arrive ${Math.round(it.deliveryFood * 100)} points hotter`);
  if (it.qualityMod) stats.push(`quality ${signed(it.qualityMod)}`);
  if (it.skillNeeded) stats.push(`needs cooks with Quality ${it.skillNeeded * 10}`);
  stats.push(`${it.w}x${it.h} tiles`);
  if (it.maintenance) stats.push(`${money(it.maintenance)}/week upkeep`);
  return stats.join(' · ');
}

/** Where the item can go with its top left on this tile, either orientation. */
function fitAt(state: GameState, itemId: string, x: number, y: number): OwnedEquipment | null {
  const dims = kitchenDims(state.premisesId);
  for (const rot of [0, 1] as const) {
    const cand = { uid: -1, itemId, x, y, rot };
    if (!layoutProblem([...state.equipment, cand], dims)) return cand;
  }
  // The pass only fits on the hatch: offer it from either hatch tile.
  if (EQUIPMENT[itemId]?.role === 'pass' && dims.pass.some(([px, py]) => px === x && py === y)) {
    const cand = { uid: -1, itemId, x: dims.pass[0]?.[0] ?? x, y: 0, rot: 0 as const };
    if (!layoutProblem([...state.equipment, cand], dims)) return cand;
  }
  return null;
}

export function kitchenPanel(ctx: PanelCtx, view: KitchenView): HTMLElement {
  const { state } = ctx;
  const a = analyse(state);
  const k = a.kitchen;
  const sel = view.selection;
  const clear = (): void => {
    view.select({ kind: 'none' });
    ctx.rerender();
  };

  if (sel.kind === 'tile') {
    const groups = groupsFor(groupBy).map((g) => {
      const items = Object.values(EQUIPMENT).filter(g.test).sort(byAvailability(state));
      let locked = 0;
      const rows = items.map((it) => {
        const spot = fitAt(state, it.id, sel.x, sel.y);
        if (!spot) return null;
        const unlocked = isUnlocked(state, it.unlock);
        if (!unlocked) locked += 1;
        let impact: HTMLElement | null = null;
        if (unlocked && !folded.has(`add:${g.key}`)) {
          const hyp = structuredClone(state);
          hyp.equipment.push(spot);
          const d = compare(state, hyp);
          impact = impactLine(d, d.profit > 1 ? `pays back in about ${Math.ceil(buyPrice(state, it.price) / d.profit)} days` : 'does not raise your bottleneck today');
        }
        return h('div', { class: `fit ${unlocked ? '' : 'locked'}` },
          h('div', { class: 'spread' }, h('b', null, it.name), h('b', null, money(buyPrice(state, it.price)))),
          h('div', { class: 'row' }, h('span', { class: `chip family-${it.family}` }, it.family), h('span', { class: 'small muted' }, it.blurb)),
          h('div', { class: 'small' }, itemStats(it)),
          impact,
          unlocked
            ? h('button', { class: 'primary small', disabled: state.cash < buyPrice(state, it.price), onclick: () => {
              const err = ctx.dispatch({ type: 'buyEquipment', itemId: it.id, x: spot.x, y: spot.y, rot: spot.rot });
              if (err) toast(err, 'warn');
              else {
                toast(`${it.name} installed`, 'good');
                const added = ctx.current().equipment.at(-1);
                view.select(added ? { kind: 'station', uid: added.uid } : { kind: 'none' });
                ctx.rerender();
              }
            } }, state.cash < buyPrice(state, it.price) ? `Need ${money(buyPrice(state, it.price) - state.cash)} more` : 'Buy and install here')
            : h('span', { class: 'small muted' }, `🔒 ${unlockText(it.unlock)}`));
      }).filter((x) => x !== null) as HTMLElement[];
      if (!rows.length) return null;
      const ready = rows.length - locked;
      return foldGroup('add', g, `${ready} ready${locked ? ` · ${locked} locked` : ''}`, rows);
    }).filter((x): x is HTMLElement => x !== null);
    return h('div', { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, 'Add equipment'), h('button', { class: 'small', onclick: clear }, 'Close')),
      h('div', { class: 'small muted' }, `Things that fit with their corner on this spot. Cash ${money(state.cash)}. Tap a group to fold it.`),
      groupControls(ctx, 'add', groupsFor(groupBy).map((g) => g.key)),
      groups.length ? h('div', { class: 'stack' }, ...groups) : h('div', { class: 'muted' }, 'Nothing fits here. Try another spot, or move something to make room.'));
  }

  if (sel.kind === 'station') {
    const e = state.equipment.find((x) => x.uid === sel.uid);
    const it = e ? EQUIPMENT[e.itemId] : undefined;
    if (e && it) {
      const st = k.flow.stations[e.uid];
      const lines: string[] = [];
      if (it.role === 'oven') {
        lines.push(`Bakes ${(k.ovenOutput[e.uid] ?? 0).toFixed(1)} pizzas an hour with your cooks.`);
        const dPass = k.flow.ovenDPass[e.uid] ?? 0;
        lines.push(dPass <= T.kitchenFlow.passFreeTiles ? `${dPass} tiles from the pass: no walking delay.` : `${dPass} tiles from the pass: plates take ${Math.min(T.kitchenFlow.plateWalkCap, T.kitchenFlow.plateWalkPerTile * (dPass - T.kitchenFlow.passFreeTiles)).toFixed(1)} min longer. Move it closer.`);
      }
      if (st) {
        const out = k.stationPrep[e.uid] ?? 0;
        lines.push(out > 0 ? `Preps ${out.toFixed(1)} dishes an hour.` : 'No cook free for this station. Hire another cook.');
        lines.push(st.reachMult < 1 ? `${st.dOven} tiles to the nearest oven: ${Math.round((1 - st.reachMult) * 100)}% slower. Keep it within ${T.kitchenFlow.prepFreeTiles}.` : `${st.dOven} tile${st.dOven === 1 ? '' : 's'} to the nearest oven: no walking delay.`);
        if (st.coldMult > 1) lines.push(`A fridge is right next to it: ${Math.round((st.coldMult - 1) * 100)}% faster.`);
        else if (!it.cold) lines.push('Tip: put a Dough Fridge right next to it for 5% faster prep.');
        if (st.sheeter) lines.push('A dough sheeter is attached.');
      }
      if (it.role === 'sheeter' && k.flow.unattachedSheeters.includes(e.uid)) lines.push('Not attached: put it right next to a prep station without a sheeter.');
      if (it.role === 'sink' || it.role === 'dishMachine') lines.push(k.flow.washMult < 1 ? `${k.flow.dWash} tiles from the pass: dishwashing ${Math.round((1 - k.flow.washMult) * 100)}% slower.` : 'Close enough to the pass.');
      return h('div', { class: 'stack' },
        h('div', { class: 'spread' }, h('h2', null, it.name), h('button', { class: 'small', onclick: clear }, 'Close')),
        h('div', { class: 'row' }, h('span', { class: `chip family-${it.family}` }, it.family), h('span', { class: 'small muted' }, it.blurb)),
        h('div', { class: 'card' }, h('div', { class: 'small' }, itemStats(it)), ...lines.map((l) => h('div', null, l))),
        upgradesSection(ctx, e, it),
        h('div', { class: 'small muted' }, 'Drag it on the plan to move it. Moving is free.'),
        h('div', { class: 'row' },
          it.role !== 'pass' && it.w !== it.h
            ? h('button', { onclick: () => act(ctx, { type: 'moveEquipment', uid: e.uid, x: e.x, y: e.y, rot: e.rot ? 0 : 1 }) }, 'Rotate')
            : null,
          h('button', { onclick: () => {
            if (!confirm(`Sell the ${it.name} for ${money(sellPrice(state, it.price, e.paid))}?`)) return;
            view.select({ kind: 'none' });
            act(ctx, { type: 'sellEquipment', uid: e.uid }, `Sold for ${money(sellPrice(state, it.price, e.paid))}`);
          } }, `Sell ${money(sellPrice(state, it.price, e.paid))}`)));
    }
  }

  const last = [...state.history].reverse().find((d) => d.open);
  const bottlenecks = last?.services.filter((s) => s.bottleneck !== 'none').map((s) => `${s.service}: ${s.bottleneck}`) ?? [];
  const penalties = Object.values(k.flow.stations).filter((s) => s.reachMult < 1).length + (k.plateWalk > 0 ? 1 : 0) + (k.flow.washMult < 1 ? 1 : 0);
  return h('div', { class: 'stack' },
    h('h2', null, 'Kitchen'),
    h('div', { class: 'small muted' }, 'Tap an empty spot on the plan to add equipment there. Tap a station to see what it does; drag it to move it. Short walks between prep, oven and pass make service faster.'),
    h('div', { class: 'card' },
      h('div', { class: 'kv' },
        h('span', null, 'Ovens'), h('b', null, `${k.ovenPerHour.toFixed(1)} pizzas/h`),
        h('span', null, 'Prep'), h('b', null, `${k.prepPerHour.toFixed(1)} dishes/h`),
        h('span', null, 'Prep stations'), h('b', null, `${k.staffedCounters} of ${k.counters} staffed`),
        h('span', null, 'Bake and walk'), h('b', null, `${k.cookTime.toFixed(1)} min`),
        h('span', null, 'Kitchen skill'), h('b', null, `${k.kitchenSkillK.toFixed(0)} (cooks' Quality ${Math.round(k.avgSkill * 10)})`),
        h('span', null, 'Equipment quality'), h('b', null, signed(k.equipmentE, 1)),
        h('span', null, 'Kitchen flow'), h('b', { class: penalties ? 'warn' : 'good' }, penalties ? `${penalties} slow spot${penalties > 1 ? 's' : ''}` : 'Smooth')),
      h('div', { class: 'small muted' }, bottlenecks.length ? `Last service limits: ${bottlenecks.join(', ')}` : 'No bottleneck at the last service.')),
    capacityCard(state),
    guestsNotice(state, k.equipmentE),
    h('div', { class: 'row' },
      h('button', { onclick: () => act(ctx, { type: 'tidyKitchen' }, 'Kitchen tidied into a tight pizza line') }, 'Tidy up layout')),
    h('h3', null, 'Your equipment'),
    groupControls(ctx, 'own', groupsFor(groupBy).map((g) => g.key)),
    ...groupsFor(groupBy).map((g) => {
      const mine = state.equipment.filter((e) => { const it = EQUIPMENT[e.itemId]; return !!it && g.test(it); });
      if (!mine.length) return null;
      const upgrades = mine.filter((e) => UPGRADE_PATHS.some(([from, to]) => from === e.itemId && EQUIPMENT[to] && isUnlocked(state, EQUIPMENT[to].unlock))).length;
      return foldGroup('own', g, `${mine.length} owned${upgrades ? ` · ${upgrades} can upgrade` : ''}`, mine.map((e) => {
        const it = EQUIPMENT[e.itemId] as EquipmentItem;
        return h('button', { class: 'spread', style: 'text-align:left', onclick: () => { view.select({ kind: 'station', uid: e.uid }); ctx.rerender(); } },
          h('span', null, h('b', null, it.name), ' ', h('span', { class: `chip family-${it.family}` }, it.family)),
          h('span', { class: 'small muted' }, it.role === 'oven' ? `${(k.ovenOutput[e.uid] ?? 0).toFixed(0)}/h` : it.role === 'counter' ? `${(k.stationPrep[e.uid] ?? 0).toFixed(0)}/h` : ''));
      }));
    }),
    catalogueSection(state));
}

/** Every piece of equipment in the game, grouped and folded, so the player can plan ahead (kitchen-upgrades.md 7). */
function catalogueSection(state: GameState): HTMLElement {
  const all = Object.values(EQUIPMENT);
  const ready = all.filter((it) => isUnlocked(state, it.unlock)).length;
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h3', null, 'Equipment catalogue'), h('span', { class: 'small muted' }, `${ready} of ${all.length} available`)),
    h('div', { class: 'small muted' }, 'Everything you can buy, now and later. Tap an empty spot on the plan to place one, or tap a station you own to upgrade it on the spot.'),
    ...groupsFor(groupBy).map((g) => {
      const items = all.filter(g.test).sort(byAvailability(state));
      if (!items.length) return null;
      const open = items.filter((it) => isUnlocked(state, it.unlock)).length;
      return foldGroup('cat', g, `${open} of ${items.length} available`, items.map((it) => {
        const unlocked = isUnlocked(state, it.unlock);
        return h('div', { class: `fit ${unlocked ? '' : 'locked'}` },
          h('div', { class: 'spread' }, h('b', null, it.name), h('b', null, money(buyPrice(state, it.price)))),
          h('div', { class: 'row' }, h('span', { class: `chip family-${it.family}` }, it.family), h('span', { class: 'small muted' }, it.blurb)),
          h('div', { class: 'small' }, itemStats(it)),
          unlocked ? null : h('span', { class: 'small muted' }, `🔒 ${unlockText(it.unlock)}`));
      }), false);
    }));
}

/** Upgrades for one station: trade in paths and add-ons (kitchen-upgrades.md 6). */
function upgradesSection(ctx: PanelCtx, e: OwnedEquipment, it: EquipmentItem): HTMLElement | null {
  const { state } = ctx;
  const paths = UPGRADE_PATHS.filter(([from]) => from === e.itemId).map(([, to]) => EQUIPMENT[to]).filter((x): x is EquipmentItem => !!x);
  const fitting = Object.values(ADDONS).filter((a) => a.fits.includes(e.itemId));
  if (!paths.length && !fitting.length) return null;
  const installed = e.addons ?? [];
  const preview = (mutate: (hyp: GameState) => void, cost: number): HTMLElement => {
    const hyp = structuredClone(state);
    mutate(hyp);
    const d = compare(state, hyp);
    return impactLine(d, d.profit > 1 ? `pays back in about ${Math.ceil(cost / d.profit)} days` : 'does not raise your bottleneck today');
  };
  const rows: HTMLElement[] = [];
  for (const to of paths) {
    const unlocked = isUnlocked(state, to.unlock);
    const keep = installed.filter((a) => ADDONS[a.id]?.fits.includes(to.id));
    const dropRefund = installed.filter((a) => !keep.includes(a)).reduce((x, a) => x + sellPrice(state, ADDONS[a.id]?.price ?? 0, a.paid), 0);
    const net = buyPrice(state, to.price) - sellPrice(state, it.price, e.paid) - dropRefund;
    rows.push(h('div', { class: 'fit upgrade' },
      h('div', { class: 'spread' }, h('b', null, `⬆ Upgrade to ${to.name}`), h('b', null, money(net))),
      h('div', { class: 'small muted' }, `${to.blurb} Same spot; your old one is traded in at 80%.${keep.length ? ` Keeps ${keep.map((a) => ADDONS[a.id]?.name).join(', ')}.` : ''}`),
      unlocked ? preview((hyp) => {
        const x = hyp.equipment.find((q) => q.uid === e.uid);
        if (x) {
          x.itemId = to.id;
          x.addons = keep;
        }
      }, net) : null,
      unlocked
        ? h('button', { class: 'primary small', disabled: state.cash < net, onclick: () => act(ctx, { type: 'upgradeStation', uid: e.uid, toItemId: to.id }) },
          state.cash < net ? `Need ${money(net - state.cash)} more` : `Upgrade for ${money(net)}`)
        : h('span', { class: 'small muted' }, `🔒 ${unlockText(to.unlock)}`)));
  }
  for (const inst of installed) {
    const a = ADDONS[inst.id];
    if (!a) continue;
    rows.push(h('div', { class: 'fit installed' },
      h('div', { class: 'spread' }, h('b', null, `✓ ${a.name}`), h('span', { class: 'small good' }, addonEffectText(a))),
      h('button', { class: 'small', onclick: () => act(ctx, { type: 'removeAddon', uid: e.uid, addonId: a.id }) }, `Remove, +${money(sellPrice(state, a.price, inst.paid))}`)));
  }
  for (const a of fitting.filter((x) => !installed.some((i) => i.id === x.id))) {
    const problem = addonProblem(state, e, a);
    const locked = !isUnlocked(state, a.unlock);
    const cost = buyPrice(state, a.price);
    rows.push(h('div', { class: `fit ${locked ? 'locked' : ''}` },
      h('div', { class: 'spread' }, h('b', null, a.name), h('b', null, money(cost))),
      h('div', { class: 'small' }, h('span', { class: 'good' }, addonEffectText(a)), a.maintenance ? ` · ${money(a.maintenance)}/week upkeep` : ''),
      h('div', { class: 'small muted' }, a.blurb),
      !problem ? preview((hyp) => {
        const x = hyp.equipment.find((q) => q.uid === e.uid);
        if (x) x.addons = [...(x.addons ?? []), { id: a.id, paid: cost }];
      }, cost) : null,
      locked
        ? h('span', { class: 'small muted' }, `🔒 ${unlockText(a.unlock)}`)
        : problem
          ? h('span', { class: 'small muted' }, problem)
          : h('button', { class: 'primary small', disabled: state.cash < cost, onclick: () => act(ctx, { type: 'installAddon', uid: e.uid, addonId: a.id }, `${a.name} installed`) },
            state.cash < cost ? `Need ${money(cost - state.cash)} more` : `Install ${money(cost)}`)));
  }
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h3', null, 'Upgrades'), h('span', { class: 'small muted' }, `${installed.length} of ${T.addons.maxPerStation} add-ons`)),
    h('div', { class: 'fitlist' }, ...rows));
}

// ---------- Room ----------

export function roomPanel(ctx: PanelCtx): HTMLElement {
  const { state, floor } = ctx;
  const r = analyse(state).room;
  const tool = floor.tool;
  const sel = floor.selected !== null ? state.furniture.find((f) => f.uid === floor.selected) : undefined;
  const selItem = sel ? FURNITURE[sel.itemId] : undefined;
  const setTool = (t: typeof floor.tool): void => {
    floor.tool = t;
    floor.selected = null;
    floor.invalidate();
    ctx.rerender();
  };
  return h('div', { class: 'stack' },
    h('h2', null, 'Dining room'),
    h('div', { class: 'card' },
      h('div', { class: 'kv' },
        h('span', null, 'Seats'), h('b', null, `${r.seats} at ${r.tables} tables (fire safety allows ${seatLimit(state.premisesId, state.fireSafety)})`),
        h('span', null, 'Ambience'), h('b', null, r.ambience.toFixed(0)),
        h('span', null, 'Decor points'), h('b', null, `${r.decorPoints} (lighting ${Math.min(10, r.lighting)}/10)`),
        h('span', null, 'Squeezed tables'), h('b', { class: r.crowdedTables ? 'warn' : '' }, String(r.crowdedTables))),
      meter(r.ambience, 100, r.ambience > 70 ? 'warm' : ''),
      h('div', { class: 'small muted' }, 'Ambience lifts satisfaction and how many guests add drinks, starters and desserts. Every table needs a free tile beside it.')),
    roomTouchesCard(ctx),
    fireSafetyCard(ctx),
    h('div', { class: 'row' },
      h('button', { class: tool.kind === 'none' ? 'active' : '', onclick: () => setTool({ kind: 'none' }) }, 'Select'),
      h('span', { class: 'small muted' }, tool.kind === 'place' ? 'Tap the floor to place. Tap Select when done.' : tool.kind === 'move' ? 'Tap where it should go.' : 'Tap an item on the floor to move or sell it.')),
    sel && selItem
      ? h('div', { class: 'card' },
        h('h3', null, selItem.name),
        h('div', { class: 'row' },
          h('button', { onclick: () => { floor.tool = { kind: 'move', uid: sel.uid }; floor.invalidate(); ctx.rerender(); } }, 'Move'),
          h('button', { onclick: () => { floor.selected = null; act(ctx, { type: 'removeFurniture', uid: sel.uid }, `Sold for ${money(sellPrice(state, selItem.price, sel.paid))}`); } }, `Sell for ${money(sellPrice(state, selItem.price, sel.paid))}`)))
      : null,
    h('div', { class: 'palette' }, ...Object.values(FURNITURE).map((f) => h('button', {
      class: tool.kind === 'place' && tool.itemId === f.id ? 'on' : '',
      disabled: state.cash < buyPrice(state, f.price),
      onclick: () => setTool({ kind: 'place', itemId: f.id }),
    },
    h('b', null, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
    h('span', { class: 'small muted' }, `${money(buyPrice(state, f.price))} · ${f.w}x${f.h}`),
    h('span', { class: 'small' }, f.kind === 'table' ? `${f.seats} seats` : `+${f.decorPoints} decor${f.lighting ? `, +${f.lighting} light` : ''}`)))));
}

/** Decoration that takes no floor tile (balance.md 4.8): walls, tables, ceiling. */
function roomTouchesCard(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const now = roomStats(state).ambience;
  const spots: [TouchSpot, string][] = [['wall', 'On the walls'], ['table', 'On the tables'], ['ceiling', 'Lighting'], ['room', 'Atmosphere']];
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Make it beautiful'), h('span', { class: 'small muted' }, `ambience ${now.toFixed(0)}`)),
    h('div', { class: 'small muted' }, 'Decoration for the walls, the tables and the ceiling. None of it takes a floor tile, so you keep every table.'),
    ...spots.flatMap(([spot, label]) => [
      h('div', { class: 'small', style: 'margin-top:6px' }, h('b', null, label)),
      ...ROOM_TOUCH_IDS.filter((id) => ROOM_TOUCHES[id]?.spot === spot).map((id) => {
        const it = ROOM_TOUCHES[id] as RoomTouch;
        const have = state.roomTouches.includes(id);
        const cost = buyPrice(state, it.price);
        const gain = roomStats({ ...state, roomTouches: [...state.roomTouches, id] }).ambience - now;
        return h('div', { class: 'line' },
          h('div', null,
            h('div', null, it.name),
            h('div', { class: 'small muted' }, `${it.blurb}${it.upkeep ? ` · ${money(it.upkeep)}/week` : ''}`)),
          have
            ? h('button', { class: 'small ghost', title: 'Take it down and sell it at 80%', onclick: () => act(ctx, { type: 'removeRoomTouch', id }) }, 'Installed · remove')
            : h('button', { class: 'small', disabled: state.cash < cost, onclick: () => act(ctx, { type: 'buyRoomTouch', id }, `${it.name} added`) },
              `${money(cost)}${gain > 0.05 ? ` · +${gain.toFixed(1)} ambience` : ''}`));
      }),
    ]));
}

function fireSafetyCard(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const unlocked = fireSafetyUnlocked(state);
  const toGo = T.fireSafety.unlockDaysOpen - state.daysOpen;
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Fire safety'), h('span', { class: 'small muted' }, `${seatLimit(state.premisesId, state.fireSafety)} seats allowed`)),
    h('div', { class: 'small muted' }, unlocked
      ? 'Each upgrade lets the fire officer approve more seats. They are part of the building and stay behind if you move.'
      : `The fire officer only looks at a proven restaurant: upgrades unlock after ${T.fireSafety.unlockDaysOpen} days open (${toGo} to go).`),
    ...FIRE_SAFETY_IDS.map((id) => {
      const it = FIRE_SAFETY[id] as FireSafetyItem;
      const have = state.fireSafety.includes(id);
      const needs = it.requires && !state.fireSafety.includes(it.requires) ? FIRE_SAFETY[it.requires] : undefined;
      const cost = buyPrice(state, it.price);
      const after = seatLimit(state.premisesId, [...state.fireSafety, id]) - seatLimit(state.premisesId, state.fireSafety);
      return h('div', { class: 'line' },
        h('div', null,
          h('div', null, it.name),
          h('div', { class: 'small muted' }, `${it.blurb} +${Math.round(it.seatBonus * 100)}% seats${it.upkeep ? ` · ${money(it.upkeep)}/week inspections` : ''}`)),
        have
          ? h('span', { class: 'small good' }, 'Installed')
          : h('button', {
            class: 'small', disabled: !unlocked || !!needs || state.cash < cost,
            title: needs ? `Needs the ${needs.name.toLowerCase()} first` : '',
            onclick: () => act(ctx, { type: 'buyFireSafety', id }),
          }, `${money(cost)}${unlocked && !needs ? ` · +${after} seats` : ''}`));
    }));
}

// ---------- Restaurants (prd.md 5.9, 5.12) ----------

function restaurantsCard(ctx: PanelCtx): HTMLElement | null {
  const { state } = ctx;
  if (!state.branches.length) return null;
  const lastProfit = (h: GameState['history']): string => {
    const d = h.at(-1);
    return d ? (d.open ? `${money(d.pnl.profit)} yesterday` : 'closed yesterday') : 'not open yet';
  };
  const hasManager = !!managerOf(state.staff);
  return h('div', { class: 'card' },
    h('h3', null, h('span', null, 'Your restaurants'), h('span', { class: 'small muted' }, `${state.branches.length + 1} in total`)),
    h('div', { class: 'line' },
      h('div', null, h('div', null, h('b', null, locationName(state))), h('div', { class: 'small muted' }, `You run this one · reputation ${state.rep.toFixed(0)} · ${lastProfit(state.history)}`)),
      h('span', { class: 'small good' }, 'Here')),
    ...state.branches.map((b) => {
      const m = managerOf(b.staff);
      return h('div', { class: 'line' },
        h('div', null,
          h('div', null, h('b', null, locationName(b))),
          h('div', { class: 'small muted' }, `${m ? `${m.name}, OVR ${ovr(m)}` : 'No manager: caretaker mode'} · reputation ${b.rep.toFixed(0)} · locals ${Math.round(b.following * 100)}% · ${lastProfit(b.history)}`)),
        h('button', { class: 'small', disabled: !hasManager, title: hasManager ? '' : 'Hire a manager for this restaurant first', onclick: () => act(ctx, { type: 'switchRestaurant', locationId: b.id }) }, 'Go and run it'));
    }),
    hasManager ? null : h('div', { class: 'small muted' }, `To go and run another restaurant, first hire a manager for ${locationName(state)}.`));
}

// ---------- Money ----------

export function moneyPanel(ctx: PanelCtx, extra: HTMLElement): HTMLElement {
  const { state } = ctx;
  const a = analyse(state);
  const last = state.history.at(-1);
  const recent = state.history.slice(-14);
  const maxAbs = Math.max(1, ...recent.map((d) => Math.abs(d.pnl.profit)));
  const payment = loanPayment(state.loan);
  const where = (state.venueId ? VENUES[state.venueId]?.name : null) ?? DISTRICTS[state.districtId]?.name;
  const p = T.progression;
  const nextRank = state.rank === 'cook'
    ? `Owner: serve ${p.ownerServed} guests and reach reputation ${p.ownerRep}`
    : state.rank === 'owner' ? `Restaurateur: serve ${p.restaurateurServed} guests and reach reputation ${p.restaurateurRep}` : 'Chains arrive in v1.0';
  const pnlRows = (x: NonNullable<typeof last>['pnl']): HTMLElement[] => [
    h('span', null, 'Money in (sales)'), h('b', null, money(x.sales)),
    ...(x.deliverySales ? [h('span', null, 'Delivery sales'), h('b', null, money(x.deliverySales))] : []),
    h('span', null, 'Ingredients'), h('b', null, money(-x.ingredients)),
    h('span', null, 'Waste'), h('b', null, money(-x.waste)),
    h('span', null, 'Staff'), h('b', null, money(-x.staff)),
    h('span', null, 'Rent'), h('b', null, money(-x.rent)),
    h('span', null, 'Utilities and upkeep'), h('b', null, money(-(x.utilities + x.upkeep))),
    h('span', null, 'Loan interest'), h('b', null, money(-x.interest)),
    ...(x.marketing ? [h('span', null, 'Marketing'), h('b', null, money(-x.marketing))] : []),
    ...(x.deliveryCosts ? [h('span', null, 'Delivery: commission, packaging, vehicles'), h('b', null, money(-x.deliveryCosts))] : []),
    h('span', { class: 'total' }, 'Profit'), h('b', { class: `total ${x.profit >= 0 ? 'good' : 'bad'}` }, money(x.profit)),
  ];
  return h('div', { class: 'stack' },
    h('h2', null, 'Money'),
    restaurantsCard(ctx),
    h('div', { class: 'card' },
      h('div', { class: 'spread' }, h('span', null, 'Cash'), h('span', { class: `big ${state.cash < 0 ? 'bad' : ''}` }, money(state.cash))),
      h('div', { class: 'small muted' }, `Weekly bills on Sunday night: wages ${money(a.weeklySalaries)}, rent ${money(a.weeklyRent)} (${where}), loan ${money(payment)}. Upkeep ${money(a.kitchen.maintenancePerWeek)}/week is paid daily.`),
      state.cash < 0 ? h('div', { class: 'warn small' }, 'Cash is below zero. Payments continue; after 7 days the bank advisor pauses your loan payments. Pizza D never ends your game.') : null),
    lastWeekCard(ctx),
    deliveryCard(ctx),
    last ? h('div', { class: 'card' }, h('h3', null, `Day ${last.day}`), h('div', { class: 'pnl' }, ...pnlRows(last.pnl))) : null,
    recent.length ? h('div', { class: 'card' }, h('h3', null, 'Profit, last 14 days'),
      h('div', { class: 'bars' }, ...recent.map((d) => h('div', { class: d.pnl.profit < 0 ? 'neg' : '', title: `Day ${d.day}: ${money(d.pnl.profit)}`, style: `height:${(Math.abs(d.pnl.profit) / maxAbs) * 100}%` })))) : null,
    h('div', { class: 'card' },
      h('h3', null, 'Starter loan'),
      h('div', { class: 'kv' },
        h('span', null, 'Owed'), h('b', null, money(state.loan.balance)),
        h('span', null, 'Rate'), h('b', null, `${(state.loan.annualRate * 100).toFixed(0)}% a year`),
        h('span', null, 'Weekly payment'), h('b', null, state.loan.pausedWeeks ? `paused ${state.loan.pausedWeeks} more weeks` : money(payment))),
      h('div', { class: 'row' },
        h('button', { class: 'small', disabled: state.loan.balance >= T.finance.starterLoanMax, onclick: () => act(ctx, { type: 'takeLoan', amount: 5000 }, 'Borrowed $5,000') }, 'Borrow $5,000'),
        h('button', { class: 'small', disabled: state.loan.balance >= T.finance.starterLoanMax, onclick: () => act(ctx, { type: 'takeLoan', amount: T.finance.starterLoanMax }, 'Loan approved') }, 'Borrow the maximum'),
        h('button', { class: 'small', disabled: state.loan.balance <= 0, onclick: () => act(ctx, { type: 'repayLoan', amount: 5000 }) }, 'Repay $5,000'))),
    h('div', { class: 'card' },
      h('h3', null, h('span', null, 'Reputation and rank'), h('span', { class: 'small' }, RANK_NAMES[state.rank])),
      // One card for the three ratings (cleanup sprint 5), each with what moves it.
      h('div', { class: 'kv' },
        h('span', null, 'Reputation'), h('b', null, state.rep.toFixed(1))),
      h('div', { class: 'small muted' }, 'Follows guest satisfaction: food, service, room, value and waiting. Guests who give up waiting cost some.'),
      h('div', { class: 'kv' },
        h('span', null, 'Local following'), h('b', null, `${Math.round(state.following * 100)}%`)),
      h('div', { class: 'small muted' }, 'Locals who know you. Grows by word of mouth from happy guests and from campaigns; fades when guests leave unhappy.'),
      ...(state.delivery ? [
        h('div', { class: 'kv' }, h('span', null, 'Delivery rating'), h('b', null, state.delivery.drep.toFixed(1))),
        h('div', { class: 'small muted' }, 'Separate from your reputation: hot food, fair app prices and deliveries under the promise raise it; refused and late orders lower it.'),
      ] : []),
      h('div', { class: 'kv' },
        h('span', null, 'Guests served'), h('b', null, Math.round(state.totalServed).toLocaleString())),
      h('div', { class: 'small muted' }, `Next: ${nextRank}`)),
    extra);
}
