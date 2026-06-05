import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, MemoryStick, ArrowDownUp, Activity } from 'lucide-react';
import { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { usePerfStore } from '../stores/perfStore';

/**
 * Desktop "Dynamic Island".
 *
 * Auto-hides: when the pointer leaves, it lingers briefly then retracts to a thin
 * black sliver pinned to the top edge of the screen. Hovering the sliver brings it
 * back. To stay unobtrusive while hidden, the OS window itself shrinks to the sliver
 * (so it barely blocks the desktop) and grows again when revealed.
 *
 * Reuses the shared telemetry (usePerfStore, fed by useSystemStats in island.tsx).
 */

const LINGER_MS = 4000; // stay visible this long after the pointer leaves

// Logical-px window boxes per mode (the OS window resizes to match).
const EXPANDED_BOX = { w: 420, h: 160 };
const COLLAPSED_BOX = { w: 232, h: 56 };
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

const BOX: Record<Mode, { width: number; height: number; borderRadius: number }> = {
  expanded: { width: 372, height: 138, borderRadius: 26 },
  collapsed: { width: 196, height: 40, borderRadius: 999 },
  peek: { width: 124, height: 9, borderRadius: 8 },
};

export default function DynamicIsland() {
  const [hovered, setHovered] = useState(false);
  const [lingering, setLingering] = useState(true); // visible briefly on first mount
  const [expanded, setExpanded] = useState(false); // only opens on click
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const appliedBox = useRef({ w: EXPANDED_BOX.w, h: EXPANDED_BOX.h });

  const current = usePerfStore((s) => s.current);
  const cpuHistory = usePerfStore((s) => s.history.cpu);
  const netHistory = usePerfStore((s) => s.history.net_rx);

  const cpu = current?.cpu_usage ?? 0;
  const mem = current?.memory_percent ?? 0;
  const net = (current?.net_rx_kbps ?? 0) + (current?.net_tx_kbps ?? 0);
  const accent = loadColor(cpu);

  const visible = hovered || lingering;
  // Hover only reveals the minimal pill; the full card opens on click.
  const mode: Mode = !visible ? 'peek' : expanded ? 'expanded' : 'collapsed';

  // Linger countdown: keep showing for a moment after the pointer leaves.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (hovered) {
      setLingering(true);
    } else {
      hideTimer.current = setTimeout(() => setLingering(false), LINGER_MS);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hovered]);

  // Once hidden, forget any click-expanded state so it reopens minimal next time.
  useEffect(() => {
    if (!visible && expanded) setExpanded(false);
  }, [visible, expanded]);

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
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={() => { if (visible) setExpanded((v) => !v); }}
        initial={false}
        animate={BOX[mode]}
        transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.9 }}
        className={`pointer-events-auto overflow-hidden bg-black/90 backdrop-blur-2xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.55)] ${
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
          {/* peek: no inner content — the bare black bar is the sliver */}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
