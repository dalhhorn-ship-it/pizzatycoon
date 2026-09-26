// Side panels: menu, kitchen, room, staff, money. Each renders from state and dispatches commands.

import { DISTRICTS } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { ROLE_NAMES, TRAITS } from '../data/staff';
import type { Role } from '../data/types';
import { T } from '../data/tunables';
import { analyse } from '../sim/analysis';
import { type Command, isUnlocked, loanPayment, RANK_NAMES, suppliersFor, tiersFor, unlockText } from '../sim/game';
import type { GameState, Recipe } from '../sim/state';
import { h, meter, money, signed, toast } from './dom';
import type { Floor } from './floor';
import { compare } from './impact';

export interface PanelCtx {
  state: GameState;
  dispatch: (cmd: Command) => string | null;
  floor: Floor;
  rerender: () => void;
}

const expanded = new Set<string>();
const act = (ctx: PanelCtx, cmd: Command, ok?: string): void => {
  const err = ctx.dispatch(cmd);
  if (err) toast(err, 'warn');
  else if (ok) toast(ok, 'good');
};

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
  const kinds: Recipe['kind'][] = ['pizza', 'starter', 'drink', 'dessert'];
  const kindName: Record<Recipe['kind'], string> = { pizza: 'Pizzas', starter: 'Starters', drink: 'Drinks', dessert: 'Desserts' };

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
      h('div', { class: 'chips' }, ...[...d.tags].map((t) => h('span', { class: 'chip' }, t))),
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => { if (open) expanded.delete(r.id); else expanded.add(r.id); ctx.rerender(); } }, open ? 'Hide ingredients' : 'Ingredients and suppliers'),
        h('button', { class: 'small', onclick: () => act(ctx, { type: 'toggleMenu', recipeId: r.id, on: !r.onMenu }) }, r.onMenu ? 'Take off menu' : 'Put on menu'),
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

  const notToppings = new Set(['garlicButter', 'mascarpone', 'cream', 'gelato', 'bread', 'softDrink', 'houseWine', 'craftBeer']);
  const toppings = Object.values(INGREDIENTS).filter((i) => !i.base && i.category !== 'drinks' && !notToppings.has(i.id));
  const picked = new Set<string>();
  const nameInput = h('input', { type: 'text', placeholder: 'Name your pizza', maxLength: 40 });
  const creator = h('div', { class: 'card' },
    h('h3', null, 'Create a pizza'),
    h('div', { class: 'small muted' }, 'Dough, tomato sauce and mozzarella are included. Pick up to 6 toppings. Pairs that go well together raise harmony; more than 4 toppings lowers it.'),
    h('div', { class: 'chips' }, ...toppings.map((i) => {
      const b = h('button', { class: 'small', onclick: () => {
        if (picked.has(i.id)) picked.delete(i.id);
        else if (picked.size < 6) picked.add(i.id);
        b.classList.toggle('active', picked.has(i.id));
      } }, i.name);
      return b;
    })),
    h('div', { class: 'row' }, nameInput,
      h('button', { class: 'primary', onclick: () => act(ctx, { type: 'createPizza', name: nameInput.value, toppings: [...picked], price: 13 }) }, 'Add to recipe book')));

  const avgQ = onMenu.filter((r) => r.kind === 'pizza').reduce((x, r, _, arr) => x + (a.dishes[r.id]?.quality ?? 0) / arr.length, 0);
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Menu'), h('span', { class: 'muted small' }, `${onMenu.length} of 16 items · average pizza quality ${avgQ.toFixed(0)}`)),
    h('div', { class: 'small muted' }, 'Pick a quality tier for every ingredient: B Basic, S Standard, P Premium, A Artisan. Better tiers raise quality and cost, and spoil faster.'),
    ...kinds.flatMap((k) => {
      const items = onMenu.filter((r) => r.kind === k);
      return items.length ? [h('h3', null, kindName[k]), ...items.map(card)] : [];
    }),
    h('h2', null, 'Recipe book'),
    ...book.map(card),
    creator);
}

// ---------- Kitchen ----------

