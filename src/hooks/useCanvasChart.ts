import { useEffect, useRef, useCallback } from "react";

interface ChartOptions {
  lineColor: string;
  fillColor: string;
  gridColor: string;
  textColor: string;
  maxValue?: number;
  label: string;
  unit: string;
  history: number[];
}

export function useCanvasChart(options: ChartOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<{ x: number; value: number } | null>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const { history, maxValue, lineColor, fillColor, gridColor, textColor, label, unit } = options;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (history.length < 2) {
      ctx.fillStyle = textColor;
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Collecting data...", w / 2, h / 2);
      return;
    }

    const padding = { top: 10, right: 14, bottom: 22, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const effectiveMax = maxValue ?? Math.max(...history, 1);
    const yMax = effectiveMax * 1.15;

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const val = yMax - (yMax / 4) * i;
      ctx.fillStyle = textColor;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(0), padding.left - 4, y + 3);
    }

    // Label
    ctx.fillStyle = textColor;
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(unit, padding.left + 2, padding.top - 4);

    // Data
    const xStep = history.length > 1 ? plotW / (history.length - 1) : plotW;

    // Fill area
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    for (let i = 0; i < history.length; i++) {
      const x = padding.left + i * xStep;
      const y = padding.top + plotH - (history[i] / yMax) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + (history.length - 1) * xStep, padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    for (let i = 0; i < history.length; i++) {
      const x = padding.left + i * xStep;
      const y = padding.top + plotH - (history[i] / yMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Hover tooltip
    const hover = hoverRef.current;
    if (hover) {
      const idx = Math.round((hover.x - padding.left) / xStep);
      if (idx >= 0 && idx < history.length) {
        const hx = padding.left + idx * xStep;
        const hy = padding.top + plotH - (history[idx] / yMax) * plotH;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();

        const text = `${label}: ${history[idx].toFixed(1)}${unit}`;
        ctx.font = "11px system-ui";
        const tw = ctx.measureText(text).width;
        const tx = hx + 8;
        const ty = hy - 20;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(tx - 3, ty - 12, tw + 6, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.fillText(text, tx, ty);
      }
    }
  }, [options]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const h = options.history;
      const padding = { left: 40, right: 14 };
      const plotW = rect.width - padding.left - padding.right;
      const xStep = h.length > 1 ? plotW / (h.length - 1) : plotW;
      const idx = Math.round((x - padding.left) / xStep);
      if (idx >= 0 && idx < h.length) {
        hoverRef.current = { x, value: h[idx] };
      }
      draw();
    },
    [options.history, draw]
  );

  const onMouseLeave = useCallback(() => {
    hoverRef.current = null;
    draw();
  }, [draw]);

  return { canvasRef, onMouseMove, onMouseLeave };
}
