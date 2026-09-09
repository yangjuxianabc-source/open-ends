use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
#[cfg(windows)]
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg(windows)]
use std::mem::size_of;
#[cfg(windows)]
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM},
    Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWCP_ROUND, DWMWA_WINDOW_CORNER_PREFERENCE,
    },
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
            MINMAXINFO, SET_WINDOW_POS_FLAGS, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_NOZORDER, STYLESTRUCT, WM_GETMINMAXINFO, WM_NCDESTROY,
            WM_STYLECHANGING, WS_BORDER, WS_CAPTION, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
            WS_EX_WINDOWEDGE,
        },
    },
};

const DEFAULT_TODO_SHORTCUT: &str = "Ctrl+Shift+O";
const DEFAULT_SPARK_SHORTCUT: &str = "Ctrl+Shift+Space";

#[derive(Default)]
pub struct ExitState(pub AtomicBool);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutSettings {
    todo_panel: String,
    spark_capture: String,
    issues: Vec<String>,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            todo_panel: DEFAULT_TODO_SHORTCUT.into(),
            spark_capture: DEFAULT_SPARK_SHORTCUT.into(),
            issues: Vec::new(),
        }
    }
}

#[derive(Default)]
pub struct ShortcutStateStore(pub Mutex<ShortcutSettings>);

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
enum TodoDockSide { #[default] None, Left, Right, Top }

#[derive(Clone, Copy, Debug, Default)]
struct TodoDockState {
    side: TodoDockSide,
    revealed: bool,
    pointer_inside: bool,
    interaction_lock: bool,
    reconcile_generation: u64,
    hide_generation: u64,
}

impl TodoDockState {
    fn bump_reconcile_generation(&mut self) -> u64 {
        self.reconcile_generation = self.reconcile_generation.wrapping_add(1);
        self.reconcile_generation
    }

