package com.example.producer.simulator;

/**
 * Immutable description of a simulated sensor. Published together with
 * simulation status so the Web UI can drive its catalog from the backend
 * rather than duplicating the list in the frontend.
 */
public record SensorSpec(
        String id,
        String type,
        long intervalMs,
        String unit,
        double minValue,
        double maxValue,
        String location
) {
}
