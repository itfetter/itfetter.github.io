## 合集选择与关联结果修复（2026-10-07）
写文章的合集选择采用常驻可移除标签、折叠搜索复选列表、已选数/20及空搜索提示；搜索不取消隐藏的选择，保留保存保护与草稿/发布规则。新增/移除关联成功判定以同一D1 batch末尾SELECT统计collection_token为准，不再比较包含触发器写入的meta.changes；版本冲突仍409且不写。后续刷新失败明确提示写入已成功，不误报失败或自动重试写请求。无迁移与依赖安装，不修改生产数据验收。
入口：admin/index.html、assets/admin-collections.css/mjs、worker/collections.js、worker/test.mjs。测试模拟D1附加改动计数，覆盖加入/移除成功及旧版本冲突；完整回归与上线结果以实际云端验收为准。

## 前台文章与合集分工（2026-10-07）
文章页以时间浏览、搜索、阅读量排序为主，合集按钮改为原生下拉筛选，保留URL恢复、多合集匹配和清除筛选。合集总览展示主题介绍、目录入口及按默认顺序选出的公开起读文章；单次窗口查询读取各合集起读条目，排除隐藏合集、草稿、未来文章、回收站；详情提供主题目录与当前顺序第一篇入口，原合集上下篇导航保留。文章不复制存储，未改迁移/写API或生产内容。
入口：articles/index.html、assets/front.js/front.css、worker/collections.js、assets/collections.css；worker/test.mjs覆盖起读顺序和公开隔离。无本机依赖安装，完整测试与部署由现有Cloudflare自动构建验证。
验收：功能a53fd70及筛选事件修正4ace640已部署，云端76项测试通过、0失败。本地实际SQL验证三种默认顺序与非公开隔离通过；线上Chrome确认合集筛选匹配1篇、刷新保留、空结果清除返回2篇、主题目录与起读链接。390px视口文档375px无横向溢出，未修改生产数据。首轮浏览器发现旧按钮事件未兼容下拉，修正后复测通过。

## 合集管理体验升级（2026-10-07）

总览采用封面卡片，可按名称/简介搜索及按公开/隐藏/空合集筛选，每页12个。详情独立显示文章管理与合集设置，URL以collection参数保留当前合集，离开合集栏目时移除此参数。文章每页20篇，搜索/状态/翻页清除本页勾选；选中后显示已选数量与加入其他合集、移动、移出三种明确操作，确认对话框说明影响，默认取消。
“添加文章”从认证文章库读取可加入内容，排除回收站和当前成员，可搜索/状态筛选、跨页选择，单次最多50篇。新建后直接引导添加文章。桌面手柄拖动与上下移调整完整列表的独立阅读顺序，筛选中禁用排序；保存才生效，可放弃修改。设置的保存/放弃与封面、顺序、可见性单独管理。未保存离开与刷新保护、版本冲突、同源与鉴权仍保留，写请求不自动重试。
源码：admin/index.html（页面与弹窗），assets/admin-collections.mjs（交互），assets/admin-collections.css（桌面/手机布局），assets/collection-ui.mjs（列表分页/状态/无损排序），assets/admin-route.mjs（离开时清理合集参数）；worker/admin.test.mjs 增加筛选/回收站排除/完整排序及路由回归。无需新迁移，不改变既有 API、数据库或真实文章。

验证：本地语法/控件映射检查通过，6项后台列表测试通过；Chrome使用65篇模拟文章完成批量加入、搜索添加、排序放弃检查，390px视口文档375px无横向溢出；功能提交22d23ee已通过Cloudflare自动构建与部署，75项完整测试通过、0失败。线上Chrome确认总览卡片、详情两个页签、添加窗口排除现有成员、保存按钮未改动时禁用；390px手机视口无横向溢出，控制台无错误。参考WordPress分类列表及Ghost内容组织，只借鉴交互，未复制源码。未安装依赖，生产验收仅只读，模拟预览/夹具不入仓库。

## 多合集上线验收（2026-10-07）

- 已通过 Cloudflare 自动构建并部署；完整测试 74 项通过、0 失败。
- 0013 迁移已执行，原有 3 篇文章及归属保留；后台线上确认显示合集多选框。
- 测试使用隔离 SQLite 数据，未修改生产文章或提交测试内容。未安装本地依赖。

# PROJECT_HANDOFF.md — itfetter 个人博客交接

## 多合集关联（2026-10-07，取代下方单合集规则）
一篇文章可以选择最多20个合集，发布至少选择一个；草稿可暂不选择。新增0013_multi_collections.sql及post_collections：post_id/collection_slug/state/position，公开与草稿关联独立，每个合集独立排序。迁移保留旧公开、草稿、回收站归属、顺序和稳定网址，不改正文或文章版本。旧category/draft_category仅保留首个名称供兼容，不再作为关联的唯一来源。
后台写文章使用复选框多选；合集管理批量“加入目标合集 / 移到目标合集 / 仅从当前合集移除”。加入保留全部其他关联，移动仅取消来源并加入目标，移除只取消当前关联，不删除文章（可成为无合集文章）。操作同步公开关联与存在的草稿关联，最多50篇，整批id/version检查；nonce把后续关联SQL绑定到成功的CAS，D1 batch失败回滚，写请求不自动重试。新编辑窗口如有版本冲突须刷新。
公开合集计数、目录、上一篇/下一篇、推荐及文章列表筛选使用关联表；隐藏入口仍不隐藏文章，访客只读公开状态，草稿关联不泄漏。文章可以显示多个系列目录，各自独立排序。历史快照追加collections_json并保留最多50份，回收站与阅读计数不新增快照。空合集删除要求全部公开/草稿/回收站关联都为空；彻底删除文章级联移除关联。
JSON v1备份新增memberships（含各自排序）和历史合集，兼容旧备份按原category还原一个关联；仅补缺文章关联，现有文章不覆盖。默认已有同名合集恢复时映射到该合集，不覆盖它的资料；旧单合集备份无法含有之后新增的关联。元信息和图片规则不变。
修改入口：worker/post-collections.js处理选择校验、读取与保存CAS；worker/collections.js处理关系管理/独立排序/前台；worker/index.js接线；admin/index.html复选框/列表/历史；assets/admin-collections.mjs批量关联，assets/front.js与admin-utils.mjs多合集筛选；worker/backup.js、0013、worker/test.mjs。已有0012及此前迁移禁止修改。public-response缓存key更新。无依赖安装，本地静态检查和合成SQLite测试通过；本地没有Markdown依赖，完整Markdown与构建验证在Cloudflare。生产验收只读或未保存界面，禁止改真实文章来测试。代码准备完成，提交、云端完整回归和上线状态以之后实际验收记录为准。

## 历史：统一单合集（已由上方多合集取代）
分类与系列合并为一个“合集”，每篇文章仍只选一个；原categories和posts.category字段继续使用。后台新增合集管理：新建/改名、500字简介、R2封面、固定slug独立网址、最近/最早发布或手动系列顺序、隐藏入口、勾选批量移动文章（最多50篇）、仅删除空合集。已发布文章按公开合集管理，未发布草稿按草稿合集；移动同时更新公开归属与草稿归属。隐藏仅撤下合集入口与独立页，不隐藏文章；有回收站文章或草稿引用的合集也不能删除，删除空合集默认取消确认。手动排序最多500篇。
前台/collections/展示有公开文章的可见合集，/collections/<slug>/展示简介、封面、篇数、阅读量、搜索、顺序与10篇分页；独立文章增加合集目录附近章节及上一篇/下一篇。改名保留合集slug、文章网址、正文、日期与历史快照；影响归属的操作推进文章version，旧编辑窗口须刷新。
新增0012_collections.sql保留原名称并补metadata和posts.collection_order；只新增迁移，不改旧迁移。D1 batch原子改名/排序，版本与完整成员列表检查防止部分更新；移动以单条SQL验证全部文章版本。管理接口延用会话、Origin、JSON保护；公开只读页面只查已发布且到期、非回收站文章，隐私字段不输出。合集元信息与顺序加入原v1备份，旧备份缺字段可恢复，仅补缺不覆盖。封面使用现有认证图片接口，不新增依赖。
入口：admin/index.html与assets/admin-collections.mjs/css；后端worker/collections.js、worker/index.js；前台assets/collections.css及各导航；备份worker/backup.js；URL assets/admin-route.mjs/public-utils.mjs；测试worker/test.mjs/public.test.mjs/admin.test.mjs。合集页暂不缓存；公开文章及sitemap缓存key已更新，30秒传播规则保留。验收禁止改真实文章/合集，写流程用合成SQLite数据。


## 分类重命名（2026-10-07）

写文章页面提供“管理分类”：选择分类并保存新名称，认证PATCH /api/categories同步更新posts.category及draft_category（含回收站），推进受影响文章version，保留正文、网址、日期和历史分类快照。重复名称拒绝，不合并；D1 batch事务及唯一约束防止部分更新，旧文章版本不能覆盖更新。编辑已有文章前须先保存未保存修改，重命名后重新读取文章版本。公开缓存最多约30秒传播。无迁移或新增依赖，生产验收不改真实分类。

改动：admin/index.html新增管理弹窗；worker/index.js新增原子重命名；worker/test.mjs覆盖分类同步、历史/链接保留、冲突和鉴权；维护文档同步。功能提交49b841f及测试修正54e94af已推送main；Cloudflare构建a49bd0d5-86af-48a7-86e9-458fadf4e9dc完成68/68测试，0失败并上线。真实Chrome验证管理分类入口、分类选择/名称预填和取消关闭，截图本地Documents/Codex/category-manager.png；未重命名真实分类。初轮新增测试误用创建接口导致失败，已修正为PUT /api/post；未安装本机依赖。


## 前台独立页面（2026-10-06，当前规则）

首页 / 只展示介绍、最新精选和最近记录；/articles/ 为分类/搜索/排序/每页5篇列表；/archive/ 为按年月归档；/about/ 放介绍、联系邮箱及私密留言。四个页面拥有独立URL、标题、canonical及导航当前状态，手机保留全部栏目。现有 /articles/<id>/ 内容链接不变；旧首页 #articles/#collections/#archive/#about/#contact 和 #post/<id> 继续跳转，旧列表查询参数保留。留言仍私密，不新增公开写接口或修改线上内容。

index.html、articles/index.html、archive/index.html、about/index.html 为静态页面；assets/site.css 为共有基础布局，assets/front.css 为公共视觉，assets/front.js 按页面元素初始化功能；列表状态仍使用 public-utils.mjs，阅读页返回链接接受本站新列表及旧首页列表。scripts/build.mjs 显式复制三个新页面；worker/index.js 将 /articles/ 列表交给静态资源，仅其子路径读取文章，并在 sitemap 收录四个公开页面。修改页面时关联文章模板导航、reading-tools、404入口及构建白名单。后台与D1/R2业务不受页面拆分影响。

本次实际结果：功能提交984ff1467379e690da5dbcd1ecd2ac58ed15ca63已推送main，Cloudflare自动构建成功并上线，完整67项测试通过、0失败；本地6项公开URL/缓存/留言请求回归与脚本语法检查通过，没有安装依赖。真实内置浏览器核对四页、文章列表3篇、搜索Cloudflare刷新仍保留q并匹配1篇、归档月份1+2篇、关于我私密留言表单；旧/#archive自动转向/archive/，390px视口四导航可见、文档375px无横向溢出，控制台无错误。未提交留言或改动文章/评论/R2。补充独立页H1语义及响应式标题；页面标题、canonical和静态构建入口保持对应。线上文章不足5篇，真实多页翻页未覆盖，原分页逻辑保留。截图保存本地Documents/Codex/public-pages.png。


## 文章回收站（2026-10-06，当前规则）

文章库“按状态筛选 → 回收站”为入口。普通删除和编辑器删除均改为“移入回收站”：撤下公开文章，保留正文、独立草稿、历史版本、阅读量及全部评论。回收站不自动过期；支持恢复及经明确确认后的彻底删除。恢复沿用原链接、发布日期与发布状态；原本已发布且到期的文章重新公开，未发布草稿仍不公开。彻底删除级联清除正文、草稿、历史、评论及阅读去重记录；共享 R2 图片不自动删除，既有离线备份不受影响。新功能不能找回此前已经永久删除的文章。

新增 `worker/post-trash.js` 与迁移 `0011_post_trash.sql`：`posts.deleted_at` 隔离回收站，操作必须携带 id/version；DELETE /api/post 移入回收站，POST /api/post/restore 恢复，POST /api/post/purge 仅允许回收站且 confirm=true。保留管理员会话、同源、JSON/大小、版本及状态保护。移入/恢复推进 version，但不改变内容日期、不生成或挤占内容历史快照；编辑回收站文章前必须恢复。

认证 GET /api/posts 返回含 deleted_at 的全部元数据；普通列表、工作台统计/最近更新/热门文章排除回收站，状态=trash 单独筛选。所有公开摘要、正文、地图、推荐、评论读取/提交及阅读计数均过滤 deleted_at IS NULL，公开缓存版本已更新、传播仍最多约30秒。备份包含回收站状态；旧 v1 无此字段时按正常文章导入，仅补缺不覆盖。

修改时关联 admin/index.html、assets/admin-utils.mjs、worker/index.js、worker/post-trash.js、worker/comments.js、worker/reads.js、worker/backup.js、worker/public-response.mjs、0011 及 worker/test.mjs/admin.test.mjs。不得修改已上线迁移，也不得以真实文章删除/恢复/彻底删除来验收；确认弹窗默认取消，使用合成 SQLite 数据和云端回归测试验证写流程。

本次实际结果：复用已有 Node 24 和内存 SQLite，本地检查回收站状态/版本、草稿与历史保留、关联级联清理及新旧备份恢复通过；5项后台列表/统计/路由测试通过，变更模块和后台内联脚本语法检查通过，没有下载本机依赖。生产 D1 已应用并登记 0011_post_trash.sql，迁移前后3篇文章、版本总和5、53条评论、1份历史保持，回收站0篇；未对真实内容执行验收写入。

功能提交 ca4d1de0bb0df2db33cba274b7a41dfa4e6d8961 已推送 main，现有 Cloudflare 自动构建和部署成功，完整66项测试全部通过、0失败。真实内置浏览器核对：文章库显示3篇文章/回收站0篇，状态筛选提供回收站；行内按钮为移入回收站；确认说明撤下但保留正文/草稿/历史/评论，默认焦点为取消，点击取消后原文章保持。切换回收站正确显示空状态，控制台无错误。没有执行生产移入/恢复/彻底删除；完整写流程由合成 SQLite 与云端路由回归覆盖。截图保存在用户本地 Documents/Codex/article-recycle-bin.png，内部构建/部署资源标识留在本地核对记录，不提交公共仓库。

自动审批曾因公共交接文档含内部资源标识拦截同步，清理当前待提交文档中的真实 Cloudflare 账户 ID、Worker tag 与 D1 UUID 后同步通过；接手者从已授权连接或私有部署配置核对实际资源。本次删除规则取代此前永久删除文章的说明，旧历史记录仅作背景。此前已经永久删除的文章不会因新增回收站自动恢复。

## 评论彻底删除与文章评论数（2026-10-06，当前规则）

按用户新要求，评论回收站提供单条及本页批量彻底删除，取代此前无永久删除说明；仅回收站记录、confirm=true、有效id/version可操作，最多20条，任一缺失/状态或版本冲突整批409且不删除。已有root_id外键使删除原评论级联清除全部访客回复（包括未勾选、未入回收站的回复）；删除单条回复仅清除它及作者回复，其他访客回复保留，直接回复对象由target_id外键设空。确认默认取消，明确不可恢复和整串影响；既有离线备份不受影响，无自动过期。生产验收仅检查入口和取消确认，不删除真实评论。

文章库新增评论数列；认证GET /api/posts通过索引相关子查询返回comment_count，统计非回收站原评论及访客回复，包含隐藏/历史待审核，不另算作者回复。公开列表不增加管理统计字段，0条明确显示0；刷新文章列表重新读取统计。关联admin/index.html、assets/admin-comments.mjs、worker/comments.js、worker/index.js、worker/test.mjs，无迁移或新增依赖。

