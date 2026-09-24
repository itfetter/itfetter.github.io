# itfetter 的个人博客

基于 GitHub Pages 的静态个人博客，默认地址：<https://itfetter.github.io/>。

## 页面内容

- 自适应首页、文章列表、分类筛选和搜索
- 站内文章阅读视图与 CSDN 博客入口
- 无需后端或构建步骤，直接发布仓库根目录的 `index.html`

## 添加或修改文章

打开 `index.html`，找到末尾 `<script>` 里的 `posts` 数组。复制现有文章对象，修改：

- `id`：英文 URL 标识，不能重复
- `title`、`category`、`date`、`summary`：列表与文章页信息
- `html`：文章正文，可使用 HTML 标记

同时按需修改文章分类按钮。首页的置顶卡片目前指向 `#post/hello`；更换置顶文章时请一起修改链接和标题。当前的两篇文章为建站欢迎文与示例随笔，不代表已发表的其他内容。

## 发布

进入仓库 **Settings → Pages**，在 **Build and deployment** 中选择 **Deploy from a branch**，分支设为 `main`，目录设为 `/(root)`，保存后等待构建。若日后绑定个人域名，在同一页面配置 Custom domain，并按 GitHub 指引设置 DNS。
