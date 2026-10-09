## 可视化写作模式入口（2026-10-08）
admin/index.html的setEditorView统一visual/split/write/preview切换，clear/openPost复位visual；主按钮为可视化写作，其他模式放在editor-advanced内，return-visual从只读发布预览返回可编辑正文。assets/document-editor.mjs仍提供连续wysiwyg、区块和选字菜单、无损Markdown同步；assets/admin-studio.css布局次要模式菜单与只读提示。回归入口worker/document.test.mjs、admin.test.mjs及浏览器未保存验收；API和数据库不变。

## 归档页布局入口（2026-10-08）
archive/index.html负责介绍和archive-list容器，assets/front.js生成年月分组；assets/front.css的archive-section统一桌面/手机单列，上方介绍、下方年月文章列表。月份折叠与文章排序逻辑不变；浏览器验证上下几何位置和展开链接。

## 体验优化入口（2026-10-08）

| 功能 | 源码入口 | 回归入口 |
| --- | --- | --- |
| 发布缺项清单、设置状态、字段定位和折叠写作帮助 | admin/index.html；assets/admin-utils.mjs 的 publishChecklist；assets/document-editor.mjs；admin-studio.css | worker/admin.test.mjs；document.test.mjs |
| 合集搜索自动更新、取消旧请求、清除和无脚本GET兜底 | worker/collections.js 的 collectionPage；assets/collection-search.js；collections.css | worker/public.test.mjs；worker/test.mjs 的公开合集隔离用例 |
| 后台评论自动搜索和读取期间查询排队（含页数收缩）；空批量栏/单页分页 | assets/admin-comments.mjs 的 load/search/sync；admin-studio.css | worker/admin.test.mjs |
| 前台单页评论导航；留言回收站文案与空列表 | assets/comments.js；front.css；admin/index.html 的 loadMessages | 浏览器只读验收 |
| 公开缓存版本 | worker/public-response.mjs | worker/public.test.mjs |

无需迁移或API改动，保留鉴权、版本和公开/草稿隔离。本文对应新行为；后文旧查找/重复说明仅作历史。


## 文章末尾合集导航精简（2026-10-07）
将重复的合集目录卡片改为一行所属合集标签。单篇合集仅显示入口；多篇合集只显示各自默认顺序的上一篇/下一篇，不列出当前文章。保留公开过滤与独立顺序，无数据迁移。源码 worker/collections.js、assets/collections.css；worker/test.mjs 验证单篇/多篇/无合集渲染。当前本地执行环境启动失败，验证使用现有 Cloudflare 构建，无依赖安装。

## 后台体验升级（2026-10-07）

- 新增 `assets/admin-studio.css` 统一后台布局。文章库合并日期列，合集与状态使用标签；窄屏改为文章卡片，导航可折叠。
- 写作页优先展示标题与正文，合集、摘要和网址位于可展开的文章设置中；保存与发布固定在可见操作栏，次要功能收进更多操作。
- 工作台压缩欢迎区域并添加快捷入口；设置页拆为账号安全、联系方式、备份三块。留言和评论选中后显示批量操作。
- 路由、API、数据模型、鉴权与版本检查不变；面板切换仅作用于工作区，避免 body 的 data-panel 状态被当成面板隐藏。
- 已通过轻量语法和控件映射检查；隔离预览验证桌面文章库、390px 手机卡片、导航切换、文章设置、保存栏及留言选择。未安装依赖、未修改线上内容。Cloudflare 云端 79 项测试全部通过（0 失败），代码提交 `5d2c6c7` 已部署。线上文章库与文档编辑器已只读验收，未发布或修改内容。

## 后台公开联系方式（2026-10-07）
后台账号设置新增公开联系邮箱：与登录账号分开，保存后刷新前台生效，留空隐藏邮箱入口。认证GET/PATCH /api/site-settings使用版本检查，跨窗口冲突409保留输入、手动重新读取，无自动重试。新增0014_site_settings.sql单行设置表，不修改原文章/评论/账号。空表兼容原邮箱；/about/由Worker渲染邮箱并禁用缓存，不依赖浏览器脚本。JSON备份包含可选settings.contact_email，恢复仅补缺，不覆盖已有设置，兼容旧备份。
源码：worker/site-settings.js、worker/index.js、worker/backup.js、about/index.html、admin/index.html、worker/test.mjs。生产验收仅只读，不修改真实邮箱；无本机依赖安装。完整回归与部署状态以实际验收为准。

