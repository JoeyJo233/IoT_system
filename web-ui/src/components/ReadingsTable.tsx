import type { Reading } from "../api/types";
import { TYPE_META } from "../data/sensors";

interface Props {
  readings: Reading[];
  loading?: boolean;
  error?: Error | null;
}

export default function ReadingsTable({ readings, loading, error }: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="readings-table">
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Time</th>
            <th style={{ width: "14%" }}>Type</th>
            <th style={{ width: "20%" }}>Sensor</th>
            <th style={{ width: "18%" }}>Location</th>
            <th style={{ width: "16%", textAlign: "right" }}>Value</th>
            <th style={{ width: "10%" }}>Unit</th>
            <th style={{ width: "10%", textAlign: "right" }}>Δt</th>
          </tr>
        </thead>
        <tbody>
          {readings.length === 0 && (
            <tr>
              <td
                colSpan={7}
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "var(--ink-muted)",
                }}
              >
                {loading
                  ? "Loading…"
                  : error
                    ? `Backend error: ${error.message}`
                    : "No readings yet. Start the simulation on the producer."}
              </td>
            </tr>
          )}
          {readings.map((r, i) => {
            const meta = TYPE_META[r.sensorType];
            const next = readings[i + 1];
            const dt = next ? r.timestamp - next.timestamp : 0;
            return (
              <tr key={`${r.sensorId}-${r.timestamp}-${i}`}>
                <td>{formatTime(r.timestamp)}</td>
                <td>
                  <span
                    className="type-tag"
                    style={
                      { ["--type-color" as string]: meta.color } as React.CSSProperties
                    }
                  >
                    <span className="sq" />
                    {meta.kicker}
                  </span>
                </td>
                <td style={{ color: "var(--ink)" }}>{r.sensorId}</td>
                <td>{r.location}</td>
                <td className="table-value" style={{ textAlign: "right" }}>
                  {r.value.toFixed(r.sensorType === "PRESSURE" ? 1 : 2)}
                </td>
                <td>{r.unit}</td>
                <td style={{ textAlign: "right", color: "var(--ink-faint)" }}>
                  {dt ? `+${(dt / 1000).toFixed(2)}s` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(
    d.getMilliseconds(),
  ).padStart(3, "0")}`;
}
