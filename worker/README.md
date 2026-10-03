# Cloudflare 博客部署与迁移

程序源码保存在 GitHub；Cloudflare Workers + Static Assets 运行网站，D1 保存文章，R2 保存上传图片，Access 限定管理员。Worker 已不再调用 GitHub 写入文章，不需要 GitHub App、OAuth Secret、GitHub token 或 KV。所有配置与操作以下以同一个站点域名为例。

## 1. 准备账户配置

在 Cloudflare 控制台启用 Workers、D1、R2 和 Zero Trust Access；R2 可能要求先启用计费。无需向聊天发送任何密钥。在 `worker/` 执行：

```bash
npm ci
npx wrangler login
npx wrangler d1 create itfetter-blog
npx wrangler r2 bucket create itfetter-blog-images
```

将 `wrangler.example.jsonc` 复制为被忽略的 `wrangler.jsonc`，填写真实 D1 database_id 和 R2 bucket_name。配置 `ACCESS_TEAM_DOMAIN`（例如 `your-team.cloudflareaccess.com`）、Access 应用的 `ACCESS_AUD` 和唯一允许的 `ADMIN_EMAIL`。这些为配置标识，不是 API token。不要在生产配置中写 `ENVIRONMENT=development`。

## 2. 配置 Access

在 Zero Trust → Access → Applications 创建同一站点域名的 Self-hosted 应用，覆盖 `/admin`、`/admin/*` 和 `/api/*`。让这些路径使用同一应用 AUD；如果控制台要求拆分应用，需调整代码明确验证各自 AUD，不能随意混用。策略为 Allow，仅包含你的确切邮箱；选择邮箱验证码或受支持的身份提供商，不添加 Everyone 或 Bypass 策略。

首页、`/posts.js`、`/articles/*`、`/images/*` 为公开读者路径，不应要求登录。Worker 会再次验证 Access 签名、issuer、audience、过期时间和邮箱，即使有人绕过页面也无法调用管理 API。跨站写请求必须被拒绝。使用自定义域名作为正式入口，配置并检查 Access 覆盖；若保留 workers.dev 入口，也需确认后台在那里仍被拒绝，不以隐藏网址作为鉴权。

## 3. 初始化与导入（先验证，后切域名）

在仓库根目录运行 `npm --prefix worker run import:posts`，审查 `.migration/posts.sql`，备份现有 D1 后，在 `worker/` 执行：

```bash
npx wrangler d1 migrations apply itfetter-blog --remote --config wrangler.jsonc
npx wrangler d1 execute itfetter-blog --remote --config wrangler.jsonc --file ../.migration/posts.sql
npm run build
npx wrangler deploy --config wrangler.jsonc
```

线上命令由账户管理员执行；本次开发只验证了 `--local`，没有操作线上账户。SQL 保留原 `blog_id`、原发布日期和 permalink；重复导入不覆盖已存在的数据。导入前后核对文章总数及每篇正文；已有 `assets/` 图片仍随 Static Assets 提供，无需改文章引用。

先使用临时 Cloudflare 域名验证。正式切换前检查现有 DNS 和 GitHub Pages CNAME 状态，再把 `itfetter.com` 绑定到 Worker 自定义域名；不要在验证前移除旧发布入口。

## 4. GitHub 自动构建

在 Workers Builds 连接 GitHub 仓库。根目录设置 `worker`。由于真实 `wrangler.jsonc` 被忽略，在构建变量 `BLOG_WRANGLER_CONFIG` 提供完整 JSON 配置（只包含资源标识、Access 标识与邮箱，不放令牌）。构建命令：

```bash
node -e 'const fs=require("fs");const c=JSON.parse(process.env.BLOG_WRANGLER_CONFIG);if(c.vars?.ENVIRONMENT==="development")throw Error("禁止生产开发模式");fs.writeFileSync("wrangler.jsonc",JSON.stringify(c))'
npm ci
npm run build
```

部署命令：`npx wrangler deploy --config wrangler.jsonc`。平台部署权限通过 Cloudflare 的构建配置管理；不要把账户令牌写入仓库。更改程序源码才需要触发构建，文章发布不依赖构建。

## 5. 验收和清理

- 公开访问首页、分类、搜索、旧 `#post/hello` 及每个 `/articles/<id>/`。
- 未登录与其他邮箱不能进入后台或调用 API；管理员可以登录、退出、重新登录。
- 发布专用测试文章，刷新前台立即可见；编辑保留旧链接；两个编辑窗口的过期版本不能覆盖新版本。
- 上传 PNG/JPG/WebP/GIF，检查 `/images/` 图片可读；删除测试文章确认前台返回 404。
- 检查 D1 数据和 R2 上传，确认写作没有产生 GitHub 提交。

成功后再停用 GitHub Pages 和旧 Issue 发文工作流，备份并清理 `_posts/`、旧 `posts.js`、`_config.yml`、`CNAME`、旧 GitHub 发文脚本/表单。`_layouts/post.html` 当前仍用作构建时文章模板，不能直接删除。保留必要文档与模板源码；源码仓库要转私有，需由仓库设置另行处理，转私有不会清除已公开的历史。

## 备份与限制

D1 中的版本号用于并发保护，不是文章历史。现阶段不实现草稿、定时发布界面、审计记录、自动数据备份或图片清理。定期使用 `wrangler d1 export` 备份数据库，另行备份 R2；GitHub 源码备份不包含线上文章。Markdown 经渲染并清理危险 HTML 后公开展示，示例的 callout/text-accent 样式保留。
