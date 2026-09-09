# Open Ends v1.0 Edition API

## Purpose

Edition 定义一套完整的表现层信息架构：导航、Shell、页面 renderer 和辅助窗口 renderer。Edition 不 fork Store、Repository 或数据库，也不重新实现业务状态机。

## EditionDefinition

每个 EditionDefinition 包含：

- id、name 和 apiVersion；
- defaultThemeId；
- supportedThemeIds；
- homeRoute；
- Shell；
- screens；
- navigation；
- auxiliaryRenderers。

apiVersion 当前为 1。registry 会验证必需字段、canonical home route、Shell、screens、navigation 和 auxiliary renderers。

## Navigation

导航项声明 MainRouteId、label、group 和 icon slot。当前 canonical main routes 为：

- /today
- /spark
- /month
- /open
- /review
- /reading
- /media
- /settings

辅助 route 为 /todo-panel/ 和 /spark-capture/，不进入主导航。

## Shell and renderers

Shell 接收当前 route、只读 application view model 和导航项，负责主窗口的布局与导航。

screen renderer 负责各 canonical route 的页面；auxiliary renderer 负责 TodoPanel 和 SparkCapture。它们可以替换页面表现，但必须通过受控 Store action 与 UI bridge 使用业务事实。

## Theme compatibility

Edition 声明默认 Theme 和支持的 Theme id。Theme 还需在 manifest 中声明兼容 Edition；解析失败或不兼容时回退到 Classic + Graphite Amber。

## Current Edition

v1.0 内置 Classic Edition，homeRoute 为 today，默认且唯一支持的 Theme 为 graphite-amber。Classic 提供八个主页面和两个辅助窗口 renderer。

## Extension boundaries

新的 Edition 可以提供不同的 Shell、导航和 screen renderer，但不能：

- 直接连接 SQLite 或调用 Tauri invoke；
- 复制 Store、Repository 或 feature service；
- 改变 canonical route、托盘、快捷键或数据契约；
- 从网络加载任意 renderer 或执行未验证的代码。
