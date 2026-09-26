// Local first save with background cloud sync and explicit conflict choice (ADR-005).

import type { GameState } from '../sim/state';
import { cloud, type RemoteSave } from './cloud';
import { localStore } from './localStore';
import { deserialise, serialise, summarise, type SaveSummary } from './saveFile';

export type CloudStatus = 'offline' | 'syncing' | 'synced' | 'pending' | 'conflict';

export interface Conflict {
  local: SaveSummary;
  remote: RemoteSave;
}

export class SaveManager {
  status: CloudStatus = 'offline';
  conflict: Conflict | null = null;
  private listeners = new Set<() => void>();
  private pushing = false;

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(status?: CloudStatus): void {
    if (status) this.status = status;
    for (const fn of this.listeners) fn();
  }

  loadLocal(): GameState | null {
    const text = localStore.loadSave();
    if (!text) return null;
    try {
      return deserialise(text).state;
    } catch (err) {
      console.error('Local save unreadable', err);
      return null;
    }
  }

  saveLocal(state: GameState): void {
    localStore.writeSave(serialise(state, Date.now()));
    localStore.setMeta({ ...localStore.meta(), dirty: true });
    if (this.status === 'synced') this.emit('pending');
  }

  /** Ensures a cloud identity; returns false when the API is not reachable (for example plain `vite dev`). */
  async connect(): Promise<boolean> {
    if (localStore.identity()) return true;
    try {
      localStore.setIdentity(await cloud.createPlayer());
      localStore.setMeta({ baseRevision: 0, dirty: true });
      return true;
    } catch {
      this.emit('offline');
      return false;
    }
  }

  /**
   * On start: decide between the local save and the cloud save.
   * Returns the state to play, or null to keep the local one. May raise a conflict for the player to resolve.
   */
  async reconcile(local: GameState | null): Promise<GameState | null> {
    const id = localStore.identity();
    if (!id) return null;
    this.emit('syncing');
    try {
      const remote = await cloud.pull(id);
      const meta = localStore.meta();
      if (!remote) {
        if (local) await this.push(local);
        else this.emit('synced');
        return null;
      }
      if (remote.revision === meta.baseRevision) {
        if (local && meta.dirty) await this.push(local);
        else this.emit('synced');
        return null;
      }
      // The cloud moved on (another device played).
      if (!local || !meta.dirty) {
        this.adoptRemote(remote);
        this.emit('synced');
        return deserialise(remote.blob).state;
      }
      this.conflict = { local: summarise(local, Date.now()), remote };
      this.emit('conflict');
      return null;
    } catch {
      this.emit('offline');
      return null;
    }
  }

  async push(state: GameState): Promise<void> {
    const id = localStore.identity();
    if (!id || this.pushing || this.conflict) return;
    this.pushing = true;
    this.emit('syncing');
    try {
      const meta = localStore.meta();
      const savedAt = Date.now();
      const result = await cloud.push(id, meta.baseRevision, summarise(state, savedAt), serialise(state, savedAt));
      if (result.ok) {
        localStore.setMeta({ baseRevision: result.revision, dirty: false });
        this.emit('synced');
      } else if (result.conflict) {
        const remote = await cloud.pull(id);
        if (remote) {
          this.conflict = { local: summarise(state, savedAt), remote };
          this.emit('conflict');
        }
      } else {
        this.emit('pending');
      }
    } catch {
      this.emit('offline');
    } finally {
      this.pushing = false;
    }
  }

  private adoptRemote(remote: RemoteSave): void {
    localStore.writeSave(remote.blob);
    localStore.setMeta({ baseRevision: remote.revision, dirty: false });
  }

  /** Player chose which save to keep. Returns the state to continue with. */
  async resolve(keep: 'local' | 'remote', local: GameState): Promise<GameState> {
    const c = this.conflict;
    this.conflict = null;
    if (!c) return local;
    if (keep === 'remote') {
      this.adoptRemote(c.remote);
      this.emit('synced');
      return deserialise(c.remote.blob).state;
    }
    localStore.setMeta({ baseRevision: c.remote.revision, dirty: true });
    await this.push(local);
    return local;
  }

  async linkCode(): Promise<{ code: string; expiresAt: number }> {
    const id = localStore.identity();
    if (!id) throw new Error('Cloud saves are not available right now.');
    return cloud.createLinkCode(id);
  }

  /** Joins another device's player; the next reconcile pulls that save. */
  async claim(code: string): Promise<void> {
    localStore.setIdentity(await cloud.claimLinkCode(code));
    localStore.setMeta({ baseRevision: 0, dirty: false });
  }
}
