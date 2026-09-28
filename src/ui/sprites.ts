// Pizza D pixel art sprites, drawn entirely in code with Canvas2D (no image assets).
//
// Grid: one floor tile is PIXEL x PIXEL logical pixels (16 x 16). A logical pixel is tile / 16 screen
// pixels, and every rectangle edge is snapped to the device pixel grid of the current transform, so the
// art stays crisp at any tile size from 24 to 72 px and at any devicePixelRatio.
//
// View: gentle 3/4 top down. Objects show a lit top surface and a darker front face, have a 1 px ink
// outline, and cast a soft shadow one logical pixel to the right and below.

export const PIXEL = 16;

export const PALETTE = {
  ink: '#2b1b17',
  shadow: 'rgba(43, 27, 23, 0.28)',
  white: '#fbf5e6',
  whiteShade: '#d6ccb8',
  cream: '#f3e2bf',
  creamDk: '#d9c095',
  terra: '#c3673e',
  terraAlt: '#b65c36',
  terraLt: '#d9855a',
  terraDk: '#94462a',
  grout: '#7a3a22',
  brick: '#a8452c',
  brickLt: '#bf5c3a',
  brickDk: '#86331f',
  mortar: '#d6bb8f',
  woodXDk: '#3d2215',
  woodDk: '#5a321f',
  wood: '#8a5431',
  woodLt: '#b57a48',
  woodHi: '#dca76a',
  tomato: '#d33a26',
  tomatoDk: '#94231a',
  tomatoLt: '#ee9b85',
  basil: '#3f8a36',
  basilDk: '#275c25',
  basilLt: '#79bb4e',
  gold: '#e7b035',
  goldLt: '#f8dd78',
  goldDk: '#a8741c',
  steel: '#9aa4ab',
  steelLt: '#cfd6da',
  steelDk: '#65707a',
  steelXDk: '#3d454c',
  marble: '#ece8df',
  marbleVein: '#b9b2a6',
  stone: '#a59c8c',
  stoneLt: '#c9c0aa',
  stoneDk: '#756c5c',
  tileCream: '#e9dfc6',
  slate: '#a3aba3',
  slateDk: '#8e978f',
  water: '#3f93c0',
  waterLt: '#9ad6ea',
  waterDk: '#2a6a93',
  fire: '#ff8c1a',
  fireLt: '#ffd84a',
  ember: '#c3321a',
  coal: '#2a1510',
  glass: '#2e3b44',
  glassLt: '#6e8794',
  leather: '#8e2d25',
  leatherLt: '#b0463a',
  leatherDk: '#5e1b16',
  bottleRed: '#6b1624',
  bottleGreen: '#2f5a2a',
  bottleAmber: '#a8641c',
  skin: ['#f2c7a0', '#d9a077', '#a86f4a', '#6e4630'],
  hair: ['#3a2418', '#7a4522', '#d6ae5a', '#a9a39a', '#1e1a18', '#a8412a'],
  pants: ['#3b4a6b', '#4a3b30', '#2f3440', '#6b5a45'],
} as const;

const P_ = PALETTE;

// ---------------------------------------------------------------------------------------------
// Pen: logical pixel drawing with device pixel snapping.

interface Pen {
  r(u: number, v: number, w: number, h: number, c: string): void;
  px(u: number, v: number, c: string): void;
  ell(cu: number, cv: number, rx: number, ry: number, c: string): void;
}

