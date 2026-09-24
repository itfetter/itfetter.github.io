# PROJECT_HANDOFF.md — 个人博客项目交接

> 更新日期：2026-09-24。此文件记录仓库可核实的状态和待验证事项。线上状态会变化，发布结果和 HTTPS 请以当前 GitHub Pages 设置页及实际访问为准。

## 当前开发到哪里

- 已创建公开仓库 `itfetter/itfetter.github.io`，提交独立静态博客首页；网站提供介绍、文章列表、分类筛选、搜索、文章阅读和 CSDN 入口。
- 博客目前只有建站欢迎文和一篇用于展示排版的示例随笔；内容现保存在 `posts.js` 的 `posts` 数组里；新增 `/admin/` 作为 GitHub 登录及文章编辑入口。该页面公开可访问，但只有仓库写入者可通过 GitHub 修改并发布；站内尚无带账号会话的后台表单。
- GitHub Pages 设置为从 `main` 的 `/ (root)` 发布。仓库 `CNAME` 内容为 `itfetter.com`；用户先前截图显示 Pages 的 DNS check successful、根域名能够打开博客；最新截图显示博客已可通过 HTTPS 访问。
- 2026-09-24 最新截图显示 GitHub Pages 的 Enforce HTTPS 已勾选，浏览器已能打开 `https://itfetter.com/`；同一截图中 DNS 检查仍显示 **DNS Check in Progress**。
- 文章数据已从 `index.html` 拆到 `posts.js`，新增 `admin/index.html`。本轮又在首页导航增加“登录”入口，并澄清当前仍跳转 GitHub 编辑器，站内登录和可视化编辑尚未实现；未修改 DNS 或 `CNAME`。

## 当前项目地图

| 文件 | 当前职责 |
| --- | --- |
| `index.html` | 首页 HTML、CSS、文章显示和交互逻辑；通过脚本加载 `posts.js`。 |\n| `posts.js` | 两篇既有文章的内容数据；后续增改文章的主要文件。 |\n| `admin/index.html` | GitHub 登录与编辑入口；本身不验证身份，GitHub 校验仓库写入权限。 |
| `CNAME` | 当前 Pages 主域名 `itfetter.com`。 |
| `README.md` | 项目介绍、快速开始、内容维护和部署说明。 |
| `AGENTS.md` | 开发与 AI 协作规则、数据约束、测试要求。 |
| `PROJECT_HANDOFF.md` | 开发状态、历史变更、风险及下一步。 |

## 每次修改记录

| 日期 | 修改文件 | 做了什么 | 为什么 |
| --- | --- | --- | --- |
| 2026-09-24（初建） | `index.html`、`README.md` | 创建单文件静态博客和基本编辑说明 | 从原有跳转入口发展为可独立阅读的个人博客。 |
| 2026-09-24（域名） | `CNAME`；另有阿里云 DNS 与 Pages 设置 | 将 Pages 主域名设为 `itfetter.com`，将 `@` 解析到 Pages IP、`www` 指向 `itfetter.github.io` | 使用自己的域名访问博客。域名和 DNS 修改由站点所有者操作；最终 Git 记录中的 `CNAME` 值为 `itfetter.com`。 |
| 2026-09-24（文档建设） | `AGENTS.md`、`PROJECT_HANDOFF.md`、`README.md` | 增加项目规则、交接状态和开发者快速上手文档 | 明确真实代码结构、线上状态与后续协作方式。 |
| 2026-09-24（HTTPS 状态更新） | `README.md`、`PROJECT_HANDOFF.md` | 记录 HTTPS 已可访问且 Enforce HTTPS 已勾选；保留 DNS 检查仍在进行中的状态 | 根据用户最新截图修正过时的待办与部署描述。 |

| 2026-09-24（文章管理入口） | `posts.js`、`index.html`、`admin/index.html`、`README.md`、`AGENTS.md`、`PROJECT_HANDOFF.md` | 分离文章数据，新增 GitHub 登录入口和编辑链接，更新使用说明及状态 | 让授权维护者通过 GitHub 登录和仓库写权限持续维护文章，不在公开 Pages 存密码。 |\n\n> 更早的逐次提交详情以仓库 Git 历史为准；表格概括阶段性变化，不假装记录了每一次操作。以后每次提交应在这里追加一行，写明实际文件及验证结果。

