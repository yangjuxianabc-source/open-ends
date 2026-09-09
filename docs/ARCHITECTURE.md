# Open Ends v1.0 Architecture

## 1. System overview

Open Ends 使用 Tauri 2、Next.js static export、React、TypeScript、Rust 和 SQLite。正式桌面应用直接加载 out/ 静态资源，不启动 Next Server。Rust 负责本地数据库、桌面窗口、凭据和受控外部请求。

## 2. Layer boundaries

- app/：路由入口、layout 和页面组装。
- ui/：canonical route、Classic Edition、Theme、Shell 和 UI-neutral view model。
- features/：tasks、spark、reading、media、reviews、ai-insights 等业务规则、组件和服务。
- components/：不带业务流程的通用 UI 组件。
- lib/：storage、settings、dates、stats、desktop client、AI client 和其他基础能力。
- src-tauri/：Tauri 配置、SQLite migration、事务 command、桌面生命周期、凭据和网络 transport。

app/ 保持轻量；业务规则不下沉到 components/ 或通用 lib/。Theme 和 Edition 只负责表现层，不拥有 Repository、数据库或业务状态机。

## 3. Data flow

桌面启动时，Tauri SQL plugin 执行已注册的 SQLite migrations，StoreProvider 通过 Repository 读取数据并建立当前窗口缓存。用户操作由 feature 组件提交给 StoreProvider，再由 Rust transaction 写入 SQLite。

写入成功后，窗口广播 open-ends:store-changed。其他窗口重新读取 SQLite；窗口重新获得焦点或可见时也会刷新，以避免 MainWindow、TodoPanel 和 SparkCapture 保留不同快照。浏览器开发预览使用独立存储，不代表桌面数据库。

## 4. Store、Repository 与 SQLite

StoreProvider 是前端唯一的活动数据编排入口，负责 DTO 映射、事件创建、备份触发和跨窗口刷新。Repository 负责读取和写入 SQLite；Rust execute_transaction 只接受 allowlist 内的单条 INSERT 或 DELETE statement，并在单一事务中执行。

当前 migration 位于 src-tauri/migrations/0001_v1_0.sql、0002_spark_revisions.sql 和 0003_ratings.sql。外键、状态检查、评分检查和唯一约束由 SQLite 执行。

## 5. Spark flow

SparkCapture 保存原文后即可关闭或在后台请求 DeepSeek。分析结果绑定当前 Spark revision 和 source hash，失败时原文仍然保留。Spark 页面展示原文、revision、分析结果和确认状态。

用户确认分析结果后，StoreProvider 在一次业务操作中创建任务、阅读对象或影视对象，并写入 spark_links。链接目标唯一，来源关系可以从对象页面反查到 Spark。

## 6. Reading 与 Media flow

Reading 书籍新增先向 Rust 请求 Google Books 候选，由 reading service 排序并展示最多五条结果；用户明确选择后才保存对象、封面和 added event。文章、论文和其他阅读对象可直接保存。无结果或网络失败时保留用户输入和色块封面。

Media 页面向 Rust 请求 TMDB 电影/剧集候选，用户选择具体结果后才创建对象。状态、重读/重看和喜好变化分别写入对象表与事件表；海报失败不阻塞本地记录。

Reading 与 Media 的 rating 为 0.5 到 5 的半星值，旧 preference 字段仅作为数据兼容字段保留。

## 7. Review 与 Profile flow

reviews service 根据 Task、TaskEvent、DailyFocus、ReadingEvent 和 MediaEvent 构建周、月、年事实快照。相同事实使用稳定 source hash；事实变化时新增 snapshot revision，旧 revision 保留。

AI Review 由用户针对已结束期间手动触发，生成结果绑定 snapshot、provider、model 和 source hash，并以只读 revision 保存。Living Profile 使用 Profile Evidence Pack，在证据边界变化时生成新的 revision，也支持手动更新；生成内容不直接接收 Spark 原文或凭据。

## 8. Theme 与 Edition

Theme manifest 声明 semantic tokens、icon slots、asset slots、版本和兼容 Edition。Theme validator 拒绝未知字段与不安全 token；Theme registry 只注册内置 Graphite Amber。不可用或不兼容的设置安全回退到 graphite-amber。

Edition 定义 navigation、Shell、canonical route screen 和 auxiliary renderer。当前 Edition 为 Classic，默认且唯一兼容 Theme 为 Graphite Amber。Edition 可以替换表现层 renderer，但不得复制 Store、Repository 或数据库逻辑。

## 9. Desktop windows

MainWindow、TodoPanel 和 SparkCapture 都是无边框 Tauri 窗口。MainWindow 提供自定义交通灯、拖动、最大化/恢复、调整大小和关闭到托盘；TodoPanel 与 SparkCapture 不显示主窗口标题栏，也不进入任务栏。

MainWindow 最小支持尺寸为 1080×680，最大化范围使用当前显示器工作区。TodoPanel 是支持左右 dock、自动收纳、reveal strip、Pin 和多显示器坐标的辅助窗口；SparkCapture 使用 Classic 不透明表面并支持快捷键和 Escape 生命周期。

## 10. External services

- DeepSeek：Spark 整理、Review 和 Living Profile；Rust 强制使用 deepseek-v4-flash 并关闭 thinking。
- Google Books：书籍候选搜索；Release 构建可从 GOOGLE_BOOKS_API_KEY 生成受保护的内置配置，运行时只在 Rust 内存中使用。
- TMDB：电影和剧集候选搜索；用户凭据保存在 Windows Credential Manager。

前端通过 lib/desktop/tauri-client.ts 调用受控 Tauri command。浏览器预览不读取 Windows 凭据，也不执行桌面 command。

## 11. Backup 与 restore

应用在 SQLite 成功写入后按本地日期原子写入完整 JSON 日备份，并保留最近七份；用户也可以导出带版本、时间和应用信息的完整 JSON。导入在 Rust transaction 中执行，失败时整体回滚。

备份包含业务数据和非敏感 app_settings metadata，不包含 Credential Manager 中的密钥明文。旧格式由导入层做兼容映射，不改变活动 schema。
