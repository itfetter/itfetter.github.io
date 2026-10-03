# PROJECT_HANDOFF.md — itfetter 个人博客交接

> 更新于 2026-10-03。当前采用 Cloudflare 全站架构与自建账号密码登录，以顶部“自建管理员登录”及最新部署进度为依据；2026-09-27 及之前的内容为历史记录。后续提交信息和修改记录使用中文。

## 2026-10-03 GitHub 连接与首次实际部署（最新部署进度）

用户已在控制台连接仓库并创建构建令牌。API 核对 trigger d46e6bfd-80eb-467d-b8ce-2f735a375caa：仓库 itfetter/itfetter.github.io、生产 main、root=/worker、构建配置环境变量正确。通过 API 启动 build 228070b0-d5eb-4733-a8c9-a031f615ee9a，2026-10-03 09:15 UTC 云端构建及部署成功；8 项测试全部通过，生成静态资源并上传实际 Worker，覆盖旧 503 占位模块。部署版本 b3853eed-2be4-4f7f-9dac-24799a15c7ef，绑定 DB、IMAGES、ASSETS 均正确。依赖安装仅在 Cloudflare 云端进行。

临时入口 https://itfetter-blog.itfetterit.workers.dev 。首次 Wrangler 默认开启预览 URL，已通过 API 关闭 previews_enabled，同时构建环境 JSON 增加 preview_urls=false 防止后续再次打开；保留 workers.dev 主入口。正式域名未改。

本机 HTTP 请求受网络限制，web 工具也无法打开临时入口，因此目前只确认平台部署成功，不能宣称线上页面和登录验收通过。管理员初始化、5 篇旧文章导入、真实 Workers CPU/登录/CRUD/R2 验收仍待执行。当前没有默认密码，未初始化管理员时拒绝登录。此前应用创建章节为首次实际部署前的历史状态。本轮仅更新本交接文件，配置修改保存在 Cloudflare Builds，未提交账户配置或令牌。

## 2026-10-03 Worker 应用创建与绑定（历史状态）

用户要求继续创建应用、拉取 GitHub 并部署。通过 API 创建 Worker `itfetter-blog`，Worker tag 为 `8dda8f9ac9f24df8bc033d5c4e28580e`。已绑定 D1 `DB` 到 `62f6dd9a-23f8-4137-a6ce-b22be4f56e32`，R2 `IMAGES` 到 `itfetter-blog-images`，开启 observability，compatibility_date=2026-10-03、nodejs_compat。

当前仅上传创建应用用的最小占位模块，所有请求返回 503“博客构建尚未完成”。尚未上传仓库的实际 Worker 或 Static Assets，也未拉取构建仓库代码；不得称博客已部署。核对 settings 确认绑定准确；workers.dev enabled=false、previews_enabled=false，尚无公开临时入口。未改正式域名。

GitHub repo_connection_uuid 延用 `6743b7b9-ce99-4223-94d1-a362c7d63529`。build tokens 和该 Worker triggers 列表均为空。账户 token permission_groups API 返回 9109 Unauthorized，当前插件没有创建部署凭据所需权限；因此不能创建完整 Builds trigger，不能拿插件会话凭据替代部署 token。浏览器备用：Chrome 扩展连接报错；in-app browser 仅有未登录控制台页，无法操作用户已登录的 Chrome。

已为用户准备不含密码/令牌的完整构建配置，待在 Builds 环境变量 BLOG_WRANGLER_CONFIG 中设置。控制台操作入口为现有 Worker → Settings → Builds → Connect，选择目标仓库 main，root=worker；构建命令先从 BLOG_WRANGLER_CONFIG 写入 wrangler.jsonc，再 npm ci、npm test、npm run build；部署命令 npx wrangler deploy --config wrangler.jsonc。Cloudflare 的首次构建部署授权由控制台完成；不要在聊天发送 API token。账户配置不得提交公开仓库。

认证表已初始化但管理员数仍为 0；文章导入、管理员初始化、实际构建部署、CPU/登录/CRUD/R2 验收和正式域名切换尚待执行。应用最小占位模块在首次仓库部署时会替换，后续维护只通过源码构建。自建登录不再要求 Access。此次交接记录单独中文提交，源码本轮未改。

