// Floor view (ADR-003): Canvas2D, renders only when something changed or the day is playing back.
// Owns no game rules: placement validity comes from the simulation via dispatch.

import { PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { occupiedTiles } from '../sim/analysis';
import { Rng } from '../sim/rng';
import type { DayReport, GameState } from '../sim/state';

export type Tool = { kind: 'none' } | { kind: 'place'; itemId: string } | { kind: 'move'; uid: number };

const SEG_COLORS: Record<SegmentId, string> = {
  students: '#e07a5f', families: '#3d85c6', professionals: '#6d6875',
  foodies: '#c9a227', seniors: '#81b29a', tourists: '#b56576',
};

interface Party {
  arrive: number;
  seat: number;
  leave: number;
  size: number;
  segment: SegmentId;
  tableUid: number | null;
  happy: boolean;
}

const DAY_START = 11 * 60;
const DAY_END = 23 * 60;

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#999';
}

/** Build a visual stream of parties that is consistent with the day report (never feeds back into the economy). */
export function partiesFor(state: GameState, report: DayReport): Party[] {
  const rng = Rng.stream(state.seed, report.day, 'playback');
  const tables = state.furniture
    .filter((f) => FURNITURE[f.itemId]?.kind === 'table')
    .map((f) => ({ uid: f.uid, seats: FURNITURE[f.itemId]?.seats ?? 2, freeAt: 0 }))
    .sort((a, b) => a.seats - b.seats);
  const out: Party[] = [];
  for (const sv of report.services) {
    const [start, end] = sv.service === 'lunch' ? [11.5 * 60, 14.5 * 60] : [18 * 60, 22.5 * 60];
    const pending: Party[] = [];
    const servedShare = sv.demand > 0 ? sv.served / sv.demand : 0;
    for (const seg of report.segments) {
      const segDemandShare = report.segments.reduce((a, s) => a + s.demand, 0);
      const demandHere = segDemandShare > 0 ? (seg.demand / segDemandShare) * sv.demand : 0;
      const size = SEGMENTS[seg.segment].partySize;
      const partiesTotal = Math.round(demandHere / size);
      for (let i = 0; i < partiesTotal; i++) {
        // Triangular arrivals peaking a third into the window.
        const u = (rng.next() + rng.next()) / 2;
        const arrive = start + Math.pow(u, 1.3) * (end - start - 30);
        const n = Math.max(1, Math.min(6, Math.round(size + rng.normal() * 0.8)));
        const walks = !rng.chance(servedShare);
        pending.push({ arrive, seat: arrive, leave: arrive + 10, size: n, segment: seg.segment, tableUid: null, happy: seg.satisfaction >= 70 || (seg.satisfaction >= 55 && rng.chance(0.5)) });
        if (walks) (pending.at(-1) as Party).tableUid = -1;
      }
    }
    pending.sort((a, b) => a.arrive - b.arrive);
    for (const p of pending) {
      if (p.tableUid === -1) {
        p.tableUid = null;
        out.push(p);
        continue;
      }
      const t = tables.filter((x) => x.seats >= p.size).sort((a, b) => a.freeAt - b.freeAt || a.seats - b.seats)[0]
        ?? [...tables].sort((a, b) => b.seats - a.seats)[0];
      if (!t) continue;
      p.size = Math.min(p.size, t.seats);
      p.seat = Math.max(p.arrive, t.freeAt);
      const meal = SEGMENTS[p.segment].mealLength[sv.service];
      p.leave = p.seat + sv.tableCycle - meal + meal * (0.9 + 0.2 * rng.next());
      t.freeAt = p.leave + 2;
      p.tableUid = t.uid;
      out.push(p);
    }
  }
  return out;
}

export class Floor {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  private state: GameState | null = null;
  tool: Tool = { kind: 'none' };
  selected: number | null = null;
  private hover: { x: number; y: number } | null = null;
  private tile = 32;
  private ox = 0;
  private oy = 0;
  private dirty = true;
  private raf = 0;
  private parties: Party[] = [];
  clock = DAY_START;
  playing = false;
  speed = 20; // game minutes per real second
  private lastTs = 0;
  onTap: (x: number, y: number, uid: number | null) => void = () => {};
  onClock: (minutes: number, done: boolean) => void = () => {};

