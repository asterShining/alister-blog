-- Rate-limit queries need efficient lookup by visitor_id + created_at.
-- This index supports both the 30-second interval check and the
-- 10-minute sliding window count without scanning the full table.
CREATE INDEX idx_comments_visitor_created ON comments(visitor_id, created_at);
