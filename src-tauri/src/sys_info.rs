use serde::Serialize;
use std::collections::HashSet;
use sysinfo::{Disks, Networks, System};

use crate::gpu::{GpuCollector, GpuInfo};

#[derive(Debug, Clone, Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub disk_read_mb: f64,
    pub disk_write_mb: f64,
    pub status: String,
    /// True if the process owns a visible top-level window (i.e. an "app",
    /// like the Apps group in Windows Task Manager).
    pub has_window: bool,
}

/// PIDs that own a visible, titled, top-level window (taskbar apps).
fn window_owner_pids() -> HashSet<u32> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindow, GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible,
        GW_OWNER,
    };

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let visible = IsWindowVisible(hwnd).as_bool();
        let top_level = match GetWindow(hwnd, GW_OWNER) {
            Ok(owner) => owner.0.is_null(),
            Err(_) => true,
        };
        let titled = GetWindowTextLengthW(hwnd) > 0;
        if visible && top_level && titled {
            let set = &mut *(lparam.0 as *mut HashSet<u32>);
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid != 0 {
                set.insert(pid);
            }
        }
        TRUE
    }

    let mut set: HashSet<u32> = HashSet::new();
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut set as *mut _ as isize));
    }
    set
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space_bytes: u64,
    pub available_space_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemStats {
    pub processes: Vec<ProcessInfo>,
    pub cpu_usage: f32,
    pub cpu_per_core: Vec<f32>,
    pub cpu_freq: u64,
    pub cpu_brand: String,
    pub memory_total_gb: f64,
    pub memory_used_gb: f64,
    pub memory_available_gb: f64,
    pub memory_percent: f32,
    pub disk_read_kbps: f64,
    pub disk_write_kbps: f64,
    pub net_rx_kbps: f64,
    pub net_tx_kbps: f64,
    pub uptime_secs: u64,
    pub process_count: usize,
    pub disks: Vec<DiskInfo>,
    pub gpus: Vec<GpuInfo>,
}

pub struct SysCollector {
    sys: System,
    disks: Disks,
    networks: Networks,
    last_disk_read: u64,
    last_disk_write: u64,
    last_net_rx: u64,
    last_net_tx: u64,
    gpu: GpuCollector,
}

impl SysCollector {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        let disks = Disks::new_with_refreshed_list();
        let networks = Networks::new_with_refreshed_list();

        // First refresh to get baselines
        sys.refresh_all();
        sys.refresh_cpu_all();

        Self {
            sys,
            disks,
            networks,
            last_disk_read: 0,
            last_disk_write: 0,
            last_net_rx: 0,
            last_net_tx: 0,
            gpu: GpuCollector::new(),
        }
    }

    pub fn collect(&mut self) -> SystemStats {
        self.sys.refresh_all();
        self.sys.refresh_cpu_all();
        self.disks.refresh(true);
        self.networks.refresh(true);

        // Per-core CPU
        let cpu_per_core: Vec<f32> = self.sys.cpus().iter().map(|c| c.cpu_usage()).collect();
        let cpu_usage = if !cpu_per_core.is_empty() {
            cpu_per_core.iter().sum::<f32>() / cpu_per_core.len() as f32
        } else {
            0.0
        };

        let cpu_freq = self
            .sys
            .cpus()
            .first()
            .map(|c| c.frequency())
            .unwrap_or(0);

        let cpu_brand = self
            .sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .unwrap_or_default();

        // Memory
        let total_mem = self.sys.total_memory();
        let used_mem = self.sys.used_memory();
        let avail_mem = self.sys.available_memory();
        let memory_total_gb = total_mem as f64 / 1024.0 / 1024.0 / 1024.0;
        let memory_used_gb = used_mem as f64 / 1024.0 / 1024.0 / 1024.0;
        let memory_available_gb = avail_mem as f64 / 1024.0 / 1024.0 / 1024.0;
        let memory_percent = if total_mem > 0 {
            (used_mem as f32 / total_mem as f32) * 100.0
        } else {
            0.0
        };

        // Disk I/O (aggregate all physical disks)
        let mut total_disk_read = 0u64;
        let mut total_disk_write = 0u64;
        let mut disks_info = Vec::new();
        for disk in self.disks.list() {
            total_disk_read += disk.usage().read_bytes;
            total_disk_write += disk.usage().written_bytes;

            let name = disk.name().to_string_lossy().to_string();
            let mount_point = disk.mount_point().to_string_lossy().to_string();
            disks_info.push(DiskInfo {
                name,
                mount_point,
                total_space_bytes: disk.total_space(),
                available_space_bytes: disk.available_space(),
            });
        }

        let disk_read_kbps = if self.last_disk_read > 0 {
            total_disk_read.saturating_sub(self.last_disk_read) as f64 / 1024.0
        } else {
            0.0
        };
        let disk_write_kbps = if self.last_disk_write > 0 {
            total_disk_write.saturating_sub(self.last_disk_write) as f64 / 1024.0
        } else {
            0.0
        };
        self.last_disk_read = total_disk_read;
        self.last_disk_write = total_disk_write;

        // Network I/O
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;
        for (_, net) in self.networks.list() {
            total_rx += net.received();
            total_tx += net.transmitted();
        }

        let net_rx_kbps = if self.last_net_rx > 0 {
            total_rx.saturating_sub(self.last_net_rx) as f64 / 1024.0
        } else {
            0.0
        };
        let net_tx_kbps = if self.last_net_tx > 0 {
            total_tx.saturating_sub(self.last_net_tx) as f64 / 1024.0
        } else {
            0.0
        };
        self.last_net_rx = total_rx;
        self.last_net_tx = total_tx;

        // Processes
        let process_count = self.sys.processes().len();
        let num_cpus = self.sys.cpus().len() as f32;
        let cpus_divisor = if num_cpus > 0.0 { num_cpus } else { 1.0 };

        let window_pids = window_owner_pids();

        let processes: Vec<ProcessInfo> = self
            .sys
            .processes()
            .iter()
            .map(|(pid, proc)| {
                let disk = proc.disk_usage();
                let pid_u32 = pid.as_u32();
                ProcessInfo {
                    pid: pid_u32,
                    name: proc.name().to_string_lossy().to_string(),
                    cpu_percent: proc.cpu_usage() / cpus_divisor,
                    memory_mb: proc.memory() as f64 / 1024.0 / 1024.0,
                    disk_read_mb: disk.read_bytes as f64 / 1024.0 / 1024.0,
                    disk_write_mb: disk.written_bytes as f64 / 1024.0 / 1024.0,
                    status: format!("{:?}", proc.status()),
                    has_window: window_pids.contains(&pid_u32),
                }
            })
            .collect();

        SystemStats {
            processes,
            cpu_usage,
            cpu_per_core,
            cpu_freq,
            cpu_brand,
            memory_total_gb,
            memory_used_gb,
            memory_available_gb,
            memory_percent,
            disk_read_kbps,
            disk_write_kbps,
            net_rx_kbps,
            net_tx_kbps,
            uptime_secs: System::uptime(),
            process_count,
            disks: disks_info,
            gpus: self.gpu.collect(),
        }
    }
}
