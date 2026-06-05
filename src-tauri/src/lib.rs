mod collector;
mod gpu;
mod process;
mod sys_info;

use tauri::Manager;

#[tauri::command]
fn set_process_refresh_interval(ms: u64) {
    collector::set_refresh_interval_ms(ms);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the FIRST plugin: enforces a single running instance.
        // When a second instance is launched, this callback runs in the
        // already-running instance, so we restore and focus its window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            process::kill_process,
            process::kill_process_tree,
            process::kill_process_elevated,
            process::get_process_icon,
            set_process_refresh_interval,
        ])

        .setup(|app| {
            // Try to gain SeDebugPrivilege so we can terminate processes owned
            // by other users (effective when the app runs elevated).
            process::enable_debug_privilege();

            let handle = app.handle().clone();
            collector::start_collector(&handle);

            // Build tray menu
            use tauri::{
                image::Image,
                menu::{MenuBuilder, MenuItemBuilder},
                tray::TrayIconBuilder,
            };

            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let island = MenuItemBuilder::with_id("island", "Toggle Island").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &island, &quit]).build()?;

            let icon = Image::from_bytes(include_bytes!("../icons/icon.ico"))?;

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "island" => {
                        if let Some(window) = app.get_webview_window("island") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
