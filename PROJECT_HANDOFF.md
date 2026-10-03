# PROJECT_HANDOFF.md — itfetter 个人博客交接

## 2026-10-03 最新交接：Cloudflare 全栈迁移决定

> **后续 AI 请优先阅读本节。前面的 2026-09-27 状态属于历史记录；迁移尚未实施，不得把规划写成已上线。**

### 用户目标与最终决定
用户希望在自己的 `/admin/` 网页中舒适地编辑 Markdown，管理现有文章、新增、修改、删除、预览并一键发布，上传 PNG/JPG 等图片；首页不展示登录入口。源码继续保存在 GitHub，由 Cloudflare 连接仓库，在 push/commit 后自动构建部署。最新目标是将前台和后台运行环境统一迁移到 Cloudflare，不再以“Worker 写 Markdown 到 GitHub，再等待 Pages 构建”为最终架构。

| 部分 | 目标方案 | 当前状态 |
| --- | --- | --- |
| 程序源码 | GitHub；可使用私有仓库 | 本仓库是现有代码来源；本轮未改变可见性 |
| 前台与后台静态资源 | Workers Static Assets | 未迁移 |
| 文章 API | Cloudflare Worker | 已有旧版 GitHub API 代理代码，新版 D1 API 未实现 |
| 文章正文与元数据 | D1 | 尚未确认创建、绑定或导入 |
| 图片及附件 | R2 标准存储 | 尚未确认开通、创建桶或绑定 |
| 管理员身份验证 | Cloudflare Access，限定管理员 | 尚未配置或验证 |
| 自动部署 | Cloudflare GitHub 集成 / Workers Builds | 尚未确认连通 |
| 域名 | 保留 itfetter.com，验收后切换 | 本轮未改 DNS、CNAME、Pages 设置 |

目标行为：改程序代码才触发构建部署；后台写文章直接保存 D1，前台读取已发布内容，不必生成 GitHub Commit。图片保存在 R2，文章可以导出为 Markdown并备份。D1/R2 数据不会因为源码在 GitHub 就自动获得备份。

### 本轮实际核查与此前截图证据
2026-10-03 已通过 GitHub 接口读取当前 AGENTS、README、交接文档、worker/README 和 admin/config.js。远端 `admin/config.js` 仍为 `window.BLOG_ADMIN_API = "";`；旧后台不能据此宣称已完成站内发布。
此前用户截图确认旧 Worker 已部署，地址为 `https://itfetter-blog-admin.itfetpro.workers.dev`；根路径返回“不存在的接口”，`/api/me` 返回“请重新登录”。这只证明当时接口可达，未证明认证及文章增删改成功；本轮未访问或审计 Cloudflare 实际资源。
早期创建/安装过 GitHub App，但后续截图的 Developer settings 显示没有自建 GitHub Apps；不要假定该 App 当前仍存在。旧方案的 SESSIONS KV、Client ID、Client Secret 是否配置完毕未确认。新方案若文章全部存 D1，文章 CRUD 不再需要 GitHub 写入授权，GitHub 授权主要用于源码部署集成。

### 授权讨论结论
隐藏 admin URL、URL 密码参数、前端密码加密或混淆都不能保护真实写入权限。GitHub Secrets 不能作为浏览器可读取的秘密。纯前端手动输入个人 Token 可调用 GitHub API，但不是用户期望的舒适后台。最终采用服务端鉴权。
Access 必须保护管理 API以及后台页面，Worker 验证身份和管理员权限；防止 workers.dev 或其他域名绕过保护。普通读者无需登录，公开接口仅返回已发布文章，不能返回草稿。密钥仅放 Cloudflare Secrets，不提交代码、不写入日志或交接文件。