## 2026-10-03 自建管理员登录（当前有效方案）

用户明确改用自建账号密码登录，取消 Zero Trust / Access 作为部署前提。旧 Access 设计与下方 Access 阻塞记录仅作为历史依据。GitHub 保存源码、Workers + Static Assets、D1 文章、R2 图片、旧链接与版本冲突规则保持。

本次文件：worker/auth.js（scrypt 密码、哈希会话、共享限速）；worker/migrations/0002_auth.sql（单管理员、会话、限速表）；worker/index.js（登录/退出路由、会话鉴权、登录页跳转、同源/HTTPS 检查和管理页面响应头）；admin/index.html（账号密码表单、退出、过期提示）；scripts/create-admin.mjs（可信终端交互生成私密初始化/重置 SQL）；worker/auth.test.mjs 和 test.mjs（认证行为与路由回归）；worker/package.json（初始化和测试命令）；worker/wrangler.example.jsonc（移除 Access 变量、开启观测）；.github/workflows/validate-worker.yml（云端完整验证）；README、AGENTS 与本文件（当前流程和长期规则）。jose 不再用于运行时认证；暂保留锁文件中的旧依赖，避免无依赖安装的手工锁文件改写。

安全行为：不开放注册或公开密码重置，不设置默认管理员密码；未初始化管理员时拒绝登录。scrypt N=16384,r=8,p=5、16 字节随机盐、时序安全比较；会话随机 256 位，只存 SHA-256，最长 8 小时，HttpOnly/Secure/SameSite=Strict，退出撤销。密码重置版本检查防止并发登录产生仍有效的旧凭据会话。D1 原子登录计数，15 分钟 IP 10 次/全局100次（成功计数），429 带 Retry-After；该全局防护可使攻击期间管理员暂时无法登录。开发 HTTP localhost 仍需认证，取消原免登录模式。线上不得配置 development。

验证：本机 Node 24.19.0 的 4 项独立认证测试通过，覆盖随机盐、错误密码/账号、无管理员、Cookie 属性、哈希存储、换发、过期、退出撤销、重置版本、限速窗口和开发模式边界。完整项目依赖未安装，完整 Markdown/CRUD/构建回归交由新增 GitHub Actions；CI 结果及源码发布状态后续记录。尚未在 Workers runtime 测试 scrypt CPU 额度、真实浏览器与线上 D1/R2；不能沿用旧 Access 测试当成本次上线验收。没有安装本机依赖、下载工具链或改 DNS。

部署待办：应用新增迁移；在可信交互终端初始化管理员（不要聊天发送密码），导入私密 SQL 后移除临时文件；配置 Workers Builds 并部署，验收登录、限速、退出、CSRF、手机表单、旧链接、文章 CRUD、图片与 CPU/内存额度。当前未创建管理员、未部署 Worker、未切域名。已创建 D1/R2 和 GitHub 仓库连接继续复用，Access 无需继续配置。已开通 Zero Trust 不需关闭；截图确认团队域名存在，但插件近期 transport 错误，未完成线上操作。


实际发布与追加验证：自建登录代码、测试和文档在同一提交 `d379d3607944e39184d76a224bbc8e70708c8192` 发布到 GitHub main。GitHub Actions“验证博客 Worker”运行 `37105277637` 已完成且 success（https://github.com/itfetter/itfetter.github.io/actions/runs/37105277637），完整 npm test 与构建均通过。Cloudflare 插件随后恢复，通过 D1 query API 执行 0002_auth.sql 的所有语句并核对 admin_users、admin_sessions、login_limits 三表存在，管理员数为 0；这是实际线上建表操作，不是只生成本地 SQL。尚未通过 Wrangler 的迁移记录机制执行，后续运行 migrations 时注意核对；语句均为 IF NOT EXISTS。未写入密码或会话，未导入文章。Worker 列表仍为空，build tokens 列表也为空，自动构建与部署尚未配置完成。Access 已从部署前提中移除。

## 2026-10-03 GitHub 构建授权已恢复（最新补充）

