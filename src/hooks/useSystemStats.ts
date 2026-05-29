import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useProcessStore, type ProcessInfo } from "../stores/processStore";
import { usePerfStore, type DiskInfo, type GpuInfo } from "../stores/perfStore";

interface SystemStatsPayload {
  processes: ProcessInfo[];
  cpu_usage: number;
  cpu_per_core: number[];
  cpu_freq: number;
  cpu_brand: string;
  memory_total_gb: number;
  memory_used_gb: number;
  memory_available_gb: number;
  memory_percent: number;
  disk_read_kbps: number;
  disk_write_kbps: number;
  net_rx_kbps: number;
  net_tx_kbps: number;
  uptime_secs: number;
  process_count: number;
  disks: DiskInfo[];
  gpus: GpuInfo[];
}

export function useSystemStats() {
  const setProcesses = useProcessStore((s) => s.setProcesses);
  const pushData = usePerfStore((s) => s.pushData);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const start = async () => {
      unlisten = await listen<SystemStatsPayload>("system-stats", (event) => {
        const p = event.payload;
        setProcesses(p.processes);
        pushData({
          cpu_usage: p.cpu_usage,
          cpu_per_core: p.cpu_per_core,
          cpu_freq: p.cpu_freq,
          cpu_brand: p.cpu_brand,
          memory_total_gb: p.memory_total_gb,
          memory_used_gb: p.memory_used_gb,
          memory_available_gb: p.memory_available_gb,
          memory_percent: p.memory_percent,
          disk_read_kbps: p.disk_read_kbps,
          disk_write_kbps: p.disk_write_kbps,
          net_rx_kbps: p.net_rx_kbps,
          net_tx_kbps: p.net_tx_kbps,
          uptime_secs: p.uptime_secs,
          process_count: p.process_count,
          disks: p.disks || [],
          gpus: p.gpus || [],
        });
      });
    };

    start();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);
}
