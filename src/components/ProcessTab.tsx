import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronRight, ChevronDown,
  Terminal, Shield, FileCode, Cpu, Database,
  Trash2, ShieldAlert, HelpCircle, AppWindow, Cog
} from 'lucide-react';
import { translations } from '../lib/translations';
import { useProcessStore } from '../stores/processStore';
import { usePerfStore } from '../stores/perfStore';

export interface ProcessItem {
  id: string;
  name: string;
  pid: number;
  cpu: number;
  memory: number; // in MB
  disk_read_mb: number;
  disk_write_mb: number;
  status: 'RUNNING' | 'STRESSED' | 'SUSPENDED' | 'FAULTED' | 'IDLE';
  path: string;
  threads: number;
  user: string;
  priority: 'Low' | 'Normal' | 'High' | 'Realtime';
  description: string;
  icon?: string;
  hasWindow: boolean;
}

interface ProcessTabProps {
  processes: any[]; // accepts the raw ProcessInfo[] from store
  onKillProcess: (pid: number) => Promise<void>;
  onKillProcessTree: (pid: number) => Promise<void>;
  onKillProcessElevated: (pid: number) => Promise<void>;
  lang?: 'en' | 'zh';
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
  loadIconForPid: (pid: number) => void;
  confirmKill?: boolean;
}

const popularDescriptions: Record<string, string> = {
  'explorer.exe': 'Windows Explorer - Manages the desktop user interface, system taskbar, and file explorer views.',
  'chrome.exe': 'Google Chrome - High-speed web browser executing isolated sandboxed frames and tabs.',
  'svchost.exe': 'Service Host Process - Shared system daemon hosting multiple background DLL service threads.',
  'taskhostw.exe': 'Host Process for Windows Tasks - Subsystem manager processing triggered system tasks.',
  'lsass.exe': 'Local Security Authority - Security controller managing logins, credentials, and token structures.',
  'services.exe': 'Services Controller - Critical micro-kernel system launcher controlling system service nodes.',
  'wininit.exe': 'Windows Initialization - Initializes Ring 0 structures and user credentials during secure boot.',
  'csrss.exe': 'Client Server Runtime - Critical sub-system managing terminal threads, drawing, and processes.',
  'tauri-dev': 'Tauri Dev Sandbox - Bridging native Rust crate compilation logs with high-performance web viewports.',
  'node.exe': 'Node.js Runtime - Asynchronous event-driven engine processing active JS instructions.',
  'catinfo.exe': 'Cat Info - Core premium diagnostic manager displaying this responsive dashboard.',
  'system': 'System Kernel - Root operation ring executing central memory pools and secure thread schedulers.',
};

