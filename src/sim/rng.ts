/** Seeded PRNG (mulberry32). Each subsystem derives its own stream so random calls never shift each other. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  static stream(seed: number, day: number, name: string): Rng {
    let h = (seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x85ebca6b) >>> 0;
    return new Rng(h);
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('pick from empty list');
    return item;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Approximately normal, mean 0, sd 1. */
  normal(): number {
    return this.next() + this.next() + this.next() + this.next() - 2;
  }
}
