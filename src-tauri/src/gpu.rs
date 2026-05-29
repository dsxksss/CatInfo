//! Vendor-agnostic GPU telemetry for Windows.
//!
//! - **DXGI** enumerates physical adapters (de-duplicated by LUID) and provides
//!   each adapter's name, vendor and total dedicated VRAM.
//! - **PDH** provides the live, system-wide figures the Windows Task Manager
//!   shows: `\GPU Engine(*)\Utilization Percentage` for load and
//!   `\GPU Adapter Memory(*)\Dedicated Usage` for VRAM in use. Counter
//!   instances are correlated back to each adapter through the LUID embedded in
//!   the instance name. (DXGI's QueryVideoMemoryInfo is per-process, so it is
//!   not used for VRAM here.)
//!
//! Temperature / power / fan are intentionally not collected: there is no
//! vendor-agnostic Windows API for them.

use serde::Serialize;
use std::collections::HashMap;

use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
};
use windows::Win32::System::Performance::{
    PdhAddEnglishCounterW, PdhCollectQueryData, PdhGetFormattedCounterArrayW, PdhOpenQueryW,
    PDH_FMT_COUNTERVALUE_ITEM_W, PDH_FMT_DOUBLE, PDH_HCOUNTER, PDH_HQUERY,
};

const ERROR_SUCCESS: u32 = 0;
const PDH_MORE_DATA: u32 = 0x800007D2;
const PDH_CSTATUS_VALID_DATA: u32 = 0;

#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub vram_total_mb: f64,
    pub vram_used_mb: f64,
    pub vram_percent: f32,
    pub utilization: f32,
}

pub struct GpuCollector {
    /// Persistent PDH query handle (rate counters need samples across ticks).
    query: PDH_HQUERY,
    /// `\GPU Engine(*)\Utilization Percentage` counter.
    util_counter: PDH_HCOUNTER,
    /// `\GPU Adapter Memory(*)\Dedicated Usage` counter (system-wide VRAM bytes).
    mem_counter: PDH_HCOUNTER,
    /// Whether the query + utilization counter were set up successfully.
    enabled: bool,
    /// Whether the dedicated-memory counter is available.
    mem_enabled: bool,
    /// Whether at least one CollectQueryData has succeeded (first sample is empty).
    primed: bool,
}

// The PDH handles are raw pointers (not auto-Send), but the collector is only
// ever touched from the single collector thread, serialized behind a Mutex.
unsafe impl Send for GpuCollector {}

impl GpuCollector {
    pub fn new() -> Self {
        let mut query = PDH_HQUERY::default();
        let mut util_counter = PDH_HCOUNTER::default();
        let mut mem_counter = PDH_HCOUNTER::default();
        let mut enabled = false;
        let mut mem_enabled = false;
        let mut primed = false;
        unsafe {
            if PdhOpenQueryW(None, 0, &mut query) == ERROR_SUCCESS {
                let util_path = wide("\\GPU Engine(*)\\Utilization Percentage");
                if PdhAddEnglishCounterW(
                    query,
                    windows::core::PCWSTR(util_path.as_ptr()),
                    0,
                    &mut util_counter,
                ) == ERROR_SUCCESS
                {
                    enabled = true;
                }

                let mem_path = wide("\\GPU Adapter Memory(*)\\Dedicated Usage");
                mem_enabled = PdhAddEnglishCounterW(
                    query,
                    windows::core::PCWSTR(mem_path.as_ptr()),
                    0,
                    &mut mem_counter,
                ) == ERROR_SUCCESS;

                if enabled {
                    // Prime the query so the next collect has valid deltas.
                    primed = PdhCollectQueryData(query) == ERROR_SUCCESS;
                }
            }
        }
        Self {
            query,
            util_counter,
            mem_counter,
            enabled,
            mem_enabled,
            primed,
        }
    }

    pub fn collect(&mut self) -> Vec<GpuInfo> {
        let (util_by_luid, mem_by_luid) = self.sample();
        let adapters = match enumerate_adapters() {
            Ok(a) => a,
            Err(_) => return Vec::new(),
        };

        // Some drivers report one physical GPU as several "phantom" adapters,
        // each with a *different* LUID but the same PCI identity. Group by PCI
        // identity so each card appears once, and merge the PDH data across the
        // group's LUIDs (only the real one carries non-zero values).
        let mut order: Vec<String> = Vec::new();
        let mut groups: HashMap<String, Vec<AdapterRaw>> = HashMap::new();
        for a in adapters {
            if !groups.contains_key(&a.pci_key) {
                order.push(a.pci_key.clone());
            }
            groups.entry(a.pci_key.clone()).or_default().push(a);
        }

        let mut out = Vec::new();
        for key in order {
            let group = &groups[&key];
            let first = &group[0];

            let utilization = group
                .iter()
                .filter_map(|a| util_by_luid.get(&a.luid).copied())
                .fold(0.0_f64, f64::max)
                .min(100.0) as f32;
            let used_bytes = group
                .iter()
                .filter_map(|a| mem_by_luid.get(&a.luid).copied())
                .fold(0.0_f64, f64::max);
            let total_bytes = first.vram_total_mb * 1024.0 * 1024.0;

            out.push(GpuInfo {
                name: first.name.clone(),
                vendor: first.vendor.clone(),
                vram_total_mb: first.vram_total_mb,
                vram_used_mb: used_bytes / 1024.0 / 1024.0,
                vram_percent: if total_bytes > 0.0 {
                    (used_bytes / total_bytes * 100.0) as f32
                } else {
                    0.0
                },
                utilization,
            });
        }
        out
    }

