# Cloudflare 博客部署与迁移

程序源码保存在 GitHub；Cloudflare Workers + Static Assets 运行网站，D1 保存文章，R2 保存上传图片，D1 账号密码与会话限定管理员。Worker 已不再调用 GitHub 写入文章，不需要 GitHub App、OAuth Secret、GitHub token 或 KV。所有配置与操作以下以同一个站点域名为例。

## 1. 准备账户配置

在 Cloudflare 控制台启用 Workers、D1 和 R2（无需 Zero Trust / Access）；R2 可能要求先启用计费。无需向聊天发送任何密钥。在 `worker/` 执行：

```bash
npm ci
npx wrangler login
npx wrangler d1 create itfetter-blog
npx wrangler r2 bucket create itfetter-blog-images
```

将 `wrangler.example.jsonc` 复制为被忽略的 `wrangler.jsonc`，填写真实 D1 database_id 和 R2 bucket_name。无需填写 ACCESS_TEAM_DOMAIN、ACCESS_AUD 或 ADMIN_EMAIL。不要在生产配置中写 `ENVIRONMENT=development`。

## 2. 初始化管理员账号（自建登录）

先执行所有 D1 migrations（包括新增的 0002_auth.sql），再在有 Node.js 24 的可信交互终端运行：

```bash
npm --prefix worker run create:admin
```

工具只依赖 Node 内置模块，不必为此安装 npm 依赖。输入账号及 6–128 字符密码，密码不回显，不要通过聊天或命令行参数发送密码。工具生成被忽略的 .migration/admin.sql，只包含随机盐 scrypt 哈希，不保存密码原文。该文件仍为私密认证数据，不上传 GitHub 或 Static Assets。

在可信部署环境执行生成 SQL（选择 local 或 remote，不要误用）：

```bash
cd worker
npx wrangler d1 execute itfetter-blog --remote --config wrangler.jsonc --file ../.migration/admin.sql
```

核对后删除私密 SQL。首次导入创建唯一管理员；再次导入更新账号密码并撤销旧会话，用于忘记密码或应急恢复。恢复需要 Cloudflare 账户数据库写权限，没有公开注册或重置接口。

访问 /admin/ 未登录时跳转 /admin/login/，输入账号密码登录。会话随机令牌通过 HttpOnly / Secure / SameSite=Strict Cookie 保存，D1 仅保存 SHA-256 摘要及 8 小时有效期；退出立即删除会话，密码重置的版本变化使旧会话失效。每个管理 API 独立检查会话，不能通过伪造 Access 请求头绕过。写请求必须匹配同源 Origin。

登录限制为每 IP 每 15 分钟 10 次、全站每 15 分钟 100 次尝试（成功也计数），D1 原子计数，响应 429 带 Retry-After。全站限速会在攻击时暂时阻止管理员登录；没有无限锁定。密码 scrypt 参数 N=16384,r=8,p=5，需要在实际 Worker 测试 CPU/内存额度；免费额度下是否能完成须实测，不以降低哈希强度规避限制，也不自动升级付费套餐。

如果曾为本站创建 Access 应用，应在正式自建登录验收后移除该应用对本站 admin/api 路径的拦截，避免双重登录。已开通 Zero Trust 无需关闭整个账户。当前没有已确认的 Access 应用。

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

在 Workers Builds 连接 GitHub 仓库。根目录设置 `worker`。由于真实 `wrangler.jsonc` 被忽略，在构建变量 `BLOG_WRANGLER_CONFIG` 提供完整 JSON 配置（只包含资源标识和非敏感配置，不放密码、哈希或令牌）。构建命令：

```bash
node -e 'const fs=require("fs");const c=JSON.parse(process.env.BLOG_WRANGLER_CONFIG);if(c.vars?.ENVIRONMENT==="development")throw Error("禁止生产开发模式");fs.writeFileSync("wrangler.jsonc",JSON.stringify(c))'
npm ci
npm run build
```

部署命令：`npx wrangler deploy --config wrangler.jsonc`。平台部署权限通过 Cloudflare 的构建配置管理；不要把账户令牌写入仓库。更改程序源码才需要触发构建，文章发布不依赖构建。

## 5. 验收和清理

- 公开访问首页、分类、搜索、旧 `#post/hello` 及每个 `/articles/<id>/`。
- 未登录、错误账号/密码、过期或伪造 Cookie 无法进入后台或调用 API；测试跨站登录、限速、退出后旧 Cookie 和重置密码后旧会话均被拒绝。管理员可以登录、退出、重新登录。
- 发布专用测试文章，刷新前台立即可见；编辑保留旧链接；两个编辑窗口的过期版本不能覆盖新版本。
- 上传 PNG/JPG/WebP/GIF，检查 `/images/` 图片可读；删除测试文章确认前台返回 404。
- 检查 D1 数据和 R2 上传，确认写作没有产生 GitHub 提交。

成功后再停用 GitHub Pages 和旧 Issue 发文工作流，备份并清理 `_posts/`、旧 `posts.js`、`_config.yml`、`CNAME`、旧 GitHub 发文脚本/表单。`_layouts/post.html` 当前仍用作构建时文章模板，不能直接删除。保留必要文档与模板源码；源码仓库要转私有，需由仓库设置另行处理，转私有不会清除已公开的历史。

## 备份与限制

D1 中的版本号用于并发保护，不是文章历史。现阶段不实现草稿、定时发布界面、审计记录、自动数据备份或图片清理。定期使用 `wrangler d1 export` 备份数据库，另行备份 R2；GitHub 源码备份不包含线上文章。Markdown 经渲染并清理危险 HTML 后公开展示，示例的 callout/text-accent 样式保留。