function pen(g: CanvasRenderingContext2D, ox: number, oy: number, p: number): Pen {
  g.imageSmoothingEnabled = false;
  const m = g.getTransform();
  const s = Math.hypot(m.a, m.b) || 1;
  const snap = (n: number): number => Math.round(n * s) / s;
  const r = (u: number, v: number, w: number, h: number, c: string): void => {
    if (w <= 0 || h <= 0) return;
    const x0 = snap(ox + u * p);
    const x1 = snap(ox + (u + w) * p);
    const y0 = snap(oy + v * p);
    const y1 = snap(oy + (v + h) * p);
    if (x1 <= x0 || y1 <= y0) return;
    g.fillStyle = c;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  const ell = (cu: number, cv: number, rx: number, ry: number, c: string): void => {
    if (rx <= 0 || ry <= 0) return;
    const rows = Math.ceil(ry);
    for (let j = -rows; j < rows; j++) {
      const yy = (j + 0.5) / ry;
      if (Math.abs(yy) >= 1) continue;
      const hw = Math.round(rx * Math.sqrt(1 - yy * yy));
      if (hw > 0) r(cu - hw, cv + j, hw * 2, 1, c);
    }
  };
  return { r, px: (u, v, c) => r(u, v, 1, 1, c), ell };
}

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const pick = <T>(arr: readonly T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length] as T;

/** Darken (f < 1) or lighten (f > 1) a #rrggbb colour. Other formats are returned unchanged. */
export function shade(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1] ?? '000000', 16);
  const ch = (k: number): string => {
    const v = (n >> k) & 255;
    const out = f <= 1 ? v * f : v + (255 - v) * (f - 1);
    return Math.max(0, Math.min(255, Math.round(out))).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Draw a character map: one char per logical pixel, '.' is transparent. */
function drawMap(P: Pen, rows: readonly string[], u0: number, v0: number, colors: Record<string, string>): void {
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row.charAt(i);
      let k = i + 1;
      while (k < row.length && row.charAt(k) === ch) k++;
      const c = colors[ch];
      if (ch !== '.' && c) P.r(u0 + i, v0 + j, k - i, 1, c);
      i = k;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Floors and walls

/** One floor tile. Dining: terracotta tiles with grout. Kitchen: cream and slate checkerboard. */
export function drawFloorTile(g: CanvasRenderingContext2D, x: number, y: number, size: number, variant: 'dining' | 'kitchen', tx: number, ty: number): void {
  const P = pen(g, x, y, size / PIXEL);
  const h = hash(tx, ty);
  if (variant === 'dining') {
    const alt = (tx + ty) & 1;
    P.r(0, 0, 16, 16, alt ? P_.terraAlt : P_.terra);
    P.r(0, 0, 15, 1, P_.terraLt);
    P.r(0, 1, 1, 14, P_.terraLt);
    P.r(15, 0, 1, 16, P_.grout);
    P.r(0, 15, 16, 1, P_.grout);
    for (let k = 0; k < 3; k++) {
      const u = 2 + ((h >>> (k * 6)) % 11);
      const v = 2 + ((h >>> (k * 6 + 3)) % 11);
      P.px(u, v, k === 0 ? P_.terraLt : P_.terraDk);
    }
    if (h % 7 === 0) P.r(3 + ((h >>> 9) % 8), 4 + ((h >>> 13) % 7), 3, 1, P_.terraDk);
    return;
  }
  const a = P_.tileCream;
  const b = P_.slate;
  P.r(0, 0, 8, 8, a);
  P.r(8, 0, 8, 8, b);
  P.r(0, 8, 8, 8, b);
  P.r(8, 8, 8, 8, a);
  P.r(8, 7, 8, 1, P_.slateDk);
  P.r(0, 15, 8, 1, P_.slateDk);
  const gr = 'rgba(43, 27, 23, 0.16)';
  P.r(7, 0, 1, 16, gr);
  P.r(15, 0, 1, 16, gr);
  P.r(0, 7, 7, 1, gr);
  P.r(8, 7, 7, 1, gr);
  P.r(0, 15, 7, 1, gr);
  P.r(8, 15, 7, 1, gr);
}

/**
 * A wall band along the top edge of a room: wooden cap rail, brick (or white kitchen tile) courses and a
 * wooden skirting. The band is 16 logical pixels tall (h / 16 per pixel) and casts a 1 px shadow below h.
 */
export function drawWall(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: 'brick' | 'tile' = 'brick'): void {
  const p = h / 16;
  const P = pen(g, x, y, p);
  const W = w / p;
  P.r(0, 0, W, 1, P_.ink);
  P.r(0, 1, W, 1, P_.woodHi);
  P.r(0, 2, W, 1, P_.wood);
  P.r(0, 3, W, 10, style === 'brick' ? P_.mortar : P_.whiteShade);
  for (let c = 0; c < 3; c++) {
    const v = 4 + c * 3;
    const len = style === 'brick' ? 6 : 5;
    const off = c % 2 ? -Math.floor(len / 2) - 0.5 : 0;
    for (let u = off, i = 0; u < W; u += len + 1, i++) {
      const u0 = Math.max(0, u);
      const uw = Math.min(W, u + len) - u0;
      if (uw <= 0) continue;
      if (style === 'brick') {
        const hv = hash(i, c, 7) % 5;
        const base = hv === 0 ? P_.brickDk : hv === 1 ? P_.brickLt : P_.brick;
        P.r(u0, v, uw, 1, shade(base, 1.12));
        P.r(u0, v + 1, uw, 1, base);
      } else {
        P.r(u0, v, uw, 2, P_.white);
        P.r(u0, v, Math.min(1, uw), 1, '#ffffff');
      }
    }
  }
  P.r(0, 13, W, 1, P_.ink);
  P.r(0, 14, W, 1, P_.woodLt);
  P.r(0, 15, W, 1, P_.woodDk);
  P.r(0, 16, W, 1, P_.shadow);
}

/** A doormat for the entrance, w x h in screen pixels, tile for scale. */
export function drawDoormat(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tile: number): void {
  const p = tile / PIXEL;
  const P = pen(g, x, y, p);
  const W = w / p;
  const H = h / p;
  P.r(0, 0, W, H, P_.ink);
  P.r(1, 1, W - 2, H - 2, P_.tomatoDk);
  for (let u = 2; u < W - 2; u += 3) P.r(u, 2, 1, H - 4, P_.tomato);
}

// ---------------------------------------------------------------------------------------------
// Seats

/**
 * Seat centres in screen pixels relative to the item's top left. Tables match the floor view's
 * current seatPositions; booths put guests on the bench seats instead of the backrests.
 */
export function seatSpots(itemId: string, w: number, h: number, seats: number, tile: number): [number, number][] {
  const out: [number, number][] = [];
  // Guests stand along the front of a bar counter or a window ledge.
  if (itemId === 'standingBar' || itemId === 'windowLedge') {
    for (let i = 0; i < seats; i++) out.push([((i + 0.5) / seats) * w, h - tile * 0.12]);
    return out;
  }
  const perSide = Math.ceil(seats / 2);
  const horizontal = w >= h;
  const inset = itemId === 'booth4' ? tile * 0.42 : tile * 0.12;
  for (let i = 0; i < seats; i++) {
    const side = i % 2;
    const k = Math.floor(i / 2);
    if (horizontal) out.push([((k + 0.5) / perSide) * w, side ? h - inset : inset]);
    else out.push([side ? w - inset : inset, ((k + 0.5) / perSide) * h]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Small props

/** A pizza seen from above, r in logical pixels. */
function pizza(P: Pen, cu: number, cv: number, r: number): void {
  if (r >= 2.5) P.ell(cu, cv, r + 0.6, r * 0.8 + 0.6, P_.ink);
  P.ell(cu, cv, r, r * 0.8, P_.goldDk);
  P.ell(cu, cv, r - 0.8, r * 0.8 - 0.8, P_.gold);
  if (r >= 2) {
    P.px(cu - 1, cv - 1, P_.tomato);
    P.px(cu, cv, P_.tomato);
    P.px(cu + 1 - (r >= 3 ? 0 : 1), cv - 1, P_.basil);
  }
}

/** Public helper: a small pizza (for food on tables, the pass, toasts), size in screen px. */
export function drawPizza(g: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const P = pen(g, x - size / 2, y - size / 2, size / 8);
  pizza(P, 4, 4, 3);
}

function candleBottle(P: Pen, cu: number, cv: number): void {
  P.r(cu - 1.5, cv - 1, 3, 3, P_.ink);
  P.r(cu - 0.5, cv, 1, 1, P_.bottleGreen);
  P.r(cu - 1.5, cv + 1, 3, 1, P_.gold);
  P.px(cu - 0.5, cv - 2, P_.cream);
  P.px(cu - 0.5, cv - 3, P_.fireLt);
}

function plate(P: Pen, cu: number, cv: number): void {
  P.r(cu - 1.5, cv - 1, 3, 2, P_.whiteShade);
  P.r(cu - 1.5, cv - 1, 3, 1, P_.white);
}

function chair(P: Pen, cu: number, side: 'top' | 'bottom', v0: number): void {
  const u = cu - 3;
  if (side === 'top') {
    P.r(u, v0, 6, 5, P_.ink);
    P.r(u + 1, v0 + 1, 4, 1, P_.wood);
    P.r(u + 1, v0 + 2, 4, 2, P_.woodLt);
  } else {
    P.r(u, v0, 6, 4, P_.ink);
    P.r(u + 1, v0 + 1, 4, 1, P_.woodLt);
    P.r(u + 1, v0 + 2, 4, 1, P_.wood);
    P.px(u + 2, v0 + 2, P_.woodDk);
    P.px(u + 3, v0 + 2, P_.woodDk);
  }
}

function sideChair(P: Pen, cv: number, side: 'left' | 'right', u0: number): void {
  const v = cv - 3;
  P.r(u0, v, 5, 6, P_.ink);
  if (side === 'left') {
    P.r(u0 + 1, v + 1, 1, 4, P_.wood);
    P.r(u0 + 2, v + 1, 2, 4, P_.woodLt);
  } else {
    P.r(u0 + 1, v + 1, 2, 4, P_.woodLt);
    P.r(u0 + 3, v + 1, 1, 4, P_.wood);
  }
}

function gingham(P: Pen, u: number, v: number, w: number, h: number): void {
  for (let j = 0; j < h; j += 2) {
    for (let i = 0; i < w; i += 2) {
      const a = (i / 2) % 2 === 1;
      const b = (j / 2) % 2 === 1;
      const c = a && b ? P_.tomato : a || b ? P_.tomatoLt : P_.white;
      P.r(u + i, v + j, Math.min(2, w - i), Math.min(2, h - j), c);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Furniture

function table(P: Pen, W: number, H: number, seats: number): void {
  const spots = seatSpots('table', W, H, seats, PIXEL);
  if (W >= H) {
    for (const [sx, sy] of spots) if (sy < H / 2) chair(P, Math.round(sx), 'top', 0);
    P.r(3, 13, W - 5, 1, P_.shadow);
    P.r(2, 4, W - 4, 9, P_.ink);
    gingham(P, 3, 5, W - 6, 5);
    P.r(3, 10, W - 6, 1, P_.tomato);
    P.r(3, 11, W - 6, 1, P_.tomatoDk);
    for (const [sx, sy] of spots) plate(P, Math.round(sx), sy < H / 2 ? 6 : 9);
    candleBottle(P, Math.round(W / 2), 7);
    for (const [sx, sy] of spots) if (sy >= H / 2) chair(P, Math.round(sx), 'bottom', 12);
  } else {
    for (const [sx, sy] of spots) if (sx < W / 2) sideChair(P, Math.round(sy), 'left', 0);
    P.r(4, 3, 9, H - 5, P_.shadow);
    P.r(3, 2, 10, H - 5, P_.ink);
    gingham(P, 4, 3, 8, H - 8);
    P.r(4, H - 5, 8, 1, P_.tomato);
    P.r(4, H - 4, 8, 1, P_.tomatoDk);
    candleBottle(P, 8, Math.round(H / 2));
    for (const [sx, sy] of spots) if (sx >= W / 2) sideChair(P, Math.round(sy), 'right', W - 5);
  }
}

/** A bar counter (dark wood, brass rail) or a light window ledge, guests standing along the front. */
function barCounter(P: Pen, W: number, places: number, bar: boolean): void {
  P.r(2, 11, W - 3, 1, P_.shadow);
  P.r(1, 2, W - 2, 9, P_.ink);
  P.r(2, 3, W - 4, 2, bar ? P_.woodLt : P_.cream);
  P.r(2, 5, W - 4, 4, bar ? P_.wood : P_.creamDk);
  P.r(2, 9, W - 4, 1, bar ? P_.woodXDk : P_.woodLt);
  if (bar) P.r(2, 12, W - 4, 1, P_.gold);
  for (let i = 0; i < places; i++) {
    const cu = Math.round(((i + 0.5) / places) * W);
    plate(P, cu, 5);
    if (bar && i % 2 === 0) {
      P.r(cu + 2, 3, 1, 2, P_.bottleGreen);
      P.px(cu + 2, 2, P_.ink);
    }
  }
}

/** A round standing table on a single leg. */
function highTable(P: Pen, W: number, H: number): void {
  const cu = W / 2;
  const cv = H / 2;
  P.ell(cu + 1, cv + 2, 5, 4, P_.shadow);
  P.ell(cu, cv, 5.5, 4.5, P_.ink);
  P.ell(cu, cv, 4.5, 3.5, P_.woodLt);
  P.ell(cu, cv - 1, 3, 2, P_.woodHi);
  plate(P, Math.round(cu), Math.round(cv));
}

function booth(P: Pen, W: number, H: number): void {
  const bench = (v: number, back: 'top' | 'bottom'): void => {
    P.r(1, v, W - 2, 9, P_.ink);
    if (back === 'top') {
      P.r(2, v + 1, W - 4, 1, P_.leatherLt);
      P.r(2, v + 2, W - 4, 3, P_.leather);
      for (let u = 5; u < W - 4; u += 5) P.px(u, v + 3, P_.leatherDk);
      P.r(2, v + 5, W - 4, 1, P_.leatherDk);
      P.r(2, v + 6, W - 4, 2, P_.leatherLt);
    } else {
      P.r(2, v + 1, W - 4, 2, P_.leatherLt);
      P.r(2, v + 3, W - 4, 1, P_.leatherDk);
      P.r(2, v + 4, W - 4, 3, P_.leather);
      for (let u = 5; u < W - 4; u += 5) P.px(u, v + 5, P_.leatherDk);
      P.r(2, v + 7, W - 4, 1, P_.leatherDk);
    }
    P.r(1, v, 2, 9, P_.ink);
    P.r(W - 3, v, 2, 9, P_.ink);
    P.r(2, v + 1, 1, 7, P_.woodLt);
    P.r(W - 3, v + 1, 1, 7, P_.wood);
  };
  bench(0, 'top');
  P.r(5, 22, W - 9, 1, P_.shadow);
  P.r(4, 10, W - 8, 12, P_.ink);
  P.r(5, 11, W - 10, 1, P_.woodHi);
  P.r(5, 12, W - 10, 6, P_.woodLt);
  P.r(5, 18, W - 10, 1, P_.wood);
  P.r(5, 19, W - 10, 2, P_.woodDk);
  for (const u of [W * 0.25, W * 0.75]) {
    plate(P, Math.round(u), 13);
    plate(P, Math.round(u), 17);
  }
  candleBottle(P, Math.round(W / 2), 15);
  bench(H - 9, 'bottom');
}

function plant(P: Pen): void {
  P.ell(9, 15, 5, 1, P_.shadow);
  P.r(3, 9, 10, 2, P_.ink);
  P.r(4, 11, 8, 4, P_.ink);
  P.r(4, 9.5, 8, 1, P_.terraLt);
  P.r(5, 11, 6, 3, P_.terra);
  P.r(10, 11, 1, 3, P_.terraDk);
  P.r(5, 11, 1, 3, P_.terraLt);
  P.ell(8, 6, 6, 5, P_.ink);
  P.ell(8, 6, 5, 4, P_.basilDk);
  P.ell(6, 5, 3, 2, P_.basil);
  P.ell(10, 6, 3, 2, P_.basil);
  P.ell(8, 3, 2, 2, P_.basil);
  P.px(5, 4, P_.basilLt);
  P.px(9, 5, P_.basilLt);
  P.px(8, 2, P_.basilLt);
  P.px(11, 5, P_.basilLt);
  P.r(2, 5, 1, 2, P_.basilDk);
  P.r(13, 6, 1, 2, P_.basilDk);
  P.r(7, 0, 2, 1, P_.basilDk);
}

function glow(P: Pen, cu: number, cv: number, r: number, t: number, seed: number): void {
  const f = 1 + 0.08 * Math.sin(t * 5 + seed);
  P.ell(cu, cv, r * f, r * f, 'rgba(255, 206, 110, 0.10)');
  P.ell(cu, cv, r * 0.7 * f, r * 0.7 * f, 'rgba(255, 206, 110, 0.12)');
  P.ell(cu, cv, r * 0.42 * f, r * 0.42 * f, 'rgba(255, 220, 140, 0.16)');
}

function lamp(P: Pen, t: number): void {
  glow(P, 8, 5, 15, t, 1);
  P.ell(8, 14, 4, 1.5, P_.shadow);
  P.r(5, 13, 6, 2, P_.ink);
  P.r(6, 13, 4, 1, P_.woodLt);
  P.r(7, 6, 2, 7, P_.ink);
  P.r(7, 7, 1, 6, P_.goldDk);
  P.r(5, 1, 6, 1, P_.ink);
  P.r(4, 2, 8, 1, P_.ink);
  P.r(3, 3, 10, 4, P_.ink);
  P.r(5, 2, 6, 1, P_.goldLt);
  P.r(4, 3, 8, 3, P_.gold);
  P.r(4, 3, 2, 3, P_.goldLt);
  P.r(10, 3, 2, 3, P_.goldDk);
  P.r(6, 6, 4, 1, P_.fireLt);
}

function painting(P: Pen): void {
  P.ell(8, 15, 5, 1, P_.shadow);
  // Easel: mast with a peg, two splayed front legs.
  P.r(7, 0, 2, 15, P_.ink);
  P.px(7.5, 1, P_.woodLt);
  for (let v = 10; v < 16; v++) {
    const d = Math.floor((v - 10) / 2);
    P.r(4 - d, v, 2, 1, P_.ink);
    P.r(10 + d, v, 2, 1, P_.ink);
    P.px(4.5 - d, v, P_.woodLt);
    P.px(10.5 + d, v, P_.wood);
  }
  P.r(7.5, 11, 1, 4, P_.woodLt);
  // Canvas in a gold frame, a little harbour scene.
  P.r(2, 2, 12, 9, P_.ink);
  P.r(3, 3, 10, 7, P_.gold);
  P.r(3, 3, 10, 1, P_.goldLt);
  P.r(3, 9, 10, 1, P_.goldDk);
  P.r(4, 4, 8, 5, P_.waterLt);
  P.r(9, 4, 2, 1, P_.white);
  P.px(5, 4, P_.goldLt);
  P.r(4, 6, 8, 3, P_.water);
  P.r(4, 8, 8, 1, P_.waterDk);
  P.r(9, 5, 3, 1, P_.terraLt);
  P.r(10, 4, 1, 1, P_.terra);
  P.px(6, 4, P_.white);
  P.r(6, 5, 2, 1, P_.white);
  P.r(5, 6, 4, 1, P_.woodDk);
  // Ledge.
  P.r(1, 11, 14, 1, P_.ink);
  P.r(2, 11, 12, 1, P_.woodLt);
}

function shelf(P: Pen, W: number): void {
  P.r(2, 15, W - 3, 1, P_.shadow);
  P.r(1, 1, W - 2, 14, P_.ink);
  P.r(2, 2, W - 4, 1, P_.woodHi);
  P.r(2, 3, W - 4, 1, P_.woodLt);
  P.r(2, 4, W - 4, 10, P_.woodDk);
  const bottles = [P_.bottleRed, P_.bottleGreen, P_.bottleAmber, P_.bottleRed];
  let i = 0;
  for (let u = 3; u + 3 <= W - 2; u += 4, i++) {
    for (let j = 0; j < 3; j++) {
      const v = 4.5 + j * 3;
      P.r(u, v, 3, 3, P_.coal);
      if (hash(i, j, 3) % 6 === 0) continue;
      const c = pick(bottles, i + j * 3);
      P.r(u + 1, v + 1, 2, 2, c);
      P.px(u + 1, v + 1, shade(c, 1.6));
    }
  }
}

function fountain(P: Pen, W: number, H: number, t: number): void {
  const cu = W / 2;
  const cv = H / 2;
  P.ell(cu + 1, cv + 1.5, 14, 13, P_.shadow);
  P.ell(cu, cv, 14, 13, P_.ink);
  P.ell(cu, cv, 13, 12, P_.stone);
  P.ell(cu, cv - 0.5, 12, 11, P_.stoneLt);
  P.ell(cu, cv + 0.5, 11, 10, P_.stoneDk);
  P.ell(cu, cv + 1, 10, 9, P_.water);
  for (let k = 0; k < 2; k++) {
    const r = 4 + ((t * 3 + k * 3) % 6);
    const a = 0.7 * (1 - (r - 4) / 6);
    P.ell(cu, cv + 1, r + 1, r * 0.85 + 1, `rgba(154, 214, 234, ${a.toFixed(2)})`);
    P.ell(cu, cv + 1, r, r * 0.85, P_.water);
  }
  P.ell(cu, cv + 1, 3.5, 3, P_.ink);
  P.ell(cu, cv + 1, 2.5, 2, P_.stoneLt);
  P.r(cu - 1.5, cv - 7, 3, 8, P_.ink);
  P.r(cu - 0.5, cv - 6, 1, 7, P_.stoneLt);
  P.ell(cu, cv - 7, 3, 2, P_.ink);
  P.ell(cu, cv - 7, 2, 1, P_.waterLt);
  const drop = Math.floor(t * 8) % 3;
  for (const s of [-1, 1]) {
    P.px(cu + s * 3, cv - 6 + drop, P_.waterLt);
    P.px(cu + s * 4, cv - 3 + drop, P_.waterLt);
  }
  P.px(cu - 6, cv + 3, P_.white);
  P.px(cu + 5, cv + 5, P_.white);
}

function lanterns(P: Pen, t: number): void {
  const at = (u: number): number => 2 + Math.round(3 * Math.sin((Math.PI * u) / 16));
  const colors = [P_.tomato, P_.gold, P_.basil];
  [3, 8, 13].forEach((u, i) => glow(P, u, at(u) + 4, 6, t, i * 2));
  P.ell(8, 14, 7, 1.5, 'rgba(255, 206, 110, 0.18)');
  for (let u = 0; u < 16; u++) P.px(u, at(u), P_.ink);
  [3, 8, 13].forEach((u, i) => {
    const v = at(u) + 1;
    const c = pick(colors, i);
    const flick = Math.sin(t * 7 + i * 2.1) > 0.6;
    P.r(u - 2, v, 4, 5, P_.ink);
    P.r(u - 1, v + 1, 2, 3, c);
    P.px(u - 1, v + 1, flick ? P_.white : shade(c, 1.5));
    P.r(u - 1, v + 4, 2, 1, P_.ink);
  });
}

function crate(P: Pen, W: number, H: number): void {
  const w = Math.min(W, 16);
  const h = Math.min(H, 16);
  const u = (W - w) / 2 + 2;
  const v = (H - h) / 2 + 3;
  const cw = w - 4;
  const ch = h - 4;
  P.r(u + 1, v + ch, cw, 1, P_.shadow);
  P.r(u, v, cw, ch, P_.ink);
  P.r(u + 1, v + 1, cw - 2, 2, P_.woodHi);
  P.r(u + 1, v + 3, cw - 2, ch - 4, P_.woodLt);
  for (let j = v + 5; j < v + ch - 1; j += 2) P.r(u + 1, j, cw - 2, 1, P_.wood);
  P.r(u + 1, v + 3, 1, ch - 4, P_.woodDk);
  P.r(u + cw - 2, v + 3, 1, ch - 4, P_.woodDk);
}

/** Furniture for the dining room, x/y/w/h in screen px (w = item.w * tile). Chairs are part of tables. */
export function drawFurniture(g: CanvasRenderingContext2D, itemId: string, x: number, y: number, w: number, h: number, tile: number, t = 0): void {
  const p = tile / PIXEL;
  const P = pen(g, x, y, p);
  const W = w / p;
  const H = h / p;
  switch (itemId) {
    case 'table2': return table(P, W, H, 2);
    case 'table4': return table(P, W, H, 4);
    case 'table6': return table(P, W, H, 6);
    case 'booth4': return booth(P, W, H);
    case 'standingBar': return barCounter(P, W, 5, true);
    case 'windowLedge': return barCounter(P, W, 3, false);
    case 'highTable': return highTable(P, W, H);
    case 'plant': return plant(P);
    case 'lamp': return lamp(P, t);
    case 'painting': return painting(P);
    case 'shelf': return shelf(P, W);
    case 'fountain': return fountain(P, W, H, t);
    case 'lanterns': return lanterns(P, t);
    default: return crate(P, W, H);
  }
}

// ---------------------------------------------------------------------------------------------
// Kitchen equipment

interface Rect { u: number; v: number; w: number; h: number }
interface Skin { top: string; topHi: string; lip: string; face: string; faceLo: string }

const STEEL: Skin = { top: P_.steelLt, topHi: P_.white, lip: P_.steelDk, face: P_.steel, faceLo: P_.steelDk };
const STONE: Skin = { top: P_.stoneLt, topHi: P_.cream, lip: P_.stoneDk, face: P_.stone, faceLo: P_.stoneDk };
const MARBLE_WOOD: Skin = { top: P_.marble, topHi: P_.white, lip: P_.marbleVein, face: P_.wood, faceLo: P_.woodDk };
const MARBLE_STEEL: Skin = { top: P_.marble, topHi: P_.white, lip: P_.steelDk, face: P_.steel, faceLo: P_.steelDk };

/** A 3/4 box with a shadow. Returns the interior of the top surface and of the front face. */
function body(P: Pen, u: number, v: number, W: number, H: number, ratio: number, s: Skin): { top: Rect; face: Rect } {
  const w = Math.round(W - 1);
  const h = Math.round(H - 1);
  P.r(u + 1, v + 1, w, h, P_.shadow);
  P.r(u, v, w, h, P_.ink);
  const th = Math.max(3, Math.min(h - 4, Math.round(h * ratio)));
  P.r(u + 1, v + 1, w - 2, th - 1, s.top);
  P.r(u + 1, v + 1, w - 2, 1, s.topHi);
  P.r(u + 1, v + th, w - 2, 1, s.lip);
  P.r(u + 1, v + th + 1, w - 2, h - th - 2, s.face);
  P.r(u + 1, v + h - 2, w - 2, 1, s.faceLo);
  return { top: { u: u + 1, v: v + 2, w: w - 2, h: th - 2 }, face: { u: u + 1, v: v + th + 1, w: w - 2, h: h - th - 3 } };
}

function doors(P: Pen, f: Rect, n: number, handle = P_.steelLt, split = P_.steelDk): void {
  if (f.h < 2) return;
  const dw = f.w / n;
  for (let i = 0; i < n; i++) {
    const u = Math.round(f.u + i * dw);
    if (i > 0) P.r(u, f.v, 1, f.h, split);
    const hu = i % 2 === 0 ? Math.round(f.u + (i + 1) * dw) - 3 : u + 2;
    P.r(hu, f.v + 1, 2, 1, P_.ink);
    P.r(hu, f.v + 1, 1, 1, handle);
  }
}

function fireFill(P: Pen, r: Rect, t: number, seed = 0): void {
  P.r(r.u, r.v, r.w, r.h, P_.coal);
  for (let i = 0; i < r.w; i++) {
    const n = (Math.sin(t * 9 + i * 1.9 + seed) + Math.sin(t * 5.3 + i * 0.7)) / 2;
    const fh = Math.max(1, Math.min(r.h, Math.round(r.h * (0.45 + 0.35 * n))));
    const base = r.v + r.h;
    P.r(r.u + i, base - fh, 1, fh, P_.fire);
    P.r(r.u + i, base - 1, 1, 1, P_.ember);
    if (fh >= 2) P.px(r.u + i, base - fh, P_.fireLt);
  }
}

function ovenDoor(P: Pen, u: number, v: number, w: number, h: number, active: boolean, t: number): void {
  if (w < 3 || h < 3) return;
  P.r(u, v, w, 1, P_.steelLt);
  P.r(u, v + 1, w, h - 1, P_.ink);
  const i: Rect = { u: u + 1, v: v + 2, w: w - 2, h: h - 3 };
  if (i.w <= 0 || i.h <= 0) return;
  if (active) {
    const flick = Math.floor(t * 8) % 2;
    P.r(i.u, i.v, i.w, i.h, P_.ember);
    P.r(i.u, i.v, i.w, Math.max(1, i.h - 1), P_.fire);
    P.r(i.u, i.v, i.w, Math.max(1, Math.floor(i.h / 3)), P_.fireLt);
    for (let k = flick; k < i.w; k += 3) P.px(i.u + k, i.v + Math.floor(i.h / 3), P_.fireLt);
    const n = i.w >= 14 ? 2 : 1;
    if (i.h >= 3 && i.w >= 5) {
      for (let k = 0; k < n; k++) {
        const cu = Math.round(i.u + ((k + 0.5) * i.w) / n);
        const r = Math.max(1.5, Math.min(3, i.w / n / 2 - 1));
        P.r(cu - r - 1, i.v + i.h - 1, 2 * r + 2, 1, P_.coal);
        P.r(cu - r, i.v + i.h - 2, 2 * r, 1, P_.goldDk);
        P.r(cu - r + 1, i.v + i.h - 2, 2 * r - 2, 1, P_.gold);
        P.px(cu - 1, i.v + i.h - 2, P_.tomato);
        if (r >= 2.5) P.px(cu + 1, i.v + i.h - 2, P_.tomatoDk);
      }
    }
  } else {
    P.r(i.u, i.v, i.w, i.h, P_.glass);
    for (let k = 0; k < Math.min(i.h, 3); k++) P.px(i.u + 1 + k, i.v + i.h - 1 - k, P_.glassLt);
  }
}

function led(P: Pen, u: number, v: number, on: boolean, color: string = P_.basilLt): void {
  P.px(u, v, on ? color : P_.steelXDk);
}

function deckOven(P: Pen, W: number, H: number, active: boolean, t: number, decks: 1 | 2): void {
  const { top, face } = body(P, 0, 0, W, H, 0.28, STEEL);
  for (let u = top.u + 2; u < top.u + top.w - 2; u += 3) P.r(u, top.v, 2, Math.max(1, top.h - 1), P_.steel);
  const du = face.u + 2;
  const dw = face.w - 4;
  if (decks === 1) {
    ovenDoor(P, du, face.v + 1, dw, face.h - 1, active, t);
  } else {
    const h1 = Math.floor((face.h - 1) / 2);
    ovenDoor(P, du, face.v + 1, dw, h1, active, t);
    P.r(face.u, face.v + 1 + h1, face.w, 1, P_.steelDk);
    ovenDoor(P, du, face.v + 2 + h1, dw, face.h - 2 - h1, active, t + 0.3);
  }
  led(P, face.u + face.w - 1, face.v, active);
}

function conveyorOven(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const w = Math.round(W - 1);
  const h = Math.round(H - 1);
  const tu = Math.max(3, Math.round(w * 0.22));
  const tw = w - 2 * tu;
  const bh = Math.max(3, Math.round(h * 0.22));
  const bv = Math.round(h * 0.5);
  P.r(1, bv + 1, w, bh, P_.shadow);
  P.r(2, bv + bh, 1, h - bv - bh, P_.ink);
  P.r(w - 3, bv + bh, 1, h - bv - bh, P_.ink);
  P.r(0, bv, w, bh, P_.ink);
  P.r(1, bv + 1, w - 2, bh - 2, P_.steelXDk);
  const off = active ? Math.floor(t * 6) % 3 : 0;
  for (let u = 1 + off; u < w - 1; u += 3) P.r(u, bv + 1, 1, bh - 2, P_.steelDk);
  if (active) {
    const span = w + 6;
    for (let k = 0; k < 4; k++) {
      const pu = ((t * 3 + (k * span) / 4) % span) - 3;
      if (pu < tu - 1 || pu > tu + tw + 1) pizza(P, pu, bv + bh / 2 - 0.5, 1.8);
    }
  }
  const { top, face } = body(P, tu, 0, tw + 1, h + 1, 0.3, STEEL);
  for (let u = top.u + 1; u < top.u + top.w - 1; u += 2) P.px(u, top.v, P_.steelDk);
  const sv = face.v + 1;
  P.r(face.u + 1, sv, face.w - 2, 3, P_.ink);
  P.r(face.u + 2, sv + 1, face.w - 4, 1, active ? (Math.floor(t * 8) % 2 ? P_.fireLt : P_.fire) : P_.glass);
  for (let v = sv + 4; v < face.v + face.h - 1; v += 2) P.r(face.u + 2, v, face.w - 4, 1, P_.steelDk);
  led(P, face.u + face.w - 2, face.v + face.h - 1, active);
}

function arch(P: Pen, mu: number, mv: number, mw: number, mh: number, active: boolean, t: number, rim: string): void {
  if (mw < 7 || mh < 4) {
    P.r(mu, mv, mw, mh, P_.ink);
    if (active) fireFill(P, { u: mu + 1, v: mv + 1, w: mw - 2, h: mh - 1 }, t);
    else P.r(mu + 1, mv + 1, mw - 2, mh - 1, P_.coal);
    return;
  }
  P.r(mu + 1, mv - 1, mw - 2, 1, rim);
  P.r(mu, mv, mw, 1, rim);
  P.r(mu + 2, mv, mw - 4, 1, P_.ink);
  P.r(mu + 1, mv + 1, mw - 2, 1, P_.ink);
  P.r(mu, mv + 2, mw, mh - 2, P_.ink);
  P.r(mu - 1, mv + 1, 1, mh - 1, rim);
  P.r(mu + mw, mv + 1, 1, mh - 1, rim);
  P.r(mu + 3, mv + 1, mw - 6, 1, P_.coal);
  P.r(mu + 2, mv + 2, mw - 4, 1, P_.coal);
  const inner: Rect = { u: mu + 1, v: mv + 3, w: mw - 2, h: mh - 3 };
  if (active) {
    P.r(mu + 2, mv + 2, mw - 4, 1, 'rgba(255, 140, 26, 0.5)');
    fireFill(P, inner, t);
  } else {
    P.r(inner.u, inner.v, inner.w, inner.h, P_.coal);
    P.r(inner.u + 1, inner.v + inner.h - 1, inner.w - 2, 1, P_.woodXDk);
    P.px(inner.u + Math.floor(inner.w / 2), inner.v + inner.h - 1, P_.ember);
  }
}

function stoneHearth(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.28, STONE);
  P.r(top.u, top.v + top.h - 1, top.w, 1, P_.stone);
  for (let v = face.v, row = 0; v < face.v + face.h; v += 3, row++) {
    if (v + 2 < face.v + face.h) P.r(face.u, v + 2, face.w, 1, P_.stoneDk);
    for (let u = face.u + (row % 2 ? 2 : 4), i = 0; u < face.u + face.w; u += 5, i++) {
      P.r(u, v, 1, Math.min(2, face.v + face.h - v), P_.stoneDk);
      if (hash(i, row, 11) % 4 === 0) P.r(u + 1, v, Math.min(4, face.u + face.w - u - 1), 1, P_.stoneLt);
    }
  }
  const mw = Math.max(5, Math.min(face.w - 4, Math.round(face.w * 0.55)));
  const mh = Math.max(3, face.h - 1);
  arch(P, face.u + Math.round((face.w - mw) / 2), face.v + face.h - mh, mw, mh, active, t, P_.stoneLt);
}

function woodFired(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const w = Math.round(W - 1);
  const h = Math.round(H - 1);
  const logs = w >= 24;
  const dw = logs ? w - 8 : w;
  const pv = Math.round(h * 0.6);
  P.r(1, pv + 1, dw, h - pv, P_.shadow);
  P.r(0, pv, dw, h - pv, P_.ink);
  for (let v = pv + 1, row = 0; v < h - 1; v += 2, row++) {
    for (let u = 1 - (row % 2 ? 2 : 0), i = 0; u < dw - 1; u += 4, i++) {
      const u0 = Math.max(1, u);
      const uw = Math.min(dw - 1, u + 3) - u0;
      const c = hash(i, row, 5) % 4 === 0 ? P_.brickDk : P_.brick;
      P.r(u0, v, uw, 1, c);
      P.r(u0 + uw, v, 1, 1, P_.mortar);
    }
  }
  const cu = dw / 2;
  const rx = dw / 2 - 1;
  const ry = Math.max(3, pv - 2);
  const topV = pv - ry;
  if (active) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.6 + k / 3) % 1;
      const a = (0.55 * (1 - ph)).toFixed(2);
      P.ell(cu + rx * 0.35 + ph * 2, topV - 2 - ph * 6, 1.5 + ph * 2, 1 + ph * 1.5, `rgba(214, 206, 196, ${a})`);
    }
  }
  P.r(cu + rx * 0.35 - 1.5, topV - 2, 3, 3, P_.ink);
  P.r(cu + rx * 0.35 - 0.5, topV - 1, 1, 2, P_.stoneDk);
  for (let j = -ry; j <= 1; j++) {
    const yy = j < 0 ? (j + 0.5) / ry : 0;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - yy * yy)));
    const v = pv + j;
    P.r(cu - hw - 1, v, hw * 2 + 2, 1, P_.ink);
    if (j === -ry) continue;
    P.r(cu - hw, v, hw * 2, 1, (j + ry) % 3 === 0 ? P_.terraDk : P_.terra);
    if ((j + ry) % 3 !== 0) {
      for (let u = cu - hw + ((j + ry) % 6 < 3 ? 2 : 4); u < cu + hw; u += 4) P.px(u, v, P_.terraDk);
      if (j < -1) P.r(cu - hw, v, Math.max(1, Math.round(hw * 0.35)), 1, P_.terraLt);
    }
  }
  P.r(cu - rx, pv + 1, rx * 2, 1, P_.terraDk);
  const mw = Math.max(5, Math.round(rx * 0.95));
  const mh = Math.max(4, Math.round(ry * 0.75));
  arch(P, Math.round(cu - mw / 2), pv + 2 - mh, mw, mh, active, t, P_.stoneLt);
  if (logs) {
    const lu = w - 7;
    const log = (u: number, v: number): void => {
      P.r(u, v, 4, 4, P_.ink);
      P.r(u + 1, v + 1, 2, 2, P_.woodLt);
      P.px(u + 1, v + 1, P_.woodHi);
    };
    P.r(lu + 1, h - 1, 7, 1, P_.shadow);
    log(lu, h - 5);
    log(lu + 3, h - 5);
    log(lu + 1.5, h - 8);
  }
}

function prepCounter(P: Pen, W: number, H: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.5, STEEL);
  doors(P, face, Math.max(1, Math.round(face.w / 8)));
  const bw = Math.max(4, Math.min(9, Math.floor(top.w * 0.5)));
  const bu = top.u + 1;
  P.r(bu, top.v, bw, top.h, P_.woodDk);
  P.r(bu, top.v, bw, Math.max(1, top.h - 1), P_.woodLt);
  P.r(bu, top.v, bw, 1, P_.woodHi);
  const r = Math.max(1, Math.min(2, top.h / 2 - 0.5));
  P.ell(bu + bw / 2, top.v + top.h / 2, r + 0.6, r * 0.8 + 0.6, P_.creamDk);
  P.ell(bu + bw / 2, top.v + top.h / 2 - 0.3, r, r * 0.8, P_.cream);
  P.px(bu + bw / 2 - 1, top.v + top.h / 2 - 1, P_.white);
  const cu = top.u + bw + 1 + (top.w - bw - 1) / 2;
  if (top.w - bw > 5) {
    P.ell(cu, top.v + top.h / 2, 2.5, 2, P_.steelDk);
    P.ell(cu, top.v + top.h / 2, 1.5, 1, P_.tomato);
  }
}

