# PROJECT_HANDOFF.md — itfetter 个人博客交接

> 更新于 2026-09-24。此处记录仓库中的实际实现；GitHub Pages 是否已构建成功及最新 HTTPS/DNS 状态以设置页和线上访问为准。后续修改记录和提交信息请使用中文。

## 当前开发到哪里

- 个人博客已部署在 `itfetter.com`，从 GitHub Pages 的 `main` 分支根目录发布；用户截图曾确认 HTTPS 可访问、Enforce HTTPS 已勾选，DNS Check 当时仍显示 In Progress。
- 首页原有的展示、搜索、分类与 `#post/hello`、`#post/note` 阅读方式保留。
- 文章从挤在 `posts.js` 的单行数据迁移为两篇 `_posts/*.md`；Jekyll 构建时生成文章独立页面与 `posts.js` 数据。首页分类按钮现在根据文章自动生成。
- `/admin/` 逐篇链接到 GitHub 的 Markdown 编辑器，也可新建文件；仍是公开静态页，登录及发布权限由 GitHub 控制。**尚无站内输入密码、可视化编辑并直接保存的后台。**
- 此轮新增 `ARTICLE_TEMPLATE.md` 供写文章复制，README 与 AGENTS 已更新。用户要求以后提交及变更描述用中文，已写入协作规则。

## 项目地图

| 路径 | 用途 |
| --- | --- |
| `index.html` | 首页样式与阅读、搜索、筛选脚本。 |
| `_posts/2026-09-24-hello.md` | 欢迎文章。 |
| `_posts/2026-09-24-note.md` | 示范随笔。 |
| `_layouts/post.html` | Jekyll 独立文章页。 |
| `posts.js` | Jekyll 从文章源文件自动生成的 JS 模板，源码中包含 Liquid。 |
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
| 2026-09-24（本轮） | `_config.yml`、`_layouts/post.html`、`_posts/*.md`、`posts.js`、`admin/index.html`、`index.html`、`ARTICLE_TEMPLATE.md`、三个项目文档 | 一篇文章一个 Markdown 文件，构建时自动生成列表与独立页面，逐篇编辑；提交信息改中文。 | 已在线检查首页显示两篇文章及自动分类，`/articles/hello/` 正常显示 Markdown 正文，`/admin/` 显示逐篇编辑和新增入口；尚未使用账号实际提交新文章。 |

## 已知问题与风险

1. `posts.js` 的源码现在是 Liquid 模板，不经 GitHub Pages Jekyll 构建不能直接作为普通 JS 执行；若部署工作流禁用 Jekyll，首页文章列表会失效。先查看 **Actions → pages build and deployment**。
2. 两篇文章迁移时保留了主要内容、原 `blog_id` 和哈希链接；已在线确认 `/articles/hello/` 可访问；`/articles/note/` 尚未逐页检查。
3. `/admin/` 是公开页面；仅 GitHub 控制仓库修改权限。想在自己域名下安全地直接编辑/保存仍需要可信授权服务，不能把密码或 GitHub 写入令牌放进公开静态页面。
4. 首页置顶卡片文案/链接仍写在 `index.html`，改置顶需同步修改。Markdown 原文如果包含不可信 HTML，应在发布前审查。
5. 使用 GitHub Pages 内置 Jekyll，文章发布日期与时区有关；未来日期可能导致新文章暂不出现在列表。文章源文件以 `YYYY-MM-DD-name.md` 命名。
6. 修改 `CNAME`、DNS 或 Pages 设置会影响线上域名和 HTTPS；现有域名及配置未在此轮修改。
7. 示例随笔应替换成真实文章。Google Fonts / CSDN 链接依赖外部可用性。

## 下一步

1. 首页两篇文章、分类和 `/articles/hello/` 已核对；继续检查搜索、旧版 `#post/hello`、`/articles/note/` 与仓库 Pages 构建状态。
2. 用站点所有者的 GitHub 账号检查 `/admin/` 的登录、逐篇编辑与新建文件；提交一篇测试文章后确认 Pages 自动更新。
3. 后续更新文章直接改 `_posts/*.md`，不要直接编辑 `posts.js`。持续记录中文提交信息、实际变更和验证结果。
4. 内容增加时再评估图片、站点图标、分享预览和必要的文章管理体验改进；若要站内写作与发布，另行设计安全的授权/写入服务。