本次新增两项回归覆盖永久删除确认/鉴权/状态/版本/整批冲突/外键关系及文章评论数；现有Node/内存SQLite验证确认、状态、整批冲突、回复目标置空、根评论级联、同时勾选根和回复、统计口径通过，无安装依赖。功能提交c9e6a24bff6d8d693cf93548a037b9cadb7fce57，Cloudflare Build e40f261f-f18d-4cfa-8fdf-58cde5f41d52完成，62/62测试通过、0失败，Worker版本1497cd26-1c9f-4c4a-8c45-33e57148220d上线。内置浏览器实测回收站2条留言各有彻底删除按钮、全选2条后批量确认说明完整且默认取消；取消未删除，文章库8列正确显示评论数3/0/0/53，控制台无错误。截图用户本地Documents/Codex/article-comment-counts.png。未执行生产彻底删除，写流程由SQLite/云端回归覆盖；源码和规则文档已同次提交推送，此处补记实际结果。


## 最新工作：后台体验及评论管理（2026-10-06）

用户授权修复整站浏览发现的问题。admin/index.html 的编辑器保存栏改为正常文档流，避免窄/矮窗口遮挡标题与正文；save-state改为尚未保存/已保存/有未保存修改，仍无自动保存。评论管理补按文章和状态组合筛选、昵称/正文/作者回复字面搜索、长文3行折叠及本页多选公开/隐藏/移入回收站/恢复。assets/admin-comments.mjs负责控件、锁、确认、分页、选中版本和安全纯文本展示；刷新/筛选/翻页清选择。worker/comments.js增加参数化筛选和bulkComments，worker/index.js新增认证POST /api/admin/comments/bulk；单条SQL检查全部id/version及状态，任何冲突整批失败，不使用逐条部分写入。无需新数据库迁移，无新增依赖。评论回收站仍无永久删除或自动清理。

关联文件：admin/index.html、assets/admin-comments.mjs、worker/comments.js、worker/index.js、worker/test.mjs；README、AGENTS及docs/FEATURE_MAP.md同步当前行为、API、维护规则和定位。worker/test.mjs新增组合筛选/字面关键词/分页，以及批量鉴权、同源、JSON、重复ID、上限、冲突原子性、恢复及未选保留回归。实际本地复用已有Node24和SQLite，筛选/分页、字面%_、版本与状态原子冲突、四种批量操作及未选保留通过，变更模块/后台内联脚本语法检查通过。未安装本地依赖；完整路由回归和构建交由既有云端流程执行，结果待部署后补记。未对真实评论或私密留言执行验收写入。

用户另授权更新两篇公开示例文章的旧发文说明：hello欢迎页及rich-markdown-demo图文示例应说明后台写作、手动保存、D1发布、R2上传和固定自动短名；保留现有正文其他部分、图片位置、文章ID和链接。线上内容独立于_posts旧迁移文件，已通过D1版本/原文/draft_body为空条件更新并逐字回读：hello版本3→4、rich-markdown-demo版本1→2；旧正文快照分别保留在历史版本3/1。ID、permalink、原图片地址与位置保留，未改评论/留言/R2。旧_posts迁移文件继续作为历史资料，未用其覆盖线上文章。

### 本次实际验证与部署结果

功能提交 f8a22ce4a0cb9fee01709d105e22b984a17344de 已推送main；Cloudflare构建4f73951b-59d5-476a-bb8b-e4e02966c194成功，全套60项测试通过、0失败；Worker版本1123d7dd-adc4-4984-a069-0c3c3f950d28已部署到正式域名。
真实浏览器确认：状态/文章组合筛选选技术文章显示3条，再搜索昵称itfetter显示2条；全选计数2及按钮启用，批量移入回收站弹窗默认取消，点击取消后评论保留；清除筛选后57条、已选0条。窄窗口文档宽410、滚动宽410，无横向溢出；新文章两处均显示尚未保存，临时标题输入后显示有未保存修改；保存栏position=static，窗口高556时位于正文下方，不遮挡标题。
未保存标题测试随后触发放弃修改确认，原标签页浏览器控制在弹窗处超时，未保存/发布；可手动确认放弃临时测试输入。独立标签页正常读出新版管理，控制台无error/warn，验收截图在用户本地保存、未提交仓库。浏览器未实际批量修改真实评论，长评论折叠实现和短评论隐藏检查完成，但线上现有本页评论未达到3行，未新写长评论验收数据。路由安全/批量写入由内存SQLite及云端测试验证。

## 功能定位入口（2026-10-06）

新窗口修改功能前，请阅读 [功能定位与修改地图](docs/FEATURE_MAP.md)：按需求查找页面、后端模块、API、数据库迁移和测试入口，再核对实际代码。本地图记录当前定位，本文中的早期功能记录保留为历史，不能覆盖后续有效规则。


## Linux / Docker 后续迁移方案（2026-10-06，未实施）

当前仍使用 Cloudflare。用户确认未来可采用可拉取的应用镜像 + 独立数据库 + 阿里云 OSS，通过 Docker Compose 在 Linux 云服务器部署；宝塔负责 HTTPS / 反向代理。详细准备、适配、JSON 导入、更新与回滚步骤见 [迁移备忘](docs/LINUX_DOCKER_MIGRATION.md)。目前未提供可部署镜像，D1 与 OSS 适配尚未实现，不得把规划描述为现成功能。

本次文件：新增 docs/LINUX_DOCKER_MIGRATION.md，README/AGENTS 增加入口，本文件记录状态及文件地图：该文档只负责未来迁移规划，不是当前部署指南；现行 Cloudflare 部署仍见 worker/README.md。验证为文档检查与 GitHub 写入回读，无业务代码、数据库或配置修改，无需运行业务测试；提交推送结果由 GitHub 确认，可能触发现有 main 自动构建，但本次未主动更改任何部署资源。


## 当前评论发布规则（2026-10-05，取代此前先审核说明）
按用户要求，新访客评论及回复直接以approved状态公开，无需审核；后台默认全部评论，支持隐藏、重新公开、软删除和恢复，历史pending状态仍兼容。已有隐藏、回收站及历史待审核内容不批量改动。提交成功在页面显示服务器确认的公开内容；重复提交不重新公开被管理员隐藏的评论。保留同源/HTTPS/JSON/字段/纯文本保护、UUID幂等、D1原子限速和id/version管理。无需迁移，不改既有0009/0010。文件入口worker/comments.js、assets/comments.js、assets/admin-comments.mjs、admin/index.html、_layouts/post.html；worker/test.mjs增加直接发布回复与隐藏后重试回归。没有本地下载依赖；云端完整测试与部署待核对。


## 后台刷新保留页面（2026-10-05）
后台用同源URL查询参数view记录所在栏目，编辑已保存文章时另记录id。切换栏目用replaceState，不重载页面；登录/刷新后验证会话再恢复栏目并读取其数据，编辑正文仍从认证API加载，不写入浏览器持久存储。新文章刷新只恢复新建界面，未保存内容仍需先保存草稿；原有beforeunload/切换确认保护保留。非法view回工作台，非法文章id回文章库，文章读取失败显示提示。文件入口为assets/admin-route.mjs、admin/index.html和worker/admin.test.mjs。

原因：后台原login()每次固定panel(overview)，刷新丢失栏目。已改为URL路由恢复；新增模块和回归在当前地图中如上。验证：本地现有Node语法检查及4项文章库/路由测试通过，无安装依赖。源码main提交0488b3026b9359b3d26436557e3f68a6720dddcc，Cloudflare构建e8d96b40-6254-4d13-9276-ed7c3d42af38全套55项通过、0失败，Worker版本3530ea48-5172-4e64-9784-fcf3c10f7f23成功上线。Chrome独立标签页实测评论管理、文章库、留言管理、账号设置刷新均保留栏目；打开hello文章后刷新仍恢复同一篇标题和id。未修改或保存文章。截图为用户本地Documents/Codex/admin-refresh-check.jpg。未改D1/R2或用户文章/留言/评论。

## 最新工作：文章评论（2026-10-05）

## 文章评论（2026-10-05）

每篇公开文章底部支持访客填写昵称和纯文本评论（最多3000字）。评论新提交直接公开，后台“评论管理”可重新公开、隐藏、回复、移入回收站和恢复；作者回复与评论一起公开。访客昵称未经身份验证，评论不接受 HTML/Markdown 渲染。私密“联系留言”仍只对管理员可见。

首次部署评论前应用新增迁移 `0009_comments.sql`，不要修改旧迁移。公开接口 GET/POST `/api/comments`；认证管理 GET/PATCH `/api/admin/comments`。写入验证同源、JSON大小、提交UUID，人工重试不重复产生评论；D1 原子限速每IP每小时5次、全站每小时100次。评论每页20条，修改带id/version。删除文章会级联删除所属评论。

内容备份现包含评论和作者回复，便捷备份评论上限1000条，支持恢复没有comments字段的旧v1备份；仅补缺，不覆盖。评论回收站当前可恢复，暂无定时清理或永久删除入口；不把移入回收站说成物理删除。当前是文章级评论，未实现选中文字的行内评论、访客间楼中楼或点赞。

### 当前文件地图补充
- `worker/comments.js`：匿名评论提交、幂等与原子限速、公开列表、管理员审核/隐藏/回复/回收站，绑定SQL。
- `worker/migrations/0009_comments.sql`：article_comments、索引和comment_limits；已在生产执行，创建空表并登记迁移，未改文章/留言内容。
- `worker/index.js`：公开及认证评论路由、同源和请求体保护，沿用no-store API策略。
- `_layouts/post.html`、`assets/comments.js`、`assets/front.css`：文章底部评论、分页、表单、15秒请求超时和提交失败保留内容，textContent渲染。
- `admin/index.html`、`assets/admin-comments.mjs`：评论管理导航及筛选、审核、回复、隐藏、回收站、版本冲突和自定义删除确认。
- `worker/backup.js`：评论导出/恢复、容量检查、旧备份兼容；`worker/test.mjs`补充审核/回复/隐藏/重试/限速/跨站/分页/备份/级联回归。
- 上述为源码，不含私人内容；静态build仅复制前端资源，新模块在assets内自动纳入。

### 验证与发布状态
本地复用Node24，无安装：修改的JS和后台内联module语法检查通过；内存SQLite直接执行9个迁移，审核前公开列表为空、审核公开、回复、隐藏、版本冲突、回收站恢复、同ID人工重试、限速、备份新旧兼容和删除文章级联均通过。全套Worker依赖测试由Cloudflare构建执行，不在本地下载依赖。已提交main：84d113245f8a1ec6d14029e1b70ba2cd0540a702；Cloudflare构建53a6de36-a277-400a-a930-f9d0249082ae全套54项测试通过、0失败，部署Worker版本f47515d9-7923-4b90-9135-34ecba4e11b1成功。Chrome实际验证后台评论入口、待审核与回收站空状态，公开文章评论区域/分页/昵称与正文输入；390px手机视口无横向溢出，前后台无JS错误。仅填写临时昵称后清空，未提交。生产核对仍4篇文章、2条私密留言、0条评论，未改现有内容。截图保存在用户本地Documents/Codex/comments-public-check.jpg及comments-mobile-check.jpg；生产写流程未实测，已由SQLite/云端回归覆盖。

## 留言折叠与回收站（2026-10-05）
列表正文默认3行，查看全文/收起保留原文；新增删除确认、回收站筛选与恢复，无永久删除或自动清理。回收站不计入未读、批量已读不操作回收站；恢复保留原已读状态。DELETE /api/messages 与 POST /api/messages/restore沿用登录、同源、JSON与大小保护，id/version条件更新；已读操作增加version，旧删除/恢复返回409。
文件地图：admin/index.html为折叠/确认/恢复/筛选与状态反馈；worker/contact.js为查询、计数及条件更新；worker/index.js为鉴权路由；0008_message_trash.sql新增deleted_at/version/索引；worker/backup.js备份回收站状态并兼容旧备份缺省字段；worker/test.mjs新增路由安全、恢复、冲突与备份回归。顺带修正编辑器“工具栏插入”提示为“左侧区块菜单插入”。
已有Node/SQLite验证软删除、恢复、冲突、全文与未读隔离通过；后台模块及测试语法通过。没有本机下载依赖，没有删除现有两条生产留言。完整测试与部署结果待云端确认。

实际验证：0008已通过D1 API应用并登记迁移，生产仍2条留言、0未读、0回收站；功能提交07c97c5b927d121ba3010d7eb70c132009bce50f的Cloudflare构建5da6721e-79bb-43b9-8fdb-7d828b43b776完成，47测试通过、0失败，Worker版本eb86da57-9681-4ce6-8d5a-c9c20d5406ba。真实Chrome验证删除确认默认取消、取消保留留言及回收站入口；短留言折叠按钮补显式hidden样式，展开状态在周期刷新后保留。后续提交4bf8a1601aa657ebf9f91c22a0ed84cc0d1ace49也已上线：构建e820c295-d785-4d44-8e90-181fc6894f99成功、47测试通过/0失败，Worker版本c848ce95-fd74-42a0-9942-57a313ea49db；Chrome重新加载确认两条现有留言保留、短留言没有多余全文按钮，页面停留全部留言视图。删除/恢复的数据写入仅在SQLite测试，生产只验证确认后取消。

## 全层级目录与章节分享（2026-10-05）
正文目录支持H1–H6，按最低标题级别计算缩进（视觉最多3级缩进）；章节ID由规范化标题生成并处理重复/页面ID冲突，插入其他标题不改变已有唯一标题链接，改名或重复标题重排可能改变链接。目录点击更新URL片段，深链接加载及浏览器前进/返回定位章节，复制按钮随章节切换；旧reading-section-N按原H2/H3顺序解析。文字用textContent，保留折叠目录、减少动态效果与键盘焦点。assets/heading-links.mjs为纯标题映射，assets/reading-tools.js以module加载；首页与独立文章模板同步module入口，front.css支持全部标题滚动偏移/层级/当前章节，公开缓存key更新v2。worker/heading.test.mjs纳入云端测试，无新增依赖/数据迁移。RSS、预计阅读时间、桌面侧栏目录不在本次范围。
验证与部署：本地已有Node的3项标题映射回归与模块语法通过，未安装依赖；功能提交d757397dabba23ff18d43ae954900b04215d2452已推送main；Cloudflare构建7ed978b0-3507-4cf6-90b0-721f772cdd17成功，46项测试通过、0失败，Worker版本3edd21d7-3a9a-4111-9923-637b6e415e72。线上只读HTTP确认首页/hello独立文章module入口及reading-tools.js/heading-links.mjs均200且内容更新；未写入生产统计/留言/文章。真实浏览器交互仍待验收。

## 前台稳定性与公开缓存（2026-10-05，当前变更）
用户确认修复四项：留言请求15秒超时，失败保留输入并提示可能已收到、不自动重发；分类/搜索/排序/页码保存到首页URL，刷新和浏览器返回恢复；本站同标签页文章导航恢复最后列表地址（sessionStorage仅存公开URL、不存留言）；文章不存在及HTML导航404提供返回首页/文章/联系入口并保持404/noindex。
公开文章、posts.json/posts.js、sitemap、robots使用Workers Cache API 30秒副本；浏览器max-age=0/must-revalidate避免二次延长，缓存命中不查D1。查询参数归一化且文章canonical不含查询；仅200且无Set-Cookie的公开响应入缓存。后台/管理API/写请求/失败/404不缓存，缓存读写失败回退源站。Cache API仅本数据中心有效，依赖TTL而非全域清除；发布、删除、撤下与阅读数最多约30秒反映，不声称立即更新或缓存能免除Worker调用。新源码部署缓存key版本须更新以免复用旧模板。
文件地图：assets/public-utils.mjs为列表URL解析/序列化和留言超时请求；assets/front.js为状态恢复/同步和表单反馈；index.html将front.js改ES module以加载同源工具；assets/reading-tools.js恢复文章页返回列表地址；worker/public-response.mjs为公开缓存白名单、HEAD/错误隔离及404 HTML；worker/index.js接入公共响应包装与HTML404；worker/public.test.mjs新增5项缓存/隔离/404/状态/超时回归，worker/package.json纳入云端测试。assets白名单沿用构建自动复制，无新依赖/数据表/配置/迁移。
本地已有Node5项回归与前端/Worker语法通过，未安装依赖。功能源码与维护文档已同次提交并推送 main：0946c6024f6f2fc6f238a05c3c940a5c28ee2f57。Cloudflare构建84e0baa5-2d6b-4a84-b528-ef05f0f753a7成功，43项测试通过、0失败，Worker版本556af688-dd21-428c-a7bf-302929b616eb。线上只读HTTP确认首页module与新工具200、posts.json MISS→HIT（4篇摘要）、hello文章200、缺失文章与普通HTML路径404且完整页面/no-store，未登录api/posts 401/no-store。实际线上静态资产层规范化Cache-Control为public,must-revalidate,max-age=0；边缘命中通过X-Blog-Cache确认。没有生产数据写入，未安装依赖。浏览器连接超时，真实鼠标/手机视觉尚未验收；不向生产写测试留言、文章、统计。目录更多级别、章节分享及预计阅读时间属于建议，本次仅做优先四项，RSS仍延后。