function marbleBench(P: Pen, W: number, H: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.5, MARBLE_WOOD);
  for (let k = 0; k < Math.max(1, Math.floor(top.w / 8)); k++) {
    const u0 = top.u + 2 + ((hash(k, 3, 9) % Math.max(1, top.w - 4)));
    for (let i = 0; i < top.h; i++) if (u0 + i < top.u + top.w) P.px(u0 + i, top.v + i, P_.marbleVein);
  }
  const balls = Math.max(1, Math.min(3, Math.floor(top.w / 6)));
  for (let i = 0; i < balls; i++) {
    const u = top.u + 3 + i * 4;
    P.ell(u, top.v + top.h / 2 + 0.5, 2, 1.6, P_.goldDk);
    P.ell(u, top.v + top.h / 2, 1.6, 1.3, P_.cream);
    P.px(u - 1, top.v + top.h / 2 - 1, P_.white);
  }
  if (top.w > 14) {
    const u = top.u + top.w - 7;
    P.r(u, top.v + top.h - 2, 5, 1, P_.woodLt);
    P.px(u, top.v + top.h - 2, P_.woodDk);
    P.px(u + 4, top.v + top.h - 2, P_.woodDk);
  }
  const n = Math.max(1, Math.round(face.w / 8));
  const pw = face.w / n;
  for (let i = 0; i < n; i++) {
    const u = Math.round(face.u + i * pw) + 1;
    const w = Math.round(pw) - 2;
    if (face.h > 3 && w > 2) {
      P.r(u, face.v + 1, w, face.h - 2, P_.woodDk);
      P.r(u + 1, face.v + 2, w - 2, face.h - 4, P_.woodLt);
    }
  }
}