## 前台阅读布局优化（2026-10-07）
前台沿用暖白、深绿与橙色，统一1160px页面容器、导航当前栏目背景、字号和留白；文章列表采用卡片并将搜索/合集/排序集中在工具区域，搜索、URL状态、分页和旧链接逻辑不改。合集页面引入front.css共享视觉与品牌，缩小封面和卡片间距；目录和起读入口保留。首页减少装饰占比，手机隐藏纯装饰插图，统计用“合集”名称。归档月份增加独立卡片，联系表单改善字号。文章模板添加post-page隔离样式，正文使用860px容器、白色阅读画布、17px桌面/16px手机字号，长标题换行，代码及表格仅自身横向滚动。手机保留五栏目导航，文章卡片不显示重复箭头，内容不截断。
入口：assets/front.css、assets/collections.css、index.html、_layouts/post.html、worker/collections.js（仅公开HTML模板），未改数据库、认证、评论/留言写接口或线上内容。视觉验收使用GET-only本地示例，禁用阅读计数，夹具不入仓库；无新依赖。390px检查首页/文章/归档/关于/合集/合集详情/正文均无横向溢出，筛选、空结果清除、分页通过；部署与云端结果待实际确认。

## 合集选择与关联结果修复（2026-10-07）
写文章的合集选择采用常驻可移除标签、折叠搜索复选列表、已选数/20及空搜索提示；搜索不取消隐藏的选择，保留保存保护与草稿/发布规则。新增/移除关联成功判定以同一D1 batch末尾SELECT统计collection_token为准，不再比较包含触发器写入的meta.changes；版本冲突仍409且不写。后续刷新失败明确提示写入已成功，不误报失败或自动重试写请求。无迁移与依赖安装，不修改生产数据验收。
入口：admin/index.html、assets/admin-collections.css/mjs、worker/collections.js、worker/test.mjs。测试模拟D1附加改动计数，覆盖加入/移除成功及旧版本冲突；完整回归与上线结果以实际云端验收为准。

## 前台文章与合集分工（2026-10-07）
文章页以时间浏览、搜索、阅读量排序为主，合集按钮改为原生下拉筛选，保留URL恢复、多合集匹配和清除筛选。合集总览展示主题介绍、目录入口及按默认顺序选出的公开起读文章；单次窗口查询读取各合集起读条目，排除隐藏合集、草稿、未来文章、回收站；详情提供主题目录与当前顺序第一篇入口，原合集上下篇导航保留。文章不复制存储，未改迁移/写API或生产内容。
入口：articles/index.html、assets/front.js/front.css、worker/collections.js、assets/collections.css；worker/test.mjs覆盖起读顺序和公开隔离。无本机依赖安装，完整测试与部署由现有Cloudflare自动构建验证。

# 功能定位与修改地图

## 合集管理体验升级（2026-10-07）

总览采用封面卡片，可按名称/简介搜索及按公开/隐藏/空合集筛选，每页12个。详情独立显示文章管理与合集设置，URL以collection参数保留当前合集，离开合集栏目时移除此参数。文章每页20篇，搜索/状态/翻页清除本页勾选；选中后显示已选数量与加入其他合集、移动、移出三种明确操作，确认对话框说明影响，默认取消。
“添加文章”从认证文章库读取可加入内容，排除回收站和当前成员，可搜索/状态筛选、跨页选择，单次最多50篇。新建后直接引导添加文章。桌面手柄拖动与上下移调整完整列表的独立阅读顺序，筛选中禁用排序；保存才生效，可放弃修改。设置的保存/放弃与封面、顺序、可见性单独管理。未保存离开与刷新保护、版本冲突、同源与鉴权仍保留，写请求不自动重试。
源码：admin/index.html（页面与弹窗），assets/admin-collections.mjs（交互），assets/admin-collections.css（桌面/手机布局），assets/collection-ui.mjs（列表分页/状态/无损排序），assets/admin-route.mjs（离开时清理合集参数）；worker/admin.test.mjs 增加筛选/回收站排除/完整排序及路由回归。无需新迁移，不改变既有 API、数据库或真实文章。


