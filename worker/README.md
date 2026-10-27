# Cloudflare 部署参考（兼容方案）

项目的主要开发、联调与部署流程使用云服务器 Docker + Node.js + SQLite + 本地图片，见 [云服务器部署指南](../docs/LINUX_DOCKER_MIGRATION.md)。本篇仅适用于选择继续运行或维护 Cloudflare Workers + Static Assets + D1 + R2 的实例，涵盖该兼容方案的首次部署、更新和故障恢复。GitHub Pages、Issue 发文和 Access 登录属于历史方案，不属于本指南的部署前提。

> 已经运行的 Cloudflare 实例：日常更新从第 8 节开始，不要重新创建数据库、初始化管理员或导入仓库旧文章。本文命令供账户管理员在可信环境执行，不代表这些操作已在你的账户执行。

## 1. 先了解部署内容

| 部分 | 作用 | 配置入口 |
| --- | --- | --- |
| GitHub 仓库 | 保存网站程序源码 | main 分支 |
| Worker | 后端 API、登录验证、文章渲染 | worker/index.js |
| Static Assets | 首页、后台、CSS、JS、编辑器资源 | scripts/build.mjs → dist/，绑定 ASSETS |
| D1 | 文章、草稿、合集、历史、评论、私密留言、管理员与会话 | 绑定 DB |
| R2 | 正文图片、合集封面 | 绑定 IMAGES，经 /images/ 读取 |
| Workers Builds | 拉取 GitHub、测试、构建和部署 | Cloudflare 控制台中的 Builds |

改代码需要提交 GitHub 并部署；后台写文章、存草稿、发布和上传图片直接写 D1/R2，不产生 GitHub 提交。源码仓库不包含当前线上内容的完整备份。

当前支持独立草稿、最近 50 份文章历史、文章回收站、多合集、访客讨论串及手动内容/图片备份。新评论和访客回复直接公开，管理员可以隐藏或移入回收站。可选草稿自动保存默认关闭，首次手动保存后才能开启，始终不自动发布。联系留言仅管理员可见，不自动发送邮件。

## 2. 准备账户、工具与代码

需要 GitHub 仓库读取权限、同一个 Cloudflare 账户中的 Workers/D1/R2 权限，以及域名 DNS 管理权限（只用 workers.dev 验证时可暂不接域名）。R2 开通可能要求绑定付款方式，费用和额度以控制台当前显示为准；本指南不要求自动升级套餐。

可信开发/部署终端需要 Git、Node.js 24（精确版本见根目录 .node-version）和 npm。命令示例使用 Bash；Windows 可使用 Git Bash。PowerShell 中可运行单条 Git/npm/npx 命令，但多行脚本和引号请使用所标注的 Bash 环境。

本仓库 AI 维护环境不为文档核查安装依赖；下列 npm ci 是部署者自行准备环境或云端构建时的步骤，不要求每次维护重复安装。

首次获取代码，在准备放仓库的目录执行：

```bash
git clone https://github.com/itfetter/itfetter.github.io.git
cd itfetter.github.io
node --version
npm --version
cd worker
npm ci
npx wrangler --version
npx wrangler login
npx wrangler whoami
```

