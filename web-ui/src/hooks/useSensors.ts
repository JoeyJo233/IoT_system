import { useMemo } from "react";
import { sensorsApi, simulationApi } from "../api/client";
import type { Reading, SensorType, SimulationStatus } from "../api/types";
import { usePoll } from "./usePoll";

// ---------------------------------------------------------------------------
// Cadences
//
// Polling intervals are picked per endpoint based on the underlying cadence:
//  - Simulation status: slow, only changes when the user toggles something
//  - Latest values: moderately fast — the cache updates on every Kafka tick
//  - Type feeds & history: slower, these are heavier payloads
// ---------------------------------------------------------------------------

const STATUS_POLL = 4_000;
const LATEST_POLL = 1_500;
const TYPE_POLL = 3_000;
const HISTORY_POLL = 4_000;

export function useSimulationStatus() {
  return usePoll<SimulationStatus>(simulationApi.status, {
    intervalMs: STATUS_POLL,
  });
}

/**
 * Latest reading for every sensor. Returns a dictionary keyed by sensorId.
 * Individual sensor 404s become nulls so the UI can render "awaiting data".
 */
export function useLatestMany(sensorIds: string[]) {
  const key = sensorIds.join(",");
  return usePoll<Record<string, Reading | null>>(
    () => sensorsApi.latestMany(sensorIds),
    { intervalMs: LATEST_POLL, key, enabled: sensorIds.length > 0 },
  );
}

export function useHistory(sensorId: string | null) {
  return usePoll<Reading[]>(
    () => (sensorId ? sensorsApi.history(sensorId) : Promise.resolve([])),
    {
      intervalMs: HISTORY_POLL,
      key: sensorId ?? "",
      enabled: !!sensorId,
    },
  );
}

/**
 * Merge recent readings across a set of types. Each type endpoint returns
 * the full collection sorted newest-first; we take a top slice per type and
 * interleave by timestamp so the table can show a unified feed.
 */
export function useRecentByTypes(types: SensorType[], perType = 40) {
  const key = [...types].sort().join(",");
  const poll = usePoll<Reading[]>(
    async () => {
      const lists = await Promise.all(
        types.map((t) =>
          sensorsApi.byType(t).then((all) => all.slice(0, perType)).catch(() => []),
        ),
      );
      return lists.flat().sort((a, b) => b.timestamp - a.timestamp);
    },
    { intervalMs: TYPE_POLL, key, enabled: types.length > 0 },
  );
  return poll;
}

/**
 * Derived: flatten latest readings into history-style series per type so the
 * live chart can render without a separate bulk endpoint. We keep the most
 * recent N samples per type in a module-scoped ring buffer so the chart has
 * something to plot from the very first tick.
 */
const liveBuffer: Record<SensorType, Reading[]> = {
  TEMPERATURE: [],
  HUMIDITY: [],
  PRESSURE: [],
  VIBRATION: [],
};
const LIVE_BUFFER_LIMIT = 240;

export function useLiveBufferFromLatest(
  latest: Record<string, Reading | null> | null,
): Record<SensorType, Reading[]> {
  return useMemo(() => {
    if (!latest) return { ...liveBuffer };
    for (const r of Object.values(latest)) {
      if (!r) continue;
      const arr = liveBuffer[r.sensorType];
      const last = arr[arr.length - 1];
      // Only push unique (timestamp, sensor) combinations — the /latest
      // endpoint can return the same value across several polls.
      if (!last || last.sensorId !== r.sensorId || last.timestamp !== r.timestamp) {
        arr.push(r);
        if (arr.length > LIVE_BUFFER_LIMIT) arr.shift();
      }
    }
    return { ...liveBuffer };
  }, [latest]);
}
