import { useState } from 'react';
import TelemetryChart from './TelemetryChart';
import { Cpu, Database, HardDrive, Network, TrendingUp, MonitorCog } from 'lucide-react';
import { translations } from '../lib/translations';
import { usePerfStore } from '../stores/perfStore';

function formatVram(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

interface PerformanceTabProps {
  cpuUsage: number;
  cpuHistoryCount: number[];
  memoryUsage: number;
  memoryHistoryCount: number[];
  diskUsage: number;
  diskHistoryCount: number[];
  networkUsage: number;
  networkHistoryCount: number[];
  gpuUsage: number;
  gpuHistoryCount: number[];
  coresUsage: number[];
  processesCount: number;
  lang?: 'en' | 'zh';
  cpuFreq?: number; // in MHz
  memoryTotalGb?: number;
}

export default function PerformanceTab({
  cpuUsage,
  cpuHistoryCount,
  memoryUsage,
  memoryHistoryCount,
  diskUsage,
  diskHistoryCount,
  networkUsage,
  networkHistoryCount,
  gpuUsage,
  gpuHistoryCount,
  coresUsage,
  processesCount,
  lang = 'en',
  cpuFreq = 3400,
  memoryTotalGb = 16.0,
}: PerformanceTabProps) {
  const t = translations[lang];
  // We can choose which card's large interactive chart we are actively viewing
  const [activeMetricTab, setActiveMetricTab] = useState<'cpu' | 'memory' | 'disk' | 'network' | 'gpu'>('cpu');
  const gpus = usePerfStore((s) => s.current?.gpus ?? []);
  // The "active" GPU shown in the summary rail is the busiest one.
  const activeGpu = gpus.reduce(
    (best, g) => (g.utilization > (best?.utilization ?? -1) ? g : best),
    gpus[0],
  );

  const formattedCpuFreq = cpuFreq > 0 ? `${(cpuFreq / 1000).toFixed(2)} GHz` : '3.40 GHz';
  const usedMemoryGb = ((memoryUsage / 100) * memoryTotalGb).toFixed(1);

  return (
    <div className="flex flex-col gap-6" id="performance-tab">
      
      {/* Multi-card Quick Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="telemetry-metro-grid">
        
        {/* CPU Card */}
        <button
          onClick={() => setActiveMetricTab('cpu')}
          className={`card p-5 flex flex-col justify-between text-left transition-all hover:border-zinc-700/60 active:scale-[0.98] cursor-pointer h-full w-full ${
            activeMetricTab === 'cpu' ? 'border-[#006fee] bg-zinc-900/40 glow-blue' : 'bg-zinc-900/80 border-zinc-800'
          }`}
          id="cpu-metric-card"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <Cpu size={16} className={activeMetricTab === 'cpu' ? 'text-[#006fee]' : 'text-zinc-400'} />
              <span className="text-sm font-semibold text-zinc-400">{t.processor}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-mono-premium bg-blue-500/10 text-[#006fee] border border-blue-500/20 px-1.5 py-0.5 rounded leading-none">
              {formattedCpuFreq}
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono-premium">
              {cpuUsage.toFixed(1)}<span className="text-sm text-zinc-500 ml-0.5">%</span>
            </div>
          </div>

          <div className="h-10 w-full pointer-events-none opacity-80 mt-1">
            <TelemetryChart
              data={cpuHistoryCount}
              max={100}
              strokeColor="#006fee"
              fillColorStart="rgba(0, 111, 238, 0.1)"
              fillColorEnd="transparent"
              gridLines={false}
            />
          </div>
        </button>

        {/* Memory Card */}
        <button
          onClick={() => setActiveMetricTab('memory')}
          className={`card p-5 flex flex-col justify-between text-left transition-all hover:border-zinc-700/60 active:scale-[0.98] cursor-pointer h-full w-full ${
            activeMetricTab === 'memory' ? 'border-[#17c964] bg-zinc-900/40 glow-green' : 'bg-zinc-900/80 border-zinc-800'
          }`}
          id="memory-metric-card"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <Database size={16} className={activeMetricTab === 'memory' ? 'text-[#17c964]' : 'text-zinc-400'} />
              <span className="text-sm font-semibold text-zinc-400">{t.ramMemory}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-mono-premium bg-emerald-500/10 text-[#17c964] border border-emerald-500/20 px-1.5 py-0.5 rounded leading-none">
              {memoryTotalGb.toFixed(0)} GB
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono-premium">
              {usedMemoryGb}
              <span className="text-lg text-zinc-500 ml-1">GB</span>
              <span className="text-xs text-zinc-600 font-medium ml-2">({memoryUsage.toFixed(0)}%)</span>
            </div>
          </div>

          <div className="h-10 w-full pointer-events-none opacity-80 mt-1">
            <TelemetryChart
              data={memoryHistoryCount}
              max={100}
              strokeColor="#17c964"
              fillColorStart="rgba(23, 201, 100, 0.1)"
              fillColorEnd="transparent"
              gridLines={false}
            />
          </div>
        </button>

        {/* Disk Card */}
        <button
          onClick={() => setActiveMetricTab('disk')}
          className={`card p-5 flex flex-col justify-between text-left transition-all hover:border-zinc-700/60 active:scale-[0.98] cursor-pointer h-full w-full ${
            activeMetricTab === 'disk' ? 'border-[#f5a524] bg-zinc-900/40 glow-red' : 'bg-zinc-900/80 border-zinc-800'
          }`}
          id="disk-metric-card"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className={activeMetricTab === 'disk' ? 'text-[#f5a524]' : 'text-zinc-400'} />
              <span className="text-sm font-semibold text-zinc-400">{t.physicalSSD}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-mono-premium bg-amber-500/10 text-[#f5a524] border border-amber-500/20 px-1.5 py-0.5 rounded leading-none">
              M.2 Gen4
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono-premium text-zinc-100">
              {diskUsage.toFixed(1)}
              <span className="text-lg text-zinc-500 ml-1">MB/s</span>
            </div>
          </div>

          <div className="h-10 w-full pointer-events-none opacity-80 mt-1">
            <TelemetryChart
              data={diskHistoryCount}
              max={150}
              strokeColor="#f5a524"
              fillColorStart="rgba(245, 165, 36, 0.1)"
              fillColorEnd="transparent"
              gridLines={false}
            />
          </div>
        </button>

        {/* Network Card */}
        <button
          onClick={() => setActiveMetricTab('network')}
          className={`card p-5 flex flex-col justify-between text-left transition-all hover:border-zinc-700/60 active:scale-[0.98] cursor-pointer h-full w-full ${
            activeMetricTab === 'network' ? 'border-[#006fee] bg-zinc-900/40 glow-blue' : 'bg-zinc-900/80 border-zinc-800'
          }`}
          id="network-metric-card"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <Network size={16} className={activeMetricTab === 'network' ? 'text-[#006fee]' : 'text-zinc-400'} />
              <span className="text-sm font-semibold text-zinc-400">{t.networkInterface}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-mono-premium bg-blue-500/10 text-[#006fee] border border-blue-500/20 px-1.5 py-0.5 rounded leading-none">
              Ethernet / WiFi
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono-premium text-zinc-100">
              {networkUsage >= 1024 ? `${(networkUsage / 1024).toFixed(1)} Mbps` : `${networkUsage.toFixed(0)} Kbps`}
            </div>
          </div>

          <div className="h-10 w-full pointer-events-none opacity-80 mt-1">
            <TelemetryChart
              data={networkHistoryCount}
              max={1000}
              strokeColor="#006fee"
              fillColorStart="rgba(0, 111, 238, 0.1)"
              fillColorEnd="transparent"
              gridLines={false}
            />
          </div>
        </button>

        {/* GPU Card */}
        <button
          onClick={() => setActiveMetricTab('gpu')}
          className={`card p-5 flex flex-col justify-between text-left transition-all hover:border-zinc-700/60 active:scale-[0.98] cursor-pointer h-full w-full ${
            activeMetricTab === 'gpu' ? 'border-[#9353d3] bg-zinc-900/40' : 'bg-zinc-900/80 border-zinc-800'
          }`}
          id="gpu-metric-card"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <MonitorCog size={16} className={activeMetricTab === 'gpu' ? 'text-[#9353d3]' : 'text-zinc-400'} />
              <span className="text-sm font-semibold text-zinc-400">{lang === 'zh' ? '显卡' : 'Graphics'}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-mono-premium bg-purple-500/10 text-[#9353d3] border border-purple-500/20 px-1.5 py-0.5 rounded leading-none">
              {activeGpu ? formatVram(activeGpu.vram_total_mb) : 'N/A'}
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono-premium">
              {gpuUsage.toFixed(1)}<span className="text-sm text-zinc-500 ml-0.5">%</span>
            </div>
          </div>

          <div className="h-10 w-full pointer-events-none opacity-80 mt-1">
            <TelemetryChart
              data={gpuHistoryCount}
              max={100}
              strokeColor="#9353d3"
              fillColorStart="rgba(147, 83, 211, 0.1)"
              fillColorEnd="transparent"
              gridLines={false}
            />
          </div>
        </button>

      </div>

      {/* Main Expansive Real-time Telemetry Graph Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Large Detailed Scope Chart */}
        <div className="lg:col-span-12 card p-6 flex flex-col min-h-[380px]" id="large-scope-card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#006fee]" />
                {activeMetricTab === 'cpu' && (lang === 'zh' ? 'CPU 核心使用情况' : 'Processor Logic Telemetry Map')}
                {activeMetricTab === 'memory' && (lang === 'zh' ? '内存使用情况' : 'Physical Memory Allocation Plot')}
                {activeMetricTab === 'disk' && (lang === 'zh' ? '硬盘读写速度' : 'Physical SSD Speed Transfer Map')}
                {activeMetricTab === 'network' && (lang === 'zh' ? '网络流量速度' : 'Network Frame Bandwidth Spectrum')}
                {activeMetricTab === 'gpu' && (lang === 'zh' ? '显卡使用情况' : 'Graphics Processor Utilization Map')}
              </h3>
              <p className="text-xs text-zinc-500 font-medium">{t.largeChartSubtitle}</p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono-premium">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  activeMetricTab === 'cpu' ? 'bg-[#006fee]' : activeMetricTab === 'memory' ? 'bg-[#17c964]' : activeMetricTab === 'disk' ? 'bg-[#f5a524]' : activeMetricTab === 'gpu' ? 'bg-[#9353d3]' : 'bg-[#006fee]'
                }`}></span>
                <span className="text-zinc-300 capitalize font-bold">
                  {activeMetricTab === 'cpu' ? 'CPU' : activeMetricTab === 'memory' ? (lang === 'zh' ? '内存' : 'Memory') : activeMetricTab === 'disk' ? (lang === 'zh' ? '硬盘' : 'SSD') : activeMetricTab === 'gpu' ? (lang === 'zh' ? '显卡' : 'GPU') : (lang === 'zh' ? '网卡' : 'Network')} {lang === 'zh' ? '使用率' : 'Usage'}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-zinc-800"></div>
              <span className="text-zinc-500">{t.intervalWindow}</span>
            </div>
          </div>

          <div className="flex-grow min-h-[220px] w-full relative">
            {activeMetricTab === 'cpu' && (
              <TelemetryChart
                data={cpuHistoryCount}
                max={100}
                strokeColor="#006fee"
                fillColorStart="rgba(0, 111, 238, 0.15)"
                fillColorEnd="rgba(0, 111, 238, 0.0)"
                unit="%"
              />
            )}
            {activeMetricTab === 'memory' && (
              <TelemetryChart
                data={memoryHistoryCount}
                max={100}
                strokeColor="#17c964"
                fillColorStart="rgba(23, 201, 100, 0.15)"
                fillColorEnd="rgba(23, 201, 100, 0.0)"
                unit="%"
              />
            )}
            {activeMetricTab === 'disk' && (
              <TelemetryChart
                data={diskHistoryCount}
                max={150}
                strokeColor="#f5a524"
                fillColorStart="rgba(245, 165, 36, 0.15)"
                fillColorEnd="rgba(245, 165, 36, 0.0)"
                unit=" MB/s"
              />
            )}
            {activeMetricTab === 'network' && (
              <TelemetryChart
                data={networkHistoryCount}
                max={1000}
                strokeColor="#006fee"
                fillColorStart="rgba(0, 111, 238, 0.15)"
                fillColorEnd="rgba(0, 111, 238, 0.0)"
                unit=" Kbps"
              />
            )}
            {activeMetricTab === 'gpu' && (
              <TelemetryChart
                data={gpuHistoryCount}
                max={100}
                strokeColor="#9353d3"
                fillColorStart="rgba(147, 83, 211, 0.15)"
                fillColorEnd="rgba(147, 83, 211, 0.0)"
                unit="%"
              />
            )}
          </div>

          {/* Core Hardware Metrics Summary Rail */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-zinc-800/80">
            {activeMetricTab === 'cpu' && (
              <>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.baseSpeed}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{formattedCpuFreq}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.socketsSchedulers}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">1 Socket / SMP</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '核心数' : 'Processor Cores'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{coresUsage.length} Cores</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.totalProcesses}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{processesCount}</span>
                </div>
              </>
            )}
            {activeMetricTab === 'memory' && (
              <>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.inUseCompressed}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{usedMemoryGb} GB</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.availableReserve}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{(memoryTotalGb - Number(usedMemoryGb)).toFixed(1)} GB</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '总容量' : 'Total Space'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{memoryTotalGb.toFixed(1)} GB</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '虚拟内存' : 'Memory Paging'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">VMM Dynamic</span>
                </div>
              </>
            )}
            {activeMetricTab === 'disk' && (
              <>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '磁盘传输速度' : 'Transfer Rate'}</span>
                  <span className="mono text-sm font-semibold text-[#f5a524]">{diskUsage.toFixed(1)} MB/s</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.readLatency}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">&lt; 0.1 ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.writeLatency}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">&lt; 0.2 ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '接口总线' : 'Host Bus'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">PCI Express</span>
                </div>
              </>
            )}
            {activeMetricTab === 'network' && (
              <>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '接收速度 (RX)' : 'Instant Receive (RX)'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{(networkUsage * 0.8).toFixed(0)} Kbps</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '发送速度 (TX)' : 'Instant Transmit (TX)'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">{(networkUsage * 0.2).toFixed(0)} Kbps</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '连接状态' : 'Bridge Link'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">Connected</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{t.connectionType}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">Auto Negotiated</span>
                </div>
              </>
            )}
            {activeMetricTab === 'gpu' && (
              <>
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '显卡型号' : 'Adapter'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200 truncate block" title={activeGpu?.name}>
                    {activeGpu?.name ?? (lang === 'zh' ? '未检测到' : 'Not detected')}
                    {gpus.length > 1 && <span className="text-zinc-500"> +{gpus.length - 1}</span>}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '使用率' : 'Utilization'}</span>
                  <span className="mono text-sm font-semibold text-[#9353d3]">{gpuUsage.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">{lang === 'zh' ? '显存占用' : 'VRAM'}</span>
                  <span className="mono text-sm font-semibold text-zinc-200">
                    {activeGpu ? `${formatVram(activeGpu.vram_used_mb)} / ${formatVram(activeGpu.vram_total_mb)}` : '—'}
                  </span>
                </div>
              </>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
