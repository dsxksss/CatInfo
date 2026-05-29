import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  disk_read_mb: number;
  disk_write_mb: number;
  status: string;
  icon?: string;
  has_window?: boolean;
}

export type SortColumn = "name" | "pid" | "cpu_percent" | "memory_mb";
export type SortDir = "asc" | "desc";

const iconCache = new Map<number, string>();
// Share the in-flight request so concurrent callers (list row + detail panel)
// all receive the same result instead of one getting `undefined`.
const inFlightIcons = new Map<number, Promise<string | undefined>>();
// Count failures per pid and give up after a few attempts (e.g. protected
// processes we can never read) to avoid hammering the backend forever.
const iconFailures = new Map<number, number>();
const MAX_ICON_ATTEMPTS = 4;

async function loadIcon(pid: number): Promise<string | undefined> {
  const cached = iconCache.get(pid);
  if (cached) return cached;
  if ((iconFailures.get(pid) ?? 0) >= MAX_ICON_ATTEMPTS) return undefined;

  const existing = inFlightIcons.get(pid);
  if (existing) return existing;

  const request = (async () => {
    try {
      const icon = await invoke<string>("get_process_icon", { pid });
      if (icon) {
        iconCache.set(pid, icon);
        iconFailures.delete(pid);
        return icon;
      }
      iconFailures.set(pid, (iconFailures.get(pid) ?? 0) + 1);
      return undefined;
    } catch {
      iconFailures.set(pid, (iconFailures.get(pid) ?? 0) + 1);
      return undefined;
    } finally {
      inFlightIcons.delete(pid);
    }
  })();

  inFlightIcons.set(pid, request);
  return request;
}

interface ProcessState {
  processes: ProcessInfo[];
  sortColumn: SortColumn;
  sortDir: SortDir;
  searchQuery: string;
  selectedPid: number | null;
  setProcesses: (procs: ProcessInfo[]) => void;
  setSort: (col: SortColumn) => void;
  setSearch: (q: string) => void;
  setSelectedPid: (pid: number | null) => void;
  getFilteredSorted: () => ProcessInfo[];
  loadIconForPid: (pid: number) => void;
  getCachedIcon: (pid: number) => string | undefined;
  fetchIconAsync: (pid: number) => Promise<string | undefined>;
}

export const useProcessStore = create<ProcessState>((set, get) => ({
  processes: [],
  sortColumn: "cpu_percent",
  sortDir: "desc",
  searchQuery: "",
  selectedPid: null,
  getCachedIcon: (pid) => iconCache.get(pid),
  fetchIconAsync: async (pid) => {
    return await loadIcon(pid);
  },

  setProcesses: (procs) => {
    const old = get().processes;
    // Merge icons from old processes into new
    const merged = procs.map((p) => {
      if (p.icon) return p;
      const oldProc = old.find((o) => o.pid === p.pid);
      return { ...p, icon: oldProc?.icon };
    });
    set({ processes: merged });
  },

  setSort: (col) => {
    const { sortColumn, sortDir } = get();
    if (sortColumn === col) {
      set({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      set({ sortColumn: col, sortDir: "desc" });
    }
  },

  setSearch: (q) => set({ searchQuery: q }),

  setSelectedPid: (pid) => set({ selectedPid: pid }),

  getFilteredSorted: () => {
    const { processes, sortColumn, sortDir, searchQuery } = get();
    let filtered = processes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = processes.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          String(p.pid).includes(q)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortColumn] as number) - (b[sortColumn] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  },

  loadIconForPid: async (pid: number) => {
    const icon = await loadIcon(pid);
    if (icon) {
      set((state) => ({
        processes: state.processes.map((p) =>
          p.pid === pid ? { ...p, icon } : p
        ),
      }));
    }
  },
}));
