const COLORS = [
  "#0ea5e9", "#e94560", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#06b6d4", "#ef4444", "#84cc16", "#6366f1",
  "#d946ef", "#10b981", "#eab308", "#3b82f6",
];

export function getCoreColor(index: number): string {
  return COLORS[index % COLORS.length];
}