    fn bump_hide_generation(&mut self) -> u64 {
        self.hide_generation = self.hide_generation.wrapping_add(1);
        self.hide_generation
    }
}

#[derive(Default)]
pub struct TodoDockStateStore(Mutex<TodoDockState>);

const TODO_DOCK_STRIP:i32=12;
const TODO_DOCK_THRESHOLD:i32=16;
#[cfg(windows)]
const MAIN_WINDOW_WORK_AREA_SUBCLASS_ID: usize = 0x4f45_4d41;
#[cfg(windows)]
const FRAMELESS_WINDOW_SUBCLASS_ID: usize = 0x4f45_4d42;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct NativeRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

fn work_area_max_bounds(monitor: NativeRect, work: NativeRect) -> (i32, i32, i32, i32) {
    (
        work.left - monitor.left,
        work.top - monitor.top,
        work.right - work.left,
        work.bottom - work.top,
    )
}

fn outside_quarter(length:i32)->i32{
    ((length.max(1)+3)/4).max(1)
}

fn todo_dock_side(position_x:i32,monitor_left:i32,monitor_width:i32,window_width:i32)->TodoDockSide{
    let right=monitor_left+monitor_width-window_width;
    let outside=outside_quarter(window_width);
    if (position_x-monitor_left).abs()<=TODO_DOCK_THRESHOLD || position_x<=monitor_left-outside {TodoDockSide::Left}
    else if (position_x-right).abs()<=TODO_DOCK_THRESHOLD || position_x>=right+outside {TodoDockSide::Right}
    else {TodoDockSide::None}
}

fn todo_dock_side_for_rect(position:NativeRect,work:NativeRect,window_width:i32,window_height:i32)->TodoDockSide{
    let outside=outside_quarter(window_height);
    if (position.top-work.top).abs()<=TODO_DOCK_THRESHOLD || position.top<=work.top-outside {
        return TodoDockSide::Top;
    }
    todo_dock_side(position.left,work.left,work.right-work.left,window_width)
}

fn reconcile_todo_dock_from_geometry(position:NativeRect,work:NativeRect,window_width:i32,window_height:i32)->(TodoDockSide,bool){
    // Geometry reconciliation only decides whether a free panel should dock.
    // Every newly recognized edge uses the same hidden state; revealed is an
    // interaction state controlled by pointer/focus handling.
    let left_revealed=work.left;
    let left_hidden=work.left-window_width+TODO_DOCK_STRIP;
    if (position.left-left_revealed).abs()<=TODO_DOCK_THRESHOLD || (position.left-left_hidden).abs()<=TODO_DOCK_THRESHOLD {
        return (TodoDockSide::Left,false);
    }
    let right_revealed=work.right-window_width;
    let right_hidden=work.right-TODO_DOCK_STRIP;
    if (position.left-right_revealed).abs()<=TODO_DOCK_THRESHOLD || (position.left-right_hidden).abs()<=TODO_DOCK_THRESHOLD {
        return (TodoDockSide::Right,false);
    }
    let top_revealed=work.top;
    let top_hidden=work.top-window_height+TODO_DOCK_STRIP;
    if (position.top-top_revealed).abs()<=TODO_DOCK_THRESHOLD || (position.top-top_hidden).abs()<=TODO_DOCK_THRESHOLD {
        return (TodoDockSide::Top,false);
    }
    let side=todo_dock_side_for_rect(position,work,window_width,window_height);
    if side!=TodoDockSide::None {(side,false)} else {(TodoDockSide::None,true)}
}

fn clamp(value:i32,min:i32,max:i32)->i32{value.max(min).min(max)}

fn todo_dock_position(side:TodoDockSide,revealed:bool,work:NativeRect,window_width:i32,window_height:i32,anchor_x:i32,anchor_y:i32)->(i32,i32){
    match side {
        TodoDockSide::Left => (if revealed {work.left} else {work.left-window_width+TODO_DOCK_STRIP},clamp(anchor_y,work.top,work.bottom-window_height)),
        TodoDockSide::Right => (if revealed {work.right-window_width} else {work.right-TODO_DOCK_STRIP},clamp(anchor_y,work.top,work.bottom-window_height)),
        TodoDockSide::Top => (clamp(anchor_x,work.left,work.right-window_width),if revealed {work.top} else {work.top-window_height+TODO_DOCK_STRIP}),
        TodoDockSide::None => (anchor_x,anchor_y),
    }
}

fn native_work_area(monitor:&tauri::Monitor)->NativeRect{
    let work=monitor.work_area();
    NativeRect{left:work.position.x,top:work.position.y,right:work.position.x+work.size.width as i32,bottom:work.position.y+work.size.height as i32}
}

pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    setup_tray(app)?;
    for label in ["todo-panel", "spark-capture"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
        }
    }
    configure_native_frames(app)?;
    reconcile_todo_panel_from_geometry(app);
    schedule_todo_panel_reconcile_with_delay(app.clone(), 420);
    #[cfg(windows)]
    schedule_native_frame_refresh(app);
    let configured = ShortcutSettings {
        todo_panel: crate::read_app_setting(app, "desktop.shortcut.todo")
            .and_then(|value| serde_json::from_str(&value).ok())
            .unwrap_or_else(|| DEFAULT_TODO_SHORTCUT.into()),
        spark_capture: crate::read_app_setting(app, "desktop.shortcut.spark")
            .and_then(|value| serde_json::from_str(&value).ok())
            .unwrap_or_else(|| DEFAULT_SPARK_SHORTCUT.into()),
        issues: Vec::new(),
    };
    let registered = register_shortcuts(app, configured);
    *app.state::<ShortcutStateStore>().0.lock().unwrap() = registered;
    Ok(())
}

/// tao keeps caption-related bits in the Win32 style even for an undecorated
/// window and hides them through WM_NCCALCSIZE. That is normally sufficient,
/// but it is fragile when an existing window-state file or a runtime style
/// update has touched the frame. Remove the visible non-client bits at the
/// HWND level while retaining the thick frame used for native resize and the
/// min/max styles used by the MainWindow commands.
fn configure_native_frames(app: &AppHandle) -> Result<(), String> {
    for label in ["main", "todo-panel", "spark-capture"] {
        if let Some(window) = app.get_webview_window(label) {
            #[cfg(windows)]
            configure_native_frame(&window)
                .map_err(|error| format!("{label}: {error}"))?;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn configure_native_frame<R: Runtime>(window: &tauri::WebviewWindow<R>) -> Result<(), String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("WINDOW_HANDLE_FAILED: {error}"))?;

    let _ = window.set_skip_taskbar(window.label() != "main");
    let skip_taskbar=window.label() != "main";
    install_frameless_window_subclass(hwnd,skip_taskbar)?;
    configure_native_frame_hwnd(hwnd,skip_taskbar)?;
    if window.label() == "main" {
        install_main_work_area_subclass(hwnd)?;
    }
    Ok(())
}

#[cfg(windows)]
fn configure_native_frame_window<R: Runtime>(window: &tauri::Window<R>) {
    let _ = window.set_skip_taskbar(window.label() != "main");
    if let Ok(hwnd) = window.hwnd() {
        let skip_taskbar=window.label() != "main";
        let _ = install_frameless_window_subclass(hwnd,skip_taskbar);
        let _ = configure_native_frame_hwnd(hwnd,skip_taskbar);
        if window.label() == "main" {
            let _ = install_main_work_area_subclass(hwnd);
        }
    }
}

#[cfg(windows)]
fn install_frameless_window_subclass(hwnd: HWND,skip_taskbar:bool) -> Result<(), String> {
    let installed = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(frameless_window_subclass),
            FRAMELESS_WINDOW_SUBCLASS_ID,
            usize::from(skip_taskbar),
        )
    };
    if installed.as_bool() {
        Ok(())
    } else {
        Err("WINDOW_FRAME_SUBCLASS_FAILED".into())
    }
}