function doughSheeter(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.55, STEEL);
  const rh = Math.max(1, Math.min(2, top.h - 2));
  P.r(top.u + 1, top.v, top.w - 2, rh + 1, P_.ink);
  P.r(top.u + 2, top.v, top.w - 4, rh, P_.steelXDk);
  const off = active ? Math.floor(t * 8) % 3 : 1;
  for (let u = top.u + 2 + off; u < top.u + top.w - 2; u += 3) P.px(u, top.v, P_.steelLt);
  P.r(top.u + 2, top.v + rh + 1, top.w - 4, Math.max(1, top.h - rh - 1), P_.cream);
  P.r(top.u + 2, top.v + rh + 1, 1, Math.max(1, top.h - rh - 1), P_.creamDk);
  if (face.h >= 2) {
    P.px(face.u + 1, face.v + 1, P_.tomato);
    P.px(face.u + 3, face.v + 1, P_.basil);
    led(P, face.u + face.w - 2, face.v + 1, active);
    for (let v = face.v + 3; v < face.v + face.h; v += 2) P.r(face.u + 1, v, face.w - 2, 1, P_.steelDk);
  }
}

function heatLampPass(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.6, STEEL);
  const n = Math.max(1, Math.floor(top.w / 6));
  const step = top.w / n;
  const cv = top.v + Math.ceil(top.h / 2) + 0.5;
  if (active) P.r(top.u, top.v + 1, top.w, top.h - 1, 'rgba(255, 140, 40, 0.25)');
  for (let i = 0; i < n; i++) {
    const cu = Math.round(top.u + (i + 0.5) * step);
    P.ell(cu, cv, 3, 2.5, P_.ink);
    P.ell(cu, cv, 2.5, 2, P_.white);
    if (active || i % 2 === 0) pizza(P, cu, cv, 1.5);
  }
  P.r(1, 0, Math.round(W - 3), 1, P_.steelXDk);
  for (let i = 0; i < n; i++) {
    const cu = Math.round(top.u + (i + 0.5) * step);
    P.r(cu - 2, 0, 4, 2, P_.ink);
    P.r(cu - 1, 0, 2, 1, P_.tomatoDk);
    P.r(cu - 1, 1, 2, 1, active ? (Math.floor(t * 4 + i) % 3 ? P_.fireLt : P_.fire) : P_.steelDk);
  }
  for (let v = face.v + 1; v < face.v + face.h; v += 2) P.r(face.u + 1, v, face.w - 2, 1, P_.steelDk);
}