## 多合集关联（2026-10-07，取代下方单合集规则）
一篇文章可以选择最多20个合集，发布至少选择一个；草稿可暂不选择。新增0013_multi_collections.sql及post_collections：post_id/collection_slug/state/position，公开与草稿关联独立，每个合集独立排序。迁移保留旧公开、草稿、回收站归属、顺序和稳定网址，不改正文或文章版本。旧category/draft_category仅保留首个名称供兼容，不再作为关联的唯一来源。
后台写文章使用复选框多选；合集管理批量“加入目标合集 / 移到目标合集 / 仅从当前合集移除”。加入保留全部其他关联，移动仅取消来源并加入目标，移除只取消当前关联，不删除文章（可成为无合集文章）。操作同步公开关联与存在的草稿关联，最多50篇，整批id/version检查；nonce把后续关联SQL绑定到成功的CAS，D1 batch失败回滚，写请求不自动重试。新编辑窗口如有版本冲突须刷新。
公开合集计数、目录、上一篇/下一篇、推荐及文章列表筛选使用关联表；隐藏入口仍不隐藏文章，访客只读公开状态，草稿关联不泄漏。文章可以显示多个系列目录，各自独立排序。历史快照追加collections_json并保留最多50份，回收站与阅读计数不新增快照。空合集删除要求全部公开/草稿/回收站关联都为空；彻底删除文章级联移除关联。
JSON v1备份新增memberships（含各自排序）和历史合集，兼容旧备份按原category还原一个关联；仅补缺文章关联，现有文章不覆盖。默认已有同名合集恢复时映射到该合集，不覆盖它的资料；旧单合集备份无法含有之后新增的关联。元信息和图片规则不变。
修改入口：worker/post-collections.js处理选择校验、读取与保存CAS；worker/collections.js处理关系管理/独立排序/前台；worker/index.js接线；admin/index.html复选框/列表/历史；assets/admin-collections.mjs批量关联，assets/front.js与admin-utils.mjs多合集筛选；worker/backup.js、0013、worker/test.mjs。已有0012及此前迁移禁止修改。public-response缓存key更新。无依赖安装，本地静态检查和合成SQLite测试通过；本地没有Markdown依赖，完整Markdown与构建验证在Cloudflare。生产验收只读或未保存界面，禁止改真实文章来测试。代码准备完成，提交、云端完整回归和上线状态以之后实际验收记录为准。

## 分类重命名（2026-10-07）

写文章页面提供“管理分类”：选择分类并保存新名称，认证PATCH /api/categories同步更新posts.category及draft_category（含回收站），推进受影响文章version，保留正文、网址、日期和历史分类快照。重复名称拒绝，不合并；D1 batch事务及唯一约束防止部分更新，旧文章版本不能覆盖更新。编辑已有文章前须先保存未保存修改，重命名后重新读取文章版本。公开缓存最多约30秒传播。无迁移或新增依赖，生产验收不改真实分类。


## 前台独立页面（2026-10-06，当前规则）

首页 / 只展示介绍、最新精选和最近记录；/articles/ 为分类/搜索/排序/每页5篇列表；/archive/ 为按年月归档；/about/ 放介绍、联系邮箱及私密留言。四个页面拥有独立URL、标题、canonical及导航当前状态，手机保留全部栏目。现有 /articles/<id>/ 内容链接不变；旧首页 #articles/#collections/#archive/#about/#contact 和 #post/<id> 继续跳转，旧列表查询参数保留。留言仍私密，不新增公开写接口或修改线上内容。

index.html、articles/index.html、archive/index.html、about/index.html 为静态页面；assets/site.css 为共有基础布局，assets/front.css 为公共视觉，assets/front.js 按页面元素初始化功能；列表状态仍使用 public-utils.mjs，阅读页返回链接接受本站新列表及旧首页列表。scripts/build.mjs 显式复制三个新页面；worker/index.js 将 /articles/ 列表交给静态资源，仅其子路径读取文章，并在 sitemap 收录四个公开页面。修改页面时关联文章模板导航、reading-tools、404入口及构建白名单。后台与D1/R2业务不受页面拆分影响。


