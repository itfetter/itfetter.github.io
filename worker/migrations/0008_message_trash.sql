ALTER TABLE contact_messages ADD COLUMN deleted_at TEXT DEFAULT NULL;
ALTER TABLE contact_messages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX contact_messages_active_status ON contact_messages(deleted_at,status,created_at DESC,id);
