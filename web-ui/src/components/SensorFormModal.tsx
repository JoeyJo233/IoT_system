import { useEffect, useReducer, useState } from "react";
import type { DataModel, SensorStatus, SensorType } from "../api/types";

// ---------------------------------------------------------------------------
// Type defaults — pre-fill unit, min, max when the type dropdown changes
// ---------------------------------------------------------------------------

const TYPE_DEFAULTS: Record<SensorType, { unit: string; min: number; max: number }> = {
  TEMPERATURE: { unit: "°C",   min: 15,  max: 35   },
  HUMIDITY:    { unit: "%",    min: 30,  max: 80   },
  PRESSURE:    { unit: "hPa",  min: 980, max: 1050 },
  VIBRATION:   { unit: "mm/s", min: 0,   max: 10   },
};

const SENSOR_TYPES: SensorType[] = ["TEMPERATURE", "HUMIDITY", "PRESSURE", "VIBRATION"];

const DATA_MODELS: { value: DataModel; label: string; desc: string }[] = [
  { value: "RANDOM",      label: "Uniform random",  desc: "Independent uniform draws from [min, max]" },
  { value: "SINE",        label: "Sine wave",        desc: "Smooth oscillation — period = 30 × interval" },
  { value: "RANDOM_WALK", label: "Random walk",      desc: "Brownian motion anchored to midpoint" },
  { value: "SAWTOOTH",    label: "Sawtooth",         desc: "Linear ramp from min to max, then reset" },
  { value: "STEP",        label: "Step function",    desc: "Holds a value for ~8 ticks, then jumps" },
];

const INTERVALS: { label: string; ms: number }[] = [
  { label: "100 ms",  ms: 100   },
  { label: "500 ms",  ms: 500   },
  { label: "1 s",     ms: 1000  },
  { label: "2 s",     ms: 2000  },
  { label: "5 s",     ms: 5000  },
  { label: "10 s",    ms: 10000 },
  { label: "30 s",    ms: 30000 },
  { label: "60 s",    ms: 60000 },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  sensorId: string;
  sensorType: SensorType;
  location: string;
  intervalMs: number;
  minValue: number;
  maxValue: number;
  dataModel: DataModel;
}

type FormAction =
  | { type: "SET_TYPE"; payload: SensorType; nextId: string }
  | { type: "SET_ID";       payload: string }
  | { type: "SET_LOCATION"; payload: string }
  | { type: "SET_INTERVAL"; payload: number }
  | { type: "SET_MIN";      payload: number }
  | { type: "SET_MAX";      payload: number }
  | { type: "SET_MODEL";    payload: DataModel }
  | { type: "RESET";        payload: FormState };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_TYPE": {
      const d = TYPE_DEFAULTS[action.payload];
      return { ...state, sensorType: action.payload, sensorId: action.nextId, minValue: d.min, maxValue: d.max };
    }
    case "SET_ID":       return { ...state, sensorId: action.payload };
    case "SET_LOCATION": return { ...state, location: action.payload };
    case "SET_INTERVAL": return { ...state, intervalMs: action.payload };
    case "SET_MIN":      return { ...state, minValue: action.payload };
    case "SET_MAX":      return { ...state, maxValue: action.payload };
    case "SET_MODEL":    return { ...state, dataModel: action.payload };
    case "RESET":        return action.payload;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** null → create mode; SensorStatus → edit mode (type locked) */
  editing: SensorStatus | null;
  /** Called with the current sensor list to derive the next available ID */
  existingSensors: SensorStatus[];
  onConfirm(form: FormState): void | Promise<void>;
  onClose(): void;
}

function nextSensorId(type: SensorType, existing: SensorStatus[]): string {
  const prefix = `sensor-${type.substring(0, 4).toLowerCase()}-`;
  const taken = new Set(existing.map((s) => s.sensorId));
  let n = 1;
  while (taken.has(prefix + String(n).padStart(3, "0"))) n++;
  return prefix + String(n).padStart(3, "0");
}

