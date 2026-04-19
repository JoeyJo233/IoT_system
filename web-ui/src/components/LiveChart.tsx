import { useMemo } from "react";
import { ALL_TYPES, TYPE_META } from "../data/sensors";
import type { SensorType } from "../types";

interface Snapshot {
  sensors: Record<
    string,
    { history: { value: number; timestamp: number }[]; spec: { type: SensorType; min: number; max: number } }
  >;
}

const W = 720;
const H = 260;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

export default function LiveChart({ state }: { state: Snapshot }) {
  const series = useMemo(() => buildSeries(state), [state]);

  const xMin = series.xMin;
  const xMax = series.xMax;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const yTicks = 4;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Y grid */}
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

      {/* Y labels (normalized 0–100%) */}
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

      {/* Axis labels */}
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
      <text
        x={PAD_L}
        y={H - 8}
        fontFamily="var(--font-mono)"
        fontSize={9}
        fill="var(--ink-muted)"
      >
        −{Math.round((xMax - xMin) / 1000)}s
      </text>

      {/* Type series */}
      {ALL_TYPES.map((t) => {
        const s = series.byType[t];
        if (!s || s.length < 2) return null;
        const meta = TYPE_META[t];
        const path = buildPath(s, xMin, xMax, plotW, plotH);
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
            {/* last-point marker */}
            {s.length > 0 &&
              (() => {
                const last = s[s.length - 1];
                const x = PAD_L + ((last.timestamp - xMin) / (xMax - xMin || 1)) * plotW;
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

function buildSeries(state: Snapshot) {
  const byType: Record<SensorType, { timestamp: number; normalized: number }[]> = {
    TEMPERATURE: [],
    HUMIDITY: [],
    PRESSURE: [],
    VIBRATION: [],
  };

  let xMin = Infinity;
  let xMax = -Infinity;

  for (const s of Object.values(state.sensors)) {
    const { type, min, max } = s.spec;
    const span = max - min || 1;
    for (const h of s.history) {
      const n = Math.max(0, Math.min(1, (h.value - min) / span));
      byType[type].push({ timestamp: h.timestamp, normalized: n });
      if (h.timestamp < xMin) xMin = h.timestamp;
      if (h.timestamp > xMax) xMax = h.timestamp;
    }
  }

  // sort each series by timestamp so the polyline is continuous
  (Object.keys(byType) as SensorType[]).forEach((t) => {
    byType[t].sort((a, b) => a.timestamp - b.timestamp);
  });

  if (!isFinite(xMin)) xMin = Date.now() - 30_000;
  if (!isFinite(xMax)) xMax = Date.now();
  if (xMax - xMin < 5000) xMax = xMin + 5000;

  return { byType, xMin, xMax };
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
