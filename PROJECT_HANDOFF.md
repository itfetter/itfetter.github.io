# PROJECT_HANDOFF.md — itfetter 个人博客交接

> 更新于 2026-09-27。此处记录仓库中的实际实现；GitHub Pages 是否已构建成功及最新 HTTPS/DNS 状态以设置页和线上访问为准。后续修改记录和提交信息请使用中文。

## 当前开发到哪里

- 个人博客已部署在 `itfetter.com`，从 GitHub Pages 的 `main` 分支根目录发布；用户截图曾确认 HTTPS 可访问、Enforce HTTPS 已勾选，DNS Check 当时仍显示 In Progress。
- 首页原有的展示、搜索、分类与 `#post/hello`、`#post/note` 阅读方式保留。首页导航不显示登录入口，维护者可直接访问 `/admin/`。
- 文章从挤在 `posts.js` 的单行数据迁移为两篇 `_posts/*.md`；Jekyll 构建时生成文章独立页面与 `posts.js` 数据。首页分类按钮现在根据文章自动生成。
- `/admin/` 逐篇链接到 GitHub 的 Markdown 编辑器，也可新建文件；仍是公开静态页，登录及发布权限由 GitHub 控制。**尚无站内输入密码、可视化编辑并直接保存的后台。**
- 此轮新增 `ARTICLE_TEMPLATE.md` 供写文章复制，README 与 AGENTS 已更新。用户要求以后提交及变更描述用中文，已写入协作规则。

- `/write/` 现已跳转 GitHub 登录文章表单，原复制/下载式编辑器已移除。

## 项目地图

| 路径 | 用途 |
| --- | --- |
| `index.html` | 首页样式与阅读、搜索、筛选脚本。 |
| `_posts/2026-09-24-hello.md` | 欢迎文章。 |
| `_posts/2026-09-24-note.md` | 示范随笔。 |
| `_layouts/post.html` | Jekyll 独立文章页。 |
| `posts.js` | Jekyll 从文章源文件自动生成的 JS 模板，源码中包含 Liquid。 |
| `write/index.html` | 静态写作与预览页；仅生成文件，不持有凭据或直接发布。 |
| `admin/index.html` | GitHub 登录及文章编辑导航。 |
| `ARTICLE_TEMPLATE.md` | 新文章 front matter 与 Markdown 写法示例。 |
| `_config.yml` | Jekyll 构建设置。 |
| `CNAME` | Pages 主域名 `itfetter.com`。 |
| `README.md`、`AGENTS.md` | 使用手册和协作约束。 |

## 变更记录

| 日期 | 改动文件 | 改动与原因 | 验证 |
| --- | --- | --- | --- |
| 2026-09-24（初建） | `index.html`、`README.md` | 将 CSDN 跳转入口发展为独立静态博客。 | 网站已发布；早期示例文章可读。 |
| 2026-09-24（域名） | `CNAME` 与域名设置 | 绑定 `itfetter.com`；配置阿里云 DNS。 | 用户截图显示根域名 HTTPS 可访问并启用 Enforce HTTPS。 |
| 2026-09-24（管理入口初版） | `posts.js`、`admin/index.html`、`index.html`、文档 | 拆分文章数据，增加首页登录入口，编辑时转到 GitHub。 | 用户实际点击后进入 GitHub 编辑页；未实现站内后台。 |
| 2026-09-24（隐藏入口） | `index.html` | 移除首页导航中的登录链接；维护者直接输入 `/admin/` 访问文章管理入口。 | 已核对源码中导航链接移除；待 Pages 部署后确认线上显示。 |
| 2026-09-24（本轮） | `_config.yml`、`_layouts/post.html`、`_posts/*.md`、`posts.js`、`admin/index.html`、`index.html`、`ARTICLE_TEMPLATE.md`、三个项目文档 | 一篇文章一个 Markdown 文件，构建时自动生成列表与独立页面，逐篇编辑；提交信息改中文。 | 已在线检查首页显示两篇文章及自动分类，`/articles/hello/` 正常显示 Markdown 正文，`/admin/` 显示逐篇编辑和新增入口；尚未使用账号实际提交新文章。 |
| 2026-09-24（图文示例） | `assets/writing-flow.svg`、`_posts/2026-09-24-rich-markdown-demo.md`、`_layouts/post.html`、`index.html`、`ARTICLE_TEMPLATE.md`、`README.md` | 增加明确标注为示例的图文文章与自制配图，并为两种文章阅读方式补充图片、提示框、表格、代码块样式。 | 已在 `https://itfetter.com/articles/rich-markdown-demo/` 在线确认标题、图片加载、提示框和表格渲染；首页哈希阅读样式沿用同一套规则，待单独核查。 |
| 2026-09-24（写作页） | `write/index.html`、`admin/index.html`、`README.md`、`AGENTS.md` | 提供专用写作网址和 Markdown 工具栏、预览、草稿、复制/下载；管理页新增文章入口改为写作页，保留 GitHub 提交与图片上传步骤。 | 已在线核对页面打开、实时预览、文件名和复制的完整 Markdown；下载按钮尚未单独验证。 |

