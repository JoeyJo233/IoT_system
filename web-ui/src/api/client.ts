import type {
  Reading,
  SensorStatus,
  SensorType,
  SimulationStatus,
  CreateSensorRequest,
  UpdateSensorRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Fetch primitives
// ---------------------------------------------------------------------------

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new ApiError(url, res.status, await res.text().catch(() => ""));
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(url, res.status, `Non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return getJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  return getJson<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteReq(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(url, res.status, await res.text().catch(() => ""));
  }
}

export class ApiError extends Error {
  constructor(
    public url: string,
    public statusCode: number,
    public body: string,
  ) {
    super(`${statusCode} ${url} — ${body || "no body"}`);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Simulation control (producer-service)
// ---------------------------------------------------------------------------

export const simulationApi = {
  status: () => getJson<SimulationStatus>("/api/simulation/status"),

  startAll: () => getJson<SimulationStatus>("/api/simulation/start", { method: "POST" }),
  stopAll: () => getJson<SimulationStatus>("/api/simulation/stop", { method: "POST" }),

  startOne: (sensorId: string) =>
    getJson<SensorStatus>(
      `/api/simulation/sensors/${encodeURIComponent(sensorId)}/start`,
      { method: "POST" },
    ),

  stopOne: (sensorId: string) =>
    getJson<SensorStatus>(
      `/api/simulation/sensors/${encodeURIComponent(sensorId)}/stop`,
      { method: "POST" },
    ),

  createSensor: (req: CreateSensorRequest) =>
    postJson<SensorStatus>("/api/simulation/sensors", req),

  updateSensor: (sensorId: string, req: UpdateSensorRequest) =>
    putJson<SensorStatus>(`/api/simulation/sensors/${encodeURIComponent(sensorId)}`, req),

  deleteSensor: (sensorId: string) =>
    deleteReq(`/api/simulation/sensors/${encodeURIComponent(sensorId)}`),
};

// ---------------------------------------------------------------------------
// Sensor queries (consumer-service)
// ---------------------------------------------------------------------------

export const sensorsApi = {
  latest: async (sensorId: string): Promise<Reading | null> => {
    try {
      return await getJson<Reading>(`/api/sensors/${encodeURIComponent(sensorId)}/latest`);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) return null;
      throw e;
    }
  },

  history: (sensorId: string) =>
    getJson<Reading[]>(`/api/sensors/${encodeURIComponent(sensorId)}/history`),

  byType: (sensorType: SensorType) =>
    getJson<Reading[]>(`/api/sensors/type/${encodeURIComponent(sensorType)}`),

  latestMany: async (ids: string[]): Promise<Record<string, Reading | null>> => {
    const pairs = await Promise.all(
      ids
        .map((id) => sensorsApi.latest(id).then((r) => [id, r] as const).catch(() => [id, null] as const)),
    );
    return Object.fromEntries(pairs);
  },
};
