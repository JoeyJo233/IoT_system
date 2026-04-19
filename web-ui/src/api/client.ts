import type { Reading, SensorStatus, SensorType, SimulationStatus } from "./types";

// ---------------------------------------------------------------------------
// Fetch primitives
//
// All requests go through /api/... relative paths. In dev the Vite proxy
// forwards /api/simulation to the producer (port 8081) and /api/sensors to
// the consumer (port 8082). In a same-origin deployment they can be routed
// the same way by a reverse proxy.
// ---------------------------------------------------------------------------

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new ApiError(url, res.status, await res.text().catch(() => ""));
  }
  // 204 No Content / empty body → undefined
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(url, res.status, `Non-JSON response: ${text.slice(0, 200)}`);
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

  startAll: () =>
    getJson<SimulationStatus>("/api/simulation/start", { method: "POST" }),

  stopAll: () =>
    getJson<SimulationStatus>("/api/simulation/stop", { method: "POST" }),

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
};

// ---------------------------------------------------------------------------
// Sensor queries (consumer-service)
// ---------------------------------------------------------------------------

export const sensorsApi = {
  /**
   * Latest reading for a single sensor. The backend first checks Redis and
   * falls back to Mongo; 404 when the sensor has never published.
   */
  latest: async (sensorId: string): Promise<Reading | null> => {
    try {
      return await getJson<Reading>(
        `/api/sensors/${encodeURIComponent(sensorId)}/latest`,
      );
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) return null;
      throw e;
    }
  },

  history: (sensorId: string) =>
    getJson<Reading[]>(
      `/api/sensors/${encodeURIComponent(sensorId)}/history`,
    ),

  byType: (sensorType: SensorType) =>
    getJson<Reading[]>(
      `/api/sensors/type/${encodeURIComponent(sensorType)}`,
    ),

  /**
   * Convenience: fetch latest for every known sensor concurrently.
   */
  latestMany: async (ids: string[]): Promise<Record<string, Reading | null>> => {
    const pairs = await Promise.all(
      ids.map((id) => sensorsApi.latest(id).then((r) => [id, r] as const).catch(() => [id, null] as const)),
    );
    return Object.fromEntries(pairs);
  },
};
