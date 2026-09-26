-- Pizza D cloud saves (ADR-005). Anonymous players; only token hashes are stored.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE link_codes (
  code TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE saves (
  player_id TEXT NOT NULL REFERENCES players(id),
  slot TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  summary TEXT NOT NULL,
  blob TEXT NOT NULL,
  PRIMARY KEY (player_id, slot)
);
