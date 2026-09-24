# itfetter 的个人博客

一个用 GitHub Pages 托管的个人静态博客，记录文章、项目和思考。网站主域名为 [itfetter.com](https://itfetter.com/)；站点已可通过 HTTPS 访问，GitHub Pages 的 **Enforce HTTPS** 已勾选（据站点所有者截图，2026-09-24）。仓库和网站目前均为公开内容。

页面包含响应式首页、文章列表、分类筛选、关键词搜索、站内文章阅读，以及通向 [CSDN 博客](https://blog.csdn.net/2301_79385221?type=blog) 的入口。目前的建站欢迎文和随笔用于展示站点结构；示例随笔可以替换成正式文章。

## 技术与目录

纯 HTML、CSS、原生 JavaScript，没有框架、后端、数据库或构建步骤。文章编辑通过 GitHub 账号及仓库写权限控制。

| 路径 | 作用 |
| --- | --- |
| [`index.html`](index.html) | 站点页面、样式、列表/筛选/搜索和文章阅读逻辑。 |\n| [`posts.js`](posts.js) | 文章数据及正文。 |\n| [`admin/index.html`](admin/index.html) | [文章管理入口](https://itfetter.com/admin/)；登录后跳转到 GitHub 编辑文件。 |
| [`CNAME`](CNAME) | GitHub Pages 自定义域名 `itfetter.com`。 |
| [`AGENTS.md`](AGENTS.md) | 开发与 AI 协作约定。 |
| [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md) | 当前进度、变更记录、已知问题与下一步。 |

## 快速开始

1. 克隆仓库：`git clone https://github.com/itfetter/itfetter.github.io.git`
2. 进入目录：`cd itfetter.github.io`
3. 直接用浏览器打开 `index.html` 查看页面。也可用本地静态服务器预览，例如 `python3 -m http.server 8000`，然后访问 `http://localhost:8000/`。
4. 修改 `index.html` 并在浏览器刷新；本项目不需要运行 `npm install` 或启动后端。

### 添加文章

在 `posts.js` 中找到 `posts` 数组，复制一个文章对象并更新：

- `id`：唯一且稳定的英文标识；文章链接为 `#post/<id>`，旧文章的 `id` 不要随意修改。
- `title`、`category`、`date`、`summary`：列表与文章页显示的文字。
- `html`：文章 HTML 正文，仅加入已审阅的可信内容。

若添加了新分类，同时在 `index.html` 的 `.filters` 区域增加对应筛选按钮。首页置顶卡片目前单独指向 `#post/hello`；换置顶文章时，连同卡片的链接、标题、摘要一起更新。更多字段、逻辑与编辑约束参见 [AGENTS.md](AGENTS.md)。

### 登录与权限\n\n访问 [文章管理入口](https://itfetter.com/admin/)，点击“使用 GitHub 登录并编辑”后进入 GitHub 的 `posts.js` 文件编辑页。已有 GitHub 登录会直接打开编辑页；没有仓库写权限的账号无法向本仓库提交发布。新增或修改文章后点击 GitHub **Commit changes**，等待 Pages 重新部署。\n\n`/admin/` 是公开可访问的静态导航页，**不是带密码保护的后台**；身份验证、授权与实际保存均由 GitHub 完成。页面不收集密码或令牌。若未来希望在 `itfetter.com` 上直接使用表单编辑并保存，需要另外部署安全的登录与写入服务。\n\n## 部署和域名

当前 GitHub Pages 配置为 **Deploy from a branch → main → / (root)**。将更改推送到 `main` 后，前往仓库 **Actions** 或 **Settings → Pages** 查看部署结果。首页文件必须保持在仓库根目录的 `index.html`。

`CNAME` 保存主域名 `itfetter.com`。域名提供商的 DNS 需单独配置：根域名指向 GitHub Pages 的官方 A 记录，`www` 可通过 CNAME 指向 `itfetter.github.io`。绑定自定义域名后，原 `itfetter.github.io` 地址通常会重定向到主域名。修改 `CNAME` 前，请先核对仓库 Pages 设置与 DNS；2026-09-24 的截图显示 HTTPS 可用且 Enforce HTTPS 已勾选；当时设置页仍显示 **DNS Check in Progress**，如调整解析请再次核对状态。域名设置的详细过程可参阅 [GitHub 官方文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。

## 开发与检查

修改页面后，至少检查首页、文章链接直达、分类、搜索、窄屏布局和外部链接；提交后再确认 Pages 部署。仓库没有自动测试脚本或 CI 测试门禁。不要向公开仓库提交 API 密钥或私密内容。

## 下一步

- 复查 Pages 中仍显示 **DNS Check in Progress** 的域名检查提示，并验证 `www` 与旧 GitHub 地址的跳转。
- 通过 `/admin/` 的 GitHub 编辑入口，用正式文章替换示例随笔并逐步完善内容与分类。
- 当文章数量增长时，再评估是否需要将文章拆分为独立文件。

项目最新状态、未解决问题及修改历史记录在 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)。