export function kitchenPanel(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const a = analyse(state);
  const k = a.kitchen;
  const last = state.history.at(-1);
  const bottlenecks = last?.services.filter((s) => s.bottleneck !== 'none').map((s) => `${s.service}: ${s.bottleneck}`) ?? [];
  const owned = h('div', { class: 'stack' }, ...state.equipment.map((e) => {
    const it = EQUIPMENT[e.itemId];
    if (!it) return h('div');
    return h('div', { class: 'spread card', style: 'padding:8px 12px' },
      h('div', null, h('b', null, it.name), ' ', h('span', { class: `chip family-${it.family}` }, it.family)),
      h('button', { class: 'small', onclick: () => act(ctx, { type: 'sellEquipment', uid: e.uid }, `Sold for ${money(it.price * T.kitchen.resale)}`) }, `Sell ${money(it.price * T.kitchen.resale)}`));
  }));
  const catalogue = Object.values(EQUIPMENT).map((it) => {
    const unlocked = isUnlocked(state, it.unlock);
    const fits = k.footprintUsed + it.footprint <= k.footprintMax;
    let impact: HTMLElement | null = null;
    if (unlocked && fits) {
      const hyp = structuredClone(state);
      hyp.equipment.push({ uid: -1, itemId: it.id });
      const d = compare(state, hyp);
      impact = impactLine(d, d.profit > 1 ? `pays back in about ${Math.ceil(it.price / d.profit)} days` : 'no payback at today\'s trade');
    }
    const stats: string[] = [];
    if (it.role === 'oven') {
      const perHour = ((it.slots ?? 0) * 60) / (12 * (it.bakeMult ?? 1)) * (it.family === 'volume' ? 0.9 + 0.02 * 5 : 0.7 + 0.06 * 5);
      stats.push(`${perHour.toFixed(0)} pizzas/h at skill 5`);
    }
    if (it.prepMult && it.prepMult !== 1) stats.push(`prep x${it.prepMult}`);
    if (it.effectMult) stats.push(it.role === 'pass' ? `serving x${it.effectMult}` : `dishwashing x${it.effectMult}`);
    if (it.qualityMod) stats.push(`quality ${signed(it.qualityMod)}`);
    if (it.skillNeeded) stats.push(`needs cook skill ${it.skillNeeded}`);
    stats.push(`${it.footprint} tiles · ${money(it.maintenance)}/week upkeep`);
    return h('div', { class: `card ${unlocked ? '' : 'off'}` },
      h('h3', null, h('span', null, it.name), h('span', null, money(it.price))),
      h('div', { class: 'row' }, h('span', { class: `chip family-${it.family}` }, it.family), h('span', { class: 'small muted' }, it.blurb)),
      h('div', { class: 'small' }, stats.join(' · ')),
      impact,
      h('div', { class: 'row' },
        unlocked
          ? h('button', { class: 'primary small', disabled: !fits || state.cash < it.price, onclick: () => act(ctx, { type: 'buyEquipment', itemId: it.id }, `${it.name} installed`) },
            !fits ? 'Kitchen full' : state.cash < it.price ? `Save ${money(it.price - state.cash)} more` : 'Buy and install')
          : h('span', { class: 'small muted' }, `🔒 ${unlockText(it.unlock)}`)));
  });
  return h('div', { class: 'stack' },
    h('h2', null, 'Kitchen'),
    h('div', { class: 'card' },
      h('div', { class: 'kv' },
        h('span', null, 'Oven capacity'), h('b', null, `${k.ovenPerHour.toFixed(1)} pizzas/h`),
        h('span', null, 'Prep capacity'), h('b', null, `${k.prepPerHour.toFixed(1)} dishes/h (${k.staffedCounters}/${k.counters} counters staffed)`),
        h('span', null, 'Bake time'), h('b', null, `${k.cookTime.toFixed(1)} min`),
        h('span', null, 'Kitchen skill'), h('b', null, `${k.kitchenSkillK.toFixed(1)} (avg cook skill ${k.avgSkill.toFixed(1)})`),
        h('span', null, 'Equipment quality'), h('b', null, signed(k.equipmentE, 1)),
        h('span', null, 'Space used'), h('b', null, `${k.footprintUsed} of ${k.footprintMax} tiles`)),
      h('div', { class: 'small muted' }, bottlenecks.length ? `Yesterday's limits: ${bottlenecks.join(', ')}` : 'No kitchen bottleneck yesterday.')),
    h('h3', null, 'Your equipment'), owned,
    h('h3', null, 'Catalogue'),
    h('div', { class: 'small muted' }, 'Volume gear serves more, quality gear cooks better, artisan gear is slow but superb and needs a skilled cook.'),
    ...catalogue);
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
        h('span', null, 'Seats'), h('b', null, `${r.seats} at ${r.tables} tables`),
        h('span', null, 'Ambience'), h('b', null, r.ambience.toFixed(0)),
        h('span', null, 'Decor points'), h('b', null, `${r.decorPoints} (lighting ${Math.min(10, r.lighting)}/10)`),
        h('span', null, 'Squeezed tables'), h('b', { class: r.crowdedTables ? 'warn' : '' }, String(r.crowdedTables))),
      meter(r.ambience, 100, r.ambience > 70 ? 'warm' : ''),
      h('div', { class: 'small muted' }, 'Ambience lifts satisfaction and how many guests add drinks, starters and desserts. Every table needs a free tile beside it.')),
    h('div', { class: 'row' },
      h('button', { class: tool.kind === 'none' ? 'active' : '', onclick: () => setTool({ kind: 'none' }) }, 'Select'),
      h('span', { class: 'small muted' }, tool.kind === 'place' ? 'Tap the floor to place. Tap Select when done.' : tool.kind === 'move' ? 'Tap where it should go.' : 'Tap an item on the floor to move or sell it.')),
    sel && selItem
      ? h('div', { class: 'card' },
        h('h3', null, selItem.name),
        h('div', { class: 'row' },
          h('button', { onclick: () => { floor.tool = { kind: 'move', uid: sel.uid }; floor.invalidate(); ctx.rerender(); } }, 'Move'),
          h('button', { onclick: () => { floor.selected = null; act(ctx, { type: 'removeFurniture', uid: sel.uid }, `Sold for ${money(selItem.price * T.kitchen.resale)}`); } }, `Sell for ${money(selItem.price * T.kitchen.resale)}`)))
      : null,
    h('div', { class: 'palette' }, ...Object.values(FURNITURE).map((f) => h('button', {
      class: tool.kind === 'place' && tool.itemId === f.id ? 'on' : '',
      disabled: state.cash < f.price,
      onclick: () => setTool({ kind: 'place', itemId: f.id }),
    },
    h('b', null, h('span', { class: 'swatch', style: `background:${f.color}` }), f.name),
    h('span', { class: 'small muted' }, `${money(f.price)} · ${f.w}x${f.h}`),
    h('span', { class: 'small' }, f.kind === 'table' ? `${f.seats} seats` : `+${f.decorPoints} decor${f.lighting ? `, +${f.lighting} light` : ''}`)))));
}

