// Floor view (ADR-003): Canvas2D, renders only when something changed or the day is playing back.
// Owns no game rules: placement validity comes from the simulation via dispatch.

import { PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { occupiedTiles } from '../sim/analysis';
import { Rng } from '../sim/rng';
import { drawDoormat, drawFloorTile, drawFurniture, drawGuest, drawPizza, drawWall, seatSpots } from './sprites';
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
    const wallRows = 1.2;
    const pad = 16;
    this.tile = Math.floor(Math.min((cw - pad * 2) / W, (ch - pad * 2) / (H + wallRows + 1)));
    const t = this.tile;
    this.ox = Math.round((cw - W * t) / 2);
    this.oy = Math.round(pad + wallRows * t + (ch - pad * 2 - (H + wallRows + 1) * t) / 2);
    const secs = performance.now() / 1000;

    // Back wall with the kitchen hatch.
    drawWall(g, this.ox, this.oy - wallRows * t, W * t, wallRows * t, 'brick');
    const hatchW = Math.min(2, W) * t;
    const hx = this.ox + Math.round((W * t - hatchW) / 2);
    g.fillStyle = '#3b2a20';
    g.fillRect(hx, this.oy - wallRows * t * 0.75, hatchW, wallRows * t * 0.55);
    const ovens = s.equipment.filter((e) => EQUIPMENT[e.itemId]?.role === 'oven');
    if (ovens.length) {
      g.fillStyle = this.playing && this.inService() ? `rgba(255,150,50,${0.55 + 0.25 * Math.sin(secs * 6)})` : 'rgba(255,150,50,0.18)';
      g.fillRect(hx + 3, this.oy - wallRows * t * 0.72, hatchW - 6, wallRows * t * 0.49);
    }
    if (this.playing && this.inService()) {
      for (let i = 0; i < 2; i++) drawPizza(g, hx + hatchW * (0.3 + 0.4 * i), this.oy - wallRows * t * 0.2, t * 0.45);
    }

    this.drawWallTouches(g, s, hx, hatchW, wallRows, secs);

    // Dining floor.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawFloorTile(g, this.ox + x * t, this.oy + y * t, t, 'dining', x, y);
    // Entrance.
    drawDoormat(g, this.ox + (W / 2 - 1) * t, this.oy + H * t - t * 0.15, 2 * t, t * 0.35, t);

    // Furniture.
    for (const f of s.furniture) {
      const item = FURNITURE[f.itemId];
      if (!item) continue;
      const moving = this.tool.kind === 'move' && this.tool.uid === f.uid;
      g.globalAlpha = moving ? 0.35 : 1;
      drawFurniture(g, item.id, this.ox + f.x * t, this.oy + f.y * t, item.w * t, item.h * t, t, secs);
      g.globalAlpha = 1;
      if (this.selected === f.uid) {
        g.strokeStyle = css('--accent');
        g.lineWidth = 3;
        roundRect(g, this.ox + f.x * t + 1, this.oy + f.y * t + 1, item.w * t - 2, item.h * t - 2, 8);
        g.stroke();
      }
    }

    this.drawTableTouches(g, s, secs);

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
        g.globalAlpha = 0.6;
        drawFurniture(g, item.id, this.ox + this.hover.x * t, this.oy + this.hover.y * t, item.w * t, item.h * t, t);
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

  /** Room touches on the back wall (balance.md 4.8): drawn around the kitchen hatch. */
  private drawWallTouches(g: CanvasRenderingContext2D, s: GameState, hx: number, hatchW: number, wallRows: number, secs: number): void {
    const has = (id: string): boolean => (s.roomTouches ?? []).includes(id);
    const t = this.tile;
    const { W } = this.dims();
    const top = this.oy - wallRows * t;
    const left = { x0: this.ox + t * 0.2, x1: hx - t * 0.2 };
    const right = { x0: hx + hatchW + t * 0.2, x1: this.ox + W * t - t * 0.2 };
    if (has('mural')) {
      const w = right.x1 - right.x0;
      const y = top + wallRows * t * 0.28;
      const hgt = wallRows * t * 0.6;
      const sky = g.createLinearGradient(0, y, 0, y + hgt);
      sky.addColorStop(0, '#9fd3e6');
      sky.addColorStop(0.55, '#5fa9c9');
      sky.addColorStop(1, '#2f7ea8');
      g.fillStyle = sky;
      g.fillRect(right.x0, y, w, hgt);
      g.fillStyle = '#e8c97a';
      g.fillRect(right.x0, y + hgt * 0.8, w, hgt * 0.2);
      g.fillStyle = '#4f8f3a';
      for (let i = 0; i < 4; i++) {
        const cx = right.x0 + w * (0.12 + 0.25 * i);
        g.beginPath();
        g.arc(cx, y + hgt * 0.72, hgt * 0.14, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f2d23c';
        g.fillRect(cx - 2, y + hgt * 0.66, 3, 3);
        g.fillStyle = '#4f8f3a';
      }
      g.strokeStyle = '#6b4a2e';
      g.lineWidth = 2;
      g.strokeRect(right.x0, y, w, hgt);
    }
    if (has('photos')) {
      for (let i = 0; i < 3; i++) {
        const x = left.x0 + t * 0.3 + i * t * 0.75;
        const y = top + wallRows * t * (0.32 + (i % 2) * 0.12);
        g.fillStyle = '#6b4a2e';
        g.fillRect(x, y, t * 0.5, t * 0.4);
        g.fillStyle = ['#d9c8a6', '#c9b28c', '#e0d2b8'][i] ?? '#d9c8a6';
        g.fillRect(x + 3, y + 3, t * 0.5 - 6, t * 0.4 - 6);
      }
    }
    if (has('chalkboard')) {
      const x = left.x1 - t * 1.1;
      const y = top + wallRows * t * 0.3;
      g.fillStyle = '#8a6a44';
      g.fillRect(x - 2, y - 2, t * 0.9 + 4, t * 0.62 + 4);
      g.fillStyle = '#2d3a33';
      g.fillRect(x, y, t * 0.9, t * 0.62);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(x + 5, y + 8 + i * t * 0.16);
        g.lineTo(x + t * 0.9 - 6 - (i % 2) * 6, y + 8 + i * t * 0.16);
        g.stroke();
      }
    }
    if (has('mirror')) {
      const cx = has('mural') ? right.x0 - t * 0.02 : (right.x0 + right.x1) / 2;
      const cy = top + wallRows * t * 0.55;
      g.fillStyle = '#c9a33b';
      g.beginPath();
      g.ellipse(has('mural') ? hx + hatchW + t * 0.5 : cx, cy, t * 0.28, t * 0.36, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#cfe3ea';
      g.beginPath();
      g.ellipse(has('mural') ? hx + hatchW + t * 0.5 : cx, cy, t * 0.2, t * 0.28, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (has('vines')) {
      g.strokeStyle = '#4c7a34';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = this.ox; x <= this.ox + W * t; x += 4) {
        const y = top + t * 0.22 + Math.sin(x / 9) * 3;
        if (x === this.ox) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#6aa04a';
      for (let x = this.ox + 6; x < this.ox + W * t; x += 14) {
        g.beginPath();
        g.ellipse(x, top + t * 0.22 + Math.sin(x / 9) * 3 + 4, 4, 2.5, 0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#6b2f5a';
      for (let x = this.ox + 20; x < this.ox + W * t; x += 60) for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x + (k % 2) * 3, top + t * 0.3 + k * 3, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (has('bunting')) {
      const colors = ['#2e8b57', '#f4f1e8', '#c8372d'];
      const y = top + t * 0.06;
      const step = Math.max(10, t * 0.35);
      let i = 0;
      for (let x = this.ox; x + step <= this.ox + W * t; x += step, i++) {
        g.fillStyle = colors[i % 3] as string;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + step, y);
        g.lineTo(x + step / 2, y + step * 0.8);
        g.closePath();
        g.fill();
      }
    }
    if (has('sconces')) {
      const glow = 0.35 + 0.05 * Math.sin(secs * 2);
      for (const fx of [0.08, 0.3, 0.7, 0.92]) {
        const x = this.ox + W * t * fx;
        const y = top + wallRows * t * 0.62;
        const gr = g.createRadialGradient(x, y, 1, x, y, t * 0.5);
        gr.addColorStop(0, `rgba(255,214,120,${glow + 0.3})`);
        gr.addColorStop(1, 'rgba(255,214,120,0)');
        g.fillStyle = gr;
        g.fillRect(x - t * 0.5, y - t * 0.5, t, t);
        g.fillStyle = '#b8892e';
        g.fillRect(x - 3, y, 6, 8);
      }
    }
  }

  /** Room touches on every table: candles, flowers and pendant lights. */
  private drawTableTouches(g: CanvasRenderingContext2D, s: GameState, secs: number): void {
    const has = (id: string): boolean => (s.roomTouches ?? []).includes(id);
    if (!has('candles') && !has('flowers') && !has('pendants')) return;
    const t = this.tile;
    for (const f of s.furniture) {
      const item = FURNITURE[f.itemId];
      if (!item || item.kind !== 'table') continue;
      const cx = this.ox + (f.x + item.w / 2) * t;
      const cy = this.oy + (f.y + item.h / 2) * t;
      if (has('pendants')) {
        const gr = g.createRadialGradient(cx, cy, 2, cx, cy, t * 0.9);
        gr.addColorStop(0, 'rgba(255,220,140,0.28)');
        gr.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = gr;
        g.fillRect(cx - t, cy - t, 2 * t, 2 * t);
      }
      if (has('flowers')) {
        g.fillStyle = '#e8e2d4';
        g.fillRect(cx + t * 0.12 - 2, cy - 3, 4, 6);
        for (const [dx, dy, c] of [[-3, -5, '#e0526b'], [2, -6, '#f2c14e'], [0, -9, '#d9427a']] as const) {
          g.fillStyle = c;
          g.beginPath();
          g.arc(cx + t * 0.12 + dx, cy + dy, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (has('candles')) {
        const x = cx - t * 0.12;
        g.fillStyle = '#3f6b3a';
        g.fillRect(x - 2, cy - 4, 4, 8);
        const flick = 1 + 0.2 * Math.sin(secs * 9 + f.uid);
        const gr = g.createRadialGradient(x, cy - 7, 0.5, x, cy - 7, 7 * flick);
        gr.addColorStop(0, 'rgba(255,230,150,0.95)');
        gr.addColorStop(1, 'rgba(255,170,60,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, cy - 7, 7 * flick, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private drawGuests(g: CanvasRenderingContext2D, s: GameState): void {
    const t = this.tile;
    const { W, H } = this.dims();
    const doorX = this.ox + (W / 2) * t;
    const doorY = this.oy + H * t - t * 0.45;
    const size = Math.max(14, t * 0.62);
    const secs = performance.now() / 1000;
    let queue = 0;
    this.parties.forEach((p, idx) => {
      const c = this.clock;
      if (c < p.arrive || c > p.leave + 4) return;
      const color = SEG_COLORS[p.segment];
      if (p.tableUid === null) {
        // Walked away: fade out at the door.
        if (c > p.arrive + 6) return;
        g.globalAlpha = 1 - (c - p.arrive) / 6;
        for (let i = 0; i < p.size; i++) drawGuest(g, doorX + (i - p.size / 2) * size * 0.6, doorY + t * 0.5, size, color, false, secs, { variant: idx + i, walking: true });
        g.globalAlpha = 1;
        return;
      }
      if (c < p.seat) {
        for (let i = 0; i < p.size; i++) {
          drawGuest(g, doorX - t * 1.2 + (queue % 7) * size * 0.55, doorY - Math.floor(queue / 7) * size * 0.6, size, color, false, secs, { variant: idx + i });
          queue += 1;
        }
        return;
      }
      const f = s.furniture.find((x) => x.uid === p.tableUid);
      const item = f ? FURNITURE[f.itemId] : undefined;
      if (!f || !item) return;
      const cx = this.ox + (f.x + item.w / 2) * t;
      const cy = this.oy + (f.y + item.h / 2) * t;
      if (c > p.leave) {
        if (p.happy) {
          g.fillStyle = '#e25b6a';
          g.font = `${Math.round(t * 0.5)}px system-ui`;
          g.textAlign = 'center';
          g.fillText('♥', cx, cy - t * 0.3 - (c - p.leave) * 3);
        }
        return;
      }
      const seats = seatSpots(item.id, item.w * t, item.h * t, item.seats, t);
      for (let i = 0; i < p.size; i++) {
        const sp = seats[i];
        if (sp) drawGuest(g, this.ox + f.x * t + sp[0], this.oy + f.y * t + sp[1], size, color, true, secs, { variant: idx * 3 + i, back: i % 2 === 0 });
      }
      if (c - p.seat > 4 && c < p.leave - 6) drawPizza(g, cx, cy, Math.max(10, t * 0.42));
    });
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