## 无顶部工具栏的文档写作交互（2026-10-05，当前交互）
正文移除常驻工具栏：复用原 Vditor 4.0.0 的原按钮和事件，把它们移入按需出现的上下文菜单。悬停正文区块时左侧显示类型+六点入口（H1/H2、T、列表、表格等）；仅明确点击入口才把光标定位到目标区块，悬停不改变选择。菜单就地选择正文/H1–H6，支持原有加粗/斜体/链接/列表/任务/引用/代码/表格/图片/撤销等；移动、删除、属性仍由原引擎处理。菜单等待对应区块的原生操作生成，旧区块操作在等待期间隐藏，不复用旧删除目标。选中文字时显示只包含文字格式的小菜单；折叠选区、正文输入、外部点击、Esc、滚动、窗口变化、模式切换、保存上传锁关闭菜单。中文输入组合期间不显示悬停或选字菜单。手机点击正文也可显示侧边入口；Alt+Shift+B 可用键盘打开当前区块菜单。
当前文件地图：assets/document-editor.mjs 管理 hover/选区/菜单生命周期、原工具条移位、原生区块面板接入与视口定位；assets/document-editor.css 管理正文留白、浮动菜单、H1–H6原生按钮布局与内联菜单筛选；worker/document.test.mjs 维护7项适配器回归（5项原文/保存/上传/隔离/失败重试+菜单边界+悬停/目标选择/选字/中文输入/锁）。未新增依赖、未改数据库或保存字段；没有飞书协同/评论/翻译/子文档功能。图片上传仍走既有认证路径，复杂自定义HTML仍可切Markdown。
验证：现有本地Node语法和7项适配器模拟回归通过，无安装；功能提交 9e7cc8ebabb634d4616fefceb4ac8cf0685b4c1f 已推送；Cloudflare构建 d034fa4c-ac86-46f2-b3c0-d95734518077 成功，38项通过、0失败，Worker版本 f7801c59-f1f5-4cf6-aa61-d11e1e61ffa9。正式域名脚本/CSS只读检查确认悬停入口、文字选择菜单、无常驻顶栏及H1–H6布局。浏览器库存可读，但新建预览标签超时，未完成真实浏览器及手机端交互验收；不可把模拟回归当成真实浏览器验收。未在生产写入测试文章/图片。源码与交接同次提交，实际构建信息随后补记。


## 正文侧边区块入口（2026-10-04，已被悬停上下文菜单替代）
替代顶部“区块操作”：点击正文中的目标区块后，左侧显示六点按钮；点击按钮展开原生移动、删除或属性菜单。入口跟随当前光标，不根据鼠标悬停改动选择。原生菜单生成完成才显示入口，防止快速切换光标时操作上一个区块。pointerdown 保留选区；不透明菜单靠近入口，限制视口边界。正文预留左侧空间，手机同样保留；离开文档模式、保存/上传锁、离开可见区隐藏入口。保持向下工具栏提示、Esc/正文点击/滚动关闭菜单与 Markdown 保存流程。
当前入口文件 assets/document-editor.mjs 负责选区跟踪、侧边入口生命周期和菜单定位；assets/document-editor.css 负责侧边留白、六点按钮与面板外观；worker/document.test.mjs 增加选区保留、菜单夹紧及锁隐藏回归。本地现有Node 6项通过，无依赖安装，无生产文章数据写入；功能提交 7ac17e1b64a8948c8b309358e6f8e68da2a5534c 已推送；Cloudflare构建 b7e28371-38f2-4c44-b697-ee8a4c0f904f 成功，37项通过、0失败，Worker版本 156c94ea-7715-4f4d-a6bd-43cf209c77ac。正式域名脚本/CSS确认侧边入口、移除顶部入口、手机留白。尚未完成真实浏览器滚动/键盘/手机验收，用户截图是改动前参考。


## 编辑器浮层体验修复（2026-10-04，顶部入口已被侧边入口替代）
工具栏使用官方 tipPosition=s 并在 assets/document-editor.css 限定提示向下，修复吸顶后向上提示超出视口。正文区块原生透明浮层默认隐藏；工具栏新增“区块操作”入口，光标放入目标后点击才展开移动/删除/表格/链接/图片属性。不透明面板定位在按钮下方并限制左右视口边界；点击正文/外部、Esc、滚动、调整窗口、输入、切换模式及保存/上传时关闭。保留原引擎事件与操作，不另写删除/移动逻辑，不修改文章 Markdown、鉴权或数据库。
当前修改入口：assets/document-editor.mjs 为工具栏配置与浮层开关/关闭行为；assets/document-editor.css 为提示方向及面板外观。既有 worker/document.test.mjs 回归继续验证同步与草稿保护。无本机依赖安装；本地现有 Node 适配器回归5项通过；功能提交 fd09147d2a435e6ac2aa0ec1bbc7093dc0497e14 云端构建 dbec5124-aaba-4ad5-8524-fd65bdc514a3 成功，36项测试通过、0失败，Worker版本 90166490-208e-473d-aff5-ab78039b71c9。正式域名脚本/CSS返回成功并包含向下提示、手动区块操作、隐藏自动浮层与不透明面板。真实浏览器连接此前超时，本次截图来自用户；未将截图当作修复后的浏览器验收。

## 文档式正文编辑（2026-10-04，当前方案）
用 Vditor 4.0.0 的 wysiwyg 连续文档编辑替代逐段 contenteditable：标题、列表、任务列表、引用、表格、代码和链接可直接编辑，工具栏支持插入与撤销/重做，Markdown 快捷输入保留。图片粘贴/拖入/选择上传经原认证 /api/image 写 R2，上传完成在当前光标位置插入。并非飞书完整复刻，没有协同编辑、评论、自动保存。
Markdown 仍为唯一保存字段；初始化、切换模式和未编辑时保留原文，真实文档编辑后 Markdown 格式可能被规范化。复杂自定义 HTML 请用源码模式。保存前 flush 捕获当前正文；保留保存草稿/发布、id/version、历史、未保存切换保护，加载旧回调不能覆盖新文章。缓存禁用，不把草稿写入 localStorage。文档模式使用引擎 sanitize=true；只读预览/公开文章仍由认证 /api/preview 与服务端清理规则生成，不直接发布引擎 HTML。
当前文件地图：admin/index.html 为模式、正文同步、上传与保存流程；assets/document-editor.mjs 为引擎生命周期、光标插图、同步/锁与重试；assets/document-editor.css 为文档画布和手机工具栏；scripts/editor-assets.mjs 在云端构建取得固定版本必要资源并校验仓库固定 SHA-256，scripts/build.mjs 合入 dist/assets/vendor/vditor；vendor/manifest.json 记录版本/哈希/大小，LICENSE 随资源保留。运行时资源同源，不把正文送第三方 CDN。worker/document.test.mjs 为初始化原文、实时同步/flush、保存上传锁、旧回调隔离、资源失败重试五项回归。原 assets/visual-editor.mjs 与 visual.test.mjs、server editorBlocks 仅保留兼容/历史回归，已不是默认编辑器。
验证补充：功能提交 058b5fbc5bd39e46e634cf19b25c242dceb5fae1 自动构建 fd5983b6-c83c-4454-a5e8-63a48b6e128a 成功，36项测试通过、0失败，Worker版本 a7bd9ebb-1bd7-44ab-a1d2-fdd9ad4f5783。正式域名新适配器、CSS、Vditor核心/中文/图标/主题与manifest均200，首页200；Lute资源HEAD200，未登录preview返回401。浏览器连接再次超时，未完成真实浏览器编辑验收；仅模拟适配器/云端回归/HTTP，不宣称实际输入体验全项验收。资源总约4.14MB（未压缩），首次编辑加载较轻量旧版增加；缓存与传输压缩由静态资产提供。最终功能补丁提交 1f9c7da548751368b7d75b23a72b4a8ac264ed32 已推送；构建 78c5a077-9a01-42a0-a0f4-985e990c5815 成功，36测试通过、0失败，Worker版本 9ea7a018-8f00-4699-b9e4-3d9cc5fd1e8b。该补丁把七份资源SHA-256固定进仓库，变更需重新审查版本/许可证/哈希；资源加载超时可重试或切换源码，无生产数据写入。

> 更新于 2026-10-04。当前采用 Cloudflare 全站架构与自建账号密码登录，以顶部“自建管理员登录”及最新部署进度为依据；2026-09-27 及之前的内容为历史记录。后续提交信息和修改记录使用中文。





## 逐段可视化正文编辑（2026-10-04，历史方案，已被文档编辑替代）

后台默认进入可视化编辑，直接点击标题、文字、表格单元格、列表、引用和代码修改；支持加粗/斜体、原生撤销重做、新增段落及图片上传/粘贴。图片插在当前区块之后。Markdown双栏、源码和只读预览仍可切换，沿用草稿/发布/version校验/历史版本；并非自动保存。

assets/visual-editor.mjs 负责逐区块编辑与Markdown序列化；未改动区块（包括引用定义、空白和CRLF）保留原文。自定义HTML、任务列表及无法精确映射的特殊语法只读保留，切换Markdown修改；不宣称覆盖所有富文本/表格结构编辑。粘贴文字仅接受纯文本，不插入外部HTML；视觉HTML只来自认证POST /api/preview的服务端清理，公开Markdown渲染继续安全清理。保存/上传时锁定可视化输入，异步结果检查当前正文防止覆盖新内容；中文输入不触发重新渲染。模块不引入新依赖；格式工具使用浏览器原生编辑命令（支持能力依浏览器，源码模式始终可用）。RSS仍延后。

文件地图：admin/index.html 为默认可视化模式、工具栏、模式切换及保存/上传锁；assets/visual-editor.mjs 为DOM区块编辑与局部序列化；worker/content.js 提供带原文映射的安全editorBlocks；worker/index.js 认证preview按visual参数返回区块；worker/visual.test.mjs 与worker/test.mjs 为局部编辑、协议、表格/代码、原文保持及鉴权回归。D1/R2数据结构、现有文章和凭据不变，无数据迁移。源码语法检查通过；4项独立序列化/控制器测试通过，覆盖表格对齐/竖线、代码换行、原文保持、异步竞态与保存锁。模拟后台DOM确认可视化修改→Markdown→草稿请求、模式切换保留正文、图片插入与解锁。首次构建f0098362-b53c-4a7f-87b5-69f7da2ea6ce因表格header布尔类型检查失败，未部署；修复提交1d10f4950c01c049f0a6b24fe7fc6d2c65914cbf构建5d291b6a-6c55-4383-8ec9-835595e61b12成功，30测试通过、0失败，Worker版本ddb50796-69c0-4685-8860-2943a508a8cc。正式域名模块200且包含createVisualEditor/combineBlocks、首页200；未登录visual preview返回401，未写生产文章/图片。浏览器库存查询报nodeRepl.fetch失败，未能做真实浏览器编辑验收；无本机安装。最终功能提交b0d8cdbea42a684794c08bd320246123f31b8b17的构建c3162409-0700-4d80-8a84-21cd6f115512成功，31测试通过、0失败，Worker版本3723caca-fbf3-4df8-b24f-57ceb3e0a46d；控制器与代码换行回归已纳入CI。

## 2026-10-04 阅读与内容恢复升级（历史变更）

归档默认只展开最近月份；独立文章显示完整首次发布日期与公开更新时间、上一篇/下一篇、最多3篇同分类推荐；代码块可复制。分享元信息包含标题、摘要与1200×630品牌封面。

后台编辑器提供历史版本：每次修改保存前自动记录，单篇保留最近50份；仅管理员可查看。历史从升级后开始，载入旧版本后需要保存草稿或发布才生效。草稿保存不改变公开更新时间，发布不改变首次发布日期。

账号设置提供手动内容备份与补回：包含文章、草稿、分类、历史、留言与R2图片，不含密码、会话、凭据、限速和访客去重记录。便捷备份限制内容约400万字符、图片12 MB/100张；恢复最多1000篇文章、5000份历史、1000条留言。文件含私密内容，应妥善保存。大规模备份使用Cloudflare原生D1/R2导出。

恢复先展示数量并确认，仅添加缺失记录和图片，已有内容不覆盖；跨D1/R2不提供原子事务，中断可重复提交。恢复已发布的缺失文章会重新公开它。下载备份时请暂停编辑以减少并发变化；不等同于自动定期全库灾备。RSS按用户要求延后。

文件地图：worker/migrations/0007_history.sql 为加列/历史表/保留50份的触发器；worker/backup.js 为权限后的内容导出补回；worker/index.js 接入鉴权历史和备份路由、公开日期/文章导航；admin/index.html 为历史/备份确认界面；assets/front.js 为归档展开策略；assets/reading-tools.js 与 front.css 为复制/文章导航；_layouts/post.html 与 assets/share-card.png 为分享卡。已通过现有Node语法检查；生产D1已应用0007，迁移后仍4篇文章、version合计7，历史0份。功能提交2f9d683ad4bb09c0a790c6ada28170932e2aed19；构建c1fb9a0d-1eec-475c-b647-d68d4c2d4b26成功，25测试通过、0失败，Worker版本232900d9-7ce2-41da-b353-cee1bcd769f0。HTTP确认独立文章200、完整日期、前后篇、同类推荐、OG封面PNG200、无未替换模板标记；未登录history/backup均401，登录页200。无生产测试写入、无本机依赖安装；浏览器此前超时，未声称本轮浏览器视觉验收。容量保护提交1f38129d8a53529cc21d9834c8d8098609b701bc，在下载正文前聚合预检查；构建1d64bea0-ab4d-444c-9614-aaff599cfb05成功，26测试通过、0失败，Worker版本33836e3f-6136-4ccc-bad8-98a433acade9。现有Node另外通过后台模块语法与模拟DOM检查：初始化、历史未保存提示、备份选文件/确认框/取消/下载路径。未用真实浏览器登录测试。

## 2026-10-04 独立文章入口与摘要加载（历史变更）

用户授权优先四项升级。文件地图：assets/front.js 改为异步 /posts.json 摘要读取、加载/失败/超时重试、独立文章链接与旧 hash 自动转向；index.html 移除阻塞 posts.js、加入初始加载提示与无脚本指引；worker/index.js 公开摘要 GET/HEAD、兼容 posts.js、实时 sitemap.xml/robots.txt；worker/test.mjs 检查正文/草稿隔离、未来排除、HEAD/方法、删除后实时地图。README/AGENTS 同步长期约束。后台、数据表、文章内容和 R2 无变化，未迁移数据。列表仍客户端每页 5 篇，下载全部摘要但不含正文；服务端分页、RSS、版本备份及其他阅读升级未在本轮实现。站点地图不使用 draft 更新日期作为 lastmod。验证：已有 Node 检查 Worker/测试/前端语法通过；模拟 DOM 验证网络失败→重试、独立链接、每页5篇、分类重置与旧hash转向通过。功能提交 8c6bd36502a43cdf71b94174e735a6f929a2755c；Cloudflare 构建 0b228710-df9b-467c-b3a7-bbe036256317 成功，23项测试通过、0失败，Worker版本 23371dd9-2b4b-468e-bf8e-55e7db147672。线上 /posts.json 200，4篇共1098字节，无正文/草稿字段；sitemap.xml XML可解析，首页+4篇共5地址；robots含地图入口；首页200移除posts.js阻塞脚本；hello独立正文200。未写生产测试数据，无本机安装。线上浏览器在前一轮审查连续超时，本轮为模拟交互+HTTP验证，未声称实际浏览器验收。

## 2026-10-04 首页文章每页五篇（历史变更）

用户要求每页 5 篇。index.html 增加语义分页导航；assets/front.js 先分类/搜索/排序再切片，条件变化回第一页、翻页回列表工具栏；assets/front.css 增加响应式分页与禁用状态。少于等于 5 篇隐藏分页，空结果保留原反馈。最新推荐和完整月份归档保持原行为；不修改数据库或公开文章接口。README/AGENTS 同步约定。验证：已有 Node 语法检查通过；12 篇模拟文章验证 5/5/2 分页、末页禁用、分类重置及空搜索通过。功能提交 4a485ad93a8e9df28429dc5deb41cd27276cbbdf 自动构建 898953f2-e042-4689-9ac9-779a42f4b13f 成功，22 项云端测试通过，0 失败，Worker 版本 af4a2ffb-3025-443f-b79b-c4571f75ce91。线上 HTTP 200，分页标记与 pageSize=5 已确认。当前公开 4 篇因此暂不显示翻页；未写生产测试文章，未进行本次浏览器视觉验收，无本机安装。