## 文章回收站（2026-10-06，当前规则）

文章库“按状态筛选 → 回收站”为入口。普通删除和编辑器删除均改为“移入回收站”：撤下公开文章，保留正文、独立草稿、历史版本、阅读量及全部评论。回收站不自动过期；支持恢复及经明确确认后的彻底删除。恢复沿用原链接、发布日期与发布状态；原本已发布且到期的文章重新公开，未发布草稿仍不公开。彻底删除级联清除正文、草稿、历史、评论及阅读去重记录；共享 R2 图片不自动删除，既有离线备份不受影响。新功能不能找回此前已经永久删除的文章。

新增 `worker/post-trash.js` 与迁移 `0011_post_trash.sql`：`posts.deleted_at` 隔离回收站，操作必须携带 id/version；DELETE /api/post 移入回收站，POST /api/post/restore 恢复，POST /api/post/purge 仅允许回收站且 confirm=true。保留管理员会话、同源、JSON/大小、版本及状态保护。移入/恢复推进 version，但不改变内容日期、不生成或挤占内容历史快照；编辑回收站文章前必须恢复。

认证 GET /api/posts 返回含 deleted_at 的全部元数据；普通列表、工作台统计/最近更新/热门文章排除回收站，状态=trash 单独筛选。所有公开摘要、正文、地图、推荐、评论读取/提交及阅读计数均过滤 deleted_at IS NULL，公开缓存版本已更新、传播仍最多约30秒。备份包含回收站状态；旧 v1 无此字段时按正常文章导入，仅补缺不覆盖。

修改时关联 admin/index.html、assets/admin-utils.mjs、worker/index.js、worker/post-trash.js、worker/comments.js、worker/reads.js、worker/backup.js、worker/public-response.mjs、0011 及 worker/test.mjs/admin.test.mjs。不得修改已上线迁移，也不得以真实文章删除/恢复/彻底删除来验收；确认弹窗默认取消，使用合成 SQLite 数据和云端回归测试验证写流程。


## 评论彻底删除与文章评论数（2026-10-06，当前规则）

按用户新要求，评论回收站提供单条及本页批量彻底删除，取代此前无永久删除说明；仅回收站记录、confirm=true、有效id/version可操作，最多20条，任一缺失/状态或版本冲突整批409且不删除。已有root_id外键使删除原评论级联清除全部访客回复（包括未勾选、未入回收站的回复）；删除单条回复仅清除它及作者回复，其他访客回复保留，直接回复对象由target_id外键设空。确认默认取消，明确不可恢复和整串影响；既有离线备份不受影响，无自动过期。生产验收仅检查入口和取消确认，不删除真实评论。

文章库新增评论数列；认证GET /api/posts通过索引相关子查询返回comment_count，统计非回收站原评论及访客回复，包含隐藏/历史待审核，不另算作者回复。公开列表不增加管理统计字段，0条明确显示0；刷新文章列表重新读取统计。关联admin/index.html、assets/admin-comments.mjs、worker/comments.js、worker/index.js、worker/test.mjs，无迁移或新增依赖。


更新日期：2026-10-06。基于 main 提交 `00423063f8ff8fb407566713e8d5428a66c3187a` 的文件和实现核对；这是持续维护的导航，不是完整 API 规范，也不替代实际代码。

## 新窗口从哪里开始

1. 读 [AGENTS.md](../AGENTS.md) 的长期规则与 [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) 的当前项目速查、最新状态；历史验收记录不能当作当前实现。
2. 在本地图找到需求对应的源码、接口、迁移和回归测试，再核对远端最新 main / 工作目录改动。
3. 先追踪页面事件 → API 路由 → 业务函数 → D1/R2 → 页面响应；同时检查权限、并发和公开数据边界。
4. 修改完成同步本地图与交接记录；规则改变同步 AGENTS，用户行为改变同步 README。分别记录验证、提交、推送、构建和上线状态。

当前运行链路：浏览器 → Cloudflare Worker → D1 / R2；静态页面由 Worker Static Assets 提供。GitHub 保存源码，文章发布直接写数据库，不触发源码提交。

## 按需求找入口

