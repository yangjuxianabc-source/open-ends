# Open Ends Classic Edition / Graphite Amber Style Guide

本文档定义 Open Ends v1.0 当前默认 Classic Edition 与 Graphite Amber Theme 的表现基线。

## Typography

- UI 使用 --font-ui；页面标题和需要停留阅读的内容使用 --font-display。
- 页面标题使用清晰的 serif 层级，正文、表单和操作控件使用易读的 sans-serif。
- 主文字使用 --oe-text-strong，辅助文字使用 --oe-text-muted，极弱信息使用 --oe-text-faint。
- 状态、事实和 AI 生成状态必须有文字或标签，不只依赖颜色。

## Color

- 页面背景使用 --oe-bg 与浅色层次。
- 内容表面使用 --oe-surface、--oe-surface-muted 或 --oe-surface-raised。
- 主行动使用 --oe-primary；AI/事实提示使用 --oe-accent。
- 删除、错误和风险使用 --oe-danger，不用高饱和红色装饰普通状态。
- Graphite Amber 的颜色由 semantic token 提供，页面不直接依赖 Theme 私有实现。

## Radius and spacing

- 圆角 token 为 7px、10px、14px、18px 和 22px。
- 普通卡片使用 18px 圆角，嵌入区域使用 14px，输入和下拉框使用 10px。
- 页面默认最大宽度为 1200px，窄设置页为 860px。
- 页面首个内容对象与 Page Lead 保持约 16px 间距；移动端保留 16px 两侧留白。

## Cards and grids

Reading/Media 的搜索卡位于 pinned 区，候选列表在自身受控高度内滚动，对象区独立滚动。对象网格统一使用纯 CSS auto-fill：

- track 最低约 210px，由 1fr 平均吸收可用横向空间；
- 网格间距 14px；
- 卡片最大宽度约 270px，保持窄、轻、紧凑的对象比例；
- 少量对象从左侧按 DOM 顺序开始，最后一行不整体居中；
- 窄窗口使用不超过 270px 的单列兜底。

卡片内部优先展示封面、标题、状态和来源；状态选择、喜好和删除位于稳定的工具区域。Reading/Media 喜好使用半星 StarRating，清除操作不得换行。

## Page Lead and controls

Page Lead 直接融入页面底面，包含页面名、slogan、必要的 meta 和 actions，不使用重复标题或厚重渐变色块。

主按钮只用于当前最重要的行动；次按钮用于辅助操作、导出和导航。SelectMenu 保留键盘、Escape、外部点击、ARIA listbox/option 和受控 popup 行为。

任务标题中的 [项目名] 或【项目名】只在表现层作为语境前缀分离，底层标题原文不变。

## Motion and interaction

常规 hover 约 140ms，控件状态约 200ms，布局变化约 240ms；遵守系统 reduced-motion 偏好。长内容保持滚动能力，滚动条可以隐藏但不能删除滚动能力。

删除统一使用 ConfirmDialog，不使用 native confirm。AI Review 和 Living Profile 为只读结果，只提供生成、重新生成和查看依据等入口。

## Auxiliary windows

MainWindow、TodoPanel 和 SparkCapture 使用共享的 Graphite Amber semantic token。MainWindow 显示自定义交通灯；TodoPanel 和 SparkCapture 不复制 MainWindow 标题栏或控制按钮。

TodoPanel 使用轻透明暖灰表面但必须保证文字对比度；SparkCapture 使用不透明轻量纸张表面。三个窗口保持 12px 外框圆角，MainWindow 最大化时圆角归零。

## Responsive baseline

MainWindow 最小支持尺寸为 1080×680。布局通过 CSS Grid、Flex 和受控滚动适应可用空间，不使用按窗口宽度实时计算列数的 JavaScript，也不通过固定多列 breakpoint 强行铺满卡片。
