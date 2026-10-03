-- 已发表文章保留公开正文；草稿字段只通过认证管理接口读取。
ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published'));
ALTER TABLE posts ADD COLUMN draft_title TEXT;
ALTER TABLE posts ADD COLUMN draft_category TEXT;
ALTER TABLE posts ADD COLUMN draft_summary TEXT;
ALTER TABLE posts ADD COLUMN draft_body TEXT;
CREATE INDEX posts_status_published ON posts(status,published_at DESC);
