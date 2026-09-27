// No runtime import cycles in the simulation (TD5): a module in a cycle can see another's exports as undefined at load.

import { expect, test } from 'vitest';

const sources = import.meta.glob('../src/{sim,data}/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Resolve a relative import against a module path from the glob (which starts with ../). */
function resolve(dir: string, rel: string): string {
  const norm: string[] = [];
  for (const p of `${dir}/${rel}`.split('/')) {
    if (p === '.') continue;
    if (p === '..' && norm.length && norm[norm.length - 1] !== '..') norm.pop();
    else norm.push(p);
  }
  return `${norm.join('/')}.ts`;
}

/** Runtime imports of a module: `import type` and imports of types only are left out. */
function runtimeImports(file: string, code: string): string[] {
  const out: string[] = [];
  const dir = file.slice(0, file.lastIndexOf('/'));
  for (const m of code.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+'(\.[^']+)';/gm)) {
    if (m[1]) continue;
    const names = m[2] ?? '';
    const braces = names.match(/^\{([\s\S]*)\}$/);
    if (braces && braces[1]?.split(',').map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith('type '))) continue;
    out.push(resolve(dir, m[3] ?? ''));
  }
  for (const m of code.matchAll(/^export\s+\{[^}]*\}\s+from\s+'(\.[^']+)';/gm)) {
    out.push(resolve(dir, m[1] ?? ''));
  }
  return out;
}

test('the simulation and data modules have no runtime import cycles', () => {
  const graph = new Map(Object.entries(sources).map(([f, code]) => [f, runtimeImports(f, code).filter((d) => d in sources)]));
  const cycles: string[] = [];
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (f: string): void => {
    state.set(f, 'open');
    stack.push(f);
    for (const d of graph.get(f) ?? []) {
      if (state.get(d) === 'open') cycles.push([...stack.slice(stack.indexOf(d)), d].map((x) => x.split('/').pop()).join(' > '));
      else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(f, 'done');
  };
  for (const f of graph.keys()) if (!state.has(f)) visit(f);
  expect(graph.size).toBeGreaterThan(20);
  expect([...graph.values()].flat().length).toBeGreaterThan(40);
  expect(cycles).toEqual([]);
});
