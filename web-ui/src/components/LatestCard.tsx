import { useEffect, useMemo, useRef, useState } from "react";
import type { Reading, SensorStatus } from "../api/types";
import { TYPE_META } from "../data/sensors";

interface Props {
  spec: SensorStatus;
  reading: Reading | null;
  selected?: boolean;
  onClick?: () => void;
  lastPollOk?: boolean;
}

/**
 * Shows the latest reading for a single sensor. Keeps a tiny in-memory
 * ring buffer of recent readings (driven by parent polls) so the sparkline
 * has something to draw without spending an extra /history request.
 */
export default function LatestCard({
  spec,
  reading,
  selected,
  onClick,
  lastPollOk = true,
}: Props) {
  const meta = TYPE_META[spec.sensorType];
  const bufferRef = useRef<Reading[]>([]);
  const [pulse, setPulse] = useState(false);

  // Push new, unique readings into the sparkline buffer.
  useEffect(() => {
    if (!reading) return;
    const buf = bufferRef.current;
    const last = buf[buf.length - 1];
    if (!last || last.timestamp !== reading.timestamp) {
      buf.push(reading);
      if (buf.length > 32) buf.shift();
      setPulse(true);
      const h = window.setTimeout(() => setPulse(false), 260);
      return () => clearTimeout(h);
    }
  }, [reading?.timestamp]);

  const series = useMemo(() => bufferRef.current.slice(), [reading?.timestamp]);
  const hot = spec.sensorType === "VIBRATION";

  return (
    <article
      className={`reading-card ${hot ? "reading-card--hot" : ""} ${!spec.running ? "reading-card--paused" : ""}`}
      onClick={onClick}
      style={
        {
          ["--type-color" as string]: meta.color,
          cursor: onClick ? "pointer" : "default",
          outline: selected ? `2px solid ${meta.color}` : "none",
          outlineOffset: selected ? "-2px" : "0",
          opacity: spec.running ? 1 : 0.75,
        } as React.CSSProperties
      }
    >
      <div className="reading-card__head">
        <div>
          <div className="reading-card__type">{meta.kicker}</div>
          <div
            className="reading-card__id"
            style={{ marginTop: 4, color: "var(--ink-muted)" }}
          >
            {spec.sensorId.replace("sensor-", "")}
          </div>
        </div>
        <span
          className={`pill ${spec.running ? "ok" : "warn"}`}
          style={{ fontSize: 9 }}
        >
          <span className="dot" />
          {spec.running ? spec.location : "paused"}
        </span>
      </div>

      <div className="reading-card__value num">
        {reading ? (
          <>
            {reading.value.toFixed(spec.sensorType === "PRESSURE" ? 1 : 2)}
            <small>{spec.unit}</small>
          </>
        ) : (
          <>
            <span style={{ color: "var(--ink-faint)" }}>—</span>
            <small>{spec.unit}</small>
          </>
        )}
      </div>

      <div className="reading-card__spark">
        <Spark
          history={series}
          color={meta.color}
          min={spec.minValue}
          max={spec.maxValue}
        />
      </div>

      <div className="reading-card__foot">
        <span>
          {formatCadence(spec.intervalMs)} ·{" "}
          {reading ? `+${sinceLabel(reading.timestamp)}` : "no data"}
        </span>
        <span
          className={`reading-card__tick ${pulse ? "fresh" : ""}`}
          title={lastPollOk ? "last poll ok" : "last poll failed"}
          aria-hidden
        />
      </div>
    </article>
  );
}

function Spark({
  history,
  color,
  min,
  max,
}: {
  history: Reading[];
  color: string;
  min: number;
  max: number;
}) {
  if (history.length < 2) {
    return (
      <svg viewBox="0 0 120 32" width="100%" height="32" preserveAspectRatio="none">
        <line
          x1={0}
          y1={16}
          x2={120}
          y2={16}
          stroke="var(--rule)"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const w = 120;
  const h = 32;
  const span = max - min || 1;
  const step = w / (history.length - 1);

  const points = history
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p.value - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `M 0,${h} L ${points
    .split(" ")
    .map((p) => p.replace(",", " "))
    .join(" L ")} L ${w},${h} Z`;

  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function formatCadence(ms: number) {
  if (ms >= 1000) return `${ms / 1000}s`;
  return `${ms}ms`;
}

function sinceLabel(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60_000) return `${(diff / 1000).toFixed(1)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}
