# Open Ends v1.0 Database

## Schema version

正式桌面事实源是 SQLite 数据库 open-ends.db，当前注册 migration 为 1、2、3，数据库内的 schema_migrations 记录已应用版本。完整 JSON backup 使用 schemaVersion 3。

Migration 文件位于 src-tauri/migrations/：

- 0001_v1_0.sql：核心事实、对象、期间和设置表。
- 0002_spark_revisions.sql：Spark 原文 revision 与分析绑定。
- 0003_ratings.sql：Reading/Media 半星 rating 和 rating_changed 事件。

Migration 只追加，不静默改写已经发布的 migration 文件。

## Active tables

| 表 | 作用 |
| --- | --- |
| schema_migrations | 已应用 migration 的版本、名称和时间 |
| tasks | 任务当前实体 |
| task_events | 创建、排期、重新安排、完成、恢复和放下历史 |
| daily_focus | 每个日期唯一的 Focus |
| sparks | Spark 原文及生命周期 |
| spark_revisions | Spark 原文 revision、source hash 和时间 |
| spark_analysis | 绑定 Spark revision 的 AI 整理结果 |
| spark_links | Spark 与 task、reading、media 的来源关系 |
| reading_items | 阅读对象当前状态、封面和喜好 |
| reading_events | 阅读状态、重读和喜好变化历史 |
| media_items | 影视对象、TMDB 元数据、状态和喜好 |
| media_events | 影视状态、重看和喜好变化历史 |
| period_snapshots | 周、月、年确定性事实快照 |
| ai_reviews | 绑定事实快照的只读 AI Review revision |
| profile_snapshots | 绑定证据边界的只读 Living Profile revision |
| app_settings | JSON 格式的非敏感应用设置 |

## 关键字段与约束

### Tasks

tasks 保存 id、title、context_points_json、status、domain、planned_date、created_at、updated_at、completed_at 和 dropped_at。status 只能是 open、done 或 dropped；domain 使用应用定义的十个领域。

task_events 保存 task_id、type、occurred_at、local_date、timezone、from_date、to_date 和 metadata_json。task_id 外键级联删除；task_events 按 task_id/occurred_at 和 local_date 建索引。

daily_focus 以 date 为主键，task_id 外键指向 tasks，因此每天最多一个 Focus。

### Spark

sparks 保存 content、status、created_at 及处理时间；status 只能是 inbox、organized、settled 或 archived。

spark_revisions 以 spark_id 与 revision 唯一，保存原文和 source_hash。spark_analysis 绑定 spark_id 与 spark_revision，保存 provider、model、source_hash、result_json 和 applied_at。

spark_links 以 target_type 与 target_id 唯一，target_type 只能是 task、reading 或 media；Spark 删除时关系随之删除。

### Reading 与 Media

reading_items 保存 title、author、type、status、preference、rating 和可选封面字段。type 为 book、article、paper 或 other；status 为 want、reading、finished、paused 或 dropped。

media_items 保存 tmdb_id、media_type、title、original_title、release_date、release_year、poster_path、genre_ids_json、original_language、status、preference 和 rating。media_type 为 movie 或 tv；status 为 want、watching、finished、paused 或 dropped。

两类对象的 rating 可为空，否则必须为 0.5 到 5 的半星值。reading_events 和 media_events 的 rating_changed 事件可携带新值或表示清除。对象与事件通过外键关联并级联删除；事件按 local_date 建索引。

preference 列仍保留用于备份和数据兼容，但当前界面和新写入以 rating 表达喜好。

### Review 与 Profile

period_snapshots 保存 period_type、period_key、period_start、period_end、revision、source_hash、facts_json、created_at 和 supersedes_id。period_type 为 weekly、monthly 或 yearly；同一期间的 revision 唯一。

ai_reviews 保存 snapshot_id、review_type、revision、provider、model、source_hash、content 和 generated_at，并以 snapshot_id/revision 保证 revision 唯一。

profile_snapshots 保存 evidence_end、revision、provider、model、source_hash、evidence_json、content 和 generated_at，并以 evidence_end/revision 保证 revision 唯一。

### App settings

app_settings 使用 key 主键和 value_json、updated_at。可保存 appearance、快捷键和 credential verification metadata；长期密钥不写入 SQLite。

## Migration 与 backup compatibility

应用启动时按注册顺序执行 SQLite migration。所有写入经过 Rust 的单事务边界，外键约束开启，任一语句失败则整体回滚。

JSON 导入层接受带 schemaVersion 的完整备份，并将可兼容字段映射到当前活动结构；缺少派生 revision 时会补齐必要的 Spark revision，不丢失原文、分析结果或来源关系。导出和自动备份不包含 Credential Manager 中的明文凭据。
