CREATE TABLE IF NOT EXISTS contact_messages (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at DESC,id);
CREATE INDEX IF NOT EXISTS contact_messages_status ON contact_messages(status,created_at DESC,id);
CREATE TABLE IF NOT EXISTS contact_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, attempts INTEGER NOT NULL);