#[cfg(windows)]
unsafe extern "system" fn frameless_window_subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    ref_data: usize,
) -> LRESULT {
    if message == WM_STYLECHANGING && lparam.0 != 0 {
        let style_change = &mut *(lparam.0 as *mut STYLESTRUCT);
        if wparam.0 as i32 == GWL_STYLE.0 {
            style_change.styleNew &= !(WS_CAPTION.0 | WS_BORDER.0);
        } else if wparam.0 as i32 == GWL_EXSTYLE.0 {
            style_change.styleNew &= !WS_EX_WINDOWEDGE.0;
            if ref_data != 0 {
                style_change.styleNew=(style_change.styleNew & !WS_EX_APPWINDOW.0)|WS_EX_TOOLWINDOW.0;
            }
        }
    }

    let result = DefSubclassProc(hwnd, message, wparam, lparam);
    if message == WM_NCDESTROY {
        let _ = RemoveWindowSubclass(hwnd, Some(frameless_window_subclass), subclass_id);
    }
    result
}

#[cfg(windows)]
fn install_main_work_area_subclass(hwnd: HWND) -> Result<(), String> {
    let installed = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(main_work_area_subclass),
            MAIN_WINDOW_WORK_AREA_SUBCLASS_ID,
            0,
        )
    };
    if installed.as_bool() {
        Ok(())
    } else {
        Err("WINDOW_WORK_AREA_SUBCLASS_FAILED".into())
    }
}

#[cfg(windows)]
unsafe extern "system" fn main_work_area_subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _ref_data: usize,
) -> LRESULT {
    // Let Tao/Tauri process the message first. Its WM_GETMINMAXINFO handler
    // keeps the configured min/max track sizes; we only add the missing work
    // area offset/size afterwards for a borderless maximized MainWindow.
    let result = DefSubclassProc(hwnd, message, wparam, lparam);
    if message == WM_GETMINMAXINFO {
        apply_work_area_max_info(hwnd, lparam);
    }
    if message == WM_NCDESTROY {
        let _ = RemoveWindowSubclass(hwnd, Some(main_work_area_subclass), subclass_id);
    }
    result
}

#[cfg(windows)]
fn apply_work_area_max_info(hwnd: HWND, lparam: LPARAM) {
    if lparam.0 == 0 {
        return;
    }
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_invalid() {
        return;
    }
    let mut monitor_info = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    let populated = unsafe { GetMonitorInfoW(monitor, &mut monitor_info) };
    if !populated.as_bool() {
        return;
    }
    let monitor_rect = NativeRect {
        left: monitor_info.rcMonitor.left,
        top: monitor_info.rcMonitor.top,
        right: monitor_info.rcMonitor.right,
        bottom: monitor_info.rcMonitor.bottom,
    };
    let work_rect = NativeRect {
        left: monitor_info.rcWork.left,
        top: monitor_info.rcWork.top,
        right: monitor_info.rcWork.right,
        bottom: monitor_info.rcWork.bottom,
    };
    let (x, y, width, height) = work_area_max_bounds(monitor_rect, work_rect);
    let min_max_info = unsafe { &mut *(lparam.0 as *mut MINMAXINFO) };
    min_max_info.ptMaxPosition = POINT { x, y };
    min_max_info.ptMaxSize = POINT { x: width, y: height };
}

