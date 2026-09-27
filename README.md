# itfetter 的个人博客

使用 GitHub Pages 托管的个人静态博客：[https://itfetter.com/](https://itfetter.com/)。文章采用“一篇 Markdown 一个文件”，提交到 GitHub 后自动构建和发布。现有页面包含首页、文章列表、分类筛选、搜索、阅读视图和 CSDN 博客入口。

## 项目结构

| 文件或目录 | 用途 |
| --- | --- |
| `index.html` | 首页样式、文章列表、搜索、自动分类与旧版 `#post/<id>` 阅读链接。 |
| `_posts/YYYY-MM-DD-name.md` | **文章源文件**，一篇文章一个文件。 |
| `_layouts/post.html` | 文章独立页面的布局，地址如 `/articles/hello/`。 |
| `posts.js` | Jekyll 模板，部署时由 `_posts/` 自动生成前台文章数据；请勿在这里手工写文章。 |
| `ARTICLE_TEMPLATE.md` | 新文章的可复制模板。 |
| `write/index.html` | [写作入口](https://itfetter.com/write/)跳转至 GitHub 登录文章表单。 |
| `admin/index.html`、`admin/config.js` | 可视化文章后台；部署授权 Worker 后启用登录与增删改。 |
| `_config.yml` | Jekyll 配置，包括域名、时区和 Markdown 处理器。 |
| `CNAME` | GitHub Pages 域名 `itfetter.com`，请勿随意删除。 |
| `AGENTS.md`、`PROJECT_HANDOFF.md` | 协作规范与当前交接状态。 |

## 新增文章

新增文章：打开 [写作入口](https://itfetter.com/write/)，会跳转到 GitHub 的 [发布文章表单](https://github.com/itfetter/itfetter.github.io/issues/new?template=publish-article.yml)。登录 itfetter 账号，接在 `[发布文章]` 后填写标题，填分类、摘要与 Markdown 正文（可预览并拖入图片），点击 **Submit new issue**。工作流核对作者身份后自动生成 `_posts/YYYY-MM-DD-article-序号.md`，请求 Pages 构建，并在 Issue 留下文章链接。无需复制内容或手工新建文件。Issue 在提交后公开；发布可能需等待 Pages 构建。当前 `/write/` 是公开跳转页，真正的登录编辑器位于 GitHub；只允许 itfetter 的 GitHub 用户 ID 自动发布。自动方式仅支持新文章，已发布文章仍到 GitHub 编辑原文件。

手工方式仍可使用：

1. 打开博客的[管理入口](https://itfetter.com/admin/)，使用拥有仓库写权限的 GitHub 账号登录，然后点击“新增文章”。也可以直接打开仓库的 [`_posts` 目录](https://github.com/itfetter/itfetter.github.io/tree/main/_posts)。
2. 复制 [`ARTICLE_TEMPLATE.md`](ARTICLE_TEMPLATE.md) 的内容，新建 `_posts/YYYY-MM-DD-英文标题.md`。日期写文章发布日期，例如 `2026-09-24-my-first-post.md`。
3. 填写文件开头的元信息：`title`（标题）、`category`（分类）、`summary`（摘要）、`blog_id`（唯一稳定的英文标识）、`date`（含时区的发布日期）、`permalink`（独立文章网址），然后用 Markdown 写正文。
4. 在 GitHub 点击 **Commit changes**。提交到 `main` 后等待 Pages 部署，再检查博客首页和文章页。

旧文章的 `blog_id` 不要随意更换，否则原有的 `#post/hello` 这类链接会失效。分类按钮从文章的 `category` 自动生成；首页置顶卡片仍固定指向 `hello`，更换置顶时要修改 `index.html`。图片可放在仓库的 `assets/` 目录，在正文中使用 `![说明](/assets/文件名.jpg)`。参考[图文排版示例](/articles/rich-markdown-demo/)学习图片说明、表格、提示框、重点色和代码块。示例配图为仓库内的 `assets/writing-flow.svg`，可替换为自己的图片。

### 可视化文章后台

仓库中已加入 `/admin/` 的文章列表、Markdown 编辑/预览、上传图片、发布、编辑和删除界面，以及 `worker/` 中的 GitHub App 授权 API。**目前后台服务尚未部署，`admin/config.js` 为空，因此在线页面只显示配置提示和旧 GitHub 入口，尚不能在站内保存。**

启用顺序：先创建仅安装到本仓库且具有 Contents 读写权限的 GitHub App；部署 Cloudflare Worker，配置 KV、Client ID 与保存在 Worker Secrets 的 Client Secret；把 Worker HTTPS 根地址写入 `admin/config.js`；再测试登录、新建、编辑、图片和删除。具体字段与步骤见 [worker/README.md](worker/README.md)。后台只接受 itfetter 用户 ID `138357073`，浏览器不会收到 GitHub 写入令牌。授权服务采用 GitHub App 的用户令牌向仓库提交内容；Pages 构建仍需核对 Actions 结果。

在后台启用之前，已有文章仍可在 GitHub 的 `_posts/` 目录直接编辑；`/write/` 的 Issue 发文入口继续可用。已发布文章的 `blog_id` 和 `permalink` 在后台编辑时保持固定；删除会撤下网站页面，但不会抹除 Git 历史。图片上传到 `assets/uploads/`，删除文章不会自动删图片。

## 本地预览与部署

仓库发布源是 GitHub Pages 的 `main` 分支、`/ (root)`。Pages 会使用内置 Jekyll 构建。修改文章后查看仓库 **Actions** 或 **Settings → Pages** 的构建结果。

只检查首页静态布局时可运行 `python3 -m http.server 8000` 并打开 `http://localhost:8000/`；此方法**不会运行 Jekyll**，直接打开源码中的 `posts.js` 也看不到部署后的文章列表。要在本地完整预览 Markdown 生成的页面，需要先安装 Ruby 与 Jekyll，再运行 `jekyll serve`（本仓库尚未配置 Gemfile）；日常发布只需在 GitHub 提交，**不要求本地安装 Jekyll**。

原 `itfetter.github.io` 地址在绑定自定义域名后通常会跳转到主域名。2026-09-24 站点所有者截图显示 HTTPS 已可访问且已开启 Enforce HTTPS；当时 DNS Check 显示 In Progress，若调整域名解析请重新检查。

## 开发约定与下一步

修改功能前阅读 [AGENTS.md](AGENTS.md)；每次变化在 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) 记录。**后续提交信息与修改说明使用中文。** 当前文章只包含建站欢迎文与示例随笔，下一步应逐步换成正式文章。本站后台代码已准备好，需完成 GitHub App 与 Cloudflare Worker 的账户配置才能启用；GitHub Pages 本身只托管静态界面。