用户通过 Cloudflare 控制台完成 GitHub 授权，截图显示 Continue with GitHub。随后 API 实际创建目标仓库连接成功：`itfetter/itfetter.github.io`，repo_connection_uuid 为 `6743b7b9-ce99-4223-94d1-a362c7d63529`。此前 8000008 / Git account disconnected 阻塞已解决。

同次核对：Worker 列表仍为空；Access organizations/apps 仍返回 9999 / access.api.error.not_enabled。用户已表示开通 Access，但接口尚未证实；需要核对团队域名、账户和开通流程是否完成，不能把用户操作截图或口述当成 API 已连通。构建 token 列表查询遇到 MCP transport 错误，未取得结果；没有创建 token、构建触发器或部署 Worker。本节仅记录已确认的账户状态变化，不含凭据。D1/R2 延用上次创建资源，正式域名未变动。

## 2026-10-03 Cloudflare 账户资源初始化（最新部署进度）

用户授权开始创建 Cloudflare 应用并部署。通过 Cloudflare 插件核对当前连接账户 `44bd0c60ac0075b4a4b9fea76032f0f9`；该账户起初没有 Worker、D1 或 R2，Workers 子域名为 `itfetterit.workers.dev`。它与历史规划中提到的 `itfetpro.workers.dev` 不同，不能混用历史账户资源。

已实际完成：
- 创建亚太 D1 数据库 `itfetter-blog`，UUID 为 `62f6dd9a-23f8-4137-a6ce-b22be4f56e32`。
- 按仓库 `worker/migrations/0001_posts.sql` 的结构通过 D1 API 初始化 `posts` 表和 `posts_published` 索引。未通过 Wrangler migration 命令执行；后续执行同一初始迁移前应核对迁移记录，其建表语句为 IF NOT EXISTS。
- 创建 R2 标准存储桶 `itfetter-blog-images`，位置 APAC。未启用公开桶访问，后续由 Worker 图片路由读取。
- 用户已确认唯一管理员登录邮箱；具体值应配置在 Cloudflare 账户配置中，不记入公开交接文档。

实际验证：创建接口均返回 success；查询 sqlite_master 确认 posts 表存在，文章数为 0。尚未导入旧文章，也没有上传图片。

阻塞与证据：
- Access 列表及组织查询返回 9999 / access.api.error.not_enabled；创建 Zero Trust organization 返回 10000 / Authentication error。当前连接不能完成初始化，需要通过账户控制台启用 Access，并检查插件所需权限。没有创建 Access 应用或放宽管理权限。
- 尝试为目标 GitHub 仓库建立 Workers Builds 仓库连接，接口返回 8000008 / Git account disconnected。需要账户控制台连接 GitHub，并授权 itfetter/itfetter.github.io；GitHub 插件的仓库访问不等于 Cloudflare 构建服务已获得访问。
- 浏览器控制台备用路径不可用：Chrome inventory 报连接错误；in-app browser 打开控制台超时，未完成任何控制台变更。

当前状态：D1/R2 已创建，D1 空表已初始化；Worker 未创建或部署，Access 未启用，Workers Builds 未连通，正式站点与 DNS 未改动。没有在本机安装依赖或下载构建环境。此次只更新本交接文件；正文中的旧“账户资源尚未创建”描述由本节更新。

继续前提与顺序：管理员启用 Access / Zero Trust 并连接 Cloudflare 的 GitHub 集成后，重新读取账户状态；创建同一 AUD 覆盖 admin 和 api 的应用、配置邮箱 Allow 策略，生成构建环境账户配置，连接 main 的 Workers Builds，导入并核对 5 篇旧文章，在临时域名验证权限、文章与图片后再切换正式域名。清理旧站仍须等验收通过。本交接通过 GitHub contents API 提交至 main；业务部署尚未发生。

## 最新交接：当前代码与部署状态

