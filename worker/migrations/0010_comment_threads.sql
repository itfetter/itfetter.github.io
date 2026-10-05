ALTER TABLE article_comments ADD COLUMN root_id TEXT REFERENCES article_comments(id) ON DELETE CASCADE;
ALTER TABLE article_comments ADD COLUMN target_id TEXT REFERENCES article_comments(id) ON DELETE SET NULL;
CREATE INDEX article_comments_threads ON article_comments(post_id,root_id,status,deleted_at,created_at,id);
