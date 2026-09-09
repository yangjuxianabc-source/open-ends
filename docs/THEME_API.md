# Open Ends v1.0 Theme API

## Purpose

Theme 只负责表现层：semantic token、字体、图标、资源槽位和动效参数。Theme 不拥有页面结构、业务规则、Repository、SQLite 或外部请求。

## Theme manifest

每个 ThemeDefinition 包含 manifest、icons 和 assets。manifest 的正式字段包括：

- apiVersion：当前为 1；
- id、name、version、author、kind；
- compatibleEditions；
- tokens；
- icons；
- assets。

id 使用安全的小写标识。kind 可以是 official 或 community。assets 只能引用本地资源。

## Semantic tokens

Theme 通过固定的 semantic token 名称提供背景、表面、文字、主色、强调色、危险色、边框、阴影、圆角、字体、动效、页面 canvas、标题栏、TodoPanel 和 SparkCapture surface。

当前内置 Theme 为 Graphite Amber，默认字体、颜色、圆角和动效由 ui/themes/graphite-amber/manifest.ts 与 tokens.css 提供。页面组件使用 semantic token，不读取任意 Theme CSS 文本。

## Icon and asset slots

固定 icon slots 包括 brand、today、spark、month、open、review、reading、media、settings、focus、complete、restore 和 archive，以及 Month 统计图标。

固定 asset slots 包括 brandMark、appBackground、surfaceTexture、focusDecoration、emptyIllustration 和 windowDecoration。缺失资源必须安全降级为无资源表现。

## Validator and registry

ui/themes/theme-validator.ts 校验 manifest 字段、token 名称、图标结构、资源值和版本。未知字段、未知 slot、非法 id 或错误结构均使 Theme 无效。

ui/themes/theme-registry.ts 只注册受信任的内置 Theme，并在注册时执行校验。当前 registry 只包含 graphite-amber。

## Runtime application

AppearanceProvider 根据应用设置解析 Edition 和 Theme。theme-runtime.ts 先校验 Theme，再只把固定 semantic token 写入 document root；无效结果不会注入任意 CSS。

Theme 设置保存在已有 app_settings 的 appearance.theme key 中，不新增数据库表或字段。

## Compatibility and fallback

Theme manifest 声明 compatibleEditions。Theme 与当前 Edition 不兼容、缺失或校验失败时，应用回退到 Classic + Graphite Amber，并保留可读的 fallback 状态。

## Build-time registration

内置 Theme 在编译期注册，资源来自仓库本地文件。Theme 不从网络加载 renderer、JavaScript 或 CSS，不使用 eval，也不能借此改变数据或业务行为。