## 2026-10-04 首页分类去重（历史变更）

用户确认：首页保留列表分类筛选，移除重复合集卡片及无独立页面的合集导航。index.html 删除 collections 区域，首页数量改为“个分类”；assets/front.js 删除卡片生成，旧 #collections 转到 #articles 保持入口可用；assets/front.css 清理合集专用样式。README/AGENTS 同步当前行为，先前合集卡片说明为历史。文章推荐仍按首次发布时间，未改为最近更新；后台分类/D1/R2/文章内容均不变。独立合集页留作后续明确需求，不提供无内容入口。

验证：Node 脚本语法与 DOM 引用检查通过。功能提交 a4dbb6e37df57bb512da661da3ba324e73a6476b 已上线；Cloudflare 构建 44bf7e97-e038-499b-86f5-e1eb218c4fc6 成功，22 项测试通过、0 失败，Worker 版本 24ae64e8-2dd3-488b-a231-b8a595c9dcc0。线上首页 HTTP 200，collections 区域与导航已移除，月份归档保留，新脚本旧 hash 转向逻辑确认。无本机依赖安装。

## 2026-10-04 前台布局与阅读体验（最新变更）

沿用米白/森林绿/陶土色，优化导航、首屏、动态最新文章、文章列表、分类合集、月份归档、关于与私密联系表单。参考 AstroPaper 首页推荐/最近文章分区（https://github.com/satnaing/astro-paper/blob/main/src/pages/index.astro）和 PaperMod 简洁博客结构（https://github.com/adityatelange/hugo-PaperMod）；只借鉴结构，未复制主题代码或增加框架依赖。推荐从公开 posts 动态生成，删除后无硬编码失效推荐。合集只显示有公开文章的分类，不公开空合集/草稿。文章增加目录、复制链接、阅读进度、回到顶部；保留 #post/<id> 与 /articles/<id>/。

文件地图：index.html 首页语义布局；assets/front.js 公开文章推荐/搜索/排序/合集/归档/hash 路由及原联系提交流程；assets/front.css 首页与独立文章共享视觉/响应式/焦点/减少动画；assets/reading-tools.js 两种文章入口共用目录/进度/复制；_layouts/post.html 独立文章导航与工具。scripts/build.mjs 原 assets 白名单自动复制新资源，无 Worker/D1/R2 数据结构变更。

验证：已有 Node 两脚本语法检查、HTML ID 与脚本引用检查通过；本地只读预览使用公开 posts.js，阅读统计禁用、POST 禁用。桌面首页/联系区视觉检查，搜索无结果与清空、随笔合集筛选、#post/hello 目录、390px 手机无横向溢出、留言字数6、浏览器错误日志为空。没有生产写测试留言/阅读/文章。线上浏览器导航超时，后续用 HTTP 只读与云端构建核对。功能提交 5857456d0faea92039dd502a846ea318867dd1ae 已上线；Cloudflare 构建 59689645-4dd2-45fe-9353-db3c99d02f48 成功，22 项测试通过、0 失败，Worker 版本 2a0b5a25-fb36-483e-b01a-1abc7e916839。线上首页 HTTP 200 且有新 CSS/合集；独立 /articles/hello/ HTTP 200 含 reading-tools.js，两新 CSS/JS HTTP 200。临时预览关闭，无本机依赖安装。

## 当前项目速查（新窗口先读此节）

以下为当前方案；后文中 GitHub Pages、Access、未部署、空数据库等说明属于历史记录，不能用作当前状态。

| 项目 | 当前资源 |
| --- | --- |
| GitHub 所有者 / 仓库 | `itfetter` / `itfetter/itfetter.github.io` |
| 源码分支 | `main`；Cloudflare 自动拉取 |
| Cloudflare 账户 | ID `见私有部署配置`；核对账户 ID，勿混用历史 itfetpro 账户。登录邮箱留在私有账户配置中 |
| Worker 应用名称 | `itfetter-blog`；tag `见私有部署配置` |
| 正式入口 / 后台 | https://itfetter.com / https://itfetter.com/admin/ |
| 临时 Worker 入口 | https://itfetter-blog.itfetterit.workers.dev |
| D1 数据库 | `itfetter-blog`；UUID `见私有部署配置`；绑定 `DB` |
| D1 内容 | 文章、草稿、单管理员密码哈希、会话哈希、登录限速；当前迁移至 0006_categories.sql；访客留言另存 contact_messages |
| R2 存储桶 | `itfetter-blog-images`；绑定 `IMAGES`；图片由 Worker /images/ 路由提供，未开启公开桶入口 |
| 静态资源 | Worker Static Assets，绑定 `ASSETS`，构建输出 dist/ |
| 域名注册 / DNS | 阿里云购买 itfetter.com；DNS 已切换 Cloudflare，Worker 自定义域已绑定 |
| 自动构建 | trigger `d46e6bfd-80eb-467d-b8ce-2f735a375caa`；main，工作目录 /worker |
| 构建与部署 | 从 Builds 私有配置 `BLOG_WRANGLER_CONFIG` 写入 wrangler.jsonc，npm ci → npm test → npm run build；npx wrangler deploy --config wrangler.jsonc |
| 管理员认证 | 自建账号密码 + D1 会话，不依赖 Zero Trust / Access；密码最低 6 字符 |
| 最近功能部署 | 删除确认弹窗源码 cb8faaff2f663c3abeb8bb6a55a9b8988e904506；云端 17 项测试通过，版本 262d3f88-61df-47d4-8d68-e3182b2e2d1a；后续文档提交不代表功能变更 |

**两条独立流程：** 改程序 → 提交 GitHub main → Cloudflare 构建部署；写文章/存草稿/上传图片 → 后台 API → D1/R2，即时更新，不产生 GitHub 提交。GitHub 源码不是线上文章与图片的备份。

**接手顺序：** 读 AGENTS.md → 本节及最新变更 → README.md → 实际涉及源码；操作前核对 main、Cloudflare 账户 ID、构建状态及生产数据。不要在线修改 Cloudflare 的打包 JS 来替代 GitHub 源码。不要安装本机依赖；依赖较重的测试交给现有云端构建。不要用真实文章试删。

账号密码、API token、会话、密码哈希与真实配置 JSON 不写入公开仓库。用户已明确授权公开的联系邮箱除外，不是认证凭据。新窗口仍需已连接相应插件/账户，文档本身不授予访问权限。

本次仅整理三份维护文档：本文负责资源与最新状态；README 指向速查；AGENTS 要求保持资源速查一致。无业务代码、数据库或资源配置变更。


## 2026-10-04 文章阅读量（最新变更）

用户同意新增按文章阅读量及短期去重。公开已到发布日期的文章在可见页面停留三秒后，由 /api/read 同源 JSON POST 记录；首页 hash 文章与独立文章页共用 assets/read-count.js。前台文章信息显示阅读次数，后台文章库提供阅读量列及排序，工作台显示当前所有文章阅读总和和前五热门文章。上线前阅读无法补算，初始均 0；删除文章后其计数不计入工作台总和。不是精确独立人数。

计数模型：posts.read_count + article_reads 的唯一 key 插入触发器，去重和累计在同一 SQLite 写入内完成；固定整点小时窗口内同文章/同 IP+User-Agent 一次，边界跨小时可再次计数，共享网络可能少计，改变浏览器/网络可能多计。只保存 SHA-256 短期摘要，不保存原始 IP/UA；到期摘要在后续记录时清理，无访问时不会主动清理（最长保留到下一次有效记录）。摘要不是永久访客画像。无需 Cookie。已登录管理员和明显 bot/crawler/spider/headless/preview UA 不计；非执行 JS 的爬虫不触发，UA 可伪装，非严格反作弊。每 IP 固定小时 60 次、全局 2000 次请求限速，重复请求也占额度。统计失败不影响阅读；三秒时页面不可见不计本次。

文件地图：worker/reads.js 记录验证/去重/限速；worker/migrations/0005_reads.sql 新增 read_count、article_reads/read_limits 与触发器/索引；worker/index.js 公开记录接口与输出计数；assets/read-count.js 共享三秒记录；index.html 首页文章计数；_layouts/post.html 独立文章计数；scripts/build.mjs 新增 ID/READS 占位符；admin/index.html 工作台/列表；assets/admin-utils.mjs 阅读排序；worker/test.mjs 验证同源、并发去重、管理员/bot、私密/不存在文章、限速与数据输出；三维护文档。现有静态构建 assets 复制已包含脚本，不增加依赖。

生产已应用 0005 并记录迁移名，文章 3、阅读 0；未更改正文/版本/留言，也未对生产写测试阅读。已有 Node 模块语法、真实 SQLite 并发去重、累计、版本保留、删除级联与排序检查通过。源码 d9df48ef1c8de11ea63384e08b462ad01bbd1e3e 已自动部署，构建 c8cee74e-c664-40bc-a5c2-6b3efb2bcaa1 成功，21 项测试通过、0 失败，版本 236e4428-d62e-4b77-a7bb-27db5b4705a6。浏览器本地模拟验证工作台 164 次总量与热门文章、文章库列/排序、前台从 128 到 129 的三秒反馈；未写线上测试计数，本地服务器已停止。独立文章页 ID/READS 占位符通过云端构建校验；未用真实访客生产会话人工计数验收。

## 2026-10-04 前台页脚简化（最新变更）

用户要求去除 Cloudflare 品牌与 GitHub 链接，说明源码仓库私密。index.html 页脚仅保留 © 年份 itfetter，右侧保留文章/关于/联系/CSDN；_layouts/post.html 独立文章页去除 GitHub Pages 技术署名，构建后同样仅版权。README/AGENTS 同步展示规则。文件地图仅上述两前台文件及三文档；未改仓库可见性、部署平台或数据库。

静态检查确认两个页脚均无平台署名，主页无 GitHub 个人页链接；不安装本机依赖，现有云端构建负责回归与部署。源码 e0d0f81c396dcd1864a58ab9712fa6669d233ba8 已部署；构建 05475930-1f23-4c25-a8e5-bdd6de667825 成功，20 项测试通过、0 失败，版本 a4f1de59-6c67-4881-afef-3cf24f67da0d。

## 2026-10-04 留言未读角标与全部已读（最新变更）

用户要求邮箱式未读角标及一键已读。admin/index.html 在留言管理导航增加红色数量角标（99+ 折叠，无未读隐藏，辅助标签保留准确数量）；登录时读取计数，后台可见时每分钟及恢复可见时刷新，留言页刷新列表。新增“全部标记已读”，更新后同步角标/分页/列表，单条标记未读也同步。批量/单条操作防重入，旧计数响应不得覆盖新状态；列表末页变空时退回有效页。

worker/contact.js 新增 unreadMessages/readAllMessages；worker/index.js 接入需会话的 GET /api/messages/count 与同源 JSON POST /api/messages/read-all。列表提供 readThrough 最大 rowid 快照；批量更新只覆盖此范围内未读留言，刚收到的更晚留言保留未读。按钮作用于当前获取到的全库范围，独立于筛选和分页。修改仅已读状态，不删除留言。无数据库迁移或依赖变更。

文件地图：上述后台/两 Worker 文件、worker/test.mjs（鉴权、跨站、计数、批量、范围无效、幂等、新留言保护、恢复未读），README/AGENTS/本文。已用已有 Node 检查模块语法；完整测试及部署交给 Cloudflare。未操作生产留言的已读状态。源码 2d878fb8a13b355db87aab8f242dc371019b5f8e 已自动部署成功，构建 6a006e76-209f-4c3b-9d3f-871e510f6c73。云端 20 项测试通过、0 失败，版本 1223dc13-9703-4ce7-a368-6303fb3b1402；本地浏览器验证登录自动显示 2 条未读、一键后列表已读、角标隐藏且按钮禁用，使用模拟数据未修改生产；服务器已停止。

## 2026-10-04 联系邮箱与私密留言（最新变更）

用户明确要求前台公开联系邮箱 Itfetterit@gmail.com，不接入邮件发送服务；访客可 mailto 自己发邮件，或通过留言框提交称呼、选填邮箱和正文。留言不会公开，也不发送自动邮件；作者在后台“留言管理”查看并标记已读/未读，每页 20 条，支持状态筛选。

文件地图：index.html 新增联系区、隐私提示、表单与反馈；admin/index.html 新增留言卡片、安全 textContent、分页/状态操作；worker/contact.js 新增参数化存储、查询和状态更新；worker/index.js 接入公开同源 POST /api/contact 与需会话的 GET/PATCH /api/messages；worker/migrations/0004_contact.sql 新增 contact_messages、contact_limits 及索引；worker/test.mjs 新增私密访问、跨站/类型/内容验证、限速与分页测试。README、AGENTS、本文同步。现有构建白名单已包含两个页面，无额外静态入口或依赖。

保护：JSON 上限 16000 字节，称呼 1–80、邮箱选填最多 254、正文 1–3000；隐藏 website 蜜罐；每 IP 固定小时窗口 3 次、全站 100 次的 D1 原子计数，IP 仅保留哈希。基础防垃圾不等于机器人验证码，可被分布式攻击滥用；当前没有 Turnstile。管理接口复用登录/同源保护。后台留言不作为 HTML 渲染，无公开列表。记录删除/自动邮件/站内回复不在本次范围。

生产通过 D1 API 应用 0004 并记录迁移名；仅新增表/索引，迁移前后 posts 数均 3（用户期间已有删除），不写测试留言。已有 Node 的前端/Worker/测试模块语法检查与真实 SQLite 保存、状态筛选、已读变更、内容验证和限速检查通过；无本机依赖安装。源码 b36e7907d44e616b73c6653795b4da9c63a4583f 已部署，构建 309f7629-a5bd-4352-b467-2b43460a3e31 的 19 项测试通过、0 失败，版本 f5b963b0-3e54-48a5-b2ea-93b791e9a8bf。本地浏览器模拟检查前台表单反馈与后台留言显示通过；线上不写测试留言。后台布局微调提交 a35d1ec1934358c0560e232baabc527e0fff510b 的构建 bd7e89f6-2a1d-45fc-a04f-006f5ac30004 已成功。手机检查发现旧 nth-child 导航隐藏规则影响新增联系入口，已改为小屏保持联系、隐藏 CSDN，同时增加页脚联系入口及表单横向留白；最终源码 01e3437492bee6a9a28dfd65abd87635087bfe53 的构建 ebbadf85-26e1-4d48-bee6-0aa989d4092e 成功，19 项测试通过、0 失败，版本 5a84a320-f966-4e76-a0ff-41f8a17bf029。手机联系入口复核通过，浏览器尺寸已恢复，本地临时服务器已停止。上线后 D1 留言为 0、文章仍 3；未写入线上测试数据。真实管理员会话的留言查看尚未用用户账号人工验收，服务端权限与状态操作已在云端测试。

## 2026-10-04 自定义删除确认弹窗（最新变更）

admin/index.html 新增统一 HTML dialog 与卡片样式，文章库/编辑页共用：危险图标、文章标题、删除范围、未保存提醒、取消与红色确认按钮。默认聚焦取消，Esc/关闭取消；标题 textContent 安全插入，重复打开受保护。替代原生删除 confirm，因此不再出现浏览器网站来源抬头。编辑页在确认前捕获 id/version，成功删除与刷新失败分开提示。README/AGENTS 同步；文件地图仅上述四个既有文件，无数据库或 Worker API 修改。

验证：本地使用已有 Node，模块语法、标题安全、默认焦点、重复打开、取消/关闭/Esc 与确认分支检查通过；未安装依赖，未删除线上文章。源码 cb8faaff2f663c3abeb8bb6a55a9b8988e904506 已推送；Cloudflare 自动构建 697f41b4-95c4-455b-a3b3-be8ffef241a9 成功，17 项测试通过、0 失败，部署版本 262d3f88-61df-47d4-8d68-e3182b2e2d1a。

## 2026-10-04 文章库行内删除（最新变更）