- 云端工作目录已完成 Workers + Static Assets + D1 + R2 + Access 改造，相关文件及验证结果见文末“2026-10-03 Cloudflare 全站架构迁移”。
- 当前改造已在云端 Git 提交并整合远端 3 个文档提交。此前推送的 403 权限阻塞已解决，2026-10-03 重新检查 `git push --dry-run origin HEAD:main` 成功；本次代码与维护文档通过正常推送发布到 GitHub main。推送结果以远端提交核对为准。线上 Cloudflare 资源配置、部署和域名切换尚未执行。
- 源码发布流程：修改代码 → 本地验证 → 提交到 GitHub 指定分支 → Cloudflare Workers Builds 自动拉取、构建和部署。Workers Builds 与仓库的连接目前尚未配置，不能宣称已经自动部署。
- 日常文章流程：在 `/admin/` 登录并写作 → 管理 API 保存到 D1，上传图片保存到 R2 → 前台直接读取最新数据，不产生 GitHub 提交，不触发代码构建。
- 维护以 GitHub 中的源码为准；正式连接自动构建后，避免在 Cloudflare 在线编辑另一份代码，以免下一次部署覆盖或产生不同步。
- 后续先提交并审查代码，再按 `worker/README.md` 配置 Cloudflare、连接 Workers Builds、导入旧文章并验收，最后切换域名与清理旧发布文件。保留已有文章和恢复依据。

## 2026-10-03 持续维护记录要求

用户明确要求：后续每次修改、更新和新增约束均同步记录，保证其他窗口能从仓库文件理解改动并继续维护。

本次修改 `AGENTS.md`，新增“必须持续记录的维护要求”：每次工作在本文件记录文件、原因、验证、问题、待办与提交/部署状态；长期规则及流程变动同步到 AGENTS，开发前必读，完成前检查文档覆盖，文档随代码提交。重要规则不能只存在于聊天中。本文同时记录此次要求，以便后续窗口接续。

验证：已核对两文件中的记录并执行 `git diff --check`。本次仅修改维护文档；当前迁移代码和文档仍未提交或推送到 GitHub，线上部署未执行。

## 当前文件地图与修改入口（2026-10-03）

此地图对应当前云端改造后的代码。新增、移动、删除文件或改变文件职责时必须更新本节；下面的历史项目地图只描述旧方案。接手时先确认 Git 状态和实际文件，不能把“实现完成”当成“线上已部署”。

### 当前源码和配置

