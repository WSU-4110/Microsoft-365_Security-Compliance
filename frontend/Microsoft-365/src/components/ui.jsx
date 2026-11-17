import { Link } from "react-router-dom";
import { SEVERITY_LABEL } from "../format";

/*
 * Standard page header component.
 *
 * Displays:
 * - Page title
 * - Optional subtitle
 * - Optional action buttons
 *
 * Example:
 * <PageHeader
 *   title="Alerts"
 *   subtitle="Review active incidents"
 * >
 *   <button>Create Alert</button>
 * </PageHeader>
 */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>

        {/* Optional subtitle */}
        {subtitle && (
          <p className="page-sub">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action buttons shown on right side */}
      {children && (
        <div className="page-actions">
          {children}
        </div>
      )}
    </header>
  );
}

/*
 * Generic dashboard panel/card component.
 *
 * Provides a consistent container for content.
 *
 * Example:
 * <Panel title="Recent Alerts">
 *   ...
 * </Panel>
 */
export function Panel({
  title,
  actions,
  children,
  className = "",
  id,
}) {
  return (
    <section
      className={`panel ${className}`}
      aria-labelledby={title ? id : undefined}
    >
      {(title || actions) && (
        <div className="panel-head">
          {/* Panel title */}
          {title && <h2 id={id}>{title}</h2>}

          {/* Optional header actions */}
          {actions && (
            <div className="panel-actions">
              {actions}
            </div>
          )}
        </div>
      )}

      {children}
    </section>
  );
}

/*
 * Dashboard statistic/KPI component.
 *
 * Displays a metric value and label.
 *
 * Example:
 * Open Alerts
 * 42
 */
export function Stat({
  value,
  label,
  note,
  tone,
  to,
}) {
  const body = (
    <>
      <span
        className={`stat-value ${
          tone ? `tone-${tone}` : ""
        }`}
      >
        {value}
      </span>

      <span className="stat-label">
        {label}
      </span>

      {/* Additional detail */}
      {note && (
        <span className="stat-note">
          {note}
        </span>
      )}
    </>
  );

  // Render as navigation link if route exists.
  return to ? (
    <Link
      to={to}
      className="stat stat-link"
    >
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

/*
 * Generic badge component.
 *
 * Used throughout the application for labels
 * and status indicators.
 */
export function Badge({
  tone = "neutral",
  children,
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {children}
    </span>
  );
}

/*
 * Specialized badge for severity levels.
 *
 * Automatically converts:
 * high -> bad
 * medium -> warn
 * low -> info
 */
export function SeverityBadge({
  severity,
}) {
  const key = String(severity).toLowerCase();

  const tone =
    {
      high: "bad",
      medium: "warn",
      low: "info",
      informational: "neutral",
    }[key] || "neutral";

  return (
    <Badge tone={tone}>
      {SEVERITY_LABEL[key] || severity}
    </Badge>
  );
}

/*
 * Horizontal progress meter.
 *
 * Used for:
 * - Compliance %
 * - Security score %
 * - License usage %
 */
export function Meter({
  value,
  tone,
  label,
}) {
  // Clamp value between 0 and 100.
  const v = Math.max(
    0,
    Math.min(100, value || 0)
  );

  return (
    <span
      className="meter"
      role="img"
      aria-label={label || `${v}%`}
    >
      <span
        className={`meter-fill tone-bg-${
          tone ||
          (v >= 75
            ? "good"
            : v >= 50
            ? "warn"
            : "bad")
        }`}
        style={{ width: `${v}%` }}
      />
    </span>
  );
}

/*
 * Mini line chart used to show trends.
 *
 * Example:
 * Alerts over time
 * Sign-ins over time
 * Compliance score history
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
}) {
  if (!values || values.length < 2)
    return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const span = max - min || 1;

  const pts = values.map((v, i) => [
    (i / (values.length - 1)) *
      (width - 4) +
      2,
    height -
      3 -
      ((v - min) / span) *
        (height - 6),
  ]);

  // Determine whether trend is increasing.
  const up =
    values[values.length - 1] >= values[0];

  return (
    <svg
      className={`spark ${
        up ? "spark-up" : "spark-down"
      }`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={pts
          .map((p) => p.join(","))
          .join(" ")}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Highlight latest data point */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="2.5"
      />
    </svg>
  );
}

/*
 * Circular score indicator.
 *
 * Common uses:
 * - Compliance score
 * - Secure score
 * - Security posture rating
 */
export function ScoreRing({
  value,
  size = 112,
  label,
  sub,
}) {
  const r = size / 2 - 8;

  const c = 2 * Math.PI * r;

  const v = Math.max(
    0,
    Math.min(100, value ?? 0)
  );

  const tone =
    value === null ||
    value === undefined
      ? "neutral"
      : v >= 75
      ? "good"
      : v >= 50
      ? "warn"
      : "bad";

  return (
    <div
      className="ring"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* SVG ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-track"
          strokeWidth="8"
          fill="none"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`ring-fill tone-stroke-${tone}`}
          strokeWidth="8"
          fill="none"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${
            size / 2
          } ${size / 2})`}
        />
      </svg>

      {/* Score text */}
      <div className="ring-text">
        <span className="ring-value">
          {value === null ||
          value === undefined
            ? "–"
            : `${value}%`}
        </span>

        {label && (
          <span className="ring-label">
            {label}
          </span>
        )}

        {sub && (
          <span className="ring-sub">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

/*
 * Choice/filter chip group.
 *
 * Example:
 * [All] [Open] [Closed]
 */
export function Chips({
  options,
  value,
  onChange,
  label,
}) {
  return (
    <div
      className="chips"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${
            value === o.id
              ? " is-active"
              : ""
          }`}
          aria-pressed={value === o.id}
          onClick={() =>
            onChange(o.id)
          }
        >
          {o.label}

          {o.count !== undefined && (
            <span className="chip-count">
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/*
 * Reusable search box.
 */
export function Search({
  value,
  onChange,
  placeholder,
}) {
  return (
    <input
      type="search"
      className="search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) =>
        onChange(e.target.value)
      }
    />
  );
}

/*
 * Empty-state message displayed when
 * no data is available.
 */
export function Empty({
  title,
  children,
}) {
  return (
    <div className="empty">
      <p className="empty-title">
        {title}
      </p>

      {children && (
        <p className="empty-text">
          {children}
        </p>
      )}
    </div>
  );
}

/*
 * Loading indicator shown while
 * waiting for API data.
 */
export function Loading({
  label = "Loading...",
}) {
  return (
    <p
      className="loading"
      role="status"
    >
      {label}
    </p>
  );
}

/*
 * Informational message banner.
 *
 * Example:
 * "Report exported successfully"
 */
export function Notice({
  children,
  onClose,
}) {
  if (!children) return null;

  return (
    <div
      className="notice"
      role="status"
    >
      <p>{children}</p>

      {onClose && (
        <button
          type="button"
          className="link"
          onClick={onClose}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
