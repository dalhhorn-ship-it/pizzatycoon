// Local first storage (ADR-005): localStorage with a previous save slot. IndexedDB is planned.

export interface CloudIdentity {
  playerId: string;
  token: string;
}

export interface SyncMeta {
  /** Cloud revision this local save was built on. */
  baseRevision: number;
  /** True when the local save has changes the cloud has not seen. */
  dirty: boolean;
}

const KEY_SAVE = 'pizzad:save:auto';
/** The save before the last one: a fallback when the latest cannot be read (solution-design.md 8). */
const KEY_PREV = 'pizzad:save:prev';
const KEY_ID = 'pizzad:cloud:identity';
const KEY_META = 'pizzad:cloud:meta';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the browser refused the write (storage full or blocked, for example in private mode). */
function set(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const localStore = {
  loadSave: (): string | null => get(KEY_SAVE),
  loadPrevious: (): string | null => get(KEY_PREV),
  /** Keeps the current save as the previous one, then writes. False when the browser refused the write. */
  writeSave(text: string): boolean {
    const current = get(KEY_SAVE);
    if (current && current !== text) set(KEY_PREV, current);
    if (set(KEY_SAVE, text)) return true;
    // Make room: drop the previous copy and try once more.
    set(KEY_PREV, null);
    return set(KEY_SAVE, text);
  },
  clearSave: (): void => {
    set(KEY_SAVE, null);
    set(KEY_PREV, null);
  },
  identity(): CloudIdentity | null {
    const raw = get(KEY_ID);
    return raw ? (JSON.parse(raw) as CloudIdentity) : null;
  },
  setIdentity: (id: CloudIdentity | null): void => {
    set(KEY_ID, id ? JSON.stringify(id) : null);
  },
  meta(): SyncMeta {
    const raw = get(KEY_META);
    return raw ? (JSON.parse(raw) as SyncMeta) : { baseRevision: 0, dirty: true };
  },
  setMeta: (m: SyncMeta): void => {
    set(KEY_META, JSON.stringify(m));
  },
  async requestPersistence(): Promise<void> {
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Not supported everywhere; harmless.
    }
  },
};
