import { create } from "zustand";

const MAX_POINTS = 60;

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space_bytes: number;
  available_space_bytes: number;
}

export interface GpuInfo {
  name: string;
  vendor: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_percent: number;
  utilization: number;
}

export interface PerfData {
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

interface PerfRing {
  cpu: number[];
  memory: number[];
  disk_read: number[];
  disk_write: number[];
  net_rx: number[];
  net_tx: number[];
  gpu: number[];
  cpuPerCore: number[][];
}

interface PerfState {
  current: PerfData | null;
  history: PerfRing;
  pushData: (data: PerfData) => void;
}

function pushRing(arr: number[], value: number): number[] {
  const next = [...arr, value];
  if (next.length > MAX_POINTS) {
    next.shift();
  }
  return next;
}

export const usePerfStore = create<PerfState>((set) => ({
  current: null,
  history: {
    cpu: [],
    memory: [],
    disk_read: [],
    disk_write: [],
    net_rx: [],
    net_tx: [],
    gpu: [],
    cpuPerCore: [],
  },

  pushData: (data) => {
    set((state) => {
      const h = state.history;
      const nextCpu = pushRing(h.cpu, data.cpu_usage);
      const nextMemory = pushRing(h.memory, data.memory_percent);
      const nextDiskRead = pushRing(h.disk_read, data.disk_read_kbps);
      const nextDiskWrite = pushRing(h.disk_write, data.disk_write_kbps);
      const nextNetRx = pushRing(h.net_rx, data.net_rx_kbps);
      const nextNetTx = pushRing(h.net_tx, data.net_tx_kbps);
      // Track the busiest GPU's utilization for the headline chart.
      const gpuUsage = (data.gpus ?? []).reduce((max, g) => Math.max(max, g.utilization), 0);
      const nextGpu = pushRing(h.gpu, gpuUsage);

      const nextCpuPerCore = h.cpuPerCore.map((arr, idx) => {
        const val = data.cpu_per_core[idx] || 0;
        return pushRing(arr, val);
      });
      while (nextCpuPerCore.length < data.cpu_per_core.length) {
        const idx = nextCpuPerCore.length;
        const val = data.cpu_per_core[idx] || 0;
        nextCpuPerCore.push([val]);
      }

      return {
        current: data,
        history: {
          cpu: nextCpu,
          memory: nextMemory,
          disk_read: nextDiskRead,
          disk_write: nextDiskWrite,
          net_rx: nextNetRx,
          net_tx: nextNetTx,
          gpu: nextGpu,
          cpuPerCore: nextCpuPerCore,
        },
      };
    });
  },
}));
