// Holds the current game, applies commands, autosaves and syncs (solution-design.md 4).

import { apply, type Command, type GameEvent, newGame } from '../sim/game';
import type { GameState } from '../sim/state';
import { SaveManager } from '../save/sync';

type Listener = (state: GameState, events: GameEvent[]) => void;

export class Controller {
  state: GameState | null = null;
  readonly saves = new SaveManager();
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private publish(events: GameEvent[]): void {
    if (!this.state) return;
    for (const fn of this.listeners) fn(this.state, events);
  }

  async boot(): Promise<void> {
    this.state = this.saves.loadLocal();
    const online = await this.saves.connect();
    if (online) {
      const fromCloud = await this.saves.reconcile(this.state);
      if (fromCloud) this.state = fromCloud;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
    });
    window.addEventListener('pagehide', () => this.saveNow());
    window.addEventListener('online', () => this.state && void this.saves.push(this.state));
  }

  start(seed: number, districtId: string, premisesId: string): void {
    this.state = newGame(seed, districtId, premisesId);
    this.saveNow(true);
    this.publish([{ kind: 'info', text: 'Welcome to your first pizzeria!' }]);
  }

  load(state: GameState): void {
    this.state = state;
    this.saveNow(true);
    this.publish([]);
  }

  /** Returns an error message, or null on success. */
  dispatch(cmd: Command): string | null {
    if (!this.state) return 'No game loaded.';
    const result = apply(this.state, cmd);
    if (result.error) return result.error;
    this.state = result.state;
    if (cmd.type === 'runDay' || cmd.type === 'freshStart') this.saveNow(true);
    else this.scheduleSave();
    this.publish(result.events);
    return null;
  }

  async resolveConflict(keep: 'local' | 'remote'): Promise<void> {
    if (!this.state) return;
    this.state = await this.saves.resolve(keep, this.state);
    this.publish([]);
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(false), 1500);
  }

  saveNow(push = true): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.state) return;
    this.saves.saveLocal(this.state);
    if (push && navigator.onLine) void this.saves.push(this.state);
  }
}
