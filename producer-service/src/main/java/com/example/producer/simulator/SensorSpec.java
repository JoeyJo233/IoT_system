package com.example.producer.simulator;

/**
 * Immutable description of a simulated sensor. Published together with
 * simulation status so the Web UI can drive its catalog from the backend.
 */
public record SensorSpec(
        String id,
        String type,
        long intervalMs,
        String unit,
        double minValue,
        double maxValue,
        String location,
        DataModel dataModel
) {
    /** Convenience constructor — defaults to RANDOM data model. */
    public SensorSpec(String id, String type, long intervalMs, String unit,
                      double minValue, double maxValue, String location) {
        this(id, type, intervalMs, unit, minValue, maxValue, location, DataModel.RANDOM);
    }
}
