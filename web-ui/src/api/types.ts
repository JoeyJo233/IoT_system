// Backend DTOs. Keep this file as the single source of truth for the shape
// of data coming off the wire; UI components consume these types via hooks.

export type SensorType =
  | "TEMPERATURE"
  | "HUMIDITY"
  | "PRESSURE"
  | "VIBRATION";

export type DataModel =
  | "RANDOM"
  | "SINE"
  | "RANDOM_WALK"
  | "SAWTOOTH"
  | "STEP";

/** /api/sensors/{id}/latest, /history, /type/{type} response item */
export interface Reading {
  sensorId: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: number;
  location: string;
  id?: string;
}

/** One entry in /api/simulation/status.sensors */
export interface SensorStatus {
  sensorId: string;
  sensorType: SensorType;
  intervalMs: number;
  unit: string;
  minValue: number;
  maxValue: number;
  location: string;
  running: boolean;
  dataModel: DataModel;
}

/** /api/simulation/status response */
export interface SimulationStatus {
  running: boolean;
  activeCount: number;
  totalCount: number;
  messageRatePerSecond: number;
  sensors: SensorStatus[];
}

/** POST /api/simulation/sensors request body */
export interface CreateSensorRequest {
  sensorId: string;
  sensorType: SensorType;
  intervalMs: number;
  minValue: number;
  maxValue: number;
  location: string;
  dataModel: DataModel;
}

/** PUT /api/simulation/sensors/{id} request body */
export interface UpdateSensorRequest {
  intervalMs: number;
  minValue: number;
  maxValue: number;
  location: string;
  dataModel: DataModel;
}

export type FetchState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: T | null; error: null }
  | { status: "ok"; data: T; error: null }
  | { status: "error"; data: T | null; error: Error };
