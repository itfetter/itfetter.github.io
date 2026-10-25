# Linux Docker 部署指南

项目提供两种运行方式：原有 Cloudflare Workers + D1 + R2，以及 Node.js + SQLite + 本地图片的 Linux 容器。当前生产站仍使用 Cloudflare；镜像发布不等于生产迁移完成。

## 镜像与数据

应用镜像为 `ghcr.io/itfetter/itfetter-blog`，优先使用通过测试的 `sha-完整提交号` 标签或镜像 digest。`latest` 仅用于查看最近版本，不建议作为生产实例的固定配置。基础运行环境是 Node.js 24，使用内置 SQLite，不需要另起数据库容器。仅支持单实例进程使用自己的本地数据库；不要共享 SQLite 文件给多个独立实例，也不要挂载到网络文件系统。

镜像只含公开程序、生产依赖和静态资源，不含文章、管理员密码、连接配置或数据库。数据库 `/data/blog.sqlite` 和图片 `/uploads` 必须绑定到主机持久化目录；SQLite 的 WAL/SHM 文件属于同一数据目录。容器重建不删除这些目录。数据库和图片分开备份，GitHub 代码历史不能代替数据备份。

## 宝塔多实例目录

沿用宝塔实际生成的“应用目录/实例目录”：

```text
/www/dk_project/dk_app/itfetter-blog/itfetter-blog-<实例标识>/
├── compose.yml
├── .env                 # 该实例的私有配置
├── data/                # SQLite 与迁移前快照
└── uploads/             # 图片原文件
```

不再额外套项目目录。每个实例使用独立端口、Compose 项目名及数据目录；示例未固定容器名。使用宝塔现有 Docker 引擎，在面板正式创建或导入编排，不手改 apps.json、apptags.json、installed.json；目录位置本身不保证编排自动登记。不要调整其他应用或 Docker data-root。

## 创建一个实例

1. 在宝塔创建实例后，将仓库 `deploy/compose.yml` 和 `deploy/.env.example` 分别放到实例目录的 `compose.yml` 和 `.env`。
2. 填入已验证镜像标签和独立 BLOG_PORT，无需设置或绑定 PUBLIC_ORIGIN。应用根据 Host 识别当前域名/IP及端口；域名与证书在宝塔管理，更换域名不必修改镜像或容器域名配置。
3. 在该实例目录创建 data、uploads，所有者设为容器运行用户 UID/GID 1000，权限建议 700，`.env` 权限 600。仅修改本实例路径，不递归改整个 dk_app。
4. 在宝塔启动编排；命令行管理时，在实例目录执行 `docker compose --env-file .env -f compose.yml -p <独立实例名> up -d`。后续始终用同一个项目名。检查容器健康状态和宝塔面板中的名称、端口、挂载。
5. 由宝塔 Nginx 为域名提供 HTTPS，参考 `deploy/nginx-location.conf.example` 代理到该实例的 `127.0.0.1:BLOG_PORT`。保留宝塔原证书与 HTTP 到 HTTPS 跳转。不要将容器端口直接暴露到公网。
6. 根据实际实例网络检查 Docker 网关（`docker network inspect <实例网络名>`），将主机代理在容器看来对应的精确 IP 填到 TRUST_PROXY_IPS。Nginx 必须覆盖 Host、X-Real-IP，并通过 `X-Forwarded-Proto $scheme` 告知外部协议，而不是透传访客提供的值。未配置可信代理时不信任转发头；多个访客可能共享代理限额，HTTPS代理后的登录也会因为只识别到HTTP而被拒绝。不要填通配符、整个网段或其他容器 IP。更改后重建本实例。
7. 运行 `docker compose -p <独立实例名> exec blog node server/admin.mjs`，在交互终端输入管理员账号和隐藏密码。不要把密码写到命令行、镜像或环境变量。已有账号重置必须显式加 `--reset`，并会撤销旧会话。

健康检查为容器内部的 `/healthz`，验证进程和 SQLite 可读；它不代表文章已迁移或公网 HTTPS 已验收。使用临时 HTTPS 域名检查前后台，不要在验收前切换正式域名。

## 从 Cloudflare 迁移内容

先在原后台下载包含图片的 JSON 备份，并核对后台提示的备份范围与数量限制。新实例创建独立管理员，登录新后台，使用现有恢复入口导入。恢复是补缺，不覆盖同名已有内容；若数量超过后台备份上限，应另做完整 D1/R2 导出转换，不能直接将 D1 SQL 塞进已迁移的 SQLite 文件。

JSON 不包含管理员密码、会话或限速数据，管理员需单独初始化。图片恢复保持 `/images/<key>` 路径；外部引用仅保留链接，不会自动下载。核对文章、独立草稿、历史、合集、评论回复、私密留言、联系方式和图片，再决定迁移窗口。

最终切换时暂停旧站写入，做最终备份和补齐，验证新实例后再调整域名入口，避免两个后端分别接收新内容。保留旧站与备份作为回退依据。此步骤需要实际迁移验收，构建镜像不会自动执行。

## 更新、备份与回滚

GitHub Actions 执行原业务测试、容器适配测试和实际容器冒烟测试后发布 GHCR。主机拉取镜像可能需要网络连通性；首次发布的 GHCR 包还需在 GitHub Package 设置中明确设为 Public，并验证匿名拉取，仓库公开不代表包自动公开。

更新前：记录当前镜像 digest，在后台暂停写入，运行 `docker compose -p <独立实例名> exec blog node server/backup.mjs` 创建一致 SQLite 快照。将快照和 uploads 复制到实例目录外的独立备份位置；为了数据库和图片属于同一时间点，完整备份期间保持停止写入。不要仅复制正在写入的 blog.sqlite 而漏掉 WAL。

将 IMAGE_TAG 改为新版本，执行 `docker compose -p <独立实例名> pull blog`，再 `docker compose -p <独立实例名> up -d blog`。启动自动按顺序执行新增 SQL 迁移；升级前会在 data/backups 留一份 SQLite 快照。已经执行过的迁移校验和不能改变，迁移失败停止启动，不启动半升级应用。实例数据目录不可共用，升级和管理员初始化不要同时运行。

检查健康、日志、公开文章、登录、保存草稿、图片和评论。程序回滚使用旧镜像；如旧程序不兼容新数据库，必须在停止容器后用升级前快照与匹配的图片备份恢复，不能只切换镜像。禁止 `down -v`、删除 data/uploads，或执行会清除持久化数据的清理命令。定期将备份复制到服务器之外。

## SSH 本地预览

可用 SSH 将本机127.0.0.1:3100转发到服务器127.0.0.1:3100，无需开放公网端口。通过 `http://127.0.0.1:3100` 或 `http://localhost:3100` 访问时，自动使用仅限本地地址的预览会话；公网域名下登录继续要求 HTTPS。SSH 隧道必须保持运行。不要把公网域名伪装为localhost来部署正式站。

容器不再校验固定域名；HTTP Host 仍进行语法和请求路径校验，同源检查比较当前请求Origin。只信任 TRUST_PROXY_IPS 中代理的 X-Forwarded-Proto，不采信 X-Forwarded-Host。宝塔应仅将所配置域名转发到本机端口，未知域名由Nginx默认站点处理。页面站点元信息、robots与sitemap跟随当前访问入口，文章正文里的作者原始链接不批量改写。