| 文件或目录 | 内容与职责 | 什么时候修改，以及关联文件 |
| --- | --- | --- |
| `index.html` | 博客首页 HTML、CSS 和页面脚本；文章列表、分类、搜索、置顶卡片、旧 `#post/<id>` 阅读视图、CSDN 入口 | 改首页布局、筛选搜索、哈希阅读时修改；数据来自 Worker 的动态 `/posts.js`；阅读样式变化同时核对独立文章模板 |
| `admin/index.html` | 管理后台布局、编辑器、工具栏、预览、文章列表、发布编辑删除、图片上传、自建登录状态处理 | 改后台交互或字段时修改；字段/API 变化同步 `worker/index.js`；预览与最终渲染规则不同，需一并核对 |
| `_layouts/post.html` | 独立文章页 HTML/CSS 模板；构建时把 Liquid 转为占位符，运行时插入文章数据 | 改 `/articles/<id>/` 页面样式时修改；新增模板字段同步 `scripts/build.mjs` 和 Worker 模板替换逻辑；当前仍使用，不属于待删除文件 |
| `worker/index.js` | 请求路由、D1 会话验证、来源检查、D1 CRUD、版本冲突检查、图片上传/R2 读取、动态文章列表和文章页、Static Assets 转发 | 改接口、权限、数据读写或公开路由时修改；同步后台调用、测试和部署说明；文章数据通过 D1 参数绑定操作 |
| `worker/auth.js` | 密码哈希校验、会话建立/查询/撤销、HTTPS 与共享登录限速 | 修改认证策略时同步路由、数据库迁移、测试和部署文档 |
| `worker/auth.test.mjs` | 使用真实 SQLite 的独立认证测试，仅依赖 Node 内置模块 | 无依赖环境执行认证回归；完整路由回归在 test.mjs |
| `worker/migrations/0002_auth.sql` | 单管理员、带凭据版本的哈希会话、限速表 | 新增认证表；上线后结构变化新建迁移 |
| `scripts/create-admin.mjs` | 可信终端输入账号密码并生成私密初始化/重置 SQL | 修改初始化格式时同步 auth.js 与迁移；不公开注册 |
| `.github/workflows/validate-worker.yml` | GitHub Actions 云端安装依赖、测试与构建 | 修改 CI 验证流程时使用，禁止本机为了验证自动安装依赖 |
| `worker/content.js` | Markdown 转 HTML、危险 HTML 清理、标题等字段转义；允许的标签、属性、样式类与链接协议 | 改正文排版支持或渲染安全规则时修改；同步后台预览、文章样式和相关测试 |
| `worker/migrations/0001_posts.sql` | 初始 D1 `posts` 表与索引；id、标题、分类、摘要、正文、发布日期、永久链接、版本号、更新时间 | 数据结构后续变化新增迁移文件；同步 API、导入脚本和测试，不修改已上线迁移 |
| `worker/test.mjs` | 自动测试：账号密码与会话、D1 增删改/冲突、跨站写入、请求大小、图片接口、文章导入与公开时间 | 改权限、接口、数据模型、渲染或上传规则时补充相关行为验证；SQLite 为真实本地数据库，R2 接口测试使用内存实现 |
| `worker/package.json` | npm 构建、开发、测试、导入命令，以及运行和开发依赖 | 改工具命令或依赖时修改；同步锁文件、README 和环境启动说明 |
| `worker/package-lock.json` | 固定依赖解析结果，供 `npm ci` 重现安装 | 更新依赖时由 npm 生成，勿手工拼写版本或校验信息 |
| `worker/wrangler.example.jsonc` | 可提交的部署样例：Worker 入口、Static Assets、D1/R2 绑定及运行配置 | 改绑定名、资源结构或运行兼容设置时修改；同步代码和 `worker/README.md`，不填账户密钥 |
| `scripts/build.mjs` | 构建静态发布目录：只复制首页、后台和 `assets/`，生成独立文章模板 | 新增公开页面/资源或模板字段时修改白名单；不复制整个仓库，不发布后台源码、配置或文章 SQL |
| `scripts/import-posts.mjs` | 读取旧文章 YAML/Markdown，校验 id、链接、日期，生成不覆盖已有数据的 D1 SQL | 改旧文章迁移格式时修改；同步 D1 字段和导入测试，不自动执行线上导入或删除原文章 |
| `assets/` | 随程序发布的静态图片和设计资源；当前包含示例插画 | 修改站点固定资源时使用；后台上传的新增图片存 R2，不写此目录 |
| `.node-version` | Node.js 版本要求，当前为 24.19.0 | 升级运行环境时修改，并验证 SQLite 测试及 Wrangler 兼容性 |
| `.gitignore` | 忽略依赖、构建输出、本地状态、真实账户配置、开发变量和迁移数据 | 新增本地生成文件或敏感配置路径时同步；不要误忽略应提交的源码和锁文件 |
| `README.md` | 项目架构、开发命令、写作和数据说明、迁移状态概览 | 用户使用方法、开发流程或项目架构变化时更新 |
| `worker/README.md` | Cloudflare 资源创建、Access 策略、迁移导入、Workers Builds、部署和验收步骤 | 账户配置、部署命令、权限要求和迁移流程变化时更新 |
| `AGENTS.md` | 跨窗口通用协作规则、架构约束、安全要求、验证和文档维护要求 | 新增或改变长期规则时更新；每次开发前必读 |
| `PROJECT_HANDOFF.md` | 最新状态、文件地图、改动原因、验证证据、风险和待办，另保留历史记录 | 每次工作更新；涉及文件职责或结构时同步本地图，便于下一窗口定位修改入口 |

### 旧站兼容与迁移保留文件

