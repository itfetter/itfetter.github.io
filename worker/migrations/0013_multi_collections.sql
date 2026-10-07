-- 一篇文章可加入多个合集；公开归属与草稿归属分开，排序保存在关联上。
ALTER TABLE posts ADD COLUMN collection_token TEXT NOT NULL DEFAULT '';
ALTER TABLE post_versions ADD COLUMN collections_json TEXT;
CREATE TABLE post_collections (
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 collection_slug TEXT NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
 state TEXT NOT NULL CHECK(state IN ('published','draft')),
 position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
 PRIMARY KEY(post_id,collection_slug,state)
);
CREATE INDEX collection_members ON post_collections(collection_slug,state,position,post_id);
INSERT INTO post_collections SELECT p.id,c.slug,'published',p.collection_order FROM posts p JOIN categories c ON c.name=trim(p.category) WHERE p.status='published';
INSERT INTO post_collections SELECT p.id,c.slug,'draft',p.collection_order FROM posts p JOIN categories c ON c.name=trim(COALESCE(p.draft_category,p.category)) WHERE p.draft_body IS NOT NULL OR p.status='draft';
UPDATE post_versions SET collections_json=(SELECT json_group_array(slug) FROM categories WHERE name=post_versions.category);
DROP TRIGGER posts_history;
CREATE TRIGGER posts_history BEFORE UPDATE ON posts
WHEN NEW.version<>OLD.version AND NEW.deleted_at IS OLD.deleted_at BEGIN
 INSERT OR IGNORE INTO post_versions(post_id,version,title,category,summary,body,saved_at,collections_json)
 VALUES(OLD.id,OLD.version,COALESCE(OLD.draft_title,OLD.title),COALESCE(OLD.draft_category,OLD.category),COALESCE(OLD.draft_summary,OLD.summary),COALESCE(OLD.draft_body,OLD.body),OLD.updated_at,
 (SELECT json_group_array(collection_slug) FROM post_collections WHERE post_id=OLD.id AND state=CASE WHEN OLD.draft_body IS NOT NULL THEN 'draft' ELSE 'published' END));
 DELETE FROM post_versions WHERE post_id=OLD.id AND version NOT IN (SELECT version FROM post_versions WHERE post_id=OLD.id ORDER BY version DESC LIMIT 50);
END;
-- 迁移与新版上线之间的旧程序写入仍按单合集同步；新版写入有 token，不进入此兼容分支。
CREATE TRIGGER legacy_collection_insert AFTER INSERT ON posts WHEN NEW.collection_token='' BEGIN
 INSERT INTO categories(name) SELECT trim(NEW.category) WHERE trim(NEW.category)<>'' ON CONFLICT DO NOTHING;
 INSERT INTO categories(name) SELECT trim(NEW.draft_category) WHERE trim(NEW.draft_category)<>'' ON CONFLICT DO NOTHING;
 INSERT INTO post_collections SELECT NEW.id,slug,'published',NEW.collection_order FROM categories WHERE name=trim(NEW.category) AND NEW.status='published';
 INSERT INTO post_collections SELECT NEW.id,slug,'draft',NEW.collection_order FROM categories WHERE name=trim(COALESCE(NEW.draft_category,NEW.category)) AND (NEW.draft_body IS NOT NULL OR NEW.status='draft');
END;
CREATE TRIGGER legacy_collection_update AFTER UPDATE ON posts
WHEN NEW.collection_token='' AND (NEW.category IS NOT OLD.category OR NEW.draft_category IS NOT OLD.draft_category OR NEW.status IS NOT OLD.status OR (NEW.draft_body IS NULL)<>(OLD.draft_body IS NULL)) BEGIN
 INSERT INTO categories(name) SELECT trim(NEW.category) WHERE trim(NEW.category)<>'' ON CONFLICT DO NOTHING;
 INSERT INTO categories(name) SELECT trim(NEW.draft_category) WHERE trim(NEW.draft_category)<>'' ON CONFLICT DO NOTHING;
 DELETE FROM post_collections WHERE post_id=NEW.id;
 INSERT INTO post_collections SELECT NEW.id,slug,'published',NEW.collection_order FROM categories WHERE name=trim(NEW.category) AND NEW.status='published';
 INSERT INTO post_collections SELECT NEW.id,slug,'draft',NEW.collection_order FROM categories WHERE name=trim(COALESCE(NEW.draft_category,NEW.category)) AND (NEW.draft_body IS NOT NULL OR NEW.status='draft');
END;

