# Open Ends v1.0 API / Integration Boundaries

正式桌面构建是 Next static export，由 Tauri 直接加载 out/。前端通过 lib/desktop/tauri-client.ts 调用受控 Tauri command；浏览器开发预览会明确降级，不模拟 Windows 凭据、SQLite 或窗口能力。

## Data commands

### execute_transaction

接收 allowlist 内的单条 INSERT 或 DELETE statement 列表，在一个 SQLite transaction 中执行。禁止分号、多 statement 和 allowlist 外的表；任一语句失败时整体回滚。

### write_legacy_backup

接收迁移所需的完整 JSON 与 checksum，原子写入应用数据目录的 legacy-backup.json，并对相同 checksum 保持幂等。

### write_data_backup

接收 contents 与 manual 标志，原子写入带 schemaVersion、exportedAt 和 appVersion 的完整 JSON。自动备份按本地日期幂等并保留最近七份，手动备份使用独立时间戳文件名。

## Desktop commands

- show_desktop_window：仅允许 main、todo-panel、spark-capture，可选站内 route。
- hide_current_window：隐藏当前窗口。
- minimize_current_window：最小化当前窗口。
- toggle_maximize_current_window：切换最大化/恢复并返回状态。
- is_current_window_maximized：读取当前最大化状态。
- start_current_window_dragging：从自定义标题栏开始拖动当前窗口。
- set_todo_panel_interaction：更新 TodoPanel pointer 与 interaction lock 状态。
- get_todo_panel_pinned / set_todo_panel_pinned：读取或设置 TodoPanel always-on-top。
- get_shortcut_settings / update_shortcut_settings：读取或更新 TodoPanel、SparkCapture 快捷键及冲突列表。
- get_autostart_enabled / set_autostart_enabled：读取或切换当前 Windows 用户的开机启动。

窗口 label 和 credential kind 都执行 allowlist 校验；不接受任意窗口、路径或凭据类型。

## Credential operations

credential_status、save_credential 和 delete_credential 只接受 deepseek 或 tmdb。服务标识固定为 io.github.yangjuxianabc.openends，密钥写入 Windows Credential Manager；SQLite 只保存 verification、更新时间和模型等非敏感 metadata。

DeepSeek Key 保存前会尝试验证；无效凭据返回 INVALID_API_KEY 且不覆盖旧值。短暂的限流、上游错误或网络失败可记录为 unverified。

## DeepSeek transport

deepseek_request 接收 feature 组装的 JSON payload，由 Rust 从 Credential Manager 读取密钥并请求 DeepSeek chat completions。Rust 边界强制使用 deepseek-v4-flash，并将 thinking 设置为 disabled。Spark、Review 和 Living Profile 共用 transport，但各自负责输入事实、Prompt 和响应校验。

稳定错误码包括 CREDENTIAL_NOT_CONFIGURED、INVALID_API_KEY、UPSTREAM_UNAVAILABLE、UPSTREAM_INVALID_RESPONSE、UPSTREAM_RATE_LIMITED 和 UPSTREAM_REQUEST_FAILED。结构不合格的 AI 内容不会写入本地 revision。

## Google Books transport

search_book_covers 接收 title 和可选 author，返回 Google Books 候选。Release 构建可从 GOOGLE_BOOKS_API_KEY 生成受保护的内置配置，Rust 只在内存中解密和使用；没有 Key 时仍保留无 Key 请求与本地降级。

候选包含 provider、externalId、title、authors、url、publisher、publishedDate、isbn10 和 isbn13。Reading service 负责排序和最多五条展示；用户必须明确选择后才创建书籍，失败或无结果时可直接保存本地记录。

## TMDB transport

search_tmdb 接收 query 和 mediaTypeHint，其中 hint 只能是 movie、tv 或 unknown。Rust 从 Credential Manager 读取 TMDB Token，返回电影或剧集候选，不自动选择同名结果。

候选包含 tmdbId、mediaType、title、originalTitle、releaseDate、releaseYear、posterPath、genreIds 和 originalLanguage。用户在 Spark 确认流程或 Media 页面明确选择后才创建 Media。

## Error contract

前端将 Rust 返回的稳定错误字符串映射为用户可读提示。DESKTOP_RUNTIME_REQUIRED 表示浏览器预览不能调用桌面能力；WINDOW_NOT_ALLOWED、WINDOW_NOT_FOUND、WINDOW_NOT_MAXIMIZABLE 处理窗口边界；凭据和外部请求使用上述稳定错误码。

错误不会静默删除或覆盖已有业务数据。SQLite 写入错误在事务边界内回滚，AI 或外部服务失败时保留原始输入和已有记录。

## Events

- open-ends:store-changed：payload 为 origin。写入完成后广播，其他窗口重新从 Repository 加载。
- desktop:navigate：payload 为站内 route，用于托盘操作驱动 MainWindow 导航。

## Frontend boundary

业务 feature 不直接调用 Tauri invoke。它们通过 StoreProvider 和 lib/desktop/tauri-client.ts 访问数据与桌面能力；Rust transport 不拥有页面业务规则，也不接收任意远程代码。