// ---------- Staff ----------

export function staffPanel(ctx: PanelCtx): HTMLElement {
  const { state } = ctx;
  const order: Role[] = ['chef', 'cook', 'server', 'host', 'dishwasher'];
  const team = [...state.staff].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const traitChips = (ids: string[]): HTMLElement =>
    h('div', { class: 'chips' }, ...ids.map((id) => h('span', { class: 'chip', title: TRAITS[id as keyof typeof TRAITS]?.effect }, `${TRAITS[id as keyof typeof TRAITS]?.name}: ${TRAITS[id as keyof typeof TRAITS]?.effect}`)));
  const weekly = state.staff.reduce((x, s) => x + s.salary, 0);
  return h('div', { class: 'stack' },
    h('div', { class: 'spread' }, h('h2', null, 'Team'), h('span', { class: 'small muted' }, `${state.staff.length} people · ${money(weekly)}/week`)),
    ...team.map((s) => h('div', { class: 'card' },
      h('h3', null, h('span', null, s.name), h('span', { class: 'small muted' }, `${ROLE_NAMES[s.role]}${s.fame ? ` ${'★'.repeat(s.fame)}` : ''}`)),
      h('div', { class: 'kv' },
        h('span', null, 'Skill'), h('b', null, `${s.skill} (can reach ${s.potential})`),
        h('span', null, 'Salary'), h('b', null, `${money(s.salary)}/week`),
        h('span', null, 'Morale'), h('b', { class: s.morale < 40 ? 'bad' : '' }, s.morale.toFixed(0))),
      meter(s.morale, 100, s.morale < 40 ? 'hot' : ''),
      traitChips(s.traits),
      s.leavingOnDay ? h('div', { class: 'warn small' }, `Leaving on day ${s.leavingOnDay} unless things improve.`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => act(ctx, { type: 'giveRaise', staffId: s.id }, `${s.name} is delighted`) }, `Raise 10% (+${money(s.salary * 0.1)})`),
        h('button', { class: 'small ghost', onclick: () => { if (confirm(`Let ${s.name} go with two weeks' pay (${money(s.salary * 2)})?`)) act(ctx, { type: 'fire', staffId: s.id }); } }, 'Let go')))),
    h('h2', null, 'Hiring board'),
    h('div', { class: 'small muted' }, 'New candidates arrive every Monday. The impact line runs your restaurant for a week with them on the team.'),
    ...state.candidates.map((c) => {
      const hyp = structuredClone(state);
      hyp.staff.push(c);
      const d = compare(state, hyp);
      return h('div', { class: 'card' },
        h('h3', null, h('span', null, c.name), h('span', { class: 'small muted' }, `${ROLE_NAMES[c.role]}${c.fame ? ` ${'★'.repeat(c.fame)} famous` : ''}`)),
        h('div', { class: 'kv' },
          h('span', null, 'Skill'), h('b', null, `${c.skill} (potential ${c.potential})`),
          h('span', null, 'Salary'), h('b', null, `${money(c.salary)}/week`)),
        traitChips(c.traits),
        impactLine(d),
        h('button', { class: 'primary small', onclick: () => act(ctx, { type: 'hire', candidateId: c.id }) }, 'Hire'));
    }));
}

