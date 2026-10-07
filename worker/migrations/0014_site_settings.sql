-- 公开联系方式独立于管理员账号；空表时兼容原有邮箱，首次保存写入。
CREATE TABLE site_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 contact_email TEXT NOT NULL CHECK(length(contact_email)<=254),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
