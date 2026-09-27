// The two Node functions vite.config.ts uses, so the project needs no @types/node (the game itself runs in browsers).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:path' {
  export function resolve(...parts: string[]): string;
}