function initialState(editing: SensorStatus | null, existing: SensorStatus[]): FormState {
  if (editing) {
    return {
      sensorId:   editing.sensorId,
      sensorType: editing.sensorType,
      location:   editing.location,
      intervalMs: editing.intervalMs,
      minValue:   editing.minValue,
      maxValue:   editing.maxValue,
      dataModel:  editing.dataModel ?? "RANDOM",
    };
  }
  const type: SensorType = "TEMPERATURE";
  const d = TYPE_DEFAULTS[type];
  return {
    sensorId:   nextSensorId(type, existing),
    sensorType: type,
    location:   "",
    intervalMs: 10000,
    minValue:   d.min,
    maxValue:   d.max,
    dataModel:  "RANDOM",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SensorFormModal({ editing, existingSensors, onConfirm, onClose }: Props) {
  const [form, dispatch] = useReducer(formReducer, null, () =>
    initialState(editing, existingSensors),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Re-sync when the modal is re-opened for a different sensor
  useEffect(() => {
    dispatch({ type: "RESET", payload: initialState(editing, existingSensors) });
    setSubmitError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const isEdit = editing !== null;
  const unit = TYPE_DEFAULTS[form.sensorType].unit;

  const rangeError = form.minValue >= form.maxValue ? "Min must be less than Max" : null;
  const idError = !form.sensorId.trim() ? "Sensor ID is required" : null;
  const locError = !form.location.trim() ? "Location is required" : null;
  const canSubmit = !rangeError && !idError && !locError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(form);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Request failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {isEdit ? "Edit sensor" : "Add new sensor"}
            </div>
            <h3 style={{ margin: 0, fontWeight: 450, fontSize: 22 }}>
              {isEdit ? form.sensorId : "Configure a new sensor"}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Row 1: Type + Location */}
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Sensor type</label>
              {isEdit ? (
                <div className="modal-value-static">
                  {form.sensorType}
                  <span className="modal-static-hint"> · locked after creation</span>
                </div>
              ) : (
                <select
                  className="modal-select"
                  value={form.sensorType}
                  onChange={(e) => {
                    const t = e.target.value as SensorType;
                    dispatch({
                      type: "SET_TYPE",
                      payload: t,
                      nextId: nextSensorId(t, existingSensors),
                    });
                  }}
                >
                  {SENSOR_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="modal-field">
              <label className="modal-label">Location</label>
              <input
                className={`modal-input ${locError ? "modal-input--error" : ""}`}
                type="text"
                placeholder="e.g. warehouse-C"
                value={form.location}
                onChange={(e) => dispatch({ type: "SET_LOCATION", payload: e.target.value })}
                autoFocus={!isEdit}
              />
            </div>
          </div>

          {/* Sensor ID */}
          {!isEdit && (
            <div className="modal-field modal-field--full">
              <label className="modal-label">Sensor ID · auto-generated, editable</label>
              <input
                className={`modal-input modal-input--mono ${idError ? "modal-input--error" : ""}`}
                type="text"
                value={form.sensorId}
                onChange={(e) => dispatch({ type: "SET_ID", payload: e.target.value })}
                spellCheck={false}
              />
            </div>
          )}

          {/* Row 2: Range */}
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Min value · {unit}</label>
              <input
                className={`modal-input ${rangeError ? "modal-input--error" : ""}`}
                type="number"
                step="any"
                value={form.minValue}
                onChange={(e) => dispatch({ type: "SET_MIN", payload: parseFloat(e.target.value) })}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Max value · {unit}</label>
              <input
                className={`modal-input ${rangeError ? "modal-input--error" : ""}`}
                type="number"
                step="any"
                value={form.maxValue}
                onChange={(e) => dispatch({ type: "SET_MAX", payload: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          {rangeError && <div className="modal-error">{rangeError}</div>}

          {/* Row 3: Interval + Model */}
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Sample interval</label>
              <select
                className="modal-select"
                value={form.intervalMs}
                onChange={(e) => dispatch({ type: "SET_INTERVAL", payload: parseInt(e.target.value) })}
              >
                {INTERVALS.map((iv) => (
                  <option key={iv.ms} value={iv.ms}>{iv.label}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Data model</label>
              <select
                className="modal-select"
                value={form.dataModel}
                onChange={(e) => dispatch({ type: "SET_MODEL", payload: e.target.value as DataModel })}
              >
                {DATA_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Model description */}
          <div className="modal-model-desc">
            {DATA_MODELS.find((m) => m.value === form.dataModel)?.desc}
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="modal-error" style={{ marginTop: 0 }}>
              ✕ {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit || submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add sensor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type { FormState };
