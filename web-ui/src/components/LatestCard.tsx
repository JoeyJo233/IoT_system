import { useEffect, useState } from "react";
import type { SensorState } from "../types";
import { TYPE_META } from "../data/sensors";

interface Props {
  state: SensorState;
  selected?: boolean;
  onClick?: () => void;
}

export default function LatestCard({ state, selected, onClick }: Props) {
  const { spec, latest, history, running } = state;
  const meta = TYPE_META[spec.type];
  const [pulse, setPulse] = useState(false);

  // Trigger freshness tick on new reading
  useEffect(() => {
    if (!latest) return;
    setPulse(true);
    const h = window.setTimeout(() => setPulse(false), 250);
    return () => clearTimeout(h);
  }, [latest?.timestamp]);

  const displayValue = latest?.value ?? spec.min;

  return (
    <article
      className={`reading-card ${spec.hot ? "reading-card--hot" : ""}`}
      onClick={onClick}
      style={
        {
          ["--type-color" as string]: meta.color,
          cursor: onClick ? "pointer" : "default",
          outline: selected ? `2px solid ${meta.color}` : "none",
          outlineOffset: selected ? "-2px" : "0",
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
            {spec.id.replace("sensor-", "")}
          </div>
        </div>
        <span
          className={`pill ${running ? "ok" : "warn"}`}
          style={{ fontSize: 9 }}
        >
          <span className="dot" />
          {running ? spec.location : "paused"}
        </span>
      </div>

      <div className="reading-card__value num">
        {displayValue.toFixed(spec.type === "PRESSURE" ? 1 : 2)}
        <small>{spec.unit}</small>
      </div>

      <div className="reading-card__spark">
        <Spark history={history.slice(-32)} color={meta.color} min={spec.min} max={spec.max} />
      </div>

      <div className="reading-card__foot">
        <span>
          {meta.cadence} · n={state.count.toLocaleString()}
        </span>
        <span
          className={`reading-card__tick ${pulse ? "fresh" : ""}`}
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
  history: { value: number }[];
  color: string;
  min: number;
  max: number;
}) {
  if (history.length < 2) {
    return (
      <svg viewBox="0 0 120 32" width="100%" height="32" preserveAspectRatio="none">
        <line x1={0} y1={16} x2={120} y2={16} stroke="var(--rule)" strokeDasharray="2 3" />
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

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
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