function dishMachine(P: Pen, W: number, H: number, active: boolean, t: number): void {
  const { face } = body(P, 0, 0, W, H, 0.22, STEEL);
  if (active) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.7 + k / 3) % 1;
      const a = (0.6 * (1 - ph)).toFixed(2);
      P.ell(W / 2 - 3 + k * 3, -ph * 6, 1.5 + ph * 1.5, 1 + ph, `rgba(255, 255, 255, ${a})`);
    }
  }
  P.r(face.u, face.v, face.w, 2, P_.steelXDk);
  led(P, face.u + face.w - 2, face.v, active);
  led(P, face.u + face.w - 4, face.v, active, P_.waterLt);
  P.r(face.u + 1, face.v + 2, face.w - 2, 1, P_.steelLt);
  for (let v = face.v + 4; v < face.v + face.h; v += 2) P.r(face.u + 2, v, face.w - 4, 1, P_.steelDk);
}

function provingCabinet(P: Pen, W: number, H: number, active: boolean): void {
  const { face } = body(P, 0, 0, W, H, 0.18, STEEL);
  const g: Rect = { u: face.u + 1, v: face.v, w: face.w - 3, h: face.h };
  P.r(g.u, g.v, g.w, g.h, P_.ink);
  const i: Rect = { u: g.u + 1, v: g.v + 1, w: g.w - 2, h: g.h - 2 };
  P.r(i.u, i.v, i.w, i.h, P_.glass);
  for (let v = i.v + 2; v < i.v + i.h; v += 3) {
    P.r(i.u, v, i.w, 1, P_.steelDk);
    for (let u = i.u + 1; u + 1 < i.u + i.w; u += 3) P.r(u, v - 1, 2, 1, P_.cream);
  }
  if (active) P.r(i.u, i.v, i.w, i.h, 'rgba(255, 170, 70, 0.3)');
  P.r(face.u + face.w - 2, face.v + 1, 1, Math.max(1, face.h - 2), P_.steelLt);
  led(P, face.u + face.w - 1, face.v, active, P_.goldLt);
}