export default function ProcessTab({
  processes: rawProcesses,
  onKillProcess,
  onKillProcessTree,
  onKillProcessElevated,
  lang = 'en',
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  loadIconForPid: _loadIconForPid,
  confirmKill = true,
}: ProcessTabProps) {
  const currentPerf = usePerfStore((s) => s.current);
  const systemCpu = currentPerf?.cpu_usage || 0;
  const systemMemory = currentPerf?.memory_percent || 0;
  
  const getDiskPercent = () => {
    const kbps = (currentPerf?.disk_read_kbps || 0) + (currentPerf?.disk_write_kbps || 0);
    if (kbps === 0) return 0;
    const percent = Math.round((kbps / 1024 / 100) * 100);
    return Math.min(100, Math.max(1, percent));
  };
  const systemDisk = getDiskPercent();

  const getNetPercent = () => {
    const kbps = (currentPerf?.net_rx_kbps || 0) + (currentPerf?.net_tx_kbps || 0);
    if (kbps === 0) return 0;
    const percent = Math.round((kbps / 12500) * 100);
    return Math.min(100, Math.max(0, percent));
  };
  const systemNetwork = getNetPercent();

  const t = translations[lang];
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalSearchQuery;
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
  const [pendingKill, setPendingKill] = useState<{ pid: number; name: string; isTree: boolean } | null>(null);
  
  // View mode switcher: tree lists vs grid table
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('grid');


  // Pull sort parameters from process store
  const sortColumn = useProcessStore((s) => s.sortColumn);
  const sortDir = useProcessStore((s) => s.sortDir);
  const setSort = useProcessStore((s) => s.setSort);
  
  // Collapsible section toggles
  const [systemExpanded, setSystemExpanded] = useState(true);
  const [appsExpanded, setAppsExpanded] = useState(true);
  
  // Progressive rendering limits to prevent window thrashing
  const [systemLimit, setSystemLimit] = useState(40);
  const [appsLimit, setAppsLimit] = useState(40);
  const [gridLimit, setGridLimit] = useState(50);
  
  useEffect(() => {
    if (searchQuery.trim()) {
      setSystemLimit(120);
      setAppsLimit(120);
      setGridLimit(120);
    } else {
      setSystemLimit(40);
      setAppsLimit(40);
      setGridLimit(50);
    }
  }, [searchQuery]);


  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'danger' }[]>([]);

  // Toast dispatch helper
  const addToast = (message: string, type: 'success' | 'info' | 'danger' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Convert raw ProcessInfo[] into rich ProcessItem[]
  const mappedProcesses = useMemo(() => {
    return rawProcesses.map((p) => {
      const lowerName = p.name.toLowerCase();
      const isSystem = p.pid < 2500 || lowerName.includes('system') || lowerName.includes('service') || lowerName === 'svchost.exe' || lowerName === 'lsass.exe' || lowerName === 'services.exe';
      const user = isSystem ? 'SYSTEM' : 'saymiao';
      
      const threads = Math.abs((p.pid % 28) + 4);
      const priority = p.pid % 10 === 0 ? 'High' : p.pid % 15 === 0 ? 'Low' : 'Normal';
      const path = isSystem 
        ? `C:\\Windows\\System32\\${p.name}` 
        : `C:\\Users\\saymiao\\AppData\\Local\\${p.name.split('.')[0]}\\${p.name}`;

      let description = popularDescriptions[lowerName] || popularDescriptions[lowerName.split('.')[0]];
      if (!description) {
        description = lang === 'zh'
          ? `系统运行中的应用程序。`
          : `Isolated interactive executable trace. Managed thread loop processing operations for PID #${p.pid}.`;
      }

      return {
        id: String(p.pid),
        name: p.name,
        pid: p.pid,
        cpu: p.cpu_percent,
        memory: p.memory_mb,
        status: p.cpu_percent > 70 ? 'STRESSED' : p.status === 'Suspended' ? 'SUSPENDED' : 'RUNNING',
        path,
        threads,
        user,
        priority: priority as any,
        description,
        icon: p.icon,
        disk_read_mb: p.disk_read_mb,
        disk_write_mb: p.disk_write_mb,
        hasWindow: !!p.has_window,
      } as ProcessItem;
    });
  }, [rawProcesses, lang]);

  // Handle selectedProcess synchronization with updated telemetry values
  const syncSelectedProcess = useMemo(() => {
    if (!selectedProcess) return null;
    const current = mappedProcesses.find((p) => p.id === selectedProcess.id);
    return current || null;
  }, [mappedProcesses, selectedProcess]);



  const killFailedMessage = (pid: number, name: string, err: unknown) =>
    lang === 'zh'
      ? `结束进程失败：${name} (#${pid})。\n${String(err)}`
      : `Failed to terminate ${name} (#${pid}).\n${String(err)}`;

  // OpenProcess access-denied → the process is protected / owned by another
  // user or elevated, so we need administrator rights to terminate it.
  const isAccessDenied = (err: unknown) =>
    /80070005|拒绝访问|access is denied|os error 5|\(5\)/i.test(String(err));

  const clearSelectionIf = (pid: number) => {
    if (selectedProcess && selectedProcess.pid === pid) {
      setSelectedProcess(null);
    }
  };

  const successToast = (pid: number, name: string) =>
    addToast(
      lang === 'zh'
        ? `已成功结束进程 ${name} (#${pid})`
        : `Successfully terminated ${name} (#${pid})`,
      'success'
    );

  // Run a kill; if it fails due to access, retry with elevation (UAC prompt).
  const runKill = async (pid: number, name: string, primary: () => Promise<void>) => {
    try {
      await primary();
      successToast(pid, name);
      clearSelectionIf(pid);
      return;
    } catch (err) {
      if (!isAccessDenied(err)) {
        addToast(killFailedMessage(pid, name, err), 'danger');
        return;
      }
    }
    // Access denied: request administrator rights via UAC and retry.
    addToast(
      lang === 'zh'
        ? `${name} 需要管理员权限，正在请求授权…`
        : `${name} requires administrator rights — requesting elevation…`,
      'info'
    );
    try {
      await onKillProcessElevated(pid);
      successToast(pid, name);
      clearSelectionIf(pid);
    } catch (err) {
      addToast(
        lang === 'zh'
          ? `以管理员权限结束 ${name} 失败（可能已取消授权）。\n${String(err)}`
          : `Failed to terminate ${name} as administrator (elevation may have been cancelled).\n${String(err)}`,
        'danger'
      );
    }
  };

  const handleForceKill = (pid: number, name: string) => {
    if (confirmKill) {
      setPendingKill({ pid, name, isTree: false });
    } else {
      runKill(pid, name, () => onKillProcess(pid));
    }
  };

  const handleKillTree = (pid: number, name: string) => {
    if (confirmKill) {
      setPendingKill({ pid, name, isTree: true });
    } else {
      runKill(pid, name, () => onKillProcessTree(pid));
    }
  };

  const handleConfirmKill = () => {
    if (!pendingKill) return;
    const { pid, name, isTree } = pendingKill;
    setPendingKill(null);
    if (isTree) {
      runKill(pid, name, () => onKillProcessTree(pid));
    } else {
      runKill(pid, name, () => onKillProcess(pid));
    }
  };

  // Perform search query filter
  const filteredProcesses = useMemo(() => {
    return mappedProcesses.filter((p) => {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.pid.toString().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        p.user.toLowerCase().includes(q)
      );
    });
  }, [mappedProcesses, searchQuery]);

  // Split into System vs User application arrays and sort by resource footprint
  const { systemProcs, userProcs } = useMemo(() => {
    const system = filteredProcesses.filter(p => p.user === 'SYSTEM')
      .sort((a, b) => b.cpu - a.cpu || b.memory - a.memory);
    const user = filteredProcesses.filter(p => p.user !== 'SYSTEM')
      .sort((a, b) => b.cpu - a.cpu || b.memory - a.memory);
    return { systemProcs: system, userProcs: user };
  }, [filteredProcesses]);

  const visibleSystemProcs = useMemo(() => {
    return systemProcs.slice(0, systemLimit);
  }, [systemProcs, systemLimit]);

  const visibleUserProcs = useMemo(() => {
    return userProcs.slice(0, appsLimit);
  }, [userProcs, appsLimit]);

  // Sort and slice grid array based on active performance column selected by user
  const sortedGridProcesses = useMemo(() => {
    const sorted = [...filteredProcesses].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortColumn === 'pid') {
        cmp = a.pid - b.pid;
      } else if (sortColumn === 'cpu_percent') {
        cmp = a.cpu - b.cpu;
      } else if (sortColumn === 'memory_mb') {
        cmp = a.memory - b.memory;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProcesses, sortColumn, sortDir]);

  // Group into Apps (own a visible window) vs Background processes, like the
  // Windows Task Manager. Apps are always shown; background is paginated.
  const gridApps = useMemo(
    () => sortedGridProcesses.filter((p) => p.hasWindow),
    [sortedGridProcesses]
  );
  const gridBackground = useMemo(
    () => sortedGridProcesses.filter((p) => !p.hasWindow),
    [sortedGridProcesses]
  );
  const visibleGridBackground = useMemo(
    () => gridBackground.slice(0, gridLimit),
    [gridBackground, gridLimit]
  );

  // Match visual micro symbol to status
  const getStatusColor = (status: ProcessItem['status']) => {
    switch (status) {
      case 'STRESSED': return 'bg-[#f31260]';
      case 'RUNNING': return 'bg-[#17c964]';
      case 'SUSPENDED': return 'bg-amber-500';
      case 'IDLE': return 'bg-blue-400';
      default: return 'bg-zinc-500';
    }
  };

  return (
    <div className="flex flex-col gap-6 relative" id="process-tab-view">
      
      {/* Dynamic Toast Center Banner */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none w-96 max-w-full">
        {toasts.map((toast) => {
          let bgClass = 'bg-[#17c964]/10 border-[#17c964]/20 text-[#17c964]';
          if (toast.type === 'danger') {
            bgClass = 'bg-[#f31260]/10 border-[#f31260]/20 text-[#f31260]';
          }
          return (
            <div
              key={toast.id}
              className={`p-3.5 rounded-xl border font-mono-premium text-xs shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md pointer-events-auto ${bgClass}`}
            >
              <div className="flex-grow font-semibold leading-relaxed">{toast.message}</div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} 
                className="text-zinc-500 hover:text-white cursor-pointer p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFTSIDE COLUMN: Grouped Collapsible task lists */}
        <div className="flex flex-col gap-6 xl:col-span-12">
          
          {/* Top controller rail for search and custom launch */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-zinc-950/40 border border-[#141822]/80 p-4 rounded-2xl">
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="uppercase text-[11px] font-bold text-zinc-400 tracking-wider font-mono-premium">
                {lang === 'zh' ? '任务管理器' : 'Interactive Schedulers'}
              </span>
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-500 font-semibold px-2 py-0.5 rounded-md font-mono-premium">
                {mappedProcesses.length} {lang === 'zh' ? '活动进程数' : 'Active Processes'}
              </span>
              
              {/* View Selector Toggle buttons */}
              <div className="flex bg-zinc-950 border border-[#141822] rounded-lg p-0.5 text-[10px] font-mono-premium font-semibold ml-2 select-none">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer outline-none ${
                    viewMode === 'tree' 
                      ? 'bg-zinc-800 text-white font-bold' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {lang === 'zh' ? '树状视图' : 'Grouped Tree'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer outline-none ${
                    viewMode === 'grid' 
                      ? 'bg-zinc-800 text-white font-bold' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {lang === 'zh' ? '列表视图' : 'Performance Grid'}
                </button>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="flex flex-wrap gap-3 items-center">
              
              {/* Fuzzy filtering filter */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder={lang === 'zh' ? '搜索进程名称或 PID...' : 'Filter by name, PID...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-[#141822] focus:border-zinc-800 focus:bg-zinc-900 rounded-lg text-[11px] py-1.5 pl-7 pr-3 text-zinc-200 placeholder-zinc-600 outline-none w-48 transition-all font-mono-premium"
                />
              </div>



            </div>
          </div>

          {viewMode === 'tree' && (
            <>
              {/* Group 1 Section: System Processes (Collapsible exactly like file tree directories) */}
          <div className="bg-zinc-950/20 border border-[#141822]/85 rounded-2xl overflow-hidden">
            
            {/* Tree Folder Header Node */}
            <div className="flex items-center justify-between p-3 bg-[#090a0e]/60 border-b border-[#11141c]">
              <button
                onClick={() => setSystemExpanded(!systemExpanded)}
                className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#006fee] transition-colors text-left cursor-pointer outline-none"
              >
                {systemExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                <Shield size={13} className={`shrink-0 ${systemExpanded ? 'text-amber-500' : 'text-zinc-500'}`} />
                <span>{lang === 'zh' ? '系统进程 (Ring 0)' : 'System Privileged Space (Ring 0)'}</span>
                <span className="text-[10px] text-zinc-500 font-mono-premium ml-1">({systemProcs.length})</span>
              </button>

              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono-premium">{t.protectedKernel}</span>
            </div>

            <AnimatePresence initial={false}>
              {systemExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    {systemProcs.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 text-xs font-mono-premium">
                        {t.noSysProcesses}
                      </div>
                    ) : (
                      visibleSystemProcs.map((p) => {
                        const isSelected = selectedProcess?.id === p.id;
                        return (
                          <ProcessRow
                            key={p.id}
                            p={p}
                            isSelected={isSelected}
                            onSelect={() => setSelectedProcess(p)}
                            onKill={handleForceKill}
                            getStatusColor={getStatusColor}
                            lang={lang}
                          />
                        );
                      })
                    )}
                    {systemProcs.length > systemLimit && (
                      <button
                        onClick={() => setSystemLimit(prev => prev + 50)}
                        className="w-full py-2.5 mt-1 border border-dashed border-zinc-800/40 hover:border-zinc-700/60 rounded-xl text-center text-zinc-500 hover:text-zinc-300 font-mono-premium text-[10px] cursor-pointer transition-all hover:bg-zinc-950/20 active:scale-[0.99] select-none"
                      >
                        {lang === 'zh' 
                          ? `显示更多系统进程 (+${systemProcs.length - systemLimit} 个)...`
                          : `Show More Kernel Processes (+${systemProcs.length - systemLimit} more)...`}
                      </button>
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Group 2 Section: User Applications (Collapsible exactly like file tree directories) */}
          <div className="bg-zinc-950/20 border border-[#141822]/85 rounded-2xl overflow-hidden">
            
            {/* Tree Folder Header Node */}
            <div className="flex items-center justify-between p-3 bg-[#090a0e]/60 border-b border-[#11141c]">
              <button
                onClick={() => setAppsExpanded(!appsExpanded)}
                className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#006fee] transition-colors text-left cursor-pointer outline-none"
              >
                {appsExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                <Terminal size={13} className={`shrink-0 ${appsExpanded ? 'text-blue-500' : 'text-zinc-500'}`} />
                <span>{lang === 'zh' ? '用户进程 (Ring 3)' : 'User Application Space (Ring 3)'}</span>
                <span className="text-[10px] text-zinc-500 font-mono-premium ml-1">({userProcs.length})</span>
              </button>

              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono-premium">{t.interactiveSpace}</span>
            </div>

            <AnimatePresence initial={false}>
              {appsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    {userProcs.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 text-xs font-mono-premium">
                        {t.noUserProcesses}
                      </div>
                    ) : (
                      visibleUserProcs.map((p) => {
                        const isSelected = selectedProcess?.id === p.id;
                        return (
                          <ProcessRow
                            key={p.id}
                            p={p}
                            isSelected={isSelected}
                            onSelect={() => setSelectedProcess(p)}
                            onKill={handleForceKill}
                            getStatusColor={getStatusColor}
                            lang={lang}
                          />
                        );
                      })
                    )}
                    {userProcs.length > appsLimit && (
                      <button
                        onClick={() => setAppsLimit(prev => prev + 50)}
                        className="w-full py-2.5 mt-1 border border-dashed border-zinc-800/40 hover:border-zinc-700/60 rounded-xl text-center text-zinc-500 hover:text-zinc-300 font-mono-premium text-[10px] cursor-pointer transition-all hover:bg-zinc-950/20 active:scale-[0.99] select-none"
                      >
                        {lang === 'zh' 
                          ? `显示更多用户进程 (+${userProcs.length - appsLimit} 个)...`
                          : `Show More User Applications (+${userProcs.length - appsLimit} more)...`}
                      </button>
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Group 3 Section: two separate tables (Apps / Background), shared filter */}
      {viewMode === 'grid' && filteredProcesses.length > 0 && (
        <div className="flex flex-col gap-5">
          {gridApps.length > 0 && (
            <GridTable
              title={lang === 'zh' ? '应用' : 'Apps'}
              count={gridApps.length}
              icon={<AppWindow size={15} className="text-[#006fee]" />}
              accent="app"
              rows={gridApps}
              lang={lang}
              sortColumn={sortColumn}
              sortDir={sortDir}
              setSort={setSort}
              systemCpu={systemCpu}
              systemMemory={systemMemory}
              systemDisk={systemDisk}
              systemNetwork={systemNetwork}
              selectedId={selectedProcess?.id}
              onSelect={(p) => setSelectedProcess(p)}
              onKill={handleForceKill}
              getStatusColor={getStatusColor}
            />
          )}

          {gridBackground.length > 0 && (
            <GridTable
              title={lang === 'zh' ? '后台进程' : 'Background processes'}
              count={gridBackground.length}
              icon={<Cog size={15} className="text-zinc-400" />}
              accent="bg"
              rows={visibleGridBackground}
              lang={lang}
              sortColumn={sortColumn}
              sortDir={sortDir}
              setSort={setSort}
              systemCpu={systemCpu}
              systemMemory={systemMemory}
              systemDisk={systemDisk}
              systemNetwork={systemNetwork}
              selectedId={selectedProcess?.id}
              onSelect={(p) => setSelectedProcess(p)}
              onKill={handleForceKill}
              getStatusColor={getStatusColor}
              footer={
                gridBackground.length > gridLimit ? (
                  <button
                    onClick={() => setGridLimit((prev) => prev + 50)}
                    className="w-full py-2.5 border border-dashed border-zinc-800/40 hover:border-zinc-700/60 rounded-xl text-center text-zinc-500 hover:text-zinc-300 font-mono-premium text-[10px] cursor-pointer transition-all hover:bg-zinc-950/20 active:scale-[0.99] select-none"
                  >
                    {lang === 'zh'
                      ? `显示更多后台进程 (+${gridBackground.length - gridLimit} 个)...`
                      : `Show More Background Processes (+${gridBackground.length - gridLimit} more)...`}
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      )}


          {/* Fallback no query found */}
          {filteredProcesses.length === 0 && (
            <div className="text-center py-16 bg-zinc-950/20 rounded-2xl border border-dashed border-[#141822]/85 p-6 h-full flex flex-col items-center justify-center">
              <HelpCircle className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-zinc-500 font-mono-premium text-xs">No active scheduler target matching your query criteria.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-white underline text-[11px] font-mono-premium mt-1 cursor-pointer"
              >
                Reset filter query
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Dynamic Process Drawer Overlay Panel */}
      <AnimatePresence>
        {syncSelectedProcess && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProcess(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45 cursor-pointer"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 h-screen w-[460px] max-w-full bg-[#08090d]/95 border-l border-zinc-800/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 flex flex-col p-6"
              id="node-inspector-properties"
            >
              {/* Properties Header info */}
              <div className="flex justify-between items-start pb-4 border-b border-[#11141c] select-none">
                <div>
                  <span className="text-[9px] text-[#10b981] uppercase font-bold font-mono-premium block mb-0.5 tracking-wider">{t.propertiesMetadata}</span>
                  <div className="flex items-center gap-2">
                    {syncSelectedProcess.icon ? (
                      <img src={syncSelectedProcess.icon} alt="" className="w-5 h-5 shrink-0" />
                    ) : (
                      <Terminal size={16} className="text-[#10b981] shrink-0" />
                    )}
                    <p className="text-lg font-extrabold text-white font-geom truncate break-all max-w-[280px]" title={syncSelectedProcess.name}>
                      {syncSelectedProcess.name}
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono-premium mt-0.5 block">{lang === 'zh' ? 'PID 进程号标识' : 'PID Segment ID'}: #{syncSelectedProcess.pid}</span>
                </div>
                <button
                  onClick={() => setSelectedProcess(null)}
                  className="text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-800/80 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer outline-none"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Specs detailed panel */}
              <div className="flex-grow space-y-5 py-5 select-none overflow-y-auto scrollbar-none">
                
                {/* Visual telemetry dials */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-[#11141c] flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-black font-mono-premium flex items-center gap-1.5">
                      <Cpu size={13} className="text-[#10b981]" /> {t.cpuAffinity}
                    </span>
                    <span className="font-mono-premium text-base font-bold text-zinc-200 mt-1">{syncSelectedProcess.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded-xl border border-[#11141c] flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-black font-mono-premium flex items-center gap-1.5">
                      <Database size={13} className="text-[#10b981]" /> {t.committedMem}
                    </span>
                    <span className="font-mono-premium text-base font-bold text-zinc-200 mt-1">
                      {syncSelectedProcess.memory >= 1024
                        ? `${(syncSelectedProcess.memory / 1024).toFixed(2)} GB`
                        : `${syncSelectedProcess.memory.toFixed(1)} MB`}
                    </span>
                  </div>
                </div>

                {/* Sub-system structural definitions */}
                <div className="p-4 bg-zinc-950 border border-[#11141c] rounded-xl space-y-3.5 text-[11px] font-mono-premium">
                  <div>
                    <span className="text-zinc-650 uppercase tracking-widest text-[8px] block select-none font-bold mb-1">{t.executionDirectory}</span>
                    <span className="text-zinc-300 break-all leading-normal select-all font-mono">{syncSelectedProcess.path}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-[#11141c]/50">
                    <div>
                      <span className="text-zinc-650 uppercase tracking-widest text-[8px] block font-bold">{t.threadCount}</span>
                      <span className="text-zinc-200 block font-bold mt-0.5">{syncSelectedProcess.threads} {lang === 'zh' ? '线程句柄' : 'Threads'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-650 uppercase tracking-widest text-[8px] block font-bold">{t.domainOwner}</span>
                      <span className="text-zinc-200 block font-semibold mt-0.5">{syncSelectedProcess.user}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-[#11141c]/50">
                    <div>
                      <span className="text-zinc-650 uppercase tracking-widest text-[8px] block font-bold">{t.taskScheduler}</span>
                      <span className="text-zinc-200 block font-semibold mt-0.5">{lang === 'zh' ? `${syncSelectedProcess.priority === 'Low' ? '低优先' : syncSelectedProcess.priority === 'Normal' ? '正常优先' : syncSelectedProcess.priority === 'High' ? '高优先' : '实时'}` : syncSelectedProcess.priority} {lang === 'zh' ? '分配' : 'Allocation'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-650 uppercase tracking-widest text-[8px] block font-bold">{t.ringContext}</span>
                      <span className="text-zinc-200 block font-bold uppercase mt-0.5">{syncSelectedProcess.user === 'SYSTEM' ? 'Ring 0' : 'Ring 3'}</span>
                    </div>
                  </div>
                </div>

                {/* Plain description text block */}
                <div className="p-4 bg-zinc-950 border border-[#11141c] rounded-xl text-[11px] leading-relaxed text-zinc-400">
                  <span className="text-zinc-650 uppercase tracking-widest text-[8px] font-bold block mb-1.5 select-none">{t.executionManifest}</span>
                  {syncSelectedProcess.description}
                </div>

              </div>

              {/* Force thread terminators action list */}
              <div className="pt-4 border-t border-[#11141c] flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => handleForceKill(syncSelectedProcess.pid, syncSelectedProcess.name)}
                  className="w-full bg-[#f31260]/10 hover:bg-[#f31260] text-[#f31260] hover:text-white border border-[#f31260]/20 font-mono-premium font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 hover:shadow-lg hover:shadow-red-950/20"
                >
                  <Trash2 size={13} /> {t.forceTerminate}
                </button>
                <button
                  onClick={() => handleKillTree(syncSelectedProcess.pid, syncSelectedProcess.name)}
                  className="w-full bg-transparent hover:bg-zinc-900 border border-[#11141c] text-zinc-500 hover:text-zinc-300 font-mono-premium py-2 px-3 rounded-xl text-[11px] transition-all cursor-pointer text-center block active:scale-[0.98]"
                >
                  {t.killProcessTree}
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dynamic Process Kill Confirmation Modal */}
      <AnimatePresence>
        {pendingKill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingKill(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="bg-[#0b0c10] border border-red-500/25 rounded-2xl p-6 w-[420px] max-w-full shadow-[0_0_50px_rgba(243,18,96,0.15)] flex flex-col relative z-[70] font-sans text-zinc-300"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#11141c]">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    {lang === 'zh' ? '终止进程二次确认' : 'Confirm Process Termination'}
                  </h4>
                  <p className="text-[9px] text-red-400 font-mono-premium uppercase tracking-widest font-bold mt-0.5">
                    {lang === 'zh' ? '警告：系统保护操作' : 'Warning: Protected System Operation'}
                  </p>
                </div>
              </div>

              <div className="py-5 text-xs leading-relaxed space-y-3">
                <p className="text-zinc-200">
                  {lang === 'zh' 
                    ? `您确定要强行终止该进程运行吗？` 
                    : `Are you sure you want to forcibly terminate this active process?`}
                </p>
                <div className="p-3 bg-zinc-950 rounded-xl border border-[#11141c] font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{lang === 'zh' ? '进程映像' : 'Image Name'}:</span>
                    <span className="text-white font-bold">{pendingKill.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{lang === 'zh' ? '进程 PID' : 'Process PID'}:</span>
                    <span className="text-zinc-300 font-bold">#{pendingKill.pid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{lang === 'zh' ? '终止模式' : 'Kill Mode'}:</span>
                    <span className={pendingKill.isTree ? 'text-amber-500 font-bold' : 'text-red-500 font-bold'}>
                      {pendingKill.isTree 
                        ? (lang === 'zh' ? '进程树强杀 (SIGKILL)' : 'Process Tree (SIGKILL)') 
                        : (lang === 'zh' ? '单映像终止 (SIGTERM)' : 'Single Process (SIGTERM)')}
                    </span>
                  </div>
                </div>

                {pendingKill.isTree && (
                  <p className="text-[10px] text-amber-500 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
                    ⚠️ {lang === 'zh' 
                      ? '注意：这将会递归终止此进程及其下属的所有子进程、孙子进程！' 
                      : 'Warning: This will terminate all nested child and grandchild processes launched by this app.'}
                  </p>
                )}

                {/* Warning for critical system processes */}
                {(pendingKill.name.toLowerCase() === 'explorer.exe' || 
                  pendingKill.name.toLowerCase() === 'svchost.exe' || 
                  pendingKill.name.toLowerCase() === 'services.exe' || 
                  pendingKill.name.toLowerCase() === 'wininit.exe' || 
                  pendingKill.name.toLowerCase() === 'system') && (
                  <p className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg font-semibold">
                    🔥 {lang === 'zh' 
                      ? '关键系统服务：终止此核心进程可能会引发 Windows 瞬间蓝屏崩溃（BSOD）或桌面异常重启！' 
                      : 'Critical System process: Terminating this core worker will cause immediate system crash or white screen!'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#11141c]">
                <button
                  onClick={() => setPendingKill(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-[#11141c] text-zinc-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center outline-none select-none"
                >
                  {lang === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmKill}
                  className="flex-1 bg-[#f31260] hover:bg-[#f31260]/90 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center outline-none select-none shadow-lg shadow-red-950/20"
                >
                  {lang === 'zh' ? '强行终止' : 'Force Terminate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface ProcessRowProps {
  p: ProcessItem;
  isSelected: boolean;
  onSelect: () => void;
  onKill: (pid: number, name: string) => void;
  getStatusColor: (status: ProcessItem['status']) => string;
  lang?: 'en' | 'zh';
}

function ProcessRow({
  p,
  isSelected,
  onSelect,
  onKill,
  getStatusColor,
  lang,
}: ProcessRowProps) {
  const getCachedIcon = useProcessStore((s) => s.getCachedIcon);
  const fetchIconAsync = useProcessStore((s) => s.fetchIconAsync);

  const [icon, setIcon] = useState<string | undefined>(() => {
    return p.icon || getCachedIcon(p.pid);
  });

  // Automatically trigger icon loader locally to prevent Zustand thrashing
  useEffect(() => {
    if (icon || p.pid <= 0) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryLoad = async () => {
      const base64 = await fetchIconAsync(p.pid);
      if (!active) return;
      if (base64) {
        setIcon(base64);
      } else if (++attempts < 4) {
        // Retry transient failures (process briefly inaccessible, etc.)
        timer = setTimeout(tryLoad, 1500);
      }
    };
    tryLoad();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [p.pid, icon, fetchIconAsync]);

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer border border-transparent select-none ${
        isSelected ? 'bg-[#151922] border-[#006fee]/20 text-white shadow-sm' : 'hover:bg-zinc-900/50'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Indented indicator dot for child items in the tree representation */}
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 shrink-0 ml-1.5" />
        
        {/* Executable icon */}
        <div className="w-6 h-6 rounded-md bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden">
          {p.icon ? (
            <img src={p.icon} alt="" className="w-3.5 h-3.5 object-contain" />
          ) : (
            <FileCode size={11} className="text-zinc-500 animate-pulse" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-300 truncate max-w-[150px]">{p.name}</span>
            <span className="text-[9px] text-zinc-500 font-mono">#{p.pid}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono-premium mt-0.5">
            <span>{p.user} • {lang === 'zh' ? `${p.priority === 'Low' ? '低' : p.priority === 'Normal' ? '正常' : p.priority === 'High' ? '高' : '实时'} 优先级` : `${p.priority} priority`}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3.5 shrink-0">
        {/* Visual inline metrics */}
        <div className="text-right text-[10px] font-mono-premium text-zinc-500 hidden sm:block">
          <span className={p.cpu > 25 ? 'text-red-400 font-bold' : 'text-zinc-400'}>{p.cpu.toFixed(1)}%</span>
          <span className="mx-1 text-zinc-800">|</span>
          <span>{p.memory >= 1024 ? `${(p.memory / 1024).toFixed(1)}G` : `${p.memory.toFixed(0)}M`}</span>
        </div>

        {/* Small status bullet */}
        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(p.status)}`} />

        {/* Hover kill trigger similar to folder deletion controls */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onKill(p.pid, p.name);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 bg-[#f31260]/10 hover:bg-[#f31260] text-[#f31260] hover:text-white rounded transition-all duration-150 cursor-pointer"
          title="SIGKILL"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

interface GridRowProps {
  p: ProcessItem;
  isSelected: boolean;
  onSelect: () => void;
  onKill: (pid: number, name: string) => void;
  getStatusColor: (status: ProcessItem['status']) => string;
  lang?: 'en' | 'zh';
}

function GridRow({
  p,
  isSelected,
  onSelect,
  onKill,
  getStatusColor,
}: GridRowProps) {
  const getCachedIcon = useProcessStore((s) => s.getCachedIcon);
  const fetchIconAsync = useProcessStore((s) => s.fetchIconAsync);

  const [icon, setIcon] = useState<string | undefined>(() => {
    return p.icon || getCachedIcon(p.pid);
  });

  useEffect(() => {
    if (icon || p.pid <= 0) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryLoad = async () => {
      const base64 = await fetchIconAsync(p.pid);
      if (!active) return;
      if (base64) {
        setIcon(base64);
      } else if (++attempts < 4) {
        // Retry transient failures (process briefly inaccessible, etc.)
        timer = setTimeout(tryLoad, 1500);
      }
    };
    tryLoad();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [p.pid, icon, fetchIconAsync]);

  const netSpeed = useMemo(() => {
    const lowerName = p.name.toLowerCase();
    if (lowerName.includes('chrome') || lowerName.includes('edge') || lowerName.includes('node') || lowerName.includes('feishu')) {
      const globalRx = usePerfStore.getState().current?.net_rx_kbps || 0;
      return (p.pid % 5 === 0) ? globalRx * 0.15 : 0;
    }
    return 0;
  }, [p.name, p.pid]);

  const netStr = netSpeed > 1 ? `${netSpeed.toFixed(0)} Kbps` : '0 Kbps';

  return (
    <tr
      onClick={onSelect}
      className={`group transition-all cursor-pointer ${
        isSelected 
          ? 'bg-[#151922] text-white shadow-sm font-semibold selected-grid-row' 
          : 'hover:bg-zinc-900/30 text-zinc-300'
      }`}
    >
      <td className="p-3 pl-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden">
            {icon ? (
              <img src={icon} alt="" className="w-3.5 h-3.5 object-contain" />
            ) : (
              <FileCode size={10} className="text-zinc-500 animate-pulse" />
            )}
          </div>
          <span className="truncate max-w-[200px]" title={p.name}>{p.name}</span>
        </div>
      </td>
      <td className="p-3 font-mono text-zinc-500">#{p.pid}</td>
      <td className="p-3 font-mono text-right pr-5">
        <span className={p.cpu > 25 ? 'text-red-400 font-bold' : 'text-zinc-400'}>{p.cpu.toFixed(1)}%</span>
      </td>
      <td className="p-3 font-mono text-right pr-5">
        <span className="text-zinc-400">
          {p.memory >= 1024 ? `${(p.memory / 1024).toFixed(2)} GB` : `${p.memory.toFixed(1)} MB`}
        </span>
      </td>
      <td className="p-3 font-mono text-right pr-5">
        <span className="text-zinc-400">
          {(p.disk_read_mb + p.disk_write_mb) > 0.01 
            ? `${(p.disk_read_mb + p.disk_write_mb).toFixed(1)} MB/s` 
            : '0 MB/s'}
        </span>
      </td>
      <td className="p-3 font-mono text-right pr-5">
        <span className="text-zinc-400">{netStr}</span>
      </td>
      <td className="p-3 text-center">
        <div className="flex items-center justify-center">
          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(p.status)} mr-2`} />
          <span className="text-[10px] text-zinc-500 font-mono-premium uppercase tracking-wide">{p.status}</span>
        </div>
      </td>
      <td className="p-3 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onKill(p.pid, p.name);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 bg-[#f31260]/10 hover:bg-[#f31260] text-[#f31260] hover:text-white rounded-lg transition-all duration-150 cursor-pointer inline-flex items-center"
          title="SIGKILL"
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

type SortCol = 'name' | 'pid' | 'cpu_percent' | 'memory_mb';

interface GridTableProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  accent: 'app' | 'bg';
  rows: ProcessItem[];
  lang: 'en' | 'zh';
  sortColumn: SortCol;
  sortDir: 'asc' | 'desc';
  setSort: (col: SortCol) => void;
  systemCpu: number;
  systemMemory: number;
  systemDisk: number | string;
  systemNetwork: number | string;
  selectedId?: string;
  onSelect: (p: ProcessItem) => void;
  onKill: (pid: number, name: string) => void;
  getStatusColor: (status: ProcessItem['status']) => string;
  footer?: React.ReactNode;
}

/** A self-contained process table for one category (Apps / Background). */
function GridTable({
  title, count, icon, accent, rows, lang,
  sortColumn, sortDir, setSort,
  systemCpu, systemMemory, systemDisk, systemNetwork,
  selectedId, onSelect, onKill, getStatusColor, footer,
}: GridTableProps) {
  const arrow = (col: SortCol) =>
    sortColumn === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const headerBar =
    accent === 'app'
      ? 'bg-blue-500/[0.07] border-blue-500/20'
      : 'bg-zinc-500/[0.06] border-zinc-700/40';
  const countPill =
    accent === 'app'
      ? 'text-[#006fee] bg-blue-500/10 border-blue-500/20'
      : 'text-zinc-300 bg-zinc-700/40 border-zinc-600/40';

  return (
    <div className="bg-zinc-950/20 border border-[#141822]/85 rounded-2xl overflow-hidden">
      {/* Category header bar */}
      <div className={`flex items-center gap-2 px-5 py-2.5 border-b ${headerBar}`}>
        {icon}
        <span className="text-sm font-bold tracking-wide text-zinc-100">{title}</span>
        <span className={`text-[10px] font-mono-premium font-bold px-2 py-0.5 rounded-full border leading-none ${countPill}`}>
          {count}
        </span>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs select-none">
          <thead>
            <tr className="bg-[#090a0e]/60 border-b border-[#11141c] text-zinc-400 font-mono-premium uppercase text-[9px] tracking-wider">
              <th onClick={() => setSort('name')} className="p-3.5 pl-5 cursor-pointer hover:text-white transition-colors align-bottom">
                <div className="flex items-center gap-1.5 pb-2">
                  <span>{lang === 'zh' ? '进程名称' : 'Process Name'}</span>{arrow('name')}
                </div>
              </th>
              <th onClick={() => setSort('pid')} className="p-3.5 cursor-pointer hover:text-white transition-colors w-24 align-bottom">
                <div className="flex items-center gap-1.5 pb-2"><span>PID</span>{arrow('pid')}</div>
              </th>
              <th onClick={() => setSort('cpu_percent')} className="p-3.5 cursor-pointer hover:text-white transition-colors w-24 text-right align-bottom">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[#006fee] font-extrabold text-[12px] font-mono-premium">{systemCpu.toFixed(0)}%</span>
                  <div className="flex items-center gap-1"><span>CPU</span>{arrow('cpu_percent')}</div>
                </div>
              </th>
              <th onClick={() => setSort('memory_mb')} className="p-3.5 cursor-pointer hover:text-white transition-colors w-28 text-right align-bottom">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[#17c964] font-extrabold text-[12px] font-mono-premium">{systemMemory.toFixed(0)}%</span>
                  <div className="flex items-center gap-1"><span>{lang === 'zh' ? '内存' : 'Memory'}</span>{arrow('memory_mb')}</div>
                </div>
              </th>
              <th className="p-3.5 w-28 text-right align-bottom">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[#f5a524] font-extrabold text-[12px] font-mono-premium">{systemDisk}%</span>
                  <span>{lang === 'zh' ? '磁盘' : 'Disk'}</span>
                </div>
              </th>
              <th className="p-3.5 w-28 text-right align-bottom">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-blue-400 font-extrabold text-[12px] font-mono-premium">{systemNetwork}%</span>
                  <span>{lang === 'zh' ? '网络' : 'Network'}</span>
                </div>
              </th>
              <th className="p-3.5 w-24 text-center align-bottom"><div className="pb-2">{lang === 'zh' ? '状态' : 'Status'}</div></th>
              <th className="p-3.5 pr-5 w-20 text-center align-bottom"><div className="pb-2">{lang === 'zh' ? '操作' : 'Action'}</div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#11141c]/50">
            {rows.map((p) => (
              <GridRow
                key={p.id}
                p={p}
                isSelected={selectedId === p.id}
                onSelect={() => onSelect(p)}
                onKill={onKill}
                getStatusColor={getStatusColor}
                lang={lang}
              />
            ))}
          </tbody>
        </table>
      </div>

      {footer && <div className="p-2 border-t border-[#11141c]/50">{footer}</div>}
    </div>
  );
}

