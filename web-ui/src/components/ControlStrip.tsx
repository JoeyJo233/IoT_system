import type { SensorState } from "../types";
import { SENSORS, TYPE_META } from "../data/sensors";

interface Props {
  state: {
    running: boolean;
    sensors: Record<string, SensorState>;
  };
  onStart(): void;
  onStop(): void;
  onToggle(id: string): void;
}

export default function ControlStrip({ state, onStart, onStop, onToggle }: Props) {
  const anyRunning = Object.values(state.sensors).some((s) => s.running);

  return (
    <section className="control-strip">
      <div className="global-control">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Simulation
        </div>
        <h3>Control the front-end simulator</h3>
        <p>
          This page ships with a client-side simulator so it works standalone.
          The buttons below drive that local stream. Real producer/consumer
          control will go through a backend API — outlined but not yet wired.
        </p>
        <div className="control-buttons">
          <button
            className="btn btn--primary"
            onClick={onStart}
            disabled={anyRunning && state.running}
          >
            ▶ Start simulation
          </button>
          <button
            className="btn btn--danger"
            onClick={onStop}
            disabled={!anyRunning}
          >
            ■ Stop all
          </button>
          <button
            className="btn"
            disabled
            title="Requires a backend control API"
          >
            ⎌ Reset pipeline <span className="btn__flag">Planned</span>
          </button>
        </div>
      </div>

      <div className="per-sensor">
        <div className="per-sensor__head">
          <h4>Per-sensor control</h4>
          <span>8 devices · local stream</span>
        </div>
        {SENSORS.map((spec) => {
          const s = state.sensors[spec.id];
          const meta = TYPE_META[spec.type];
          const rate = s.running ? 1000 / spec.intervalMs : 0;
          return (
            <div
              key={spec.id}
              className="per-row"
              style={
                { ["--type-color" as string]: meta.color } as React.CSSProperties
              }
            >
              <span
                className={`per-row__tick ${s.running ? "" : "paused"}`}
                style={{
                  animation: s.running
                    ? "pulseDot 1.4s ease-in-out infinite"
                    : "none",
                  boxShadow: s.running
                    ? `0 0 0 3px ${meta.color}20`
                    : "none",
                }}
              />
              <span className="per-row__name">
                {spec.id.replace("sensor-", "")}
              </span>
              <span style={{ color: "var(--ink-muted)", fontSize: 11.5 }}>
                {meta.label} · {spec.location}
              </span>
              <span className="per-row__rate">
                {rate ? `${rate.toFixed(2)}/s` : "paused"}
              </span>
              <span className="per-row__toggle">
                <button
                  className={`toggle-btn ${s.running ? "on" : ""}`}
                  onClick={() => onToggle(spec.id)}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: s.running ? meta.color : "var(--ink-faint)",
                    }}
                  />
                  {s.running ? "running" : "start"}
                </button>
              </span>
            </div>
          );
        })}

        <div className="control-disclaimer">
          <span>
            · backend control API · Planned · requires /api/simulation/{"{"}start,pause,stop{"}"}
          </span>
          <span>· real kafka pipeline not driven from this UI yet ·</span>
        </div>
      </div>
    </section>
  );
}
