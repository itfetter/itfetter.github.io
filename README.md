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
| `admin/index.html` | [文章管理入口](https://itfetter.com/admin/)，登录和编辑交由 GitHub。 |
| `_config.yml` | Jekyll 配置，包括域名、时区和 Markdown 处理器。 |
| `CNAME` | GitHub Pages 域名 `itfetter.com`，请勿随意删除。 |
| `AGENTS.md`、`PROJECT_HANDOFF.md` | 协作规范与当前交接状态。 |

## 新增文章

1. 打开博客的[管理入口](https://itfetter.com/admin/)，使用拥有仓库写权限的 GitHub 账号登录，然后点击“新增文章”。也可以直接打开仓库的 [`_posts` 目录](https://github.com/itfetter/itfetter.github.io/tree/main/_posts)。
2. 复制 [`ARTICLE_TEMPLATE.md`](ARTICLE_TEMPLATE.md) 的内容，新建 `_posts/YYYY-MM-DD-英文标题.md`。日期写文章发布日期，例如 `2026-09-24-my-first-post.md`。
3. 填写文件开头的元信息：`title`（标题）、`category`（分类）、`summary`（摘要）、`blog_id`（唯一稳定的英文标识）、`date`（含时区的发布日期）、`permalink`（独立文章网址），然后用 Markdown 写正文。
4. 在 GitHub 点击 **Commit changes**。提交到 `main` 后等待 Pages 部署，再检查博客首页和文章页。

旧文章的 `blog_id` 不要随意更换，否则原有的 `#post/hello` 这类链接会失效。分类按钮从文章的 `category` 自动生成；首页置顶卡片仍固定指向 `hello`，更换置顶时要修改 `index.html`。图片可放在仓库的 `assets/` 目录，在正文中使用 `![说明](/assets/文件名.jpg)`。

### 编辑已有文章

在管理入口的文章列表点击“编辑 Markdown”，即可进入该文章的 GitHub 文件编辑页。保存并提交后，Jekyll 会重新生成文章页和文章列表。站内 `/admin/` 是公开静态导航页，**没有自己的登录会话或可视化保存功能**；只有仓库写入者才能通过 GitHub 发布修改。无需单独的数据库或服务器。

## 本地预览与部署

仓库发布源是 GitHub Pages 的 `main` 分支、`/ (root)`。Pages 会使用内置 Jekyll 构建。修改文章后查看仓库 **Actions** 或 **Settings → Pages** 的构建结果。

只检查首页静态布局时可运行 `python3 -m http.server 8000` 并打开 `http://localhost:8000/`；此方法**不会运行 Jekyll**，直接打开源码中的 `posts.js` 也看不到部署后的文章列表。要在本地完整预览 Markdown 生成的页面，需要安装 Jekyll，并运行 `bundle exec jekyll serve`（需先自行准备相应的 Ruby/Gem 环境）；日常发布只需在 GitHub 提交，**不要求本地安装 Jekyll**。

原 `itfetter.github.io` 地址在绑定自定义域名后通常会跳转到主域名。2026-09-24 站点所有者截图显示 HTTPS 已可访问且已开启 Enforce HTTPS；当时 DNS Check 显示 In Progress，若调整域名解析请重新检查。

## 开发约定与下一步

修改功能前阅读 [AGENTS.md](AGENTS.md)；每次变化在 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) 记录。**后续提交信息与修改说明使用中文。** 当前文章只包含建站欢迎文与示例随笔，下一步应逐步换成正式文章。若未来确实需要在本站直接登录、填写表单和保存文章，仍需可靠的授权与写入服务，GitHub Pages 本身只提供静态托管。