### 费用与支付讨论（2026-09-30 查阅官方价格，实施时重新核对）
个人博客预计可从免费套餐开始，这只是估算，不保证永远零费用。Workers Free 每天 10 万次动态请求，另受 CPU 等限制；静态资源请求免费。Workers Paid 最低 5 美元/月，超额另计。D1 免费共 5GB，另有单库限制、每日读取/写入额度。R2 标准存储每月含 10GB-month、100 万次 A 类和 1000 万次 B 类操作，超额存储 0.015 美元/GB-month，出站流量免费但操作收费。Access 免费最多 50 用户，管理员人数不等于公开网站访客数。
R2 是对象存储，D1 才是文章数据库。R2 开通需要完成订阅/付款流程；绑定支付方式不等于固定月费，超额可能自动收费。Cloudflare 支持 PayPal，绑定招商信用卡是否能完成自动付款取决于卡种、PayPal 接受情况和银行审批，未验证成功。不能把预算告警当成硬性停止扣费上限。
官方资料：
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/
- https://www.cloudflare.com/plans/zero-trust-services/
- https://developers.cloudflare.com/billing/understand/faq/

### 下一窗口建议执行顺序
1. 先读取当前代码及三份项目文档，核实 Cloudflare 已有 Worker、D1、R2、Access、付款与 GitHub 集成状态；不要要求用户在聊天里提供密钥。
2. 保留现有 Pages 线上站点，先建立 Cloudflare 测试部署；复用现有博客视觉及 Markdown 编辑器，不必推翻全部 UI。
3. 设计 D1 模型：文章 ID、唯一 slug、标题、摘要、正文 Markdown、分类、草稿/发布状态、创建/更新时间、发布时间、版本号；保留已有文章地址映射。编写 SQL migration 和可重复运行的 _posts 导入工具。
4. 实现公共文章列表/详情及管理员 CRUD，使用参数化 SQL、分页、输入校验、服务端身份验证；编辑冲突要提示，删除有确认和可恢复策略。
5. 接入 R2 上传：限制格式及大小，生成唯一文件名，插入 Markdown 图片链接；规划未引用图片清理及备份。
6. 配置 Access 管理员白名单，保护 /admin/ 和管理 API，并测试未登录、非管理员、跨域和替代域名访问；必要时处理 CSRF。
7. 连接 GitHub 自动部署，提供准确的构建命令、部署命令、资源绑定和 Secrets 配置步骤。
8. 端到端验收登录、新增、修改、删除、图片、草稿隔离、手机排版、旧链接和导出备份，再切换 itfetter.com；确认 HTTPS 和重定向后再停用旧 Pages/旧代理。
9. 更新 README、AGENTS、交接文档；所有提交信息及修改说明用中文。

### 本次文档变更与验证
仅新增本交接章节，并在 README、AGENTS 增加迁移状态提示，保留历史记录。不修改业务代码，不创建云资源，不迁移文章，不切换域名。验证范围为远端文档读取及写入确认；没有重新运行旧后台测试或声明线上功能已完成。


> 更新于 2026-09-27。此处记录仓库中的实际实现；GitHub Pages 是否已构建成功及最新 HTTPS/DNS 状态以设置页和线上访问为准。后续修改记录和提交信息请使用中文。

## 当前开发到哪里

- 个人博客已部署在 `itfetter.com`，从 GitHub Pages 的 `main` 分支根目录发布；用户截图曾确认 HTTPS 可访问、Enforce HTTPS 已勾选，DNS Check 当时仍显示 In Progress。
- 首页原有的展示、搜索、分类与 `#post/hello`、`#post/note` 阅读方式保留。首页导航不显示登录入口，维护者可直接访问 `/admin/`。
- 文章从挤在 `posts.js` 的单行数据迁移为两篇 `_posts/*.md`；Jekyll 构建时生成文章独立页面与 `posts.js` 数据。首页分类按钮现在根据文章自动生成。
- `/admin/` 已改为可视化管理界面，但 Worker 和 GitHub App 尚未配置，当前只显示配置提示与 GitHub 备用入口；站内登录和保存仍未启用。
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
| `write/index.html` | 跳转 GitHub Issue 文章表单的备用入口。 |
| `admin/index.html` | 可视化后台，配置 Worker 后支持文章增删改与图片。 |
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
