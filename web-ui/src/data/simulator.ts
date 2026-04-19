import { useEffect, useRef, useSyncExternalStore } from "react";
import { SENSORS } from "./sensors";
import type { Reading, SensorSpec, SensorState, SensorType } from "../types";

const HISTORY_LIMIT = 180;

interface Store {
  running: boolean;
  sensors: Record<string, SensorState>;
  totals: {
    produced: number;
    consumed: number;
    cached: number;
    persisted: number;
    startedAt: number;
  };
  pulses: {
    producer: number;
    kafka: number;
    consumer: number;
    redis: number;
    mongo: number;
  };
}

function initial(): Store {
  const sensors: Record<string, SensorState> = {};
  for (const spec of SENSORS) {
    sensors[spec.id] = {
      spec,
      running: true,
      latest: null,
      history: [],
      count: 0,
    };
  }
  return {
    running: true,
    sensors,
    totals: {
      produced: 0,
      consumed: 0,
      cached: 0,
      persisted: 0,
      startedAt: Date.now(),
    },
    pulses: {
      producer: 0,
      kafka: 0,
      consumer: 0,
      redis: 0,
      mongo: 0,
    },
  };
}

let state: Store = initial();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function walk(spec: SensorSpec, previous: number | null): number {
  // Random walk constrained to range, with distinct character per sensor type
  const span = spec.max - spec.min;
  const noiseScale =
    spec.type === "VIBRATION"
      ? 0.35
      : spec.type === "PRESSURE"
        ? 0.04
        : spec.type === "HUMIDITY"
          ? 0.05
          : 0.03;

  if (previous == null) {
    return spec.min + Math.random() * span;
  }

  const drift = (Math.random() - 0.5) * span * noiseScale;
  const seasonal = Math.sin(Date.now() / 24_000 + spec.id.length) * span * 0.02;
  const next = previous + drift + seasonal;
  return Math.max(spec.min, Math.min(spec.max, next));
}

function tick(spec: SensorSpec) {
  const current = state.sensors[spec.id];
  if (!state.running || !current.running) return;

  const value = Number(walk(spec, current.latest?.value ?? null).toFixed(2));
  const reading: Reading = {
    sensorId: spec.id,
    sensorType: spec.type,
    value,
    unit: spec.unit,
    timestamp: Date.now(),
    location: spec.location,
  };

  const nextHistory = [...current.history, reading];
  if (nextHistory.length > HISTORY_LIMIT) nextHistory.shift();

  state = {
    ...state,
    sensors: {
      ...state.sensors,
      [spec.id]: {
        ...current,
        latest: reading,
        history: nextHistory,
        count: current.count + 1,
      },
    },
    totals: {
      ...state.totals,
      produced: state.totals.produced + 1,
      consumed: state.totals.consumed + 1,
      cached: state.totals.cached + 1,
      persisted: state.totals.persisted + 1,
    },
    pulses: {
      producer: Date.now(),
      kafka: Date.now(),
      consumer: Date.now(),
      redis: Date.now(),
      mongo: Date.now(),
    },
  };
  emit();
}

// -------- lifecycle --------
const timers = new Map<string, number>();

function startAll() {
  for (const spec of SENSORS) startOne(spec.id);
}

function startOne(id: string) {
  stopOne(id);
  const spec = state.sensors[id]?.spec;
  if (!spec) return;
  // Kick an immediate reading so UI populates right away
  tick(spec);
  const handle = window.setInterval(() => tick(spec), spec.intervalMs);
  timers.set(id, handle);
}

function stopOne(id: string) {
  const handle = timers.get(id);
  if (handle != null) {
    clearInterval(handle);
    timers.delete(id);
  }
}

function stopAll() {
  for (const id of Array.from(timers.keys())) stopOne(id);
}

// -------- public controls --------
export const controls = {
  startAll() {
    state = {
      ...state,
      running: true,
      sensors: Object.fromEntries(
        Object.entries(state.sensors).map(([id, s]) => [
          id,
          { ...s, running: true },
        ]),
      ),
    };
    startAll();
    emit();
  },
  stopAll() {
    state = {
      ...state,
      running: false,
      sensors: Object.fromEntries(
        Object.entries(state.sensors).map(([id, s]) => [
          id,
          { ...s, running: false },
        ]),
      ),
    };
    stopAll();
    emit();
  },
  toggleSensor(id: string) {
    const current = state.sensors[id];
    if (!current) return;
    const nextRunning = !current.running;
    state = {
      ...state,
      sensors: {
        ...state.sensors,
        [id]: { ...current, running: nextRunning },
      },
    };
    if (nextRunning) {
      if (!state.running) state = { ...state, running: true };
      startOne(id);
    } else {
      stopOne(id);
    }
    emit();
  },
};

// -------- subscribe hook --------
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

export function useSimulator() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Auto-start the simulator once per module lifetime
let bootstrapped = false;
export function useBootstrap() {
  const did = useRef(false);
  useEffect(() => {
    if (did.current || bootstrapped) return;
    did.current = true;
    bootstrapped = true;
    startAll();
    return () => {
      // keep simulator running across unmounts — only stop on full refresh
    };
  }, []);
}

// Derivations
export function ratePerSecond(type: SensorType, snapshot: Store): number {
  const sensors = Object.values(snapshot.sensors).filter(
    (s) => s.spec.type === type,
  );
  return sensors.reduce(
    (acc, s) => acc + (s.running ? 1000 / s.spec.intervalMs : 0),
    0,
  );
}

export function totalRate(snapshot: Store): number {
  return Object.values(snapshot.sensors).reduce(
    (acc, s) => acc + (s.running ? 1000 / s.spec.intervalMs : 0),
    0,
  );
}

export function activeCount(snapshot: Store): number {
  return Object.values(snapshot.sensors).filter((s) => s.running).length;
}

export function recentReadings(snapshot: Store, n = 24): Reading[] {
  const merged: Reading[] = [];
  for (const s of Object.values(snapshot.sensors)) {
    merged.push(...s.history.slice(-6));
  }
  return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, n);
}
