-- Public Read Replica for Alister Blog Community
-- Authoritative source is JD Cloud PostgreSQL; Cloudflare D1 hosts this delivery read replica.

CREATE TABLE community_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'markdown' CHECK(content_format IN ('markdown', 'mdx')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'unlisted')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_posts_visibility_published ON community_posts(visibility, published_at DESC, created_at DESC);
CREATE UNIQUE INDEX idx_community_posts_slug ON community_posts(slug);

CREATE TABLE community_post_images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL CHECK(length(trim(object_key)) > 0),
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, sort_order)
);

CREATE INDEX idx_community_post_images_post_id ON community_post_images(post_id, sort_order ASC);