#[cfg(windows)]
fn configure_native_frame_hwnd(hwnd: windows::Win32::Foundation::HWND,skip_taskbar:bool) -> Result<(), String> {

    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let frameless_style = style & !(WS_CAPTION.0 | WS_BORDER.0);
        if frameless_style != style {
            SetWindowLongPtrW(hwnd, GWL_STYLE, frameless_style as isize);
        }

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let frameless_ex_style = if skip_taskbar {
            (ex_style & !(WS_EX_WINDOWEDGE.0 | WS_EX_APPWINDOW.0)) | WS_EX_TOOLWINDOW.0
        } else {
            ex_style & !WS_EX_WINDOWEDGE.0
        };
        if frameless_ex_style != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, frameless_ex_style as isize);
        }

        SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SET_WINDOW_POS_FLAGS(
                SWP_FRAMECHANGED.0
                    | SWP_NOACTIVATE.0
                    | SWP_NOMOVE.0
                    | SWP_NOSIZE.0
                    | SWP_NOZORDER.0,
            ),
        )
        .map_err(|error| format!("WINDOW_FRAME_REFRESH_FAILED: {error}"))?;

        // Windows 11 can round a borderless top-level window without bringing
        // back the native titlebar. Older Windows versions simply ignore this
        // optional DWM attribute; CSS still provides the visible corners.
        let corner = DWMWCP_ROUND;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corner as *const _ as *const std::ffi::c_void,
            size_of::<i32>() as u32,
        );

        let applied_style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        if applied_style & WS_CAPTION.0 != 0 {
            return Err("WINDOW_CAPTION_NOT_REMOVED".into());
        }
        if skip_taskbar {
            let applied_ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            if applied_ex_style & WS_EX_APPWINDOW.0 != 0
                || applied_ex_style & WS_EX_TOOLWINDOW.0 == 0
            {
                return Err("WINDOW_TASKBAR_POLICY_NOT_APPLIED".into());
            }
        }
    }

    Ok(())
}

#[cfg(windows)]
fn schedule_native_frame_refresh(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(250));
        let callback_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            let _ = configure_native_frames(&callback_app);
        });
    });
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "打开主窗口", true, None::<&str>)?;
    let todo = MenuItem::with_id(app, "todo", "今日悬浮窗", true, None::<&str>)?;
    let spark = MenuItem::with_id(app, "spark", "新建闪念", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 Open Ends", true, None::<&str>)?;
    let settings_separator = PredefinedMenuItem::separator(app)?;
    let quit_separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &todo, &spark, &settings_separator, &settings, &quit_separator, &quit])?;
    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("未了 Open Ends")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_window(app, "main", None),
            "todo" => toggle_window(app, "todo-panel"),
            "spark" => show_window(app, "spark-capture", None),
            "settings" => show_window(app, "main", Some("/settings")),
            "quit" => {
                app.state::<ExitState>().0.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle(), "main", None);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn handle_window_event<R: Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    #[cfg(windows)]
    if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::Focused(true)) {
        // Window-state restores size/maximize after setup. Re-apply the
        // native style cleanup after that lifecycle step as well, otherwise
        // tao may reconstruct its default caption style during the resize.
        configure_native_frame_window(window);
    }

    if window.label() == "todo-panel" {
        match event {
            WindowEvent::Moved(_) => {
                let should_reconcile={
                    let state=window.app_handle().state::<TodoDockStateStore>();
                    let state=state.0.lock().unwrap();
                    state.side==TodoDockSide::None
                };
                if should_reconcile {schedule_todo_panel_reconcile(window.app_handle().clone());}
            }
            WindowEvent::Resized(_) => {
                let revealed = {
                    let state = window.app_handle().state::<TodoDockStateStore>();
                    let state = state.0.lock().unwrap();
                    if state.side == TodoDockSide::None { None } else { Some(state.revealed) }
                };
                if let Some(revealed) = revealed {
                    move_todo_panel_dock(window.app_handle(), revealed);
                }
            }
            _ => {}
        }
    }

    match event {
        WindowEvent::CloseRequested { api, .. }
            if !window.state::<ExitState>().0.load(Ordering::SeqCst) =>
        {
            api.prevent_close();
            let _ = window.hide();
        }
        _ => {}
    }
}

