import { useMemo } from "react";
import { ALL_TYPES, TYPE_META } from "../data/sensors";
import type { Reading, SensorType } from "../api/types";

interface Props {
  byType: Record<SensorType, Reading[]>;
  ranges: Record<SensorType, { min: number; max: number }>;
}

const W = 720;
const H = 260;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

export default function LiveChart({ byType, ranges }: Props) {
  const series = useMemo(() => buildSeries(byType, ranges), [byType, ranges]);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const yTicks = 4;

  const totalPoints = Object.values(byType).reduce((acc, s) => acc + s.length, 0);

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {[...Array(yTicks + 1)].map((_, i) => {
        const y = PAD_T + (plotH * i) / yTicks;
        return (
          <line
            key={`gy-${i}`}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y}
            y2={y}
            stroke="var(--rule-soft)"
            strokeDasharray={i === yTicks ? "0" : "2 3"}
          />
        );
      })}

      {[0, 25, 50, 75, 100].map((p, i) => {
        const y = PAD_T + plotH - (plotH * i) / 4;
        return (
          <text
            key={`yl-${i}`}
            x={PAD_L - 8}
            y={y + 4}
            textAnchor="end"
            fontFamily="var(--font-mono)"
            fontSize={9.5}
            fill="var(--ink-muted)"
          >
            {p}%
          </text>
        );
      })}

      <text
        x={PAD_L - 32}
        y={PAD_T + 4}
        fontFamily="var(--font-mono)"
        fontSize={9}
        fill="var(--ink-muted)"
      >
        RANGE
      </text>
      <text
        x={W - PAD_R}
        y={H - 8}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize={9}
        fill="var(--ink-muted)"
      >
        now
      </text>

      {totalPoints < 2 && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fontFamily="var(--font-body)"
          fontSize={12}
          fill="var(--ink-muted)"
        >
          Waiting for the first few polls of /api/sensors/*/latest…
        </text>
      )}

      {ALL_TYPES.map((t) => {
        const s = series.byType[t];
        if (!s || s.length < 2) return null;
        const meta = TYPE_META[t];
        const path = buildPath(s, series.xMin, series.xMax, plotW, plotH);
        return (
          <g key={t}>
            <path
              d={path}
              fill="none"
              stroke={meta.color}
              strokeWidth={t === "VIBRATION" ? 1.6 : 1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.92}
              style={{
                filter:
                  t === "VIBRATION"
                    ? `drop-shadow(0 0 3px ${meta.color}66)`
                    : "none",
              }}
            />
            {(() => {
              const last = s[s.length - 1];
              const x =
                PAD_L +
                ((last.timestamp - series.xMin) /
                  (series.xMax - series.xMin || 1)) *
                  plotW;
              const y = PAD_T + plotH - last.normalized * plotH;
              return (
                <g>
                  <circle cx={x} cy={y} r={3} fill={meta.color} />
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill="none"
                    stroke={meta.color}
                    strokeOpacity={0.25}
                  />
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

function buildSeries(
  byType: Record<SensorType, Reading[]>,
  ranges: Record<SensorType, { min: number; max: number }>,
) {
  const result: Record<SensorType, { timestamp: number; normalized: number }[]> = {
    TEMPERATURE: [],
    HUMIDITY: [],
    PRESSURE: [],
    VIBRATION: [],
  };

  let xMin = Infinity;
  let xMax = -Infinity;

  for (const t of ALL_TYPES) {
    const { min, max } = ranges[t];
    const span = max - min || 1;
    for (const r of byType[t]) {
      const n = Math.max(0, Math.min(1, (r.value - min) / span));
      result[t].push({ timestamp: r.timestamp, normalized: n });
      if (r.timestamp < xMin) xMin = r.timestamp;
      if (r.timestamp > xMax) xMax = r.timestamp;
    }
    result[t].sort((a, b) => a.timestamp - b.timestamp);
  }

  if (!isFinite(xMin)) xMin = Date.now() - 30_000;
  if (!isFinite(xMax)) xMax = Date.now();
  if (xMax - xMin < 5_000) xMax = xMin + 5_000;

  return { byType: result, xMin, xMax };
}

function buildPath(
  points: { timestamp: number; normalized: number }[],
  xMin: number,
  xMax: number,
  plotW: number,
  plotH: number,
) {
  const span = xMax - xMin || 1;
  return points
    .map((p, i) => {
      const x = PAD_L + ((p.timestamp - xMin) / span) * plotW;
      const y = PAD_T + plotH - p.normalized * plotH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