## 2026-09-27 自动发文改动

| 文件 | 原因 | 验证 |
| --- | --- | --- |
| `.github/ISSUE_TEMPLATE/publish-article.yml` | 用 GitHub 登录表单接收标题、分类、摘要和 Markdown。 | 已提交；Issue #1 的分类、摘要、正文已被成功解析。 |
| `.github/workflows/publish-article.yml`、`scripts/publish_article_from_issue.py` | 验证 itfetter 用户 ID，生成文章并请求 Pages 构建。 | 已核对源码；Issue #1（测试文章）已由作者提交；补正标题后工作流运行，生成文章并请求 Pages 构建。 |
| `write/index.html`、`README.md`、`AGENTS.md`、本文 | 入口改为 GitHub 表单并更新文档。 | 自动文章写入已验证；线上跳转和页面可达仍待核对。 |

自动文章使用 `article-<Issue 序号>` 链接。Issue 内容在提交后公开，图片可直接拖入正文。若 Pages API 调用失败，文章可能已写入但尚未部署，需查看 Actions 和 Issue 错误信息。旧文仍在 GitHub 文件编辑器修改。下一步由 itfetter 账号发布一篇真实文章，核对工作流、Pages 与前台页面。

## 已知问题与风险

1. `posts.js` 的源码现在是 Liquid 模板，不经 GitHub Pages Jekyll 构建不能直接作为普通 JS 执行；若部署工作流禁用 Jekyll，首页文章列表会失效。先查看 **Actions → pages build and deployment**。
2. 两篇文章迁移时保留了主要内容、原 `blog_id` 和哈希链接；已在线确认 `/articles/hello/` 可访问；`/articles/note/` 尚未逐页检查。
3. `/write/` 和 `/admin/` 均是公开页面；写作页草稿保存在当前浏览器，清缓存/换设备可能丢失，预览与 Jekyll 的最终渲染可能略有差异；图片和 Markdown 分别提交。仅 GitHub 控制仓库修改权限。想在自己域名下安全地直接编辑/保存仍需要可信授权服务，不能把密码或 GitHub 写入令牌放进公开静态页面。
4. `/admin/` 是公开页面；仅 GitHub 控制仓库修改权限。想在自己域名下安全地直接编辑/保存仍需要可信授权服务，不能把密码或 GitHub 写入令牌放进公开静态页面。
4. 首页置顶卡片文案/链接仍写在 `index.html`，改置顶需同步修改。Markdown 原文如果包含不可信 HTML，应在发布前审查。
5. 使用 GitHub Pages 内置 Jekyll，文章发布日期与时区有关；未来日期可能导致新文章暂不出现在列表。文章源文件以 `YYYY-MM-DD-name.md` 命名。
6. 修改 `CNAME`、DNS 或 Pages 设置会影响线上域名和 HTTPS；现有域名及配置未在此轮修改。
7. 示例随笔应替换成真实文章。Google Fonts / CSDN 链接依赖外部可用性。

