CREATE TABLE IF NOT EXISTS sync_locks (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_locks_expires
  ON sync_locks (expires_at);