function prepFridge(P: Pen, W: number, H: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.5, MARBLE_STEEL);
  const bh = Math.max(2, Math.floor(top.h * 0.6));
  P.r(top.u, top.v, top.w, bh + 1, P_.steelXDk);
  const fills = [P_.tomato, P_.white, P_.basilLt, P_.tomatoDk, P_.stoneLt, P_.goldLt];
  const n = Math.max(1, Math.floor((top.w - 1) / 4));
  for (let i = 0; i < n; i++) {
    const u = top.u + 1 + i * 4;
    const c = pick(fills, i);
    P.r(u, top.v + 1, 3, bh - 1, c);
    P.px(u, top.v + 1, shade(c, 1.4));
    if (bh > 2) P.px(u + 2, top.v + bh - 1, shade(c, 0.7));
  }
  if (top.h - bh > 1) P.px(top.u + top.w - 4, top.v + bh + 1, P_.marbleVein);
  doors(P, face, Math.max(1, Math.round(face.w / 8)));
}

function sink(P: Pen, W: number, H: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.5, STEEL);
  const bw = Math.max(4, Math.min(10, Math.floor(top.w * 0.55)));
  const bu = top.u + 1;
  P.r(bu, top.v, bw, top.h, P_.ink);
  P.r(bu + 1, top.v + 1, bw - 2, Math.max(1, top.h - 2), P_.steelDk);
  P.r(bu + 1, top.v + top.h - 2, bw - 2, 1, P_.water);
  P.px(bu + 2, top.v + top.h - 2, P_.waterLt);
  const tu = bu + Math.floor(bw / 2);
  P.r(tu - 1, top.v - 2, 3, 2, P_.ink);
  P.r(tu, top.v - 1, 1, 1, P_.steelLt);
  P.r(tu - 1, top.v, 3, 1, P_.ink);
  P.px(tu, top.v, P_.steelLt);
  for (let u = bu + bw + 1; u < top.u + top.w - 1; u += 2) P.r(u, top.v, 1, top.h, P_.steel);
  doors(P, face, Math.max(1, Math.round(face.w / 8)));
}