用户要求在编辑、查看右侧直接删除并确认。当前修改入口 admin/index.html：每行新增红色删除按钮，通过浏览器确认框显示标题、文章及草稿删除后果；取消不发送请求。确认后调用既有 DELETE /api/post，携带行内 id/version，上传/保存中阻止删除，同一文章防重复点击。成功移除列表项并刷新目录和统计，删除当前编辑文章时清空其编辑器，保留其他文章；服务端冲突保留原行并显示错误，已删除但刷新失败单独提示。README、AGENTS 同步维护规则。无新增文件/表，不改 Worker 或数据库内容，图片不会随文章删除。

验证：已有 Node 检查前端模块语法；复用现有认证、同源、id/version 删除保护与云端回归测试。源码 c6b2bfe4884f6c6f3806e8b49607d024050b97cc 已推送 main；Cloudflare 自动构建 e98fefba-9a3e-4002-a7dc-d07660b29ae6 测试 17/17 通过并成功部署，版本 e7bd77e0-f38b-4bf0-b3aa-3fe51c8d896a。未安装本机依赖，未删除线上真实文章作验收。

## 2026-10-04 明确写文章入口（最新变更）

用户确认将左侧写作入口改为新建文章。admin/index.html：左侧改名“写文章”，调用现有新建按钮流程并清空已保存编辑上下文；原文章和草稿从文章库/最近更新进入编辑。页面标题区分写文章、编辑文章、编辑草稿。未保存确认明确提醒先取消并保存草稿；取消保留内容，正在上传/保存时禁止新建与其他导航切换。README 与 AGENTS 同步操作规则，当前文件地图仅调整 admin/index.html 的导航职责，无新增文件，无数据库修改。

验证：检查共享新建流程、取消保护与保存/上传保护，已有 Node 执行前端模块语法检查；源码提交 78aa6f8f3f2b87385cc62f19edd3b81f7605d48b 已推送 main；Cloudflare 自动 build 63ad2977-550f-4876-b916-637ed281c2cc 完整测试 17/17 通过并部署成功，版本 89d3127b-fec5-4ace-90d6-8854c8ab0c8c。未安装本机依赖，未操作线上文章数据。

## 2026-10-04 数据库草稿与粘贴图片（当前文件地图）

用户要求保存草稿及像 CSDN 一样直接复制粘贴图片。实现未发布草稿与已发表文章待发布修改：公开字段和 draft_* 分开；保存草稿不影响前台，发布一次性替换公开内容并清空草稿。共用 posts.version 避免跨窗口覆盖，原文章日期和链接保持。首次保存时短名固定，未填短名保存草稿会自动生成。

文件地图：worker/migrations/0003_drafts.sql 新增 status（默认 published）与 draft_title/category/summary/body；worker/index.js 处理状态校验、草稿宽松字段、认证目录/编辑、公开接口限定 published，原子保存/发布及版本冲突；admin/index.html 添加草稿按钮、状态筛选/统计、快捷键草稿保存、粘贴/拖入图片、占位符上传定位及保存中编辑保护；assets/admin-utils.mjs 统计/筛选；worker/test.mjs 草稿隔离、公开版本、发布、删除与冲突测试；worker/admin.test.mjs 状态统计筛选。README、worker/README、AGENTS 更新使用和维护规则。

普通文字粘贴保持默认；仅正文 paste 事件提取图片文件，限制格式与每张 5 MB，不主动读取系统剪贴板。上传中禁止保存和切换，失败移除占位符并保留其他文本。R2 图片继续公开随机 URL，草稿文章私密不等于图片附件私密。当前手动保存草稿，无自动保存、修订历史。

本机无依赖安装；已有 Node 语法、HTML ID 检查与文章库 3 项测试通过，完整 SQLite/Markdown 路由测试交由 Cloudflare。生产已通过 D1 API 实施 0003 新增字段并记录 d1_migrations；迁移前保存仅 posts 的小型快照在本机 work/posts-before-drafts.json（不含账号表，未提交仓库）。迁移后全部原字段逐行一致，5 篇原文章均 published。SQLite 本机迁移验证通过。源码 abc2eab2e1640f55fcd04c3b2f89031fddb1bf3f 已推送 main，Cloudflare 自动 build 40de3048-0256-462c-b16e-7d208a253857 的 17/17 项测试通过，构建部署成功，版本 17afb710-8a8b-459d-80b1-d79caa39562b，正式域名路由保持。额外用已有 Node VM 模拟正文 paste/drop 事件，验证图片插入、上传中禁保存、上传期间新增文字保留、普通文字粘贴和失败占位清理通过；未读取用户真实剪贴板，未上传测试图片到生产。手机统计卡片改为两列，桌面筛选栏容纳状态选项。本次尚未用用户真实会话进行生产草稿写入或真实浏览器图片粘贴验收；没有默认账号或认证绕过。

## 2026-10-04 后台升级与旧文章恢复（当前文件地图与状态）

用户已完成 DNS 切换并确认 itfetter.com 可访问；Cloudflare API 确认正式域名绑定当前 Worker。后台空列表原因是 D1 posts 原为 0 条，并非隐藏或分页遗漏。已按 GitHub 原文参数化导入 5 篇文章，冲突时不覆盖；再次查询核对正文、日期与链接完全一致，保留 _posts 原文件。

当前文件地图：
- admin/index.html：工作台统计、最近更新、独立文章库（搜索、分类、排序、每页 10 篇）、编辑器三种视图、Markdown 导出、未保存离开提示和账号设置。
- assets/admin-utils.mjs：纯函数筛选、排序、分页和统计；worker/admin.test.mjs：跨页完整性与筛选统计回归。
- worker/index.js：目录返回摘要、更新时间及稳定链接；已登录同源 POST /api/preview 复用 worker/content.js 安全 Markdown 渲染。
- worker/test.mjs：完整目录、预览鉴权、跨站拒绝和危险 HTML 清理；worker/package.json：将新测试纳入云端 npm test。
- README.md、AGENTS.md 与本文：更新实际迁移和后台维护流程。静态输出仍由 scripts/build.mjs 白名单生成；D1 线上内容与 GitHub 源码独立。

Cloudflare Builds 的私有 BLOG_WRANGLER_CONFIG 增加 itfetter.com 的 custom_domain route，防止后续部署遗漏域名；账户配置未提交公开仓库。未新增表或改动认证规则，密码最低 6 字符。当前仅直接发布，不含草稿、自动保存或修订历史；导出的是当前编辑内容，不包含上传图片文件。

本机已有 Node 运行 2 项文章库测试通过，Worker 与后台模块语法检查通过，HTML ID 和引用一致；完整路由测试和构建交由云端，无本机依赖安装。源码提交及云端部署结果见后续追加记录。

实际发布验证：源码提交 37bc5593cdd60ca93593c481fff4ed94f10b4ed6 已推送 main；Cloudflare 自动 build 13f970c7-0191-4428-ae88-e177ed66a801 完整测试 15/15 通过、构建与部署成功，实际版本 a8351d0c-6c52-48d7-a38a-05c9832f516b；日志确认 itfetter.com custom domain 与 DB、IMAGES、ASSETS 绑定。浏览器本地模拟只读接口验证桌面工作台、5 篇列表、摘要搜索和旧文章编辑加载，390 像素手机截图检查；模拟接口只用于临时布局检查，未加入生产代码或绕过线上认证。正式文章页面浏览器标签显示正确文章标题，但详细读取超时，本机直接 HTTPS 受套接字限制，未完成真实登录后的线上写入和图片上传验收。临时本地服务器已停止，浏览器尺寸已恢复。5 篇线上正文、发布日期、链接再次与 GitHub 原文比较一致。当前无草稿/自动保存/修订历史。

## 2026-10-03 放宽密码长度规则（最新要求）

用户指定密码最低 6 字符，不要求复杂度。worker/auth.js 将初始化与改密最低长度改为 6，取消禁止相同密码规则；admin/index.html 同步 minlength 和提示；scripts/create-admin.mjs 同步隐藏输入提示；worker/auth.test.mjs 增加 5 字符拒绝、6 位纯数字创建/登录/改密、相同密码允许的回归测试；README、worker/README、AGENTS 同步规则。本段补充当前文件地图，旧 14 字符规则为历史。现有密码不自动变更，scrypt 强度、限速、当前密码验证、确认输入和旧会话撤销保持；128 字符上限用于请求资源限制。

本机已有 Node 独立认证测试 7/7 通过，包含六位纯数字边界验证，提交 4dca4db4190b8db95b1004b56d58b82d53bd7c49 已推送 main；Cloudflare 自动构建 21f1601e-10de-4d8b-b1aa-6d50b4f8a6be 完整测试 12/12 通过，构建和部署成功，版本 03d7ad94-d9af-4203-b704-ba41423d7e59。真实用户改密仍由浏览器使用当前密码执行。无本机依赖安装。

## 2026-10-03 后台修改密码功能（最新开发记录）

用户要求增加后台修改密码并由 Cloudflare 拉取部署。本次修改 worker/auth.js（当前密码验证、共享数据库限速、唯一密码版本、条件更新防并发覆盖、旧会话撤销及 Cookie 清除）；worker/index.js（已登录同源 POST /api/password、JSON 类型与 2048 字节限制）；admin/index.html（侧栏修改密码表单、三项密码输入、未保存文章保护、成功回登录）；worker/auth.test.mjs（错误密码、确认不符、长度、重复密码、多会话撤销、新旧密码及并发限速）；worker/test.mjs（路由未登录、CSRF、类型与大小保护）；README 与 AGENTS（日常改密及忘记密码维护规则）。这些路径亦为当前改密功能文件地图，未新增数据库迁移。

本机使用已有 Node 运行独立认证测试 6/6 通过，未安装依赖；完整路由测试与构建由 GitHub Actions 和 Cloudflare Builds 验证。源码与文档同一提交 4ff52a90ff6d17c09426837deaf541b60451a782 已推送 main。Cloudflare 自动拉取该提交，build 1a09ad11-df48-4187-a209-9f233e56b6a5 完整测试 11/11 通过、构建及部署成功（2026-10-03 09:57 UTC）；实际版本 9c9f8124-67ff-4a27-9d4e-d20ca8be8da9，DB、IMAGES、ASSETS 绑定准确。部署结果另以文档提交记录，不修改功能源码。真实浏览器改密验收须由用户输入当前密码，不能把测试账号或默认密码写入线上数据库。旧文章及正式域名未改。

## 2026-10-03 管理员初始化（最新状态）

用户通过本机隐藏输入脚本设置凭据。已验证初始化文件格式并确认 D1 原无管理员，使用参数化 INSERT 写入 id=1 的管理员；随后查询确认单条管理员记录存在。仅写入 scrypt 密码哈希，未提交密码或哈希到仓库。本机私密 .migration/admin.sql 已删除。数据库初始化完成；真实浏览器登录与 Workers CPU 验收尚未完成。旧文章导入和正式域名切换仍待执行。本轮源码未改，仅更新交接记录。

## 2026-10-03 GitHub 连接与首次实际部署（最新部署进度）

用户已在控制台连接仓库并创建构建令牌。API 核对 trigger d46e6bfd-80eb-467d-b8ce-2f735a375caa：仓库 itfetter/itfetter.github.io、生产 main、root=/worker、构建配置环境变量正确。通过 API 启动 build 228070b0-d5eb-4733-a8c9-a031f615ee9a，2026-10-03 09:15 UTC 云端构建及部署成功；8 项测试全部通过，生成静态资源并上传实际 Worker，覆盖旧 503 占位模块。部署版本 b3853eed-2be4-4f7f-9dac-24799a15c7ef，绑定 DB、IMAGES、ASSETS 均正确。依赖安装仅在 Cloudflare 云端进行。

临时入口 https://itfetter-blog.itfetterit.workers.dev 。首次 Wrangler 默认开启预览 URL，已通过 API 关闭 previews_enabled，同时构建环境 JSON 增加 preview_urls=false 防止后续再次打开；保留 workers.dev 主入口。正式域名未改。

本机 HTTP 请求受网络限制，web 工具也无法打开临时入口，因此目前只确认平台部署成功，不能宣称线上页面和登录验收通过。管理员初始化、5 篇旧文章导入、真实 Workers CPU/登录/CRUD/R2 验收仍待执行。当前没有默认密码，未初始化管理员时拒绝登录。此前应用创建章节为首次实际部署前的历史状态。本轮仅更新本交接文件，配置修改保存在 Cloudflare Builds，未提交账户配置或令牌。

## 2026-10-03 Worker 应用创建与绑定（历史状态）

用户要求继续创建应用、拉取 GitHub 并部署。通过 API 创建 Worker `itfetter-blog`，Worker tag 为 `见私有部署配置`。已绑定 D1 `DB` 到 `见私有部署配置`，R2 `IMAGES` 到 `itfetter-blog-images`，开启 observability，compatibility_date=2026-10-03、nodejs_compat。

当前仅上传创建应用用的最小占位模块，所有请求返回 503“博客构建尚未完成”。尚未上传仓库的实际 Worker 或 Static Assets，也未拉取构建仓库代码；不得称博客已部署。核对 settings 确认绑定准确；workers.dev enabled=false、previews_enabled=false，尚无公开临时入口。未改正式域名。

GitHub repo_connection_uuid 延用 `6743b7b9-ce99-4223-94d1-a362c7d63529`。build tokens 和该 Worker triggers 列表均为空。账户 token permission_groups API 返回 9109 Unauthorized，当前插件没有创建部署凭据所需权限；因此不能创建完整 Builds trigger，不能拿插件会话凭据替代部署 token。浏览器备用：Chrome 扩展连接报错；in-app browser 仅有未登录控制台页，无法操作用户已登录的 Chrome。

已为用户准备不含密码/令牌的完整构建配置，待在 Builds 环境变量 BLOG_WRANGLER_CONFIG 中设置。控制台操作入口为现有 Worker → Settings → Builds → Connect，选择目标仓库 main，root=worker；构建命令先从 BLOG_WRANGLER_CONFIG 写入 wrangler.jsonc，再 npm ci、npm test、npm run build；部署命令 npx wrangler deploy --config wrangler.jsonc。Cloudflare 的首次构建部署授权由控制台完成；不要在聊天发送 API token。账户配置不得提交公开仓库。

认证表已初始化但管理员数仍为 0；文章导入、管理员初始化、实际构建部署、CPU/登录/CRUD/R2 验收和正式域名切换尚待执行。应用最小占位模块在首次仓库部署时会替换，后续维护只通过源码构建。自建登录不再要求 Access。此次交接记录单独中文提交，源码本轮未改。

## 2026-10-03 自建管理员登录（当前有效方案）

用户明确改用自建账号密码登录，取消 Zero Trust / Access 作为部署前提。旧 Access 设计与下方 Access 阻塞记录仅作为历史依据。GitHub 保存源码、Workers + Static Assets、D1 文章、R2 图片、旧链接与版本冲突规则保持。

本次文件：worker/auth.js（scrypt 密码、哈希会话、共享限速）；worker/migrations/0002_auth.sql（单管理员、会话、限速表）；worker/index.js（登录/退出路由、会话鉴权、登录页跳转、同源/HTTPS 检查和管理页面响应头）；admin/index.html（账号密码表单、退出、过期提示）；scripts/create-admin.mjs（可信终端交互生成私密初始化/重置 SQL）；worker/auth.test.mjs 和 test.mjs（认证行为与路由回归）；worker/package.json（初始化和测试命令）；worker/wrangler.example.jsonc（移除 Access 变量、开启观测）；.github/workflows/validate-worker.yml（云端完整验证）；README、AGENTS 与本文件（当前流程和长期规则）。jose 不再用于运行时认证；暂保留锁文件中的旧依赖，避免无依赖安装的手工锁文件改写。

安全行为：不开放注册或公开密码重置，不设置默认管理员密码；未初始化管理员时拒绝登录。scrypt N=16384,r=8,p=5、16 字节随机盐、时序安全比较；会话随机 256 位，只存 SHA-256，最长 8 小时，HttpOnly/Secure/SameSite=Strict，退出撤销。密码重置版本检查防止并发登录产生仍有效的旧凭据会话。D1 原子登录计数，15 分钟 IP 10 次/全局100次（成功计数），429 带 Retry-After；该全局防护可使攻击期间管理员暂时无法登录。开发 HTTP localhost 仍需认证，取消原免登录模式。线上不得配置 development。

