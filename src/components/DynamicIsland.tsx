import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, MemoryStick, ArrowDownUp, Activity } from 'lucide-react';
import { usePerfStore } from '../stores/perfStore';

/**
 * Desktop "Dynamic Island" prototype.
 *
 * A compact floating pill that morphs open on hover/click to reveal live system
 * telemetry. Reuses the existing data layer (usePerfStore, fed by useSystemStats),
 * so the backend stays untouched — this is purely a new presentation shell.
 *
 * Next step beyond this in-app prototype: host it in its own always-on-top,
 * transparent, decoration-less Tauri window so it floats over the OS.
 */

function loadColor(v: number): string {
  if (v >= 85) return '#f43f5e'; // rose
  if (v >= 60) return '#f59e0b'; // amber
  return '#10b981'; // emerald
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = useMemo(() => {
    const pts = data.slice(-32);
    if (pts.length < 2) return { line: '', area: '' };
    const w = 100;
    const h = 30;
    const max = Math.max(100, ...pts);
    const step = w / (pts.length - 1);
    const coords = pts.map((v, i) => [i * step, h - (v / max) * h] as const);
    const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `0,${h} ${line} ${w},${h}`;
    return { line, area };
  }, [data]);

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
      <polygon points={d.area} fill={color} opacity={0.12} />
      <polyline
        points={d.line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function fmtSpeed(kbps: number): string {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${Math.round(kbps)} KB/s`;
}

export default function DynamicIsland() {
  const [expanded, setExpanded] = useState(false);

  const current = usePerfStore((s) => s.current);
  const cpuHistory = usePerfStore((s) => s.history.cpu);
  const netHistory = usePerfStore((s) => s.history.net_rx);

  const cpu = current?.cpu_usage ?? 0;
  const mem = current?.memory_percent ?? 0;
  const net = (current?.net_rx_kbps ?? 0) + (current?.net_tx_kbps ?? 0);
  const accent = loadColor(cpu);

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none select-none">
      <motion.div
        onHoverStart={() => setExpanded(true)}
        onHoverEnd={() => setExpanded(false)}
        onClick={() => setExpanded((v) => !v)}
        initial={false}
        animate={{
          width: expanded ? 372 : 196,
          height: expanded ? 138 : 40,
          borderRadius: expanded ? 26 : 999,
        }}
        transition={{ type: 'spring', stiffness: 480, damping: 30, mass: 0.9 }}
        className="pointer-events-auto cursor-pointer overflow-hidden bg-black/90 backdrop-blur-2xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.55)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full p-3.5 flex flex-col gap-2.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">喵一眼 · Live</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-600">SYSTEM</span>
              </div>

              {/* Metric tiles */}
              <div className="grid grid-cols-3 gap-2 flex-1">
                {/* CPU with sparkline */}
                <div className="rounded-xl bg-white/5 border border-white/5 p-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Cpu size={11} style={{ color: accent }} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">CPU</span>
                  </div>
                  <div className="text-base font-bold leading-none" style={{ color: accent }}>
                    {cpu.toFixed(0)}<span className="text-[10px] ml-0.5">%</span>
                  </div>
                  <div className="h-5 -mx-0.5">
                    <Sparkline data={cpuHistory} color={accent} />
                  </div>
                </div>

                {/* RAM */}
                <div className="rounded-xl bg-white/5 border border-white/5 p-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <MemoryStick size={11} className="text-sky-400" />
                    <span className="text-[9px] font-bold uppercase tracking-wide">RAM</span>
                  </div>
                  <div className="text-base font-bold leading-none text-sky-400">
                    {mem.toFixed(0)}<span className="text-[10px] ml-0.5">%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-sky-400"
                      animate={{ width: `${Math.min(100, mem)}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                    />
                  </div>
                </div>

                {/* Network */}
                <div className="rounded-xl bg-white/5 border border-white/5 p-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <ArrowDownUp size={11} className="text-violet-400" />
                    <span className="text-[9px] font-bold uppercase tracking-wide">NET</span>
                  </div>
                  <div className="text-[13px] font-bold leading-none text-violet-300">
                    {fmtSpeed(net)}
                  </div>
                  <div className="h-5 -mx-0.5">
                    <Sparkline data={netHistory} color="#a78bfa" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="w-full h-full px-3.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5">
                <Activity size={13} style={{ color: accent }} />
                <span className="text-[11px] font-bold text-zinc-300">CPU</span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: accent }}>
                  {cpu.toFixed(0)}%
                </span>
              </div>
              <div className="w-12 h-4 opacity-80">
                <Sparkline data={cpuHistory} color={accent} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
