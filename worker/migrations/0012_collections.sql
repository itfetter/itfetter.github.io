-- 分类与合集统一；保留原名称、文章归属、正文及网址。
CREATE TABLE categories_next (
 name TEXT PRIMARY KEY NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 slug TEXT NOT NULL UNIQUE DEFAULT ('collection-' || lower(hex(randomblob(8)))),
 description TEXT NOT NULL DEFAULT '',
 cover TEXT NOT NULL DEFAULT '',
 sort_mode TEXT NOT NULL DEFAULT 'newest' CHECK(sort_mode IN ('newest','oldest','manual')),
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 mutation_token TEXT NOT NULL DEFAULT ''
);
INSERT INTO categories_next(name) SELECT name FROM categories;
INSERT OR IGNORE INTO categories_next(name) SELECT trim(category) FROM posts WHERE trim(category)<>'';
INSERT OR IGNORE INTO categories_next(name) SELECT trim(draft_category) FROM posts WHERE trim(draft_category)<>'';
DROP TABLE categories;
ALTER TABLE categories_next RENAME TO categories;
ALTER TABLE posts ADD COLUMN collection_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX posts_collection_order ON posts(category,deleted_at,status,collection_order,published_at);