| 文件或目录 | 当前角色与注意事项 |
| --- | --- |
| `_posts/*.md` | 5 篇旧文章的迁移来源，尚未删除；Cloudflare 正常运行读取 D1，修改这些文件不会直接修改线上 D1 文章。导入验收前保留 |
| `posts.js` | 旧 Jekyll 的文章列表模板；新 Cloudflare 的 `/posts.js` 由 `worker/index.js` 动态返回，构建不复制本文件 |
| `_config.yml`、`CNAME` | 旧 Pages/Jekyll 配置及域名文件；确认正式域名切换和恢复方案前保留，不作为新 Worker 配置 |
| `.github/workflows/publish-article.yml` | 旧 Issue 发文工作流，仍可写入 GitHub 并请求 Pages 构建；正式切换后需停用，避免两套写作来源 |
| `.github/ISSUE_TEMPLATE/publish-article.yml` | 旧 GitHub 发文表单；与旧工作流一起在迁移完成后处理 |
| `scripts/publish_article_from_issue.py` | 旧 Issue 内容解析、身份检查、写 Markdown 和请求 Pages 构建脚本；新 D1 写作不使用 |
| `write/index.html` | 已改为跳转 `/admin/` 的兼容页面；Cloudflare 实际 `/write/` 跳转由 Worker 路由处理 |
| `admin/config.js` | 保留旧文件位置，说明已改用同源 API；新后台不加载，不再配置单独 Worker 地址 |
| `ARTICLE_TEMPLATE.md` | 旧 Markdown/front matter 示例；用于理解迁移格式，不是新后台发布接口 |

### 生成文件及线上数据（不要直接当源码修改）

| 路径或资源 | 来源和维护方式 |
| --- | --- |
| `dist/`、`dist/article-template.html` | 由 `npm run build` 生成；修改对应源文件再重建，禁止只改生成文件 |
| `.migration/admin.sql` | 可信终端生成的私密管理员初始化/重置数据；不提交、不公开，导入后删除 |
| `.migration/posts.sql` | 导入脚本生成的文章数据；被忽略，核对并备份后执行，不能提交文章数据到源码仓库 |
| `worker/.wrangler/` | Wrangler 本地 D1/R2 和运行状态；被忽略，不是线上数据库 |
| `worker/node_modules/` | npm 安装的依赖；通过声明与锁文件管理，不手工修改作为修复 |
| `worker/wrangler.jsonc`、`worker/.dev.vars` | 被忽略的真实部署配置/本地开发变量；按部署文档管理，不提交密钥或生产开发模式 |
| Cloudflare D1 `posts`、R2 `IMAGES` | 正式文章和上传图片；通过管理 API 操作，源码提交不会替代数据备份 |

本次维护更新：用户要求增加文件地图以便其他 AI 定位修改。已核对实际文件和构建脚本，新增当前职责、关联修改入口、旧文件与生成数据说明，并同步 AGENTS 中的维护规则。仅修改文档，`git diff --check` 通过；尚未提交或推送，线上未变更。

## 历史交接记录（截至 2026-09-27）

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

## 2026-10-03 Cloudflare 全站架构迁移（当前开发状态）

本节更新早期 GitHub Pages/GitHub App 部署方案。用户要求 GitHub 仅保存源码，Cloudflare 运行前后台和保存文章。线上网站和 DNS 尚未改动，之前的 Pages 记录只作历史依据。

| 文件 | 原因 |
| --- | --- |
| `worker/index.js`、`worker/content.js` | 由 GitHub App/KV/仓库写入改成 Access JWT + D1/R2；公开列表和独立文章页动态读取 D1；安全渲染 Markdown |
| `worker/migrations/0001_posts.sql` | 文章表、唯一链接、原发布日期和更新版本保护 |
| `admin/index.html`、`index.html` | 同源 Access 登录、即时发布、数据库版本冲突；保留首页外观和旧文章链接并转义元信息 |
| `scripts/build.mjs`、`scripts/import-posts.mjs` | 静态发布白名单、独立文章模板构建、旧文章导入 SQL，禁止迁移覆盖已有内容 |
| `worker/package.json`、`worker/package-lock.json`、`worker/test.mjs` | 固定依赖、构建开发命令，SQLite/签名鉴权/图片测试 |
| `worker/wrangler.example.jsonc`、`.gitignore`、README、AGENTS | D1/R2/Static Assets 配置、忽略生成数据、迁移部署与协作规则 |

