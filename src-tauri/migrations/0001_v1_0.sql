PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  context_points_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('open','done','dropped')),
  domain TEXT NOT NULL CHECK (domain IN ('work','study','creation','project','life','health','relationship','reading','leisure','other')),
  planned_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  dropped_at TEXT
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created','scheduled','rescheduled','completed','restored','dropped')),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  from_date TEXT,
  to_date TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS task_events_task_time ON task_events(task_id, occurred_at);
CREATE INDEX IF NOT EXISTS task_events_local_date ON task_events(local_date);

CREATE TABLE IF NOT EXISTS daily_focus (
  date TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sparks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('inbox','organized','settled','archived')),
  created_at TEXT NOT NULL,
  processed_at TEXT,
  settled_at TEXT,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS spark_analysis (
  id TEXT PRIMARY KEY,
  spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  type TEXT NOT NULL CHECK (type IN ('book','article','paper','other')),
  status TEXT NOT NULL CHECK (status IN ('want','reading','finished','paused','dropped')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  cover_provider TEXT,
  cover_external_id TEXT,
  cover_url TEXT,
  cover_matched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_events (
  id TEXT PRIMARY KEY,
  reading_item_id TEXT NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('added','started','finished','paused','resumed','dropped','restarted','preference_changed')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reading_events_local_date ON reading_events(local_date);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
  title TEXT NOT NULL,
  original_title TEXT,
  release_date TEXT,
  release_year INTEGER,
  poster_path TEXT,
  genre_ids_json TEXT NOT NULL DEFAULT '[]',
  original_language TEXT,
  status TEXT NOT NULL CHECK (status IN ('want','watching','finished','paused','dropped')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_events (
  id TEXT PRIMARY KEY,
  media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('added','started','finished','paused','resumed','dropped','restarted','preference_changed')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS media_events_local_date ON media_events(local_date);

CREATE TABLE IF NOT EXISTS period_snapshots (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly','yearly')),
  period_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  revision INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  facts_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_id TEXT REFERENCES period_snapshots(id),
  UNIQUE(period_type, period_key, revision)
);

CREATE TABLE IF NOT EXISTS ai_reviews (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES period_snapshots(id),
  review_type TEXT NOT NULL CHECK (review_type IN ('weekly','monthly','yearly')),
  revision INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  UNIQUE(snapshot_id, revision)
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
  id TEXT PRIMARY KEY,
  evidence_end TEXT NOT NULL,
  revision INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  UNIQUE(evidence_end, revision)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spark_links (
  id TEXT PRIMARY KEY,
  spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('task','reading','media')),
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(target_type, target_id)
);

INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES (1,'open_ends_v1_0_schema',CURRENT_TIMESTAMP);
