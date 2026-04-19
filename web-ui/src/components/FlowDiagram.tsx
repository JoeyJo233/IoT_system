import { useEffect, useState } from "react";
import { useSimulationStatus } from "../hooks/useSensors";

type PulseKey = "producer" | "kafka" | "consumer" | "redis" | "mongo";

interface Node {
  id: PulseKey | "sensors";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kicker: string;
  color: string;
  soft: string;
  meta?: string;
}

const VB_W = 1080;
const VB_H = 430;

const NODES: Node[] = [
  {
    id: "sensors",
    x: 22,
    y: 52,
    w: 150,
    h: 326,
    label: "Sensors",
    kicker: "01 · edge",
    color: "var(--node-sensor)",
    soft: "var(--node-sensor-soft)",
    meta: undefined,
  },
  {
    id: "producer",
    x: 228,
    y: 178,
    w: 150,
    h: 74,
    label: "Producer",
    kicker: "02 · publish",
    color: "var(--node-producer)",
    soft: "var(--node-producer-soft)",
    meta: "KafkaTemplate",
  },
  {
    id: "kafka",
    x: 424,
    y: 178,
    w: 150,
    h: 74,
    label: "Kafka",
    kicker: "03 · buffer",
    color: "var(--node-kafka)",
    soft: "var(--node-kafka-soft)",
    meta: "iot-sensor-data",
  },
  {
    id: "consumer",
    x: 620,
    y: 178,
    w: 150,
    h: 74,
    label: "Consumer",
    kicker: "04 · fan-out",
    color: "var(--node-consumer)",
    soft: "var(--node-consumer-soft)",
    meta: "@KafkaListener",
  },
  {
    id: "redis",
    x: 830,
    y: 74,
    w: 220,
    h: 74,
    label: "Redis",
    kicker: "05 · hot path",
    color: "var(--node-redis)",
    soft: "var(--node-redis-soft)",
    meta: "sensor:latest:{id}",
  },
  {
    id: "mongo",
    x: 830,
    y: 282,
    w: 220,
    h: 74,
    label: "MongoDB",
    kicker: "06 · history",
    color: "var(--node-mongo)",
    soft: "var(--node-mongo-soft)",
    meta: "sensor_readings",
  },
];

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

