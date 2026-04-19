import { useState } from "react";
import type { SensorStatus } from "../api/types";
import { TYPE_META } from "../data/sensors";

interface Props {
  sensors: SensorStatus[];
  running: boolean;
  loading: boolean;
  onStart(): void;
  onStop(): void;
  onToggle(id: string, nextRunning: boolean): void;
}

/**
 * Thin control surface. Every button maps 1:1 to a real endpoint on the
 * producer service — no fake toggles, no client-only state.
 */
export default function ControlStrip({
  sensors,
  running,
  loading,
  onStart,
  onStop,
  onToggle,
}: Props) {
  const [pending, setPending] = useState<string | null>(null);

  const runWithPending = async (key: string, fn: () => void | Promise<void>) => {
    setPending(key);
    try {
      await fn();
    } finally {
      setPending(null);
    }
  };

  const anyRunning = sensors.some((s) => s.running);
  const disabledForGlobal = loading || sensors.length === 0;

  return (
    <section className="control-strip">
      <div className="global-control">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Simulation
        </div>
        <h3>Control the producer-side simulator</h3>
        <p>
          These buttons call <code>/api/simulation/*</code> on the producer
          service. Stopping a sensor cancels its scheduled task — no more
          Kafka records until you start it again.
        </p>
        <div className="control-buttons">
          <button
            className="btn btn--primary"
            onClick={() => runWithPending("start-all", onStart)}
            disabled={disabledForGlobal || (anyRunning && running)}
          >
            ▶ Start all
          </button>
          <button
            className="btn btn--danger"
            onClick={() => runWithPending("stop-all", onStop)}
            disabled={disabledForGlobal || !anyRunning}
          >
            ■ Stop all
          </button>
          <button
            className="btn"
            disabled
            title="Would drain Kafka / reset Redis / truncate Mongo — not implemented"
          >
            ⎌ Reset pipeline <span className="btn__flag">Planned</span>
          </button>
        </div>
      </div>

      <div className="per-sensor">
        <div className="per-sensor__head">
          <h4>Per-sensor control</h4>
          <span>
            {sensors.length} devices · {anyRunning ? "some running" : "all paused"}
          </span>
        </div>
        {sensors.length === 0 && (
          <div
            style={{
              padding: "16px 0",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              letterSpacing: "0.08em",
              color: "var(--ink-faint)",
            }}
          >
            · producer service unreachable — no catalog ·
          </div>
        )}
        {sensors.map((spec) => {
          const meta = TYPE_META[spec.sensorType];
          const rate = spec.running ? 1000 / spec.intervalMs : 0;
          const key = `toggle-${spec.sensorId}`;
          return (
            <div
              key={spec.sensorId}
              className="per-row"
              style={
                { ["--type-color" as string]: meta.color } as React.CSSProperties
              }
            >
              <span
                className={`per-row__tick ${spec.running ? "" : "paused"}`}
                style={{
                  animation: spec.running
                    ? "pulseDot 1.4s ease-in-out infinite"
                    : "none",
                  boxShadow: spec.running ? `0 0 0 3px ${meta.color}20` : "none",
                }}
              />
              <span className="per-row__name">
                {spec.sensorId.replace("sensor-", "")}
              </span>
              <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                {meta.label} · {spec.location}
              </span>
              <span className="per-row__rate">
                {rate ? `${rate.toFixed(2)}/s` : "paused"}
              </span>
              <span className="per-row__toggle">
                <button
                  className={`toggle-btn ${spec.running ? "on" : ""}`}
                  disabled={loading || pending === key}
                  onClick={() =>
                    runWithPending(key, () => onToggle(spec.sensorId, !spec.running))
                  }
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: spec.running ? meta.color : "var(--ink-faint)",
                    }}
                  />
                  {pending === key ? "…" : spec.running ? "stop" : "start"}
                </button>
              </span>
            </div>
          );
        })}

        <div className="control-disclaimer">
          <span>
            · backend: producer-service · endpoints ·
            /api/simulation/{"{"}start,stop{"}"} and
            /api/simulation/sensors/{"{"}id{"}"}/{"{"}start,stop{"}"}
          </span>
          <span>· reset pipeline not implemented ·</span>
        </div>
      </div>
    </section>
  );
}
