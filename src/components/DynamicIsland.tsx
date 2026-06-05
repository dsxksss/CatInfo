import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, MemoryStick, ArrowDownUp, Gauge, type LucideIcon } from 'lucide-react';
import { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { usePerfStore } from '../stores/perfStore';

/**
 * Desktop "Dynamic Island".
 *
 * Auto-hides: when the pointer leaves, it lingers briefly then retracts to a thin
 * black sliver pinned to the top edge of the screen. Hovering the sliver reveals the
 * minimal pill; clicking it opens the full card. The OS window resizes to match each
 * phase so it barely blocks the desktop while hidden.
 *
 * The expanded card lets you pick which metric (CPU/RAM/NET/GPU) the island charts;
 * the choice persists and drives the collapsed pill too.
 *
 * Reuses the shared telemetry (usePerfStore, fed by useSystemStats in island.tsx).
 */

const LINGER_MS = 4000; // stay visible this long after the pointer leaves
const STEP_MS = 650; // gap between the collapse step and the final retract to peek

// Logical-px window boxes per mode (the OS window resizes to match).
const EXPANDED_BOX = { w: 400, h: 192 };
const COLLAPSED_BOX = { w: 236, h: 56 };
const PEEK_BOX = { w: 150, h: 14 };

// Resize + recenter the OS window to a logical box pinned to the monitor's top edge.
async function setWindowBox(w: number, h: number) {
  try {
    const win = getCurrentWindow();
    const mon = await currentMonitor();
    const scale = mon?.scaleFactor ?? 1;
    const pw = Math.round(w * scale);
    const ph = Math.round(h * scale);
    await win.setSize(new PhysicalSize(pw, ph));
    if (mon) {
      const x = Math.round((mon.size.width - pw) / 2);
      await win.setPosition(new PhysicalPosition(x, 0));
    }
  } catch (e) {
    console.error('Failed to resize island window:', e);
  }
}

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

type Mode = 'expanded' | 'collapsed' | 'peek';
type MetricKey = 'cpu' | 'ram' | 'net' | 'gpu';

interface Metric {
  label: string;
  icon: LucideIcon;
  color: string;
  value: string;
  history: number[];
}

const BOX: Record<Mode, { width: number; height: number; borderRadius: number }> = {
  expanded: { width: 360, height: 170, borderRadius: 26 },
  collapsed: { width: 200, height: 40, borderRadius: 999 },
  peek: { width: 124, height: 9, borderRadius: 8 },
};

export default function DynamicIsland() {
  const [mode, setMode] = useState<Mode>('collapsed');
  const [selected, setSelected] = useState<MetricKey>(
    () => (localStorage.getItem('wincat-island-metric') as MetricKey) || 'cpu',
  );
  const closeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const appliedBox = useRef({ w: EXPANDED_BOX.w, h: EXPANDED_BOX.h });

  const current = usePerfStore((s) => s.current);
  const cpuHistory = usePerfStore((s) => s.history.cpu);
  const memHistory = usePerfStore((s) => s.history.memory);
  const netHistory = usePerfStore((s) => s.history.net_rx);
  const gpuHistory = usePerfStore((s) => s.history.gpu);

  const cpu = current?.cpu_usage ?? 0;
  const mem = current?.memory_percent ?? 0;
  const net = (current?.net_rx_kbps ?? 0) + (current?.net_tx_kbps ?? 0);
  const gpu = (current?.gpus ?? []).reduce((m, g) => Math.max(m, g.utilization), 0);
  const hasGpu = (current?.gpus?.length ?? 0) > 0;

  const metrics: Record<MetricKey, Metric> = {
    cpu: { label: 'CPU', icon: Cpu, color: loadColor(cpu), value: `${cpu.toFixed(0)}%`, history: cpuHistory },
    ram: { label: 'RAM', icon: MemoryStick, color: '#38bdf8', value: `${mem.toFixed(0)}%`, history: memHistory },
    net: { label: 'NET', icon: ArrowDownUp, color: '#a78bfa', value: fmtSpeed(net), history: netHistory },
    gpu: { label: 'GPU', icon: Gauge, color: '#f472b6', value: `${gpu.toFixed(0)}%`, history: gpuHistory },
  };
  const metricKeys: MetricKey[] = hasGpu ? ['cpu', 'ram', 'net', 'gpu'] : ['cpu', 'ram', 'net'];
  const activeKey: MetricKey = selected === 'gpu' && !hasGpu ? 'cpu' : selected;
  const sel = metrics[activeKey];

  const selectMetric = (k: MetricKey) => {
    setSelected(k);
    localStorage.setItem('wincat-island-metric', k);
  };

  const clearCloseTimers = () => {
    closeTimers.current.forEach(clearTimeout);
    closeTimers.current = [];
  };

  // Staged auto-hide: linger, ease expanded → collapsed, then collapsed → peek,
  // so it retracts gradually instead of snapping straight to the sliver.
  const scheduleClose = () => {
    clearCloseTimers();
    closeTimers.current.push(
      setTimeout(() => setMode((m) => (m === 'expanded' ? 'collapsed' : m)), LINGER_MS),
    );
    closeTimers.current.push(
      setTimeout(() => setMode('peek'), LINGER_MS + STEP_MS),
    );
  };

  const reveal = () => {
    clearCloseTimers();
    setMode((m) => (m === 'peek' ? 'collapsed' : m));
  };

  const toggleExpand = () => {
    setMode((m) => (m === 'peek' ? m : m === 'expanded' ? 'collapsed' : 'expanded'));
  };

  // Show briefly on first mount, then retract through the same staged close.
  useEffect(() => {
    scheduleClose();
    return clearCloseTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the OS window to match the current mode. Grow immediately so content
  // never clips; shrink only after the retract animation has played.
  useEffect(() => {
    if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
    const target = mode === 'peek' ? PEEK_BOX : mode === 'collapsed' ? COLLAPSED_BOX : EXPANDED_BOX;
    const prev = appliedBox.current;
    const apply = () => {
      appliedBox.current = target;
      setWindowBox(target.w, target.h);
    };
    if (target.w * target.h >= prev.w * prev.h) {
      apply(); // growing — resize first
    } else {
      shrinkTimer.current = setTimeout(apply, 320); // shrinking — let content retract first
    }
    return () => {
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
    };
  }, [mode]);

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none select-none">
      <motion.div
        onHoverStart={reveal}
        onHoverEnd={scheduleClose}
        onClick={toggleExpand}
        initial={false}
        animate={BOX[mode]}
        transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.9 }}
        className={`pointer-events-auto overflow-hidden bg-[#0b0c10] border border-white/10 ${
          mode === 'peek' ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'expanded' && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full p-3 flex flex-col gap-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">喵一眼 · Live</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-600">SYSTEM</span>
              </div>

              {/* Metric selector chips */}
              <div className="flex gap-1.5">
                {metricKeys.map((k) => {
                  const m = metrics[k];
                  const isActive = k === activeKey;
                  const Icon = m.icon;
                  return (
                    <button
                      key={k}
                      onClick={(e) => { e.stopPropagation(); selectMetric(k); }}
                      className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wide transition-colors ${
                        isActive ? '' : 'border-white/5 bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                      }`}
                      style={isActive ? { color: m.color, borderColor: `${m.color}66`, backgroundColor: `${m.color}1a` } : undefined}
                    >
                      <Icon size={10} style={isActive ? { color: m.color } : undefined} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Big chart of the selected metric */}
              <div className="flex-1 rounded-xl bg-white/5 border border-white/5 p-2.5 flex flex-col min-h-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{sel.label}</span>
                  <span className="text-lg font-bold leading-none" style={{ color: sel.color }}>{sel.value}</span>
                </div>
                <div className="flex-1 mt-1.5 -mx-0.5 min-h-0">
                  <Sparkline data={sel.history} color={sel.color} />
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'collapsed' && (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="w-full h-full px-3.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <sel.icon size={13} style={{ color: sel.color }} />
                <span className="text-[11px] font-bold text-zinc-300">{sel.label}</span>
                <span className="text-[12px] font-bold tabular-nums truncate" style={{ color: sel.color }}>
                  {sel.value}
                </span>
              </div>
              <div className="w-12 h-4 shrink-0 opacity-80">
                <Sparkline data={sel.history} color={sel.color} />
              </div>
            </motion.div>
          )}
          {/* peek: no inner content — the bare black bar is the sliver */}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
