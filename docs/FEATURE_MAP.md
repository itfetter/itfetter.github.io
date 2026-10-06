# 功能定位与修改地图

更新日期：2026-10-06。基于 main 提交 `00423063f8ff8fb407566713e8d5428a66c3187a` 的文件和实现核对；这是持续维护的导航，不是完整 API 规范，也不替代实际代码。

## 新窗口从哪里开始

1. 读 [AGENTS.md](../AGENTS.md) 的长期规则与 [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) 的当前项目速查、最新状态；历史验收记录不能当作当前实现。
2. 在本地图找到需求对应的源码、接口、迁移和回归测试，再核对远端最新 main / 工作目录改动。
3. 先追踪页面事件 → API 路由 → 业务函数 → D1/R2 → 页面响应；同时检查权限、并发和公开数据边界。
4. 修改完成同步本地图与交接记录；规则改变同步 AGENTS，用户行为改变同步 README。分别记录验证、提交、推送、构建和上线状态。

当前运行链路：浏览器 → Cloudflare Worker → D1 / R2；静态页面由 Worker Static Assets 提供。GitHub 保存源码，文章发布直接写数据库，不触发源码提交。

## 按需求找入口

| 要修改的功能 | 页面与前端源码 | 后端与数据入口 | 关联检查 |
| --- | --- | --- | --- |
| 首页布局、搜索、分类、归档、列表分页 | [index.html](../index.html)、[front.js](../assets/front.js)、[front.css](../assets/front.css)、[public-utils.mjs](../assets/public-utils.mjs) | [worker/index.js](../worker/index.js)：公开摘要 /posts.json，兼容 /posts.js；posts | 摘要不能返回正文/草稿；每页5篇是前端分页；[public.test.mjs](../worker/public.test.mjs) |
| 独立文章页、日期、上一篇/下一篇、推荐、分享信息 | [_layouts/post.html](../_layouts/post.html)、front.css、[build.mjs](../scripts/build.mjs) | worker/index.js：/articles/<id>/ 模板替换、公开状态过滤、renderMarkdown | 模板占位符与构建同步；文章 id 和旧链接稳定；worker/test.mjs |
| 目录、章节深链接、复制代码/链接、阅读进度 | [reading-tools.js](../assets/reading-tools.js)、[heading-links.mjs](../assets/heading-links.mjs)、front.css、文章模板 | 标题映射主要在浏览器；文章 HTML 由 Worker 渲染 | [heading.test.mjs](../worker/heading.test.mjs)；重复标题、旧片段、手机和键盘 |
| 后台导航、刷新恢复栏目和文章 | [admin/index.html](../admin/index.html)：panel、syncRoute、login、openPost；[admin-route.mjs](../assets/admin-route.mjs) | /api/me、/api/post；会话验证后恢复 view/id | [admin.test.mjs](../worker/admin.test.mjs)；刷新不恢复未保存正文 |
| 工作台统计、文章库筛选/排序/分页 | admin/index.html：refresh、renderList；[admin-utils.mjs](../assets/admin-utils.mjs) | GET /api/posts；posts 元数据与 read_count | admin.test.mjs；草稿、公开、待发布草稿需区分 |
| 标题、摘要、短名、保存草稿、发布、删除 | admin/index.html：openPost、保存事件、deleteFromList、确认弹窗 | worker/index.js：validate、GET/PUT/DELETE /api/post；posts、draft_*、version | worker/test.mjs；空短名自动 article-UUID、首次保存固定、409 冲突、草稿不覆盖公开正文 |
| 文档编辑、代码块转正文、选字/区块菜单 | [document-editor.mjs](../assets/document-editor.mjs)、[document-editor.css](../assets/document-editor.css)；admin/index.html：preview、正文同步/锁 | [content.js](../worker/content.js)、POST /api/preview；保存仍用 /api/post | [document.test.mjs](../worker/document.test.mjs)；flush、中文输入、撤销、旧回调隔离、sanitize |
| 图片粘贴/拖入/上传、图片读取 | document-editor.mjs、admin/index.html 的上传和占位符流程 | worker/index.js：validImage、POST /api/image、GET/HEAD /images/<key>；R2 IMAGES | worker/test.mjs；类型/5MB/认证；上传中不能保存/切换；删除文章不自动删除图片 |
| 分类/合集创建和选择 | admin/index.html：renderCategories、分类弹窗 | worker/index.js：GET/POST /api/categories；categories + posts 分类合并 | worker/test.mjs；名称校验、同名幂等；当前无重命名/删除 |
| 历史版本、载入旧稿 | admin/index.html 的历史版本弹窗和载入事件 | worker/index.js：GET /api/history；0007_history.sql 的 posts_history 触发器与 post_versions | worker/test.mjs；每篇最近50份完整快照；载入后保存/发布才生效 |
| 私密联系留言表单 | index.html、front.js | [contact.js](../worker/contact.js)：submitMessage；POST /api/contact；contact_messages/contact_limits | worker/test.mjs；最多3000字、蜜罐、原子限速、超时保留输入；不发送邮件 |
| 留言折叠、未读数、批量已读、多选、回收站 | admin/index.html：loadMessages、refreshUnread、applyMessageBulk、确认弹窗 | contact.js：listMessages、markMessage、readAllMessages、moveMessage、bulkMessages | worker/test.mjs；id/version、批量最多20条且全批冲突保护；永久清除须确认 |
| 文章评论、评论回复、回复他人、讨论串分页 | [comments.js](../assets/comments.js)、_layouts/post.html、front.css | [comments.js（服务端）](../worker/comments.js)：submitComment、publicComments、acceptedComment；article_comments/comment_limits | worker/test.mjs；新评论直接公开，原评论20条/页、回复10条/页、root_id/target_id |
| 后台评论筛选、搜索、多选、折叠、隐藏、回复、回收站 | [admin-comments.mjs](../assets/admin-comments.mjs)、admin/index.html 的 mountCommentManagement | worker/comments.js：managedComments、moderateComment、bulkComments；GET/PATCH /api/admin/comments、POST /api/admin/comments/bulk | worker/test.mjs；状态/post_id/q组合筛选、字面搜索、全部id/version原子校验；隐藏/回收根评论后整串不公开；当前无评论永久清除/自动过期 |
| 登录、退出、修改密码、会话 | admin/index.html；[auth.js](../worker/auth.js)；[create-admin.mjs](../scripts/create-admin.mjs) | /api/login、/api/logout、/api/me、/api/password；管理员/会话/限速表 | [auth.test.mjs](../worker/auth.test.mjs)、worker/test.mjs；scrypt、同源、HTTPS、会话撤销，不公开注册 |
| 阅读次数与后台阅读排序 | [read-count.js](../assets/read-count.js)、admin-utils.mjs、文章模板 | [reads.js](../worker/reads.js)：recordRead；POST /api/read；article_reads + posts.read_count | worker/test.mjs；触发器原子累计、小时去重、不改文章 version、不是精确人数 |
| JSON 内容/图片备份与补回 | admin/index.html 账号设置中的下载/恢复流程 | [backup.js](../worker/backup.js)：exportBackup、restoreBackup；GET /api/backup、POST /api/backup/restore；D1 + R2 | worker/test.mjs；图片 Base64/key、回复关系、仅补缺不覆盖、旧 v1 兼容、容量限制 |
| 缓存、404、搜索引擎入口、安全响应头 | [public-response.mjs](../worker/public-response.mjs)、worker/index.js；front.js | 公开 GET/HEAD 缓存白名单、/sitemap.xml、/robots.txt | public.test.mjs；边缘30秒，后台/API no-store，错误不能变200 |
| 构建、静态资源、编辑器依赖 | scripts/build.mjs、[editor-assets.mjs](../scripts/editor-assets.mjs)、[package.json](../worker/package.json)、[wrangler.example.jsonc](../worker/wrangler.example.jsonc) | Worker 绑定 DB / IMAGES / ASSETS；Cloudflare Workers Builds | [.github/workflows/validate-worker.yml](../.github/workflows/validate-worker.yml)、[部署指南](../worker/README.md)；构建资源固定版本/哈希 |
| 未来 Linux / Docker / OSS 迁移 | [LINUX_DOCKER_MIGRATION.md](LINUX_DOCKER_MIGRATION.md) | 尚未实现 Node 服务、数据库/OSS 适配和可拉取镜像 | 当前继续 Cloudflare；迁移文档是规划，不能直接当部署包 |

