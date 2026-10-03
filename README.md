# itfetter 的个人博客

目标架构：GitHub 保存程序源码，Cloudflare Workers 承载博客和管理后台。文章由 D1 保存，上传图片由 R2 保存，管理员通过自建账号密码登录。日常写作不需要 GitHub token，也不触发 Git 提交或网站重新构建。

**迁移状态：** 新架构已实现并在本地验证，线上切换尚未执行。现有 `_posts/`、Jekyll 配置、`posts.js` 和 Issue 发文工作流暂时保留，供旧站继续运行及迁移核对；确认导入与域名切换成功后再清理。保留原文章内容、`blog_id` 和 `/articles/<id>/` 链接。后台部署指南见 [worker/README.md](worker/README.md)。

| 部分 | 实现 |
| --- | --- |
| 源码与版本记录 | GitHub；公开/私有由仓库设置决定，当前代码变更不修改可见性 |
| 前台与 `/admin/` | Worker Static Assets，显式构建到 `dist/` |
| 管理与公开文章接口 | `worker/index.js`，同域名访问 |
| 文章 | D1 `posts` 表：标题、分类、摘要、Markdown、日期、链接和并发版本 |
| 上传图片 | R2，通过 `/images/` 读取，限制图片类型及 5 MB 大小 |
| 登录 | 单管理员账号密码、scrypt 哈希、D1 短期会话和共享限速；无需 Access |

## 云端开发

需要 Node.js 24、npm。以下命令在仓库根目录执行：

```bash
npm --prefix worker ci
npm --prefix worker run build
npm --prefix worker test
npm --prefix worker run import:posts
cd worker
npx wrangler d1 migrations apply itfetter-blog --local --config wrangler.example.jsonc
npx wrangler d1 execute itfetter-blog --local --config wrangler.example.jsonc --file ../.migration/posts.sql
```

本机开发可在被忽略的 `worker/.dev.vars` 中写 `ENVIRONMENT=development`，再在 `worker/` 执行 `npm run dev`。此模式只允许 HTTP localhost/127.0.0.1 使用开发 Cookie，仍须登录；**不得把 ENVIRONMENT=development 配置到线上**。未初始化管理员时拒绝登录，不会开放管理接口。管理员创建与重置见 worker/README.md；无需 Zero Trust / Access。普通开发无需 GitHub App、OAuth Secret 或 KV。

`npm test` 自动生成迁移 SQL，并执行真实 SQLite 文章增删改、冲突保护、账号密码及会话验证、跨站请求拒绝、Markdown 安全渲染和 R2 图片行为测试。Wrangler 本地运行还需初始化本地 D1；测试中的 R2 接口使用内存实现。静态前端修改后需重新构建 `dist/`，Worker 代码由 Wrangler 自动重载。

## 管理员登录

先执行数据库迁移，再在可信终端运行 `npm --prefix worker run create:admin`，工具交互输入账号和密码，生成被忽略的 `.migration/admin.sql`；按部署指南导入对应数据库。工具不会联网或自动覆盖数据库。密码至少 14 字符，登录会话最多 8 小时，退出后立即撤销。重置密码再次运行该工具并执行 SQL，会撤销所有旧会话。没有公众注册与邮件找回密码。

本机缺少依赖时不自动安装，可运行独立 `npm --prefix worker run test:auth`，完整构建和测试使用 GitHub Actions 的验证工作流。

## 写作和数据

启用后访问 `/admin/`，登录、写 Markdown、上传图片，点击“保存并发布”。新文章短名只允许小写英文、数字与连字符，发布后固定。保存后读请求直接读取数据库；并发编辑会返回冲突，防止覆盖其他版本。当前只有直接发布，不包含草稿、修订历史或自动备份；删除前请备份 D1，图片不会随文章删除。

迁移命令只生成 `.migration/posts.sql`，不会连接线上服务或删除原文件；重复导入不会覆盖已存在的文章。旧示例插画仍随静态资源发布，新增图片写入 R2。

从 Cloudflare Workers Builds 连接 GitHub 后，设置根目录 `worker`、构建命令 `npm ci && npm run build`、部署命令 `npx wrangler deploy --config wrangler.jsonc`。`wrangler.jsonc` 是忽略的账户配置，云端构建需在构建环境中提供完整配置（例如构建变量 `BLOG_WRANGLER_CONFIG` 配合文档中的生成命令），不要期望 GitHub 检出中已有本地文件。

修改前阅读 [AGENTS.md](AGENTS.md) 和 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)，提交和交接记录使用中文。

