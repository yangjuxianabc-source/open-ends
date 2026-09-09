PRAGMA foreign_keys = OFF;

ALTER TABLE reading_items
  ADD COLUMN rating REAL
  CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5 AND rating * 2 = CAST(rating * 2 AS INTEGER)));

ALTER TABLE media_items
  ADD COLUMN rating REAL
  CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5 AND rating * 2 = CAST(rating * 2 AS INTEGER)));

UPDATE reading_items
SET rating = CASE preference
  WHEN 'dislike' THEN 1.0
  WHEN 'neutral' THEN 3.0
  WHEN 'like' THEN 5.0
END
WHERE rating IS NULL AND preference IS NOT NULL;

UPDATE media_items
SET rating = CASE preference
  WHEN 'dislike' THEN 1.0
  WHEN 'neutral' THEN 3.0
  WHEN 'like' THEN 5.0
END
WHERE rating IS NULL AND preference IS NOT NULL;

ALTER TABLE reading_events RENAME TO reading_events_v2;
CREATE TABLE reading_events (
  id TEXT PRIMARY KEY,
  reading_item_id TEXT NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('added','started','finished','paused','resumed','dropped','restarted','preference_changed','rating_changed')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  rating REAL CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL
);
INSERT INTO reading_events (id, reading_item_id, type, preference, occurred_at, local_date, timezone)
SELECT id, reading_item_id, type, preference, occurred_at, local_date, timezone
FROM reading_events_v2;
DROP TABLE reading_events_v2;
CREATE INDEX IF NOT EXISTS reading_events_local_date ON reading_events(local_date);

ALTER TABLE media_events RENAME TO media_events_v2;
CREATE TABLE media_events (
  id TEXT PRIMARY KEY,
  media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('added','started','finished','paused','resumed','dropped','restarted','preference_changed','rating_changed')),
  preference TEXT CHECK (preference IS NULL OR preference IN ('dislike','neutral','like')),
  rating REAL CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL
);
INSERT INTO media_events (id, media_item_id, type, preference, occurred_at, local_date, timezone)
SELECT id, media_item_id, type, preference, occurred_at, local_date, timezone
FROM media_events_v2;
DROP TABLE media_events_v2;
CREATE INDEX IF NOT EXISTS media_events_local_date ON media_events(local_date);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations(version,name,applied_at)
VALUES (3,'ratings',CURRENT_TIMESTAMP);
