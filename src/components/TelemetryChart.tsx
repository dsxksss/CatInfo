import React, { useRef, useEffect, useState } from 'react';

interface TelemetryChartProps {
  data: number[];
  max?: number;
  strokeColor?: string;
  fillColorStart?: string;
  fillColorEnd?: string;
  gridLines?: boolean;
  unit?: string;
}

export default function TelemetryChart({
  data,
  max = 100,
  strokeColor = '#006fee',
  fillColorStart = 'rgba(0, 111, 238, 0.18)',
  fillColorEnd = 'rgba(0, 111, 238, 0.00)',
  gridLines = true,
  unit = '%',
}: TelemetryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Handle ResizeObserver registration independently
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      window.requestAnimationFrame(() => {
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      });
    });

    resizeObserver.observe(parent);

    const rect = parent.getBoundingClientRect();
    if (rect.width && rect.height) {
      setDimensions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Drawing is separated and triggers when dimensions or telemetry data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const margin = { top: 6, right: 2, bottom: 6, left: 2 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const isLight = document.documentElement.classList.contains('light');

    // Draw Gridlines
    if (gridLines) {
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      
      // 4 horizontal gridlines
      for (let i = 0; i <= 4; i++) {
        const y = margin.top + (chartHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();
      }

      // Vertical lines
      const verticalLinesCount = Math.min(data.length - 1, 10);
      for (let i = 0; i <= verticalLinesCount; i++) {
        const x = margin.left + (chartWidth * i) / verticalLinesCount;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + chartHeight);
        ctx.stroke();
      }
    }

    // X coordinate calculation
    const getX = (index: number) => {
      if (data.length <= 1) return margin.left;
      return margin.left + (index / (data.length - 1)) * chartWidth;
    };

    // Y coordinate calculation
    const getY = (val: number) => {
      const clamped = Math.max(0, Math.min(max, val));
      return margin.top + chartHeight - (clamped / max) * chartHeight;
    };

    // Draw Area Gradient
    if (data.length > 1) {
      const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
      gradient.addColorStop(0, fillColorStart);
      gradient.addColorStop(1, fillColorEnd);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(0));
      
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i), getY(i));
      }

      ctx.lineTo(getX(data.length - 1), margin.top + chartHeight);
      ctx.lineTo(getX(0), margin.top + chartHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw Stroke Line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (data.length > 0) {
      ctx.moveTo(getX(0), getY(data[0]));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i), getY(data[i]));
      }
    }
    ctx.stroke();

    // Draw hovered target point and vertical track line
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length) {
      const hx = getX(hoverIndex);
      const hy = getY(data[hoverIndex]);

      // Draw helper vertical dashline
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, margin.top);
      ctx.lineTo(hx, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Hover Glow Dot
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [dimensions, data, max, strokeColor, fillColorStart, fillColorEnd, gridLines, hoverIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const margin = { left: 2, right: 2 };
    const chartWidth = rect.width - margin.left - margin.right;

    // Map mouse x position to closest data index
    const relativeX = Math.max(0, Math.min(chartWidth, x - margin.left));
    const percentage = relativeX / chartWidth;
    const exactIndex = percentage * (data.length - 1);
    const index = Math.round(exactIndex);

    const checkIndex = Math.max(0, Math.min(data.length - 1, index));
    setHoverIndex(checkIndex);

    // Coordinate position for tooltip
    setHoverPos({
      x: (checkIndex / (data.length - 1)) * chartWidth + margin.left,
      y,
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoverPos(null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="block"
      />

      {/* Precise Floating Overlay Tooltip */}
      {hoverIndex !== null && hoverPos && (
        <div
          className="absolute z-30 pointer-events-none bg-zinc-950/95 border border-zinc-800 text-xs px-2.5 py-1.5 rounded-lg shadow-xl font-mono-premium text-white flex flex-col gap-0.5"
          style={{
            left: `${Math.min(
              dimensions.width > 0 ? dimensions.width - 120 : 160,
              Math.max(10, hoverPos.x - 50)
            )}px`,
            top: `10px`,
          }}
        >
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
            Record {data.length - 1 - hoverIndex}s ago
          </span>
          <span className="text-sm font-bold" style={{ color: strokeColor }}>
            {data[hoverIndex].toFixed(1)}
            <span className="text-zinc-400 font-normal ml-0.5">{unit}</span>
          </span>
        </div>
      )}
    </div>
  );
}