fn schedule_todo_panel_reconcile<R: Runtime>(app: AppHandle<R>) {
    schedule_todo_panel_reconcile_with_delay(app,160);
}

fn schedule_todo_panel_reconcile_with_delay<R: Runtime>(app: AppHandle<R>,delay_ms:u64) {
    let generation={let state=app.state::<TodoDockStateStore>();let mut state=state.0.lock().unwrap();state.bump_reconcile_generation()};
    std::thread::spawn(move||{
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        let callback=app.clone();
        let _=app.run_on_main_thread(move||{
            let current_generation=callback.state::<TodoDockStateStore>().0.lock().unwrap().reconcile_generation;
            if current_generation==generation {reconcile_todo_panel_from_geometry(&callback);}
        });
    });
}

fn reconcile_todo_panel_from_geometry<R: Runtime>(app: &AppHandle<R>) {
    let Some(window)=app.get_webview_window("todo-panel") else{return};
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else{return};
    let work=native_work_area(&monitor);
    let geometry=NativeRect{left:position.x,top:position.y,right:position.x+size.width as i32,bottom:position.y+size.height as i32};
    let (side,revealed)=reconcile_todo_dock_from_geometry(geometry,work,size.width as i32,size.height as i32);
    {
        let state=app.state::<TodoDockStateStore>();
        let mut state=state.0.lock().unwrap();
        // side/revealed are authoritative once docked. Moved events caused by
        // reveal/hide/set_position must never replace that state from geometry.
        if state.side!=TodoDockSide::None {return;}
        state.side=side;
        state.revealed=revealed;
    }
    if side!=TodoDockSide::None {
        let (target_x,target_y)=todo_dock_position(side,revealed,work,size.width as i32,size.height as i32,position.x,position.y);
        if target_x!=position.x || target_y!=position.y {
            let _=window.set_position(PhysicalPosition::new(target_x,target_y));
        }
    }
}

fn move_todo_panel_dock<R:Runtime>(app:&AppHandle<R>,revealed:bool){
    let Some(window)=app.get_webview_window("todo-panel") else{return};
    let Ok(Some(monitor))=window.current_monitor() else{return};
    let Ok(size)=window.outer_size() else{return};
    let side={app.state::<TodoDockStateStore>().0.lock().unwrap().side};
    if side==TodoDockSide::None{return}
    let work=native_work_area(&monitor);
    let Ok(position)=window.outer_position() else{return};
    let (x,y)=todo_dock_position(side,revealed,work,size.width as i32,size.height as i32,position.x,position.y);
    {
        let state=app.state::<TodoDockStateStore>();
        let mut state=state.0.lock().unwrap();
        if state.side!=side {return;}
        state.revealed=revealed;
    }
    let _=window.set_position(PhysicalPosition::new(x,y));
}

fn schedule_todo_panel_hide<R:Runtime>(app:AppHandle<R>,hide_generation:u64,delay_ms:u64){
    std::thread::spawn(move||{
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        let callback=app.clone();
        let _=app.run_on_main_thread(move||{
            let can_hide={let state=callback.state::<TodoDockStateStore>();let state=state.0.lock().unwrap();state.hide_generation==hide_generation&&state.side!=TodoDockSide::None&&!state.pointer_inside&&!state.interaction_lock};
            if can_hide{move_todo_panel_dock(&callback,false)}
        });
    });
}

fn register_shortcuts(app: &AppHandle, mut settings: ShortcutSettings) -> ShortcutSettings {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();
    settings.issues.clear();
    if let Err(error) = manager.on_shortcut(settings.todo_panel.as_str(), |app, _, event| {
        if event.state == ShortcutState::Pressed {
            toggle_window(app, "todo-panel");
        }
    }) {
        settings
            .issues
            .push(format!("今日悬浮窗快捷键冲突：{error}"));
    }
    if let Err(error) = manager.on_shortcut(settings.spark_capture.as_str(), |app, _, event| {
        if event.state == ShortcutState::Pressed {
            show_window(app, "spark-capture", None);
        }
    }) {
        settings.issues.push(format!("闪念快捷键冲突：{error}"));
    }
    settings
}

