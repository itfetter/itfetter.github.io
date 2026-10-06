-- 文章移入回收站时保留正文、草稿、历史与评论，原有文章默认仍正常显示。
ALTER TABLE posts ADD COLUMN deleted_at TEXT;
CREATE INDEX posts_trash ON posts(deleted_at,status,published_at,id);
-- 回收站状态变化只推进并发版本，不占用内容历史的 50 个快照名额。
DROP TRIGGER posts_history;
CREATE TRIGGER posts_history BEFORE UPDATE ON posts
WHEN NEW.version<>OLD.version AND NEW.deleted_at IS OLD.deleted_at BEGIN
 INSERT OR IGNORE INTO post_versions VALUES(OLD.id,OLD.version,COALESCE(OLD.draft_title,OLD.title),COALESCE(OLD.draft_category,OLD.category),COALESCE(OLD.draft_summary,OLD.summary),COALESCE(OLD.draft_body,OLD.body),OLD.updated_at);
 DELETE FROM post_versions WHERE post_id=OLD.id AND version NOT IN (SELECT version FROM post_versions WHERE post_id=OLD.id ORDER BY version DESC LIMIT 50);
END;