前端与服务端都有名为 comments.js 的文件，修改时必须写完整路径，避免混淆。

## API 快速索引

路由总入口为 worker/index.js 的 handle；业务函数按上表分模块。以下管理接口均需有效管理员会话，写请求保留同源检查。

| 范围 | 路径和方法 | 用途 |
| --- | --- | --- |
| 公开 | GET /posts.json、/posts.js；GET/HEAD /articles/<id>/、/images/<key>、/sitemap.xml、/robots.txt | 列表、文章、图片与爬虫入口 |
| 公开提交 | POST /api/contact、/api/read；GET/POST /api/comments | 私密留言、阅读累计、公开评论/回复 |
| 认证 | POST /api/login、/api/logout、/api/password；GET /api/me | 登录、安全与当前会话 |
| 文章管理 | GET /api/posts；GET/PUT/DELETE /api/post；POST /api/preview、/api/image | 列表、编辑、保存/删除、预览和图片 |
| 分类与历史 | GET/POST /api/categories；GET /api/history | 分类创建；id 查询版本列表，id/version 查询快照 |
| 留言管理 | GET/PATCH/DELETE /api/messages；GET /api/messages/count；POST /api/messages/read-all、/api/messages/restore、/api/messages/bulk | 状态、角标、删除/恢复与批量操作 |
| 评论管理 | GET/PATCH /api/admin/comments；POST /api/admin/comments/bulk | 状态/文章/关键词筛选、本页批量隐藏/公开/移入回收站/恢复、作者回复 |
| 内容备份 | GET /api/backup；POST /api/backup/restore | 下载、仅补缺恢复 |