fn show_window(app: &AppHandle, label: &str, route: Option<&str>) {
    if let Some(window) = app.get_webview_window(label) {
        let title = match label {
            "todo-panel" => "今天",
            "spark-capture" => "新建闪念",
            _ => "未了 Open Ends",
        };
        let _ = window.set_title(title);
        let _ = window.set_skip_taskbar(label != "main");
        if label == "spark-capture" {
            let _ = window.center();
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if label=="todo-panel" {
            reconcile_todo_panel_from_geometry(app);
            let side=app.state::<TodoDockStateStore>().0.lock().unwrap().side;
            if side!=TodoDockSide::None {move_todo_panel_dock(app,true);} else {schedule_todo_panel_reconcile_with_delay(app.clone(),260);}
        }
        #[cfg(windows)]
        let _ = configure_native_frame(&window);
        if let Some(route) = route {
            let _ = app.emit_to(label, "desktop:navigate", route);
        }
    }
}

pub(crate) fn activate_main(app: &AppHandle) {
    show_window(app, "main", None);
}

fn toggle_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        if window.is_visible().unwrap_or(false) {
            if label=="todo-panel" {
                let docked_hidden={let store=app.state::<TodoDockStateStore>();let state=store.0.lock().unwrap();state.side!=TodoDockSide::None&&!state.revealed};
                if docked_hidden {move_todo_panel_dock(app,true);let _=window.set_focus();return}
            }
            let _ = window.hide();
        } else {
            show_window(app, label, None);
        }
    }
}

#[tauri::command]
pub fn show_desktop_window(
    app: AppHandle,
    label: String,
    route: Option<String>,
) -> Result<(), String> {
    if !matches!(label.as_str(), "main" | "todo-panel" | "spark-capture") {
        return Err("WINDOW_NOT_ALLOWED".into());
    }
    show_window(&app, &label, route.as_deref());
    Ok(())
}

#[tauri::command]
pub fn hide_current_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn minimize_current_window(window: tauri::Window) -> Result<(), String> {
    window
        .minimize()
        .map_err(|error| format!("WINDOW_MINIMIZE_FAILED: {error}"))
}

#[tauri::command]
pub fn toggle_maximize_current_window(window: tauri::Window) -> Result<bool, String> {
    let maximized = window
        .is_maximized()
        .map_err(|error| format!("WINDOW_MAXIMIZE_STATE_FAILED: {error}"))?;
    if maximized {
        window
            .unmaximize()
            .map_err(|error| format!("WINDOW_RESTORE_FAILED: {error}"))?;
    } else {
        let maximizable = window
            .is_maximizable()
            .map_err(|error| format!("WINDOW_MAXIMIZABLE_STATE_FAILED: {error}"))?;
        if !maximizable {
            return Err("WINDOW_NOT_MAXIMIZABLE".into());
        }
        window
            .maximize()
            .map_err(|error| format!("WINDOW_MAXIMIZE_FAILED: {error}"))?;
    }
    Ok(!maximized)
}

#[tauri::command]
pub fn is_current_window_maximized(window: tauri::Window) -> Result<bool, String> {
    window
        .is_maximized()
        .map_err(|error| format!("WINDOW_MAXIMIZE_STATE_FAILED: {error}"))
}

#[tauri::command]
pub fn start_current_window_dragging(window: tauri::Window) -> Result<(), String> {
    if window.label()=="todo-panel" {
        let app=window.app_handle().clone();
        {
            let store=app.state::<TodoDockStateStore>();
            let mut state=store.0.lock().unwrap();
            state.side=TodoDockSide::None;
            state.revealed=true;
            state.bump_reconcile_generation();
            state.bump_hide_generation();
        }
        window.start_dragging().map_err(|error| format!("WINDOW_DRAG_FAILED: {error}"))?;
        // tao may finish the native drag without delivering a final Moved
        // event. Reconcile once after the drag returns as a final geometry
        // safety net.
        schedule_todo_panel_reconcile_with_delay(app,160);
        return Ok(());
    }
    window.start_dragging().map_err(|error| format!("WINDOW_DRAG_FAILED: {error}"))
}

#[tauri::command]
pub fn set_todo_panel_interaction(app:AppHandle,pointer_inside:bool,interaction_lock:bool)->Result<(),String>{
    let hide_generation={
        let store=app.state::<TodoDockStateStore>();
        let mut state=store.0.lock().map_err(|_|"TODO_DOCK_STATE_POISONED")?;
        state.pointer_inside=pointer_inside;
        state.interaction_lock=interaction_lock;
        // Every interaction transition invalidates only pending hide timers.
        // It must not cancel a geometry reconcile belonging to a free drag.
        state.bump_hide_generation()
    };
    if pointer_inside{move_todo_panel_dock(&app,true)}else if !interaction_lock{schedule_todo_panel_hide(app,hide_generation,760)}
    Ok(())
}

