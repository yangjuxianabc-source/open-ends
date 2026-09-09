# Open Ends v1.0 Windows Desktop Contract

## Stable application identity

| Field | Value |
| --- | --- |
| Identifier | io.github.yangjuxianabc.openends |
| Product name | Open Ends |
| Main window title | 未了 Open Ends |
| Publisher | yangjuxianabc |

正式桌面应用由 Tauri 2 加载 Next static export。npm run build 生成 out/，npm run tauri -- build 生成 Windows x64 EXE、NSIS 和 MSI。发布包不依赖本地 Next Server。

## MainWindow

- 使用无边框窗口和透明 native frame；页面主体提供不透明 Classic surface。
- 自定义标题栏只显示最小化、最大化/恢复和关闭到托盘控制。
- 支持拖动、调整大小、最大化和恢复。
- 最小支持尺寸为 1080×680。
- 最大化边界映射到当前显示器的 work area，不覆盖任务栏，兼容负坐标副屏。
- 关闭请求隐藏到托盘；只有托盘中的退出操作结束进程。
- 主窗口是唯一显示在 Windows 任务栏的窗口。

## TodoPanel

TodoPanel 是无边框辅助窗口，路由为 /todo-panel/，不显示原生或 MainWindow 标题栏，并设置 skipTaskbar。

- 显示当天 Focus、当天任务和快速添加入口。
- 支持 Pin always-on-top。
- 左、右、上边缘均支持 dock、自动收纳和 12px reveal strip；Bottom 不支持 dock。
- 拖动进入当前显示器工作区边缘约 16px 内即可识别吸附，收纳判定允许面板约四分之一越过边界。
- pointer、focus、按下交互和 interaction lock 会阻止误收纳。
- dock 坐标依据当前显示器 work area 计算，支持多显示器和负坐标。

## SparkCapture

SparkCapture 是无边框辅助窗口，路由为 /spark-capture/，不显示原生或 MainWindow 标题栏，并设置 skipTaskbar。

它使用 Classic 不透明 surface，支持原文输入、保存、后台整理、保存成功后关闭和 Escape 隐藏。空输入也可以通过 Escape 关闭。Theme/Edition 可以替换其表现 renderer，但不改变 Spark 生命周期。

## Tray、shortcuts 与 autostart

托盘菜单提供打开主窗口、显示/隐藏 TodoPanel、新建 Spark、打开设置和退出。左键托盘图标打开 MainWindow。

默认快捷键为：

    Ctrl+Shift+O       显示或隐藏 TodoPanel
    Ctrl+Shift+Space   打开 SparkCapture

快捷键可在设置页修改。冲突只停用冲突项并显示问题，不阻止应用启动。开机启动由用户在设置页显式开启或关闭。

## Persistence and credentials

三个窗口共享应用数据目录中的 SQLite open-ends.db。窗口内 React state 只是缓存，SQLite 写入成功后广播跨窗口刷新；窗口重新获得焦点或可见时也会重读。

DeepSeek 和 TMDB 凭据保存在 Windows Credential Manager，服务标识为 io.github.yangjuxianabc.openends。SQLite、JSON backup、前端和日志不得保存密钥明文。

## Windows build outputs

默认构建目标为 Windows x64，Tauri bundle targets 为 nsis 和 msi：

    src-tauri/target/release/open-ends.exe
    src-tauri/target/release/bundle/nsis/Open Ends_1.0.0_x64-setup.exe
    src-tauri/target/release/bundle/msi/Open Ends_1.0.0_x64_en-US.msi

安装包当前未进行代码签名，Windows SmartScreen 可能在首次安装时显示提醒。
