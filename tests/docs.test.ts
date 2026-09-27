// The docs quote tunables; this keeps the quoted start values in step with src/data/tunables.ts (cleanup sprint 3).

import { expect, test } from 'vitest';
import { T } from '../src/data/tunables';
import competition from '../01-product/competition.md?raw';

/** Rows of a "| Tunable (`T.group`) | Unit | Start | Safe range |" table: name and the first number of Start. */
function tunableTables(md: string): { group: string; name: string; start: number }[] {
  const out: { group: string; name: string; start: number }[] = [];
  let group: string | null = null;
  for (const line of md.split('\n')) {
    const head = line.match(/^\| Tunable \(`T\.(\w+)`\)/);
    if (head) {
      group = head[1] ?? null;
      continue;
    }
    if (!line.startsWith('|')) {
      group = null;
      continue;
    }
    if (!group || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const name = cells[1] ?? '';
    const start = (cells[3] ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    // Only single name rows ("a / b" rows list several tunables in one cell).
    if (!/^\w+$/.test(name) || !start) continue;
    out.push({ group, name, start: Number(start[0]) });
  }
  return out;
}

test('every single tunable quoted in competition.md matches the game', () => {
  const rows = tunableTables(competition);
  const groups = T as unknown as Record<string, Record<string, unknown>>;
  const checked = rows.filter((r) => typeof groups[r.group]?.[r.name] === 'number');
  expect(checked.length).toBeGreaterThan(8);
  const wrong = checked.filter((r) => Math.abs((groups[r.group]?.[r.name] as number) - r.start) > 1e-9).map((r) => `T.${r.group}.${r.name}: doc ${r.start}, game ${groups[r.group]?.[r.name]}`);
  expect(wrong).toEqual([]);
});