精确参数、状态码与限制以路由及业务模块为准；新增接口需同时更新本表、权限边界与测试。

## 数据结构与迁移

所有迁移在 [worker/migrations/](../worker/migrations/)，按序应用。已上线文件禁止改写，后续结构变化新增迁移。

| 迁移 | 负责的数据 |
| --- | --- |
| 0001_posts.sql | posts 文章基础结构 |
| 0002_auth.sql | 管理员、会话和登录限速 |
| 0003_drafts.sql | 状态、draft_* 和草稿保存 |
| 0004_contact.sql | contact_messages 私密留言、contact_limits |
| 0005_reads.sql | 阅读累计、article_reads 去重和触发器 |
| 0006_categories.sql | categories 独立分类 |
| 0007_history.sql | public_updated_at、post_versions、保存前快照与50份保留触发器 |
| 0008_message_trash.sql | 留言 deleted_at/version |
| 0009_comments.sql | article_comments、comment_limits 与索引 |
| 0010_comment_threads.sql | 评论 root_id/target_id 关系及讨论串索引 |

注意：0009 的历史默认值仍是 pending；当前 submitComment 显式插入 approved。不要为改变新评论发布行为去改旧迁移。
R2 是图片对象存储；图片在正文 Markdown 中用 /images/<key> 引用，位置取决于正文，不是单独的“文章图片位置表”。

## 源码、构建产物与线上内容的区别

- 当前源码：index.html、admin/、assets/、_layouts/post.html、worker/、scripts/。
- 构建生成：dist/ 静态资源、article-template.html、编辑器 vendor/manifest.json 等；通过构建产生，不能只改生成文件。编辑器资源生成逻辑和固定哈希在 scripts/editor-assets.mjs。
- 线上内容：D1 中文章/草稿/历史/留言/评论/会话；R2 图片。源码仓库没有当前线上文章的完整备份。
- 历史/兼容：_posts/、_config.yml、仓库根 posts.js、write/index.html、Issue 发文工作流；assets/visual-editor.mjs 与 visual.test.mjs 保留旧逐段编辑兼容回归。默认编辑器入口是 document-editor.mjs。
- 当前独立文章模板虽然在 _layouts/，仍被 Worker 构建使用；不能把整个 _layouts 当作废弃 Jekyll 文件删除。
- 私密配置与备份不提交：真实 wrangler.jsonc、.dev.vars、初始化 SQL、线上备份、密码/令牌。账户资源速查与部署步骤见交接和 worker/README.md。

## 修改后的验证与维护

复用已安装工具做针对性的语法、链接和静态检查；本机不为验证下载依赖。完整验证使用已有云端流程，worker/package.json 的 test 脚本串联各测试，validate-worker.yml 运行测试与构建。构建包含获取固定编辑器资源，不要把本机 build 当成无下载操作。

UI 修改还需检查手机宽度、键盘、刷新路由、未保存保护；数据修改检查认证、同源、版本冲突、公开/私密边界及关联恢复。真实线上文章、留言和评论不用于破坏性验收，演示数据权限不能泛化。

本地图只记录当前入口与限制；构建 ID、部署版本、测试结果、未完成事项放 PROJECT_HANDOFF.md。新增、移动、删除文件、改变职责/接口/迁移/验证入口时，必须在同一次提交同步本地图。