## 部署状态与位置

- GitHub 仓库：<https://github.com/itfetter/itfetter.github.io>
- 发布源：GitHub Pages，`main` 分支，仓库根目录。
- 主域名：`itfetter.com`；根目录 `CNAME` 已存在。
- 默认 GitHub 地址：`itfetter.github.io`；绑定域名后通常重定向到主域名。
- 2026-09-24 最新用户截图：浏览器已通过 HTTPS 打开 `itfetter.com`，Pages 的 Enforce HTTPS 已勾选；DNS Check 仍显示 In Progress。未单独核验 `www`、旧 GitHub 地址的跳转及截图之后的状态。

## 已知问题、限制和潜在问题

| 项目 | 当前情况 | 影响及后续检查 |
| --- | --- | --- |
| HTTPS 与域名检查 | 最新截图证实 `https://itfetter.com/` 可访问、Enforce HTTPS 已勾选；DNS Check 当时仍在进行中。 | 等待 DNS 检查结束；复测 `https://www.itfetter.com/` 与 HTTP 跳转。 |
| 文章数量与真实性 | 只有欢迎文和示例随笔。 | 对外展示前逐步替换示例；不把示例说成真实发布文章。 |
| 文章 HTML | `posts.js` 中的 `posts[].html` 用 `innerHTML` 注入。 | 当前是仓库受信任的静态内容；若接入外部数据或用户投稿，必须先安全处理，避免 XSS。 |
| 置顶卡片 | 文案和链接硬编码为 `#post/hello`。 | 更新置顶文章时需要同步维护卡片；否则会出现标题与正文不符。 |
| 分类筛选 | 按钮列表写死在 HTML 中。 | 新增分类时要同时更新按钮。 |
| 路由 | 使用 `#post/<id>`，不是服务端文章路径。 | 修改文章 id 将破坏已有链接；搜索仅匹配标题、摘要、分类。 |
| 外部资源 | Google Fonts 和 CSDN 链接依赖第三方可访问。 | 字体不可用时采用系统字体回退；外部链接失效需维护。 |
| 管理入口 | 首页已显示“登录”，指向公开的 `/admin/`；点击后仍跳至 GitHub 文件编辑器，无站内登录及表单式后台。 | GitHub 编辑需要仓库写权限；站内编辑需新增可信 OAuth 服务、授权校验和安全保存接口。 |\n| NS 与解析 | 曾在阿里云见到 NS 不一致提示；之前出现过 DNS check successful，最新截图却显示 DNS Check in Progress。 | 不据此断言解析出错；若检查长期不结束，再确认权威 NS、公网 DNS 与冲突记录。 |

## 风险

1. 修改或删除 `CNAME` 可能让域名失效；同时影响同账号项目 Pages 站点默认继承的域名。
2. 仓库公开，提交密钥、个人隐私或未授权内容将直接暴露。
3. 改动 `index.html` 底部脚本或文章 ID 可能破坏首页筛选、哈希链接和阅读视图。
4. 页面没有自动化测试与构建流程；修改后需手动检查浏览器表现及 Pages 部署。GitHub 登录路径与权限需要由站点所有者实际登录验证。
5. HTTPS 目前已可访问；日后变更 DNS、`CNAME` 或 Pages 设置后仍需复查证书和 HTTP 到 HTTPS 的跳转。

## 待办与下一步

1. 等待 Pages 的 DNS Check 完成；检查带 `www` 的入口、HTTP 到 HTTPS 和旧 GitHub 地址的跳转。
2. 使用 `/admin/` 登录 GitHub 后整理正式博客文章并替换示例随笔；按需将长期内容从 CSDN 同步到本站，确保作者有权发布。
3. 若目标为“在博客域名下登录、填写文章并保存”，设计并部署后端/OAuth 服务、会话管理、仓库写入授权和文章编辑 UI；确认服务提供方及 OAuth 应用配置。
4. 添加必要的网页元信息、站点图标和分享预览；实际需要时再做。
5. 每次后续变更同步更新本文件的修改记录、风险与下一步。
