import { useEffect, useState } from "react";
import {
  activeCount,
  ratePerSecond,
  totalRate,
  useSimulator,
} from "../data/simulator";
import { ALL_TYPES, TYPE_META } from "../data/sensors";
import FlowDiagram from "../components/FlowDiagram";

export default function SystemFlow() {
  const state = useSimulator();
  const rate = totalRate(state);
  const active = activeCount(state);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const h = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.totals.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(h);
  }, [state.totals.startedAt]);

  return (
    <>
      <section className="flow-hero">
        <div>
          <div className="flow-hero__kicker">
            <span className="eyebrow">Chapter 01 · System Flow</span>
            <span className="pill ghost">
              <span className="dot" /> Reference architecture
            </span>
          </div>
          <h1>
            A field <em>atlas</em> of how a
            <br />
            sensor reading becomes
            <br />
            a queryable fact.
          </h1>
          <p className="flow-hero__lede">
            Eight simulated sensors publish at four different cadences. The
            pipeline behind them is asynchronous on purpose — Kafka absorbs
            bursts, Redis answers the hot path, and Mongo keeps every reading
            for later. This page walks through that shape without pretending to
            be a monitoring console.
          </p>
        </div>

        <div className="flow-hero__stats">
          <div className="stat-cell">
            <div className="stat-cell__label">Sensors running</div>
            <div className="stat-cell__value num">
              {active}
              <small>/ 8</small>
            </div>
            <div className="stat-cell__note">
              Across four types and four locations.
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-cell__label">Producer throughput</div>
            <div className="stat-cell__value num">
              {rate.toFixed(1)}
              <small>msg / s</small>
            </div>
            <div className="stat-cell__note">
              Sum of each sensor’s scheduled cadence.
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-cell__label">Messages produced</div>
            <div className="stat-cell__value num">
              {state.totals.produced.toLocaleString()}
            </div>
            <div className="stat-cell__note">
              Since {new Date(state.totals.startedAt).toLocaleTimeString()}.
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-cell__label">Session uptime</div>
            <div className="stat-cell__value num">
              {formatElapsed(elapsed)}
            </div>
            <div className="stat-cell__note">Client-side simulator only.</div>
          </div>
        </div>
      </section>

      <section className="flow-figure">
        <div className="flow-figure__caption">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Figure 1 · Pipeline
            </div>
            <h2>From sensor threads to durable history</h2>
            <p>
              Each sensor runs on its own schedule. Every reading passes the
              same five stages, but the right-side storage split is what makes
              both <em>fast</em> and <em>complete</em> reads possible.
            </p>
          </div>
          <div className="flow-figure__legend">
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-sensor-soft)" }}
              />
              Sensors
            </span>
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-producer-soft)" }}
              />
              Producer
            </span>
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-kafka-soft)" }}
              />
              Kafka
            </span>
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-consumer-soft)" }}
              />
              Consumer
            </span>
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-redis-soft)" }}
              />
              Redis
            </span>
            <span className="legend-item">
              <span
                className="swatch"
                style={{ background: "var(--node-mongo-soft)" }}
              />
              MongoDB
            </span>
          </div>
        </div>

        <FlowDiagram />

        <div className="flow-details">
          <NodeDetail
            color="var(--node-sensor)"
            tag="01 · Sensors"
            title="Simulated devices"
            role="Producer threads"
            desc="Eight virtual sensors across four types. Temperature sips every 10 s; vibration screams every 500 ms."
          />
          <NodeDetail
            color="var(--node-producer)"
            tag="02 · Producer"
            title="Spring Boot Producer"
            role="kafka-publisher"
            desc="Serializes each reading as JSON and publishes to the iot-sensor-data topic, keyed by sensorId."
          />
          <NodeDetail
            color="var(--node-kafka)"
            tag="03 · Kafka"
            title="Durable buffer"
            role="decoupling layer"
            desc="Absorbs ingestion bursts and decouples Producer from storage. Consumer lag is measured here."
          />
          <NodeDetail
            color="var(--node-consumer)"
            tag="04 · Consumer"
            title="Storage writer"
            role="fan-out"
            desc="Fans each message out to Redis (latest) and MongoDB (history) inside one logical handler."
          />
          <NodeDetail
            color="var(--node-redis)"
            tag="05 · Redis"
            title="Hot path cache"
            role="latest-value store"
            desc="Keys sensor:latest:{id}. Backing store for the hot /latest REST endpoint."
          />
          <NodeDetail
            color="var(--node-mongo)"
            tag="06 · MongoDB"
            title="History of record"
            role="durable timeline"
            desc="sensor_readings with compound indexes on (sensorId, timestamp) for range scans by device."
          />
        </div>
      </section>

      <section className="notes-grid">
        <div className="notes-prose">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Chapter 01.2 · Why this shape
          </div>
          <h2>
            Three choices do most of the work: a queue between everything, a
            cache for <em>right now</em>, a database for <em>ever since</em>.
          </h2>
          <p>
            A 500 ms vibration sensor will happily generate far more writes
            than any single MongoDB node wants to accept during a burst. Put
            Kafka in the middle and the Producer is no longer pinned to disk
            latency; the Consumer can apply its own backpressure on its own
            terms.
          </p>
          <p>
            Once data lands, <strong>Redis</strong> handles the most common
            question — <em>“what is this sensor showing right now?”</em> — in
            microseconds, while <strong>MongoDB</strong> answers the rarer but
            heavier question: <em>“what has it been showing all day?”</em>
          </p>
          <p>
            The split isn’t about scale. It’s about asking two very different
            questions with two very different access patterns, and refusing to
            make either of them pay for the other.
          </p>
        </div>

        <aside className="notes-aside">
          <KeyPoint
            n="i"
            title="Kafka as a shock absorber"
            body="The Producer never waits on storage. If Mongo slows down, Kafka buffers; once the Consumer catches up, nothing is lost."
          />
          <KeyPoint
            n="ii"
            title="Redis for the common question"
            body="The /latest endpoint reads Redis first and falls back to Mongo only on cold keys. Predictable p99 latency for the hot path."
          />
          <KeyPoint
            n="iii"
            title="Mongo for the long tail"
            body="Compound indexes on (sensorId, ts) and (sensorType, ts) keep history queries cheap even as the collection grows."
          />
          <KeyPoint
            n="iv"
            title="Mixed cadences, one topic"
            body="A single topic carries four cadences. Keying by sensorId preserves per-device ordering inside a partition."
          />
        </aside>
      </section>

      <section className="cadence">
        <div className="cadence__head">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Figure 2 · Cadence
          </div>
          <h3>Four heartbeats, one pipeline</h3>
          <p>
            Each row’s tick fires at the cadence of its sensor type. Notice
            how vibration dominates — it alone generates more traffic than the
            other three combined.
          </p>
        </div>
        <div className="cadence__rows">
          {ALL_TYPES.map((t) => {
            const r = ratePerSecond(t, state);
            const meta = TYPE_META[t];
            const pctOfMax = Math.min(
              100,
              (r / Math.max(0.01, ratePerSecond("VIBRATION", state))) * 100,
            );
            return (
              <div className="cadence-row" key={t}>
                <span
                  className="tick"
                  style={
                    {
                      background: meta.color,
                      "--pulseColor": meta.color,
                    } as React.CSSProperties
                  }
                />
                <span className="cadence-row__name">{meta.label}</span>
                <span className="cadence-row__bar">
                  <span
                    className="cadence-row__bar-fill"
                    style={{
                      width: `${pctOfMax}%`,
                      background: `linear-gradient(90deg, ${meta.color} 0%, transparent 100%)`,
                    }}
                  />
                </span>
                <span className="cadence-row__meta">
                  {meta.cadence} · {r.toFixed(1)}/s
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="planned">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Chapter 01.3 · Not yet observable
          </div>
          <h3>Planned telemetry</h3>
          <p>
            The tiles below sketch signals worth exposing next. They’re
            deliberately dimmed — none are wired yet, and this page refuses to
            fake them.
          </p>
        </div>
        <div className="planned__grid">
          <PlannedTile
            title="Kafka consumer lag"
            desc="Per-partition lag between Producer offset and Consumer committed offset."
            req="Requires Kafka admin client + /metrics endpoint"
          />
          <PlannedTile
            title="Latency breakdown"
            desc="End-to-end latency split across publish, commit, Redis write, Mongo write."
            req="Requires handler-level tracing (Micrometer / OTel)"
          />
          <PlannedTile
            title="Redis hit / miss"
            desc="Ratio of /latest requests served from cache vs. falling back to MongoDB."
            req="Requires counter instrumentation in SensorController"
          />
          <PlannedTile
            title="DLT queue"
            desc="Dead-letter topic depth and last failure reason, surfaced inline."
            req="Requires error handler + DLT exposure"
          />
          <PlannedTile
            title="Per-topic throughput"
            desc="Produced vs. consumed rate over a rolling window, by partition."
            req="Requires broker metrics passthrough"
          />
          <PlannedTile
            title="Mongo write pressure"
            desc="Ingest rate, p95 write latency, pending batch size."
            req="Requires driver-level metrics"
          />
        </div>
      </section>
    </>
  );
}

function NodeDetail({
  color,
  tag,
  title,
  role,
  desc,
}: {
  color: string;
  tag: string;
  title: string;
  role: string;
  desc: string;
}) {
  return (
    <article
      className="node-card"
      style={{ ["--node-color" as string]: color } as React.CSSProperties}
    >
      <span className="node-card__tag">
        <span className="square" />
        {tag}
      </span>
      <h3>{title}</h3>
      <p>{desc}</p>
      <span className="node-card__role">› {role}</span>
    </article>
  );
}

function KeyPoint({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="key-point">
      <div className="key-point__num">{n}</div>
      <div className="key-point__body">
        <h4>{title}</h4>
        <p>{body}</p>
      </div>
    </div>
  );
}

function PlannedTile({
  title,
  desc,
  req,
}: {
  title: string;
  desc: string;
  req: string;
}) {
  return (
    <div className="planned-tile">
      <span className="planned-tile__tag">Planned</span>
      <h4>{title}</h4>
      <p>{desc}</p>
      <span className="planned-tile__req">{req}</span>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
