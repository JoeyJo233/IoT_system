import { useMemo } from "react";
import type { Reading, SensorStatus } from "../api/types";
import { TYPE_META } from "../data/sensors";

const W = 520;
const H = 300;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 32;
const MAX_POINTS = 240;

interface Props {
  history: Reading[];
  spec: SensorStatus | null;
  status: "idle" | "loading" | "ok" | "error";
}

export default function HistoryChart({ history, spec, status }: Props) {
  // Downsample newest-N so the SVG stays legible even if Mongo returns 10k points.
  const pts = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length <= MAX_POINTS) return sorted;
    return sorted.slice(sorted.length - MAX_POINTS);
  }, [history]);

  const bounds = useMemo(() => computeBounds(pts, spec), [pts, spec]);
  const meta = spec ? TYPE_META[spec.sensorType] : TYPE_META.TEMPERATURE;
  const { min, max, xMin, xMax } = bounds;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const toX = (t: number) => PAD_L + ((t - xMin) / (xMax - xMin || 1)) * plotW;
  const toY = (v: number) =>
    PAD_T + plotH - ((v - min) / (max - min || 1)) * plotH;

  const line =
    pts.length > 1
      ? pts
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${toX(p.timestamp).toFixed(2)} ${toY(p.value).toFixed(2)}`,
          )
          .join(" ")
      : "";

  const area =
    pts.length > 1
      ? `${line} L ${toX(pts[pts.length - 1].timestamp).toFixed(2)} ${H - PAD_B} L ${toX(
          pts[0].timestamp,
        ).toFixed(2)} ${H - PAD_B} Z`
      : "";

  const gradId = `hgrad-${spec?.sensorId ?? "none"}`;

  return (
    <svg
      className="chart-svg chart-svg--tall"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = PAD_T + plotH * (1 - p);
        const v = min + (max - min) * p;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="var(--rule-soft)"
              strokeDasharray={p === 0 ? "0" : "2 3"}
            />
            <text
              x={PAD_L - 8}
              y={y + 4}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={9.5}
              fill="var(--ink-muted)"
            >
              {v.toFixed(spec?.sensorType === "PRESSURE" ? 0 : 1)}
            </text>
          </g>
        );
      })}

      {spec && (
        <text
          x={PAD_L - 36}
          y={PAD_T + 2}
          fontFamily="var(--font-mono)"
          fontSize={9}
          fill="var(--ink-muted)"
        >
          {spec.unit}
        </text>
      )}

      {pts.length > 1 && (
        <>
          <text
            x={PAD_L}
            y={H - 12}
            fontFamily="var(--font-mono)"
            fontSize={9}
            fill="var(--ink-muted)"
          >
            {new Date(xMin).toLocaleTimeString()}
          </text>
          <text
            x={W - PAD_R}
            y={H - 12}
            textAnchor="end"
            fontFamily="var(--font-mono)"
            fontSize={9}
            fill="var(--ink-muted)"
          >
            {new Date(xMax).toLocaleTimeString()}
          </text>
        </>
      )}

      {pts.length < 2 && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fontFamily="var(--font-body)"
          fontSize={12}
          fill="var(--ink-muted)"
        >
          {status === "loading"
            ? `Fetching history for ${spec?.sensorId ?? ""}…`
            : status === "error"
              ? "Backend error while fetching history."
              : `No history yet for ${spec?.sensorId ?? "this sensor"}.`}
        </text>
      )}

      {pts.length > 1 && (
        <>
          <path d={area} fill={`url(#${gradId})`} />
          <path
            d={line}
            fill="none"
            stroke={meta.color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {(() => {
            const p = pts[pts.length - 1];
            return (
              <g>
                <circle cx={toX(p.timestamp)} cy={toY(p.value)} r={3.5} fill={meta.color} />
                <circle
                  cx={toX(p.timestamp)}
                  cy={toY(p.value)}
                  r={8}
                  fill="none"
                  stroke={meta.color}
                  strokeOpacity={0.25}
                />
              </g>
            );
          })()}
        </>
      )}
    </svg>
  );
}

function computeBounds(pts: Reading[], spec: SensorStatus | null) {
  if (pts.length === 0) {
    return {
      min: spec?.minValue ?? 0,
      max: spec?.maxValue ?? 1,
      xMin: Date.now() - 60_000,
      xMax: Date.now(),
    };
  }
  const values = pts.map((h) => h.value);
  const times = pts.map((h) => h.timestamp);
  const rawMin = Math.min(...values, spec?.minValue ?? Infinity);
  const rawMax = Math.max(...values, spec?.maxValue ?? -Infinity);
  const pad = (rawMax - rawMin) * 0.08;
  return {
    min: rawMin - pad,
    max: rawMax + pad,
    xMin: Math.min(...times),
    xMax: Math.max(...times),
  };
}