#[tauri::command]
pub fn get_todo_panel_pinned(app: AppHandle) -> Result<bool, String> {
    app.get_webview_window("todo-panel")
        .ok_or_else(|| "WINDOW_NOT_FOUND".to_string())?
        .is_always_on_top()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_todo_panel_pinned(app: AppHandle, pinned: bool) -> Result<(), String> {
    let window=app.get_webview_window("todo-panel")
        .ok_or_else(|| "WINDOW_NOT_FOUND".to_string())?;
    window.set_always_on_top(pinned).map_err(|error| error.to_string())?;
    #[cfg(windows)]
    let _ = configure_native_frame(&window);
    Ok(())
}

#[tauri::command]
pub fn get_shortcut_settings(state: tauri::State<ShortcutStateStore>) -> ShortcutSettings {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_shortcut_settings(
    app: AppHandle,
    settings: ShortcutSettings,
) -> Result<ShortcutSettings, String> {
    let requested = ShortcutSettings {
        issues: Vec::new(),
        ..settings
    };
    if requested.todo_panel.trim().is_empty() || requested.spark_capture.trim().is_empty() {
        return Err("SHORTCUT_EMPTY".into());
    }
    crate::write_app_setting(
        &app,
        "desktop.shortcut.todo",
        &serde_json::to_string(&requested.todo_panel).unwrap(),
    )?;
    crate::write_app_setting(
        &app,
        "desktop.shortcut.spark",
        &serde_json::to_string(&requested.spark_capture).unwrap(),
    )?;
    let registered = register_shortcuts(&app, requested);
    *app.state::<ShortcutStateStore>().0.lock().unwrap() = registered.clone();
    let _ = app.emit(
        "open-ends:store-changed",
        serde_json::json!({"origin":"rust"}),
    );
    Ok(registered)
}

#[tauri::command]
pub fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|error| error.to_string())?;
    get_autostart_enabled(app)
}

#[cfg(test)]
mod tests {
    use super::{reconcile_todo_dock_from_geometry,todo_dock_position,todo_dock_side,todo_dock_side_for_rect,NativeRect,ShortcutSettings,TodoDockSide,TodoDockState};

    #[test]
    fn shortcuts_have_editable_defaults() {
        let settings = ShortcutSettings::default();
        assert!(!settings.todo_panel.is_empty());
        assert!(!settings.spark_capture.is_empty());
        assert_ne!(settings.todo_panel, settings.spark_capture);
    }

    #[test]
    fn todo_dock_sides_support_both_sides_and_negative_monitors(){
        assert_eq!(todo_dock_side(-1916,-1920,1920,360),TodoDockSide::Left);
        assert_eq!(todo_dock_side(-364,-1920,1920,360),TodoDockSide::Right);
        let work=NativeRect{left:-1920,top:0,right:0,bottom:1080};
        assert_eq!(todo_dock_position(TodoDockSide::Left,false,work,360,420,-100,100),(-2268,100));
        assert_eq!(todo_dock_position(TodoDockSide::Left,true,work,360,420,-100,100),(-1920,100));
        assert_eq!(todo_dock_position(TodoDockSide::Right,false,work,360,420,-100,100),(-12,100));
        assert_eq!(todo_dock_position(TodoDockSide::Right,true,work,360,420,-100,100),(-360,100));
    }

    #[test]
    fn todo_dock_starts_after_a_quarter_of_the_panel_crosses_the_edge() {
        let work=NativeRect{left:0,top:0,right:1920,bottom:1080};
        assert_eq!(todo_dock_side(-91,work.left,work.right-work.left,360),TodoDockSide::Left);
        assert_eq!(todo_dock_side(1920-360+91,work.left,work.right-work.left,360),TodoDockSide::Right);
        assert_eq!(todo_dock_side_for_rect(NativeRect{left:-91,top:120,right:269,bottom:540},work,360,420),TodoDockSide::Left);
        assert_eq!(todo_dock_side_for_rect(NativeRect{left:640,top:-106,right:1000,bottom:314},work,360,420),TodoDockSide::Top);
        assert_eq!(reconcile_todo_dock_from_geometry(NativeRect{left:-91,top:120,right:269,bottom:540},work,360,420),(TodoDockSide::Left,false));
    }

