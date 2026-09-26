// Pizza D Worker: serves the game (static assets) and the cloud save API (ADR-005, ADR-007).

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const MAX_SAVE_BYTES = 2_000_000;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const SLOT_RE = /^[a-z0-9-]{1,32}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode(length = 6): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function issueToken(env: Env, playerId: string): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO tokens (token_hash, player_id, created_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), playerId, Date.now())
    .run();
  return token;
}

async function authenticate(request: Request, env: Env): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length < 32) return null;
  const row = await env.DB.prepare('SELECT player_id FROM tokens WHERE token_hash = ?').bind(await sha256(token)).first<{ player_id: string }>();
  return row?.player_id ?? null;
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  // Create an anonymous player for this device.
  if (path === '/api/players' && request.method === 'POST') {
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO players (id, created_at) VALUES (?, ?)').bind(id, Date.now()).run();
    return json({ playerId: id, token: await issueToken(env, id) }, 201);
  }

  // Claim a link code on a second device.
  if (path === '/api/link/claim' && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    const code = (body?.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const row = await env.DB.prepare('SELECT player_id, expires_at FROM link_codes WHERE code = ?').bind(code).first<{ player_id: string; expires_at: number }>();
    if (!row || row.expires_at < Date.now()) return json({ error: 'That code is not valid any more.' }, 404);
    await env.DB.prepare('DELETE FROM link_codes WHERE code = ?').bind(code).run();
    return json({ playerId: row.player_id, token: await issueToken(env, row.player_id) });
  }

  const playerId = await authenticate(request, env);
  if (!playerId) return json({ error: 'Not signed in.' }, 401);

  if (path === '/api/link' && request.method === 'POST') {
    await env.DB.prepare('DELETE FROM link_codes WHERE player_id = ? OR expires_at < ?').bind(playerId, Date.now()).run();
    const code = randomCode();
    const expiresAt = Date.now() + LINK_CODE_TTL_MS;
    await env.DB.prepare('INSERT INTO link_codes (code, player_id, expires_at) VALUES (?, ?, ?)').bind(code, playerId, expiresAt).run();
    return json({ code, expiresAt });
  }

  if (path === '/api/saves' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT slot, revision, updated_at, summary FROM saves WHERE player_id = ?').bind(playerId).all();
    return json({ saves: results });
  }

  const m = path.match(/^\/api\/saves\/([^/]+)$/);
  if (m) {
    const slot = decodeURIComponent(m[1] ?? '');
    if (!SLOT_RE.test(slot)) return json({ error: 'Bad slot.' }, 400);

    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT revision, updated_at, summary, blob FROM saves WHERE player_id = ? AND slot = ?')
        .bind(playerId, slot)
        .first<{ revision: number; updated_at: number; summary: string; blob: string }>();
      if (!row) return json({ save: null });
      return json({ revision: row.revision, updatedAt: row.updated_at, summary: JSON.parse(row.summary), blob: row.blob });
    }

    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_SAVE_BYTES) return json({ error: 'Save too large.' }, 413);
      const body = JSON.parse(text) as { baseRevision?: number; summary?: unknown; blob?: string };
      if (typeof body.blob !== 'string' || typeof body.baseRevision !== 'number') return json({ error: 'Bad save.' }, 400);
      const current = await env.DB.prepare('SELECT revision, updated_at, summary FROM saves WHERE player_id = ? AND slot = ?')
        .bind(playerId, slot)
        .first<{ revision: number; updated_at: number; summary: string }>();
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== body.baseRevision) {
        return json({ error: 'conflict', revision: currentRevision, updatedAt: current?.updated_at, summary: current ? JSON.parse(current.summary) : null }, 409);
      }
      const revision = currentRevision + 1;
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO saves (player_id, slot, revision, updated_at, summary, blob) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (player_id, slot) DO UPDATE SET revision = excluded.revision, updated_at = excluded.updated_at,
         summary = excluded.summary, blob = excluded.blob WHERE saves.revision = ?`,
      )
        .bind(playerId, slot, revision, now, JSON.stringify(body.summary ?? {}), body.blob, currentRevision)
        .run();
      return json({ revision, updatedAt: now });
    }
  }

  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: 'Server error.' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