function fridge(P: Pen, W: number, H: number): void {
  const { top, face } = body(P, 0, 0, W, H, 0.16, STEEL);
  for (let u = top.u + 1; u < top.u + top.w - 1; u += 2) P.px(u, top.v, P_.steelDk);
  const mid = Math.round(face.u + face.w / 2);
  P.r(mid, face.v, 1, face.h, P_.steelDk);
  const hl = Math.max(1, Math.min(6, face.h - 3));
  P.r(mid - 2, face.v + 2, 1, hl, P_.ink);
  P.r(mid + 2, face.v + 2, 1, hl, P_.ink);
  P.r(mid - 3, face.v + 2, 1, hl, P_.steelLt);
  P.r(mid + 3, face.v + 2, 1, hl, P_.steelLt);
  if (face.w >= 10 && face.h >= 5) {
    P.r(face.u + 1, face.v + 1, 3, 3, P_.cream);
    P.px(face.u + 2, face.v + 1, P_.tomato);
  }
  led(P, face.u + face.w - 2, face.v + face.h - 1, true, P_.waterLt);
}

/**
 * Kitchen equipment, x/y/w/h in screen px, tile for scale. `active` is true while service runs:
 * ovens glow, flames and belts move with `t` (seconds), the pass lamps light up, the dish machine steams.
 */