    #[test]
    fn todo_dock_near_edge_releases_always_start_hidden() {
        let work=NativeRect{left:0,top:0,right:1920,bottom:1080};
        assert_eq!(reconcile_todo_dock_from_geometry(NativeRect{left:8,top:200,right:368,bottom:620},work,360,420),(TodoDockSide::Left,false));
        assert_eq!(reconcile_todo_dock_from_geometry(NativeRect{left:1552,top:200,right:1912,bottom:620},work,360,420),(TodoDockSide::Right,false));
        assert_eq!(reconcile_todo_dock_from_geometry(NativeRect{left:640,top:8,right:1000,bottom:428},work,360,420),(TodoDockSide::Top,false));
    }

    #[test]
    fn todo_dock_timer_generations_are_independent() {
        let mut state=TodoDockState::default();
        let hide_before=state.hide_generation;
        let reconcile_token=state.bump_reconcile_generation();
        assert_eq!(state.hide_generation,hide_before);
        let hide_token=state.bump_hide_generation();
        assert_eq!(state.reconcile_generation,reconcile_token);
        state.bump_reconcile_generation();
        assert_eq!(state.hide_generation,hide_token);
        state.bump_hide_generation();
        assert_eq!(state.reconcile_generation,reconcile_token+1);
    }

    #[test]
    fn todo_dock_revealed_and_hidden_positions_all_reconcile_to_hidden() {
        let work=NativeRect{left:0,top:40,right:1920,bottom:1120};
        let cases=[
            (TodoDockSide::Left,true,NativeRect{left:0,top:200,right:360,bottom:620}),
            (TodoDockSide::Left,false,NativeRect{left:-348,top:200,right:12,bottom:620}),
            (TodoDockSide::Right,true,NativeRect{left:1560,top:200,right:1920,bottom:620}),
            (TodoDockSide::Right,false,NativeRect{left:1908,top:200,right:2268,bottom:620}),
            (TodoDockSide::Top,true,NativeRect{left:640,top:40,right:1000,bottom:460}),
            (TodoDockSide::Top,false,NativeRect{left:640,top:-368,right:1000,bottom:52}),
        ];
        for (side,_,position) in cases {
            assert_eq!(reconcile_todo_dock_from_geometry(position,work,360,420),(side,false));
        }
    }

    #[test]
    fn todo_dock_uses_work_area_and_supports_top_hidden_geometry() {
        let work=NativeRect{left:-1920,top:40,right:0,bottom:1040};
        let free=NativeRect{left:-900,top:400,right:-540,bottom:820};
        assert_eq!(todo_dock_side_for_rect(free,work,360,420),TodoDockSide::None);
        assert_eq!(todo_dock_side_for_rect(NativeRect{left:-900,top:40,right:-540,bottom:460},work,360,420),TodoDockSide::Top);
        assert_eq!(todo_dock_position(TodoDockSide::Top,false,work,360,420,-900,400),(-900,-368));
        assert_eq!(todo_dock_position(TodoDockSide::Top,true,work,360,420,-900,400),(-900,40));
        assert_eq!(reconcile_todo_dock_from_geometry(NativeRect{left:-900,top:-368,right:-540,bottom:52},work,360,420),(TodoDockSide::Top,false));
        assert_eq!(todo_dock_position(TodoDockSide::Left,true,work,360,420,-900,-200),(-1920,40));
    }

    #[test]
    fn maximized_window_uses_monitor_work_area_offset_and_size() {
        let monitor = super::NativeRect { left: 0, top: 0, right: 1920, bottom: 1080 };
        let work = super::NativeRect { left: 0, top: 0, right: 1920, bottom: 1040 };
        assert_eq!(super::work_area_max_bounds(monitor, work), (0, 0, 1920, 1040));
    }

    #[test]
    fn maximized_window_preserves_negative_monitor_origin_and_top_taskbar() {
        let monitor = super::NativeRect { left: -1920, top: -40, right: 0, bottom: 1040 };
        let work = super::NativeRect { left: -1920, top: 0, right: 0, bottom: 1040 };
        assert_eq!(super::work_area_max_bounds(monitor, work), (0, 40, 1920, 1040));
    }
}
