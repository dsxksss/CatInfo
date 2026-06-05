import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Terminal, Network, Settings as SettingsIcon, 
  Sun, Moon, LayoutDashboard,
  Minus, Square, X
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Telemetry custom hooks and stores
import { useSystemStats } from './hooks/useSystemStats';
import { usePerfStore } from './stores/perfStore';
import { useProcessStore } from './stores/processStore';

// Bilingual translations
import { translations } from './lib/translations';

// Dashboard component tabs
import DashboardTab from './components/DashboardTab';
import PerformanceTab from './components/PerformanceTab';
import ProcessTab from './components/ProcessTab';
import NetworkTab from './components/NetworkTab';
import SettingsTab from './components/SettingsTab';
import NavParticleBurst from './components/NavParticleBurst';
import { playJellyPop } from './utils/sound';

export default function App() {
  // Launch Rust background telemetry collector
  useSystemStats();

  // Native window handler using Tauri v2 window APIs
  const appWindow = useMemo(() => getCurrentWindow(), []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  const handleMaximize = async () => {
    try {
      const isMax = await appWindow.isMaximized();
      if (isMax) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'performance' | 'processes' | 'network' | 'settings'>('dashboard');

  // Bilingual Language State
  const [lang, setLang] = useState<'en' | 'zh'>(() => {
    return (localStorage.getItem('wincat-lang') as 'en' | 'zh') || 'zh';
  });

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'zh' : 'en';
    setLang(nextLang);
    localStorage.setItem('wincat-lang', nextLang);
  };

  const t = translations[lang];

  // Main UI Theme State (Light/Dark supports with Telegram styling)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('wincat-theme') as 'dark' | 'light') || 'dark';
  });

  // Main Polling Interval (visual rate, in ms)
  const [pollingInterval, setPollingInterval] = useState(1000);

  // Confirm process kill toggle
  const [confirmKill, setConfirmKill] = useState<boolean>(() => {
    return localStorage.getItem('wincat-confirm-kill') !== 'false';
  });

  const handleSetConfirmKill = (val: boolean) => {
    setConfirmKill(val);
    localStorage.setItem('wincat-confirm-kill', String(val));
  };

  // Synchronize polling interval with Rust backend collector thread
  useEffect(() => {
    const syncInterval = async () => {
      try {
        await invoke('set_process_refresh_interval', { ms: pollingInterval });
      } catch (err) {
        console.error("Failed to sync polling interval with backend:", err);
      }
    };
    syncInterval();
  }, [pollingInterval]);


  // Network local latency (heartbeat fluctuation simulated)
  const [heartbeatLatency, setHeartbeatLatency] = useState(14);

  // Pull telemetry variables from Zustand store
  const currentStats = usePerfStore((s) => s.current);
  const perfHistory = usePerfStore((s) => s.history);
  
  const rawProcesses = useProcessStore((s) => s.processes);
  const loadIconForPid = useProcessStore((s) => s.loadIconForPid);

  // Sync theme with HTML class attribute
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Sync the native window title with the current language.
  useEffect(() => {
    getCurrentWindow()
      .setTitle(lang === 'zh' ? '喵一眼' : 'Cat Info')
      .catch(() => {});
  }, [lang]);

  // Telegram-style view transition with circular expand masking
  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    const doc = document as any;
    const root = document.documentElement;

    const applyTheme = () => {
      setTheme(nextTheme);
      localStorage.setItem('wincat-theme', nextTheme);
    };

    // Suppress every element-level color/background transition during the swap so
    // the whole UI recolors as one unit — otherwise each component eases at its
    // own duration and the theme change looks ragged. The circular view-transition
    // reveal remains the single, unified animation.
    root.classList.add('theme-switching');

    if (!doc.startViewTransition) {
      applyTheme();
      // Re-enable transitions once the instant recolor has painted.
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
      return;
    }

    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(applyTheme);

    transition.finished.finally(() => root.classList.remove('theme-switching'));

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  // Heartbeat Latency Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeatLatency((prev) => {
        const drift = Math.random() > 0.5 ? 1 : -1;
        return Math.max(10, Math.min(22, prev + drift));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // System Stats mapping
  const cpuUsage = useMemo(() => {
    return currentStats?.cpu_usage || 0;
  }, [currentStats]);

  const memoryUsage = useMemo(() => {
    return currentStats?.memory_percent || 0;
  }, [currentStats]);

  const diskUsage = useMemo(() => {
    const raw = (currentStats?.disk_read_kbps || 0) + (currentStats?.disk_write_kbps || 0);
    return raw / 1024; // Convert to MB/s
  }, [currentStats]);

  const networkUsage = useMemo(() => {
    return (currentStats?.net_rx_kbps || 0) + (currentStats?.net_tx_kbps || 0);
  }, [currentStats]);

  const gpuUsage = useMemo(() => {
    return (currentStats?.gpus || []).reduce((max, g) => Math.max(max, g.utilization), 0);
  }, [currentStats]);

  const cpuFreq = currentStats?.cpu_freq || 0;
  const memoryTotalGb = currentStats?.memory_total_gb || 16.0;

  // Real-time History mapping
  const cpuHistory = useMemo(() => {
    const raw = [...perfHistory.cpu];
    while (raw.length < 25) raw.unshift(0);
    return raw;
  }, [perfHistory.cpu]);

  const memoryHistory = useMemo(() => {
    const raw = [...perfHistory.memory];
    while (raw.length < 25) raw.unshift(0);
    return raw;
  }, [perfHistory.memory]);

  const diskHistory = useMemo(() => {
    const read = perfHistory.disk_read;
    const write = perfHistory.disk_write;
    const raw = read.map((val, idx) => (val + (write[idx] || 0)) / 1024);
    while (raw.length < 25) raw.unshift(0);
    return raw;
  }, [perfHistory.disk_read, perfHistory.disk_write]);

  const networkHistory = useMemo(() => {
    const rx = perfHistory.net_rx;
    const tx = perfHistory.net_tx;
    const raw = rx.map((val, idx) => val + (tx[idx] || 0));
    while (raw.length < 25) raw.unshift(0);
    return raw;
  }, [perfHistory.net_rx, perfHistory.net_tx]);

  const gpuHistory = useMemo(() => {
    const raw = [...perfHistory.gpu];
    while (raw.length < 25) raw.unshift(0);
    return raw;
  }, [perfHistory.gpu]);

  const coresUsage = useMemo(() => {
    const raw = currentStats?.cpu_per_core || [];
    if (raw.length === 0) return Array(16).fill(0).map(() => 5 + Math.random() * 8);
    return raw;
  }, [currentStats?.cpu_per_core]);

  // Processes lists
  const processes = useMemo(() => {
    return [...rawProcesses];
  }, [rawProcesses]);

  // Let errors propagate so the caller can show a real success/failure toast.
  const handleKillProcess = async (pid: number) => {
    await invoke('kill_process', { pid });
  };

  const handleKillProcessTree = async (pid: number) => {
    await invoke('kill_process_tree', { pid });
  };

  // Re-runs the kill as administrator (taskkill via UAC "runas").
  const handleKillProcessElevated = async (pid: number) => {
    await invoke('kill_process_elevated', { pid });
  };




  const uptimeDays = Math.floor((currentStats?.uptime_secs || 388000) / 86400);
  const uptimeHours = Math.floor(((currentStats?.uptime_secs || 388000) % 86400) / 3600);
  const uptimeMinutes = Math.floor(((currentStats?.uptime_secs || 388000) % 3600) / 60);

  const padZero = (num: number) => num.toString().padStart(2, '0');

  // Sidebar navigation entries (drives the animated menu map)
  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: lang === 'zh' ? '总览' : 'Overview' },
    { id: 'performance' as const, icon: Activity, label: t.telemetryChart },
    { id: 'processes' as const, icon: Terminal, label: t.processesList },
    { id: 'network' as const, icon: Network, label: lang === 'zh' ? '网络' : 'Network interface' },
    { id: 'settings' as const, icon: SettingsIcon, label: lang === 'zh' ? '设置' : 'Diagnostics panel' },
  ];

  const getStressColorClass = (usage: number, active: boolean) => {
    if (active) {
      // Keep the load color identity on the active pill, but always use white
      // text so it stays crisp on the colored fills (the old light-tinted text
      // turned muddy over the emerald pill).
      if (usage >= 80) return 'bg-red-500/90 text-white border-red-400/50';
      if (usage >= 50) return 'bg-amber-500/90 text-white border-amber-400/50';
      return 'bg-white/20 text-white border-white/30';
    } else {
      if (usage >= 80) return 'bg-red-500/10 text-red-400 border-red-500/20';
      if (usage >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="w-screen h-screen bg-[#0b0c10] dark:bg-[#08090d] text-zinc-300 font-sans flex overflow-hidden relative select-none antialiased">

      {/* Premium floating glass-scene background blurs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-600/8 blur-[130px] pointer-events-none animate-pulse duration-[10000ms]"></div>
      <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-blue-500/15 dark:bg-blue-600/8 blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[30%] left-[25%] w-[400px] h-[400px] rounded-full bg-[#10b981]/5 dark:bg-[#10b981]/3 blur-[110px] pointer-events-none"></div>

      {/* LEFT COMPACT SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 bg-[#08090d] border-r border-[#11141c] flex flex-col justify-between shrink-0 hidden md:flex z-10" id="left-synapse-sidebar">
        
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Header / Brand Title block */}
            <div className="p-5 flex items-center justify-between border-b border-[#11141c]" data-tauri-drag-region>
              <div className="flex items-center gap-2.5" data-tauri-drag-region>
                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-transparent logo-container-wrapper" data-tauri-drag-region>
                  <img src="/logo.png?v=3" className="w-full h-full object-contain p-0.5" data-tauri-drag-region alt="Logo" />
                </div>
                <div data-tauri-drag-region>
                  <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1" data-tauri-drag-region>
                    {lang === 'zh' ? '喵一眼' : 'Cat Info'}
                    <span className="text-[9px] px-1.5 py-0.5 font-mono rounded-md version-badge inline-flex items-center" data-tauri-drag-region>v1.4.0</span>
                  </h1>
                </div>
              </div>

              {/* Network Latency pin */}
              <div className="flex items-center gap-1 bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold select-none">
                <span className="w-1 h-1 rounded-full bg-[#10b981] animate-pulse" />
                <span>{heartbeatLatency}ms</span>
              </div>
            </div>

              {/* Folder section views */}
              <div className="p-4 space-y-1.5">
                <div className="px-3 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono-premium">{t.views}</span>
                </div>

                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => { playJellyPop(); setActiveTab(item.id); }}
                        whileHover={isActive ? { scale: 1.02 } : { x: 4, scale: 1.01 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 20, mass: 0.6 }}
                        className={`group relative w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer text-xs ${
                          isActive ? 'text-white font-bold nav-active-content' : 'text-zinc-400 hover:text-[#10b981]'
                        }`}
                      >
                        {/* Shared sliding highlight — slams between tabs with a slight overshoot */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNavPill"
                            className="absolute inset-0 rounded-xl bg-[#10b981] shadow-[0_8px_20px_rgba(16,185,129,0.25)] border border-[#10b981]/25"
                            transition={{ type: 'spring', stiffness: 600, damping: 22, mass: 0.8 }}
                          />
                        )}

                        {/* Particle-collision burst on landing */}
                        {isActive && <NavParticleBurst trigger={item.id} />}

                        {/* Travelling accent bar on the left edge of the active pill */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNavBar"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                          />
                        )}

                        {/* Soft hover wash for inactive items */}
                        {!isActive && (
                          <span className="absolute inset-0 rounded-xl bg-[#10b981]/0 group-hover:bg-[#10b981]/8 transition-colors duration-300" />
                        )}

                        <div className="relative z-10 flex items-center gap-2.5">
                          <motion.span
                            className="inline-flex"
                            animate={isActive
                              ? { scale: 1.18, rotate: [0, -22, 18, -12, 7, 0], x: [0, -2, 2, -1, 0] }
                              : { scale: 1, rotate: 0, x: 0 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          >
                            <Icon size={14} className={isActive ? 'text-white' : 'text-zinc-500 group-hover:text-[#10b981]'} />
                          </motion.span>
                          <span>{item.label}</span>
                        </div>

                        {/* Right-side live badges */}
                        {item.id === 'performance' && (
                          <span className={`relative z-10 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border transition-all ${
                            getStressColorClass(cpuUsage, isActive)
                          }`}>
                            {cpuUsage.toFixed(0)}%
                          </span>
                        )}
                        {item.id === 'processes' && (
                          <span className={`relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-white/25 text-white' : 'bg-[#10b981]/15 text-[#10b981]'
                          }`}>
                            {processes.length}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>


          </div>

        </aside>

        {/* RIGHT SIDE MAIN DASHBOARD FRAME */}
        <main className="flex-1 bg-[#0b0c10]/40 backdrop-blur-md flex flex-col min-w-0 z-10" id="main-content-panel">
          
          {/* TOP BAR BAR FOR MAIN WORKSPACE (Breadcrumbs + Actions) */}
          <div className="h-16 border-b border-[#11141c] px-4 md:px-8 flex items-center justify-between gap-4 select-none shrink-0" id="main-top-navbar" data-tauri-drag-region>
            
            {/* Breadcrumb Workspace string */}
            <div className="flex items-center gap-3 min-w-0" data-tauri-drag-region>
              <span className="text-sm font-bold text-white tracking-tight whitespace-nowrap" data-tauri-drag-region>
                {lang === 'zh' ? '喵一眼 · 系统状态监控' : 'Cat Info System Telemetry'}
              </span>
              <span className="text-zinc-800 hidden md:inline" data-tauri-drag-region>/</span>
              <div className="flex items-center gap-2 text-zinc-500 text-xs truncate" data-tauri-drag-region>
                <span className="font-semibold block truncate" data-tauri-drag-region>{t.systemBridge}</span>
              </div>
            </div>

            {/* Quick Micro Controls + Filters */}
            <div className="flex items-center gap-3">
              
              {/* Live Telemetry status details embedded in top bar */}
              <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono-premium text-zinc-500 mr-2 border-r border-[#11141c]/60 pr-4">
                <span>
                  {t.uptime}: {uptimeDays}d {padZero(uptimeHours)}h {padZero(uptimeMinutes)}m
                </span>
              </div>

              {/* Bilingual Language Switcher */}
              <button
                onClick={toggleLanguage}
                className="h-8 px-2.5 rounded-xl bg-zinc-950/80 border border-[#141822] hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-all cursor-pointer select-none outline-none active:scale-95 shrink-0 font-bold text-[10px] tracking-wide"
                title={lang === 'zh' ? 'Switch to English' : '切换到中文模式'}
                id="wincat-language-toggle"
              >
                <span>{lang === 'zh' ? 'EN' : '中文'}</span>
              </button>

              {/* Visual Theme Toggle Switcher */}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-xl bg-zinc-950/80 border border-[#141822] hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer select-none outline-none active:scale-95 shrink-0"
                title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
                id="wincat-theme-toggle"
              >
                {theme === 'light' ? (
                  <Moon size={14} className="text-[#006fee]" />
                ) : (
                  <Sun size={14} className="text-amber-400 animate-[spin_16s_linear_infinite]" />
                )}
              </button>



              {/* Window Controls */}
              <div className="flex items-center gap-1 border-l border-[#11141c]/60 pl-3 ml-1 shrink-0">
                {/* Minimize Button */}
                <button
                  onClick={handleMinimize}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
                  title={lang === 'zh' ? '最小化' : 'Minimize'}
                >
                  <Minus size={13} />
                </button>
                {/* Maximize Button */}
                <button
                  onClick={handleMaximize}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
                  title={lang === 'zh' ? '最大化' : 'Maximize'}
                >
                  <Square size={11} />
                </button>
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-zinc-400 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
                  title={lang === 'zh' ? '关闭' : 'Close'}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN PAGE BODY (Interactive viewport) */}
          {/* overflow-anchor:none — the process list re-sorts every tick; without this,
              the browser's scroll anchoring snaps back to the top when the anchored row
              gets reordered/removed while scrolled to the bottom. */}
          <div className="flex-grow p-4 md:p-8 overflow-y-auto [overflow-anchor:none]" id="dashboard-viewport">
            
            {/* Render view contents */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full"
              >
                {activeTab === 'dashboard' && (
                  <DashboardTab
                    cpuUsage={cpuUsage}
                    memoryUsage={memoryUsage}
                    diskUsage={diskUsage}
                    networkUsage={networkUsage}
                    processesCount={processes.length}
                    lang={lang}
                  />
                )}
                {activeTab === 'performance' && (
                  <PerformanceTab
                    cpuUsage={cpuUsage}
                    cpuHistoryCount={cpuHistory}
                    memoryUsage={memoryUsage}
                    memoryHistoryCount={memoryHistory}
                    diskUsage={diskUsage}
                    diskHistoryCount={diskHistory}
                    networkUsage={networkUsage}
                    networkHistoryCount={networkHistory}
                    gpuUsage={gpuUsage}
                    gpuHistoryCount={gpuHistory}
                    coresUsage={coresUsage}
                    processesCount={processes.length}
                    lang={lang}
                    cpuFreq={cpuFreq}
                    memoryTotalGb={memoryTotalGb}
                    pollingInterval={pollingInterval}
                  />
                )}
                {activeTab === 'processes' && (
                  <ProcessTab
                    processes={processes}
                    onKillProcess={handleKillProcess}
                    onKillProcessTree={handleKillProcessTree}
                    onKillProcessElevated={handleKillProcessElevated}
                    lang={lang}
                    loadIconForPid={loadIconForPid}
                    confirmKill={confirmKill}
                  />
                )}
                {activeTab === 'network' && (
                  <NetworkTab
                    lang={lang}
                    netRxKbps={currentStats?.net_rx_kbps}
                    netTxKbps={currentStats?.net_tx_kbps}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsTab
                    pollingInterval={pollingInterval}
                    setPollingInterval={setPollingInterval}
                    processesCount={processes.length}
                    cpuUsage={cpuUsage}
                    memoryUsage={memoryUsage}
                    lang={lang}
                    confirmKill={confirmKill}
                    setConfirmKill={handleSetConfirmKill}
                  />
                )}

              </motion.div>
            </AnimatePresence>

          </div>

          {/* Mini workspace Footer status */}
          <div className="px-4 md:px-8 py-3.5 border-t border-[#11141c] bg-[#08090d] text-[10px] text-zinc-650 flex justify-between font-mono-premium">
            <span>{lang === 'zh' ? '© 喵一眼 系统监控管理器' : '© Cat Info Systems Inc.'}</span>
            <span>{lang === 'zh' ? '系统状态实时更新' : 'OS Telemetry Feed'}</span>
          </div>

        </main>
    </div>
  );
}
