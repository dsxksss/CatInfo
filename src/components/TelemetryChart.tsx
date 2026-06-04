import { useRef, useState, useEffect } from 'react';
import { Liveline } from 'liveline';

interface TelemetryChartProps {
  data: number[];
  max?: number;
  strokeColor?: string;
  fillColorStart?: string;
  fillColorEnd?: string;
  gridLines?: boolean;
  unit?: string;
  isMini?: boolean;
  pollingInterval?: number;
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    document.documentElement.classList.contains('light') ? 'light' : 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isLight = document.documentElement.classList.contains('light');
      setTheme(isLight ? 'light' : 'dark');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export default function TelemetryChart({
  data,
  strokeColor = '#006fee',
  gridLines = true,
  unit = '%',
  isMini = false,
  pollingInterval = 1000,
}: TelemetryChartProps) {
  const theme = useTheme();
  const pointsRef = useRef<{ time: number; value: number }[]>([]);
  const lastDataRef = useRef<number[]>([]);

  // Calculate stable timestamps for data updates
  const dataChanged =
    data.length !== lastDataRef.current.length ||
    data.some((val, idx) => val !== lastDataRef.current[idx]);

  if (dataChanged) {
    if (pointsRef.current.length === 0) {
      const now = Date.now() / 1000;
      const intervalSecs = pollingInterval / 1000;
      pointsRef.current = data.map((val, idx) => ({
        time: now - (data.length - 1 - idx) * intervalSecs,
        value: val,
      }));
    } else {
      const newValue = data[data.length - 1] ?? 0;
      const now = Date.now() / 1000;

      pointsRef.current.push({
        time: now,
        value: newValue,
      });

      if (pointsRef.current.length > data.length) {
        pointsRef.current = pointsRef.current.slice(-data.length);
      }

      // Check if values match. If there is a mismatch (e.g., tab changed or reset), re-initialize
      let mismatch = false;
      for (let i = 0; i < data.length; i++) {
        const pointIdx = pointsRef.current.length - data.length + i;
        if (pointIdx >= 0 && pointsRef.current[pointIdx]) {
          if (pointsRef.current[pointIdx].value !== data[i]) {
            mismatch = true;
            break;
          }
        }
      }

      if (mismatch) {
        const now = Date.now() / 1000;
        const intervalSecs = pollingInterval / 1000;
        pointsRef.current = data.map((val, idx) => ({
          time: now - (data.length - 1 - idx) * intervalSecs,
          value: val,
        }));
      }
    }
    lastDataRef.current = data;
  }

  // Calculate window size in seconds
  const windowSeconds = Math.max(1, (data.length - 1) * (pollingInterval / 1000));

  const padding = {
    top: isMini ? 6 : 12,
    bottom: isMini ? 6 : 28,
    left: isMini ? 4 : 12,
    ...(isMini ? { right: 20 } : {}),
  };

  return (
    <div className="w-full h-full relative select-none">
      <Liveline
        data={pointsRef.current}
        value={data[data.length - 1] ?? 0}
        theme={theme}
        color={strokeColor}
        grid={gridLines}
        badge={!isMini}
        badgeVariant={isMini ? 'minimal' : 'default'}
        showValue={false}
        window={windowSeconds}
        formatValue={(v: number) => v.toFixed(1) + (unit || '')}
        scrub={!isMini}
        pulse={true}
        lerpSpeed={0.08}
        lineWidth={2}
        padding={padding}
      />
    </div>
  );
}
