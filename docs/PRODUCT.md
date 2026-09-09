# Open Ends v1.0 Product

## 定位

Open Ends 是一款 local-first 的 Windows 桌面应用，帮助个人记录行动、选择和长期变化。它把 Todo、Spark、Reading、Media、Month、Review 与 Living Profile 放在同一条本地生活轨迹中。

它不是团队项目管理工具，不是日记，也不是打卡或积分系统。完成、延期、放下、重启和喜好变化都作为可回看的行动事实保存。

## Today 与 Focus

- Today 展示当天计划、其他任务和一个可选的 Daily Focus。
- 每个日期最多有一个 Focus；当天可以没有 Focus。
- Focus 不会自动延续到下一天，完成状态依据当天的完成事件判断。
- 用户可以完成或恢复任务，并在当天重新安排计划。

## Task

任务拥有标题、当前状态、领域、可选计划日期和 contextPoints。状态为 open、done 或 dropped。

任务日期变化写入 rescheduled 事件，而不是覆盖历史。没有日期的任务表示“某天”再处理；它不会被伪造成某个具体日期。标题中的 [项目名] 或【项目名】只在界面中作为语境前缀呈现，任务原文保持不变。

## Spark

Spark 先保存用户输入的原文。每次编辑都会产生新的 revision，并保存原文校验摘要。用户可以请求 AI 整理，查看整理结果后再确认。

确认后的建议可以分配为任务、阅读对象或影视对象，也可以保留为待确认的 ambiguous draft。来源关系会把新对象链接回原始 Spark；AI 不能静默改写已经确认的事实。

## Reading 与 Media

Reading 支持书籍、文章、论文和其他阅读对象；Media 支持电影和剧集。两类对象都记录 want、进行中、完成、暂停和放下等状态，并保留开始、完成、重启、放下和喜好变化事件。

喜好使用 0.5 到 5 的半星值。新增书籍可以通过 Google Books 选择具体版本；新增影视通过 TMDB 选择具体电影或剧集。网络失败、无结果或封面/海报不可用时，仍可保存本地记录并使用本地色块降级。

## Review 与 Living Profile

Review 由本地事实确定性生成周、月和年期间快照。用户可以手动请求 AI Review；结果是绑定事实快照的只读 revision，并保留 source hash。

Living Profile 只接收压缩后的 Profile Evidence Pack，在证据边界变化时生成新的 revision，也支持用户手动更新。画像不读取 Spark 原文，不直接接收凭据或完整数据库内容。

## 隐私与数据边界

- 业务数据保存在本机 SQLite。
- 应用不要求账号，不提供 Open Ends 云同步。
- JSON 支持全量备份与恢复。
- DeepSeek 与 TMDB 凭据保存在 Windows Credential Manager。
- AI 仅在用户主动使用整理、Review 或 Profile 时参与；行动事实由本地数据决定。
