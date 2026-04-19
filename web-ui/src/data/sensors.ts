import type { SensorSpec, SensorType } from "../types";

export const SENSORS: SensorSpec[] = [
  {
    id: "sensor-temp-001",
    type: "TEMPERATURE",
    unit: "°C",
    intervalMs: 10_000,
    min: 15,
    max: 35,
    location: "warehouse-A",
  },
  {
    id: "sensor-temp-002",
    type: "TEMPERATURE",
    unit: "°C",
    intervalMs: 10_000,
    min: 15,
    max: 35,
    location: "warehouse-B",
  },
  {
    id: "sensor-humi-001",
    type: "HUMIDITY",
    unit: "%",
    intervalMs: 5_000,
    min: 30,
    max: 80,
    location: "warehouse-A",
  },
  {
    id: "sensor-humi-002",
    type: "HUMIDITY",
    unit: "%",
    intervalMs: 5_000,
    min: 30,
    max: 80,
    location: "warehouse-B",
  },
  {
    id: "sensor-pres-001",
    type: "PRESSURE",
    unit: "hPa",
    intervalMs: 2_000,
    min: 980,
    max: 1050,
    location: "pipeline-1",
  },
  {
    id: "sensor-pres-002",
    type: "PRESSURE",
    unit: "hPa",
    intervalMs: 2_000,
    min: 980,
    max: 1050,
    location: "pipeline-2",
  },
  {
    id: "sensor-vibr-001",
    type: "VIBRATION",
    unit: "mm/s",
    intervalMs: 500,
    min: 0,
    max: 10,
    location: "machine-1",
    hot: true,
  },
  {
    id: "sensor-vibr-002",
    type: "VIBRATION",
    unit: "mm/s",
    intervalMs: 500,
    min: 0,
    max: 10,
    location: "machine-2",
    hot: true,
  },
];

export const TYPE_META: Record<
  SensorType,
  {
    label: string;
    color: string;
    soft: string;
    kicker: string;
    cadence: string;
  }
> = {
  TEMPERATURE: {
    label: "Temperature",
    color: "var(--node-consumer)",
    soft: "var(--node-consumer-soft)",
    kicker: "TEMP",
    cadence: "10 s",
  },
  HUMIDITY: {
    label: "Humidity",
    color: "var(--node-producer)",
    soft: "var(--node-producer-soft)",
    kicker: "HUMI",
    cadence: "5 s",
  },
  PRESSURE: {
    label: "Pressure",
    color: "var(--node-kafka)",
    soft: "var(--node-kafka-soft)",
    kicker: "PRES",
    cadence: "2 s",
  },
  VIBRATION: {
    label: "Vibration",
    color: "var(--node-redis)",
    soft: "var(--node-redis-soft)",
    kicker: "VIBR",
    cadence: "500 ms",
  },
};

export const ALL_TYPES: SensorType[] = [
  "TEMPERATURE",
  "HUMIDITY",
  "PRESSURE",
  "VIBRATION",
];
