// Cloud save client for the Worker API (worker/src/index.ts).

import type { CloudIdentity } from './localStore';
import type { SaveSummary } from './saveFile';

export const SLOT = 'auto';

export interface RemoteSave {
  revision: number;
  updatedAt: number;
  summary: SaveSummary;
  blob: string;
}

export type PushResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: true; revision: number; summary: SaveSummary | null }
  | { ok: false; conflict: false; error: string };

async function call(path: string, init: RequestInit, id?: CloudIdentity): Promise<Response> {
  const headers = new Headers(init.headers);
  if (id) headers.set('authorization', `Bearer ${id.token}`);
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(path, { ...init, headers });
}

export const cloud = {
  async createPlayer(): Promise<CloudIdentity> {
    const res = await call('/api/players', { method: 'POST' });
    if (!res.ok) throw new Error(`Cloud unavailable (${res.status})`);
    return (await res.json()) as CloudIdentity;
  },

  async pull(id: CloudIdentity): Promise<RemoteSave | null> {
    const res = await call(`/api/saves/${SLOT}`, { method: 'GET' }, id);
    if (!res.ok) throw new Error(`Cloud unavailable (${res.status})`);
    const body = (await res.json()) as RemoteSave | { save: null };
    return 'save' in body ? null : body;
  },

  async push(id: CloudIdentity, baseRevision: number, summary: SaveSummary, blob: string): Promise<PushResult> {
    const res = await call(`/api/saves/${SLOT}`, { method: 'PUT', body: JSON.stringify({ baseRevision, summary, blob }) }, id);
    if (res.status === 409) {
      const body = (await res.json()) as { revision: number; summary: SaveSummary | null };
      return { ok: false, conflict: true, revision: body.revision, summary: body.summary };
    }
    if (!res.ok) return { ok: false, conflict: false, error: `Cloud unavailable (${res.status})` };
    const body = (await res.json()) as { revision: number };
    return { ok: true, revision: body.revision };
  },

  async createLinkCode(id: CloudIdentity): Promise<{ code: string; expiresAt: number }> {
    const res = await call('/api/link', { method: 'POST' }, id);
    if (!res.ok) throw new Error('Could not create a link code.');
    return (await res.json()) as { code: string; expiresAt: number };
  },

  async claimLinkCode(code: string): Promise<CloudIdentity> {
    const res = await call('/api/link/claim', { method: 'POST', body: JSON.stringify({ code }) });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Code not valid.');
    return (await res.json()) as CloudIdentity;
  },
};
