# 博客文章后台部署

主站仍由 GitHub Pages 托管，`/admin/` 在主站展示。此 Worker 只处理 GitHub 授权与文章 API。后台启用前，`/admin/` 显示配置说明及旧的 GitHub 入口；不要在公开文件里填写任何密钥。

## 1. 预留 Worker 地址

先在 Cloudflare Workers 创建 `itfetter-blog-admin`，记下它的 `https://<名字>.<账号>.workers.dev` 地址。此时可以先不启用后台，地址将用于下一步设置准确的 GitHub 回调。

## 2. 注册 GitHub App

在 GitHub **Settings → Developer settings → GitHub Apps → New GitHub App** 新建一个私有用途的 App：

- Homepage URL：`https://itfetter.com/`
- Callback URL：`https://<你的 Worker 地址>/auth/callback`
- Repository permissions：**Contents: Read and write**；Metadata 为默认只读。Webhooks 不需要，可关闭。
- 安装范围仅选择 `itfetter/itfetter.github.io` 这一个仓库，不授予所有仓库。
- 记录 **Client ID**，生成 **Client Secret**。不要把 Secret 填入仓库。

App 的用户访问令牌受到 App 权限和 itfetter 本人仓库权限的双重限制。后台又核对 GitHub 的数字用户 ID `138357073`，因此别的账号即使授权了 App 也不能保存文章。

## 3. 部署 Cloudflare Worker

在刚创建的 Worker 中使用本目录的 `index.js` 代码；也可以在本目录运行 `npm install` 后用 Wrangler CLI 部署。创建一个 KV namespace 供一次性登录票据和会话使用，将其绑定名设为 `SESSIONS`。

参考 `wrangler.example.jsonc` 填入真实 KV ID、GitHub App Client ID，并将文件复制为 `wrangler.jsonc`；`GITHUB_CLIENT_SECRET` 要通过 Cloudflare 的 **Secrets** 配置，不能写进 `wrangler.jsonc`。如果用 Wrangler CLI，可在本目录运行 `npx wrangler secret put GITHUB_CLIENT_SECRET`。不要把真实配置或本地密钥文件提交到公开仓库。

Worker 环境变量：

| 名称 | 值 |
| --- | --- |
| `ADMIN_ORIGIN` | `https://itfetter.com`（不能带末尾斜杠） |
| `GITHUB_CLIENT_ID` | GitHub App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub App 的 Client Secret，设为 Secret |
| `SESSIONS` | KV namespace 绑定 |

Worker 部署后拿到 `https://<名字>.<账号>.workers.dev`，将这个完整根地址填入 `admin/config.js` 的 `BLOG_ADMIN_API`，提交到 `main`。再把同一地址加 `/auth/callback` 设置到 GitHub App Callback URL。两处地址必须一致且为 HTTPS。

## 4. 验证

1. 打开 `https://itfetter.com/admin/`，点击 GitHub 登录；退出和重新登录都应正常。
2. 用其他 GitHub 账号登录应收到 403，不能增改删。
3. 用 itfetter 账号新建一篇文章，确认仓库出现 `_posts/YYYY-MM-DD-slug.md`，Pages 构建后首页可见。
4. 编辑文章后检查标题、摘要、正文和旧 URL 均正确；上传 PNG/JPG 测试图片是否能在文章显示。
5. 删除前先用非正式测试文章，确认二次弹窗、仓库提交及首页撤下。

自动 Issue 发布工作流仍保留为备用入口，后台未启用时可从 `/write/` 发文。Worker 使用的是 GitHub App 的**用户**令牌提交，不是 Actions 的 `GITHUB_TOKEN`；通常会触发当前按分支部署的 Pages 构建，仍须以 Actions 实际结果为准。

## 安全与局限

- `/admin/` 的静态 HTML 可公开读取；只有后台 API 登录鉴权后才允许读取文章源码和修改仓库。网址隐藏不等于保护。
- 浏览器只保存短期会话 ID 于当前标签的 `sessionStorage`，不会接收 GitHub access token。GitHub token 只保存在 Worker 绑定的 KV 中，到期后会话失效；退出会删除会话。
- KV 存放短期凭据，应启用 Cloudflare 账号保护并限制 Worker 管理权限。若 GitHub App 凭据泄露，立即撤销并轮换。
- 图片目前限制 5 MB 的 PNG、JPG、WebP、GIF，提交到 `assets/uploads/`；文章删除不会自动删除已上传的图片。
- 删除文章会创建 Git 提交，旧内容仍在仓库历史中；如要彻底移除敏感信息需另外处理 Git 历史。
