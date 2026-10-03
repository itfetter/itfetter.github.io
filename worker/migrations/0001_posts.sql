CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  permalink TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_published ON posts(published_at DESC);