验证：本机 Node 24.19.0 的 4 项独立认证测试通过，覆盖随机盐、错误密码/账号、无管理员、Cookie 属性、哈希存储、换发、过期、退出撤销、重置版本、限速窗口和开发模式边界。完整项目依赖未安装，完整 Markdown/CRUD/构建回归交由新增 GitHub Actions；CI 结果及源码发布状态后续记录。尚未在 Workers runtime 测试 scrypt CPU 额度、真实浏览器与线上 D1/R2；不能沿用旧 Access 测试当成本次上线验收。没有安装本机依赖、下载工具链或改 DNS。

部署待办：应用新增迁移；在可信交互终端初始化管理员（不要聊天发送密码），导入私密 SQL 后移除临时文件；配置 Workers Builds 并部署，验收登录、限速、退出、CSRF、手机表单、旧链接、文章 CRUD、图片与 CPU/内存额度。当前未创建管理员、未部署 Worker、未切域名。已创建 D1/R2 和 GitHub 仓库连接继续复用，Access 无需继续配置。已开通 Zero Trust 不需关闭；截图确认团队域名存在，但插件近期 transport 错误，未完成线上操作。


实际发布与追加验证：自建登录代码、测试和文档在同一提交 `d379d3607944e39184d76a224bbc8e70708c8192` 发布到 GitHub main。GitHub Actions“验证博客 Worker”运行 `37105277637` 已完成且 success（https://github.com/itfetter/itfetter.github.io/actions/runs/37105277637），完整 npm test 与构建均通过。Cloudflare 插件随后恢复，通过 D1 query API 执行 0002_auth.sql 的所有语句并核对 admin_users、admin_sessions、login_limits 三表存在，管理员数为 0；这是实际线上建表操作，不是只生成本地 SQL。尚未通过 Wrangler 的迁移记录机制执行，后续运行 migrations 时注意核对；语句均为 IF NOT EXISTS。未写入密码或会话，未导入文章。Worker 列表仍为空，build tokens 列表也为空，自动构建与部署尚未配置完成。Access 已从部署前提中移除。

## 2026-10-03 GitHub 构建授权已恢复（最新补充）

用户通过 Cloudflare 控制台完成 GitHub 授权，截图显示 Continue with GitHub。随后 API 实际创建目标仓库连接成功：`itfetter/itfetter.github.io`，repo_connection_uuid 为 `6743b7b9-ce99-4223-94d1-a362c7d63529`。此前 8000008 / Git account disconnected 阻塞已解决。

同次核对：Worker 列表仍为空；Access organizations/apps 仍返回 9999 / access.api.error.not_enabled。用户已表示开通 Access，但接口尚未证实；需要核对团队域名、账户和开通流程是否完成，不能把用户操作截图或口述当成 API 已连通。构建 token 列表查询遇到 MCP transport 错误，未取得结果；没有创建 token、构建触发器或部署 Worker。本节仅记录已确认的账户状态变化，不含凭据。D1/R2 延用上次创建资源，正式域名未变动。

## 2026-10-03 Cloudflare 账户资源初始化（最新部署进度）

用户授权开始创建 Cloudflare 应用并部署。通过 Cloudflare 插件核对当前连接账户 `见私有部署配置`；该账户起初没有 Worker、D1 或 R2，Workers 子域名为 `itfetterit.workers.dev`。它与历史规划中提到的 `itfetpro.workers.dev` 不同，不能混用历史账户资源。

已实际完成：
- 创建亚太 D1 数据库 `itfetter-blog`，UUID 为 `见私有部署配置`。
- 按仓库 `worker/migrations/0001_posts.sql` 的结构通过 D1 API 初始化 `posts` 表和 `posts_published` 索引。未通过 Wrangler migration 命令执行；后续执行同一初始迁移前应核对迁移记录，其建表语句为 IF NOT EXISTS。
- 创建 R2 标准存储桶 `itfetter-blog-images`，位置 APAC。未启用公开桶访问，后续由 Worker 图片路由读取。
- 用户已确认唯一管理员登录邮箱；具体值应配置在 Cloudflare 账户配置中，不记入公开交接文档。

实际验证：创建接口均返回 success；查询 sqlite_master 确认 posts 表存在，文章数为 0。尚未导入旧文章，也没有上传图片。

阻塞与证据：
- Access 列表及组织查询返回 9999 / access.api.error.not_enabled；创建 Zero Trust organization 返回 10000 / Authentication error。当前连接不能完成初始化，需要通过账户控制台启用 Access，并检查插件所需权限。没有创建 Access 应用或放宽管理权限。
- 尝试为目标 GitHub 仓库建立 Workers Builds 仓库连接，接口返回 8000008 / Git account disconnected。需要账户控制台连接 GitHub，并授权 itfetter/itfetter.github.io；GitHub 插件的仓库访问不等于 Cloudflare 构建服务已获得访问。
- 浏览器控制台备用路径不可用：Chrome inventory 报连接错误；in-app browser 打开控制台超时，未完成任何控制台变更。

当前状态：D1/R2 已创建，D1 空表已初始化；Worker 未创建或部署，Access 未启用，Workers Builds 未连通，正式站点与 DNS 未改动。没有在本机安装依赖或下载构建环境。此次只更新本交接文件；正文中的旧“账户资源尚未创建”描述由本节更新。

继续前提与顺序：管理员启用 Access / Zero Trust 并连接 Cloudflare 的 GitHub 集成后，重新读取账户状态；创建同一 AUD 覆盖 admin 和 api 的应用、配置邮箱 Allow 策略，生成构建环境账户配置，连接 main 的 Workers Builds，导入并核对 5 篇旧文章，在临时域名验证权限、文章与图片后再切换正式域名。清理旧站仍须等验收通过。本交接通过 GitHub contents API 提交至 main；业务部署尚未发生。

## 最新交接：当前代码与部署状态

- 云端工作目录已完成 Workers + Static Assets + D1 + R2 + Access 改造，相关文件及验证结果见文末“2026-10-03 Cloudflare 全站架构迁移”。
- 当前改造已在云端 Git 提交并整合远端 3 个文档提交。此前推送的 403 权限阻塞已解决，2026-10-03 重新检查 `git push --dry-run origin HEAD:main` 成功；本次代码与维护文档通过正常推送发布到 GitHub main。推送结果以远端提交核对为准。线上 Cloudflare 资源配置、部署和域名切换尚未执行。
- 源码发布流程：修改代码 → 本地验证 → 提交到 GitHub 指定分支 → Cloudflare Workers Builds 自动拉取、构建和部署。Workers Builds 与仓库的连接目前尚未配置，不能宣称已经自动部署。
- 日常文章流程：在 `/admin/` 登录并写作 → 管理 API 保存到 D1，上传图片保存到 R2 → 前台直接读取最新数据，不产生 GitHub 提交，不触发代码构建。
- 维护以 GitHub 中的源码为准；正式连接自动构建后，避免在 Cloudflare 在线编辑另一份代码，以免下一次部署覆盖或产生不同步。
- 后续先提交并审查代码，再按 `worker/README.md` 配置 Cloudflare、连接 Workers Builds、导入旧文章并验收，最后切换域名与清理旧发布文件。保留已有文章和恢复依据。

## 2026-10-03 持续维护记录要求

用户明确要求：后续每次修改、更新和新增约束均同步记录，保证其他窗口能从仓库文件理解改动并继续维护。

本次修改 `AGENTS.md`，新增“必须持续记录的维护要求”：每次工作在本文件记录文件、原因、验证、问题、待办与提交/部署状态；长期规则及流程变动同步到 AGENTS，开发前必读，完成前检查文档覆盖，文档随代码提交。重要规则不能只存在于聊天中。本文同时记录此次要求，以便后续窗口接续。

验证：已核对两文件中的记录并执行 `git diff --check`。本次仅修改维护文档；当前迁移代码和文档仍未提交或推送到 GitHub，线上部署未执行。

## 当前文件地图与修改入口（2026-10-03）

此地图对应当前云端改造后的代码。新增、移动、删除文件或改变文件职责时必须更新本节；下面的历史项目地图只描述旧方案。接手时先确认 Git 状态和实际文件，不能把“实现完成”当成“线上已部署”。

### 当前源码和配置

| 文件或目录 | 内容与职责 | 什么时候修改，以及关联文件 |
| --- | --- | --- |
| `index.html` | 博客首页 HTML、CSS 和页面脚本；文章列表、分类、搜索、置顶卡片、旧 `#post/<id>` 阅读视图、CSDN 入口 | 改首页布局、筛选搜索、哈希阅读时修改；数据来自 Worker 的动态 `/posts.js`；阅读样式变化同时核对独立文章模板 |
| `admin/index.html` | 管理后台布局、编辑器、工具栏、预览、文章列表、发布编辑删除、图片上传、自建登录状态处理 | 改后台交互或字段时修改；字段/API 变化同步 `worker/index.js`；预览与最终渲染规则不同，需一并核对 |
| `_layouts/post.html` | 独立文章页 HTML/CSS 模板；构建时把 Liquid 转为占位符，运行时插入文章数据 | 改 `/articles/<id>/` 页面样式时修改；新增模板字段同步 `scripts/build.mjs` 和 Worker 模板替换逻辑；当前仍使用，不属于待删除文件 |
| `worker/index.js` | 请求路由、D1 会话验证、来源检查、D1 CRUD、版本冲突检查、图片上传/R2 读取、动态文章列表和文章页、Static Assets 转发 | 改接口、权限、数据读写或公开路由时修改；同步后台调用、测试和部署说明；文章数据通过 D1 参数绑定操作 |
| `worker/auth.js` | 密码哈希校验、会话建立/查询/撤销、HTTPS 与共享登录限速 | 修改认证策略时同步路由、数据库迁移、测试和部署文档 |
| `worker/auth.test.mjs` | 使用真实 SQLite 的独立认证测试，仅依赖 Node 内置模块 | 无依赖环境执行认证回归；完整路由回归在 test.mjs |
| `worker/migrations/0002_auth.sql` | 单管理员、带凭据版本的哈希会话、限速表 | 新增认证表；上线后结构变化新建迁移 |
| `scripts/create-admin.mjs` | 可信终端输入账号密码并生成私密初始化/重置 SQL | 修改初始化格式时同步 auth.js 与迁移；不公开注册 |
| `.github/workflows/validate-worker.yml` | GitHub Actions 云端安装依赖、测试与构建 | 修改 CI 验证流程时使用，禁止本机为了验证自动安装依赖 |
| `worker/content.js` | Markdown 转 HTML、危险 HTML 清理、标题等字段转义；允许的标签、属性、样式类与链接协议 | 改正文排版支持或渲染安全规则时修改；同步后台预览、文章样式和相关测试 |
| `worker/migrations/0001_posts.sql` | 初始 D1 `posts` 表与索引；id、标题、分类、摘要、正文、发布日期、永久链接、版本号、更新时间 | 数据结构后续变化新增迁移文件；同步 API、导入脚本和测试，不修改已上线迁移 |
| `worker/test.mjs` | 自动测试：账号密码与会话、D1 增删改/冲突、跨站写入、请求大小、图片接口、文章导入与公开时间 | 改权限、接口、数据模型、渲染或上传规则时补充相关行为验证；SQLite 为真实本地数据库，R2 接口测试使用内存实现 |
| `worker/package.json` | npm 构建、开发、测试、导入命令，以及运行和开发依赖 | 改工具命令或依赖时修改；同步锁文件、README 和环境启动说明 |
| `worker/package-lock.json` | 固定依赖解析结果，供 `npm ci` 重现安装 | 更新依赖时由 npm 生成，勿手工拼写版本或校验信息 |
| `worker/wrangler.example.jsonc` | 可提交的部署样例：Worker 入口、Static Assets、D1/R2 绑定及运行配置 | 改绑定名、资源结构或运行兼容设置时修改；同步代码和 `worker/README.md`，不填账户密钥 |
| `scripts/build.mjs` | 构建静态发布目录：只复制首页、后台和 `assets/`，生成独立文章模板 | 新增公开页面/资源或模板字段时修改白名单；不复制整个仓库，不发布后台源码、配置或文章 SQL |
| `scripts/import-posts.mjs` | 读取旧文章 YAML/Markdown，校验 id、链接、日期，生成不覆盖已有数据的 D1 SQL | 改旧文章迁移格式时修改；同步 D1 字段和导入测试，不自动执行线上导入或删除原文章 |
| `assets/` | 随程序发布的静态图片和设计资源；当前包含示例插画 | 修改站点固定资源时使用；后台上传的新增图片存 R2，不写此目录 |
| `.node-version` | Node.js 版本要求，当前为 24.19.0 | 升级运行环境时修改，并验证 SQLite 测试及 Wrangler 兼容性 |
| `.gitignore` | 忽略依赖、构建输出、本地状态、真实账户配置、开发变量和迁移数据 | 新增本地生成文件或敏感配置路径时同步；不要误忽略应提交的源码和锁文件 |
| `README.md` | 项目架构、开发命令、写作和数据说明、迁移状态概览 | 用户使用方法、开发流程或项目架构变化时更新 |
| `worker/README.md` | Cloudflare 资源创建、Access 策略、迁移导入、Workers Builds、部署和验收步骤 | 账户配置、部署命令、权限要求和迁移流程变化时更新 |
| `AGENTS.md` | 跨窗口通用协作规则、架构约束、安全要求、验证和文档维护要求 | 新增或改变长期规则时更新；每次开发前必读 |
| `PROJECT_HANDOFF.md` | 最新状态、文件地图、改动原因、验证证据、风险和待办，另保留历史记录 | 每次工作更新；涉及文件职责或结构时同步本地图，便于下一窗口定位修改入口 |

### 旧站兼容与迁移保留文件

| 文件或目录 | 当前角色与注意事项 |
| --- | --- |
| `_posts/*.md` | 5 篇旧文章的迁移来源，尚未删除；Cloudflare 正常运行读取 D1，修改这些文件不会直接修改线上 D1 文章。导入验收前保留 |
| `posts.js` | 旧 Jekyll 的文章列表模板；新 Cloudflare 的 `/posts.js` 由 `worker/index.js` 动态返回，构建不复制本文件 |
| `_config.yml`、`CNAME` | 旧 Pages/Jekyll 配置及域名文件；确认正式域名切换和恢复方案前保留，不作为新 Worker 配置 |
| `.github/workflows/publish-article.yml` | 旧 Issue 发文工作流，仍可写入 GitHub 并请求 Pages 构建；正式切换后需停用，避免两套写作来源 |
| `.github/ISSUE_TEMPLATE/publish-article.yml` | 旧 GitHub 发文表单；与旧工作流一起在迁移完成后处理 |
| `scripts/publish_article_from_issue.py` | 旧 Issue 内容解析、身份检查、写 Markdown 和请求 Pages 构建脚本；新 D1 写作不使用 |
| `write/index.html` | 已改为跳转 `/admin/` 的兼容页面；Cloudflare 实际 `/write/` 跳转由 Worker 路由处理 |
| `admin/config.js` | 保留旧文件位置，说明已改用同源 API；新后台不加载，不再配置单独 Worker 地址 |
| `ARTICLE_TEMPLATE.md` | 旧 Markdown/front matter 示例；用于理解迁移格式，不是新后台发布接口 |

### 生成文件及线上数据（不要直接当源码修改）

| 路径或资源 | 来源和维护方式 |
| --- | --- |
| `dist/`、`dist/article-template.html` | 由 `npm run build` 生成；修改对应源文件再重建，禁止只改生成文件 |
| `.migration/admin.sql` | 可信终端生成的私密管理员初始化/重置数据；不提交、不公开，导入后删除 |
| `.migration/posts.sql` | 导入脚本生成的文章数据；被忽略，核对并备份后执行，不能提交文章数据到源码仓库 |
| `worker/.wrangler/` | Wrangler 本地 D1/R2 和运行状态；被忽略，不是线上数据库 |
| `worker/node_modules/` | npm 安装的依赖；通过声明与锁文件管理，不手工修改作为修复 |
| `worker/wrangler.jsonc`、`worker/.dev.vars` | 被忽略的真实部署配置/本地开发变量；按部署文档管理，不提交密钥或生产开发模式 |
| Cloudflare D1 `posts`、R2 `IMAGES` | 正式文章和上传图片；通过管理 API 操作，源码提交不会替代数据备份 |

本次维护更新：用户要求增加文件地图以便其他 AI 定位修改。已核对实际文件和构建脚本，新增当前职责、关联修改入口、旧文件与生成数据说明，并同步 AGENTS 中的维护规则。仅修改文档，`git diff --check` 通过；尚未提交或推送，线上未变更。

## 历史交接记录（截至 2026-09-27）

