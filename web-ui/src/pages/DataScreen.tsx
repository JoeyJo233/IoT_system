import { useMemo, useState } from "react";
import { SENSORS, TYPE_META, ALL_TYPES } from "../data/sensors";
import {
  useSimulator,
  controls,
  recentReadings,
  totalRate,
} from "../data/simulator";
import type { SensorType } from "../types";
import LatestCard from "../components/LatestCard";
import LiveChart from "../components/LiveChart";
import HistoryChart from "../components/HistoryChart";
import ReadingsTable from "../components/ReadingsTable";
import ControlStrip from "../components/ControlStrip";

export default function DataScreen() {
  const state = useSimulator();
  const [typeFilter, setTypeFilter] = useState<"ALL" | SensorType>("ALL");
  const [selectedSensor, setSelectedSensor] = useState<string>(
    "sensor-vibr-001",
  );

  const visibleSensors = useMemo(() => {
    if (typeFilter === "ALL") return SENSORS;
    return SENSORS.filter((s) => s.type === typeFilter);
  }, [typeFilter]);

  const typeCounts = useMemo(() => {
    const c: Record<SensorType, number> = {
      TEMPERATURE: 0,
      HUMIDITY: 0,
      PRESSURE: 0,
      VIBRATION: 0,
    };
    for (const s of SENSORS) c[s.type]++;
    return c;
  }, []);

  const recent = recentReadings(state, 18);
  const rate = totalRate(state);

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
            Latest readings on the left, live traces in the centre, recent
            history below. Vibration is the high-frequency channel — its
            numbers will move faster than your eye wants to follow.
          </p>
        </div>
        <div>
          <span className="live-chip">
            <span className="blink" />
            live · {rate.toFixed(1)} msg/s
          </span>
        </div>
      </section>

      <div className="filterbar">
        <span className="filterbar__label">Sensor type</span>
        <button
          className={`chip ${typeFilter === "ALL" ? "active" : ""}`}
          onClick={() => setTypeFilter("ALL")}
        >
          All <span className="chip__count">8</span>
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
            fontSize: 11,
            letterSpacing: "0.06em",
            padding: "5px 12px",
            background: "var(--paper)",
            border: "1px solid var(--rule)",
          }}
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value)}
        >
          {SENSORS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} — {s.location}
            </option>
          ))}
        </select>
      </div>

      <div className="latest-grid">
        {visibleSensors.map((spec) => (
          <LatestCard
            key={spec.id}
            state={state.sensors[spec.id]}
            onClick={() => setSelectedSensor(spec.id)}
            selected={selectedSensor === spec.id}
          />
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-panel">
          <div className="chart-panel__head">
            <div className="chart-panel__title">
              <h3>Live trend — all types</h3>
              <p>
                Rolling {windowLabel(180)} window, one line per sensor type.
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
          <LiveChart state={state} />
        </div>

        <div className="chart-panel">
          <div className="chart-panel__head">
            <div className="chart-panel__title">
              <h3>History — {selectedSensor}</h3>
              <p>
                Last {state.sensors[selectedSensor]?.history.length ?? 0}{" "}
                readings ·{" "}
                {state.sensors[selectedSensor]?.spec.location}
              </p>
            </div>
            <div className="chart-panel__legend">
              <span className="legend-swatch">
                <span
                  className="legend-swatch__box"
                  style={{
                    background:
                      TYPE_META[
                        state.sensors[selectedSensor]?.spec.type ?? "TEMPERATURE"
                      ].color,
                  }}
                />
                {TYPE_META[
                  state.sensors[selectedSensor]?.spec.type ?? "TEMPERATURE"
                ].label}
              </span>
            </div>
          </div>
          <HistoryChart sensor={state.sensors[selectedSensor]} />
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
              Newest on top. {recent.length} rows shown.
            </div>
          </div>
          <span className="pill">
            <span className="dot" style={{ background: "var(--accent)" }} />
            streaming
          </span>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <ReadingsTable readings={recent} />
        </div>
      </div>

      <ControlStrip
        state={state}
        onStart={() => controls.startAll()}
        onStop={() => controls.stopAll()}
        onToggle={(id) => controls.toggleSensor(id)}
      />
    </>
  );
}

function windowLabel(n: number) {
  if (n < 60) return `${n}-point`;
  return `${n}-point`;
}