## 下一步

1. 首页两篇文章、分类和 `/articles/hello/` 已核对；继续检查搜索、旧版 `#post/hello`、`/articles/note/` 与仓库 Pages 构建状态。
2. 用站点所有者的 GitHub 账号检查 `/admin/` 的登录、逐篇编辑与新建文件；提交一篇测试文章后确认 Pages 自动更新。
3. 后续更新文章直接改 `_posts/*.md`，不要直接编辑 `posts.js`。持续记录中文提交信息、实际变更和验证结果。
4. 内容增加时再评估图片、站点图标、分享预览和必要的文章管理体验改进；若要站内写作与发布，另行设计安全的授权/写入服务。

## 2026-09-27 Issue #1 验证记录

- 作者 itfetter 建立 Issue #1 时标题为“测试文章”，缺少工作流要求的 `[发布文章] ` 前缀，因此首次未运行。
- 更新 `.github/workflows/publish-article.yml` 监听 `issues: edited`，在 Issue 开启且作者 ID 匹配时允许补正标题重新触发；随后将 Issue #1 标题改为 `[发布文章] 测试文章`。
- 工作流生成 `_posts/2026-09-27-article-1.md`，Issue 机器人评论指出 Pages 构建已请求，Issue 自动关闭。生成文件元信息为分类“测试”、摘要“上传测试”、北京时间 2026-09-27 18:05:57、地址 `/articles/article-1/`。
- 当前仅证实文章已入库且 Pages 构建请求已被接受；站点页面是否已显示，仍需确认 Pages 构建最终状态和线上访问。

## 2026-09-27 可视化后台开发记录

| 文件 | 修改原因 | 验证 |
| --- | --- | --- |
| `admin/index.html`、`admin/config.js` | 增加文章列表、Markdown 编辑与预览、图片上传、保存及删除界面；未配置服务时保留 GitHub 备用入口。 | 前端脚本通过 Node 语法检查；真实 OAuth 页面尚未登录验证。 |
| `worker/index.js`、`worker/package.json`、`worker/test.mjs` | 引入 GitHub App OAuth + Cloudflare Worker API，以数字用户 ID 核对作者，限文章与图片目录，按 SHA 防冲突。 | `npm test` 三项通过：未登录/跨站拒绝、文章 CRUD 路径与冲突、非所有者授权拒绝。 |
| `worker/wrangler.example.jsonc`、`worker/README.md`、`.gitignore` | 提供可配置部署示例、KV/密钥说明，避免误提交真实凭据。 | 文件已提交；Cloudflare 账户资源尚未创建。 |
| `_config.yml`、`README.md`、`AGENTS.md`、本文 | 避免 Worker 服务代码成为 Pages 静态资源，并记录启用条件。 | 需待 Pages 构建确认后台静态界面。 |

**部署状态：** GitHub Pages 主站仍在 `itfetter.com`。Worker 未部署，GitHub App 未注册，`admin/config.js` 的 Worker 地址为空；因此目前的 `/admin/` 只显示配置提示，**尚不能使用站内登录和增删改**。现有 Issue 表单 `/write/` 仍可发布，GitHub 文件编辑仍可修改旧文。本轮没有改变 DNS、CNAME 或 Pages 发布源。

**下一步：** 先在 Cloudflare 创建 Worker 和 KV，取得 Worker URL；按 `worker/README.md` 注册仅安装到本仓库的 GitHub App，将回调设置为 Worker 的 `/auth/callback`；在 Worker Secrets 设置 Client Secret、部署代码，再将 Worker URL 填入 `admin/config.js`。最后实际测试登录、文章增删改、图片上传和 Pages 构建。

**已知风险：** 前端页面公开可读，访问控制只发生在 Worker；浏览器短期会话 ID 存在当前标签，GitHub token 位于 Worker KV。GitHub App 回调与 Worker URL 必须精确匹配；图片上传大小限制 5 MB。删除文章不会清理历史与孤立图片。上述账户配置及上线端到端流程未验证，不能宣称后台已经可用。
