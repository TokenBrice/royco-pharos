type Point = {
  observedAt: number;
  value: number | null;
};

export function MiniChart({
  points,
  label,
  stroke = "currentColor",
  className = "sparkline",
}: {
  points: Point[];
  label: string;
  stroke?: string;
  className?: string;
}) {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const width = 420;
  const height = 112;
  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
      const value = point.value ?? min;
      const y = height - ((value - min) / span) * (height - 16) - 8;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  if (values.length <= 1) {
    return (
      <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} (collecting history)`}>
        <path d={`M 0 ${height - 8} H ${width}`} fill="none" stroke="var(--chart-grid)" strokeWidth="1" />
        <text x={width / 2} y={height / 2} fill="var(--muted)" fontSize="13" textAnchor="middle">
          Collecting history
        </text>
      </svg>
    );
  }

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={`M 0 ${height - 8} H ${width}`} fill="none" stroke="var(--chart-grid)" strokeWidth="1" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
