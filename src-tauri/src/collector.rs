use crate::sys_info::{SysCollector, SystemStats};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Emitter};

static REFRESH_INTERVAL_MS: AtomicU64 = AtomicU64::new(1000);

pub fn set_refresh_interval_ms(ms: u64) {
    REFRESH_INTERVAL_MS.store(ms, Ordering::Relaxed);
}

pub fn get_refresh_interval_ms() -> u64 {
    REFRESH_INTERVAL_MS.load(Ordering::Relaxed)
}

pub fn start_collector(app: &AppHandle) {
    let collector = Arc::new(Mutex::new(SysCollector::new()));
    let app_handle = app.clone();

    std::thread::spawn(move || {
        loop {
            let stats: SystemStats;
            {
                let mut c = collector.lock().unwrap();
                stats = c.collect();
            }

            if let Err(e) = app_handle.emit("system-stats", &stats) {
                eprintln!("Failed to emit system-stats: {}", e);
            }

            let interval = get_refresh_interval_ms();
            std::thread::sleep(std::time::Duration::from_millis(interval));
        }
    });
}