    /// Collect one PDH sample and return `(utilization%, dedicated_bytes)` maps,
    /// both keyed by adapter LUID and summed across instances.
    fn sample(&mut self) -> (HashMap<String, f64>, HashMap<String, f64>) {
        let empty = (HashMap::new(), HashMap::new());
        if !self.enabled {
            return empty;
        }
        unsafe {
            if PdhCollectQueryData(self.query) != ERROR_SUCCESS {
                return empty;
            }
            if !self.primed {
                // First successful collect only establishes a baseline.
                self.primed = true;
                return empty;
            }
            let util = read_counter_sum(self.util_counter);
            let mem = if self.mem_enabled {
                read_counter_sum(self.mem_counter)
            } else {
                HashMap::new()
            };
            (util, mem)
        }
    }
}

/// Read a wildcard PDH counter and sum each instance's value by adapter LUID.
unsafe fn read_counter_sum(counter: PDH_HCOUNTER) -> HashMap<String, f64> {
    let mut map: HashMap<String, f64> = HashMap::new();
    let mut buf_size: u32 = 0;
    let mut item_count: u32 = 0;
    let status =
        PdhGetFormattedCounterArrayW(counter, PDH_FMT_DOUBLE, &mut buf_size, &mut item_count, None);
    if status != PDH_MORE_DATA || buf_size == 0 {
        return map;
    }

    let mut buffer = vec![0u8; buf_size as usize];
    let status = PdhGetFormattedCounterArrayW(
        counter,
        PDH_FMT_DOUBLE,
        &mut buf_size,
        &mut item_count,
        Some(buffer.as_mut_ptr() as *mut PDH_FMT_COUNTERVALUE_ITEM_W),
    );
    if status != ERROR_SUCCESS {
        return map;
    }

    let items = std::slice::from_raw_parts(
        buffer.as_ptr() as *const PDH_FMT_COUNTERVALUE_ITEM_W,
        item_count as usize,
    );
    for item in items {
        if item.FmtValue.CStatus != PDH_CSTATUS_VALID_DATA {
            continue;
        }
        let name = item.szName.to_string().unwrap_or_default();
        if let Some(luid) = luid_from_instance(&name) {
            *map.entry(luid).or_insert(0.0) += item.FmtValue.Anonymous.doubleValue;
        }
    }
    map
}

fn vendor_name(vendor_id: u32) -> &'static str {
    match vendor_id {
        0x10DE => "NVIDIA",
        0x1002 | 0x1022 => "AMD",
        0x8086 => "Intel",
        0x1414 => "Microsoft",
        _ => "Unknown",
    }
}

/// One raw DXGI adapter entry (may be a phantom duplicate of a physical GPU).
struct AdapterRaw {
    name: String,
    vendor: String,
    vram_total_mb: f64,
    /// `0xHIGH_0xLOW` LUID, used to correlate PDH counters.
    luid: String,
    /// PCI identity (vendor/device/subsys/revision); identical across phantoms
    /// of the same physical card, so used as the de-duplication key.
    pci_key: String,
}

/// Enumerate all DXGI hardware adapters (no de-duplication here; the caller
/// groups them by PCI identity).
fn enumerate_adapters() -> windows::core::Result<Vec<AdapterRaw>> {
    let mut out = Vec::new();
    unsafe {
        let factory: IDXGIFactory1 = CreateDXGIFactory1()?;
        let mut i = 0u32;
        loop {
            let adapter = match factory.EnumAdapters1(i) {
                Ok(a) => a,
                Err(_) => break,
            };
            i += 1;

            let desc = match adapter.GetDesc1() {
                Ok(d) => d,
                Err(_) => continue,
            };
            // Skip the software/WARP rasterizer.
            if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0 {
                continue;
            }

            let luid = format!(
                "0x{:08x}_0x{:08x}",
                desc.AdapterLuid.HighPart, desc.AdapterLuid.LowPart
            );
            let pci_key = format!(
                "{:04x}:{:04x}:{:08x}:{:02x}",
                desc.VendorId, desc.DeviceId, desc.SubSysId, desc.Revision
            );

            let name = String::from_utf16_lossy(&desc.Description);
            let name = name.trim_end_matches('\0').trim().to_string();

            out.push(AdapterRaw {
                name,
                vendor: vendor_name(desc.VendorId).to_string(),
                vram_total_mb: desc.DedicatedVideoMemory as f64 / 1024.0 / 1024.0,
                luid,
                pci_key,
            });
        }
    }
    Ok(out)
}

/// Extract the `0xHIGH_0xLOW` LUID token from a PDH GPU Engine instance name
/// such as `pid_1234_luid_0x00000000_0x0000A1B2_phys_0_eng_0_engtype_3D`.
fn luid_from_instance(instance: &str) -> Option<String> {
    let start = instance.find("luid_")? + "luid_".len();
    let rest = &instance[start..];
    let end = rest.find("_phys").unwrap_or(rest.len());
    Some(rest[..end].to_lowercase())
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}
