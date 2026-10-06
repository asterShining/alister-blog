CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('like', 'dislike')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_slug, visitor_id)
);
CREATE INDEX idx_reactions_post_slug ON reactions(post_slug);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('pending', 'published', 'hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comments_post_slug_created_at ON comments(post_slug, created_at);