export default function FlowDiagram() {
  const sim = useSimulationStatus();
  const running = sim.data?.running ?? false;
  const rate = sim.data?.messageRatePerSecond ?? 0;
  const totalCount = sim.data?.totalCount ?? 0;

  // Drive halo pulses from a local counter. Period is inversely related to
  // the producer rate so the diagram visually slows when the backend slows.
  const [pulseTick, setPulseTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const period = Math.max(180, Math.min(1500, 1000 / Math.max(0.5, rate)));
    const h = window.setInterval(() => setPulseTick((n) => n + 1), period);
    return () => clearInterval(h);
  }, [running, rate]);

  const producer = nodeById("producer");
  const kafka = nodeById("kafka");
  const consumer = nodeById("consumer");
  const redis = nodeById("redis");
  const mongo = nodeById("mongo");
  const sensors = nodeById("sensors");

  // Edge paths (cubic bezier). Keep consistent entry/exit geometry.
  const sensorsOut = { x: sensors.x + sensors.w, y: sensors.y + sensors.h / 2 };
  const producerIn = { x: producer.x, y: producer.y + producer.h / 2 };
  const producerOut = {
    x: producer.x + producer.w,
    y: producer.y + producer.h / 2,
  };
  const kafkaIn = { x: kafka.x, y: kafka.y + kafka.h / 2 };
  const kafkaOut = { x: kafka.x + kafka.w, y: kafka.y + kafka.h / 2 };
  const consumerIn = { x: consumer.x, y: consumer.y + consumer.h / 2 };
  const consumerOut = {
    x: consumer.x + consumer.w,
    y: consumer.y + consumer.h / 2,
  };
  const redisIn = { x: redis.x, y: redis.y + redis.h / 2 };
  const mongoIn = { x: mongo.x, y: mongo.y + mongo.h / 2 };

  const edges = [
    {
      id: "sp",
      d: curve(sensorsOut, producerIn, 0.55),
      color: "var(--node-sensor)",
      rate: 3.4,
      label: "publish",
    },
    {
      id: "pk",
      d: curve(producerOut, kafkaIn, 0.4),
      color: "var(--node-producer)",
      rate: 5,
      label: "record",
    },
    {
      id: "kc",
      d: curve(kafkaOut, consumerIn, 0.4),
      color: "var(--node-kafka)",
      rate: 5,
      label: "consume",
    },
    {
      id: "cr",
      d: curve(consumerOut, redisIn, 0.5),
      color: "var(--node-consumer)",
      rate: 6,
      label: "set",
    },
    {
      id: "cm",
      d: curve(consumerOut, mongoIn, 0.5),
      color: "var(--node-consumer)",
      rate: 6,
      label: "insert",
    },
  ];

  return (
    <svg
      className="flow-canvas"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Pipeline diagram"
    >
      {/* Figure marks (top-left) */}
      <text x={18} y={26} className="figure-title-mark">
        § PIPELINE
      </text>
      <line
        x1={18}
        y1={34}
        x2={180}
        y2={34}
        stroke="var(--rule)"
        strokeWidth={1}
      />

      {/* Edges first so nodes sit above them */}
      <defs>
        {edges.map((e) => (
          <path key={`${e.id}-def`} id={`path-${e.id}`} d={e.d} />
        ))}
      </defs>

      {edges.map((e) => (
        <g key={e.id}>
          <path
            d={e.d}
            className="edge edge--static"
            stroke={e.color}
            style={{
              strokeDasharray: "2 6",
              opacity: 0.32,
            }}
          />
          <path
            d={e.d}
            className="edge edge--flow"
            stroke={e.color}
            style={{
              strokeDasharray: "8 10",
              animation: `march ${8 / e.rate}s linear infinite`,
              opacity: 0.85,
            }}
          />
        </g>
      ))}

      {/* Floating packets per edge via animateMotion */}
      {edges.map((e) => (
        <g key={`packet-${e.id}`}>
          <PacketTrain pathId={`path-${e.id}`} color={e.color} rate={e.rate} />
        </g>
      ))}

      {/* Sensors container — render child rows inside */}
      <SensorsNode node={sensors} running={running} totalCount={totalCount} />

      {/* Other nodes */}
      {NODES.filter((n) => n.id !== "sensors").map((n) => (
        <NodeBlock
          key={n.id}
          node={n}
          pulseKey={running ? pulseTick + pulseOffset(n.id as PulseKey) : 0}
        />
      ))}

      {/* Edge labels */}
      <EdgeLabels edges={edges} />

      {/* Annotations */}
      <text
        x={producer.x + producer.w / 2}
        y={producer.y + producer.h + 28}
        textAnchor="middle"
        className="node-meta"
      >
        · keyed by sensorId ·
      </text>
      <text
        x={kafka.x + kafka.w / 2}
        y={kafka.y + kafka.h + 28}
        textAnchor="middle"
        className="node-meta"
      >
        · decouples ingest from storage ·
      </text>
      <text
        x={consumer.x + consumer.w / 2}
        y={consumer.y + consumer.h + 28}
        textAnchor="middle"
        className="node-meta"
      >
        · writes twice, one handler ·
      </text>

      {/* Inline styles for march animation & particle fade */}
      <style>{`
        @keyframes march {
          to { stroke-dashoffset: -180; }
        }
        @keyframes haloGrow {
          0% { opacity: 0.9; r: 4; }
          100% { opacity: 0; r: 22; }
        }
        .packet {
          filter: drop-shadow(0 0 3px rgba(0,0,0,0.08));
        }
      `}</style>
    </svg>
  );
}

