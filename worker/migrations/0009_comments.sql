-- 文章评论独立于私密联系留言；不改已有文章。
CREATE TABLE IF NOT EXISTS article_comments (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden')),
 reply TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 replied_at TEXT,
 deleted_at TEXT,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS article_comments_public ON article_comments(post_id,status,deleted_at,created_at,id);
CREATE INDEX IF NOT EXISTS article_comments_manage ON article_comments(deleted_at,status,created_at,id);
CREATE TABLE IF NOT EXISTS comment_limits (
 key TEXT PRIMARY KEY,
 window INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