| 要修改的功能 | 页面与前端源码 | 后端与数据入口 | 关联检查 |
| --- | --- | --- | --- |
| 首页布局、搜索、分类、归档、列表分页 | [index.html](../index.html)、[front.js](../assets/front.js)、[front.css](../assets/front.css)、[public-utils.mjs](../assets/public-utils.mjs) | [worker/index.js](../worker/index.js)：公开摘要 /posts.json，兼容 /posts.js；posts | 摘要不能返回正文/草稿；每页5篇是前端分页；[public.test.mjs](../worker/public.test.mjs) |
| 独立文章页、日期、上一篇/下一篇、推荐、分享信息 | [_layouts/post.html](../_layouts/post.html)、front.css、[build.mjs](../scripts/build.mjs) | worker/index.js：/articles/<id>/ 模板替换、公开状态过滤、renderMarkdown | 模板占位符与构建同步；文章 id 和旧链接稳定；worker/test.mjs |
| 目录、章节深链接、复制代码/链接、阅读进度 | [reading-tools.js](../assets/reading-tools.js)、[heading-links.mjs](../assets/heading-links.mjs)、front.css、文章模板 | 标题映射主要在浏览器；文章 HTML 由 Worker 渲染 | [heading.test.mjs](../worker/heading.test.mjs)；重复标题、旧片段、手机和键盘 |
| 后台导航、刷新恢复栏目和文章 | [admin/index.html](../admin/index.html)：panel、syncRoute、login、openPost；[admin-route.mjs](../assets/admin-route.mjs) | /api/me、/api/post；会话验证后恢复 view/id | [admin.test.mjs](../worker/admin.test.mjs)；刷新不恢复未保存正文 |
| 工作台统计、文章库筛选/排序/分页 | admin/index.html：refresh、renderList；[admin-utils.mjs](../assets/admin-utils.mjs) | GET /api/posts；posts 元数据与 read_count | admin.test.mjs；草稿、公开、待发布草稿需区分 |
| 标题、摘要、短名、保存草稿、发布 | admin/index.html：openPost、保存事件、deleteFromList、确认弹窗 | worker/index.js：validate、GET/PUT/DELETE /api/post；posts、draft_*、version | worker/test.mjs；空短名自动 article-UUID、首次保存固定、409 冲突、草稿不覆盖公开正文 |
| 文章回收站、恢复及彻底删除 | admin/index.html：filter-status、deleteFromList、confirmDeletion；assets/admin-utils.mjs | worker/post-trash.js：movePost；DELETE /api/post、POST /api/post/restore、POST /api/post/purge；0011_post_trash.sql | worker/test.mjs、admin.test.mjs；公开入口排除回收站、状态/版本冲突、恢复原状态、级联清理、旧备份兼容；图片保留 |\n| 文档编辑、代码块转正文、选字/区块菜单 | [document-editor.mjs](../assets/document-editor.mjs)、[document-editor.css](../assets/document-editor.css)；admin/index.html：preview、正文同步/锁 | [content.js](../worker/content.js)、POST /api/preview；保存仍用 /api/post | [document.test.mjs](../worker/document.test.mjs)；flush、中文输入、撤销、旧回调隔离、sanitize |
| 图片粘贴/拖入/上传、图片读取 | document-editor.mjs、admin/index.html 的上传和占位符流程 | worker/index.js：validImage、POST /api/image、GET/HEAD /images/<key>；R2 IMAGES | worker/test.mjs；类型/5MB/认证；上传中不能保存/切换；删除文章不自动删除图片 |
| 分类/合集创建和选择 | admin/index.html：renderCategories、分类弹窗 | worker/index.js：GET/POST /api/categories；categories + posts 分类合并 | worker/test.mjs；名称校验、同名幂等；当前无重命名/删除 |
| 历史版本、载入旧稿 | admin/index.html 的历史版本弹窗和载入事件 | worker/index.js：GET /api/history；0007_history.sql 和 0011_post_trash.sql 的 posts_history 触发器与 post_versions | worker/test.mjs；每篇最近50份完整快照；载入后保存/发布才生效 |
| 私密联系留言表单 | index.html、front.js | [contact.js](../worker/contact.js)：submitMessage；POST /api/contact；contact_messages/contact_limits | worker/test.mjs；最多3000字、蜜罐、原子限速、超时保留输入；不发送邮件 |
| 留言折叠、未读数、批量已读、多选、回收站 | admin/index.html：loadMessages、refreshUnread、applyMessageBulk、确认弹窗 | contact.js：listMessages、markMessage、readAllMessages、moveMessage、bulkMessages | worker/test.mjs；id/version、批量最多20条且全批冲突保护；永久清除须确认 |
| 文章评论、评论回复、回复他人、讨论串分页 | [comments.js](../assets/comments.js)、_layouts/post.html、front.css | [comments.js（服务端）](../worker/comments.js)：submitComment、publicComments、acceptedComment；article_comments/comment_limits | worker/test.mjs；新评论直接公开，原评论20条/页、回复10条/页、root_id/target_id |
| 后台评论筛选、搜索、多选、折叠、隐藏、回复、回收站 | [admin-comments.mjs](../assets/admin-comments.mjs)、admin/index.html 的 mountCommentManagement | worker/comments.js：managedComments、moderateComment、bulkComments；GET/PATCH /api/admin/comments、POST /api/admin/comments/bulk | worker/test.mjs；状态/post_id/q组合筛选、字面搜索、全部id/version原子校验；隐藏/回收根评论后整串不公开；回收站支持确认后永久清除，无自动过期 |
| 登录、退出、修改密码、会话 | admin/index.html；[auth.js](../worker/auth.js)；[create-admin.mjs](../scripts/create-admin.mjs) | /api/login、/api/logout、/api/me、/api/password；管理员/会话/限速表 | [auth.test.mjs](../worker/auth.test.mjs)、worker/test.mjs；scrypt、同源、HTTPS、会话撤销，不公开注册 |
| 阅读次数与后台阅读排序 | [read-count.js](../assets/read-count.js)、admin-utils.mjs、文章模板 | [reads.js](../worker/reads.js)：recordRead；POST /api/read；article_reads + posts.read_count | worker/test.mjs；触发器原子累计、小时去重、不改文章 version、不是精确人数 |
| JSON 内容/图片备份与补回 | admin/index.html 账号设置中的下载/恢复流程 | [backup.js](../worker/backup.js)：exportBackup、restoreBackup；GET /api/backup、POST /api/backup/restore；D1 + R2 | worker/test.mjs；图片 Base64/key、回复关系、仅补缺不覆盖、旧 v1 兼容、容量限制 |
| 缓存、404、搜索引擎入口、安全响应头 | [public-response.mjs](../worker/public-response.mjs)、worker/index.js；front.js | 公开 GET/HEAD 缓存白名单、/sitemap.xml、/robots.txt | public.test.mjs；边缘30秒，后台/API no-store，错误不能变200 |
| 构建、静态资源、编辑器依赖 | scripts/build.mjs、[editor-assets.mjs](../scripts/editor-assets.mjs)、[package.json](../worker/package.json)、[wrangler.example.jsonc](../worker/wrangler.example.jsonc) | Worker 绑定 DB / IMAGES / ASSETS；Cloudflare Workers Builds | [.github/workflows/validate-worker.yml](../.github/workflows/validate-worker.yml)、[部署指南](../worker/README.md)；构建资源固定版本/哈希 |
| 未来 Linux / Docker / OSS 迁移 | [LINUX_DOCKER_MIGRATION.md](LINUX_DOCKER_MIGRATION.md) | 尚未实现 Node 服务、数据库/OSS 适配和可拉取镜像 | 当前继续 Cloudflare；迁移文档是规划，不能直接当部署包 |