  constructor() {
    new ResizeObserver(() => this.invalidate()).observe(this.canvas);
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.tool.kind === 'none') return;
      this.hover = this.tileAt(e);
      this.invalidate();
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.invalidate();
    });
    this.canvas.addEventListener('pointerup', (e) => {
      const t = this.tileAt(e);
      if (!t) return;
      this.hover = t;
      this.onTap(t.x, t.y, this.uidAt(t.x, t.y));
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.invalidate());
  }

  setState(state: GameState): void {
    this.state = state;
    this.invalidate();
  }

  invalidate(): void {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame((ts) => this.frame(ts));
  }

  play(state: GameState, report: DayReport): void {
    this.state = state;
    this.parties = partiesFor(state, report);
    this.clock = DAY_START;
    this.playing = true;
    this.lastTs = 0;
    this.invalidate();
  }

  skip(): void {
    this.clock = DAY_END;
  }

  private frame(ts: number): void {
    this.raf = 0;
    if (this.playing) {
      if (this.lastTs && document.visibilityState === 'visible') {
        const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
        // Quiet hours between services run faster.
        const quiet = this.clock > 14.6 * 60 && this.clock < 17.9 * 60;
        this.clock += dt * this.speed * (quiet ? 6 : 1);
      }
      this.lastTs = ts;
      const done = this.clock >= DAY_END;
      if (done) {
        this.playing = false;
        this.parties = [];
      }
      this.onClock(Math.min(this.clock, DAY_END), done);
      this.dirty = true;
    }
    if (this.dirty) this.draw();
    if (this.playing) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private dims(): { W: number; H: number } {
    const p = this.state ? PREMISES[this.state.premisesId] : undefined;
    return { W: p?.diningWidth ?? 10, H: p?.diningHeight ?? 8 };
  }

  private tileAt(e: PointerEvent): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left - this.ox) / this.tile);
    const y = Math.floor((e.clientY - r.top - this.oy) / this.tile);
    const { W, H } = this.dims();
    return x >= 0 && y >= 0 && x < W && y < H ? { x, y } : null;
  }

  private uidAt(x: number, y: number): number | null {
    if (!this.state) return null;
    for (const f of this.state.furniture) {
      const item = FURNITURE[f.itemId];
      if (item && x >= f.x && y >= f.y && x < f.x + item.w && y < f.y + item.h) return f.uid;
    }
    return null;
  }

  private draw(): void {
    this.dirty = false;
    const s = this.state;
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    if (!s) return;
    const { W, H } = this.dims();
    const kitchenRows = 2.4;
    const pad = 16;
    this.tile = Math.floor(Math.min((cw - pad * 2) / W, (ch - pad * 2) / (H + kitchenRows + 1)));
    const t = this.tile;
    this.ox = Math.round((cw - W * t) / 2);
    this.oy = Math.round(pad + kitchenRows * t + (ch - pad * 2 - (H + kitchenRows + 1) * t) / 2);

    // Kitchen strip.
    const ky = this.oy - kitchenRows * t;
    g.fillStyle = css('--kitchen');
    roundRect(g, this.ox, ky, W * t, kitchenRows * t - 6, 10);
    g.fill();
    const items = s.equipment.map((e) => EQUIPMENT[e.itemId]).filter((e) => !!e);
    const totalFoot = items.reduce((a, i) => a + i.footprint, 0) || 1;
    let kx = this.ox + 8;
    const kw = W * t - 16;
    g.font = `600 ${Math.max(9, Math.min(12, t * 0.34))}px ${css('--sans') || 'system-ui'}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const it of items) {
      const w = (it.footprint / totalFoot) * kw - 4;
      const color = it.role === 'oven' ? (it.family === 'artisan' ? '#9c4a2a' : it.family === 'quality' ? '#7a5a44' : it.family === 'volume' ? '#5f6f86' : '#6f6a64') : '#a39d95';
      g.fillStyle = color;
      roundRect(g, kx, ky + 8, Math.max(8, w), kitchenRows * t - 22, 6);
      g.fill();
      if (it.role === 'oven' && this.playing && this.inService()) {
        g.fillStyle = 'rgba(255,170,60,0.55)';
        roundRect(g, kx + 4, ky + kitchenRows * t - 26, Math.max(4, w - 8), 6, 3);
        g.fill();
      }
      if (w > 28) {
        g.fillStyle = '#fff';
        g.fillText(shortName(it.name), kx + w / 2, ky + (kitchenRows * t - 14) / 2 + 4, w - 4);
      }
      kx += w + 4;
    }

    // Dining floor with a soft checker.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (x + y) % 2 ? css('--floor') : css('--floor-2');
      g.fillRect(this.ox + x * t, this.oy + y * t, t, t);
    }
    // Entrance.
    g.fillStyle = css('--accent');
    g.fillRect(this.ox + (W / 2 - 1) * t, this.oy + H * t, 2 * t, 5);

    // Furniture.
    for (const f of s.furniture) {
      const item = FURNITURE[f.itemId];
      if (!item) continue;
      const moving = this.tool.kind === 'move' && this.tool.uid === f.uid;
      g.globalAlpha = moving ? 0.35 : 1;
      drawItem(g, item.id, item.color, item.kind, this.ox + f.x * t, this.oy + f.y * t, item.w * t, item.h * t, t);
      if (item.kind === 'table') drawChairs(g, this.ox + f.x * t, this.oy + f.y * t, item.w * t, item.h * t, item.seats, t);
      g.globalAlpha = 1;
      if (this.selected === f.uid) {
        g.strokeStyle = css('--accent');
        g.lineWidth = 3;
        roundRect(g, this.ox + f.x * t + 1, this.oy + f.y * t + 1, item.w * t - 2, item.h * t - 2, 8);
        g.stroke();
      }
    }

    // Guests during playback.
    if (this.playing) this.drawGuests(g, s);

    // Placement ghost.
    const ghostId = this.tool.kind === 'place' ? this.tool.itemId : this.tool.kind === 'move' ? s.furniture.find((f) => this.tool.kind === 'move' && f.uid === this.tool.uid)?.itemId : undefined;
    if (ghostId && this.hover) {
      const item = FURNITURE[ghostId];
      if (item) {
        const occ = occupiedTiles(s.furniture, this.tool.kind === 'move' ? this.tool.uid : undefined);
        let ok = this.hover.x + item.w <= W && this.hover.y + item.h <= H;
        for (let dx = 0; dx < item.w && ok; dx++) for (let dy = 0; dy < item.h && ok; dy++) if (occ.has(`${this.hover.x + dx},${this.hover.y + dy}`)) ok = false;
        g.globalAlpha = 0.55;
        drawItem(g, item.id, item.color, item.kind, this.ox + this.hover.x * t, this.oy + this.hover.y * t, item.w * t, item.h * t, t);
        g.globalAlpha = 1;
        g.strokeStyle = ok ? css('--good') : css('--bad');
        g.lineWidth = 3;
        roundRect(g, this.ox + this.hover.x * t + 1, this.oy + this.hover.y * t + 1, item.w * t - 2, item.h * t - 2, 8);
        g.stroke();
      }
    }
  }

  private inService(): boolean {
    return (this.clock >= 11.5 * 60 && this.clock <= 15 * 60) || (this.clock >= 18 * 60 && this.clock <= 23 * 60);
  }

  private drawGuests(g: CanvasRenderingContext2D, s: GameState): void {
    const t = this.tile;
    const { W, H } = this.dims();
    const doorX = this.ox + (W / 2) * t;
    const doorY = this.oy + H * t - t * 0.4;
    let queue = 0;
    const r = Math.max(3, t * 0.16);
    for (const p of this.parties) {
      const c = this.clock;
      if (c < p.arrive || c > p.leave + 4) continue;
      g.fillStyle = SEG_COLORS[p.segment];
      if (p.tableUid === null) {
        // Walked away: fade out at the door.
        if (c > p.arrive + 6) continue;
        g.globalAlpha = 1 - (c - p.arrive) / 6;
        for (let i = 0; i < p.size; i++) dot(g, doorX + (i - p.size / 2) * r * 2.2, doorY + t * 0.6, r);
        g.globalAlpha = 1;
        continue;
      }
      if (c < p.seat) {
        for (let i = 0; i < p.size; i++) dot(g, doorX - t + (queue % 6) * r * 2.4, doorY - Math.floor(queue / 6) * r * 2.4, r);
        queue += p.size;
        continue;
      }
      const f = s.furniture.find((x) => x.uid === p.tableUid);
      const item = f ? FURNITURE[f.itemId] : undefined;
      if (!f || !item) continue;
      const cx = this.ox + (f.x + item.w / 2) * t;
      const cy = this.oy + (f.y + item.h / 2) * t;
      if (c > p.leave) {
        if (p.happy) {
          g.fillStyle = '#e25b6a';
          g.font = `${Math.round(t * 0.5)}px system-ui`;
          g.fillText('♥', cx, cy - t * 0.3 - (c - p.leave) * 3);
        }
        continue;
      }
      const seats = seatPositions(item.w * t, item.h * t, item.seats, t);
      for (let i = 0; i < p.size; i++) {
        const sp = seats[i];
        if (sp) dot(g, this.ox + f.x * t + sp[0], this.oy + f.y * t + sp[1], r);
      }
      if (c - p.seat > 4 && c < p.leave - 6) {
        g.fillStyle = '#f2c65b';
        dot(g, cx, cy, Math.max(3, t * 0.14));
      }
    }
  }
}

function shortName(name: string): string {
  return name.replace(' Oven', '').replace('Prep Counter', 'Prep').replace('Heat Lamp Pass', 'Pass').replace('Dish Machine', 'Dishes').replace('Proving Cabinet', 'Proving');
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function seatPositions(w: number, h: number, seats: number, t: number): [number, number][] {
  const out: [number, number][] = [];
  const inset = t * 0.12;
  const perSide = Math.ceil(seats / 2);
  const horizontal = w >= h;
  for (let i = 0; i < seats; i++) {
    const side = i % 2;
    const k = Math.floor(i / 2);
    if (horizontal) out.push([((k + 0.5) / perSide) * w, side ? h - inset : inset]);
    else out.push([side ? w - inset : inset, ((k + 0.5) / perSide) * h]);
  }
  return out;
}

function drawChairs(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seats: number, t: number): void {
  g.fillStyle = 'rgba(80,50,30,0.25)';
  for (const [sx, sy] of seatPositions(w, h, seats, t)) {
    roundRect(g, x + sx - t * 0.13, y + sy - t * 0.13, t * 0.26, t * 0.26, 4);
    g.fill();
  }
}

function drawItem(g: CanvasRenderingContext2D, id: string, color: string, kind: string, x: number, y: number, w: number, h: number, t: number): void {
  if (kind === 'table') {
    const m = t * 0.22;
    g.fillStyle = color;
    roundRect(g, x + m, y + m, w - 2 * m, h - 2 * m, 6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(g, x + m + 2, y + m + 2, w - 2 * m - 4, (h - 2 * m) * 0.35, 4);
    g.fill();
    return;
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  g.fillStyle = color;
  if (id === 'plant') {
    g.fillStyle = '#9a6b4a';
    roundRect(g, cx - t * 0.18, cy + t * 0.05, t * 0.36, t * 0.3, 4);
    g.fill();
    g.fillStyle = color;
    dot(g, cx, cy - t * 0.05, t * 0.3);
  } else if (id === 'lamp' || id === 'lanterns') {
    const glow = g.createRadialGradient(cx, cy, 1, cx, cy, t * 0.9);
    glow.addColorStop(0, 'rgba(255,210,120,0.55)');
    glow.addColorStop(1, 'rgba(255,210,120,0)');
    g.fillStyle = glow;
    g.fillRect(cx - t, cy - t, 2 * t, 2 * t);
    g.fillStyle = color;
    dot(g, cx, cy, t * 0.2);
  } else if (id === 'fountain') {
    g.fillStyle = '#b8b2a8';
    dot(g, cx, cy, Math.min(w, h) * 0.42);
    g.fillStyle = color;
    dot(g, cx, cy, Math.min(w, h) * 0.32);
  } else {
    roundRect(g, x + t * 0.12, y + t * 0.12, w - t * 0.24, h - t * 0.24, 5);
    g.fill();
  }
}