// ---------- Money ----------

export function moneyPanel(ctx: PanelCtx, extra: HTMLElement): HTMLElement {
  const { state } = ctx;
  const a = analyse(state);
  const last = state.history.at(-1);
  const recent = state.history.slice(-14);
  const maxAbs = Math.max(1, ...recent.map((d) => Math.abs(d.pnl.profit)));
  const payment = loanPayment(state.loan);
  const district = DISTRICTS[state.districtId];
  const p = T.progression;
  const nextRank = state.rank === 'cook'
    ? `Owner: serve ${p.ownerServed} guests and reach reputation ${p.ownerRep}`
    : state.rank === 'owner' ? `Restaurateur: serve ${p.restaurateurServed} guests and reach reputation ${p.restaurateurRep}` : 'Chains arrive in v1.0';
  const pnlRows = (x: NonNullable<typeof last>['pnl']): HTMLElement[] => [
    h('span', null, 'Money in (sales)'), h('b', null, money(x.sales)),
    h('span', null, 'Ingredients'), h('b', null, money(-x.ingredients)),
    h('span', null, 'Waste'), h('b', null, money(-x.waste)),
    h('span', null, 'Staff'), h('b', null, money(-x.staff)),
    h('span', null, 'Rent'), h('b', null, money(-x.rent)),
    h('span', null, 'Utilities and upkeep'), h('b', null, money(-(x.utilities + x.upkeep))),
    h('span', null, 'Loan interest'), h('b', null, money(-x.interest)),
    h('span', { class: 'total' }, 'Profit'), h('b', { class: `total ${x.profit >= 0 ? 'good' : 'bad'}` }, money(x.profit)),
  ];
  return h('div', { class: 'stack' },
    h('h2', null, 'Money'),
    h('div', { class: 'card' },
      h('div', { class: 'spread' }, h('span', null, 'Cash'), h('span', { class: `big ${state.cash < 0 ? 'bad' : ''}` }, money(state.cash))),
      h('div', { class: 'small muted' }, `Weekly bills on Sunday night: wages ${money(a.weeklySalaries)}, rent ${money(a.weeklyRent)} (${district?.name}), loan ${money(payment)}. Upkeep ${money(a.kitchen.maintenancePerWeek)}/week is paid daily.`),
      state.cash < 0 ? h('div', { class: 'warn small' }, 'Cash is below zero. Payments continue; after 7 days the bank advisor pauses your loan payments. Pizza D never ends your game.') : null),
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
      h('h3', null, `Rank: ${RANK_NAMES[state.rank]}`),
      h('div', { class: 'kv' },
        h('span', null, 'Guests served'), h('b', null, Math.round(state.totalServed).toLocaleString()),
        h('span', null, 'Reputation'), h('b', null, state.rep.toFixed(1))),
      h('div', { class: 'small muted' }, `Next: ${nextRank}`)),
    extra);
}