## 当前开发到哪里

- 个人博客已部署在 `itfetter.com`，从 GitHub Pages 的 `main` 分支根目录发布；用户截图曾确认 HTTPS 可访问、Enforce HTTPS 已勾选，DNS Check 当时仍显示 In Progress。
- 首页原有的展示、搜索、分类与 `#post/hello`、`#post/note` 阅读方式保留。首页导航不显示登录入口，维护者可直接访问 `/admin/`。
- 文章从挤在 `posts.js` 的单行数据迁移为两篇 `_posts/*.md`；Jekyll 构建时生成文章独立页面与 `posts.js` 数据。首页分类按钮现在根据文章自动生成。
- `/admin/` 已改为可视化管理界面，但 Worker 和 GitHub App 尚未配置，当前只显示配置提示与 GitHub 备用入口；站内登录和保存仍未启用。
- 此轮新增 `ARTICLE_TEMPLATE.md` 供写文章复制，README 与 AGENTS 已更新。用户要求以后提交及变更描述用中文，已写入协作规则。

- `/write/` 现已跳转 GitHub 登录文章表单，原复制/下载式编辑器已移除。

## 项目地图

| 路径 | 用途 |
| --- | --- |
| `index.html` | 首页样式与阅读、搜索、筛选脚本。 |
| `_posts/2026-09-24-hello.md` | 欢迎文章。 |
| `_posts/2026-09-24-note.md` | 示范随笔。 |
| `_layouts/post.html` | Jekyll 独立文章页。 |
| `posts.js` | Jekyll 从文章源文件自动生成的 JS 模板，源码中包含 Liquid。 |
| `write/index.html` | 跳转 GitHub Issue 文章表单的备用入口。 |
| `admin/index.html` | 可视化后台，配置 Worker 后支持文章增删改与图片。 |
| `ARTICLE_TEMPLATE.md` | 新文章 front matter 与 Markdown 写法示例。 |
| `_config.yml` | Jekyll 构建设置。 |
| `CNAME` | Pages 主域名 `itfetter.com`。 |
| `README.md`、`AGENTS.md` | 使用手册和协作约束。 |

## 变更记录

| 日期 | 改动文件 | 改动与原因 | 验证 |
| --- | --- | --- | --- |
| 2026-09-24（初建） | `index.html`、`README.md` | 将 CSDN 跳转入口发展为独立静态博客。 | 网站已发布；早期示例文章可读。 |
| 2026-09-24（域名） | `CNAME` 与域名设置 | 绑定 `itfetter.com`；配置阿里云 DNS。 | 用户截图显示根域名 HTTPS 可访问并启用 Enforce HTTPS。 |
| 2026-09-24（管理入口初版） | `posts.js`、`admin/index.html`、`index.html`、文档 | 拆分文章数据，增加首页登录入口，编辑时转到 GitHub。 | 用户实际点击后进入 GitHub 编辑页；未实现站内后台。 |
| 2026-09-24（隐藏入口） | `index.html` | 移除首页导航中的登录链接；维护者直接输入 `/admin/` 访问文章管理入口。 | 已核对源码中导航链接移除；待 Pages 部署后确认线上显示。 |
| 2026-09-24（本轮） | `_config.yml`、`_layouts/post.html`、`_posts/*.md`、`posts.js`、`admin/index.html`、`index.html`、`ARTICLE_TEMPLATE.md`、三个项目文档 | 一篇文章一个 Markdown 文件，构建时自动生成列表与独立页面，逐篇编辑；提交信息改中文。 | 已在线检查首页显示两篇文章及自动分类，`/articles/hello/` 正常显示 Markdown 正文，`/admin/` 显示逐篇编辑和新增入口；尚未使用账号实际提交新文章。 |
| 2026-09-24（图文示例） | `assets/writing-flow.svg`、`_posts/2026-09-24-rich-markdown-demo.md`、`_layouts/post.html`、`index.html`、`ARTICLE_TEMPLATE.md`、`README.md` | 增加明确标注为示例的图文文章与自制配图，并为两种文章阅读方式补充图片、提示框、表格、代码块样式。 | 已在 `https://itfetter.com/articles/rich-markdown-demo/` 在线确认标题、图片加载、提示框和表格渲染；首页哈希阅读样式沿用同一套规则，待单独核查。 |
| 2026-09-24（写作页） | `write/index.html`、`admin/index.html`、`README.md`、`AGENTS.md` | 提供专用写作网址和 Markdown 工具栏、预览、草稿、复制/下载；管理页新增文章入口改为写作页，保留 GitHub 提交与图片上传步骤。 | 已在线核对页面打开、实时预览、文件名和复制的完整 Markdown；下载按钮尚未单独验证。 |

## 2026-09-27 自动发文改动

| 文件 | 原因 | 验证 |
| --- | --- | --- |
| `.github/ISSUE_TEMPLATE/publish-article.yml` | 用 GitHub 登录表单接收标题、分类、摘要和 Markdown。 | 已提交；Issue #1 的分类、摘要、正文已被成功解析。 |
| `.github/workflows/publish-article.yml`、`scripts/publish_article_from_issue.py` | 验证 itfetter 用户 ID，生成文章并请求 Pages 构建。 | 已核对源码；Issue #1（测试文章）已由作者提交；补正标题后工作流运行，生成文章并请求 Pages 构建。 |
| `write/index.html`、`README.md`、`AGENTS.md`、本文 | 入口改为 GitHub 表单并更新文档。 | 自动文章写入已验证；线上跳转和页面可达仍待核对。 |

自动文章使用 `article-<Issue 序号>` 链接。Issue 内容在提交后公开，图片可直接拖入正文。若 Pages API 调用失败，文章可能已写入但尚未部署，需查看 Actions 和 Issue 错误信息。旧文仍在 GitHub 文件编辑器修改。下一步由 itfetter 账号发布一篇真实文章，核对工作流、Pages 与前台页面。

## 已知问题与风险

1. `posts.js` 的源码现在是 Liquid 模板，不经 GitHub Pages Jekyll 构建不能直接作为普通 JS 执行；若部署工作流禁用 Jekyll，首页文章列表会失效。先查看 **Actions → pages build and deployment**。
2. 两篇文章迁移时保留了主要内容、原 `blog_id` 和哈希链接；已在线确认 `/articles/hello/` 可访问；`/articles/note/` 尚未逐页检查。
3. `/write/` 和 `/admin/` 均是公开页面；写作页草稿保存在当前浏览器，清缓存/换设备可能丢失，预览与 Jekyll 的最终渲染可能略有差异；图片和 Markdown 分别提交。仅 GitHub 控制仓库修改权限。想在自己域名下安全地直接编辑/保存仍需要可信授权服务，不能把密码或 GitHub 写入令牌放进公开静态页面。
4. `/admin/` 是公开页面；仅 GitHub 控制仓库修改权限。想在自己域名下安全地直接编辑/保存仍需要可信授权服务，不能把密码或 GitHub 写入令牌放进公开静态页面。
4. 首页置顶卡片文案/链接仍写在 `index.html`，改置顶需同步修改。Markdown 原文如果包含不可信 HTML，应在发布前审查。
5. 使用 GitHub Pages 内置 Jekyll，文章发布日期与时区有关；未来日期可能导致新文章暂不出现在列表。文章源文件以 `YYYY-MM-DD-name.md` 命名。
6. 修改 `CNAME`、DNS 或 Pages 设置会影响线上域名和 HTTPS；现有域名及配置未在此轮修改。
7. 示例随笔应替换成真实文章。Google Fonts / CSDN 链接依赖外部可用性。

## 下一步

1. 首页两篇文章、分类和 `/articles/hello/` 已核对；继续检查搜索、旧版 `#post/hello`、`/articles/note/` 与仓库 Pages 构建状态。
2. 用站点所有者的 GitHub 账号检查 `/admin/` 的登录、逐篇编辑与新建文件；提交一篇测试文章后确认 Pages 自动更新。
3. 后续更新文章直接改 `_posts/*.md`，不要直接编辑 `posts.js`。持续记录中文提交信息、实际变更和验证结果。
4. 内容增加时再评估图片、站点图标、分享预览和必要的文章管理体验改进；若要站内写作与发布，另行设计安全的授权/写入服务。

## 2026-09-27 Issue #1 验证记录

- 作者 itfetter 建立 Issue #1 时标题为“测试文章”，缺少工作流要求的 `[发布文章] ` 前缀，因此首次未运行。
- 更新 `.github/workflows/publish-article.yml` 监听 `issues: edited`，在 Issue 开启且作者 ID 匹配时允许补正标题重新触发；随后将 Issue #1 标题改为 `[发布文章] 测试文章`。
- 工作流生成 `_posts/2026-09-27-article-1.md`，Issue 机器人评论指出 Pages 构建已请求，Issue 自动关闭。生成文件元信息为分类“测试”、摘要“上传测试”、北京时间 2026-09-27 18:05:57、地址 `/articles/article-1/`。
- 当前仅证实文章已入库且 Pages 构建请求已被接受；站点页面是否已显示，仍需确认 Pages 构建最终状态和线上访问。

## 2026-09-27 可视化后台开发记录

| 文件 | 修改原因 | 验证 |
| --- | --- | --- |
| `admin/index.html`、`admin/config.js` | 增加文章列表、Markdown 编辑与预览、图片上传、保存及删除界面；未配置服务时保留 GitHub 备用入口。 | 前端脚本通过 Node 语法检查；真实 OAuth 页面尚未登录验证。 |
| `worker/index.js`、`worker/package.json`、`worker/test.mjs` | 引入 GitHub App OAuth + Cloudflare Worker API，以数字用户 ID 核对作者，限文章与图片目录，按 SHA 防冲突。 | `npm test` 三项通过：未登录/跨站拒绝、文章 CRUD 路径与冲突、非所有者授权拒绝。 |
| `worker/wrangler.example.jsonc`、`worker/README.md`、`.gitignore` | 提供可配置部署示例、KV/密钥说明，避免误提交真实凭据。 | 文件已提交；Cloudflare 账户资源尚未创建。 |
| `_config.yml`、`README.md`、`AGENTS.md`、本文 | 避免 Worker 服务代码成为 Pages 静态资源，并记录启用条件。 | 需待 Pages 构建确认后台静态界面。 |

**部署状态：** GitHub Pages 主站仍在 `itfetter.com`。Worker 未部署，GitHub App 未注册，`admin/config.js` 的 Worker 地址为空；因此目前的 `/admin/` 只显示配置提示，**尚不能使用站内登录和增删改**。现有 Issue 表单 `/write/` 仍可发布，GitHub 文件编辑仍可修改旧文。本轮没有改变 DNS、CNAME 或 Pages 发布源。

**下一步：** 先在 Cloudflare 创建 Worker 和 KV，取得 Worker URL；按 `worker/README.md` 注册仅安装到本仓库的 GitHub App，将回调设置为 Worker 的 `/auth/callback`；在 Worker Secrets 设置 Client Secret、部署代码，再将 Worker URL 填入 `admin/config.js`。最后实际测试登录、文章增删改、图片上传和 Pages 构建。

**已知风险：** 前端页面公开可读，访问控制只发生在 Worker；浏览器短期会话 ID 存在当前标签，GitHub token 位于 Worker KV。GitHub App 回调与 Worker URL 必须精确匹配；图片上传大小限制 5 MB。删除文章不会清理历史与孤立图片。上述账户配置及上线端到端流程未验证，不能宣称后台已经可用。

## 2026-10-03 Cloudflare 全站架构迁移（当前开发状态）

本节更新早期 GitHub Pages/GitHub App 部署方案。用户要求 GitHub 仅保存源码，Cloudflare 运行前后台和保存文章。线上网站和 DNS 尚未改动，之前的 Pages 记录只作历史依据。

| 文件 | 原因 |
| --- | --- |
| `worker/index.js`、`worker/content.js` | 由 GitHub App/KV/仓库写入改成 Access JWT + D1/R2；公开列表和独立文章页动态读取 D1；安全渲染 Markdown |
| `worker/migrations/0001_posts.sql` | 文章表、唯一链接、原发布日期和更新版本保护 |
| `admin/index.html`、`index.html` | 同源 Access 登录、即时发布、数据库版本冲突；保留首页外观和旧文章链接并转义元信息 |
| `scripts/build.mjs`、`scripts/import-posts.mjs` | 静态发布白名单、独立文章模板构建、旧文章导入 SQL，禁止迁移覆盖已有内容 |
| `worker/package.json`、`worker/package-lock.json`、`worker/test.mjs` | 固定依赖、构建开发命令，SQLite/签名鉴权/图片测试 |
| `worker/wrangler.example.jsonc`、`.gitignore`、README、AGENTS | D1/R2/Static Assets 配置、忽略生成数据、迁移部署与协作规则 |

已生成 5 篇原文章导入 SQL，保留原标识、日期、正文和链接；原 `_posts/` 未删除。Static Assets 不包含文章源文件、账户配置、Worker 源码或迁移 SQL。示例插画作为静态资源保留，新增上传走 R2。

当前限制：没有草稿/修订历史/自动数据备份；删除是数据库删除而非保留 Git 历史；图片不会随文章删除。测试不替代真实 Cloudflare 账户的 Access 登录、线上 D1/R2 和 DNS 验收。

待办：管理员创建 D1/R2/Access、填写账户配置、导入并核对线上文章、部署临时域名验证；成功后绑定 itfetter.com、停用 Pages/旧 Issue 工作流、备份并清理旧文章源文件和旧发布配置。GitHub 是否转私有由仓库设置决定，本次未改变。

验证结果（本次云端）：4 项自动测试全部通过，覆盖 Access JWT 伪造/过期/错误受众/非管理员、D1 CRUD/冲突/原链接、跨站写入/请求大小/图片校验、导入重复执行与未来文章不公开；本地 Wrangler D1 migrations 和 5 篇文章导入成功。实际本地 HTTP 检查首页、动态 posts.js、独立文章和管理页面均为 200，文章源文件与 Worker 源码 URL 为 404。Chromium 浏览器验收首页 5 篇文章、搜索、分类、旧哈希链接、390px 手机布局、后台新建/编辑/删除并确认前台立即变化；无 JavaScript 错误，测试文章已删除。R2 上传的接口测试使用内存实现，线上 R2 与实际 Access 登录未验证。

补充：实际 Wrangler 本地 R2 上传 1×1 PNG 并公开读取成功（201/200、正确 MIME 和 PNG 内容）；本地存储位于被忽略的 `.wrangler/`，未写入线上存储。


## 其他窗口的迁移规划记录（2026-10-03，保留历史依据）

> 此节保留其他窗口在实现前记录的规划、截图证据和费用讨论；实施状态以本文顶部最新交接为准，费用与账户资源需实际核对。

### 用户目标与最终决定
用户希望在自己的 `/admin/` 网页中舒适地编辑 Markdown，管理现有文章、新增、修改、删除、预览并一键发布，上传 PNG/JPG 等图片；首页不展示登录入口。源码继续保存在 GitHub，由 Cloudflare 连接仓库，在 push/commit 后自动构建部署。最新目标是将前台和后台运行环境统一迁移到 Cloudflare，不再以“Worker 写 Markdown 到 GitHub，再等待 Pages 构建”为最终架构。

| 部分 | 目标方案 | 当前状态 |
| --- | --- | --- |
| 程序源码 | GitHub；可使用私有仓库 | 本仓库是现有代码来源；本轮未改变可见性 |
| 前台与后台静态资源 | Workers Static Assets | 未迁移 |
| 文章 API | Cloudflare Worker | 已有旧版 GitHub API 代理代码，新版 D1 API 未实现 |
| 文章正文与元数据 | D1 | 尚未确认创建、绑定或导入 |
| 图片及附件 | R2 标准存储 | 尚未确认开通、创建桶或绑定 |
| 管理员身份验证 | Cloudflare Access，限定管理员 | 尚未配置或验证 |
| 自动部署 | Cloudflare GitHub 集成 / Workers Builds | 尚未确认连通 |
| 域名 | 保留 itfetter.com，验收后切换 | 本轮未改 DNS、CNAME、Pages 设置 |

目标行为：改程序代码才触发构建部署；后台写文章直接保存 D1，前台读取已发布内容，不必生成 GitHub Commit。图片保存在 R2，文章可以导出为 Markdown并备份。D1/R2 数据不会因为源码在 GitHub 就自动获得备份。

