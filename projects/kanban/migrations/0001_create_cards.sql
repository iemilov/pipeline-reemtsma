CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  column_id TEXT NOT NULL DEFAULT 'backlog',
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