前端与服务端都有名为 comments.js 的文件，修改时必须写完整路径，避免混淆。

## API 快速索引

路由总入口为 worker/index.js 的 handle；业务函数按上表分模块。以下管理接口均需有效管理员会话，写请求保留同源检查。

| 范围 | 路径和方法 | 用途 |
| --- | --- | --- |
| 公开 | GET /posts.json、/posts.js；GET/HEAD /articles/<id>/、/images/<key>、/sitemap.xml、/robots.txt | 列表、文章、图片与爬虫入口 |
| 公开提交 | POST /api/contact、/api/read；GET/POST /api/comments | 私密留言、阅读累计、公开评论/回复 |
| 认证 | POST /api/login、/api/logout、/api/password；GET /api/me | 登录、安全与当前会话 |
| 文章管理 | GET /api/posts；GET/PUT/DELETE /api/post；POST /api/post/restore、/api/post/purge、/api/preview、/api/image | 列表、编辑、保存/删除、预览和图片 |
| 分类与历史 | GET/POST /api/categories；GET /api/history | 分类创建；id 查询版本列表，id/version 查询快照 |
| 留言管理 | GET/PATCH/DELETE /api/messages；GET /api/messages/count；POST /api/messages/read-all、/api/messages/restore、/api/messages/bulk | 状态、角标、删除/恢复与批量操作 |
| 评论管理 | GET/PATCH /api/admin/comments；POST /api/admin/comments/bulk | 状态/文章/关键词筛选、本页批量隐藏/公开/移入回收站/恢复、作者回复 |
| 内容备份 | GET /api/backup；POST /api/backup/restore | 下载、仅补缺恢复 |