### 本轮实际核查与此前截图证据
2026-10-03 已通过 GitHub 接口读取当前 AGENTS、README、交接文档、worker/README 和 admin/config.js。远端 `admin/config.js` 仍为 `window.BLOG_ADMIN_API = "";`；旧后台不能据此宣称已完成站内发布。
此前用户截图确认旧 Worker 已部署，地址为 `https://itfetter-blog-admin.itfetpro.workers.dev`；根路径返回“不存在的接口”，`/api/me` 返回“请重新登录”。这只证明当时接口可达，未证明认证及文章增删改成功；本轮未访问或审计 Cloudflare 实际资源。
早期创建/安装过 GitHub App，但后续截图的 Developer settings 显示没有自建 GitHub Apps；不要假定该 App 当前仍存在。旧方案的 SESSIONS KV、Client ID、Client Secret 是否配置完毕未确认。新方案若文章全部存 D1，文章 CRUD 不再需要 GitHub 写入授权，GitHub 授权主要用于源码部署集成。

### 授权讨论结论
隐藏 admin URL、URL 密码参数、前端密码加密或混淆都不能保护真实写入权限。GitHub Secrets 不能作为浏览器可读取的秘密。纯前端手动输入个人 Token 可调用 GitHub API，但不是用户期望的舒适后台。最终采用服务端鉴权。
Access 必须保护管理 API以及后台页面，Worker 验证身份和管理员权限；防止 workers.dev 或其他域名绕过保护。普通读者无需登录，公开接口仅返回已发布文章，不能返回草稿。密钥仅放 Cloudflare Secrets，不提交代码、不写入日志或交接文件。

### 费用与支付讨论（2026-09-30 查阅官方价格，实施时重新核对）
个人博客预计可从免费套餐开始，这只是估算，不保证永远零费用。Workers Free 每天 10 万次动态请求，另受 CPU 等限制；静态资源请求免费。Workers Paid 最低 5 美元/月，超额另计。D1 免费共 5GB，另有单库限制、每日读取/写入额度。R2 标准存储每月含 10GB-month、100 万次 A 类和 1000 万次 B 类操作，超额存储 0.015 美元/GB-month，出站流量免费但操作收费。Access 免费最多 50 用户，管理员人数不等于公开网站访客数。
R2 是对象存储，D1 才是文章数据库。R2 开通需要完成订阅/付款流程；绑定支付方式不等于固定月费，超额可能自动收费。Cloudflare 支持 PayPal，绑定招商信用卡是否能完成自动付款取决于卡种、PayPal 接受情况和银行审批，未验证成功。不能把预算告警当成硬性停止扣费上限。
官方资料：
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/
- https://www.cloudflare.com/plans/zero-trust-services/
- https://developers.cloudflare.com/billing/understand/faq/

### 下一窗口建议执行顺序
1. 先读取当前代码及三份项目文档，核实 Cloudflare 已有 Worker、D1、R2、Access、付款与 GitHub 集成状态；不要要求用户在聊天里提供密钥。
2. 保留现有 Pages 线上站点，先建立 Cloudflare 测试部署；复用现有博客视觉及 Markdown 编辑器，不必推翻全部 UI。
3. 设计 D1 模型：文章 ID、唯一 slug、标题、摘要、正文 Markdown、分类、草稿/发布状态、创建/更新时间、发布时间、版本号；保留已有文章地址映射。编写 SQL migration 和可重复运行的 _posts 导入工具。
4. 实现公共文章列表/详情及管理员 CRUD，使用参数化 SQL、分页、输入校验、服务端身份验证；编辑冲突要提示，删除有确认和可恢复策略。
5. 接入 R2 上传：限制格式及大小，生成唯一文件名，插入 Markdown 图片链接；规划未引用图片清理及备份。
6. 配置 Access 管理员白名单，保护 /admin/ 和管理 API，并测试未登录、非管理员、跨域和替代域名访问；必要时处理 CSRF。
7. 连接 GitHub 自动部署，提供准确的构建命令、部署命令、资源绑定和 Secrets 配置步骤。
8. 端到端验收登录、新增、修改、删除、图片、草稿隔离、手机排版、旧链接和导出备份，再切换 itfetter.com；确认 HTTPS 和重定向后再停用旧 Pages/旧代理。
9. 更新 README、AGENTS、交接文档；所有提交信息及修改说明用中文。

### 本次文档变更与验证
仅新增本交接章节，并在 README、AGENTS 增加迁移状态提示，保留历史记录。不修改业务代码，不创建云资源，不迁移文章，不切换域名。验证范围为远端文档读取及写入确认；没有重新运行旧后台测试或声明线上功能已完成。

## 2026-10-03 GitHub 推送与跨窗口记录合并

用户要求将当前改造推送到 GitHub。推送前发现远端 main 新增 3 个文档提交，已读取并保留其中的账户截图证据、费用讨论与迁移规划，防止覆盖其他窗口记录。当前实现尚未包含规划中的草稿、分页、Markdown 导出、软删除恢复与自动备份；这些仍需单独开发和验收，不能当作已实现。验证：4 项自动测试通过，git diff --check 通过；本次推送仅更新源码和维护文档，不执行 Cloudflare 部署或修改 DNS。提交与推送结果以实际 Git 命令确认。

推送实际结果：`git push origin HEAD:main` 返回 HTTP 403，GitHub 明确提示 `Permission to itfetter/itfetter.github.io.git denied to itfetpro`。已保留本地提交，未强制推送、未覆盖远端。账号权限解决后重新读取远端状态并推送；无需在聊天中提供令牌。

账号核查补充（2026-10-03）：用户已连接两个 GitHub 账号，环境截图显示目标仓库已关联。重新验证：`git ls-remote origin refs/heads/main` 成功；`git push --dry-run origin HEAD:main` 仍返回 403，明确标识请求身份为 itfetpro。当前工具未提供 GitHub 连接账号切换功能。因此结论仅是当前云环境的推送身份被拒绝，不能据此判断另一已连接账号也无权限。需让此云环境使用具备该仓库写权限的连接；不要抽取平台凭据或要求聊天提供 token。

## 2026-10-03 推送权限恢复与正式提交

用户调整权限后要求重新尝试。远端读取和推送预检成功，当前本地改造与远端 main 可正常快进合并，无需强制推送。此前 403 作为历史诊断保留，不再是当前阻塞；本次将代码、维护规则和文件地图一起推送至 main，并核对远端 HEAD 与本地提交一致。仅更新交接中的提交状态，不修改业务代码；git diff --check 通过，业务验证沿用此前通过的 4 项自动测试及浏览器验收。本次不执行 Cloudflare 部署或域名切换，Workers Builds 连通仍待账户配置与验收。



### 分类与合集选择
编辑器分类改为下拉选择，并提供自定义新建分类弹窗。`/api/categories` GET/POST 仅管理员可用，同源 JSON 写入；名称 1–80 字符、去除首尾空格、拒绝控制字符、同名创建幂等。分类由 D1 `categories` 独立保存，空合集也保留；目录合并历史文章与草稿分类。新增 `0006_categories.sql`，只建表与导入分类，不修改文章或版本。创建分类后自动选中，需保存草稿或发布文章才关联文章；暂不提供分类重命名/删除。

验证记录（2026-10-04）：功能提交 `8ebf3c6988ed7babb4febac4193b05cf1aaba721`，Cloudflare 构建 `47f374f4-0f5b-420d-86b7-0b0e5b4fc10e` 成功，22 项测试全部通过，Worker 版本 `20c298cc-b729-40e0-bac3-7348e2c8cd6b`。正式 D1 已应用并登记 0006_categories.sql，导入写作示例、建站记录、随笔。已有 Node 完成前后端语法、DOM 引用与 SQLite 迁移幂等/文章不变检查，无本机依赖安装。线上只读检查后台 HTML 200、分类下拉和新建弹窗已存在，匿名分类 API 401；浏览器连接超时，未完成视觉交互验证。没有创建/修改测试文章或测试分类。

## 留言多选与永久删除（2026-10-05）
admin/index.html新增左侧勾选框、全选本页、选中计数；正常列表删除所选到回收站，回收站可批量恢复与永久删除所选。翻页/筛选清除选择，刷新仅保留同id/version选择。确认框默认取消，永久删除明确不可恢复；不执行真实留言删除验收。回收站仍不自动过期，但永久删除会清除数据库记录，既有离线备份不受影响。
worker/contact.js bulkMessages用单条参数化SQL同时校验全部id/version与回收站状态，最多20条，任何冲突整批不修改；worker/index.js POST /api/messages/bulk保留登录/同源/JSON/大小保护。无需新迁移。worker/test.mjs覆盖鉴权、跨站、重复ID、永久删除确认、冲突原子性、恢复、所选清除及未选保留。已提交2fc8b1a4cc33349ee554d3ed679210491392cb11并推送main；Cloudflare构建15e605e0-1ba7-492f-a96e-e9f2c7e04611成功，48测试通过/0失败，Worker版本6c09796c-c595-4117-b514-fb5fb50a6ba6。实际Chrome验证勾选/全选、选中数量、批量删除和永久删除确认框默认取消、取消不改数据；最终清空选择并返回全部留言视图。真实留言永久删除未执行；SQL行为由云端SQLite测试验证。


## 网址与代码块编辑优化（2026-10-05）
网址短名选填，空值由服务端生成article-UUID，发布和草稿共用；自定义短名保持字符/长度/唯一校验，首次保存后固定，不改变旧文章链接。admin/index.html显示完整地址预览与自动生成说明；worker/index.js仅调整新建路径，不改变鉴权、id/version或历史。
assets/document-editor.mjs识别Vditor代码块容器，在侧边菜单提供“转为正文”，通过getHTML/html2md与setValue(false)转换对应代码块，保留文字与换行，HTML字符转义，不重置撤销栈。其他不适用代码的格式仍禁用。保存链路仍仅Markdown。
worker/test.mjs新增自动地址/稳定编辑/非法值/重复短名回归；worker/document.test.mjs新增转换转义与换行回归。无依赖安装/数据库迁移；本次提交与云端构建、浏览器验收结果待实际确认。

浏览器发现HTML转Markdown会重新解释代码内的#和列表符号，转换改为临时占位替换、逐行Markdown转义，避免代码文字自动变标题/列表。真实数据未保存验收。

最终验证：Cloudflare构建2471b686-063e-43f9-a011-a80c8c036bc4成功，51项测试全部通过；Worker版本38faf42e-7b19-434d-9c0e-d69fe97b84e6。实际Chrome未保存测试验证选填与自定义URL预览、代码转正文、中文/HTML字面字符/空行/#和列表符号保留、前后正文不变、Ctrl+Z恢复代码及Ctrl+Y重做。测试未发布/保存文章、未上传私密内容；代码转换会使用引擎规范化全文Markdown格式，复杂自定义HTML继续建议源码模式。


## 编辑器重试入口（2026-10-05）
admin/index.html将“重新载入编辑器”改为“重试加载”，默认隐藏，仅文档引擎明确error状态显示；loading/ready/文章切换idle均隐藏。assets/document-editor.mjs的onState额外提供状态值，不依赖提示文字判错；重试继续保留Markdown字段且不执行保存或发布。worker/document.test.mjs在原有加载失败重试回归中核对状态序列与invalidate归位。正常写作不展示重置入口，避免误清撤销记录。三维护文档同步更新；云端部署和浏览器结果待确认，无数据库迁移或本机依赖下载。

验收完成：功能提交c50d034c6e67735f136c0be5049c58b56050a010；Cloudflare构建2114ce6b-833b-404e-a911-33bca56c45d5成功，51测试通过/0失败，Worker版本ec832b4e-3db7-4b03-a8a4-1c4fedc94176。实际Chrome新建空文章正常加载后visual-retry为hidden且display:none，按钮文案重试加载；未保存/发布测试内容。失败重试与idle状态由已有模拟引擎回归验证，不故意断开生产浏览器网络。未触碰用户正在编辑的原标签页。


## 访客评论讨论串（2026-10-05）
新增 0010_comment_threads.sql；原评论分页20条，回复分页10条，回复他人仍归属同一原评论，显示直接回复对象。访客评论与回复直接公开，原评论隐藏/回收后整串不公开。备份保留并校验回复关系，恢复按依赖顺序追加。当前用户明确授权在一篇文章加入数十条标注测试评论，仅适用于本次演示，不授权修改或删除真实评论。


### 讨论串上线验收
- 功能提交：6df157fd1be8c0ef564d40cf0f6fd8bcb931e69c；Cloudflare Build f89f05f6-4338-47ad-a50a-de6c8734c03d；57/57 测试通过，Worker 23181cc6-df4d-44a8-bed0-f40e20706aff。
- 生产 D1 已应用并登记 0010_comment_threads.sql。图文示例 /articles/rich-markdown-demo/ 加入30条原评论、20条演示回复；另通过真实浏览器提交并在后台审核1条回复，总计51条，全部标注“功能测试，可清理”。原有 cloudflare 文章3条评论未改动。
- Chrome 验收：原评论分页20+10；讨论串回复分页10+3；回复回复显示目标昵称；取消/翻页保留输入；实际提交→待审核→审核通过→前台公开。390px 窄屏 DOM scrollWidth375px，无横向溢出，视口已恢复。
- 清理追踪仅本地 work/thread/demo-comment-ids.json（50条）及 work/thread/verification.json 的 lastId（浏览器1条）；未把真实评论内容写入代码。清理仍需用户授权。
- 图片证据：C:/Users/codedev/Documents/Codex/comment-thread-check.jpg、comment-thread-mobile.jpg。没有本地依赖下载，完整构建测试由 Cloudflare 执行。


### 直接发布上线验收
功能提交 48fcfb0bc78471f9ec653d4f91dfac7e88b4e78d 已推送main并部署；Cloudflare Build 71c2b032-19cd-4ece-a66c-9d7e0e2f73f1，58项测试全部通过，Worker 2680cb5f-01b1-472a-9fbe-4739b77f4c14。本地Node/SQLite验证直接公开、互相回复、隐藏/回收站/恢复及幂等重试保持隐藏；没有本地安装依赖。Chrome实际提交1条标注测试评论和1条回复到原图文演示文章，两者立即公开、刷新后仍显示，不执行任何审核操作；后台默认all，显示已公开并提供隐藏/移入回收站。原有评论未修改，既有待审核/隐藏/删除状态未批量变更。新增演示ID仅保存在本地work/direct/verification.json，截图Documents/Codex/comment-direct-publish.jpg。旧先审核记录仅作历史，不再作为新提交规则。

## 2026-10-06 功能定位文档
新增 docs/FEATURE_MAP.md，集中记录需求到前端/服务端/API/迁移/测试的映射、源码与产物/线上数据区别，以及当前评论直接发布、历史完整快照、回收站差异等限制。README、AGENTS、本文件顶部增加入口；AGENTS 增加持续同步规则。基于 main 00423063f8ff8fb407566713e8d5428a66c3187a 的树和实际路由/模块/迁移/构建/测试脚本核对，所有相对文件链接检查。仅文档变更，无依赖下载、业务代码或线上数据修改；无需业务测试。提交与推送由 GitHub 返回和回读确认，未以本次文档提交宣称业务部署完成。


上线验证：功能提交ad8782d已推送main，Cloudflare构建10e79a59-7152-4158-bac5-0c1eb6e53b54完成72/72测试、0失败，Worker fc856839-a349-43c8-a9fe-77231d0c6996。生产D1已应用并登记0012，保留3篇原文章与3个原分类（其中1篇原已在回收站）；实际Chrome读取后台资料/文章选择/移动目标及前台目录，无生产写入验收。窄屏390px文档375px无横向溢出；实际页面发现合集正文左右留白与跳转链接样式需调整，已修正并补齐合集未保存离开保护，后续构建验收待核对。无本机依赖安装。

后续验收：修正提交fdb56d1对应Cloudflare构建0482468c-e6ba-4530-9a30-b9f576645294成功，72项回归再次全部通过。公开390px页面实际确认22px侧边距、375px文档宽度、五个栏目均可见；后台三合集资料读取成功，关联文章与目标合集控件可见，刷新保留view=collections。文章内目录及稳定合集网址可用。最后去掉文章模板重复的合集导航；仅静态模板修正，无数据写入。实际排序/移动/删除/上传的生产写验收未执行，由合成SQLite与云端用例覆盖。

手机后台补充：390px下合集列表和编辑区文档宽度375px，无横向溢出；合集简介单独设120px高度，避免继承文章正文的大编辑框。窄屏视口已恢复，未提交生产修改。该样式微调不改变接口、数据库或数据。
