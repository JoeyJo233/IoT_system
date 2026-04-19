export type SensorType =
  | "TEMPERATURE"
  | "HUMIDITY"
  | "PRESSURE"
  | "VIBRATION";

export interface SensorSpec {
  id: string;
  type: SensorType;
  unit: string;
  intervalMs: number;
  min: number;
  max: number;
  location: string;
  hot?: boolean;
}

export interface Reading {
  sensorId: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: number;
  location: string;
}

export interface SensorState {
  spec: SensorSpec;
  running: boolean;
  latest: Reading | null;
  history: Reading[]; // bounded ring buffer
  count: number;
}