function pulseOffset(id: PulseKey): number {
  // Spread halo restarts so the pipeline doesn't blink in lockstep.
  switch (id) {
    case "producer":
      return 0;
    case "kafka":
      return 1;
    case "consumer":
      return 2;
    case "redis":
      return 3;
    case "mongo":
      return 4;
  }
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.45) {
  const dx = (b.x - a.x) * bend;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function NodeBlock({ node, pulseKey }: { node: Node; pulseKey: number }) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  return (
    <g className="node-group">
      {/* halo — remounted on pulse */}
      <circle
        key={`halo-${pulseKey}`}
        cx={cx}
        cy={cy}
        r={4}
        className="node-halo pulse"
        stroke={node.color}
      />
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={10}
        className="node-rect"
        fill={node.soft}
        stroke={node.color}
        style={{ strokeOpacity: 0.28 }}
      />
      <text
        x={node.x + 14}
        y={node.y + 22}
        className="node-subtitle"
        style={{ fill: node.color }}
      >
        {node.kicker}
      </text>
      <text x={node.x + 14} y={node.y + 46} className="node-title">
        {node.label}
      </text>
      {node.meta && (
        <text x={node.x + 14} y={node.y + node.h - 14} className="node-meta">
          {node.meta}
        </text>
      )}
    </g>
  );
}

function SensorsNode({ node, running, totalCount }: { node: Node; running: boolean; totalCount: number }) {
  const rows = [
    { label: "temperature", cadence: "10s", color: "var(--node-consumer)" },
    { label: "humidity", cadence: "5s", color: "var(--node-producer)" },
    { label: "pressure", cadence: "2s", color: "var(--node-kafka)" },
    { label: "vibration", cadence: "500ms", color: "var(--node-redis)", hot: true },
  ];
  const rowH = (node.h - 36) / rows.length;

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={12}
        fill={node.soft}
        stroke={node.color}
        strokeOpacity={0.28}
        strokeWidth={1.2}
      />
      <text
        x={node.x + 14}
        y={node.y + 22}
        className="node-subtitle"
        style={{ fill: node.color }}
      >
        {node.kicker}
      </text>
      <text x={node.x + 14} y={node.y + 28 + 16} className="node-title">
        {node.label}
      </text>
      {totalCount > 0 && (
        <text x={node.x + node.w - 14} y={node.y + 28 + 16} textAnchor="end" className="node-meta">
          {totalCount} devices
        </text>
      )}

      {rows.map((r, i) => {
        const y = node.y + 58 + i * rowH;
        return (
          <g key={r.label}>
            <circle
              cx={node.x + 18}
              cy={y + rowH / 2 - 6}
              r={3.5}
              fill={r.color}
              style={{
                animation: running
                  ? `heartbeat ${i === 3 ? "0.5s" : i === 2 ? "2s" : i === 1 ? "5s" : "10s"} ease-in-out infinite`
                  : "none",
              }}
            />
            <text
              x={node.x + 32}
              y={y + rowH / 2 - 2}
              className="node-meta"
              style={{ fontSize: 10, letterSpacing: "0.1em" }}
            >
              {r.label}
            </text>
            <text
              x={node.x + node.w - 14}
              y={y + rowH / 2 - 2}
              textAnchor="end"
              className="node-meta"
              style={{ fontSize: 10, fill: "var(--ink-faint)" }}
            >
              {r.cadence}
            </text>
          </g>
        );
      })}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { opacity: 0.35; r: 3 }
          40% { opacity: 1; r: 4.2 }
        }
      `}</style>
    </g>
  );
}

function EdgeLabels({ edges }: { edges: { id: string; label: string; color: string }[] }) {
  return (
    <>
      {edges.map((e) => (
        <text key={`label-${e.id}`} className="edge-label">
          <textPath href={`#path-${e.id}`} startOffset="50%" textAnchor="middle">
            {e.label}
          </textPath>
        </text>
      ))}
    </>
  );
}

function PacketTrain({
  pathId,
  color,
  rate,
}: {
  pathId: string;
  color: string;
  rate: number;
}) {
  const duration = 6 / rate;
  // spawn two packets at different phases for a fuller sense of flow
  return (
    <>
      <circle r={3} fill={color} className="packet">
        <animateMotion dur={`${duration}s`} repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <circle r={2} fill={color} opacity={0.55} className="packet">
        <animateMotion
          dur={`${duration}s`}
          begin={`${duration / 2}s`}
          repeatCount="indefinite"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </>
  );
}
