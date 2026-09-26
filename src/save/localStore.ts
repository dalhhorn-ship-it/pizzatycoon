// Local first storage (ADR-005). localStorage in M0; IndexedDB in v0.1.

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
const KEY_ID = 'pizzad:cloud:identity';
const KEY_META = 'pizzad:cloud:meta';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be full or blocked (private mode); the cloud copy is the backup.
  }
}

export const localStore = {
  loadSave: (): string | null => get(KEY_SAVE),
  writeSave: (text: string): void => set(KEY_SAVE, text),
  clearSave: (): void => set(KEY_SAVE, null),
  identity(): CloudIdentity | null {
    const raw = get(KEY_ID);
    return raw ? (JSON.parse(raw) as CloudIdentity) : null;
  },
  setIdentity: (id: CloudIdentity | null): void => set(KEY_ID, id ? JSON.stringify(id) : null),
  meta(): SyncMeta {
    const raw = get(KEY_META);
    return raw ? (JSON.parse(raw) as SyncMeta) : { baseRevision: 0, dirty: true };
  },
  setMeta: (m: SyncMeta): void => set(KEY_META, JSON.stringify(m)),
  async requestPersistence(): Promise<void> {
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Not supported everywhere; harmless.
    }
  },
};
