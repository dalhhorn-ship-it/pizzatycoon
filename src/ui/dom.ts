import type { Command } from '../sim/game';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny DOM builder: h('div', { class: 'x', onclick: fn }, child, ...). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export const money = (n: number, cents = false): string => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  return `${sign}$${v.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
};

export const signed = (n: number, digits = 0, suffix = ''): string => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`;

export const stars = (rep: number): string => {
  const s = Math.round(rep / 10) / 2;
  return '★'.repeat(Math.floor(s)) + (s % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(s));
};

export function meter(value: number, max = 100, cls = ''): HTMLElement {
  return h('div', { class: `meter ${cls}` }, h('div', { class: 'fill', style: `width:${Math.max(0, Math.min(100, (value / max) * 100))}%` }));
}

let toastHost: HTMLElement | null = null;
export function toast(text: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = h('div', { class: `toast ${kind}` }, text);
  toastHost.append(t);
  setTimeout(() => t.classList.add('out'), 3800);
  setTimeout(() => t.remove(), 4300);
}

export function modal(content: HTMLElement, opts: { onClose?: () => void; wide?: boolean } = {}): () => void {
  const close = (): void => {
    back.remove();
    opts.onClose?.();
  };
  const back = h('div', { class: 'modal-back', onclick: (e: Event) => e.target === back && opts.onClose && close() },
    h('div', { class: `modal ${opts.wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content));
  document.body.append(back);
  return close;
}

/** A share as a whole percent: 0.42 is "42%". */
export const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** Money with its sign: "+$120" or "-$45". */
export const signedMoney = (x: number): string => `${x >= 0 ? '+' : ''}${money(x)}`;

/** Run a command; show its error, or the success note. True when it went through. */
export function act(ctx: { dispatch: (cmd: Command) => string | null }, cmd: Command, ok?: string): boolean {
  const err = ctx.dispatch(cmd);
  if (err) toast(err, 'warn');
  else if (ok) toast(ok, 'good');
  return !err;
}
