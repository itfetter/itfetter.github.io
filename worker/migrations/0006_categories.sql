-- 独立保存分类；不修改文章、草稿或版本。
CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY NOT NULL CHECK(length(name) BETWEEN 1 AND 80));
INSERT OR IGNORE INTO categories (name) VALUES ('随笔');
INSERT OR IGNORE INTO categories (name) SELECT trim(category) FROM posts WHERE trim(category)<>'';
INSERT OR IGNORE INTO categories (name) SELECT trim(draft_category) FROM posts WHERE trim(draft_category)<>'';