export function drawEquipment(g: CanvasRenderingContext2D, itemId: string, x: number, y: number, w: number, h: number, tile: number, active: boolean, t = 0): void {
  const p = tile / PIXEL;
  const P = pen(g, x, y, p);
  const W = w / p;
  const H = h / p;
  switch (itemId) {
    case 'deckOven': return deckOven(P, W, H, active, t, 1);
    case 'doubleDeckOven': return deckOven(P, W, H, active, t, 2);
    case 'conveyorOven': return conveyorOven(P, W, H, active, t);
    case 'stoneHearthOven': return stoneHearth(P, W, H, active, t);
    case 'woodFiredOven': return woodFired(P, W, H, active, t);
    case 'prepCounter': return prepCounter(P, W, H);
    case 'marbleBench': return marbleBench(P, W, H);
    case 'doughSheeter': return doughSheeter(P, W, H, active, t);
    case 'heatLampPass': return heatLampPass(P, W, H, active, t);
    case 'dishMachine': return dishMachine(P, W, H, active, t);
    case 'provingCabinet': return provingCabinet(P, W, H, active);
    case 'prepFridge': return prepFridge(P, W, H);
    case 'sink': case 'doubleSink': case 'handWash': return sink(P, W, H);
    case 'fridge': case 'reachInFridge': case 'walkInCooler': return fridge(P, W, H);
    default: return crate(P, W, H);
  }
}

// ---------------------------------------------------------------------------------------------
// People. 16 x 16 character maps drawn front facing in 3/4 view.
// k ink, h hair, s skin, S skin shade, c shirt, C shirt shade, w white, W white shade, p pants,
// b shoes, r red, y gold, a apron, A apron shade.

const HEAD_FRONT = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....kskssksk....',
  '....kssssssk....',
  '.....kSSSSk.....',
];
const HEAD_BACK = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....kShhhhSk....',
  '.....kSSSSk.....',
];
const TORSO = [
  '...kcccccccck...',
  '..kcccccccccck..',
  '..kCccccccccCk..',
  '..kCccccccccCk..',
  '..ksCccccccCsk..',
];
const LEGS: readonly (readonly string[])[] = [
  ['...kppppppppk...', '....kppkkppk....', '....kppkkppk....', '....kbbkkbbk....'],
  ['...kppppppppk...', '....kppkkppk....', '....kbbkkppk....', '........kbbk....'],
  ['...kppppppppk...', '....kppkkppk....', '....kppkkbbk....', '....kbbk........'],
];
const SEATED_BASE = '...kCCCCCCCCk...';

interface FigureOpts {
  /** Show the back of the head (guest seen from behind, for chairs below a table). */
  back?: boolean;
  /** Animate the legs with t. */
  walking?: boolean;
  /** Varies hair, skin and trousers for guests. */
  variant?: number;
}

function figure(g: CanvasRenderingContext2D, x: number, y: number, size: number, head: readonly string[], torso: readonly string[], colors: Record<string, string>, seated: boolean, t: number, opts: FigureOpts, above: readonly string[] = []): Pen {
  const P = pen(g, x - size / 2, y - size / 2, size / PIXEL);
  if (seated) {
    drawMap(P, [...above, ...head, ...torso, SEATED_BASE], 0, 2 - above.length, colors);
    return P;
  }
  P.ell(8, 15.5, 5, 1, P_.shadow);
  const frame = opts.walking ? [0, 1, 0, 2][Math.floor(t * 6) % 4] ?? 0 : 0;
  const legs = LEGS[frame] ?? LEGS[0] ?? [];
  drawMap(P, [...above, ...head, ...torso, ...legs], 0, -above.length, colors);
  return P;
}

function baseColors(hair: string, skin: string, shirt: string, pants: string): Record<string, string> {
  return {
    k: P_.ink, h: hair, s: skin, S: shade(skin, 0.82), c: shirt, C: shade(shirt, 0.74),
    w: P_.white, W: P_.whiteShade, p: pants, b: P_.woodXDk, r: P_.tomato, y: P_.gold,
    a: P_.cream, A: P_.creamDk,
  };
}

/**
 * A guest. (x, y) is the centre of a size x size box; `color` is the shirt colour (customer segment).
 * Seated guests show head and shoulders, placed so they read over a chair. Optional opts vary the look.
 */
export function drawGuest(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, seated: boolean, t = 0, opts: FigureOpts = {}): void {
  const v = Math.abs(Math.floor(opts.variant ?? 0));
  const colors = baseColors(pick(P_.hair, v), pick(P_.skin, Math.floor(v / 3) + v), color, pick(P_.pants, v >> 1));
  figure(g, x, y, size, opts.back ? HEAD_BACK : HEAD_FRONT, TORSO, colors, seated, t, opts);
}

export type StaffRole = 'cook' | 'chef' | 'server' | 'host' | 'dishwasher';

const WHITE_TORSO = [
  '...kcccccccck...',
  '..kcccccccccck..',
  '..kCcckcckccCk..',
  '..kCcckcckccCk..',
  '..ksCccccccCsk..',
];

/** A member of staff in role uniform. (x, y) is the centre of a size x size box. */
export function drawStaff(g: CanvasRenderingContext2D, role: StaffRole, x: number, y: number, size: number, t = 0, opts: FigureOpts = {}): void {
  const skin = pick(P_.skin, opts.variant ?? (role.length + 1));
  const hair = pick(P_.hair, opts.variant ?? role.length);
  const head = [...(opts.back ? HEAD_BACK : HEAD_FRONT)];
  switch (role) {
    case 'cook': {
      const c = baseColors(hair, skin, P_.white, '#3a3a44');
      c.C = P_.whiteShade;
      head[1] = '....kwwwwwwk....';
      head[2] = '....kWWWWWWk....';
      figure(g, x, y, size, head, WHITE_TORSO, c, false, t, opts);
      return;
    }
    case 'chef': {
      const c = baseColors(hair, skin, P_.white, '#2f2f3a');
      c.C = P_.whiteShade;
      head[0] = '....kwwwwwwk....';
      head[1] = '....kWWWWWWk....';
      const torso = ['...kcccrrccck...', ...WHITE_TORSO.slice(1)];
      const toque = ['....kkkkkkkk....', '...kwwwwwwwwk...', '...kwwwwwwwWk...', '...kwWwwwwwWk...'];
      figure(g, x, y, size, head, torso, c, false, t, opts, toque);
      return;
    }
    case 'server': {
      const c = baseColors(hair, skin, '#2b2b33', '#23202a');
      const torso = ['...kwccrrccwk...', '..kwwccccccwwk..', '..kWwccccccwWk..', '..kWwccccccwWk..', '..ksWccccccWsk..'];
      const P = figure(g, x, y, size, head, torso, c, false, t, opts);
      P.r(10, 6, 6, 1, P_.ink);
      P.r(11, 5, 4, 1, P_.steelLt);
      pizza(P, 13, 4, 1.6);
      return;
    }
    case 'host': {
      const c = baseColors(hair, skin, '#7a2230', '#3b1520');
      const torso = ['...kccwyywcck...', '..kcccwwwwccck..', '..kCcccwwcccCk..', '..kCccccccccCk..', '..ksCccccccCsk..'];
      const P = figure(g, x, y, size, head, torso, c, false, t, opts);
      P.r(0, 9, 4, 5, P_.ink);
      P.r(1, 10, 2, 3, P_.leather);
      P.px(1, 10, P_.gold);
      return;
    }
    case 'dishwasher': {
      const c = baseColors(hair, skin, '#4f7fb0', '#3b4a6b');
      c.a = '#c9d3d8';
      head[1] = '....krrrrrrk....';
      const torso = ['...kcccccccck...', '..kcccccccccck..', '..kCcaaaaaacCk..', '..kCcaaaaaacCk..', '..kyCaaaaaaCyk..'];
      figure(g, x, y, size, head, torso, c, false, t, opts);
      return;
    }
  }
}
