ALTER TABLE posts ADD COLUMN read_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE article_reads (key TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX article_reads_expiry ON article_reads(expires_at);
CREATE TRIGGER article_reads_count AFTER INSERT ON article_reads BEGIN UPDATE posts SET read_count=read_count+1 WHERE id=NEW.post_id; END;
CREATE TABLE read_limits (key TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL);