后续除明确写“仓库根目录”的步骤外，命令均在 **worker/** 目录执行。项目锁定 Wrangler 版本，以 worker/package-lock.json 为准，不额外安装最新版。whoami 后确认账户，避免多账户下把资源建到另一账户。私有 Fork 需先配置正常 GitHub 读取授权，不把 token 写进仓库 URL 或公开文档。

## 3. 创建资源与私有配置（仅首次）

### 3.1 创建 D1 和 R2

先确认没有需要复用的同名资源，再执行：

```bash
npx wrangler d1 create itfetter-blog
npx wrangler r2 bucket create itfetter-blog-images
```

记录 D1 创建结果中的 database_id。资源在同一 Cloudflare 账户内；R2 不需要开启 r2.dev 公开访问，也不需要为此创建 S3 密钥。Worker 使用绑定访问图片。

### 3.2 写入配置

在 worker/ 复制示例：

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

编辑 worker/wrangler.jsonc，以下是完整的首次验证配置。用真实数据库 ID 替换占位符；若更改资源名称，同步后文命令。不要把占位符直接部署。

```json
{
  "name": "itfetter-blog",
  "main": "index.js",
  "compatibility_date": "2026-10-03",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "assets": {
    "directory": "../dist",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "itfetter-blog",
    "database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID",
    "migrations_dir": "migrations"
  }],
  "r2_buckets": [{
    "binding": "IMAGES",
    "bucket_name": "itfetter-blog-images"
  }],
  "observability": {"enabled": true}
}
```

多账户部署可在此增加正确的 account_id，只保存在私有配置。保留 compatibility_date 和 nodejs_compat；升级运行时应另行测试，不为部署文档顺手修改。DB、IMAGES、ASSETS 是代码约定的绑定名，不能随意改成数据库名称。

真实 wrangler.jsonc、.dev.vars、.env、管理员初始化 SQL、数据库导出和内容备份不提交 GitHub。当前 .gitignore 忽略 worker/wrangler.jsonc、worker/.dev.vars、worker/.env、.migration/ 等路径；其他名称的备份不一定自动忽略，应存放仓库外。生产配置禁止 ENVIRONMENT=development。

## 4. 先迁移数据库，再初始化管理员

### 4.1 应用全部迁移

空数据库也必须按顺序执行全部迁移。当前文件为 0001～0014，以 migrations/ 实际内容为准；包括草稿、评论讨论串、回收站、多合集和站点设置，不能只执行基础文章/认证表。

```bash
npx wrangler d1 migrations list itfetter-blog --remote --config wrangler.jsonc
npx wrangler d1 migrations apply itfetter-blog --remote --config wrangler.jsonc
npx wrangler d1 migrations list itfetter-blog --remote --config wrangler.jsonc
```

最后应无待应用迁移。--remote 操作线上数据库，--local 操作本地模拟库，两者不会互相同步。不要改写已上线迁移。已有库更新前先备份；如果曾手工执行迁移但没有登记 d1_migrations，先核对实际表结构和登记记录，不重复运行 ALTER，也不盲目补登记。

### 4.2 创建单管理员

仍在 worker/ 的可信交互终端执行：

```bash
npm run create:admin
npx wrangler d1 execute itfetter-blog --remote --config wrangler.jsonc --file ../.migration/admin.sql
npx wrangler d1 execute itfetter-blog --remote --config wrangler.jsonc --command "SELECT id, username FROM admin_users;"
```

脚本会提示输入账号、密码及确认密码。账号为 3～64 位小写英文、数字或连字符；密码为 6～128 字符，输入不回显。没有默认账号密码，不开放注册或公开找回接口。建议自行设置足够长且不复用的密码，不把密码写入命令行、环境变量或聊天。

生成的 .migration/admin.sql 含密码哈希，仍属于私密认证资料。确认管理员记录正确后删除：

```bash
rm ../.migration/admin.sql
```

**再次执行初始化 SQL 会重置管理员并撤销全部旧会话**，不属于日常部署步骤。忘记密码时才使用此可信终端流程；正常改密使用后台“账号与安全”。

## 5. 构建与首次部署

在 worker/ 执行：

```bash
npm test
npm run build
npx wrangler deploy --config wrangler.jsonc
```

任一步失败先停止排查，不继续部署。npm test 会生成 .migration/posts.sql 供兼容测试使用，**不会把旧文章写入 D1**。空站无需手工执行该 SQL。

构建会下载固定版本 Vditor 必要资源并校验固定 SHA-256，输出到仓库根 dist/；需要可访问相应资源源站。运行时编辑器资源同源提供，正文不会发送第三方 CDN。不要直接改 dist/，也不要把整个仓库作为静态目录发布。

deploy 成功后记录控制台返回的 Worker URL 和版本。先用该 HTTPS workers.dev 地址访问首页和 /admin/，再用自己的账号登录。后台 API 必须在同一域名调用；不同域名的 Cookie 不共享。平台显示部署成功不等于数据库、登录和图片上传均已验收。

如暂时没有自定义域名，功能可先在 workers.dev 验证；本站源码中的 canonical、sitemap 等仍包含 itfetter.com，不能把临时验证地址当成已经完成正式搜索引擎配置。

## 6. 接入正式域名

1. 将域名所在站点接入同一个 Cloudflare 账户，完成注册商处 Nameserver 修改，等待 Cloudflare 站点状态为 Active；已有业务先记录 DNS，勿覆盖邮件 MX/TXT 等无关记录。
2. 在 Worker 的 Settings → Domains & Routes → Add → Custom Domain 添加自己的域名。检查与旧 Pages/CNAME/其他 Worker 的冲突，按控制台提示处理目标主机名，避免提前撤下旧站。
3. 在私有 wrangler.jsonc 中加入以下字段，并同步到第 7 节的构建配置，防止后续部署遗漏域名：

```json
"routes": [
  {"pattern": "blog.example.com", "custom_domain": true}
]
```

此为待合并的 JSON 字段，不是独立完整配置；pattern 只填主机名，不填 https://、路径或通配符。替换成自己的真实域名；保留已有配置其他字段。

4. 等待域名和证书生效，验证 HTTPS、后台登录、正文及 /images/ 图片。不要用禁用证书校验或浏览器警告绕过作为解决方式。
5. 如果使用根域加 www，选择一个主域；为 www 单独配置 DNS/HTTPS 及保留路径、查询参数的重定向。增加根域绑定不会自动完成 www 跳转。
6. 切换确认成功后，才考虑停用旧 GitHub Pages 和旧 Issue 发布工作流；不要删除仍参与构建的 _layouts/post.html。

### Fork 后换成自己的品牌和域名

当前程序不是完全参数化的博客模板。只修改 routes 不会自动替换页面内的品牌、canonical、分享图和 sitemap 域名。至少核查：

- index.html、articles/index.html、archive/index.html、about/index.html：品牌、介绍、canonical、社交链接。
- _layouts/post.html：站点名称、分享图片 URL；worker/index.js：robots.txt 和 sitemap.xml 中的正式域名。
- worker/collections.js：合集页元信息；assets/share-card.png：分享封面。
- worker/site-settings.js 的兼容联系邮箱，以及后台“公开联系方式”；旧 _config.yml 仅兼容历史，不是当前全站域名配置开关。

可使用编辑器全仓搜索 itfetter.com、itfetter 和旧公开邮箱，逐项确认用途，不批量修改迁移、文章 ID 或历史正文。不要复制本站线上 D1/R2 标识或内容。

## 7. 配置 GitHub 自动部署

首次手动部署验证通过后，在现有 Worker 的 Settings → Builds 中连接 Git 仓库（界面名称可能调整）。选择正确 GitHub 账户并授权目标仓库；公开仓库也需要构建集成授权，私有仓库需有读取权限。

| 设置 | 本项目值 |
| --- | --- |
| 仓库 | 自己的源码仓库；维护本站时为 itfetter/itfetter.github.io |
| 生产分支 | main |
| 根目录 / Root directory | worker |
| Node 版本 | 与根 .node-version 一致的 Node.js 24；必要时在构建环境设置 NODE_VERSION |
| 构建变量 | BLOG_WRANGLER_CONFIG，内容为完整私有配置的严格 JSON |
| 部署命令 | npx wrangler deploy --config wrangler.jsonc |

BLOG_WRANGLER_CONFIG 是 **Builds 构建变量**，不是运行时 Worker 变量。粘贴完整 JSON，不带注释、尾逗号或外层额外引号；包含真实 D1 ID、R2 名称和正式域名 routes。不要在其中放管理员密码、密码哈希或 token，也不要在日志打印变量值。平台构建部署授权由 Cloudflare 管理，不把部署令牌提交 GitHub。

构建命令（Cloudflare Linux 构建环境；如输入框单行，原样保留 &&）：

```bash
node -e 'const fs=require("node:fs");const c=JSON.parse(process.env.BLOG_WRANGLER_CONFIG||"null");if(!c||c.vars?.ENVIRONMENT==="development")throw Error("构建配置缺失或禁止生产开发模式");fs.writeFileSync("wrangler.jsonc",JSON.stringify(c))' && npm ci && npm test && npm run build
```

构建根目录为 worker，因此 main 为 index.js、assets.directory 为 ../dist。不要改成只发布 dist/ 的静态项目，也不要套用 GitHub Pages 的 Jekyll 部署。

首次触发后核对构建关联的 Git 提交、测试通过、构建完成、部署成功及线上页面。仓库 .github/workflows/validate-worker.yml 是独立 GitHub Actions 测试与构建流程，不负责部署，也不会代替 Cloudflare 的 BLOG_WRANGLER_CONFIG。

当前自动构建命令不自动执行 D1 迁移、不创建管理员、不导入文章。新增迁移须按第 8 节先处理。预览分支如需写入测试，使用独立 Worker/D1/R2；不能让未知分支共享生产数据写权限。

## 8. 已有站点的日常更新与回退

1. 核对远端 main、待提交差异和 AGENTS.md、PROJECT_HANDOFF.md、docs/FEATURE_MAP.md。
2. 若新增迁移：先备份 D1/R2，阅读迁移兼容性，列出待迁移项，确认账户和数据库后应用，再部署兼容代码。不要重复管理员初始化或导入旧文章。
3. 做相关检查；依赖未准备时由现有云端流程执行完整测试，不为一次文档修改下载依赖。业务代码变化需测试与构建通过。
4. 提交、推送 main，由 Cloudflare 构建部署。依次确认“已提交、已推送、测试通过、已部署、线上验收”，不要混为一个状态。
5. 使用现有文章只读验收；写入/删除测试使用本地模拟库或明确授权的演示数据，不误改真实文章和留言。

构建失败通常不会替换现有成功部署；先看失败阶段和提交号，不反复初始化数据库。代码回退优先通过修复或 revert 提交进入原自动部署链；必要时使用 Cloudflare 已知兼容版本回退，随后同步 Git，避免下次构建再次覆盖。

**代码回退不回退 D1 和 R2。** 尤其不能回退到不理解 deleted_at、多合集或现有结构的旧程序；那可能重新公开回收站内容或破坏数据。迁移失败时核对实际已应用列表，不能假设此前所有迁移都一起回滚。

## 9. 可选：旧文章导入与本地开发

### 9.1 旧 _posts 导入（不是空站必做）

仅迁移仓库里的旧 Markdown 时使用。先备份、审查来源和文章清单；它不是当前线上文章备份。脚本以原 blog_id 和 permalink 保留稳定链接，重复 ID 不覆盖。

在 worker/ 执行：

```bash
npm run import:posts
```

审查仓库根 .migration/posts.sql 后，对已完成全部迁移的目标库执行：

```bash
npx wrangler d1 execute itfetter-blog --remote --config wrangler.jsonc --file ../.migration/posts.sql
```

核对文章数量、正文、日期、合集归属和原链接；导入过程不替换已有同 ID 内容，不自动迁移外部图片。已有 assets 图片随静态资源构建保留；外链图片要单独确认可用。执行后妥善清理私密迁移输出。

### 9.2 本地模拟环境

本地库与生产库独立，绝不通过 --remote 做本地验收。在 worker/.dev.vars 写入以下开发专用变量（已忽略，不提交）：

```text
ENVIRONMENT=development
```

worker/ 下执行，所有步骤复用同一配置及 Wrangler 默认本地状态目录：

```bash
npx wrangler d1 migrations apply itfetter-blog --local --config wrangler.jsonc
npm run create:admin
npx wrangler d1 execute itfetter-blog --local --config wrangler.jsonc --file ../.migration/admin.sql
rm ../.migration/admin.sql
npm run build
npx wrangler dev --config wrangler.jsonc
```

使用终端显示的 http://localhost 地址，本地也要账号密码；仅显式 development 且 localhost/127.0.0.1 才允许 HTTP 登录。不要在生产配置或 Builds 设置此变量，不添加 remote:true 绑定。不要直接运行 npm run dev 后假设它使用私有配置：当前该脚本固定使用 wrangler.example.jsonc，所以这里明确指定 wrangler.jsonc。

## 10. 备份、恢复与密码重置

### 内容备份与补回

后台“设置 → 备份”下载内容和图片 JSON；含文章、草稿、历史、合集关联、评论、私密留言、公开联系设置及图片，不含管理员密码/会话或部署配置。文件可能含私人邮箱和留言，不上传公开仓库。

便捷备份受实现限制：文章最多1000、历史5000、留言1000、合集1000、评论1000，内容约400万字符；图片最多100张、总大小1200万字节。超限请使用 D1/R2 原生导出。导出前暂停编辑，避免数据库和图片变化导致不一致。

恢复前先备份目标。后台补回先确认数量，仅补缺、不覆盖，不是把全库恢复到历史时点；跨 D1/R2 不具备整体事务，中断需检查结果。恢复缺失的已发布文章可能使其重新公开。恢复不创建管理员，迁移到新站仍须先完成建库、全部迁移和管理员初始化。

### 全库与图片灾备

在 worker/ 中将 D1 导出到仓库外的私密目录（先自行创建目录，并使用每次不同的文件名）：

```bash
npx wrangler d1 export itfetter-blog --remote --config wrangler.jsonc --output /PRIVATE_BACKUP_DIR/blog-d1-YYYYMMDD.sql
```

替换路径和日期。完整 D1 导出可能包含认证哈希及私密内容；权限按敏感备份处理。R2 对象须另行备份并保留原 key，可使用 Cloudflare 控制台或配置最小权限的 S3 兼容备份工具；D1 SQL 不包含 R2 图片。大库/R2 批量恢复需单独制定方案，本项目没有自动全库灾备任务。

不要把整库 SQL 直接导入正在运行的非空生产库来“覆盖恢复”。应在隔离数据库中按 Cloudflare 导入/恢复规则验证表、触发器、数据、迁移记录及 R2 key，再计划切换。数据库恢复和 R2 恢复不是同一事务。

忘记管理员密码使用第 4.2 节的可信终端重置流程；正常改密在后台验证当前密码。成功改密/重置撤销旧会话。不要用修改源码、清空数据库或关闭鉴权代替密码恢复。

## 11. 上线验收清单

- 首页、文章列表、合集、归档、关于和已有 /articles/<id>/ 正常；旧 #post/<id> 链接仍能跳转。
- 新站无文章时显示空状态；登录 /admin/ 后可进入工作台，退出后管理 API 拒绝访问。
- 用本地库或授权演示数据验证：草稿不公开、发布才公开、多窗口旧版本不能覆盖新版本；自动保存默认关闭。
- 图片 PNG/JPG/WebP/GIF 不超过5 MB，上传后 /images/ 可读取；上传中不得误保存正文。
- 验证评论与回复直接公开，联系留言不公开；不使用真实留言做审核、删除或标记已读测试。
- 手机、键盘、章节目录、搜索清除、分页、未保存离开保护正常。
- 文章回收站可恢复，彻底删除为独立确认操作；不要用真实文章验证，删除文章不自动清理共享 R2 图片。
- HTTPS、正式域名、canonical、sitemap、分享图和 www 跳转正确；确认没有把开发模式或私密文件部署到 Static Assets。
- 确认日常写文章只更新 D1/R2，没有产生源码提交。

## 12. 常见故障

| 现象 | 优先检查 |
| --- | --- |
| Builds 看不到仓库 | GitHub App 是否授权正确账户/目标仓库，私有仓库是否可读 |
| 找不到 index.js 或 package.json | Root directory 应为 worker，配置 main 为 index.js |
| BLOG_WRANGLER_CONFIG 缺失/JSON 解析失败 | 是否配置在 Builds，是否严格完整 JSON、无额外引号/注释/尾逗号 |
| D1/R2 绑定不存在 | 核对 Cloudflare 账户、资源 ID/名称及绑定名 DB/IMAGES，勿重新创建同名空库替代 |
| no such table / column、重复列 | 核对全部迁移及 d1_migrations；不要反复执行手工 ALTER |
| 登录一直失败 | 是否在正确目标库初始化、是否 HTTPS、账号密码是否正确；没有默认密码 |
| 登录返回429 | 登录限速生效，按 Retry-After 等待，停止反复尝试 |
| 登录返回401、会话过期 | 会话当前为8小时，改密会撤销旧会话；重新登录，不降低认证要求 |
| HTTP localhost 登录失败 | development 仅放本地 .dev.vars，并使用 localhost/127.0.0.1；生产禁止此设置 |
| 登录后马上退出、跨域请求失败 | 前后台是否同源、是否换到另一域名、浏览器Cookie是否受限；不使用跨域token补丁 |
| 编辑器空白/加载失败 | 查看同源 vendor 资源与构建哈希检查，使用重试加载；保留当前 Markdown，勿盲目刷新未保存稿 |
| 图片上传失败 | 文件格式/5 MB上限、会话、IMAGES绑定及R2权限，勿为了读取开启公开桶 |
| 保存返回409 | 其他窗口或合集操作推进版本；先导出当前输入，再重新读取并人工合并，不自动覆盖 |
| 保存超时/网络失败 | 写入可能已成功，先保留输入并核对状态，不盲目自动重试 |
| 公开页短暂仍显示旧内容 | 公开白名单边缘缓存约30秒；后台和管理API不缓存 |
| 自定义域名报错但 workers.dev 正常 | DNS Active、域名绑定、冲突记录、证书和部署routes；不用重新建库 |
| 只启动静态服务器后API不可用 | 此项目必须运行 Worker，普通静态服务器不是完整本地环境 |

需要查看服务器错误时，可在可信终端使用 npx wrangler tail --config wrangler.jsonc；不要把密码、Cookie、私密留言或完整私有配置贴进日志/公开Issue。

## 13. 维护入口与官方参考

- [项目介绍](../README.md)、[开发规则](../AGENTS.md)、[项目交接](../PROJECT_HANDOFF.md)、[功能地图](../docs/FEATURE_MAP.md)。具体变更及真实验收记录只写交接，本文保持当前操作说明。
- [Cloudflare Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [D1 Wrangler 命令：迁移、执行、导出](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [D1 导入导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [R2 S3 兼容接口](https://developers.cloudflare.com/r2/api/s3/api/)

命令按本仓库锁定版本和当前代码整理；平台界面、套餐及未来版本差异以官方文档为准。本文不承诺已在全新 Cloudflare 账户完成重部署；实际验证范围以 PROJECT_HANDOFF.md 的对应记录为准。