精确参数、状态码与限制以路由及业务模块为准；新增接口需同时更新本表、权限边界与测试。

## 数据结构与迁移

所有迁移在 [worker/migrations/](../worker/migrations/)，按序应用。已上线文件禁止改写，后续结构变化新增迁移。

| 迁移 | 负责的数据 |
| --- | --- |
| 0001_posts.sql | posts 文章基础结构 |
| 0002_auth.sql | 管理员、会话和登录限速 |
| 0003_drafts.sql | 状态、draft_* 和草稿保存 |
| 0004_contact.sql | contact_messages 私密留言、contact_limits |
| 0005_reads.sql | 阅读累计、article_reads 去重和触发器 |
| 0006_categories.sql | categories 独立分类 |
| 0007_history.sql | public_updated_at、post_versions、保存前快照与50份保留触发器 |
| 0008_message_trash.sql | 留言 deleted_at/version |
| 0009_comments.sql | article_comments、comment_limits 与索引 |
| 0010_comment_threads.sql | 评论 root_id/target_id 关系及讨论串索引 |

注意：0009 的历史默认值仍是 pending；当前 submitComment 显式插入 approved。不要为改变新评论发布行为去改旧迁移。
R2 是图片对象存储；图片在正文 Markdown 中用 /images/<key> 引用，位置取决于正文，不是单独的“文章图片位置表”。

## 源码、构建产物与线上内容的区别

- 当前源码：index.html、admin/、assets/、_layouts/post.html、worker/、scripts/。
- 构建生成：dist/ 静态资源、article-template.html、编辑器 vendor/manifest.json 等；通过构建产生，不能只改生成文件。编辑器资源生成逻辑和固定哈希在 scripts/editor-assets.mjs。
- 线上内容：D1 中文章/草稿/历史/留言/评论/会话；R2 图片。源码仓库没有当前线上文章的完整备份。
- 历史/兼容：_posts/、_config.yml、仓库根 posts.js、write/index.html、Issue 发文工作流；assets/visual-editor.mjs 与 visual.test.mjs 保留旧逐段编辑兼容回归。默认编辑器入口是 document-editor.mjs。
- 当前独立文章模板虽然在 _layouts/，仍被 Worker 构建使用；不能把整个 _layouts 当作废弃 Jekyll 文件删除。
- 私密配置与备份不提交：真实 wrangler.jsonc、.dev.vars、初始化 SQL、线上备份、密码/令牌。账户资源速查与部署步骤见交接和 worker/README.md。

## 修改后的验证与维护

复用已安装工具做针对性的语法、链接和静态检查；本机不为验证下载依赖。完整验证使用已有云端流程，worker/package.json 的 test 脚本串联各测试，validate-worker.yml 运行测试与构建。构建包含获取固定编辑器资源，不要把本机 build 当成无下载操作。

UI 修改还需检查手机宽度、键盘、刷新路由、未保存保护；数据修改检查认证、同源、版本冲突、公开/私密边界及关联恢复。真实线上文章、留言和评论不用于破坏性验收，演示数据权限不能泛化。

本地图只记录当前入口与限制；构建 ID、部署版本、测试结果、未完成事项放 PROJECT_HANDOFF.md。新增、移动、删除文件、改变职责/接口/迁移/验证入口时，必须在同一次提交同步本地图。


