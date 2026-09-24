# AGENTS.md — 博客项目开发与 AI 协作规则

适用于整个仓库。修改前阅读本文件、[README.md](README.md) 与 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)，以实际代码和 GitHub Pages 设置为准。**以后所有提交信息及修改记录均使用中文描述。**

## 项目与业务目标

这是 itfetter 的个人博客，托管于 GitHub Pages，域名 `itfetter.com`。目标是持续发布自己的文章与项目记录，同时保留 CSDN 入口。读者访问站点无需登录；文章发布由 GitHub 仓库写权限控制。不得把示例文章写成正式成果。

## 技术栈和项目地图

- GitHub Pages 从 `main` 分支 `/ (root)` 发布，内置 Jekyll 在构建时处理 Markdown 和 Liquid。前台仍为原生 HTML、CSS、JavaScript。
- 没有自有 API、服务端数据库、单独登录后端；`/admin/` 是公开导航页，登录与文件提交由 GitHub 负责。

| 路径 | 作用 |
| --- | --- |
| `_posts/YYYY-MM-DD-name.md` | 文章唯一内容来源；每篇一文件。 |
| `posts.js` | 带 YAML front matter 的 Liquid 模板；由 `site.posts` 输出前台文章数据，**勿手改数据**。 |
| `index.html` | 首页样式、文章列表、自动分类、筛选、搜索与 `#post/<id>` 旧链接。 |
| `_layouts/post.html` | 每篇文章的独立 HTML 页布局。 |
| `write/index.html` | 无需服务器的写作与预览页；仅在本机保留草稿，生成 Markdown 后由 GitHub 发布。 |
| `admin/index.html` | GitHub 登录入口、逐篇文件编辑入口及新增文章链接。 |
| `ARTICLE_TEMPLATE.md` | 新文章格式示例。 |
| `_config.yml` | Jekyll 的标题、网址、时区和 Markdown 设置。 |
| `CNAME` | Pages 主域名 `itfetter.com`。 |
| `README.md`、`PROJECT_HANDOFF.md` | 公开说明和项目进度/风险交接。 |

## 核心文章模型

每篇 Markdown 文件以 YAML front matter 开头，包含 `layout: post`、`title`、`category`、`summary`、`blog_id`、`date`、`permalink`，正文为 Markdown。文件名为 `YYYY-MM-DD-英文短名.md`。发布日期不要晚于计划发布时间，否则 Jekyll 默认可能不显示文章。

- `blog_id` 必须唯一且稳定；首页旧地址为 `#post/<blog_id>`。修改已发布 ID 会破坏旧链接。
- `permalink` 必须唯一，示例：`/articles/hello/`；与已存在网址冲突可能覆盖页面。
- `category` 决定自动生成的分类按钮；`summary` 用于列表；文章正文由 Jekyll 转 HTML。
- `posts.js` 把文章字段转成 JavaScript；`index.html` 的 `renderList()` 和 `route()` 实现搜索与阅读；首页置顶卡片当前固定指向 `hello`，更换时同步改文案及链接。
- Markdown 中尽量使用普通相对站点路径与 HTTPS 外链；只有可信作者可提交原始 HTML。前台详情通过 `innerHTML` 展示构建后的文章 HTML，不得将不可信用户输入直接注入。

## 可修改与谨慎修改

- 可以增改文章、修正文案、调整视觉与可访问性；必要时修改 Jekyll 布局或列表逻辑。优先保持现有博客首页布局和旧文章哈希地址。
- `CNAME`、Pages 分支/目录、DNS 属线上入口，明确域名迁移需求后才改。不要为了布局改版删除域名文件。
- 不随意更改文章 `blog_id`、`permalink`、现有 CSDN 链接，不把原站改为直接跳转页。
- 不将密码、个人令牌或私密信息写入公开仓库；也不要在纯前端实现假密码验证并宣称能限制发布。`/write/` 是公开可访问的本地草稿编辑器，不应请求 GitHub Token 或在浏览器直接写入仓库。

## API、数据库、前端、部署规则

- API/数据库：当前均无；如未来引入，要先明确数据模型、授权、迁移、备份和凭据保管方案。浏览器不保管 GitHub 写入令牌。
- 前端：维持响应式布局、键盘可用、清晰的替代文本。新增外部新窗口链接加 `rel="noopener noreferrer"`；尽量避免 HTTP 混合内容。
- 部署：GitHub Pages 构建 `main` 根目录；加入文章后检查 Pages/Actions 构建状态、首页和独立文章链接。Jekyll 构建后才会把 `posts.js` 模板转成可执行数据；仅用普通静态服务器预览源文件不等于线上效果。
- 命名：文章文件小写英文和连字符，`blog_id` 小写英文且稳定；已有 JS 字段与函数使用 camelCase。

## 测试与验收

文章变更至少检查 YAML 合法、发布日期、唯一 `blog_id` 和 `permalink`、Markdown 渲染、首页列表、分类、搜索、`#post/<id>` 与独立文章页。前端变更额外检查手机宽度和键盘操作；域名相关变更检查 HTTPS 与重定向。Jekyll 构建失败时查看 Pages 工作流日志，不得在未验证时宣称上线成功。没有现成自动测试，不为纯文档改动写形式化测试。

## AI 和开发人员修改前后的规范

1. 读取目标文件及本文档，确认现有改动，列出影响范围，保持最小必要修改。
2. 增文章请在 `_posts/` 建 Markdown；不要直接给 `posts.js` 填文章，更不要把密码写入前台。
3. 先检验文件格式与路径，再检查 Jekyll 构建及前台行为；无法验证的状态如实写明。
4. 更新 `PROJECT_HANDOFF.md` 的“文件、原因、验证、已知问题、待办”；改变编辑或部署方式时同步更新 README 与本文件。
5. 使用**中文提交信息**，向维护者说明修改内容、验证范围和剩余风险。尊重现有文章内容和未提交改动。
