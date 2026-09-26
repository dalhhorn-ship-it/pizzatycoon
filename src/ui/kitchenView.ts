// Kitchen floor plan view (01-product/kitchen-builder.md 7, 8). Canvas2D, renders on change.
// Placement validity comes from the sim (layoutProblem); this view only draws and reports gestures.

import { ADDONS } from '../data/addons';
import { EQUIPMENT } from '../data/equipment';
import type { EquipmentItem } from '../data/types';
import { T } from '../data/tunables';
import { analyse } from '../sim/analysis';
import { distance, kitchenDims, layoutProblem, passRect, type Rect, rectOf } from '../sim/kitchen';
import type { GameState, OwnedEquipment } from '../sim/state';
import { drawEquipment, drawFloorTile, drawStaff, drawWall } from './sprites';

export type KitchenSelection = { kind: 'none' } | { kind: 'tile'; x: number; y: number } | { kind: 'station'; uid: number };

interface Drag {
  uid: number;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  x: number;
  y: number;
  rot: 0 | 1;
  moved: boolean;
}

const FAMILY_COLORS: Record<string, string> = {
  basic: '#8a8178', volume: '#5f7390', quality: '#7d6147', artisan: '#a2502c', hybrid: '#76548a',
};

function css(name: string, fallback = '#999'): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export class KitchenView {
  readonly canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  private state: GameState | null = null;
  selection: KitchenSelection = { kind: 'none' };
  private drag: Drag | null = null;
  private tile = 48;
  private ox = 0;
  private oy = 0;
  private raf = 0;
  /** Supplied by the app: whether a service is playing, to animate ovens and cooks. */
  isServing: () => boolean = () => false;
  onSelect: (sel: KitchenSelection) => void = () => {};
  onMove: (uid: number, x: number, y: number, rot: 0 | 1) => void = () => {};
  /** Optional sprite hook: return true when it drew the item itself. */
  drawSprite: ((g: CanvasRenderingContext2D, itemId: string, x: number, y: number, w: number, h: number, tile: number, active: boolean) => boolean) | null =
    (g, itemId, x, y, w, h, tile, active) => {
      const alias: Record<string, string> = { usedDeckOven: 'deckOven', oldWorkbench: 'prepCounter', doughFridge: 'fridge' };
      drawEquipment(g, alias[itemId] ?? itemId, x, y, w, h, tile, active, performance.now() / 1000);
      return true;
    };

  constructor() {
    this.canvas.style.touchAction = 'none';
    new ResizeObserver(() => this.invalidate()).observe(this.canvas);
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', () => {
      this.drag = null;
      this.invalidate();
    });
  }

  setState(state: GameState): void {
    this.state = state;
    if (this.selection.kind === 'station') {
      const uid = this.selection.uid;
      if (!state.equipment.some((e) => e.uid === uid)) this.selection = { kind: 'none' };
    }
    this.invalidate();
  }

  select(sel: KitchenSelection): void {
    this.selection = sel;
    this.invalidate();
  }

  invalidate(): void {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
  }

  private frame(): void {
    this.raf = 0;
    this.draw();
    if (this.isServing() && this.canvas.isConnected) this.raf = requestAnimationFrame(() => this.frame());
  }

  // ---------- Input ----------

  private tileAt(e: PointerEvent): { x: number; y: number; fx: number; fy: number } {
    const r = this.canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left - this.ox) / this.tile;
    const fy = (e.clientY - r.top - this.oy) / this.tile;
    return { x: Math.floor(fx), y: Math.floor(fy), fx, fy };
  }

  private stationAt(x: number, y: number): OwnedEquipment | undefined {
    return this.state?.equipment.find((e) => {
      const r = rectOf(e);
      return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
    });
  }

  private down(e: PointerEvent): void {
    if (!this.state) return;
    const t = this.tileAt(e);
    const st = this.stationAt(t.x, t.y);
    if (!st) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { uid: st.uid, startX: e.clientX, startY: e.clientY, offX: t.x - st.x, offY: t.y - st.y, x: st.x, y: st.y, rot: st.rot, moved: false };
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
    d.moved = true;
    const t = this.tileAt(e);
    d.x = t.x - d.offX;
    d.y = t.y - d.offY;
    this.invalidate();
  }

  private up(e: PointerEvent): void {
    if (!this.state) return;
    const d = this.drag;
    this.drag = null;
    if (d?.moved) {
      const st = this.state.equipment.find((x) => x.uid === d.uid);
      if (st && (st.x !== d.x || st.y !== d.y)) this.onMove(d.uid, d.x, d.y, d.rot);
      this.selection = { kind: 'station', uid: d.uid };
      this.onSelect(this.selection);
      this.invalidate();
      return;
    }
    const t = this.tileAt(e);
    const dims = kitchenDims(this.state.premisesId);
    if (t.x < 0 || t.y < 0 || t.x >= dims.W || t.y >= dims.H) {
      this.selection = { kind: 'none' };
    } else {
      const st = this.stationAt(t.x, t.y);
      this.selection = st ? { kind: 'station', uid: st.uid } : { kind: 'tile', x: t.x, y: t.y };
    }
    this.onSelect(this.selection);
    this.invalidate();
  }

  // ---------- Drawing ----------

  private draw(): void {
    const s = this.state;
    const g = this.g;
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch || !s) return;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    const d = kitchenDims(s.premisesId);
    const wall = 0.7; // wall thickness in tiles
    const dining = 1.1; // strip of dining room drawn above the pass
    this.tile = Math.floor(Math.min((cw - 32) / (d.W + wall * 2), (ch - 24) / (d.H + wall * 2 + dining)));
    const t = this.tile;
    this.ox = Math.round((cw - d.W * t) / 2);
    this.oy = Math.round((ch - (d.H + wall * 2 + dining) * t) / 2 + (dining + wall) * t);
    const X = (x: number): number => this.ox + x * t;
    const Y = (y: number): number => this.oy + y * t;

    // Dining room edge above the pass.
    g.fillStyle = css('--floor', '#ead9bf');
    g.fillRect(X(-wall), Y(-wall - dining), (d.W + wall * 2) * t, dining * t);
    g.fillStyle = css('--muted', '#7d6b60');
    g.font = `600 ${Math.max(11, t * 0.28)}px system-ui`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('Dining room', X(-wall) + 8, Y(-wall - dining / 2));

    // Walls: brick towards the dining room, white tile around the kitchen.
    drawWall(g, X(-wall), Y(-wall), (d.W + wall * 2) * t, wall * t, 'brick');
    drawWall(g, X(-wall), Y(d.H), (d.W + wall * 2) * t, wall * t, 'tile');
    drawWall(g, X(-wall), Y(0), wall * t, d.H * t, 'tile');
    drawWall(g, X(d.W), Y(0), wall * t, d.H * t, 'tile');

    // Floor tiles.
    for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) drawFloorTile(g, X(x), Y(y), t, 'kitchen', x, y);

    // Pass hatch: an opening in the wall with a wooden shelf and a bell.
    const pr = passRect(d);
    g.fillStyle = '#9c6b3f';
    g.fillRect(X(pr.x), Y(-wall), pr.w * t, wall * t);
    g.fillStyle = '#c28a55';
    g.fillRect(X(pr.x) + 3, Y(-wall) + 3, pr.w * t - 6, wall * t - 6);
    g.fillStyle = '#e8c35a';
    g.beginPath();
    g.arc(X(pr.x + pr.w) - t * 0.3, Y(-wall / 2), t * 0.12, Math.PI, 0);
    g.fill();
    g.fillStyle = 'rgba(200,85,61,0.12)';
    g.fillRect(X(pr.x), Y(0), pr.w * t, t);
    g.fillStyle = css('--accent', '#c8553d');
    g.font = `700 ${Math.max(10, t * 0.24)}px system-ui`;
    g.textAlign = 'center';
    g.fillText('PASS', X(pr.x + 1), Y(0.5));

    // Back door.
    g.fillStyle = '#6d4b33';
    g.fillRect(X(d.W - 1) + t * 0.15, Y(d.H), t * 0.7, wall * t);

    // Flow lines when a station is selected or dragged.
    const a = analyse(s);
    const selUid = this.drag?.moved ? this.drag.uid : this.selection.kind === 'station' ? this.selection.uid : null;
    const layout = s.equipment.map((e) => (this.drag?.moved && e.uid === this.drag.uid ? { ...e, x: this.drag.x, y: this.drag.y, rot: this.drag.rot } : e));
    if (selUid !== null) this.drawFlow(layout, pr, a);

    // Stations.
    const serving = this.isServing();
    const now = performance.now() / 1000;
    // The dragged station draws last so it floats above the others.
    const ordered = [...layout].sort((p, q) => Number(this.drag?.moved && p.uid === this.drag.uid) - Number(this.drag?.moved && q.uid === this.drag.uid));
    for (const e of ordered) {
      const it = EQUIPMENT[e.itemId];
      if (!it) continue;
      const r = rectOf(e);
      const ghost = this.drag?.moved && e.uid === this.drag.uid;
      g.globalAlpha = ghost ? 0.75 : 1;
      this.drawStation(it, r, serving, now, e.uid, a);
      g.globalAlpha = 1;
      if (ghost) {
        const problem = layoutProblem(layout, d);
        g.strokeStyle = problem ? '#d9822b' : '#3f7a45';
        g.lineWidth = 3;
        g.setLineDash([6, 4]);
        g.strokeRect(X(r.x) + 2, Y(r.y) + 2, r.w * t - 4, r.h * t - 4);
        g.setLineDash([]);
        if (problem) {
          g.fillStyle = '#d9822b';
          g.font = `700 ${Math.max(11, t * 0.24)}px system-ui`;
          g.textAlign = 'center';
          g.fillText(problem, X(r.x + r.w / 2), Y(r.y) - 10);
        }
      } else if (selUid === e.uid) {
        g.strokeStyle = css('--accent', '#c8553d');
        g.lineWidth = 3;
        g.strokeRect(X(r.x) + 1.5, Y(r.y) + 1.5, r.w * t - 3, r.h * t - 3);
      }
    }

    // Selected empty tile.
    if (this.selection.kind === 'tile') {
      const { x, y } = this.selection;
      g.strokeStyle = css('--accent', '#c8553d');
      g.lineWidth = 3;
      g.setLineDash([5, 4]);
      g.strokeRect(X(x) + 2, Y(y) + 2, t - 4, t - 4);
      g.setLineDash([]);
      g.fillStyle = css('--accent', '#c8553d');
      g.font = `700 ${Math.round(t * 0.5)}px system-ui`;
      g.textAlign = 'center';
      g.fillText('+', X(x + 0.5), Y(y + 0.52));
    }

    // Cooks at their stations (they bob while service runs); the dishwasher by the sink.
    {
      const cooks = s.staff.filter((x) => x.role === 'cook' || x.role === 'chef');
      const stations = s.equipment.filter((e) => (a.kitchen.stationPrep[e.uid] ?? 0) > 0);
      cooks.forEach((c, i) => {
        const st = stations[i % Math.max(1, stations.length)];
        if (!st) return;
        const r = rectOf(st);
        const bob = serving ? Math.sin(now * 4 + i) * t * 0.04 : 0;
        const cx = X(r.x + r.w / 2) + (i - 0.5) * t * 0.25;
        const cy = r.y + r.h < d.H ? Y(r.y + r.h) + t * 0.3 : Y(r.y) - t * 0.3;
        drawStaff(g, c.role === 'chef' ? 'chef' : 'cook', cx, cy + bob, t * 0.8, now, { variant: i });
      });
    }
  }

  private drawStation(it: EquipmentItem, r: Rect, serving: boolean, now: number, uid: number, a: ReturnType<typeof analyse>): void {
    const g = this.g;
    const t = this.tile;
    const x = this.ox + r.x * t;
    const y = this.oy + r.y * t;
    const w = r.w * t;
    const h = r.h * t;
    const active = serving && it.role === 'oven';
    if (!this.drawSprite?.(g, it.id, x, y, w, h, t, active)) {
      const pad = Math.max(3, t * 0.08);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      rr(g, x + pad + 2, y + pad + 3, w - pad * 2, h - pad * 2, 7);
      g.fill();
      g.fillStyle = FAMILY_COLORS[it.family] ?? '#8a8178';
      if (it.id === 'marbleBench' || it.id === 'prepFridge') g.fillStyle = '#9aa3ab';
      if (it.id === 'sink') g.fillStyle = '#9fb6c3';
      if (it.id === 'doughFridge') g.fillStyle = '#b9c9d6';
      rr(g, x + pad, y + pad, w - pad * 2, h - pad * 2, 7);
      g.fill();
      if (it.id === 'marbleBench' || it.id === 'prepFridge') {
        // Marble top with veins.
        g.fillStyle = '#f1efe9';
        rr(g, x + pad * 1.8, y + pad * 1.8, w - pad * 3.6, (h - pad * 3.6) * (it.id === 'prepFridge' ? 0.6 : 1), 4);
        g.fill();
        g.strokeStyle = 'rgba(120,120,130,0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + w * 0.2, y + h * 0.25);
        g.quadraticCurveTo(x + w * 0.45, y + h * 0.5, x + w * 0.7, y + h * 0.3);
        g.stroke();
      }
      if (it.role === 'oven') {
        // Oven mouth: glows during service.
        const mouthW = w * 0.55;
        const mouthH = Math.min(h * 0.35, t * 0.5);
        const mx = x + (w - mouthW) / 2;
        const my = y + h - pad - mouthH - t * 0.12;
        const flicker = active ? 0.65 + 0.35 * Math.sin(now * 9 + r.x) : 0;
        g.fillStyle = active ? `rgba(255,${140 + Math.round(60 * flicker)},40,${0.7 + 0.3 * flicker})` : '#3b302a';
        rr(g, mx, my, mouthW, mouthH, mouthH / 2);
        g.fill();
        if (it.id === 'woodFiredOven') {
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.beginPath();
          g.arc(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.3, Math.PI, 0);
          g.fill();
        }
      }
      if (it.role === 'sink') {
        g.fillStyle = '#6f8b99';
        rr(g, x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5, 4);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.font = `700 ${Math.max(10, Math.min(14, t * 0.26))}px system-ui`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const labelY = it.role === 'oven' ? y + h * 0.3 : y + h / 2 + (it.id === 'prepFridge' ? h * 0.22 : 0);
      g.fillText(it.short, x + w / 2, labelY, w - 6);
    }
    this.drawBadges(it, r, uid, a);
    this.drawAddonDots(r, uid);
  }

  /** One dot per installed add-on (kitchen-upgrades.md 6): gold quality, orange speed, blue cold and waste, teal wash and serve. */
  private drawAddonDots(r: Rect, uid: number): void {
    const e = this.state?.equipment.find((x) => x.uid === uid);
    if (!e?.addons?.length) return;
    const g = this.g;
    const t = this.tile;
    const size = Math.max(8, t * 0.18);
    e.addons.forEach((inst, i) => {
      const a = ADDONS[inst.id];
      if (!a) return;
      const color = a.qualityAdd ? '#e0b43a' : a.bakeMult || a.prepMult || a.slotsAdd ? '#e0782f' : a.wasteMult || a.coldReach ? '#4a86b5' : '#2f9a8f';
      const cx = this.ox + r.x * t + size * (0.9 + i * 1.3);
      const cy = this.oy + (r.y + r.h) * t - size * 0.9;
      g.fillStyle = '#1d1512';
      g.beginPath();
      g.arc(cx, cy, size / 2 + 1.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, size / 2, 0, Math.PI * 2);
      g.fill();
    });
  }

  private drawBadges(it: EquipmentItem, r: Rect, uid: number, a: ReturnType<typeof analyse>): void {
    const g = this.g;
    const t = this.tile;
    const badges: [string, string][] = [];
    const st = a.kitchen.flow.stations[uid];
    if (st) {
      if (st.reachMult < 1) badges.push([`-${Math.round((1 - st.reachMult) * 100)}% walk`, '#d9822b']);
      if (st.coldMult > 1 || it.cold) badges.push(['❄', '#4a86b5']);
      if (st.sheeter) badges.push(['+sheeter', '#5f7390']);
      if ((a.kitchen.stationPrep[uid] ?? 0) === 0) badges.push(['no cook', '#a8342a']);
    }
    if (it.role === 'oven') {
      const dPass = a.kitchen.flow.ovenDPass[uid] ?? 0;
      if (dPass > T.kitchenFlow.passFreeTiles) badges.push([`${dPass} to pass`, '#d9822b']);
    }
    if (it.role === 'sheeter' && a.kitchen.flow.unattachedSheeters.includes(uid)) badges.push(['not attached', '#a8342a']);
    if ((it.role === 'sink' || it.role === 'dishMachine') && a.kitchen.flow.washMult < 1) badges.push([`-${Math.round((1 - a.kitchen.flow.washMult) * 100)}% wash`, '#d9822b']);
    if (!badges.length && (st || it.role === 'oven')) badges.push(['✓', '#3f7a45']);
    let bx = this.ox + (r.x + r.w) * t - 4;
    const by = this.oy + r.y * t + 4;
    g.font = `700 ${Math.max(10, t * 0.2)}px system-ui`;
    g.textBaseline = 'middle';
    for (const [text, color] of badges) {
      const w = g.measureText(text).width + 10;
      bx -= w;
      g.fillStyle = color;
      rr(g, bx, by, w, Math.max(16, t * 0.3), 8);
      g.fill();
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.fillText(text, bx + w / 2, by + Math.max(16, t * 0.3) / 2 + 0.5);
      bx -= 3;
    }
  }

  private drawFlow(layout: OwnedEquipment[], pass: Rect, a: ReturnType<typeof analyse>): void {
    const g = this.g;
    const t = this.tile;
    const center = (r: Rect): [number, number] => [this.ox + (r.x + r.w / 2) * t, this.oy + (r.y + r.h / 2) * t];
    const ovens = layout.filter((e) => EQUIPMENT[e.itemId]?.role === 'oven');
    const line = (from: Rect, to: Rect, free: number): void => {
      const dd = distance(from, to);
      const [x1, y1] = center(from);
      const [x2, y2] = center(to);
      const ok = dd <= free;
      g.strokeStyle = ok ? 'rgba(63,122,69,0.9)' : 'rgba(217,130,43,0.95)';
      g.lineWidth = 3;
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.setLineDash([]);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      g.fillStyle = ok ? '#3f7a45' : '#d9822b';
      g.beginPath();
      g.arc(mx, my, Math.max(10, t * 0.2), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `700 ${Math.max(10, t * 0.22)}px system-ui`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(dd), mx, my + 0.5);
    };
    for (const e of layout) {
      if (EQUIPMENT[e.itemId]?.role !== 'counter' || !ovens.length) continue;
      const r = rectOf(e);
      const nearest = ovens.reduce((best, o) => (distance(r, rectOf(o)) < distance(r, rectOf(best)) ? o : best));
      line(r, rectOf(nearest), T.kitchenFlow.prepFreeTiles);
    }
    for (const o of ovens) line(rectOf(o), pass, T.kitchenFlow.passFreeTiles);
    void a;
  }
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}
