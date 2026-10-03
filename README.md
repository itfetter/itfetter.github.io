# itfetter 的个人博客

目标架构：GitHub 保存程序源码，Cloudflare Workers 承载博客和管理后台。文章由 D1 保存，上传图片由 R2 保存，管理员通过自建账号密码登录。日常写作不需要 GitHub token，也不触发 Git 提交或网站重新构建。

**迁移状态：** Cloudflare 已部署并连接 GitHub main 自动构建；正式域名 itfetter.com 已接入，5 篇旧文章已导入 D1 并核对原文与稳定链接。现有 `_posts/`、Jekyll 配置、`posts.js` 和 Issue 发文工作流暂时保留，供旧站继续运行及迁移核对；确认导入与域名切换成功后再清理。保留原文章内容、`blog_id` 和 `/articles/<id>/` 链接。后台部署指南见 [worker/README.md](worker/README.md)。

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

先执行数据库迁移，再在可信终端运行 `npm --prefix worker run create:admin`，工具交互输入账号和密码，生成被忽略的 `.migration/admin.sql`；按部署指南导入对应数据库。工具不会联网或自动覆盖数据库。密码至少 6 字符，登录会话最多 8 小时，退出后立即撤销。登录后可在后台“账号设置”点击“修改密码”，输入当前密码、新密码和确认密码（6–128 字符）；先保存文章，修改成功后所有旧会话失效，须用新密码重新登录。忘记密码时再次运行可信终端工具并执行 SQL，会撤销所有旧会话。没有公众注册与邮件找回密码。

本机缺少依赖时不自动安装，可运行独立 `npm --prefix worker run test:auth`，完整构建和测试使用 GitHub Actions 的验证工作流。

## 写作和数据

后台包含工作台统计与最近更新、文章库（搜索、分类、排序及分页）、写作编辑器和账号设置。编辑器可切换双栏、专注写作及预览；预览使用服务端正式 Markdown 清理规则，可导出当前文章为 Markdown。支持保存草稿和直接粘贴、拖入图片；当前不自动保存，离开前须保存草稿或导出。

访问 `/admin/`，登录、写 Markdown、上传图片，点击“发布文章”。新文章短名只允许小写英文、数字与连字符，首次保存后固定；空短名保存草稿时自动生成，之后保持稳定。保存后读请求直接读取数据库；并发编辑会返回冲突，防止覆盖其他版本。支持数据库草稿：未发布草稿不公开，已发布文章保存草稿保持前台原版本，点击发布才更新；不包含修订历史或自动备份；删除前请备份 D1，图片不会随文章删除。

迁移命令只生成 `.migration/posts.sql`，不会连接线上服务或删除原文件；重复导入不会覆盖已存在的文章。旧示例插画仍随静态资源发布，新增图片写入 R2。

从 Cloudflare Workers Builds 连接 GitHub 后，设置根目录 `worker`、构建命令 `npm ci && npm run build`、部署命令 `npx wrangler deploy --config wrangler.jsonc`。`wrangler.jsonc` 是忽略的账户配置，云端构建需在构建环境中提供完整配置（例如构建变量 `BLOG_WRANGLER_CONFIG` 配合文档中的生成命令），不要期望 GitHub 检出中已有本地文件。

修改前阅读 [AGENTS.md](AGENTS.md) 和 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)，提交和交接记录使用中文。


草稿可只填写标题或正文，发布才要求完整的标题、分类、摘要与正文。文章库按状态筛选草稿，Ctrl / ⌘ + S 保存草稿。正文直接粘贴剪贴板图片或拖入图片会上传到 R2，支持每张 5 MB 内的 PNG、JPG、WebP、GIF；普通文字粘贴不受影响，上传完成前不能保存或切换文章。图片链接沿用公开随机 URL，草稿的文章内容不公开，但图片本身不是私密附件。

后台左侧“写文章”和“＋新建文章”均打开空白编辑器；继续编辑已有文章或草稿，请从文章库点击标题或“编辑”。有未保存修改时可取消切换并保存草稿；保存或图片上传中禁止切换。编辑页面标题区分写文章、编辑文章和编辑草稿。

文章库每行提供“编辑、查看、删除”（未发布草稿不显示查看）。删除前弹出标题确认框；确认后删除文章与其草稿，并刷新列表及统计。删除不可撤销，上传图片不会随文章删除。
