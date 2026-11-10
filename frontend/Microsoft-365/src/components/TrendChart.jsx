import { formatDate } from "../format";

// Line chart of Secure Score over time. points: [{ date, score, maxScore }]
export default function TrendChart({ points, height = 180 }) {
  if (!points || points.length < 2) return <p className="muted">Not enough history yet.</p>;
  const W = 640;
  const H = height;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const values = points.map((p) => (p.score / (p.maxScore || 100)) * 100);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 8) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 8) / 10) * 10);
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const change = values[values.length - 1] - values[0];

  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Secure Score went from ${Math.round(values[0])}% to ${Math.round(values[values.length - 1])}% over ${points.length} weeks`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="trend-grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="trend-axis">{t}%</text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(lo)} ${line} ${x(values.length - 1)},${y(lo)}`} className="trend-area" />
        <polyline points={line} className="trend-line" />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.5} className="trend-dot" />)}
        <text x={pad.l} y={H - 6} className="trend-axis">{formatDate(points[0].date)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className="trend-axis">{formatDate(points[points.length - 1].date)}</text>
      </svg>
      <figcaption className="muted">
        {change >= 0 ? "Up" : "Down"} {Math.abs(Math.round(change))} points over {points.length} weeks
      </figcaption>
    </figure>
  );
}
