import { useState, useEffect } from 'react';
import { HardDrive, Cpu, Database, MonitorCog } from 'lucide-react';
import { usePerfStore } from '../stores/perfStore';
import TelemetryChart from './TelemetryChart';

interface DashboardTabProps {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkUsage: number;
  processesCount: number;
  lang?: 'en' | 'zh';
}

export default function DashboardTab({
  cpuUsage,
  memoryUsage,
  diskUsage,
  networkUsage,
  processesCount,
  lang = 'en',
}: DashboardTabProps) {
  const currentStats = usePerfStore((s) => s.current);
  const disks = currentStats?.disks || [];
  const gpus = currentStats?.gpus || [];
  const gpuHistory = usePerfStore((s) => s.history.gpu);
  // Show the busiest GPU in the overview.
  const primaryGpu = gpus.reduce(
    (best, g) => (g.utilization > (best?.utilization ?? -1) ? g : best),
    gpus[0],
  );
  const memTotalGb = currentStats?.memory_total_gb ?? 0;
  const memUsedGb = currentStats?.memory_used_gb ?? 0;
  const memAvailGb = currentStats?.memory_available_gb ?? Math.max(0, memTotalGb - memUsedGb);
  const [healthScore, setHealthScore] = useState(98);

  // Adjust health score dynamically based on usage parameters
  useEffect(() => {
    let penalty = 0;
    if (cpuUsage > 80) penalty += 25;
    else if (cpuUsage > 50) penalty += 10;

    if (memoryUsage > 85) penalty += 20;
    else if (memoryUsage > 65) penalty += 8;

    if (diskUsage > 90) penalty += 15;

    setHealthScore(Math.max(34, 100 - penalty));
  }, [cpuUsage, memoryUsage, diskUsage]);

  const getHealthColor = () => {
    if (healthScore > 85) return { text: '#17c964', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' };
    if (healthScore > 65) return { text: '#f5a524', border: 'border-amber-500/20', bg: 'bg-amber-500/10' };
    return { text: '#f31260', border: 'border-red-500/20', bg: 'bg-red-500/10' };
  };

  const colors = getHealthColor();

  const wavePath1 = "M 0 0 Q 25 -5, 50 0 T 100 0 T 150 0 T 200 0 L 200 120 L 0 120 Z";
  const wavePath2 = "M 0 0 Q 25 -3, 50 0 T 100 0 T 150 0 T 200 0 L 200 120 L 0 120 Z";

  return (
    <div className="flex flex-col gap-6" id="dashboard-tab">
      
      {/* Main Hardware Spec Box */}
      <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative" id="hardware-specifications">
        
        {/* Column 1: CPU Specifications & Integrated Health Capsule (Left Column) */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <Cpu size={14} className="text-[#006fee]" /> {lang === 'zh' ? '处理器 (CPU)' : 'Core Processor Architecture'}
              </h3>
              <span className="text-base font-bold font-geom text-zinc-100 block leading-tight">{currentStats?.cpu_brand || (lang === 'zh' ? '正在检测处理器...' : 'Detecting processor...')}</span>
              <span className="text-xs text-zinc-400 mt-1 block">
                {lang === 'zh' 
                  ? `当前有 ${processesCount} 个正在运行的进程` 
                  : `High performance frequency multiplier activated • ${processesCount} active trace chains detected`}
              </span>
            </div>
            
            {/* System Health Capsule */}
            <div className="flex items-center gap-3.5 flex-shrink-0 self-start sm:self-center">
              <div className="relative w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center flex-shrink-0"
                   style={{ borderColor: colors.text + '44', boxShadow: `inset 0 0 8px ${colors.text}22, 0 0 12px ${colors.text}22` }}>
                
                {/* Dynamic Wave Vector Water Ball */}
                <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <clipPath id="water-ball-clip">
                      <circle cx="50" cy="50" r="48" />
                    </clipPath>
                  </defs>
                  
                  {/* Circular Background Glow */}
                  <circle cx="50" cy="50" r="48" fill={colors.text} opacity="0.04" />
                  
                  {/* Clipped liquid area */}
                  <g clipPath="url(#water-ball-clip)">
                    {/* Dynamic Vertical level based on cpuUsage */}
                    <g transform={`translate(0, ${100 - cpuUsage})`} className="transition-all duration-1000 ease-out">
                      
                      {/* Background wave (slower) */}
                      <path 
                        d={wavePath2} 
                        fill={colors.text} 
                        opacity="0.25"
                        className="animate-wave-slow"
                        style={{ transform: 'translateX(-10px)' }}
                      />
                      
                      {/* Foreground wave (faster) */}
                      <path 
                        d={wavePath1} 
                        fill={colors.text} 
                        opacity="0.45"
                        className="animate-wave-fast"
                      />
                    </g>
                  </g>
                </svg>

                {/* Centered Percentage Text */}
                <div className="absolute z-10 flex flex-col items-center">
                  <span className="cpu-gauge-pct text-sm font-extrabold tracking-tighter font-mono-premium text-white"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {cpuUsage.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-none">{lang === 'zh' ? '压力占比' : 'Stress Load'}</span>
                <span className="text-sm font-bold text-zinc-100 leading-none mt-1.5">
                  {cpuUsage > 80 
                    ? (lang === 'zh' ? '负载过高' : 'Critical') 
                    : cpuUsage > 50 
                      ? (lang === 'zh' ? '负载较高' : 'Warning') 
                      : (lang === 'zh' ? '运行良好' : 'Excellent')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">{lang === 'zh' ? '活动进程数' : 'Active Processes'}</span>
              <span className="mono text-xs font-semibold text-zinc-200">{processesCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">{lang === 'zh' ? '处理器负载' : 'Processor Load'}</span>
              <span className="mono text-xs font-semibold text-zinc-200">{cpuUsage.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">{lang === 'zh' ? '实时网络流量' : 'Net Flow'}</span>
              <span className="mono text-xs font-semibold text-zinc-200">{networkUsage.toFixed(0)} K</span>
            </div>
          </div>

          {/* RAM (stacked beneath CPU) */}
          <div className="flex flex-col gap-3 pt-5 mt-auto border-t border-zinc-800/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                  <Database size={14} className="text-emerald-500" /> {lang === 'zh' ? '内存 (RAM)' : 'Physical Memory'}
                </h3>
                <span className="text-base font-bold font-geom text-zinc-100 block leading-tight">{lang === 'zh' ? '物理内存' : 'High Speed Dual-Channel RAM'}</span>
                <span className="text-xs text-zinc-400 mt-1 block">
                  {lang === 'zh'
                    ? `已用 ${memUsedGb.toFixed(1)} GB / 共 ${memTotalGb.toFixed(1)} GB`
                    : `Used ${memUsedGb.toFixed(1)} GB / ${memTotalGb.toFixed(1)} GB total`}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold tracking-tight font-mono-premium text-emerald-500 leading-none">
                  {memoryUsage.toFixed(0)}<span className="text-sm text-zinc-500 ml-0.5">%</span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{lang === 'zh' ? '占用' : 'Used'}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
                <span>{lang === 'zh' ? '内存占用' : 'In Use'}</span>
                <span className="mono text-zinc-300 normal-case">{lang === 'zh' ? `可用 ${memAvailGb.toFixed(1)} GB` : `${memAvailGb.toFixed(1)} GB free`}</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, memoryUsage)).toFixed(0)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: GPU Specifications (Right Column) */}
        <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-zinc-800/80 md:pl-6 pt-5 md:pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                <MonitorCog size={14} className="text-[#9353d3]" /> {lang === 'zh' ? '显卡 (GPU)' : 'Graphics Processor'}
              </h3>
              <span className="text-base font-bold font-geom text-zinc-100 block leading-tight truncate" title={primaryGpu?.name}>
                {primaryGpu?.name ?? (lang === 'zh' ? '正在检测显卡...' : 'Detecting graphics adapter...')}
              </span>
              <span className="text-xs text-zinc-400 mt-1 block">
                {primaryGpu ? primaryGpu.vendor : (lang === 'zh' ? '等待 GPU 遥测数据' : 'Awaiting GPU telemetry')}
                {gpus.length > 1 && ` • ${gpus.length} ${lang === 'zh' ? '块' : 'adapters'}`}
              </span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-extrabold tracking-tight font-mono-premium text-[#9353d3] leading-none">
                {(primaryGpu?.utilization ?? 0).toFixed(0)}<span className="text-sm text-zinc-500 ml-0.5">%</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{lang === 'zh' ? '使用率' : 'Load'}</span>
            </div>
          </div>

          {/* GPU utilization trend chart fills the remaining height */}
          <div className="flex-grow min-h-[80px] w-full">
            <TelemetryChart
              data={gpuHistory.length ? gpuHistory : [0]}
              max={100}
              strokeColor="#9353d3"
              fillColorStart="rgba(147, 83, 211, 0.18)"
              fillColorEnd="rgba(147, 83, 211, 0.0)"
              gridLines={false}
              isMini={true}
            />
          </div>
        </div>
      </div>

      {/* Connected Mass Drives Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {disks.length > 0 ? (
          disks.map((disk, idx) => {
            const isSystem = disk.mount_point.toUpperCase().startsWith('C:') || disk.mount_point === '/';
            const usedBytes = disk.total_space_bytes - disk.available_space_bytes;
            const percentUsed = disk.total_space_bytes > 0 
              ? (usedBytes / disk.total_space_bytes) * 100 
              : 0;

            const formatBytes = (bytes: number) => {
              const gb = bytes / (1024 * 1024 * 1024);
              if (gb >= 900) {
                return `${(gb / 1024).toFixed(1)} TB`;
              }
              return `${gb.toFixed(0)} GB`;
            };

            const usedStr = formatBytes(usedBytes);
            const availStr = formatBytes(disk.available_space_bytes);
            const totalStr = formatBytes(disk.total_space_bytes);
            
            // Construct clean name
            let displayName = disk.name.trim();
            if (!displayName) {
              displayName = isSystem 
                ? (lang === 'zh' ? '系统盘' : 'System Disk') 
                : (lang === 'zh' ? '本地磁盘' : 'Local Disk');
            }
            
            // Add mount point for clarity
            const titleText = `${displayName} (${disk.mount_point})`;

            return (
              <div key={idx} className="card p-5 flex flex-col justify-between" id={`drive-${disk.mount_point.replace(/[^a-zA-Z0-9]/g, '')}-panel`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60">
                      <HardDrive size={16} className={isSystem ? "text-[#006fee]" : "text-[#10b981]"} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-zinc-200">{titleText}</span>
                      <span className="text-[10px] text-zinc-500 block font-medium">
                        {lang === 'zh' ? `本地磁盘 · 共 ${totalStr}` : `Local Disk · ${totalStr} total`}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-mono-premium px-2 py-0.5 rounded border ${
                    isSystem
                      ? "text-[#006fee] bg-blue-500/10 border-blue-500/20"
                      : "text-[#10b981] bg-emerald-500/10 border-emerald-500/20"
                  }`}>
                    {isSystem 
                      ? (lang === 'zh' ? '主系统' : 'System') 
                      : (lang === 'zh' ? '数据' : 'Data')}
                  </span>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-mono-premium text-zinc-400 mb-1.5">
                    <span>{lang === 'zh' ? `已用: ${usedStr}` : `Used: ${usedStr}`}</span>
                    <span>{lang === 'zh' ? `可用: ${availStr}` : `Available: ${availStr}`}</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isSystem ? 'bg-[#006fee]' : 'bg-[#10b981]'}`}
                      style={{ width: `${percentUsed.toFixed(0)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5 font-mono-premium">
                    <span>{lang === 'zh' ? `总容量: ${totalStr}` : `Total: ${totalStr}`}</span>
                    <span>{percentUsed.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          // Fallback loading states to avoid blank screens or fabricated data
          <div className="col-span-2 py-8 text-center text-xs text-zinc-500 card flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border border-t-transparent border-zinc-500 animate-spin"></span>
            <span>{lang === 'zh' ? '正在获取磁盘信息...' : 'Retrieving storage drives...'}</span>
          </div>
        )}
      </div>

    </div>
  );
}