## 历史：统一单合集（已由上方多合集取代）
分类与系列合并为一个“合集”，每篇文章仍只选一个；原categories和posts.category字段继续使用。后台新增合集管理：新建/改名、500字简介、R2封面、固定slug独立网址、最近/最早发布或手动系列顺序、隐藏入口、勾选批量移动文章（最多50篇）、仅删除空合集。已发布文章按公开合集管理，未发布草稿按草稿合集；移动同时更新公开归属与草稿归属。隐藏仅撤下合集入口与独立页，不隐藏文章；有回收站文章或草稿引用的合集也不能删除，删除空合集默认取消确认。手动排序最多500篇。
前台/collections/展示有公开文章的可见合集，/collections/<slug>/展示简介、封面、篇数、阅读量、搜索、顺序与10篇分页；独立文章增加合集目录附近章节及上一篇/下一篇。改名保留合集slug、文章网址、正文、日期与历史快照；影响归属的操作推进文章version，旧编辑窗口须刷新。
新增0012_collections.sql保留原名称并补metadata和posts.collection_order；只新增迁移，不改旧迁移。D1 batch原子改名/排序，版本与完整成员列表检查防止部分更新；移动以单条SQL验证全部文章版本。管理接口延用会话、Origin、JSON保护；公开只读页面只查已发布且到期、非回收站文章，隐私字段不输出。合集元信息与顺序加入原v1备份，旧备份缺字段可恢复，仅补缺不覆盖。封面使用现有认证图片接口，不新增依赖。
入口：admin/index.html与assets/admin-collections.mjs/css；后端worker/collections.js、worker/index.js；前台assets/collections.css及各导航；备份worker/backup.js；URL assets/admin-route.mjs/public-utils.mjs；测试worker/test.mjs/public.test.mjs/admin.test.mjs。合集页暂不缓存；公开文章及sitemap缓存key已更新，30秒传播规则保留。验收禁止改真实文章/合集，写流程用合成SQLite数据。

上线验证：功能提交ad8782d已推送main，Cloudflare构建10e79a59-7152-4158-bac5-0c1eb6e53b54完成72/72测试、0失败，Worker fc856839-a349-43c8-a9fe-77231d0c6996。生产D1已应用并登记0012，保留3篇原文章与3个原分类（其中1篇原已在回收站）；实际Chrome读取后台资料/文章选择/移动目标及前台目录，无生产写入验收。窄屏390px文档375px无横向溢出；实际页面发现合集正文左右留白与跳转链接样式需调整，已修正并补齐合集未保存离开保护，后续构建验收待核对。无本机依赖安装。

后续验收：修正提交fdb56d1对应Cloudflare构建0482468c-e6ba-4530-9a30-b9f576645294成功，72项回归再次全部通过。公开390px页面实际确认22px侧边距、375px文档宽度、五个栏目均可见；后台三合集资料读取成功，关联文章与目标合集控件可见，刷新保留view=collections。文章内目录及稳定合集网址可用。最后去掉文章模板重复的合集导航；仅静态模板修正，无数据写入。实际排序/移动/删除/上传的生产写验收未执行，由合成SQLite与云端用例覆盖。

手机后台补充：390px下合集列表和编辑区文档宽度375px，无横向溢出；合集简介单独设120px高度，避免继承文章正文的大编辑框。窄屏视口已恢复，未提交生产修改。该样式微调不改变接口、数据库或数据。

## 写作体验：保存状态与专注模式（2026-10-10）
保存提示统一在现有底部栏：尚未保存、有未保存的修改、保存中、保存失败、草稿已保存、已保存并发布。草稿保存不会更新公开正文；没有自动保存。顶部仍显示文章的公开状态。正文画布最多920px，文字列约720px，保留左侧区块菜单空间及手机样式。底部专注模式按钮收起导航、页头及写作帮助，保留标题、文章设置和保存发布操作；退出或切换栏目恢复，不重建编辑器。
实现：admin/index.html、assets/editor-save-state.mjs、assets/admin-studio.css、assets/document-editor.css；回归：worker/admin.test.mjs。API与数据库不变。
