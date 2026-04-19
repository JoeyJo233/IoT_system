import { useMemo, useState } from "react";
import type { Reading, SensorStatus, SensorType } from "../api/types";
import { simulationApi } from "../api/client";
import {
  useHistory,
  useLatestMany,
  useLiveBufferFromLatest,
  useRecentByTypes,
  useSimulationStatus,
} from "../hooks/useSensors";
import { TYPE_META, ALL_TYPES } from "../data/sensors";
import LatestCard from "../components/LatestCard";
import LiveChart from "../components/LiveChart";
import HistoryChart from "../components/HistoryChart";
import ReadingsTable from "../components/ReadingsTable";
import ControlStrip from "../components/ControlStrip";
import BackendBanner from "../components/BackendBanner";

export default function DataScreen() {
  const sim = useSimulationStatus();
  const sensors: SensorStatus[] = sim.data?.sensors ?? [];
  const sensorIds = useMemo(() => sensors.map((s) => s.sensorId), [sensors]);

  const [typeFilter, setTypeFilter] = useState<"ALL" | SensorType>("ALL");
  const [selectedSensor, setSelectedSensor] = useState<string>("sensor-vibr-001");

  const latest = useLatestMany(sensorIds);
  const history = useHistory(selectedSensor);
  const recent = useRecentByTypes(ALL_TYPES, 24);

  const liveBuffer = useLiveBufferFromLatest(latest.data ?? null);

  const visibleSensors = useMemo(() => {
    if (typeFilter === "ALL") return sensors;
    return sensors.filter((s) => s.sensorType === typeFilter);
  }, [sensors, typeFilter]);

  const typeCounts = useMemo(() => {
    const c: Record<SensorType, number> = {
      TEMPERATURE: 0,
      HUMIDITY: 0,
      PRESSURE: 0,
      VIBRATION: 0,
    };
    for (const s of sensors) c[s.sensorType]++;
    return c;
  }, [sensors]);

  const rate = sim.data?.messageRatePerSecond ?? 0;

  const backendError =
    sim.error ?? latest.error ?? history.error ?? recent.error;
  const everLoaded = sim.status === "ok" || sim.data != null;

  return (
    <>
      <section className="screen-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Chapter 02 · Live Data Screen
          </div>
          <h1>
            Eight sensors. Four cadences.
            <br />
            One scrolling window into the system.
          </h1>
          <p>
            All numbers on this page come from the consumer service REST API
            (Redis latest / Mongo history). Controls on the bottom right drive
            the producer service directly.
          </p>
        </div>
        <div>
          <span className={`live-chip ${!everLoaded ? "live-chip--warn" : ""}`}>
            <span className="blink" />
            {sim.data?.running ? "live" : everLoaded ? "paused" : "connecting"}
            {sim.data ? ` · ${rate.toFixed(1)} msg/s` : ""}
          </span>
        </div>
      </section>

      <BackendBanner
        simError={sim.error}
        otherError={backendError !== sim.error ? backendError : null}
        loading={sim.status === "loading" && !everLoaded}
      />

      <div className="filterbar">
        <span className="filterbar__label">Sensor type</span>
        <button
          className={`chip ${typeFilter === "ALL" ? "active" : ""}`}
          onClick={() => setTypeFilter("ALL")}
        >
          All <span className="chip__count">{sensors.length}</span>
        </button>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            className={`chip ${typeFilter === t ? "active" : ""}`}
            onClick={() => setTypeFilter(t)}
          >
            {TYPE_META[t].label}{" "}
            <span className="chip__count">{typeCounts[t]}</span>
          </button>
        ))}
        <div className="filterbar__spacer" />
        <span className="filterbar__label">Inspected</span>
        <select
          className="chip"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            letterSpacing: "0.04em",
            padding: "5px 12px",
            background: "var(--paper)",
            border: "1px solid var(--rule)",
          }}
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value)}
          disabled={sensors.length === 0}
        >
          {sensors.map((s) => (
            <option key={s.sensorId} value={s.sensorId}>
              {s.sensorId} — {s.location}
            </option>
          ))}
        </select>
      </div>

      <div className="latest-grid">
        {sensors.length === 0 && (
          <EmptyGrid loading={!everLoaded} error={sim.error} />
        )}
        {visibleSensors.map((spec) => (
          <LatestCard
            key={spec.sensorId}
            spec={spec}
            reading={latest.data?.[spec.sensorId] ?? null}
            onClick={() => setSelectedSensor(spec.sensorId)}
            selected={selectedSensor === spec.sensorId}
            lastPollOk={latest.status !== "error"}
          />
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-panel">
          <div className="chart-panel__head">
            <div className="chart-panel__title">
              <h3>Live trend — all types</h3>
              <p>
                Rolling window of latest readings grouped by type. Sourced
                from per-sensor /latest polls.
              </p>
            </div>
            <div className="chart-panel__legend">
              {ALL_TYPES.map((t) => (
                <span key={t} className="legend-swatch">
                  <span
                    className="legend-swatch__box"
                    style={{ background: TYPE_META[t].color }}
                  />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>
          <LiveChart
            byType={liveBuffer}
            ranges={buildTypeRanges(sensors)}
          />
        </div>

        <div className="chart-panel">
          <div className="chart-panel__head">
            <div className="chart-panel__title">
              <h3>History — {selectedSensor}</h3>
              <p>
                {history.data
                  ? `${history.data.length} readings · ${resolveLocation(sensors, selectedSensor)}`
                  : history.status === "loading"
                    ? "loading history…"
                    : "no data yet"}
              </p>
            </div>
            <div className="chart-panel__legend">
              <span className="legend-swatch">
                <span
                  className="legend-swatch__box"
                  style={{
                    background:
                      TYPE_META[
                        resolveType(sensors, selectedSensor) ?? "TEMPERATURE"
                      ].color,
                  }}
                />
                {TYPE_META[
                  resolveType(sensors, selectedSensor) ?? "TEMPERATURE"
                ].label}
              </span>
            </div>
          </div>
          <HistoryChart
            history={history.data ?? []}
            spec={sensors.find((s) => s.sensorId === selectedSensor) ?? null}
            status={history.status}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Recent readings
            </div>
            <div className="panel__title">As they arrived</div>
            <div className="panel__desc">
              Newest on top · merged from /api/sensors/type/{"{"}type{"}"} ·{" "}
              {recent.data?.length ?? 0} rows
            </div>
          </div>
          <span className={`pill ${recent.status === "error" ? "err" : "ok"}`}>
            <span
              className="dot"
              style={{
                background:
                  recent.status === "error" ? "var(--err)" : "var(--accent)",
              }}
            />
            {recent.status === "error" ? "stale" : "streaming"}
          </span>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <ReadingsTable
            readings={(recent.data ?? []).slice(0, 24)}
            loading={recent.status === "loading" && !recent.data}
            error={recent.error}
          />
        </div>
      </div>

      <ControlStrip
        sensors={sensors}
        running={sim.data?.running ?? false}
        loading={!everLoaded}
        onStart={() => simulationApi.startAll().finally(sim.refetch)}
        onStop={() => simulationApi.stopAll().finally(sim.refetch)}
        onToggle={(id, run) =>
          (run
            ? simulationApi.startOne(id)
            : simulationApi.stopOne(id)
          ).finally(sim.refetch)
        }
      />
    </>
  );
}

function buildTypeRanges(
  sensors: SensorStatus[],
): Record<SensorType, { min: number; max: number }> {
  const out: Record<SensorType, { min: number; max: number }> = {
    TEMPERATURE: { min: 0, max: 1 },
    HUMIDITY: { min: 0, max: 1 },
    PRESSURE: { min: 0, max: 1 },
    VIBRATION: { min: 0, max: 1 },
  };
  for (const s of sensors) {
    const existing = out[s.sensorType];
    if (!existing || existing.max === 1) {
      out[s.sensorType] = { min: s.minValue, max: s.maxValue };
    } else {
      out[s.sensorType] = {
        min: Math.min(existing.min, s.minValue),
        max: Math.max(existing.max, s.maxValue),
      };
    }
  }
  return out;
}

function resolveLocation(sensors: SensorStatus[], id: string) {
  return sensors.find((s) => s.sensorId === id)?.location ?? "—";
}
function resolveType(sensors: SensorStatus[], id: string): SensorType | undefined {
  return sensors.find((s) => s.sensorId === id)?.sensorType;
}

function EmptyGrid({
  loading,
  error,
}: {
  loading: boolean;
  error: Error | null;
}) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        padding: "32px 20px",
        textAlign: "center",
        border: "1px dashed var(--rule)",
        borderRadius: 12,
        color: "var(--ink-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.1em",
      }}
    >
      {loading
        ? "· connecting to producer on /api/simulation ·"
        : error
          ? "· backend unreachable — controls disabled ·"
          : "· no sensors registered ·"}
    </div>
  );
}
// Silence unused-import for Reading until referenced elsewhere
export type { Reading };