已生成 5 篇原文章导入 SQL，保留原标识、日期、正文和链接；原 `_posts/` 未删除。Static Assets 不包含文章源文件、账户配置、Worker 源码或迁移 SQL。示例插画作为静态资源保留，新增上传走 R2。

当前限制：没有草稿/修订历史/自动数据备份；删除是数据库删除而非保留 Git 历史；图片不会随文章删除。测试不替代真实 Cloudflare 账户的 Access 登录、线上 D1/R2 和 DNS 验收。

待办：管理员创建 D1/R2/Access、填写账户配置、导入并核对线上文章、部署临时域名验证；成功后绑定 itfetter.com、停用 Pages/旧 Issue 工作流、备份并清理旧文章源文件和旧发布配置。GitHub 是否转私有由仓库设置决定，本次未改变。

验证结果（本次云端）：4 项自动测试全部通过，覆盖 Access JWT 伪造/过期/错误受众/非管理员、D1 CRUD/冲突/原链接、跨站写入/请求大小/图片校验、导入重复执行与未来文章不公开；本地 Wrangler D1 migrations 和 5 篇文章导入成功。实际本地 HTTP 检查首页、动态 posts.js、独立文章和管理页面均为 200，文章源文件与 Worker 源码 URL 为 404。Chromium 浏览器验收首页 5 篇文章、搜索、分类、旧哈希链接、390px 手机布局、后台新建/编辑/删除并确认前台立即变化；无 JavaScript 错误，测试文章已删除。R2 上传的接口测试使用内存实现，线上 R2 与实际 Access 登录未验证。

补充：实际 Wrangler 本地 R2 上传 1×1 PNG 并公开读取成功（201/200、正确 MIME 和 PNG 内容）；本地存储位于被忽略的 `.wrangler/`，未写入线上存储。


## 其他窗口的迁移规划记录（2026-10-03，保留历史依据）

> 此节保留其他窗口在实现前记录的规划、截图证据和费用讨论；实施状态以本文顶部最新交接为准，费用与账户资源需实际核对。

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

## 2026-10-03 GitHub 推送与跨窗口记录合并

用户要求将当前改造推送到 GitHub。推送前发现远端 main 新增 3 个文档提交，已读取并保留其中的账户截图证据、费用讨论与迁移规划，防止覆盖其他窗口记录。当前实现尚未包含规划中的草稿、分页、Markdown 导出、软删除恢复与自动备份；这些仍需单独开发和验收，不能当作已实现。验证：4 项自动测试通过，git diff --check 通过；本次推送仅更新源码和维护文档，不执行 Cloudflare 部署或修改 DNS。提交与推送结果以实际 Git 命令确认。

推送实际结果：`git push origin HEAD:main` 返回 HTTP 403，GitHub 明确提示 `Permission to itfetter/itfetter.github.io.git denied to itfetpro`。已保留本地提交，未强制推送、未覆盖远端。账号权限解决后重新读取远端状态并推送；无需在聊天中提供令牌。

账号核查补充（2026-10-03）：用户已连接两个 GitHub 账号，环境截图显示目标仓库已关联。重新验证：`git ls-remote origin refs/heads/main` 成功；`git push --dry-run origin HEAD:main` 仍返回 403，明确标识请求身份为 itfetpro。当前工具未提供 GitHub 连接账号切换功能。因此结论仅是当前云环境的推送身份被拒绝，不能据此判断另一已连接账号也无权限。需让此云环境使用具备该仓库写权限的连接；不要抽取平台凭据或要求聊天提供 token。

## 2026-10-03 推送权限恢复与正式提交

用户调整权限后要求重新尝试。远端读取和推送预检成功，当前本地改造与远端 main 可正常快进合并，无需强制推送。此前 403 作为历史诊断保留，不再是当前阻塞；本次将代码、维护规则和文件地图一起推送至 main，并核对远端 HEAD 与本地提交一致。仅更新交接中的提交状态，不修改业务代码；git diff --check 通过，业务验证沿用此前通过的 4 项自动测试及浏览器验收。本次不执行 Cloudflare 部署或域名切换，Workers Builds 连通仍待账户配置与验收。

