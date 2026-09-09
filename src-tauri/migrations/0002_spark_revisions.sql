PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS spark_revisions (
  id TEXT PRIMARY KEY,
  spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(spark_id, revision)
);

ALTER TABLE spark_analysis ADD COLUMN spark_revision INTEGER NOT NULL DEFAULT 1;

INSERT OR IGNORE INTO schema_migrations(version,name,applied_at)
VALUES (2,'spark_revisions',CURRENT_TIMESTAMP);
