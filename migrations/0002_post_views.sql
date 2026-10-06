CREATE TABLE post_views (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  view_bucket INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_slug, visitor_id, view_bucket)
);

CREATE INDEX idx_post_views_post_slug ON post_views(post_slug);
