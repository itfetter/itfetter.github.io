-- 保留公开更新时间，保存前快照保留每篇最近 50 个版本。
ALTER TABLE posts ADD COLUMN public_updated_at TEXT;
UPDATE posts SET public_updated_at=CASE WHEN draft_body IS NULL THEN updated_at ELSE published_at END;
CREATE TABLE post_versions (
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 title TEXT NOT NULL,category TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,
 saved_at TEXT NOT NULL,
 PRIMARY KEY(post_id,version)
);
CREATE TRIGGER posts_history BEFORE UPDATE ON posts WHEN NEW.version<>OLD.version BEGIN
 INSERT OR IGNORE INTO post_versions VALUES(OLD.id,OLD.version,COALESCE(OLD.draft_title,OLD.title),COALESCE(OLD.draft_category,OLD.category),COALESCE(OLD.draft_summary,OLD.summary),COALESCE(OLD.draft_body,OLD.body),OLD.updated_at);
 DELETE FROM post_versions WHERE post_id=OLD.id AND version NOT IN (SELECT version FROM post_versions WHERE post_id=OLD.id ORDER BY version DESC LIMIT 50);
END;
